(function(){
  'use strict';

  const base=(window.VIP_WORKER_API||window.location.origin).replace(/\/$/,'');
  const key='vip-network-user-session';

  function deviceName(){
    return localStorage.getItem('vip-network-device-name')||'';
  }

  function normalizeNumber(s){
    return String(s||'')
      .replace(/[০-৯]/g,c=>String('০১২৩৪৫৬৭৮৯'.indexOf(c)))
      .replace(/[^0-9+]/g,'');
  }

  function makeGate(){
    const d=document.createElement('div');
    d.id='vipVisitorGate';

    d.innerHTML=`
      <div class="vip-gate-card" role="dialog" aria-modal="true">

        <img
          class="vip-gate-logo"
          src="vip-network-logo.png"
          alt="VIP NETWORK TV Logo"
          onerror="this.style.display='none'"
        >

        <h1 class="vip-gate-title">VIP-NETWORK.TV</h1>
        <div class="vip-gate-sub">স্বাগতম</div>

        <p class="vip-gate-tagline">
          <strong>🔥 বিনোদনের নতুন ঠিকানা—VIP-Network.TV! 🔥</strong><br>
          আপনার প্রিয় অনুষ্ঠান, খেলাধুলা, খবর ও জমজমাট বিনোদনের সব আয়োজন নিয়ে সবসময় আপনার পাশে।
          আজই যুক্ত হোন VIP-Network.TV-এর সঙ্গে এবং উপভোগ করুন বিনোদনের এক নতুন, রোমাঞ্চকর জগৎ! ✨
        </p>

        <div class="vip-features">
          <div class="vip-feature"><i>📺</i><b>Live TV</b></div>
          <div class="vip-feature"><i>⚽</i><b>Sports</b></div>
          <div class="vip-feature"><i>🎬</i><b>Movies</b></div>
          <div class="vip-feature"><i>▶️</i><b>Series</b></div>
        </div>

        <form id="vipVisitorLogin" class="vip-login-form">

          <label class="vip-input">
            <span>👤</span>
            <input
              id="vipUserName"
              autocomplete="name"
              placeholder="নাম / Username"
              required
            >
          </label>

          <label class="vip-input">
            <span>📱</span>
            <input
              id="vipUserNumber"
              inputmode="numeric"
              autocomplete="tel"
              placeholder="নাম্বার"
              maxlength="15"
              required
            >
          </label>

          <label class="vip-input">
            <span>💻</span>
            <input
              id="vipDeviceName"
              autocomplete="off"
              placeholder="ডিভাইস নেম"
              maxlength="80"
              required
            >
          </label>

          <button class="vip-login-btn" type="submit">
            ⇥ &nbsp; LOGIN
          </button>

          <div
            class="vip-gate-status"
            id="vipGateStatus"
            aria-live="polite"
          ></div>

        </form>

        <div class="vip-gate-credit">
          💻 <b>VIP-Network.TV</b> সফটওয়্যারটি তৈরি করেছেন
          <em>মাসুম</em>—তার সৃজনশীলতা ও পরিশ্রমেই প্রযুক্তির সাথে
          বিনোদনের এই সুন্দর সংযোগ। ✨
        </div>

      </div>
    `;

    document.body.appendChild(d);
    return d;
  }

  async function checkSession(){

    try{

      const r=await fetch(
        base+'/api/user/session',
        {
          method:'GET',
          credentials:'include',
          cache:'no-store'
        }
      );

      if(!r.ok) return false;

      const data=await r.json().catch(()=>({}));

      return data.ok===true;

    }catch(e){

      return false;

    }
  }

  async function init(){

    if(await checkSession()) return;

    const gate=makeGate();

    const form=gate.querySelector('#vipVisitorLogin');
    const status=gate.querySelector('#vipGateStatus');
    const btn=gate.querySelector('.vip-login-btn');

    const u=gate.querySelector('#vipUserName');
    const num=gate.querySelector('#vipUserNumber');
    const dn=gate.querySelector('#vipDeviceName');

    dn.value=deviceName();

    form.onsubmit=async function(e){

      e.preventDefault();

      if(btn.disabled) return;

      const username=u.value.trim();
      const number=normalizeNumber(num.value.trim());
      const deviceNameValue=dn.value.trim();
      const deviceId=window.VIP_DEVICE_ID||'';

      if(username.length<2){
        status.textContent='সঠিক নাম / Username দিন';
        status.style.color='#ff9ba7';
        u.focus();
        return;
      }

      if(number.length<6){
        status.textContent='সঠিক নাম্বার দিন';
        status.style.color='#ff9ba7';
        num.focus();
        return;
      }

      if(deviceNameValue.length<2){
        status.textContent='ডিভাইস নেম দিন';
        status.style.color='#ff9ba7';
        dn.focus();
        return;
      }

      btn.disabled=true;
      btn.textContent='Connecting...';
      status.textContent='Login হচ্ছে...';
      status.style.color='#fff';

      try{

        localStorage.setItem(
          'vip-network-device-name',
          deviceNameValue
        );

        const r=await fetch(
          base+'/api/user/login',
          {
            method:'POST',

            headers:{
              'content-type':'application/json',
              'X-ViP-Device-ID':deviceId
            },

            credentials:'include',
            cache:'no-store',

            body:JSON.stringify({
              username:username,
              number:number,
              deviceId:deviceId,
              deviceName:deviceNameValue
            })
          }
        );

        const data=await r.json().catch(()=>({}));

        if(!r.ok || data.ok!==true){

          throw new Error(
            data.error ||
            data.message ||
            'Login failed'
          );
        }

        localStorage.setItem(key,'1');

        status.textContent='Login successful ✓';
        status.style.color='#7dffae';

        setTimeout(()=>{
          gate.remove();
          window.dispatchEvent(
            new CustomEvent('vip:user-login',{
              detail:data
            })
          );
        },300);

      }catch(err){

        status.textContent=
          err.message ||
          'Login failed';

        status.style.color='#ff9ba7';

      }finally{

        btn.disabled=false;
        btn.textContent='⇥  LOGIN';

      }
    };
  }

  init();

})();
