(function(){
  const DEVICE_KEY="vip-network-device-id";
  const LOGIN_KEY="vip-network-user-login";
  let deviceId=localStorage.getItem(DEVICE_KEY);
  if(!deviceId){
    deviceId=(crypto.randomUUID?crypto.randomUUID():"dev-"+Date.now()+"-"+Math.random().toString(36).slice(2));
    localStorage.setItem(DEVICE_KEY,deviceId);
  }
  window.VIP_DEVICE_ID=deviceId;
  const base=(window.VIP_WORKER_API||window.location.origin).replace(/\/$/,"");

  const style=`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
#vipLoginGate{position:fixed;inset:0;z-index:999999;background:radial-gradient(circle at 15% 10%,#183b74 0,transparent 32%),radial-gradient(circle at 85% 85%,#0d6a68 0,transparent 30%),linear-gradient(135deg,#050b16,#07182a 55%,#050912);color:#fff;display:flex;align-items:center;justify-content:center;padding:18px;font-family:Inter,Arial,sans-serif}
#vipLoginGate .box{width:min(430px,100%);box-sizing:border-box;background:linear-gradient(145deg,#152235,#09111d);border:1px solid #ffffff18;border-radius:28px;padding:26px 23px;box-shadow:0 25px 80px #000b}
#vipLoginGate .brand{display:flex;align-items:center;gap:13px;margin-bottom:18px}.logo{width:52px;height:52px;border-radius:16px;background:linear-gradient(145deg,#147de8,#0e4c98);display:grid;place-items:center;font-size:23px}.brandText b{display:block;font-size:20px}.brandText span{display:block;color:#91a7c1;font-size:11px;margin-top:3px;letter-spacing:1.4px}
#vipLoginGate h2{margin:4px 0 8px;font-size:23px}#vipLoginGate p{margin:0 0 18px;color:#aebed0;font-size:13px;line-height:1.55}#vipLoginGate label{display:block;font-size:11px;color:#9eb0c6;margin:12px 0 6px;font-weight:700}
#vipLoginGate input{box-sizing:border-box;width:100%;padding:14px;border-radius:14px;border:1px solid #334963;background:#07111e;color:#fff;outline:none;font-family:inherit}#vipLoginGate input:focus{border-color:#4ba7ff}
#vipLoginGate button#vipUserLogin{width:100%;padding:14px;border:0;border-radius:14px;background:linear-gradient(135deg,#198cff,#4c67ff);color:#fff;font-family:inherit;font-weight:800;font-size:14px;margin-top:18px}
#vipLoginGate .msg{min-height:20px;margin-top:12px;color:#ffd98a;font-size:12px;text-align:center}#vipLoginGate .footer{margin-top:18px;padding-top:14px;border-top:1px solid #ffffff10;text-align:center;color:#74879e;font-size:10px}
#vipUserLogout{position:fixed;right:14px;bottom:14px;z-index:99999;background:#111d2ce8;color:#dceaff;border:1px solid #ffffff1f;border-radius:999px;padding:10px 14px;font-family:Inter,Arial,sans-serif;font-size:12px}`;
  const css=document.createElement("style");css.textContent=style;document.head.appendChild(css);

  function getLogin(){try{return JSON.parse(localStorage.getItem(LOGIN_KEY)||"null")}catch{return null}}
  function showGate(message=""){
    let g=document.getElementById("vipLoginGate");
    if(!g){
      g=document.createElement("div");g.id="vipLoginGate";
      g.innerHTML=`<div class="box"><div class="brand"><div class="logo">▶</div><div class="brandText"><b>ViP-TV</b><span>PREMIUM ENTERTAINMENT</span></div></div><h2>Welcome</h2><p>নাম, পাসওয়ার্ড এবং ডিভাইসের নাম দিয়ে লগইন করুন। একই ডিভাইসে Logout না করা পর্যন্ত লগইন থাকবে।</p><label>আপনার নাম</label><input id="vipUserName" placeholder="যেমন: ViP-Nework"><label>ডিভাইসের নাম</label><input id="vipDeviceName" placeholder="যেমন: My Android Phone"><label>পাসওয়ার্ড</label><input id="vipUserPass" type="password" placeholder="আপনার পাসওয়ার্ড"><button id="vipUserLogin">🔐 Secure Login</button><div class="msg" id="vipLoginMsg"></div><div class="footer">আপনার নাম ও ডিভাইসের তথ্য Admin Panel-এ শনাক্তকরণের জন্য দেখা যাবে।</div></div>`;
      document.body.appendChild(g);
      g.querySelector("#vipUserLogin").onclick=login;
    }
    g.querySelector("#vipLoginMsg").textContent=message;
  }
  function hideGate(){document.getElementById("vipLoginGate")?.remove()}
  async function register(data){
    try{
      await fetch(base+"/api/device/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({deviceId,userName:data.name,deviceName:data.deviceName,name:data.deviceName,userAgent:navigator.userAgent}),keepalive:true});
    }catch(e){console.warn("Device registration will retry later",e)}
  }
  function addLogout(name){
    if(document.getElementById("vipUserLogout"))return;
    const b=document.createElement("button");b.id="vipUserLogout";b.textContent=(name?name+" · ":"")+"Logout";
    b.onclick=()=>{localStorage.removeItem(LOGIN_KEY);b.remove();showGate("আপনি লগআউট করেছেন।")};
    document.body.appendChild(b);
  }
  function login(){
    const name=document.getElementById("vipUserName").value.trim();
    const deviceName=document.getElementById("vipDeviceName").value.trim();
    const password=document.getElementById("vipUserPass").value;
    const msg=document.getElementById("vipLoginMsg");
    if(!name||!deviceName||!password){msg.textContent="নাম, ডিভাইসের নাম ও পাসওয়ার্ড লিখুন।";return}
    const data={name,deviceName,passwordSet:true,loggedAt:new Date().toISOString()};
    localStorage.setItem(LOGIN_KEY,JSON.stringify(data));
    hideGate();addLogout(name);
    register(data);
  }
  document.addEventListener("DOMContentLoaded",()=>{
    const saved=getLogin();
    if(saved){addLogout(saved.name);register(saved)}
    else showGate("");
  });
})();