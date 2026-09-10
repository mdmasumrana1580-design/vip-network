/* VIP NETWORK — Visitor Login Guard
   Username + Password + Device Name only.
   Uses the existing /api/user/login and /api/user/session endpoints.
*/
(function(){
  'use strict';

  const base=()=>((window.VIP_WORKER_API||window.location.origin).replace(/\/$/,''));
  const DEVICE_ID=window.VIP_DEVICE_ID || localStorage.getItem('vip-network-device-id');
  const modalId='vipLoginModal';
  let unlocked=false;
  let checking=false;

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function inject(){
    if(document.getElementById(modalId)) return;
    const style=document.createElement('style');
    style.id='vipLoginStyle';
    style.textContent=`
      #${modalId}{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.82);backdrop-filter:blur(8px);box-sizing:border-box}
      #${modalId}[hidden]{display:none!important}
      #${modalId} .vip-login-card{width:min(460px,100%);max-height:calc(100vh - 36px);overflow:auto;box-sizing:border-box;border:1px solid rgba(255,255,255,.13);border-radius:22px;padding:22px;background:linear-gradient(145deg,#111714,#080b0a);box-shadow:0 20px 80px rgba(0,0,0,.6);color:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #${modalId} .vip-logo{display:block;width:76px;height:76px;object-fit:contain;margin:0 auto 10px;border-radius:18px}
      #${modalId} h2{text-align:center;margin:0 0 8px;font-size:23px;letter-spacing:.4px}
      #${modalId} .vip-welcome{text-align:center;font-size:12px;line-height:1.55;color:#d8dfdb;margin:0 0 15px}
      #${modalId} .vip-welcome span{display:block;margin:3px 0}
      #${modalId} label{display:block;font-size:12px;font-weight:700;color:#dfe7e2;margin:12px 0 6px}
      #${modalId} input{width:100%;box-sizing:border-box;border:1px solid #2b3530;border-radius:12px;background:#080c0a;color:#fff;padding:12px 13px;outline:none;font-size:14px}
      #${modalId} input:focus{border-color:#67d391;box-shadow:0 0 0 3px rgba(103,211,145,.1)}
      #${modalId} button{width:100%;border:0;border-radius:12px;padding:12px 14px;margin-top:15px;background:#1ed760;color:#041108;font-weight:800;font-size:14px;cursor:pointer}
      #${modalId} button:disabled{opacity:.6;cursor:wait}
      #${modalId} .vip-error{text-align:center;color:#ff8585;min-height:18px;font-size:12px;margin-top:9px}
      #${modalId} .vip-credit{text-align:center;color:#aeb8b2;font-size:11px;line-height:1.5;margin:14px 0 0}
      body.vip-login-locked>*:not(#${modalId}){pointer-events:none}
    `;
    document.head.appendChild(style);

    const modal=document.createElement('div');
    modal.id=modalId;
    modal.hidden=true;
    modal.innerHTML=`
      <div class="vip-login-card" role="dialog" aria-modal="true" aria-labelledby="vipLoginTitle">
        <img class="vip-logo" src="/vip-network-logo.png" alt="VIP-NETWORK.TV">
        <h2 id="vipLoginTitle">VIP-NETWORK.TV</h2>
        <div class="vip-welcome">
          <span>🔥 বিনোদনের নতুন ঠিকানা—VIP-Network.TV! 🔥</span>
          <span>আপনার প্রিয় অনুষ্ঠান, খেলাধুলা, খবর ও জমজমাট বিনোদনের সব আয়োজন নিয়ে সবসময় আপনার পাশে। আজই যুক্ত হোন VIP-Network.TV-এর সঙ্গে এবং উপভোগ করুন বিনোদনের এক নতুন, রোমাঞ্চকর জগৎ! ✨</span>
          <span>💻 VIP-Network.TV সফটওয়্যারটি তৈরি করেছেন মাসুম—তার সৃজনশীলতা ও পরিশ্রমেই প্রযুক্তির সাথে বিনোদনের এই সুন্দর সংযোগ। ✨</span>
        </div>
        <form id="vipLoginForm" autocomplete="on">
          <label for="vipUsername">Username</label>
          <input id="vipUsername" name="username" autocomplete="username" required>
          <label for="vipPassword">Password</label>
          <input id="vipPassword" name="password" type="password" autocomplete="current-password" required>
          <label for="vipDeviceName">Device Name</label>
          <input id="vipDeviceName" name="deviceName" autocomplete="device-name" maxlength="80" required>
          <button id="vipLoginBtn" type="submit">Login</button>
          <div id="vipLoginError" class="vip-error" aria-live="polite"></div>
        </form>
        <div class="vip-credit">VIP-Network.TV</div>
      </div>`;
    document.body.appendChild(modal);

    const deviceInput=document.getElementById('vipDeviceName');
    if(deviceInput && !deviceInput.value) deviceInput.value='Android Device';

    document.getElementById('vipLoginForm').addEventListener('submit',login);
  }

  function lock(){
    document.body.classList.add('vip-login-locked');
    const m=document.getElementById(modalId);
    if(m)m.hidden=false;
    const u=document.getElementById('vipUsername');
    if(u) setTimeout(()=>u.focus(),50);
    const v=document.getElementById('video');
    if(v){try{v.pause()}catch(e){}}
  }

  function unlock(){
    unlocked=true;
    document.body.classList.remove('vip-login-locked');
    const m=document.getElementById(modalId);
    if(m)m.hidden=true;
  }

  async function session(){
    if(checking)return;
    checking=true;
    try{
      const r=await fetch(base()+'/api/user/session',{
        headers:{'X-ViP-Device-ID':DEVICE_ID||''},
        credentials:'include',
        cache:'no-store'
      });
      const d=await r.json().catch(()=>({}));
      if(d.ok && d.loggedIn && !d.blocked){
        unlock();
      }else{
        lock();
      }
    }catch(e){
      lock();
    }finally{
      checking=false;
    }
  }

  async function login(ev){
    ev.preventDefault();
    const btn=document.getElementById('vipLoginBtn');
    const err=document.getElementById('vipLoginError');
    const username=document.getElementById('vipUsername').value.trim();
    const password=document.getElementById('vipPassword').value;
    const deviceName=document.getElementById('vipDeviceName').value.trim();

    err.textContent='';
    if(!username||!password||!deviceName){
      err.textContent='সবগুলো তথ্য পূরণ করুন।';
      return;
    }
    btn.disabled=true;
    btn.textContent='Logging in…';
    try{
      const r=await fetch(base()+'/api/user/login',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-ViP-Device-ID':DEVICE_ID||''},
        credentials:'include',
        body:JSON.stringify({name:username,password,deviceId:DEVICE_ID,deviceName})
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok || !d.ok){
        err.textContent=d.message || 'Login failed. আবার চেষ্টা করুন।';
        return;
      }
      unlock();
      window.dispatchEvent(new CustomEvent('vip:user-login',{detail:d}));
      setTimeout(()=>location.reload(),80);
    }catch(e){
      err.textContent='Server-এর সাথে সংযোগ করা যাচ্ছে না।';
    }finally{
      btn.disabled=false;
      btn.textContent='Login';
    }
  }

  function start(){
    inject();
    lock();
    session();
    setInterval(session,15000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
