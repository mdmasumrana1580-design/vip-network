/* VIP-Network.TV visitor login: Name + Number + Device Name. */
(function(){
  const base=(window.VIP_WORKER_API||window.location.origin).replace(/\/$/,'');
  const key='vip-network-user-session';
  const guestKey='vip-network-guest-session';
  function deviceName(){return localStorage.getItem('vip-network-device-name')||''}
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
        <button class="vip-login-btn" type="submit">⇥ &nbsp; LOGIN</button><div class="vip-gate-status" id="vipGateStatus" aria-live="polite"></div>
        <button class="vip-guest-btn" id="vipGuestLogin" type="button">👤 &nbsp; GUEST ACCOUNT</button>
      </form>
      <div class="vip-gate-credit">💻 <b>VIP-Network.TV</b> সফটওয়্যারটি তৈরি করেছেন <em>মাসুম</em>—তার সৃজনশীলতা ও পরিশ্রমেই প্রযুক্তির সাথে বিনোদনের এই সুন্দর সংযোগ। ✨</div>
    </div>`;document.body.appendChild(d);return d;
  }
  async function checkSession(){try{const r=await fetch(base+'/api/user/session',{credentials:'include',cache:'no-store'});return r.ok}catch(e){return false}}
  async function init(){
    if(await checkSession())return;
    if(localStorage.getItem(guestKey)==='1')return;
    const gate=makeGate(),form=gate.querySelector('#vipVisitorLogin'),status=gate.querySelector('#vipGateStatus'),btn=gate.querySelector('.vip-login-btn'),guestBtn=gate.querySelector('#vipGuestLogin'),u=gate.querySelector('#vipUserName'),n=gate.querySelector('#vipUserNumber'),dn=gate.querySelector('#vipDeviceName');
    dn.value=deviceName();
    guestBtn.onclick=async()=>{
      guestBtn.disabled=true;btn.disabled=true;status.textContent='Guest Account চালু হচ্ছে...';status.style.color='#9de5ff';
      try{
        let visitorId=localStorage.getItem('vip-guest-visitor-id');
        if(!visitorId)visitorId=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now());
        localStorage.setItem('vip-guest-visitor-id',visitorId);
        const deviceNameValue=deviceName()||((/Mobi|Android/i.test(navigator.userAgent))?'Mobile Guest':'Guest Device');
        localStorage.setItem('vip-network-device-name',deviceNameValue);
        const r=await fetch(base+'/api/guest/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({visitorId,deviceId:window.VIP_DEVICE_ID||'',deviceName:deviceNameValue}),cache:'no-store'});
        const data=await r.json().catch(()=>({}));
        if(r.status===403||data.blocked){ if(typeof window.VIP_SHOW_BLOCKED_PAGE==='function') window.VIP_SHOW_BLOCKED_PAGE(); return; }
        if(!r.ok&&!data.storageLimited)throw new Error(data.error||'Guest login failed');
        localStorage.setItem(guestKey,'1');gate.remove();window.dispatchEvent(new CustomEvent('vip:guest-login',{detail:data}));location.reload();
      }catch(err){status.textContent=err.message||'Guest login failed';status.style.color='#ff9ba7';guestBtn.disabled=false;btn.disabled=false}
    };
    form.onsubmit=async e=>{e.preventDefault();btn.disabled=true;status.textContent='Connecting...';status.style.color='#9de5ff';
      try{
        const name=u.value.trim(),number=n.value.replace(/\s+/g,'').trim(),deviceNameValue=dn.value.trim();
        localStorage.setItem('vip-network-device-name',deviceNameValue);
        const r=await fetch(base+'/api/user/login',{method:'POST',headers:{'content-type':'application/json','X-ViP-Device-ID':window.VIP_DEVICE_ID||''},credentials:'include',body:JSON.stringify({username:name,number,deviceId:window.VIP_DEVICE_ID||'',deviceName:deviceNameValue}),cache:'no-store'});
        const data=await r.json().catch(()=>({}));
        if(r.status===403&&data.blocked){ if(typeof window.VIP_SHOW_BLOCKED_PAGE==='function') window.VIP_SHOW_BLOCKED_PAGE(); return; }
        if(!r.ok)throw new Error(data.error||'Login failed');
        localStorage.setItem(key,'1');gate.remove();window.dispatchEvent(new CustomEvent('vip:user-login',{detail:data}));location.reload();
      }catch(err){status.textContent=err.message||'Login failed';status.style.color='#ff9ba7'}finally{btn.disabled=false}
    };
  }
  init();
})();
