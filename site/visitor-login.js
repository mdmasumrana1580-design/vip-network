/* VIP-Network.TV visitor login: Name + Number + Device Name + Guest Account. */
(function(){
  const base=(window.VIP_WORKER_API||window.location.origin).replace(/\/$/,'');
  const key='vip-network-user-session';

  function deviceName(){
    return localStorage.getItem('vip-network-device-name')||'';
  }

  function makeGate(){
    const d=document.createElement('div');d.id='vipVisitorGate';
    d.innerHTML=`<div class="vip-gate-card" role="dialog" aria-modal="true" aria-label="VIP-Network.TV Login">
      <img class="vip-gate-logo" src="vip-network-logo.png" alt="VIP NETWORK TV Logo" onerror="this.style.display='none'">
      <h1 class="vip-gate-title">VIP-NETWORK.TV</h1><div class="vip-gate-sub">স্বাগতম</div>
      <p class="vip-gate-tagline"><strong>🔥 বিনোদনের নতুন ঠিকানা—VIP-Network.TV! 🔥</strong><br>আপনার প্রিয় অনুষ্ঠান, খেলাধুলা, খবর ও জমজমাট বিনোদনের সব আয়োজন নিয়ে সবসময় আপনার পাশে। আজই যুক্ত হোন VIP-Network.TV-এর সঙ্গে এবং উপভোগ করুন বিনোদনের এক নতুন, রোমাঞ্চকর জগৎ! ✨</p>
      <div class="vip-features"><div class="vip-feature"><i>📺</i><b>Live TV</b></div><div class="vip-feature"><i>⚽</i><b>Sports</b></div><div class="vip-feature"><i>🎬</i><b>Movies</b></div><div class="vip-feature"><i>▶️</i><b>Series</b></div></div>
      <form id="vipVisitorLogin" class="vip-login-form">
        <label class="vip-input"><span>👤</span><input id="vipUserName" autocomplete="name" placeholder="নাম" maxlength="100" required></label>
        <label class="vip-input"><span>📱</span><input id="vipUserNumber" type="tel" inputmode="numeric" autocomplete="tel" placeholder="নাম্বার" maxlength="20" required></label>
        <label class="vip-input"><span>💻</span><input id="vipDeviceName" placeholder="ডিভাইস নেম" maxlength="100" required></label>
        <button class="vip-login-btn" type="submit">⇥ &nbsp; LOGIN</button>
        <div class="vip-gate-status" id="vipGateStatus" aria-live="polite"></div>
        <button class="vip-guest-btn" id="vipGuestLogin" type="button">👤 &nbsp; GUEST ACCOUNT</button>
      </form>
      <div class="vip-gate-credit">💻 <b>VIP-Network.TV</b> সফটওয়্যারটি তৈরি করেছেন <em>মাসুম</em>—তার সৃজনশীলতা ও পরিশ্রমেই প্রযুক্তির সাথে বিনোদনের এই সুন্দর সংযোগ। ✨</div>
    </div>`;
    document.body.appendChild(d);return d;
  }

  /* The server-side session is the only source of truth.
     This is important after an Admin deletes a device/account:
     the old browser must show the login screen again. */
  async function checkSession(){
    try{
      const r=await fetch(base+'/api/user/session',{credentials:'include',cache:'no-store'});
      const data=await r.json().catch(()=>({}));
      if(r.status===403 && data.reason==='blocked'){
        if(typeof window.VIP_SHOW_BLOCKED_PAGE==='function') window.VIP_SHOW_BLOCKED_PAGE();
        return true;
      }
      return r.ok && data.loggedIn===true;
    }catch(e){
      return false;
    }
  }

  async function init(){
    if(await checkSession())return;

    const gate=makeGate(),
      form=gate.querySelector('#vipVisitorLogin'),
      status=gate.querySelector('#vipGateStatus'),
      btn=gate.querySelector('.vip-login-btn'),
      guestBtn=gate.querySelector('#vipGuestLogin'),
      u=gate.querySelector('#vipUserName'),
      n=gate.querySelector('#vipUserNumber'),
      dn=gate.querySelector('#vipDeviceName');

    dn.value=deviceName();

    guestBtn.onclick=async()=>{
      guestBtn.disabled=true;btn.disabled=true;
      status.textContent='Guest Account চালু হচ্ছে...';
      status.style.color='#9de5ff';
      try{
        const deviceId=window.VIP_DEVICE_ID||'';
        if(!deviceId)throw new Error('Device ID পাওয়া যায়নি');

        const deviceNameValue=deviceName()||
          ((/Mobi|Android/i.test(navigator.userAgent))?'Mobile Guest':'Guest Device');

        localStorage.setItem('vip-network-device-name',deviceNameValue);

        const r=await fetch(base+'/api/user/guest',{
          method:'POST',
          headers:{
            'content-type':'application/json',
            'X-ViP-Device-ID':deviceId
          },
          credentials:'include',
          body:JSON.stringify({
            deviceId,
            deviceName:deviceNameValue,
            userAgent:navigator.userAgent
          }),
          cache:'no-store'
        });

        const data=await r.json().catch(()=>({}));

        if(r.status===403 && (data.blocked||data.reason==='blocked')){
          if(typeof window.VIP_SHOW_BLOCKED_PAGE==='function') window.VIP_SHOW_BLOCKED_PAGE();
          return;
        }

        if(!r.ok)throw new Error(data.error||'Guest login failed');

        localStorage.removeItem('vip-network-guest-session');
        gate.remove();
        window.dispatchEvent(new CustomEvent('vip:guest-login',{detail:data}));
        location.reload();
      }catch(err){
        status.textContent=err.message||'Guest login failed';
        status.style.color='#ff9ba7';
        guestBtn.disabled=false;
        btn.disabled=false;
      }
    };

    form.onsubmit=async e=>{
      e.preventDefault();
      btn.disabled=true;guestBtn.disabled=true;
      status.textContent='Connecting...';
      status.style.color='#9de5ff';
      try{
        const name=u.value.trim(),
          number=n.value.replace(/\s+/g,'').trim(),
          deviceNameValue=dn.value.trim(),
          deviceId=window.VIP_DEVICE_ID||'';

        if(!name||!number||!deviceNameValue)throw new Error('নাম, নাম্বার ও ডিভাইস নেম দিন');
        if(!deviceId)throw new Error('Device ID পাওয়া যায়নি');

        localStorage.setItem('vip-network-device-name',deviceNameValue);

        const r=await fetch(base+'/api/user/login',{
          method:'POST',
          headers:{
            'content-type':'application/json',
            'X-ViP-Device-ID':deviceId
          },
          credentials:'include',
          body:JSON.stringify({
            name,
            username:name,
            number,
            deviceId,
            deviceName:deviceNameValue,
            userAgent:navigator.userAgent
          }),
          cache:'no-store'
        });

        const data=await r.json().catch(()=>({}));

        if(r.status===403 && (data.blocked||data.reason==='blocked')){
          if(typeof window.VIP_SHOW_BLOCKED_PAGE==='function') window.VIP_SHOW_BLOCKED_PAGE();
          return;
        }

        if(!r.ok)throw new Error(data.error||'Login failed');

        localStorage.setItem(key,'1');
        gate.remove();
        window.dispatchEvent(new CustomEvent('vip:user-login',{detail:data}));
        location.reload();
      }catch(err){
        status.textContent=err.message||'Login failed';
        status.style.color='#ff9ba7';
      }finally{
        btn.disabled=false;
        guestBtn.disabled=false;
      }
    };
  }

  init();
})();
