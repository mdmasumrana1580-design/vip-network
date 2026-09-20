/* VIP NETWORK — Device Guard
   Targeted fix: device IDs are created locally and blocked devices are checked,
   but accounts are NOT auto-created. Account creation now happens only after
   successful visitor login.
*/
(function(){
  const KEY='vip-network-device-id';
  let id=localStorage.getItem(KEY);
  if(!id){
    id=(crypto.randomUUID?crypto.randomUUID():'dev-'+Date.now()+'-'+Math.random().toString(36).slice(2));
    localStorage.setItem(KEY,id);
  }
  window.VIP_DEVICE_ID=id;

  const base=()=>((window.VIP_WORKER_API||window.location.origin).replace(/\/$/,''));
  let blocked=false;

  function showBlocked(){
    if(blocked)return;
    blocked=true;
    try{
      document.documentElement.innerHTML=`<head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
        <meta name="theme-color" content="#030609">
        <title>VIP NETWORK — Device Blocked</title>
        <style>
          *{box-sizing:border-box}
          html,body{margin:0;width:100%;min-height:100%;background:#020508;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Arial,"Noto Sans Bengali",sans-serif}
          body{min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:auto;background:
            radial-gradient(circle at 50% 22%,rgba(255,190,30,.10),transparent 28%),
            linear-gradient(180deg,#030609 0%,#010204 100%)}
          .vip-blocked-page{width:100%;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px 16px;position:relative;overflow:hidden}
          .vip-blocked-page:before,.vip-blocked-page:after{content:"";position:absolute;left:-8%;right:-8%;height:120px;bottom:-48px;border-top:2px solid rgba(255,199,46,.7);border-radius:50%;transform:rotate(-4deg);box-shadow:0 -8px 0 rgba(255,255,255,.04) inset,0 0 22px rgba(255,190,30,.12)}
          .vip-blocked-page:after{bottom:-78px;height:145px;border-top-color:rgba(255,255,255,.13);transform:rotate(4deg)}
          .vip-blocked-card{width:min(100%,720px);text-align:center;position:relative;z-index:1;padding:8px 14px 72px}
          .vip-blocked-logo{width:min(54vw,250px);height:auto;max-height:190px;object-fit:contain;display:block;margin:0 auto 16px;filter:drop-shadow(0 0 18px rgba(255,193,37,.24))}
          .vip-blocked-brand{font-size:clamp(16px,4vw,26px);font-weight:800;letter-spacing:.42em;color:#f6f6f6;margin:0 0 22px;text-shadow:0 0 12px rgba(255,255,255,.12)}
          .vip-blocked-lock{width:clamp(150px,43vw,235px);height:clamp(150px,43vw,235px);margin:0 auto 28px;border-radius:50%;display:grid;place-items:center;font-size:clamp(74px,18vw,112px);background:radial-gradient(circle at 50% 42%,#1b2025 0%,#090d11 68%,#030507 100%);border:6px solid #e4aa21;box-shadow:0 0 0 2px rgba(255,222,108,.28) inset,0 0 22px rgba(255,191,31,.36),0 0 0 10px rgba(255,191,31,.05)}
          .vip-blocked-title{display:inline-flex;align-items:center;justify-content:center;gap:12px;max-width:100%;padding:13px 24px;border:2px solid #e5ad24;border-radius:999px;color:#ffd85a;font-size:clamp(22px,5.6vw,42px);font-weight:900;line-height:1.2;text-shadow:0 0 12px rgba(255,199,55,.16);box-shadow:0 0 18px rgba(255,190,30,.08) inset}
          .vip-blocked-title .shield{font-size:.9em}
          .vip-blocked-text{margin:28px auto 28px;max-width:650px;font-size:clamp(18px,4.6vw,31px);line-height:1.55;color:#f5f5f5;text-shadow:0 2px 12px rgba(0,0,0,.6)}
          .vip-blocked-contact{display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:58px;padding:0 30px;border:2px solid #e5ad24;border-radius:999px;background:linear-gradient(180deg,rgba(25,25,25,.9),rgba(6,8,10,.95));color:#ffd85a;text-decoration:none;font-size:clamp(17px,4.2vw,27px);font-weight:900;box-shadow:0 0 20px rgba(255,190,30,.12);cursor:pointer;transition:transform .15s ease,filter .15s ease}
          .vip-blocked-contact:active{transform:scale(.98);filter:brightness(.9)}
          .vip-blocked-footer{margin-top:72px;color:#f3c84b;letter-spacing:.45em;font-size:clamp(12px,2.8vw,18px);font-weight:800}
          .vip-blocked-footer small{display:block;color:#f3f3f3;letter-spacing:.34em;margin-top:12px;font-size:.62em;font-weight:500}
          @media(max-width:520px){.vip-blocked-page{padding:20px 10px}.vip-blocked-card{padding-bottom:62px}.vip-blocked-logo{width:190px;margin-bottom:10px}.vip-blocked-brand{letter-spacing:.34em;margin-bottom:18px}.vip-blocked-lock{margin-bottom:22px;border-width:4px}.vip-blocked-title{padding:11px 16px;gap:8px}.vip-blocked-text{margin-top:22px}.vip-blocked-contact{min-height:54px;padding:0 22px}.vip-blocked-footer{margin-top:54px}}
        </style>
      </head>
      <body>
        <main class="vip-blocked-page">
          <section class="vip-blocked-card" aria-label="Device blocked">
            <img class="vip-blocked-logo" src="vip-network-logo.png" alt="VIP NETWORK" onerror="this.style.display='none'">
            <div class="vip-blocked-brand">CONNECT&nbsp;&nbsp;•&nbsp;&nbsp;CHAT&nbsp;&nbsp;•&nbsp;&nbsp;SHARE</div>
            <div class="vip-blocked-lock" aria-hidden="true">🔒</div>
            <div class="vip-blocked-title"><span class="shield">🛡️</span> ডিভাইস ব্লক করা হয়েছে</div>
            <p class="vip-blocked-text">আপনার ডিভাইসটি অ্যাডমিনিস্ট্রেটর কর্তৃক ব্লক করা হয়েছে।<br>অনুগ্রহ করে অ্যাডমিনিস্ট্রেটরের সাথে যোগাযোগ করুন।</p>
            <a class="vip-blocked-contact" href="https://m.me/alexranaroy" target="_blank" rel="noopener noreferrer" aria-label="অ্যাডমিনের সাথে যোগাযোগ করুন">🎧&nbsp; অ্যাডমিনের সাথে যোগাযোগ করুন</a>
            <div class="vip-blocked-footer">VIP NETWORK<small>STAY CONNECTED ALWAYS</small></div>
          </section>
        </main>
      </body>`;
    }catch(e){
      document.body.innerHTML='<h1 style="padding:24px;text-align:center">আপনার ডিভাইসটি ব্লক করা হয়েছে</h1>';
    }
  }

  window.VIP_SHOW_BLOCKED_PAGE=showBlocked;

  async function check(){
    if(blocked)return false;
    try{
      const api=base();
      const name=localStorage.getItem('vip-network-device-name')||((/Mobi|Android/i.test(navigator.userAgent))?'Mobile Device':'Browser Device');
      const reg=await fetch(api+'/api/device/register',{
        method:'POST',
        headers:{'content-type':'application/json','X-ViP-Device-ID':id},
        body:JSON.stringify({deviceId:id,name,userAgent:navigator.userAgent}),
        cache:'no-store'
      });
      const rd=await reg.json().catch(()=>({}));
      if(reg.status===403 || rd.blocked===true || rd.device?.blocked===true){showBlocked();return false;}
      const r=await fetch(api+'/api/device/check?deviceId='+encodeURIComponent(id),{
        headers:{'X-ViP-Device-ID':id},cache:'no-store'
      });
      const d=await r.json().catch(()=>({}));
      if(r.status===403 || d.blocked===true || d.device?.blocked===true || String(d.device?.status||'').toLowerCase()==='blocked'){
        showBlocked();return false;
      }
      return true;
    }catch(e){return true;}
  }

  check();
  setInterval(check,10000);
  window.addEventListener('focus',check);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
})();
