'use strict';
/* ============ VAULT — passcode + Face ID lock ============
   Real encryption, not a curtain: a random AES-256-GCM master key (MK) encrypts
   all personal data (holdings, lots, cash, deposits, goal). The MK itself is
   stored only in wrapped form:
     · pt_v_pass — MK wrapped by a key derived from the passcode (PBKDF2, 310k)
     · pt_v_prf  — MK wrapped by a key derived from a Face ID passkey (WebAuthn PRF)
   Unlocking either way yields the MK in memory for this session only.
   This file is the ONLY script index.html loads — the rest of the app is
   injected after a successful unlock. */
(function(){
const LS=localStorage;
const enc=new TextEncoder(), dec=new TextDecoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const ub64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
/* ⚠ MUST stay identical to PRIVATE_KEYS in js/core.js (this file loads alone, pre-unlock,
   so it cannot share core's copy). Adding a key? Change BOTH lists + exportBackup(). */
const PRIVATE_KEYS=['pt_holdings','pt_lots','pt_cash','pt_deposits','pt_confirmed','pt_goal','pt_targets','pt_push','pt_bk','pt_alerts'];
const APP_SCRIPTS=['js/boot.js','js/seed.js','js/demo.js','js/core.js','js/portfolio.js','js/api.js',
                   'js/explore.js','js/insights.js','js/sheets.js','js/app.js'];
/* PUBLIC demo passcode — not secret, lives in source. It opens a fictional example portfolio
   (js/demo.js) and can NEVER read or touch the real encrypted vault. Real passcodes are ≥6
   chars, so this can never collide with a real one. */
const DEMO_PASS='demo';
let MK=null; // master key — memory only, gone when the page closes
window.VAULT_DATA=null;
const $id=i=>document.getElementById(i);

/* ---------- crypto primitives ---------- */
async function kekFromPass(pass,salt){
  const km=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},km,
    {name:'AES-GCM',length:256},false,['wrapKey','unwrapKey']);
}
async function kekFromPrf(bits){
  const hk=await crypto.subtle.importKey('raw',bits,'HKDF',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:new Uint8Array(32),info:enc.encode('pt-vault-prf')},hk,
    {name:'AES-GCM',length:256},false,['wrapKey','unwrapKey']);
}
async function wrapMK(kek){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.wrapKey('raw',MK,kek,{name:'AES-GCM',iv});
  return {iv:b64(iv),ct:b64(ct)};
}
async function unwrapMK(kek,w){
  return crypto.subtle.unwrapKey('raw',ub64(w.ct),kek,{name:'AES-GCM',iv:ub64(w.iv)},
    {name:'AES-GCM'},true,['encrypt','decrypt']);
}
async function saveVaultNow(){
  if(!MK||!window.VAULT_DATA) return;
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},MK,enc.encode(JSON.stringify(window.VAULT_DATA)));
  LS.setItem('pt_vault_data',JSON.stringify({iv:b64(iv),ct:b64(ct)}));
}
async function loadVaultData(){
  const raw=LS.getItem('pt_vault_data'); if(!raw) return {};
  const o=JSON.parse(raw);
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:ub64(o.iv)},MK,ub64(o.ct));
  return JSON.parse(dec.decode(pt));
}
/* serialized, debounced persist — called by the app's lsSet for private keys.
   A failed write (storage quota, crypto error) must NEVER be silent: it means edits
   would vanish on close — window.vaultSaveError is surfaced by the app's status line. */
let saveQ=Promise.resolve(), saveDirty=false;
window.vaultSaveError=false;
window.vaultPersist=function(){
  if(!MK) return;
  saveDirty=true;
  saveQ=saveQ.then(async()=>{ if(!saveDirty) return; saveDirty=false;
    try{ await saveVaultNow(); window.vaultSaveError=false; }
    catch(e){ window.vaultSaveError=true; }
  }).catch(()=>{});
};

/* ---------- setup / unlock ---------- */
async function doSetup(pass){
  MK=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const kek=await kekFromPass(pass,salt);
  const w=await wrapMK(kek);
  LS.setItem('pt_v_pass',JSON.stringify({salt:b64(salt),...w}));
  // migrate any existing plaintext data on this device into the vault
  window.VAULT_DATA={};
  for(const k of PRIVATE_KEYS){
    const v=LS.getItem(k);
    if(v!=null){ try{ window.VAULT_DATA[k]=JSON.parse(v); }catch(e){} }
  }
  await saveVaultNow();
  await loadVaultData(); // verify the roundtrip BEFORE deleting plaintext
  for(const k of PRIVATE_KEYS) LS.removeItem(k);
}
async function unlockWithPass(pass){
  const o=JSON.parse(LS.getItem('pt_v_pass'));
  const kek=await kekFromPass(pass,ub64(o.salt));
  MK=await unwrapMK(kek,o); // throws if the passcode is wrong
  window.VAULT_DATA=await loadVaultData();
}

/* ---------- Face ID (WebAuthn passkey + PRF extension) ---------- */
async function enrollFace(){
  if(window.DEMO_MODE) throw new Error('demo');
  const prfSalt=crypto.getRandomValues(new Uint8Array(32));
  const cred=await navigator.credentials.create({publicKey:{
    rp:{id:location.hostname,name:'My Portfolio'},
    user:{id:crypto.getRandomValues(new Uint8Array(16)),name:'portfolio',displayName:'My Portfolio'},
    challenge:crypto.getRandomValues(new Uint8Array(32)),
    pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
    authenticatorSelection:{authenticatorAttachment:'platform',residentKey:'preferred',userVerification:'required'},
    extensions:{prf:{}}, timeout:60000
  }});
  const cx=cred.getClientExtensionResults();
  if(!cx.prf||!cx.prf.enabled) throw new Error('prf-unsupported');
  // fetch the PRF output (most platforms only release it on get())
  const asn=await navigator.credentials.get({publicKey:{
    challenge:crypto.getRandomValues(new Uint8Array(32)),
    allowCredentials:[{type:'public-key',id:cred.rawId}],
    userVerification:'required',
    extensions:{prf:{eval:{first:prfSalt}}}, timeout:60000
  }});
  const res=asn.getClientExtensionResults().prf;
  if(!res||!res.results||!res.results.first) throw new Error('prf-unsupported');
  const kek=await kekFromPrf(res.results.first);
  const w=await wrapMK(kek);
  LS.setItem('pt_v_prf',JSON.stringify({credId:b64(cred.rawId),prfSalt:b64(prfSalt),...w}));
}
async function unlockWithFace(){
  const o=JSON.parse(LS.getItem('pt_v_prf'));
  const asn=await navigator.credentials.get({publicKey:{
    challenge:crypto.getRandomValues(new Uint8Array(32)),
    allowCredentials:[{type:'public-key',id:ub64(o.credId)}],
    userVerification:'required',
    extensions:{prf:{eval:{first:ub64(o.prfSalt)}}}, timeout:60000
  }});
  const res=asn.getClientExtensionResults().prf;
  if(!res||!res.results||!res.results.first) throw new Error('prf-unsupported');
  MK=await unwrapMK(await kekFromPrf(res.results.first), o);
  window.VAULT_DATA=await loadVaultData();
}

/* ---------- security API used by the app (⚙︎ sheet) ---------- */
window.vaultLock=()=>location.reload(); // MK lives only in memory — reload = locked
window.vaultFaceEnabled=()=>!!LS.getItem('pt_v_prf');
window.vaultEnableFace=enrollFace;
window.vaultFaceAvailable=async()=>{
  try{
    if(!window.PublicKeyCredential) return false;
    // some environments never resolve this probe — don't let it block the app
    const timeout=new Promise(r=>setTimeout(()=>r(false),1500));
    return !!(await Promise.race([PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(), timeout]));
  }catch(e){ return false; }
};
window.vaultChangePass=async(oldp,newp)=>{
  if(window.DEMO_MODE) throw new Error('demo'); // never let the example portfolio touch the real vault
  const o=JSON.parse(LS.getItem('pt_v_pass'));
  const kek=await kekFromPass(oldp,ub64(o.salt));
  await unwrapMK(kek,o); // verify the old passcode
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const w=await wrapMK(await kekFromPass(newp,salt));
  LS.setItem('pt_v_pass',JSON.stringify({salt:b64(salt),...w}));
  // cloud backup is keyed to the passcode — re-derive so the next upload matches the new one
  if(window.VAULT_DATA && window.VAULT_DATA.pt_bk && window.VAULT_DATA.pt_bk.k){
    try{ const kk=await window.vaultCloudKeys(newp); window.VAULT_DATA.pt_bk={k:kk.k,tag:kk.tag,salt:kk.salt}; window.vaultPersist(); }catch(e){}
  }
};

/* ---------- cloud backup crypto (see api.js CLOUD BACKUP) ----------
   Verifies the passcode, then derives the backup key + auth tag from it. The raw key is
   handed back to the app to store in the vault so nightly uploads work from any unlock. */
const CLOUD_ITER=310000, CLOUD_TAG_SALT='pt-cloud-tag-v1';
async function cloudKm(pass){ return crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey','deriveBits']); }
async function cloudTagOf(km){
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(CLOUD_TAG_SALT),iterations:CLOUD_ITER,hash:'SHA-256'},km,256);
  return Array.from(new Uint8Array(bits),x=>x.toString(16).padStart(2,'0')).join('');
}
async function cloudKeyOf(km,salt){
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:CLOUD_ITER,hash:'SHA-256'},km,{name:'AES-GCM',length:256},true,['encrypt','decrypt']);
}
window.vaultCloudKeys=async(pass)=>{
  if(window.DEMO_MODE) throw new Error('demo');
  const o=JSON.parse(LS.getItem('pt_v_pass'));
  await unwrapMK(await kekFromPass(pass,ub64(o.salt)), o); // throws if the passcode is wrong
  const km=await cloudKm(pass);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const key=await cloudKeyOf(km,salt);
  return { k:b64(await crypto.subtle.exportKey('raw',key)), tag:await cloudTagOf(km), salt:b64(salt) };
};
const PUSH_URL_V='https://portfolio-push.vdrxppy99.workers.dev'; // duplicated from api.js — this file loads alone, pre-unlock
async function cloudRestore(pass){
  const km=await cloudKm(pass);
  const tag=await cloudTagOf(km);
  const r=await fetch(PUSH_URL_V+'/restore',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({tag})});
  if(!r.ok) throw new Error(r.status===429?'rate':'none');
  const bkp=await r.json(); // {salt, iv, ct}
  const key=await cloudKeyOf(km,ub64(bkp.salt));
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:ub64(bkp.iv)},key,ub64(bkp.ct));
  const d=JSON.parse(dec.decode(pt));
  if(!d || !Array.isArray(d.holdings)) throw new Error('bad');
  // seed plaintext keys, then doSetup(pass) migrates them into a fresh vault (its normal path)
  const put=(k,v)=>{ if(v!==undefined&&v!==null) LS.setItem(k,JSON.stringify(v)); };
  put('pt_holdings',d.holdings); put('pt_lots',d.lots||[]); put('pt_cash',d.cash||{main:0,brok:0});
  put('pt_deposits',+d.deposits||0); put('pt_confirmed',d.confirmed); put('pt_goal',d.goal);
  put('pt_targets',d.targets); put('pt_push',d.push); put('pt_watch',d.watch); put('pt_ccy',d.ccy); put('pt_alerts',d.alerts);
  put('pt_bk',{k:b64(await crypto.subtle.exportKey('raw',key)),tag,salt:bkp.salt,last:Date.now()}); // backups stay on
  await doSetup(pass);
  return d.holdings.length;
}
window.vaultWipe=()=>{
  if(window.DEMO_MODE){ location.reload(); return; } // demo can't erase the real device
  ['pt_vault_data','pt_v_pass','pt_v_prf',...PRIVATE_KEYS].forEach(k=>LS.removeItem(k));
  location.reload();
};
window.vaultDisableFace=()=>{ if(window.DEMO_MODE) return; LS.removeItem('pt_v_prf'); };

/* ---------- demo / example mode ---------- */
// Enter the fictional example portfolio. Sets a flag the app's storage layer honours (core.js
// lsGet/lsSet route to an in-memory DEMO_STORE), never derives a master key, and never reads
// the real ciphertext. seed.js→demo.js build DEMO_STORE during startApp() before core.js inits.
function enterDemo(){
  window.DEMO_MODE=true;
  document.body.classList.add('demo');
  startApp();
}
window.exitDemo=()=>location.reload(); // DEMO_MODE isn't persisted → reload returns to the lock screen


/* ---------- native Face ID (the iOS shell) ----------
   WKWebView does not expose WebAuthn, so the passkey path cannot run inside the
   app at all — which is why every launch there fell back to typing the passcode.
   The native shell provides window.BasisNative instead: the passcode lives in a
   Secure Enclave-backed Keychain item whose access control requires biometry, so
   READING it is the Face ID prompt. See native/Portfolio/Biometrics.swift.

   The vault's cryptography is untouched. This retrieves the passcode and hands it
   to the same unlockWithPass() the keyboard does, through the same PBKDF2 path. */
const NATIVE = () => (typeof window !== 'undefined' && window.BasisNative && window.BasisNative.available) ? window.BasisNative : null;

async function nativeCanEnrol(){
  const n = NATIVE(); if(!n) return false;
  try { return await n.bioAvailable(); } catch(_) { return false; }
}

async function nativeUnlock(){
  const n = NATIVE(); if(!n) return false;
  let enrolled = false;
  try { enrolled = await n.bioEnrolled(); } catch(_) { return false; }
  if(!enrolled) return false;
  try{
    const pass = await n.bioLoad();       // this IS the Face ID prompt
    if(!pass) return false;
    await unlockWithPass(pass);
    startApp();
    return true;
  }catch(e){
    const why = (e && e.message) || '';
    if(why === 'cancelled') return false;            // user dismissed; passcode below
    if(why === 'invalidated'){
      // .biometryCurrentSet invalidates the item when a face is added or removed,
      // so it has to be re-enrolled with the passcode. Clear the stale one.
      try { await n.bioClear(); } catch(_) {}
      err('Face ID changed on this device. Enter your passcode once to re-enable it.');
    }
    return false;
  }
}

/* Offer enrolment after a successful passcode unlock, once, politely. */
async function nativeOfferEnrol(pass){
  const n = NATIVE(); if(!n || !pass) return;
  try{
    if(await n.bioEnrolled()) return;
    if(!await n.bioAvailable()) return;
    if(LS.getItem('pt_bio_declined')) return;
    await n.bioSave(pass);
  }catch(_){ /* enrolment is a convenience; never block unlocking on it */ }
}
window.basisBioClear = async () => { const n = NATIVE(); if(n) { try { await n.bioClear(); } catch(_) {} } };

/* ---------- lock screen UI ----------
   Phase 3 of the redesign rewired WHICH DOOR OPENS FIRST. The locks are
   untouched: kekFromPass, kekFromPrf, wrapMK, unwrapMK, saveVaultNow,
   loadVaultData, doSetup, the PBKDF2 iterations, the HKDF parameters, the PRF
   salt handling and the keys pt_v_pass / pt_v_prf / pt_vault_data are all exactly
   as they were. Nothing below derives, stores or moves a key differently.

   The defect this fixes was purely presentational: the app had Vanguard-grade
   unlock (a WebAuthn platform passkey with the PRF extension, wrapping the same
   AES-256-GCM master key the passcode wraps) and opened on a password field
   with Face ID as a secondary button the user had to find. */

const $step = id => $id(id);
const STEPS = ['lockFace','lockEnter','lockSetup','lockFaceStep','lockRestore'];
function showStep(id, sub){
  STEPS.forEach(s => { const el=$step(s); if(el) el.hidden = (s!==id); });
  if(sub!==undefined) $id('lockSub').textContent = sub;
}
function err(m){
  const box=$id('lockErr');
  $id('lockErrText').textContent = m||'';
  box.setAttribute('data-shown', m ? 'true' : 'false');
}

function startApp(){
  APP_SCRIPTS.reduce((p,src)=>p.then(()=>new Promise((res,rej)=>{
    const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej;
    document.body.appendChild(s);
  })), Promise.resolve())
  .then(()=>{ // dissolve rather than snap (pure UI — crypto untouched)
    document.body.classList.add('unlocking');
    setTimeout(()=>{ document.body.classList.remove('locked'); document.body.classList.remove('unlocking'); }, 240);
  })
  .catch(()=>err('Couldn’t load the app. Check your connection and reload.'));
}

/* Enrolment is now the promoted path, not a peer of "Not now". */
async function showFaceStepOrStart(){
  if(await window.vaultFaceAvailable()) showStep('lockFaceStep','Set up Face ID');
  else startApp();
}

/* ---------- the fallback ladder ----------
   Face ID → (cancelled/failed) → "Use passcode" → passcode field → (forgotten)
   → restore from backup, or erase. The passcode is never the front door unless
   no passkey is enrolled on this device. */
// Set as soon as the user picks a route (restore / passcode). The automatic Face
// ID attempt is fire-and-forget, so without this its failure handler lands after
// the user has already tapped something and replaces their screen — which is
// exactly why "Restore from backup" appeared to do nothing while the example
// worked (the example boots the app immediately, leaving nothing to override).
let userChose = false;

function showPasscode(msg){
  showStep('lockEnter','Enter your passcode');
  if(msg) err(msg);
  const i=$id('unlockPass'); if(i) setTimeout(()=>i.focus(), 50);
}

async function attemptFace(fromGesture){
  err('');
  const t0 = Date.now();
  try{
    await unlockWithFace();
    startApp();
    return true;
  }catch(e){
    const elapsed = Date.now() - t0;
    // THE DETAIL THAT BITES: Safari and WKWebView reject
    // navigator.credentials.get() outside a user gesture with NotAllowedError —
    // the same error a real cancellation throws. A gesture rejection comes back
    // essentially instantly; a human dismissing the system sheet cannot. So
    // sub-300ms NotAllowedError is treated as "needs a tap", not "user said no".
    const gestureBlocked = e && e.name === 'NotAllowedError' && !fromGesture && elapsed < 300;
    if(gestureBlocked){
      if(!userChose) showStep('lockFace','Unlock to continue');
      return false;
    }
    if(e && e.name === 'NotAllowedError'){
      // A real cancellation, or biometrics locked out after failed attempts.
      if(userChose) return false;
      showStep('lockFace','Unlock to continue');
      err('Face ID was cancelled. Use your passcode if it keeps failing.');
      return false;
    }
    if(e && e.message === 'prf-unsupported'){
      if(!userChose) showPasscode('This browser can’t do Face ID unlock. Your passcode still works.');
      return false;
    }
    // pt_v_prf present but the credential no longer resolves — deleted from
    // iCloud Keychain, or enrolled against a different origin.
    if(!userChose) showPasscode('Face ID isn’t available on this device any more. Use your passcode.');
    return false;
  }
}

/* ---------- re-lock policy ----------
   The app previously only locked when the page was destroyed. Locking means
   DISCARDING the in-memory master key and re-running the unlock flow — it is
   never persisted anywhere, so there is nothing to clean up but the reference. */
const RELOCK_KEY = 'pt_relock_min';
function relockMinutes(){
  const v = LS.getItem(RELOCK_KEY);
  return v === null ? 5 : Number(v);   // default 5 minutes
}
window.vaultRelockMinutes = relockMinutes;
window.vaultSetRelockMinutes = m => LS.setItem(RELOCK_KEY, String(m));

function installRelock(){
  let hiddenAt = 0;
  const onHide = () => { hiddenAt = Date.now(); };
  const onShow = () => {
    const mins = relockMinutes();
    if(mins < 0 || !hiddenAt) return;                 // -1 = Never
    if(window.DEMO_MODE) return;                       // demo has no real key
    const idleMin = (Date.now() - hiddenAt) / 60000;
    if(idleMin >= mins){
      // Reload is the honest way to drop the key: it guarantees no reference to
      // the master key survives anywhere in the page.
      location.reload();
    }
  };
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'hidden') onHide(); else onShow();
  });
  window.addEventListener('pagehide', onHide);
}

function boot(){
  // The example portfolio needs no crypto at all — it never derives a key and
  // never reads the real ciphertext — so it must be wired BEFORE the secure
  // context check. Previously this whole function returned early on an insecure
  // origin, which left every button on the lock screen inert with no
  // explanation: opening the app over plain HTTP on a phone (a LAN address, so
  // not a secure context, unlike 127.0.0.1) produced a screen where nothing
  // responded to a tap.
  $id('demoLink').onclick = e => { e.preventDefault(); enterDemo(); };

  if(!window.crypto||!crypto.subtle){
    showStep(null, 'Unlocking needs a secure connection');
    err('Your encrypted data can only be unlocked over HTTPS. The example portfolio below works anywhere.');
    // Restore genuinely cannot run without crypto.subtle — but a control that
    // does nothing at all is the bug that got reported, so it explains itself.
    $id('cloudRestoreLink').onclick = () =>
      err('Restoring needs HTTPS too, because the backup is decrypted on this device. Open the app from its normal address.');
    return;
  }
  installRelock();

  const hasVault = !!LS.getItem('pt_v_pass');

  /* ---- restore, replacing prompt() (a silent no-op inside WKWebView) ---- */
  const openRestore = () => { userChose = true; err(''); showStep('lockRestore','Restore from a backup'); };
  $id('cloudRestoreLink').onclick = openRestore;
  $id('restoreCancel').onclick = () => { userChose = false; err(''); hasVault ? startFront() : showSetup(); };
  $id('restoreGo').onclick = async () => {
    const p = $id('restorePass').value;
    if(!p) { err('Enter the passcode from your old device.'); return; }
    err(''); $id('lockSub').textContent = 'Restoring your encrypted backup';
    const btn = $id('restoreGo'); btn.disabled = true;
    try{
      await cloudRestore(p);
      await showFaceStepOrStart();
    }catch(ex){
      btn.disabled = false;
      err(ex && ex.message === 'rate'
        ? 'Too many attempts. Wait an hour and try again.'
        : 'No backup found for that passcode.');
    }
  };

  function showSetup(){
    showStep('lockSetup','Create a passcode to encrypt this device');
  }

  if(!hasVault){
    showSetup();
    $id('setupBtn').onclick = async () => {
      const a=$id('setPass1').value, b=$id('setPass2').value;
      if(a===DEMO_PASS){ enterDemo(); return; }   // never derives a real key
      if(a.length<6){ err('Use at least 6 characters.'); return; }
      if(a!==b){ err('Those don’t match.'); return; }
      err(''); const btn=$id('setupBtn'); btn.textContent='Encrypting'; btn.disabled=true;
      try{ await doSetup(a); await showFaceStepOrStart(); }
      catch(e){ err('Setup failed. Try again.'); btn.textContent='Create passcode'; btn.disabled=false; }
    };
  } else {
    startFront();
  }

  /* ---- the front door ---- */
  async function startFront(){
    // Native shell first: inside the app this is the ONLY biometric route that
    // exists, because WKWebView has no WebAuthn.
    if(NATIVE()){
      showStep(null, 'Unlocking');
      if(await nativeUnlock()) return;
      if(!userChose) showPasscode();
      return;
    }
    const canFace = window.vaultFaceEnabled() && await window.vaultFaceAvailable();
    if(!canFace){
      // No passkey on this device: the passcode legitimately IS the front door.
      showPasscode();
      return;
    }
    // Auto-invoke. The system Face ID sheet should be the first thing on screen.
    showStep(null, 'Unlocking');
    attemptFace(false);
  }

  $id('faceBtn').onclick = () => attemptFace(true);
  $id('usePassLink').onclick = () => { userChose = true; err(''); showPasscode(); };

  const tryUnlock = async () => {
    if($id('unlockPass').value===DEMO_PASS){ enterDemo(); return; }
    err(''); const btn=$id('unlockBtn'); btn.textContent='Unlocking'; btn.disabled=true;
    try{
      const typed = $id('unlockPass').value;
      await unlockWithPass(typed);
      await nativeOfferEnrol(typed);   // no-op outside the native shell
      startApp();
    }
    catch(e){
      err('Wrong passcode.');
      btn.textContent='Unlock'; btn.disabled=false;
      $id('unlockPass').value=''; $id('unlockPass').focus();
    }
  };
  $id('unlockBtn').onclick = tryUnlock;
  $id('unlockPass').addEventListener('keydown', e => { if(e.key==='Enter') tryUnlock(); });

  /* Erase confirmation — replaces confirm(), which WKWebView also no-ops. */
  $id('forgotLink').onclick = () => {
    const host = document.getElementById('lockModalHost');
    host.innerHTML = ui.modal({
      id:'eraseModal', title:'Erase this device’s data?',
      body:'Without the passcode the encrypted data cannot be recovered. You can restore from a backup afterwards.',
      confirm:'Erase', cancel:'Keep', destructive:true
    });
    const m = document.getElementById('eraseModal');
    const close = () => { m.setAttribute('data-open','false'); setTimeout(()=>host.innerHTML='', 200); };
    m.querySelector('[data-modal-cancel]').onclick = close;
    m.querySelector('[data-modal-confirm]').onclick = () => window.vaultWipe();
    requestAnimationFrame(()=>m.setAttribute('data-open','true'));
  };

  /* Enrolment — promoted to the full-width primary; "Not now" is a text link. */
  $id('faceEnrollBtn').onclick = async () => {
    err(''); const btn=$id('faceEnrollBtn');
    btn.querySelector('span').textContent='Follow the Face ID prompt';
    try{ await enrollFace(); startApp(); }
    catch(e){
      btn.querySelector('span').textContent='Enable Face ID';
      if(e&&e.message==='prf-unsupported') err('This browser can’t do Face ID unlock yet. Your passcode still works.');
      else err('Face ID setup was cancelled. Your passcode still works.');
    }
  };
  $id('faceSkipBtn').onclick = () => {
    // Asked once, then not again for 60 days — politely, and dismissible for good.
    LS.setItem('pt_face_asked', String(Date.now()));
    startApp();
  };
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
