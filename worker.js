/**
 * ViP NETWORK Worker — Block + Last Login FIX
 * Based on the current public repository version.
 */
const STATE_KEY='vip_state_v1', DEVICES_KEY='vip_devices_v1', SETTINGS_KEY='vip_settings_v1', SESSION_PREFIX='vip_admin_session:', USER_SESSION_PREFIX='vip_user_session:', USER_SESSION_TTL=31536000;
const SESSION_TTL=300;
const adminPassword=env=>env.ADMIN_PASSWORD||env.ADMIN_PASSWOED||'';
const kv=env=>(env.VIP_PLAYLIST||env.PLAYLIST_KV);
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}});
const corsBase={'access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS','access-control-allow-headers':'Content-Type, Authorization, X-ViP-Device-ID','access-control-allow-credentials':'true','vary':'Origin'};
function withCors(resp,request){const h=new Headers(resp.headers);Object.entries(corsBase).forEach(([k,v])=>h.set(k,v));const origin=request?.headers?.get('Origin');h.set('access-control-allow-origin',origin||new URL(request?.url||'https://localhost').origin);return new Response(resp.body,{status:resp.status,statusText:resp.statusText,headers:h})}
function norm(c={}){return{name:String(c.name||c.title||'Unnamed'),category:String(c.category||c.group||c.groupTitle||'Other'),logo:String(c.logo||c.tvgLogo||c['tvg-logo']||''),url:String(c.url||c.stream||c.streamUrl||''),status:String(c.status||'Unknown')}}
function parseM3U(text){const lines=String(text||'').replace(/\r/g,'').split('\n'),out=[];let meta=null;for(const raw of lines){const line=raw.trim();if(!line)continue;if(line.startsWith('#EXTINF')){const comma=line.indexOf(','),name=comma>=0?line.slice(comma+1).trim():'Live Channel',gm=line.match(/group-title="([^"]*)"/i),lm=line.match(/tvg-logo="([^"]*)"/i);meta={name:name||'Live Channel',category:gm?gm[1]:'Other',logo:lm?lm[1]:''};continue}if(line.startsWith('#'))continue;if(meta){if(/^(https?|rtmp|rtsp|hls):\/\//i.test(line))out.push(norm({...meta,url:line,status:'Unknown'}));meta=null}}return out}
async function readState(env){const raw=await kv(env).get(STATE_KEY);if(!raw)return{channels:[],notice:{text:'',type:'Information',enabled:true},headline:''};try{return JSON.parse(raw)}catch{return{channels:[],notice:{},headline:''}}}
async function saveState(env,state){await kv(env).put(STATE_KEY,JSON.stringify(state))}
async function readDevices(env){const raw=await kv(env).get(DEVICES_KEY);try{return raw?JSON.parse(raw):[]}catch{return[]}}
async function saveDevices(env,list){await kv(env).put(DEVICES_KEY,JSON.stringify(list))}
async function readSettings(env){const raw=await kv(env).get(SETTINGS_KEY);try{return raw?JSON.parse(raw):{deviceLimit:1,accessMode:'approval'}}catch{return{deviceLimit:1,accessMode:'approval'}}}
function cookies(request){const raw=request.headers.get('Cookie')||'',out={};raw.split(';').forEach(p=>{const i=p.indexOf('=');if(i>0)out[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim())});return out}
async function authorized(request,env){const expected=adminPassword(env);if(!expected)return false;const c=cookies(request),token=c.VIP_ADMIN_SESSION;if(token){const ok=await kv(env).get(SESSION_PREFIX+token);if(ok)return true}const auth=request.headers.get('Authorization')||'';return auth===`Bearer ${expected}`}
async function requireAdmin(request,env){if(!(await authorized(request,env)))return json({ok:false,error:'Unauthorized'},401);return null}
function userCookie(token){return `VIP_USER_SESSION=${encodeURIComponent(token)}; Max-Age=${USER_SESSION_TTL}; Path=/; HttpOnly; Secure; SameSite=Lax`}
async function userSession(request,env){const token=cookies(request).VIP_USER_SESSION;if(!token)return null;const raw=await kv(env).get(USER_SESSION_PREFIX+token);if(!raw)return null;try{return JSON.parse(raw)}catch{return null}}
async function hashPassword(password){const data=new TextEncoder().encode(String(password));const digest=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function m3u(channels){return '#EXTM3U\n'+channels.map(c=>`#EXTINF:-1 tvg-logo="${String(c.logo||'').replace(/"/g,'&quot;')}" group-title="${String(c.category||'Other').replace(/"/g,'&quot;')}",${String(c.name||'Channel').replace(/\n/g,' ')}\n${c.url}`).join('\n')}
async function blockedDevice(env,id){if(!id)return null;const list=await readDevices(env);return list.find(x=>x.deviceId===id&&((x.status||'').toLowerCase()==='blocked'||x.blocked===true))||null}
async function handleApi(request,env){const url=new URL(request.url),path=url.pathname;if(request.method==='OPTIONS')return withCors(new Response(null,{status:204}),request);
  if(path==='/api/admin/login'&&request.method==='POST'){const b=await request.json().catch(()=>({})),password=String(b.password||'');if(!adminPassword(env)||password!==adminPassword(env))return withCors(json({ok:false,error:'Unauthorized'},401),request);const token=crypto.randomUUID();await kv(env).put(SESSION_PREFIX+token,'1',{expirationTtl:SESSION_TTL});return withCors(json({ok:true,expiresIn:SESSION_TTL},200,{'Set-Cookie':`VIP_ADMIN_SESSION=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL}; Path=/; HttpOnly; Secure; SameSite=Lax`}),request)}
  if(path==='/api/admin/session'&&request.method==='GET'){if(await authorized(request,env))return withCors(json({ok:true,expiresIn:SESSION_TTL}),request);return withCors(json({ok:false,error:'Unauthorized'},401),request)}
  if(path==='/api/admin/logout'&&request.method==='POST'){const c=cookies(request),token=c.VIP_ADMIN_SESSION;if(token)await kv(env).delete(SESSION_PREFIX+token);return withCors(json({ok:true},200,{'Set-Cookie':'VIP_ADMIN_SESSION=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax'}),request)}
  if(request.method==='GET'&&path==='/api/state'){
    const us=await userSession(request,env);if(!us)return withCors(json({ok:false,error:'Login required',reason:'login_required'},401),request);
    const list=await readDevices(env),d=list.find(x=>x.deviceId===us.deviceId);
    if(!d)return withCors(json({ok:false,error:'Login required',reason:'removed'},401),request);
    if(d.status==='Blocked'||d.blocked===true)return withCors(json({ok:false,error:'Your device has been blocked',reason:'blocked'},403),request);
    d.lastSeen=new Date().toISOString();await saveDevices(env,list);
    const s=await readState(env);
    return withCors(json({channels:s.channels||[],categories:Array.isArray(s.categories)?s.categories:[],notice:s.notice||{},headline:s.headline||'',settings:await readSettings(env)}),request);
  }
  if(request.method==='GET'&&path==='/api/playlist'){
    const us=await userSession(request,env);if(!us)return withCors(json({ok:false,error:'Login required',reason:'login_required'},401),request);
    const list=await readDevices(env),d=list.find(x=>x.deviceId===us.deviceId);
    if(!d)return withCors(json({ok:false,error:'Login required',reason:'removed'},401),request);
    if(d.status==='Blocked'||d.blocked===true)return withCors(json({ok:false,error:'Your device has been blocked',reason:'blocked'},403),request);
    const s=await readState(env);return withCors(json({channels:s.channels||[],categories:Array.isArray(s.categories)?s.categories:[]}),request);
  }
  if(path==='/api/user/session'&&request.method==='GET'){
    const s=await userSession(request,env); if(!s)return withCors(json({ok:false,loggedIn:false},401),request);
    const list=await readDevices(env),d=list.find(x=>x.deviceId===s.deviceId);
    if(!d)return withCors(json({ok:false,loggedIn:false,reason:'removed'},401),request);
    if(d.status==='Blocked'||d.blocked===true)return withCors(json({ok:false,loggedIn:false,reason:'blocked',message:'Your device has been blocked'},403),request);
    d.lastSeen=new Date().toISOString();await saveDevices(env,list);
    return withCors(json({ok:true,loggedIn:true,user:{name:d.userName||'',deviceName:d.name||'',deviceId:d.deviceId}}),request);
  }
  if(path==='/api/user/login'&&request.method==='POST'){
    const b=await request.json().catch(()=>({})),
      userName=String(b.name||'').trim().slice(0,60),
      password=String(b.password||''),
      deviceId=String(b.deviceId||'').trim().slice(0,100),
      deviceName=String(b.deviceName||'').trim().slice(0,80)||'My Device';
    if(userName.length<1||password.length<1||!deviceId)return withCors(json({ok:false,error:'Username, password and device name are required'},400),request);
    const list=await readDevices(env);let d=list.find(x=>x.deviceId===deviceId);
    if(d&&(d.status==='Blocked'||d.blocked===true))return withCors(json({ok:false,error:'Your device has been blocked',reason:'blocked'},403),request);
    const passwordHash=await hashPassword(password),now=new Date().toISOString();
    if(d){
      if(d.userName&&d.userName!==userName)return withCors(json({ok:false,error:'Username does not match this device account'},401),request);
      if(d.passwordHash&&d.passwordHash!==passwordHash)return withCors(json({ok:false,error:'Incorrect password'},401),request);
      d.name=deviceName||d.name||'My Device';d.lastSeen=now;d.lastLogin=now;d.status='Logged in';d.approved=true;
      d.userAgent=String(b.userAgent||request.headers.get('user-agent')||'').slice(0,200);
    }else{
      d={deviceId,name:deviceName,userName,passwordHash,userAgent:String(b.userAgent||request.headers.get('user-agent')||'').slice(0,200),approved:true,status:'Logged in',createdAt:now,lastSeen:now,lastLogin:now};
      list.push(d);
    }
    await saveDevices(env,list);
    const token=crypto.randomUUID();await kv(env).put(USER_SESSION_PREFIX+token,JSON.stringify({deviceId:d.deviceId,userName:d.userName}),{expirationTtl:USER_SESSION_TTL});
    return withCors(json({ok:true,user:{name:d.userName,deviceName:d.name,lastLogin:d.lastLogin}},200,{'Set-Cookie':userCookie(token)}),request);
  }
  if(path==='/api/user/logout'&&request.method==='POST'){const t=cookies(request).VIP_USER_SESSION;if(t)await kv(env).delete(USER_SESSION_PREFIX+t);return withCors(json({ok:true},200,{'Set-Cookie':'VIP_USER_SESSION=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax'}),request)}
  if(path==='/api/device/register'&&request.method==='POST'){
    return withCors(json({ok:false,approved:false,error:'Login required',reason:'login_required'},401),request);
  }
  if(path==='/api/device/check'&&request.method==='GET'){
    const id=url.searchParams.get('deviceId')||request.headers.get('X-ViP-Device-ID')||'',devices=await readDevices(env),d=devices.find(x=>x.deviceId===id),blocked=!!d&&(d.status==='Blocked'||d.blocked===true);
    return withCors(json({ok:true,approved:!!d?.approved&&!blocked,blocked,device:d||null,settings:await readSettings(env)}),request);
  }
  const guard=await requireAdmin(request,env);if(guard)return withCors(guard,request);
  if(path==='/api/admin/ping'&&request.method==='GET')return withCors(json({ok:true,connected:true}),request);
  if(path==='/api/admin/state'&&request.method==='GET')return withCors(json({ok:true,state:await readState(env)}),request);
  if(path==='/api/admin/state'&&request.method==='PUT'){const b=await request.json().catch(()=>({})),old=await readState(env),state={...old,...b,channels:Array.isArray(b.channels)?b.channels.map(norm):old.channels||[]};await saveState(env,state);return withCors(json({ok:true,state}),request)}
  if(path==='/api/admin/playlist'&&request.method==='GET'){const s=await readState(env);return withCors(json({ok:true,channels:s.channels||[]}),request)}
  if(path==='/api/admin/playlist'&&request.method==='PUT'){const b=await request.json().catch(()=>({})),channels=Array.isArray(b.channels)?b.channels.map(norm):[],s=await readState(env);s.channels=channels;await saveState(env,s);return withCors(json({ok:true,count:channels.length}),request)}
  if(path==='/api/admin/import-m3u'&&request.method==='POST'){const ct=request.headers.get('content-type')||'';let text='';if(ct.includes('application/json')){const b=await request.json();text=String(b.text||b.m3u||'')}else text=await request.text();const channels=parseM3U(text),s=await readState(env);s.channels=channels;await saveState(env,s);return withCors(json({ok:true,count:channels.length}),request)}
  if(path==='/api/admin/import-m3u-url'&&request.method==='POST'){const b=await request.json().catch(()=>({})),target=String(b.url||'');if(!/^https?:\/\//i.test(target))return withCors(json({ok:false,error:'Invalid M3U URL'},400),request);const r=await fetch(target,{redirect:'follow'});if(!r.ok)return withCors(json({ok:false,error:`M3U URL HTTP ${r.status}`},400),request);const channels=parseM3U(await r.text()),s=await readState(env);s.channels=channels;await saveState(env,s);return withCors(json({ok:true,count:channels.length}),request)}
  if(path==='/api/xtream/import'&&request.method==='POST'){const b=await request.json().catch(()=>({})),server=String(b.server||'').replace(/\/$/,''),user=String(b.username||''),pass=String(b.password||'');if(!server||!user||!pass)return withCors(json({ok:false,error:'server, username and password required'},400),request);const apiUrl=server+'/player_api.php?username='+encodeURIComponent(user)+'&password='+encodeURIComponent(pass)+'&action=get_live_streams',r=await fetch(apiUrl);if(!r.ok)return withCors(json({ok:false,error:`Xtream HTTP ${r.status}`},400),request);const data=await r.json();if(!Array.isArray(data))return withCors(json({ok:false,error:'Xtream returned invalid data'},400),request);const lim=String(b.limit||'all'),items=lim==='all'?data:data.slice(0,Number(lim)||100),base=server+'/live/'+encodeURIComponent(user)+'/'+encodeURIComponent(pass)+'/',channels=items.map(x=>norm({name:x.name||('Channel '+x.stream_id),category:x.category_name||'Other',logo:x.stream_icon||'',url:base+encodeURIComponent(String(x.stream_id))+'.m3u8',status:'Unknown'})),s=await readState(env);s.channels=channels;await saveState(env,s);return withCors(json({ok:true,count:channels.length}),request)}
  if(path==='/api/admin/check-all'&&request.method==='POST'){const s=await readState(env),channels=s.channels||[],checked=await Promise.all(channels.map(async c=>{try{const r=await fetch(c.url,{method:'GET',redirect:'follow'});return{...c,status:r.ok?'Active':'Dead'}}catch{return{...c,status:'Dead'}}}));s.channels=checked;await saveState(env,s);return withCors(json({ok:true,count:checked.length,channels:checked}),request)}
  if(path==='/api/admin/settings'&&request.method==='GET')return withCors(json({ok:true,settings:await readSettings(env)}),request);
  if(path==='/api/admin/settings'&&request.method==='PUT'){const b=await request.json().catch(()=>({})),s={...(await readSettings(env)),...b};await kv(env).put(SETTINGS_KEY,JSON.stringify(s));return withCors(json({ok:true,settings:s}),request)}
  if(path==='/api/admin/devices'&&request.method==='GET'){const devices=await readDevices(env);devices.sort((a,b)=>new Date(b.lastLogin||b.lastSeen||b.createdAt||0)-new Date(a.lastLogin||a.lastSeen||a.createdAt||0));return withCors(json({ok:true,devices,settings:await readSettings(env)}),request)}
  if(path==='/api/admin/devices/approve'&&request.method==='POST'){const b=await request.json().catch(()=>({})),id=String(b.deviceId||''),list=await readDevices(env),d=list.find(x=>x.deviceId===id);if(!d)return withCors(json({ok:false,error:'Device not found'},404),request);if(d.status==='Blocked'||d.blocked===true)return withCors(json({ok:false,error:'Device is blocked. Use Unblock first.'},409),request);d.approved=true;d.status='Approved';await saveDevices(env,list);return withCors(json({ok:true,device:d}),request)}
  if(path==='/api/admin/devices/approve-all'&&request.method==='POST'){const list=await readDevices(env);list.forEach(d=>{if(d.status!=='Blocked'&&d.blocked!==true){d.approved=true;d.status='Approved'}});await saveDevices(env,list);return withCors(json({ok:true,count:list.length}),request)}
  if(path==='/api/admin/devices/logout-all'&&request.method==='POST'){const list=await readDevices(env);list.forEach(d=>{if(d.status!=='Blocked'&&d.blocked!==true){d.approved=false;d.status='Logged out'}});await saveDevices(env,list);return withCors(json({ok:true}),request)}
  if(path==='/api/admin/devices/block'&&request.method==='POST'){const b=await request.json().catch(()=>({})),id=String(b.deviceId||''),list=await readDevices(env),d=list.find(x=>x.deviceId===id);if(!d)return withCors(json({ok:false,error:'Device not found'},404),request);d.blocked=true;d.approved=false;d.status='Blocked';d.blockedAt=new Date().toISOString();await saveDevices(env,list);return withCors(json({ok:true,device:d,message:'Your device has been blocked'}),request)}
  if(path==='/api/admin/devices/unblock'&&request.method==='POST'){const b=await request.json().catch(()=>({})),id=String(b.deviceId||''),list=await readDevices(env),d=list.find(x=>x.deviceId===id);if(!d)return withCors(json({ok:false,error:'Device not found'},404),request);d.blocked=false;d.approved=true;d.status='Approved';d.unblockedAt=new Date().toISOString();await saveDevices(env,list);return withCors(json({ok:true,device:d}),request)}
  if(path==='/api/admin/devices'&&request.method==='PUT'){const b=await request.json().catch(()=>({})),list=await readDevices(env),id=String(b.deviceId||''),d=list.find(x=>x.deviceId===id);if(!d)return withCors(json({ok:false,error:'Device not found'},404),request);if(b.status==='Blocked'||b.blocked===true){d.blocked=true;d.approved=false;d.status='Blocked';d.blockedAt=new Date().toISOString()}else if(b.blocked===false){d.blocked=false;Object.assign(d,b);d.status=b.status||'Approved'}else{if(d.status==='Blocked'||d.blocked===true)return withCors(json({ok:false,error:'Device is blocked. Use Unblock first.'},409),request);Object.assign(d,b)}await saveDevices(env,list);return withCors(json({ok:true,device:d}),request)}
  if(path==='/api/admin/devices'&&request.method==='DELETE'){const id=url.searchParams.get('deviceId')||'',list=(await readDevices(env)).filter(x=>x.deviceId!==id);await saveDevices(env,list);return withCors(json({ok:true}),request)}
  if(path==='/api/admin/export-m3u'&&request.method==='GET'){const s=await readState(env);const h=new Headers({'content-type':'audio/x-mpegurl','cache-control':'no-store'});const origin=request.headers.get('Origin');h.set('access-control-allow-origin',origin||new URL(request.url).origin);Object.entries(corsBase).forEach(([k,v])=>h.set(k,v));return new Response(m3u(s.channels||[]),{headers:h})}
  return withCors(json({ok:false,error:'API route not found'},404),request)}
const TV_AUTH_SCRIPT=String.raw`<style id="vip-auth-style">
#vipAuthOverlay{position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,5,12,.94);backdrop-filter:blur(10px);font-family:Arial,sans-serif}
#vipAuthOverlay.vip-show{display:flex}
#vipAuthCard{width:min(440px,94vw);max-height:92vh;overflow:auto;border:1px solid rgba(0,174,255,.45);border-radius:24px;padding:24px;background:linear-gradient(180deg,#061725,#03101a);box-shadow:0 0 40px rgba(0,174,255,.18);color:#fff}
#vipAuthLogo{display:block;width:70px;height:70px;border-radius:18px;object-fit:cover;margin:0 auto 12px}
#vipAuthTitle{text-align:center;margin:0 0 8px;font-size:25px;font-weight:800;letter-spacing:.4px}
#vipAuthWelcome{text-align:center;line-height:1.55;color:#cfe7f5;font-size:13px}
#vipAuthWelcome .line{display:block;margin:3px 0}
#vipAuthCreator{text-align:center;line-height:1.5;color:#8fc9e8;font-size:12px;margin:12px 0 18px}
#vipAuthForm label{display:block;font-size:12px;color:#8fc9e8;margin:10px 0 6px}
#vipAuthForm input{width:100%;box-sizing:border-box;padding:13px 14px;border-radius:12px;border:1px solid rgba(0,174,255,.3);background:#071d2b;color:#fff;outline:none}
#vipAuthForm button{width:100%;margin-top:16px;padding:13px;border:0;border-radius:12px;background:#08a9ff;color:#00111d;font-weight:800;font-size:15px}
#vipAuthStatus{text-align:center;min-height:20px;margin-top:10px;color:#ff8b8b;font-size:12px}
body.vip-auth-locked{overflow:hidden}
</style>
<div id="vipAuthOverlay" aria-modal="true" role="dialog">
<div id="vipAuthCard">
<img id="vipAuthLogo" src="https://i.postimg.cc/fWC0JfBr/FB-IMG-1788617876279.jpg" alt="VIP-NETWORK.TV">
<h2 id="vipAuthTitle">VIP-NETWORK.TV</h2>
<div id="vipAuthWelcome">
<span class="line">🔥 বিনোদনের নতুন ঠিকানা—VIP-Network.TV! 🔥</span>
<span class="line">আপনার প্রিয় অনুষ্ঠান, খেলাধুলা, খবর ও জমজমাট বিনোদনের সব আয়োজন নিয়ে সবসময় আপনার পাশে। আজই যুক্ত হোন VIP-Network.TV-এর সঙ্গে এবং উপভোগ করুন বিনোদনের এক নতুন, রোমাঞ্চকর জগৎ! ✨</span>
</div>
<div id="vipAuthCreator">💻 VIP-Network.TV সফটওয়্যারটি তৈরি করেছেন মাসুম—তার সৃজনশীলতা ও পরিশ্রমেই প্রযুক্তির সাথে বিনোদনের এই সুন্দর সংযোগ। ✨</div>
<form id="vipAuthForm">
<label>Username</label><input id="vipAuthName" autocomplete="username" required maxlength="60">
<label>Password</label><input id="vipAuthPassword" type="password" autocomplete="current-password" required maxlength="200">
<label>Device Name</label><input id="vipAuthDevice" autocomplete="off" maxlength="80" required>
<button type="submit">Login</button>
<div id="vipAuthStatus"></div>
</form>
</div>
</div>
<script>
(()=>{const K='vip_device_id_v1';let deviceId=localStorage.getItem(K);if(!deviceId){deviceId=crypto.randomUUID?crypto.randomUUID():'vip-'+Date.now()+'-'+Math.random().toString(36).slice(2);localStorage.setItem(K,deviceId)}
const overlay=()=>document.getElementById('vipAuthOverlay'),status=t=>{const e=document.getElementById('vipAuthStatus');if(e)e.textContent=t||''};
const lock=()=>{overlay()?.classList.add('vip-show');document.body.classList.add('vip-auth-locked')},unlock=()=>{overlay()?.classList.remove('vip-show');document.body.classList.remove('vip-auth-locked')};
async function check(){try{const r=await fetch('/api/user/session',{credentials:'include',cache:'no-store'});if(r.ok){unlock();return true}lock();return false}catch(e){lock();status('Internet connection required.');return false}}
document.addEventListener('DOMContentLoaded',async()=>{const f=document.getElementById('vipAuthForm'),dev=document.getElementById('vipAuthDevice');if(dev)dev.value=localStorage.getItem('vip_device_name_v1')||((navigator.platform||'Device')+' device');if(f)f.addEventListener('submit',async e=>{e.preventDefault();status('Logging in…');try{const body={name:document.getElementById('vipAuthName').value.trim(),password:document.getElementById('vipAuthPassword').value,deviceId,deviceName:dev.value.trim(),userAgent:navigator.userAgent};const r=await fetch('/api/user/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(body)}),d=await r.json().catch(()=>({}));if(!r.ok){status(d.error||'Login failed');return}localStorage.setItem('vip_device_name_v1',body.deviceName);unlock();location.reload()}catch(err){status('Login failed. Please try again.')}});check()});
window.VIPUserAuth={check,logout:async()=>{await fetch('/api/user/logout',{method:'POST',credentials:'include'});lock()}};
})();</script>`;
async function serveAsset(request,env){
const resp=await env.ASSETS.fetch(request),ct=resp.headers.get('content-type')||'';
if(!ct.includes('text/html'))return resp;
const text=await resp.text();if(text.includes('id="vipAuthOverlay"'))return new Response(text,{status:resp.status,headers:resp.headers});
const html=text.replace(/<\/body>/i,TV_AUTH_SCRIPT+'\n</body>'),headers=new Headers(resp.headers);headers.set('cache-control','no-store');
return new Response(html,{status:resp.status,statusText:resp.statusText,headers});
}
export default{async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return handleApi(request,env);return serveAsset(request,env)}};
