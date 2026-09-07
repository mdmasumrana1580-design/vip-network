/* ViP NETWORK — strong device block guard */
(function(){
  const KEY='vip-network-device-id';
  let id=localStorage.getItem(KEY);
  if(!id){id=(crypto.randomUUID?crypto.randomUUID():'dev-'+Date.now()+'-'+Math.random().toString(36).slice(2));localStorage.setItem(KEY,id)}
  window.VIP_DEVICE_ID=id;
  const base=()=>((window.VIP_WORKER_API||window.location.origin).replace(/\/$/,''));
  let blocked=false;
  function showBlocked(){
    if(blocked)return; blocked=true;
    try{document.documentElement.innerHTML='<head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Device Blocked</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#050b12;color:#fff;font-family:Arial,sans-serif"><div style="width:min(92%,420px);box-sizing:border-box;text-align:center;padding:34px 22px;border-radius:18px;background:#101923;box-shadow:0 12px 40px rgba(0,0,0,.45)"><div style="font-size:58px">⛔</div><h1 style="margin:12px 0;color:#ff5b6e">Your device has been blocked</h1><p style="opacity:.8;line-height:1.6">This device cannot access ViP Network. Please contact the administrator.</p></div></body>'}catch(e){document.body.innerHTML='<h1>Your device has been blocked</h1>'}
  }
  async function check(){
    try{
      const r=await fetch(base()+'/api/device/check?deviceId='+encodeURIComponent(id),{headers:{'X-ViP-Device-ID':id},cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(d.blocked===true||d.device?.blocked===true||String(d.device?.status||'').toLowerCase()==='blocked'){showBlocked();return false}
      return true;
    }catch(e){return true}
  }
  async function register(){
    if(!(await check()))return;
    try{
      const r=await fetch(base()+'/api/device/register',{method:'POST',headers:{'Content-Type':'application/json','X-ViP-Device-ID':id},body:JSON.stringify({deviceId:id,name:navigator.userAgent.slice(0,80),userAgent:navigator.userAgent}),cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(r.status===403||d.blocked===true||d.device?.blocked===true){showBlocked();return}
    }catch(e){}
  }
  register();
  setInterval(check,10000);
  window.addEventListener('focus',check);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
})();
