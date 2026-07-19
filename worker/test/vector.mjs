/* Verifies webpush.js against RFC 8291 Appendix A — the official Web Push
   encryption test vector. With the vector's fixed keys and salt, our output
   must match the expected encrypted message byte-for-byte.
   Run: node worker/test/vector.mjs */
import { encryptPayload, vapidAuthHeader, b64uEnc, b64uDec } from '../src/webpush.js';

const V = {
  plaintext: 'When I grow up, I want to be a watermelon',
  uaPub: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  asPub: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPriv: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  expected: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'
};

// rebuild the sender's private key as a JWK from the vector's raw scalar + public point
const pub = b64uDec(V.asPub);
const asJwk = { kty: 'EC', crv: 'P-256', d: V.asPriv, x: b64uEnc(pub.slice(1, 33)), y: b64uEnc(pub.slice(33, 65)) };

const out = await encryptPayload(new TextEncoder().encode(V.plaintext), V.uaPub, V.auth, { asJwk, salt: V.salt });
const got = b64uEnc(out);
if (got !== V.expected) {
  console.log('ENCRYPTION FAIL ❌');
  console.log('got:      ' + got);
  console.log('expected: ' + V.expected);
  process.exit(1);
}
console.log('ENCRYPTION PASS ✅  byte-for-byte match with the RFC 8291 test vector');

// VAPID self-test: sign a JWT with a fresh key, verify the signature, check header shape
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
const env = { VAPID_PRIVATE_JWK: JSON.stringify(jwk), VAPID_PUB: b64uEnc(rawPub), VAPID_SUB: 'mailto:test@example.com' };
const hdr = await vapidAuthHeader('https://web.push.apple.com/QLdEyLmN8x', env);
const m = hdr.match(/^vapid t=([^,]+), k=(.+)$/);
if (!m) { console.log('VAPID FAIL ❌ header shape: ' + hdr); process.exit(1); }
const [h, p, s] = m[1].split('.');
const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, b64uDec(s), new TextEncoder().encode(h + '.' + p));
if (!ok || claims.aud !== 'https://web.push.apple.com' || !(claims.exp > Date.now() / 1000) || m[2] !== env.VAPID_PUB) {
  console.log('VAPID FAIL ❌', { ok, claims }); process.exit(1);
}
console.log('VAPID PASS ✅       ES256 JWT verifies, aud/exp/k all correct');
