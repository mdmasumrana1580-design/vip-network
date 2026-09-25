/* MSM.TV welcome gate — no login form. Close (×) to enter the website. */
(function(){
  function makeGate(){
    const d=document.createElement('div');
    d.id='vipVisitorGate';
    d.innerHTML=`
      <div class="vip-gate-card" role="dialog" aria-modal="true" aria-label="MSM.TV Welcome">
        <button class="vip-gate-close" id="vipGateClose" type="button" aria-label="Close and enter website">×</button>
        <img class="vip-gate-logo" src="vip-tv-logo-192.png" alt="MSM.TV" onerror="this.style.display='none'">
        <h1 class="vip-gate-title">MsM.TV</h1>
        <div class="vip-gate-sub">স্বাগতম</div>
        <p class="vip-gate-tagline"><strong>🔥 বিনোদনের নতুন ঠিকানা—MsM.TV! 🔥</strong><br>
          আপনার প্রিয় অনুষ্ঠান, খেলাধুলা, খবর ও জমজমাট বিনোদনের সব আয়োজন নিয়ে সবসময় আপনার পাশে। আজই যুক্ত হোন MsM.TV-এর সঙ্গে এবং উপভোগ করুন বিনোদনের এক নতুন, রোমাঞ্চকর জগৎ! ✨
        </p>
        <div class="vip-features" aria-label="Features">
          <div class="vip-feature"><i>📺</i><b>Live TV</b></div>
          <div class="vip-feature"><i>⚽</i><b>Sports</b></div>
          <div class="vip-feature"><i>🎬</i><b>Movies</b></div>
          <div class="vip-feature"><i>▶️</i><b>Series</b></div>
        </div>
        <div class="vip-gate-credit">💻 <b>MsM.TV</b> সফটওয়্যারটি তৈরি করেছেন <em>মাসুম</em>—তার সৃজনশীলতা ও পরিশ্রমেই প্রযুক্তির সাথে বিনোদনের এই সুন্দর সংযোগ। ✨</div>
      </div>`;
    document.body.appendChild(d);
    document.body.classList.add('vip-gate-open');

    const close=()=>{
      d.classList.add('vip-gate-closing');
      document.body.classList.remove('vip-gate-open');
      setTimeout(()=>d.remove(),180);
    };
    d.querySelector('#vipGateClose').addEventListener('click',close);
    return d;
  }

  function init(){
    // Keep the existing server-session behavior: authenticated users go straight in.
    const base=(window.VIP_WORKER_API||window.location.origin).replace(/\/$/,'');
    fetch(base+'/api/user/session',{credentials:'include',cache:'no-store'})
      .then(r=>{ if(!r.ok) makeGate(); })
      .catch(()=>makeGate());
  }
  init();
})();
