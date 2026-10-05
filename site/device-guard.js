/* VIP NETWORK — Device Guard + Channel Access
   Replace the existing site/device-guard.js with this file.
   Keeps the existing block/device checks and adds:
   - Free channels: no crown/badge.
   - Paid channels: small 👑 badge.
   - Paid playback requires an active subscription.
   - Admin-controlled Free/Paid state is stored in Worker settings.
*/
(function(){
  'use strict';

  const KEY='vip-network-device-id';
  const FREE_DEFAULTS = [
    'A Sports HD','ATN Bangla','BTV','Makkah Live','Independent','RTV',
    'Ananda TV','HUM TV','Sony Max 2','Sony Aath','Enter 10 Bangla',
    'Zee Bangla HD','B4U Music','Sony YaY','9XM','T Sports HD',
    'Star Sports SL 2','Sony Ten 1','Star Sports 1'
  ];

  let id=localStorage.getItem(KEY);
  if(!id){
    id=(crypto.randomUUID?crypto.randomUUID():'dev-'+Date.now()+'-'+Math.random().toString(36).slice(2));
    localStorage.setItem(KEY,id);
  }
  window.VIP_DEVICE_ID=id;

  const base=()=>((window.VIP_WORKER_API||window.location.origin).replace(/\/$/,''));
  let blocked=false;
  let accessMap={};
  let accessLoaded=false;
  let accessLoading=null;

  function normalizeName(v){
    return String(v||'')
      .replace(/&amp;/g,'&')
      .replace(/\s+/g,' ')
      .trim()
      .toLowerCase()
      .replace(/\bhd\b/g,'hd');
  }
  function defaultAccess(name){
    const n=normalizeName(name);
    return FREE_DEFAULTS.some(x=>normalizeName(x)===n) ? 'free' : 'paid';
  }
  function accessFor(name){
    const key=normalizeName(name);
    if(Object.prototype.hasOwnProperty.call(accessMap,key)){
      return accessMap[key]==='free' ? 'free' : 'paid';
    }
    return defaultAccess(name);
  }

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
          body{min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:auto;background:radial-gradient(circle at 50% 22%,rgba(255,190,30,.10),transparent 28%),linear-gradient(180deg,#030609 0%,#010204 100%)}
          .vip-blocked-page{width:100%;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px 16px;position:relative;overflow:hidden}
          .vip-blocked-page:before,.vip-blocked-page:after{content:"";position:absolute;left:-8%;right:-8%;height:120px;bottom:-48px;border-top:2px solid rgba(255,199,46,.7);border-radius:50%;transform:rotate(-4deg);box-shadow:0 -8px 0 rgba(255,255,255,.04) inset,0 0 22px rgba(255,190,30,.12)}
          .vip-blocked-page:after{bottom:-78px;height:145px;border-top-color:rgba(255,255,255,.13);transform:rotate(4deg)}
          .vip-blocked-card{width:min(100%,720px);text-align:center;position:relative;z-index:1;padding:8px 14px 72px}
          .vip-blocked-logo{width:min(54vw,250px);height:auto;max-height:190px;object-fit:contain;display:block;margin:0 auto 16px;filter:drop-shadow(0 0 18px rgba(255,193,37,.24))}
          .vip-blocked-brand{font-size:clamp(16px,4vw,26px);font-weight:800;letter-spacing:.42em;color:#f6f6f6;margin:0 0 22px}
          .vip-blocked-lock{width:clamp(150px,43vw,235px);height:clamp(150px,43vw,235px);margin:0 auto 28px;border-radius:50%;display:grid;place-items:center;font-size:clamp(74px,18vw,112px);background:radial-gradient(circle at 50% 42%,#1b2025 0%,#090d11 68%,#030507 100%);border:6px solid #e4aa21;box-shadow:0 0 0 2px rgba(255,222,108,.28) inset,0 0 22px rgba(255,191,31,.36),0 0 0 10px rgba(255,191,31,.05)}
          .vip-blocked-title{display:inline-flex;align-items:center;justify-content:center;gap:12px;max-width:100%;padding:13px 24px;border:2px solid #e5ad24;border-radius:999px;color:#ffd85a;font-size:clamp(22px,5.6vw,42px);font-weight:900;line-height:1.2}
          .vip-blocked-text{margin:28px auto;max-width:650px;font-size:clamp(18px,4.6vw,31px);line-height:1.55;color:#f5f5f5}
          .vip-blocked-contact{display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:58px;padding:0 30px;border:2px solid #e5ad24;border-radius:999px;background:#090c10;color:#ffd85a;text-decoration:none;font-size:clamp(17px,4.2vw,27px);font-weight:900}
          .vip-blocked-footer{margin-top:72px;color:#f3c84b;letter-spacing:.45em;font-size:clamp(12px,2.8vw,18px);font-weight:800}
          .vip-blocked-footer small{display:block;color:#f3f3f3;letter-spacing:.34em;margin-top:12px;font-size:.62em;font-weight:500}
        </style>
      </head><body><main class="vip-blocked-page"><section class="vip-blocked-card">
        <img class="vip-blocked-logo" src="vip-network-logo.png" alt="VIP NETWORK" onerror="this.style.display='none'">
        <div class="vip-blocked-brand">CONNECT • CHAT • SHARE</div><div class="vip-blocked-lock">🔒</div>
        <div class="vip-blocked-title">🛡️ ডিভাইস ব্লক করা হয়েছে</div>
        <p class="vip-blocked-text">আপনার ডিভাইসটি অ্যাডমিনিস্ট্রেটর কর্তৃক ব্লক করা হয়েছে।<br>অনুগ্রহ করে অ্যাডমিনিস্ট্রেটরের সাথে যোগাযোগ করুন।</p>
        <a class="vip-blocked-contact" href="https://m.me/alexranaroy" target="_blank" rel="noopener noreferrer">🎧 অ্যাডমিনের সাথে যোগাযোগ করুন</a>
        <div class="vip-blocked-footer">VIP NETWORK<small>STAY CONNECTED ALWAYS</small></div>
      </section></main></body>`;
    }catch(e){document.body.innerHTML='<h1 style="padding:24px;text-align:center">আপনার ডিভাইসটি ব্লক করা হয়েছে</h1>';}
  }
  window.VIP_SHOW_BLOCKED_PAGE=showBlocked;

  function injectStyles(){
    if(document.getElementById('vipAccessStyles'))return;
    const s=document.createElement('style');s.id='vipAccessStyles';
    s.textContent=`
      .vip-paid-badge{position:absolute;right:-2px;top:-2px;z-index:5;display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:linear-gradient(145deg,#ffe27a,#c88700);box-shadow:0 3px 10px rgba(0,0,0,.45),0 0 9px rgba(255,196,30,.55);font-size:15px;line-height:1;pointer-events:none}
      .vip-paid-card{position:relative}
      .vip-paid-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147482000;background:rgba(7,12,20,.96);color:#fff;border:1px solid rgba(255,210,80,.45);border-radius:14px;padding:12px 16px;font:700 13px system-ui,sans-serif;box-shadow:0 10px 35px rgba(0,0,0,.45);display:none}
    `;
    document.head.appendChild(s);
  }

  function decorateCards(){
    injectStyles();
    document.querySelectorAll('.card').forEach(card=>{
      const label=card.querySelector('.label-text,.label');
      const name=label ? label.textContent.trim() : '';
      if(!name)return;
      const paid=accessFor(name)==='paid';
      card.classList.toggle('vip-paid-card',paid);
      const old=card.querySelector('.vip-paid-badge');
      if(paid){
        if(!old){
          const badge=document.createElement('span');
          badge.className='vip-paid-badge';
          badge.textContent='👑';
          badge.setAttribute('aria-label','Paid channel');
          const circle=card.querySelector('.circle');
          (circle||card).appendChild(badge);
        }
      }else if(old)old.remove();
    });
  }

  function toast(msg){
    let x=document.querySelector('.vip-paid-toast');
    if(!x){x=document.createElement('div');x.className='vip-paid-toast';document.body.appendChild(x);}
    x.textContent=msg;x.style.display='block';
    clearTimeout(x._t);x._t=setTimeout(()=>x.style.display='none',2600);
  }

  async function loadAccess(){
    if(accessLoading)return accessLoading;
    accessLoading=(async()=>{
      try{
        const r=await fetch(base()+'/api/device/check?deviceId='+encodeURIComponent(id),{headers:{'X-ViP-Device-ID':id},cache:'no-store'});
        const d=await r.json().catch(()=>({}));
        if(r.status===403 || d.blocked===true || d.device?.blocked===true){showBlocked();return false;}
        const map=d?.settings?.channelAccess;
        if(map && typeof map==='object') accessMap=map;
        accessLoaded=true;
        decorateCards();
        return true;
      }catch(e){
        accessLoaded=true;
        decorateCards();
        return true;
      }finally{accessLoading=null;}
    })();
    return accessLoading;
  }

  async function check(){
    if(blocked)return false;
    try{
      const api=base();
      const name=localStorage.getItem('vip-network-device-name')||((/Mobi|Android/i.test(navigator.userAgent))?'Mobile Device':'Browser Device');
      const reg=await fetch(api+'/api/device/register',{
        method:'POST',headers:{'content-type':'application/json','X-ViP-Device-ID':id},
        body:JSON.stringify({deviceId:id,name,userAgent:navigator.userAgent}),cache:'no-store'
      });
      const rd=await reg.json().catch(()=>({}));
      if(reg.status===403 || rd.blocked===true || rd.device?.blocked===true){showBlocked();return false;}
      const r=await fetch(api+'/api/device/check?deviceId='+encodeURIComponent(id),{headers:{'X-ViP-Device-ID':id},cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(r.status===403 || d.blocked===true || d.device?.blocked===true || String(d.device?.status||'').toLowerCase()==='blocked'){showBlocked();return false;}
      if(d?.settings?.channelAccess && typeof d.settings.channelAccess==='object') accessMap=d.settings.channelAccess;
      accessLoaded=true;
      decorateCards();
      return true;
    }catch(e){return true;}
  }

  async function paidAllowed(){
    try{
      const r=await fetch(base()+'/api/payment/access',{credentials:'include',cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(d.blocked===true){showBlocked();return false;}
      if(d.active===true)return true;
    }catch(e){}
    location.href='/payment.html';
    return false;
  }

  // Capture before app.js card click handlers. Free cards pass through untouched.
  document.addEventListener('click',async function(e){
    const card=e.target && e.target.closest ? e.target.closest('.card') : null;
    if(!card || blocked)return;
    const label=card.querySelector('.label-text,.label');
    const name=label ? label.textContent.trim() : '';
    if(!name || accessFor(name)!=='paid')return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    if(card.dataset.vipPaidChecking==='1')return;
    card.dataset.vipPaidChecking='1';
    try{
      await loadAccess();
      if(accessFor(name)==='free'){
        card.dataset.vipPaidChecking='0';
        card.click();
        return;
      }
      toast('👑 এটি Paid Channel — Package Active থাকতে হবে');
      await paidAllowed();
    }finally{card.dataset.vipPaidChecking='0';}
  },true);

  const observer=new MutationObserver(()=>decorateCards());
  observer.observe(document.documentElement,{childList:true,subtree:true});

  check();
  setTimeout(loadAccess,700);
  setInterval(check,10000);
  window.addEventListener('focus',check);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
})();