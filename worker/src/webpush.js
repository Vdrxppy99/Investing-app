/* Web Push from a Cloudflare Worker with zero dependencies — WebCrypto only.
   RFC 8291 (aes128gcm payload encryption) + RFC 8292 (VAPID auth).
   Every payload is end-to-end encrypted to the phone's subscription keys:
   Apple's relay moves bytes it cannot read. Verified byte-for-byte against
   the official RFC 8291 Appendix A test vector (worker/test/vector.mjs). */
const te = new TextEncoder();

export const b64uEnc = buf => {
  const b = new Uint8Array(buf); let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const b64uDec = s => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s), u = new Uint8Array(bin.length);
  for (let i = 0; i < u.length; i++) u[i] = bin.charCodeAt(i);
  return u;
};
const cat = (...arrs) => {
  const out = new Uint8Array(arrs.reduce((a, x) => a + x.length, 0));
  let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
};

async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

/* Encrypt a payload for one subscription (RFC 8291).
   testKeys {asJwk, salt} pins the ephemeral key + salt so the RFC vector is reproducible. */
export async function encryptPayload(plainU8, p256dhB64u, authB64u, testKeys) {
  const uaPubRaw = b64uDec(p256dhB64u);   // phone's public key — 65-byte uncompressed P-256 point
  const authSecret = b64uDec(authB64u);   // phone's 16-byte auth secret
  const uaPub = await crypto.subtle.importKey('raw', uaPubRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  let asKeys;
  if (testKeys && testKeys.asJwk) {
    const pubJwk = { ...testKeys.asJwk }; delete pubJwk.d;
    asKeys = {
      privateKey: await crypto.subtle.importKey('jwk', testKeys.asJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']),
      publicKey: await crypto.subtle.importKey('jwk', pubJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, [])
    };
  } else {
    asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  }
  const asPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPub }, asKeys.privateKey, 256));
  // IKM = HKDF(salt=auth_secret, ikm=ecdh_secret, info="WebPush: info"||0x00||ua_public||as_public, 32)
  const ikm = await hkdf(authSecret, ecdh, cat(te.encode('WebPush: info\0'), uaPubRaw, asPubRaw), 32);
  const salt = (testKeys && testKeys.salt) ? b64uDec(testKeys.salt) : crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const record = cat(plainU8, new Uint8Array([2]));  // 0x02 = final-record delimiter (RFC 8188)
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, record));
  // header: salt(16) | rs=4096 uint32BE | idlen(65) | as_public(65)
  return cat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPubRaw.length]), asPubRaw, ct);
}

/* VAPID (RFC 8292): ES256-signed JWT proving this server owns the keypair the phone subscribed to. */
export async function vapidAuthHeader(endpoint, env) {
  const aud = new URL(endpoint).origin;   // e.g. https://web.push.apple.com
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const seg = o => b64uEnc(te.encode(JSON.stringify(o)));
  const unsigned = seg({ typ: 'JWT', alg: 'ES256' }) + '.' +
    seg({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUB || 'mailto:webmaster@example.com' });
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(unsigned)); // WebCrypto emits raw r||s — exactly JOSE format
  return `vapid t=${unsigned}.${b64uEnc(sig)}, k=${env.VAPID_PUB}`;
}

export async function sendWebPush(env, sub, payloadStr, topic) {
  const body = await encryptPayload(te.encode(payloadStr), sub.keys.p256dh, sub.keys.auth);
  const headers = {
    'Authorization': await vapidAuthHeader(sub.endpoint, env),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    'TTL': '43200',            // undelivered pushes expire after 12h — a day-old market report is noise
    'Urgency': 'normal'
  };
  if (topic) headers['Topic'] = topic;  // newer report replaces an undelivered older one
  return fetch(sub.endpoint, { method: 'POST', headers, body });
}
