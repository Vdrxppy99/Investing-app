/* One-time VAPID keypair generator. The private JWK becomes a Worker secret
   (never committed); the public key goes in wrangler.jsonc vars + the app.
   Run: node worker/tools/genvapid.mjs */
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
console.log(JSON.stringify({ privateJwk: JSON.stringify(jwk), publicB64u: Buffer.from(raw).toString('base64url') }));
