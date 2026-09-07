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
      document.documentElement.innerHTML='<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Device Blocked</title><style>body{margin:0;background:#050807;color:#fff;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px;box-sizing:border-box}div{max-width:520px;padding:28px;border:1px solid #333;border-radius:18px;background:#0d1210}h1{margin:0 0 10px;color:#ff5c5c}p{opacity:.85;line-height:1.6}</style></head><body><div><h1>Device Blocked</h1><p>Your device has been blocked.<br>Please contact the administrator.</p></div></body>';
    }catch(e){
      document.body.innerHTML='<h1>Your device has been blocked</h1>';
    }
  }

  async function check(){
    if(blocked)return false;
    try{
      const r=await fetch(base()+'/api/device/check?deviceId='+encodeURIComponent(id),{
        headers:{'X-ViP-Device-ID':id},
        cache:'no-store'
      });
      const d=await r.json().catch(()=>({}));
      if(d.blocked===true || d.device?.blocked===true || String(d.device?.status||'').toLowerCase()==='blocked'){
        showBlocked();
        return false;
      }
      return true;
    }catch(e){
      return true;
    }
  }

  check();
  setInterval(check,10000);
  window.addEventListener('focus',check);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
})();
