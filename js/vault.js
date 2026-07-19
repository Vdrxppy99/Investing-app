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
const PRIVATE_KEYS=['pt_holdings','pt_lots','pt_cash','pt_deposits','pt_confirmed','pt_goal','pt_targets','pt_push'];
const APP_SCRIPTS=['js/boot.js','js/seed.js','js/core.js','js/portfolio.js','js/api.js',
                   'js/explore.js','js/insights.js','js/sheets.js','js/news.js','js/app.js'];
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
window.vaultDisableFace=()=>LS.removeItem('pt_v_prf');
window.vaultFaceAvailable=async()=>{
  try{
    if(!window.PublicKeyCredential) return false;
    // some environments never resolve this probe — don't let it block the app
    const timeout=new Promise(r=>setTimeout(()=>r(false),1500));
    return !!(await Promise.race([PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(), timeout]));
  }catch(e){ return false; }
};
window.vaultChangePass=async(oldp,newp)=>{
  const o=JSON.parse(LS.getItem('pt_v_pass'));
  const kek=await kekFromPass(oldp,ub64(o.salt));
  await unwrapMK(kek,o); // verify the old passcode
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const w=await wrapMK(await kekFromPass(newp,salt));
  LS.setItem('pt_v_pass',JSON.stringify({salt:b64(salt),...w}));
};
window.vaultWipe=()=>{
  ['pt_vault_data','pt_v_pass','pt_v_prf',...PRIVATE_KEYS].forEach(k=>LS.removeItem(k));
  location.reload();
};

/* ---------- lock screen UI ---------- */
function err(m){ $id('lockErr').textContent=m||''; }
function startApp(){
  APP_SCRIPTS.reduce((p,src)=>p.then(()=>new Promise((res,rej)=>{
    const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej;
    document.body.appendChild(s);
  })), Promise.resolve())
  .then(()=>{ // dissolve the lock screen into the app instead of snapping (pure UI — crypto untouched)
    document.body.classList.add('unlocking');
    setTimeout(()=>{ document.body.classList.remove('locked'); document.body.classList.remove('unlocking'); }, 240);
  })
  .catch(()=>err('Couldn’t load the app — check your connection and reload.'));
}
async function showFaceStepOrStart(){
  if(await window.vaultFaceAvailable()){
    $id('lockSetup').style.display='none';
    $id('lockEnter').style.display='none';
    $id('lockFaceStep').style.display='';
    $id('lockSub').textContent='One more thing';
  } else startApp();
}
function boot(){
  if(!window.crypto||!crypto.subtle){
    $id('lockSub').textContent='This page needs HTTPS to unlock your encrypted data.';
    return;
  }
  const hasVault=!!LS.getItem('pt_v_pass');
  if(!hasVault){
    $id('lockSetup').style.display='';
    $id('lockSub').textContent='Create a passcode to encrypt your data on this device';
    $id('setupBtn').onclick=async()=>{
      const a=$id('setPass1').value, b=$id('setPass2').value;
      if(a.length<6){ err('Use at least 6 characters.'); return; }
      if(a!==b){ err('Passcodes don’t match.'); return; }
      err(''); $id('setupBtn').textContent='Encrypting…'; $id('setupBtn').disabled=true;
      try{ await doSetup(a); await showFaceStepOrStart(); }
      catch(e){ err('Setup failed — try again.'); $id('setupBtn').textContent='Create passcode'; $id('setupBtn').disabled=false; }
    };
  } else {
    $id('lockEnter').style.display='';
    $id('lockSub').textContent='Enter your passcode';
    const tryUnlock=async()=>{
      err(''); $id('unlockBtn').textContent='Unlocking…';
      try{ await unlockWithPass($id('unlockPass').value); startApp(); }
      catch(e){ err('Wrong passcode.'); $id('unlockBtn').textContent='Unlock'; $id('unlockPass').value=''; $id('unlockPass').focus(); }
    };
    $id('unlockBtn').onclick=tryUnlock;
    $id('unlockPass').addEventListener('keydown',e=>{ if(e.key==='Enter') tryUnlock(); });
    if(window.vaultFaceEnabled()){
      window.vaultFaceAvailable().then(ok=>{ if(ok) $id('faceBtn').style.display=''; });
      $id('faceBtn').onclick=async()=>{
        err('');
        try{ await unlockWithFace(); startApp(); }
        catch(e){ err(e&&e.name==='NotAllowedError'?'Face ID cancelled — use your passcode.':'Face ID didn’t work — use your passcode.'); }
      };
    }
    $id('forgotLink').onclick=e=>{
      e.preventDefault();
      if(confirm('Without the passcode your encrypted data cannot be recovered.\n\nErase everything on this device and start fresh? (You can restore from an exported backup afterwards.)')) window.vaultWipe();
    };
  }
  // post-setup Face ID step
  $id('faceEnrollBtn').onclick=async()=>{
    err(''); $id('faceEnrollBtn').textContent='Follow the Face ID prompt…';
    try{ await enrollFace(); startApp(); }
    catch(e){
      $id('faceEnrollBtn').textContent='Enable Face ID';
      if(e&&e.message==='prf-unsupported') err('This device’s browser can’t do Face ID unlock yet — your passcode still works.');
      else err('Face ID setup cancelled — your passcode still works.');
    }
  };
  $id('faceSkipBtn').onclick=()=>startApp();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
