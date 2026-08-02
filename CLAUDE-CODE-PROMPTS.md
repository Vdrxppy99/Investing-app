# Claude Code prompts — Investing-app

Written for **Sonnet**. The design principle: the plan lives in
`UPGRADE_PLAN.md`, so the prompt stays short. You pay for the plan once, not
every message.

---

## Step 1 — one-time setup (run inside Claude Code, **from the Investing-app directory**)

Everything below is scoped to THIS project. Skills and plugins in Claude Code are
scoped by where they are installed:

| Location | Loads in |
|---|---|
| `~/.claude/skills/` | every project |
| `.claude/skills/` | this project only |
| plugin installed with `--scope project` | this project only (written to `.claude/settings.json`) |
| plugin installed without `--scope` | every project |

First register the marketplaces. This only makes plugins *available* to install —
it does not activate anything:

```
/plugin marketplace add anthropics/skills
/plugin marketplace add trailofbits/skills
/plugin marketplace add addyosmani/web-quality-skills
/plugin marketplace add GoogleChrome/modern-web-guidance
/plugin marketplace add cloudflare/skills
```

Then install with `--scope project` so they only ever load here:

```
/plugin install superpowers@claude-plugins-official --scope project
/plugin install example-skills@anthropic-agent-skills --scope project
/plugin install modern-web-guidance@googlechrome --scope project
/plugin install cloudflare@cloudflare --scope project
```

For the Trail of Bits and addyosmani marketplaces, use `/plugin menu` to pick the
individual skills — `insecure-defaults`, `sharp-edges`, `differential-review`,
`core-web-vitals`, `accessibility`, `best-practices` — and choose project scope
when prompted.

The three npx installs must be run **from inside the Investing-app directory**,
with no `-g` flag, so they write to `./.claude/skills/` and not your home dir:

```
npx skills add addyosmani/agent-skills
npx ux-ui-agent-skills init
npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit
```

Already installed in `.claude/skills/`, nothing to do: `lightweight-charts`,
`motion-design`, `swiftui-pro`, `yahoo-finance`, `backtesting`, `sw-release`.

**To turn one off later:** `/plugin disable <name>` for plugins. For the
file-installed skills, add a `skillOverrides` block to `.claude/settings.local.json`:

```json
{ "skillOverrides": { "backtesting": "off" } }
```

(`skillOverrides` does not apply to plugin skills — use `/plugin disable` for those.)

---

## Step 2 — the housekeeping commit (do this first, it saves the most)

```
Add repomix-output.xml and .claude/worktrees/ to .gitignore, and delete
repomix-output.xml from the working tree. Then add a "Context rules" section
to the top of CLAUDE.md stating that neither is ever to be read.
Nothing else. Do not touch css/ or js/.
```

**Why this is first:** `repomix-output.xml` is 2.7 MB sitting in your repo root.
If Sonnet reads it once — and something called "repomix-output" looks exactly
like the file an agent should read to understand a repo — it burns a large share
of the context window on a duplicate of source you already have. This one commit
is probably the largest single usage saving available to you.

---

## Step 3 — the phase prompt (safe for accept-edits mode)

Paste this verbatim. Change only the phase number.

```
Read CLAUDE.md, then UPGRADE_PLAN.md. Execute Phase 0 and nothing else.

Load the skills that phase names. The token-discipline and session-canary
skills apply to every response.

HARD STOP RULES — these override any instinct to be helpful:
- Do the work of this phase only. When its acceptance checkboxes are all
  green, STOP. Do not begin the next phase, do not "get a head start", do
  not suggest continuing. End your turn.
- Do not modify any file this phase does not require. If you are about to
  touch a file outside its scope, STOP and ask me first.
- Do not run `git commit`, `git push`, `git checkout`, `git reset`, or
  delete any file. Leave changes in the working tree for me to review.
- Do not revert the owner scope decisions in CLAUDE.md — the News tab stays
  removed, ACCOUNTS stays at two entries.
- If you get blocked, or something in the plan turns out to be wrong or
  impossible, STOP and tell me. Do not improvise a different approach.
- If you notice something worth fixing that is not in this phase, write it
  down in one line at the end. Do not fix it.

Do not stop to ask for approval along the way. State your plan at the top of
your first message — the specific files you will change and why — then carry
it out in one continuous run. I am in accept-edits mode and will review the
complete diff at the end, so do not break the work into approval steps.

The exception is the hard stop rules above: those still stop you immediately.

When you stop, run `git status` and `git diff --stat` and show me the output,
then report each acceptance checkbox from the phase with the evidence that it
passed: the command you ran and its output, or the file and
line you verified. "Looks correct" is not evidence. If a checkbox is not
green, say so plainly rather than claiming the phase is done.
```

Then `/clear` and start a fresh session for the next phase.

### If a session runs out mid-phase

```
Read CLAUDE.md and UPGRADE_PLAN.md, then run `git status` and `git diff` to
see what was already done for Phase 0. Continue from there under the same
hard stop rules. Do not redo completed work.
```

---

## Step 4 — the commit prompt

Whenever a change touched `css/` or `js/`:

```
Run the sw-release skill checklist before committing.
```

That's it — the skill carries the rest. That checklist is the difference between
a release your installed clients receive and a release where they silently keep
running the old code.

---

## Saving usage on Sonnet

Ranked by how much they actually save:

1. **Delete `repomix-output.xml`** (Step 2). Biggest single win.
2. **One phase per session, `/clear` between.** A long session re-sends its whole
   history with every message. Cost grows quadratically with session length —
   this is where most usage disappears, and it's invisible while it happens.
3. **Plan mode before code on anything non-trivial.** A wrong implementation
   costs the tokens to write it, read it, and undo it. A wrong plan costs a
   paragraph.
4. **Name the files.** "Fix the holdings row overlap in `css/components.css`"
   instead of "fix the layout bug" — the second makes Sonnet search the repo
   first, and the search is often larger than the fix.
5. **Let the skills carry the standing rules.** Don't re-explain the service
   worker rule, the token rule, or the load-order constraint in every prompt.
   That's what `CLAUDE.md` and `sw-release` are for.
6. **Don't ask for a summary of what it just did.** You watched it. It costs a
   full context re-read to produce.
7. **Use `/compact` before you hit the limit**, not after — compaction from a
   clean state is cheaper and keeps more of what matters.

---

## What to keep for yourself, not delegate

Sonnet will do the coding well if the phase is well-specified. Three judgement
calls are yours, and delegating them is how projects like this go wrong:

- **Phase 1, when the math disagrees.** If your XIRR and the oracle differ, the
  bug may be in either one. Work out which by hand before accepting a "fix" —
  an agent will confidently change the wrong side.
- **Phase 5, the crypto.** No skill covers `crypto.subtle` key wrapping. Treat
  agent findings on the vault as leads to investigate, not verdicts.
- **Phase 6, German investment tax.** Vorabpauschale and Teilfreistellung are
  not in the skill. Don't ship an after-tax number you haven't checked against
  a real example.
