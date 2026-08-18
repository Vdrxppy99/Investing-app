# portfolio-push — Worker setup & security notes

The Cloudflare Worker behind the PWA: daily open/close lock-screen reports,
intraday mover alerts, the edge quote proxy (`GET /q`), encrypted-backup storage
and the in-app "Ask" assistant.

Deploy from the repo root:

```
npx wrangler deploy --config worker/wrangler.jsonc
```

---

## Required secrets

| Binding | Purpose |
|---|---|
| `VAPID_PRIVATE_JWK` | Web Push signing key |
| `VAPID_SUB` | Web Push `sub` claim (mailto:) |
| `ADMIN_TOKEN` | Maintenance/test bearer. Unchanged by this session. |
| **`CLIENT_TOKEN`** | **New.** The app's bearer token. Source of truth for `auth()`. |

### Setting `CLIENT_TOKEN` — do this before or right after the next deploy

```bash
npx wrangler secret put CLIENT_TOKEN --config worker/wrangler.jsonc
```

`auth()` (`src/index.js`) used to be trust-on-first-use: it wrote the first bearer
it saw into the KV key `token`, and whoever called first owned the API. If that KV
entry was ever evicted or deleted, the *next* caller — anyone — took it over. There
is now **no code path that writes the KV token key**, so there is nothing left to
claim. `auth()` accepts, in order: `ADMIN_TOKEN`, `CLIENT_TOKEN`, then — read-only,
purely so the current install keeps working before the secret is set — an
*already-present* KV `token`. Absent or evicted KV now means **deny**.

**Two ways to pick the value. Do not invent a new one blindly.**

1. **Easiest — adopt the token the phone already has** (no client change at all).
   Unlock the app, open a JS console against it, and read:

   ```js
   window.VAULT_DATA.pt_push.token
   ```

   (`pt_push` is a private vault key — `js/core.js:14` routes it through
   `window.VAULT_DATA`, so it is only readable after unlock.) Paste that value into
   `wrangler secret put CLIENT_TOKEN`. Nothing on the device needs to change.

2. **Rotating to a fresh token.** Generate one, set it as the secret, then set the
   same value on the device (after unlock) and let the vault persist it:

   ```js
   window.VAULT_DATA.pt_push.token = '<the CLIENT_TOKEN value>';
   window.vaultPersist();
   ```

   Then toggle reports off and on once so `/subscribe` re-pairs.

**Consequence of removing registration, stated plainly:** a from-scratch install
that has *not* restored the encrypted backup generates a brand-new random token
(`ensurePushToken()`, `js/api.js:240`) that will not match, and `/subscribe` will
answer 403. The normal new-phone path (restore backup → `pt_push` comes back with
its token) is unaffected. To pair a from-scratch install, use method 2 above.

---

## Why the snapshot is plaintext

`/snapshot` stores holdings in KV as plaintext JSON. This was reviewed and
deliberately **not** changed, because the Worker is the only thing awake when the
notifications have to be built and it has no key:

| Field | Read at | Needed for |
|---|---|---|
| `holdings[].sym`, `.qty` | `index.js` `buildReport()`, `alerts.js:80,87,170,210` | fetching quotes, valuing the position |
| `cash` | `index.js` `buildReport()`, `alerts.js:86` | portfolio total |
| `prices` | `index.js` `buildReport()` | stale-but-real fallback when a quote fetch fails |
| `alerts` | `alerts.js:111,230` | custom price-target pushes |
| `goal` | `alerts.js:148` | "you're 75% of the way to your goal" |
| `dep` | `alerts.js:143` | "$9,300 of that is growth" in the milestone push |
| `earningsAlerts` | `alerts.js:207` | opt-in earnings-day check |

Encrypting the snapshot client-side would leave the Worker holding opaque bytes at
09:36 ET and **every** push the app sends would stop working — open/close reports,
mover alerts, milestones, goal progress, price targets, earnings, month-in-review.
Doing that properly means moving report generation into the device's service
worker, which is a redesign, not a hardening fix.

What *is* enforced: `/snapshot` is behind `auth()` and there is no registration
path, so only the token holder can write it. The blast radius if the Cloudflare
account itself is compromised is tickers, share counts, cash and a goal amount —
no name, no account numbers, no credentials. The `/backup` blob, which holds
everything, is AES-256-GCM ciphertext the Worker cannot read and that is unchanged.

**Reducing what is synced** (e.g. dropping `dep` and `goal`, which only decorate
push text) is a cheap partial win and is left as a backlog item for the owner.

---

## `/restore` rate limiting

`/restore` is the only unauthenticated POST route. It is now limited by a KV
counter keyed per UTC hour (`rl:restore:<hourEpoch>`), holding a global attempt
count plus per-coarse-IP-bucket counts (IPv4 /24, IPv6 /48). KV is an
account-level namespace, so every isolate in every colo shares the count — the old
`let rlN = 0` reset on each new isolate, which handed a distributed attacker a free
reset. Ceilings: 20 global / 5 per bucket per hour. Over the ceiling returns 429
**without** reading the body and **without** comparing the tag. A correct passcode
clears its own bucket.

KV is eventually consistent, so a simultaneous burst can overshoot by roughly one
propagation window. A Durable Object would be exact; it needs a DO binding plus a
migration in `wrangler.jsonc` and is the upgrade path if this proves insufficient.

### Open finding — NOT fixed here, owner's call

The `/restore` tag is derived from the passcode with a **fixed, public salt**:

```
js/vault.js:179   const CLOUD_ITER=310000, CLOUD_TAG_SALT='pt-cloud-tag-v1';
js/vault.js:182   deriveBits({name:'PBKDF2', salt:enc.encode(CLOUD_TAG_SALT), iterations:CLOUD_ITER, ...})
```

Because the salt is a constant in public source, candidate tags can be computed
**offline** from guessed passcodes — no rate limit touches that, and one online
request confirms a hit. The 310k PBKDF2 iterations and the ≥8-char non-numeric
passcode floor (`js/vault.js:28-32`) are what stand between a guesser and the
backup. Rate limiting narrows the online oracle; it does not fix the offline
precomputation. Changing the derivation would invalidate the existing stored
backup, so it was **not** touched — that is an owner decision.

---

## `account_id` in `wrangler.jsonc`

Acceptable as committed. A Cloudflare account ID is an identifier, not a
credential — it appears in every dashboard URL, and every API call still requires
an API token or OAuth session that is not in this repo. Keeping it pinned prevents
the multi-account misdeploy it was added for (2026-08-09). No change.
