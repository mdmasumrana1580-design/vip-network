(function(){
  const KEY="vip-network-device-id";
  let id=localStorage.getItem(KEY);
  if(!id){ id=(crypto.randomUUID?crypto.randomUUID():"dev-"+Date.now()+"-"+Math.random().toString(36).slice(2)); localStorage.setItem(KEY,id); }
  window.VIP_DEVICE_ID=id;
  const base=(window.VIP_WORKER_API||window.location.origin).replace(/\/$/,"");
  async function register(){
    try{
      const r=await fetch(base+"/api/device/register",{method:"POST",headers:{"Content-Type":"application/json","X-ViP-Device-ID":id},body:JSON.stringify({deviceId:id,name:navigator.userAgent.slice(0,80),userAgent:navigator.userAgent}),cache:"no-store"});
      if(!r.ok)return;
      const d=await r.json();
      if(d.approved===false || (d.device && d.device.approved===false)){
        // Do not block the public TV site by default; the admin can inspect/approve devices.
        document.documentElement.dataset.vipDevicePending="1";
      }
    }catch(e){}
  }
  register();
})();