(function(){
  const API=(window.VIP_PUBLIC_API||window.VIP_ADMIN_API||"https://isp.vip-network.workers.dev").replace(/\/$/,"");
  const KEY="vipDeviceId";
  function newId(){return (crypto.randomUUID?crypto.randomUUID():"vip-"+Date.now()+"-"+Math.random().toString(36).slice(2));}
  let id=localStorage.getItem(KEY)||newId();
  localStorage.setItem(KEY,id);
  let blocked=false;
  function overlay(title,text){let x=document.getElementById("vipAccessOverlay");if(!x){x=document.createElement("div");x.id="vipAccessOverlay";x.style.cssText="position:fixed;inset:0;background:#050a0fee;color:#fff;z-index:999999;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font-family:system-ui";document.documentElement.appendChild(x)}x.innerHTML='<div style="max-width:460px"><div style="font-size:54px;margin-bottom:10px">🚫</div><h2 style="margin:0 0 10px">'+title+'</h2><p style="opacity:.78;line-height:1.6">'+text+'</p></div>';if(document.body)document.body.style.overflow="hidden";blocked=true;}
  function clearOverlay(){let x=document.getElementById("vipAccessOverlay");if(x)x.remove();if(document.body)document.body.style.overflow="";blocked=false;}
  async function register(deviceId){let r=await fetch(API+"/api/device/register",{method:"POST",headers:{"Content-Type":"application/json","X-ViP-Device-ID":deviceId},body:JSON.stringify({deviceId,name:navigator.userAgent.slice(0,80),model:navigator.userAgent,platform:navigator.platform,app:"ViP-tv"}),cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);return await r.json();}
  async function check(){let r=await fetch(API+"/api/device/check",{headers:{"X-ViP-Device-ID":id},cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);return await r.json();}
  function deny(d){if(d.reason==="access-disabled")overlay("ViP-tv Access Closed","Admin বর্তমানে ViP-tv-এর Global Access বন্ধ করে দিয়েছেন।");else if(d.reason==="approval-required")overlay("Device Approval Required","এই Device এখন Pending অবস্থায় আছে। Admin Approval দিলে ViP-tv ব্যবহার করতে পারবেন।");else if(d.reason==="blocked")overlay("Device Blocked","এই Device-এর ViP-tv access Admin বন্ধ করে দিয়েছেন।");else overlay("Access Denied","এই Device থেকে ViP-tv access পাওয়া যাচ্ছে না।");}
  async function run(){try{let d=await register(id);if(d.allowed){clearOverlay();return;}if(d.reason==="session-revoked"){d=await register(id);if(d.allowed){clearOverlay();return;}}deny(d);}catch(e){overlay("ViP-tv Access Unavailable","Server-এর সাথে যোগাযোগ করা যাচ্ছে না। আবার চেষ্টা করুন।");console.warn("ViP-tv device guard unavailable",e)}}
  async function heartbeat(){try{let d=await check();if(d.allowed){if(blocked)clearOverlay();}else{deny(d);}}catch(e){overlay("ViP-tv Access Unavailable","Server-এর সাথে যোগাযোগ করা যাচ্ছে না। আবার চেষ্টা করুন।");}}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});else run();
  setInterval(heartbeat,30000);
})();