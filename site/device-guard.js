(function(){
  const KEY="vip-network-device-id";
  let id=localStorage.getItem(KEY);
  if(!id){id=(crypto.randomUUID?crypto.randomUUID():"dev-"+Date.now()+"-"+Math.random().toString(36).slice(2));localStorage.setItem(KEY,id);}
  window.VIP_DEVICE_ID=id;
  const base=(window.VIP_WORKER_API||window.location.origin).replace(/\/$/,"");

  const style=`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
#vipLoginGate{position:fixed;inset:0;z-index:999999;background:radial-gradient(circle at 15% 10%,#183b74 0,transparent 32%),radial-gradient(circle at 85% 85%,#0d6a68 0,transparent 30%),linear-gradient(135deg,#050b16,#07182a 55%,#050912);color:#fff;display:flex;align-items:center;justify-content:center;padding:18px;font-family:Inter,Arial,sans-serif;overflow:auto}
#vipLoginGate:before{content:"";position:absolute;inset:0;background:linear-gradient(120deg,transparent 0 45%,#ffffff08 45% 46%,transparent 46% 100%);pointer-events:none}
#vipLoginGate .box{position:relative;width:min(430px,100%);box-sizing:border-box;background:linear-gradient(145deg,#152235eF,#09111df5);border:1px solid #ffffff18;border-radius:28px;padding:26px 23px 22px;box-shadow:0 25px 80px #000b,0 0 0 1px #6aa9ff08;backdrop-filter:blur(18px);overflow:hidden}
#vipLoginGate .box:before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,#29b6ff,#6e7cff,#29e0b0)}
#vipLoginGate .brand{display:flex;align-items:center;gap:13px;margin-bottom:18px}
#vipLoginGate .logo{width:52px;height:52px;border-radius:16px;background:linear-gradient(145deg,#147de8,#0e4c98);display:grid;place-items:center;font-size:23px;box-shadow:0 10px 28px #126fd866;border:1px solid #8ac6ff44}
#vipLoginGate .brandText b{display:block;font-size:20px;letter-spacing:.2px}.brandText span{display:block;color:#91a7c1;font-size:11px;margin-top:3px;letter-spacing:1.4px}
#vipLoginGate h2{margin:4px 0 8px;font-size:23px;line-height:1.25}
#vipLoginGate p{margin:0 0 18px;color:#aebed0;font-size:13px;line-height:1.55}
#vipLoginGate label{display:block;font-size:11px;color:#9eb0c6;margin:12px 0 6px;font-weight:700;letter-spacing:.3px}
#vipLoginGate input{box-sizing:border-box;width:100%;padding:14px 14px;border-radius:14px;border:1px solid #334963;background:#07111e;color:#fff;outline:none;font-family:inherit;transition:.2s}
#vipLoginGate input:focus{border-color:#4ba7ff;box-shadow:0 0 0 4px #3b9cff18;background:#091727}
#vipLoginGate input::placeholder{color:#66788d}
#vipLoginGate button#vipUserLogin{width:100%;padding:14px;border:0;border-radius:14px;background:linear-gradient(135deg,#198cff,#4c67ff);color:#fff;font-family:inherit;font-weight:800;font-size:14px;margin-top:18px;box-shadow:0 12px 26px #126cff4d;cursor:pointer}
#vipLoginGate button#vipUserLogin:active{transform:scale(.98)}
#vipLoginGate .msg{min-height:20px;margin-top:12px;color:#ffd98a;font-size:12px;text-align:center}
#vipLoginGate .footer{margin-top:18px;padding-top:14px;border-top:1px solid #ffffff10;text-align:center;color:#74879e;font-size:10px}
#vipLoginGate .secure{display:inline-flex;align-items:center;gap:6px;color:#82d7bc;margin-top:5px}
#vipUserLogout{position:fixed;right:14px;bottom:14px;z-index:99999;background:#111d2cE8;color:#dceaff;border:1px solid #ffffff1f;border-radius:999px;padding:10px 14px;font-family:Inter,Arial,sans-serif;font-size:12px;box-shadow:0 10px 30px #0008;backdrop-filter:blur(12px)}
@media(max-width:420px){#vipLoginGate{padding:12px}#vipLoginGate .box{padding:22px 18px;border-radius:24px}}`;
  const css=document.createElement("style");css.textContent=style;document.head.appendChild(css);

  function showGate(message=""){
    let g=document.getElementById("vipLoginGate");
    if(!g){
      g=document.createElement("div");g.id="vipLoginGate";
      g.innerHTML=`<div class="box"><div class="brand"><div class="logo">▶</div><div class="brandText"><b>ViP-TV</b><span>PREMIUM ENTERTAINMENT</span></div></div><h2>Welcome back</h2><p>আপনার ViP-TV অ্যাকাউন্টে লগইন করুন। একবার লগইন করলে একই ডিভাইসে Logout না করা পর্যন্ত লগইন থাকবে।</p><label>আপনার নাম</label><input id="vipUserName" placeholder="যেমন: ViP-Nework" autocomplete="username"><label>ডিভাইসের নাম</label><input id="vipDeviceName" placeholder="যেমন: My Android Phone"><label>পাসওয়ার্ড</label><input id="vipUserPass" type="password" placeholder="আপনার পাসওয়ার্ড" autocomplete="current-password"><button id="vipUserLogin">🔐 Secure Login</button><div class="msg" id="vipLoginMsg"></div><div class="footer">আপনার তথ্য শুধু Admin Panel-এ শনাক্তকরণের জন্য দেখা যাবে।<br><span class="secure">🛡 Secure device access</span></div></div>`;
      document.body.appendChild(g);
      g.querySelector("#vipUserLogin").onclick=login;
      g.addEventListener("keydown",e=>{if(e.key==="Enter")login()});
    }
    g.querySelector("#vipLoginMsg").textContent=message;
  }
  function hideGate(){document.getElementById("vipLoginGate")?.remove();}
  async function login(){
    const name=document.getElementById("vipUserName").value.trim();
    const deviceName=document.getElementById("vipDeviceName").value.trim();
    const password=document.getElementById("vipUserPass").value;
    const msg=document.getElementById("vipLoginMsg");msg.textContent="Please wait…";
    try{
      const r=await fetch(base+"/api/user/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,password,deviceName,deviceId:id,userAgent:navigator.userAgent}),credentials:"include"});
      const d=await r.json().catch(()=>({}));
      if(!r.ok){msg.textContent=d.error||"Login failed. আবার চেষ্টা করুন।";return;}
      hideGate();addLogout(d.user?.name||name);
    }catch(e){msg.textContent="Connection problem. আবার চেষ্টা করুন।";}
  }
  function addLogout(name){
    if(document.getElementById("vipUserLogout"))return;
    const b=document.createElement("button");b.id="vipUserLogout";b.textContent=(name?name+" · ":"")+"Logout";
    b.onclick=async()=>{await fetch(base+"/api/user/logout",{method:"POST",credentials:"include"}).catch(()=>{});b.remove();showGate("আপনি লগআউট করেছেন।");};
    document.body.appendChild(b);
  }
  async function check(){
    try{
      const r=await fetch(base+"/api/user/session",{credentials:"include",cache:"no-store"});
      const d=await r.json().catch(()=>({}));
      if(r.ok&&d.loggedIn){hideGate();addLogout(d.user?.name||"");return;}
      showGate(d.reason==="blocked"?"Admin access বন্ধ করেছেন। আবার অনুমোদন লাগবে।":"লগইন করুন");
    }catch(e){showGate("Server-এর সাথে সংযোগ হচ্ছে না।");}
  }
  document.addEventListener("DOMContentLoaded",check);
})();