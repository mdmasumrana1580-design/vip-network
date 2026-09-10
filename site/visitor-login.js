(function(){
  const base=(window.VIP_WORKER_API||window.location.origin).replace(/\/$/,'');
  const key='vip-network-user-session';
  function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
  function deviceName(){return localStorage.getItem('vip-network-device-name')||''}
  function makeGate(){
    const d=document.createElement('div');d.id='vipVisitorGate';
    d.innerHTML=`<div class="vip-gate-card" role="dialog" aria-modal="true" aria-label="VIP-Network.TV Login">
      <img class="vip-gate-logo" src="vip-network-logo.png" alt="VIP NETWORK TV Logo" onerror="this.style.display='none'">
      <h1 class="vip-gate-title">VIP-NETWORK.TV</h1><div class="vip-gate-sub">স্বাগতম</div>
      <p class="vip-gate-tagline"><strong>🔥 বিনোদনের নতুন ঠিকানা—VIP-Network.TV! 🔥</strong><br>আপনার প্রিয় অনুষ্ঠান, খেলাধুলা, খবর ও জমজমাট বিনোদনের সব আয়োজন নিয়ে সবসময় আপনার পাশে। আজই যুক্ত হোন VIP-Network.TV-এর সঙ্গে এবং উপভোগ করুন বিনোদনের এক নতুন, রোমাঞ্চকর জগৎ! ✨</p>
      <div class="vip-features"><div class="vip-feature"><i>📺</i><b>Live TV</b></div><div class="vip-feature"><i>⚽</i><b>Sports</b></div><div class="vip-feature"><i>🎬</i><b>Movies</b></div><div class="vip-feature"><i>▶️</i><b>Series</b></div></div>
      <form id="vipVisitorLogin" class="vip-login-form"><label class="vip-input"><span>👤</span><input id="vipUserName" autocomplete="username" placeholder="User Name" required></label><label class="vip-input"><span>🔒</span><input id="vipUserPass" type="password" autocomplete="current-password" placeholder="Password" required><button class="vip-eye" type="button" aria-label="Show password">👁</button></label><label class="vip-input"><span>💻</span><input id="vipDeviceName" placeholder="Device Name" required></label><button class="vip-login-btn" type="submit">⇥ &nbsp; LOGIN</button><div class="vip-gate-status" id="vipGateStatus"></div></form>
      <div class="vip-gate-credit">💻 <b>VIP-Network.TV</b> সফটওয়্যারটি তৈরি করেছেন <em>মাসুম</em>—তার সৃজনশীলতা ও পরিশ্রমেই প্রযুক্তির সাথে বিনোদনের এই সুন্দর সংযোগ। ✨</div>
    </div>`;document.body.appendChild(d);return d;
  }
  async function checkSession(){try{const r=await fetch(base+'/api/user/session',{credentials:'include',cache:'no-store'});return r.ok}catch(e){return false}}
  async function init(){if(await checkSession())return;const gate=makeGate();const form=gate.querySelector('#vipVisitorLogin'),status=gate.querySelector('#vipGateStatus'),btn=gate.querySelector('.vip-login-btn'),u=gate.querySelector('#vipUserName'),p=gate.querySelector('#vipUserPass'),dn=gate.querySelector('#vipDeviceName');dn.value=deviceName();gate.querySelector('.vip-eye').onclick=()=>p.type=p.type==='password'?'text':'password';form.onsubmit=async e=>{e.preventDefault();btn.disabled=true;status.textContent='Connecting...';try{localStorage.setItem('vip-network-device-name',dn.value.trim());const r=await fetch(base+'/api/user/login',{method:'POST',headers:{'content-type':'application/json','X-ViP-Device-ID':window.VIP_DEVICE_ID||''},credentials:'include',body:JSON.stringify({username:u.value.trim(),password:p.value,deviceId:window.VIP_DEVICE_ID||'',deviceName:dn.value.trim()})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Login failed');localStorage.setItem(key,'1');gate.remove()}catch(err){status.textContent=err.message||'Login failed';status.style.color='#ff9ba7'}finally{btn.disabled=false}}}
  init();
})();
