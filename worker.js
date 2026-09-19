const STATE_KEY='vip_state_v1';
const DEVICES_KEY='vip_devices_v1';
const SETTINGS_KEY='vip_settings_v1';
const USERS_KEY='vip_users_v1';
const ONLINE_KEY='vip_online_v1';
const ADMIN_SESSION_PREFIX='vip_admin_session:';
const USER_SESSION_PREFIX='vip_user_session:';
const ADMIN_TTL=1800;
const USER_TTL=60*60*24*30;

const adminPassword=e=>e.ADMIN_PASSWORD||e.ADMIN_PASSWOED||'';
const kv=e=>e.VIP_PLAYLIST||e.PLAYLIST_KV;
const cors={
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers':'Content-Type, Authorization, X-ViP-Device-ID'
};
const json=(d,s=200,x={})=>{
  const h=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store',...(x.headers||{})});
  return new Response(JSON.stringify(d),{status:s,headers:h});
};
const withCors=r=>{const h=new Headers(r.headers);for(const[k,v]of Object.entries(cors))h.set(k,v);return new Response(r.body,{status:r.status,headers:h});};
function cookies(r){const o={};(r.headers.get('Cookie')||'').split(';').forEach(p=>{const i=p.indexOf('=');if(i>0)o[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim())});return o;}
function normalizeCategory(name='',group=''){
  const t=`${name} ${group}`.toLowerCase();
  if(/new\s*style|newstyle/.test(t))return 'NEW STYLE';
  if(/movie|movies|film|series|web\s*series|ott|cinema|flix/.test(t))return 'MOVIE & SERIES';
  if(/sport|cricket|football|fifa|espn|bein|wwe|golf|nfl|nba|ten\s*cricket|ptv\s*sports/.test(t))return 'SPORTS';
  if(/bangladesh|\bbd\b|bangla|somoy|jamuna|ekattor|dbc|maasranga|atn|channel\s*24|news24|independent|ntv|rtv|banglavision|boishakhi|gazi\s*tv|btv|duronto|deepto|nagorik|mohona|asian\s*tv|desh\s*tv|bijoy\s*tv|mytv|satv|ekushey/.test(t))return 'BD';
  if(/india|indian|sony|zee|star|colors|set\b|sab\b|aaj\s*tak|ndtv|republic|news18|times\s*now|india\s*tv|dd\s*(national|sports)|sun\s*tv|asianet|vijay|jaya|starplus|star\s*gold|sony\s*(max|pix|wah|yay|pal)|&pictures|b4u|movies\s*now|mnx|hbo\s*india/.test(t))return 'INDIA';
  return 'OTHER';
}
function norm(c={}){return{name:String(c.name||c.title||'Unnamed'),category:normalizeCategory(c.name||c.title||'',c.category||c.group||c.groupTitle||''),logo:String(c.logo||c.tvgLogo||c['tvg-logo']||''),url:String(c.url||c.stream||c.streamUrl||''),status:String(c.status||'Unknown')}}
function defaultState(){return{channels:[],categories:['ALL','NEW STYLE','SPORTS','BD','INDIA','OTHER','MOVIE & SERIES'],notice:{text:'',type:'Information',enabled:true},headline:''};}
async function readState(e){try{const r=await kv(e).get(STATE_KEY);if(!r)return defaultState();const s=JSON.parse(r);return{...defaultState(),...s,channels:Array.isArray(s.channels)?s.channels.map(norm):[],categories:Array.isArray(s.categories)&&s.categories.length?s.categories:defaultState().categories}}catch{return defaultState()}}
async function saveState(e,s){const state={...defaultState(),...s,channels:Array.isArray(s.channels)?s.channels.map(norm):[],categories:Array.isArray(s.categories)?s.categories:defaultState().categories};await kv(e).put(STATE_KEY,JSON.stringify(state));return state;}
async function readDevices(e){try{return JSON.parse((await kv(e).get(DEVICES_KEY))||'[]')}catch{return[]}}
async function saveDevices(e,x){await kv(e).put(DEVICES_KEY,JSON.stringify(x))}
async function readSettings(e){try{return JSON.parse((await kv(e).get(SETTINGS_KEY))||'{"deviceLimit":1,"accessMode":"approval"}')}catch{return{deviceLimit:1,accessMode:'approval'}}}
async function readUsers(e){try{return JSON.parse((await kv(e).get(USERS_KEY))||'[]')}catch{return[]}}
async function saveUsers(e,x){await kv(e).put(USERS_KEY,JSON.stringify(x))}
async function readOnline(e){try{return JSON.parse((await kv(e).get(ONLINE_KEY))||'{}')}catch{return{}}}
async function saveOnline(e,x){await kv(e).put(ONLINE_KEY,JSON.stringify(x),{expirationTtl:120})}
function cleanOnline(x,now=Date.now()){const out={};for(const[k,v]of Object.entries(x||{})){if(typeof v==='number'&&now-v<60000)out[k]=v}return out}
async function hash(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function token(){return crypto.randomUUID()}
async function deviceBlocked(e,id){if(!id)return false;const d=(await readDevices(e)).find(x=>x.deviceId===id);return !!d?.blocked}
async function authorized(r,e){const p=adminPassword(e),c=cookies(r),t=c.VIP_ADMIN_SESSION;if(!p)return false;if(t&&await kv(e).get(ADMIN_SESSION_PREFIX+t))return true;return r.headers.get('Authorization')===`Bearer ${p}`}
async function requireAdmin(r,e){return(await authorized(r,e))?null:json({ok:false,error:'Unauthorized'},401)}
function parseM3U(t){const a=String(t||'').replace(/\r/g,'').split('\n'),o=[];let m=null;for(const q of a){const l=q.trim();if(l.startsWith('#EXTINF')){const c=l.indexOf(','),gm=l.match(/group-title="([^"]*)"/i),lm=l.match(/tvg-logo="([^"]*)"/i);m={name:c>=0?l.slice(c+1).trim():'Live Channel',group:gm?gm[1]:'',logo:lm?lm[1]:''};continue}if(l&&!l.startsWith('#')&&m){if(/^(https?|rtmp|rtsp|hls):\/\//i.test(l))o.push(norm({...m,url:l,status:'Active'}));m=null}}return o}
function safeServer(s){return String(s||'').trim().replace(/\/$/,'')}
async function fetchXtream(server,username,password,limit){
  const base=safeServer(server);if(!/^https?:\/\//i.test(base))throw new Error('Invalid Xtream server URL');
  const apiUrl=base+'/player_api.php?'+new URLSearchParams({username,password,action:'get_live_streams'}).toString();
  const r=await fetch(apiUrl,{headers:{accept:'application/json'},redirect:'follow'});if(!r.ok)throw new Error('Xtream server returned HTTP '+r.status);
  const data=await r.json().catch(()=>null);if(!Array.isArray(data))throw new Error('Invalid Xtream response');
  const max=limit==='all'?data.length:Math.max(0,Number(limit)||data.length);
  const ext=(x)=>String(x.container_extension||'ts').replace(/[^a-z0-9]/gi,'')||'ts';
  return data.slice(0,max).map(x=>norm({name:x.name||'Live Channel',group:x.category_name||'',logo:x.stream_icon||'',url:x.stream_url||`${base}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${x.stream_id}.${ext(x)}`,status:'Active'})).filter(x=>x.url);
}
async function userSession(r,e){const t=cookies(r).VIP_USER_SESSION;if(!t)return null;const raw=await kv(e).get(USER_SESSION_PREFIX+t);if(!raw)return null;try{return{token:t,...JSON.parse(raw)}}catch{return null}}
async function handle(r,e){
  const u=new URL(r.url),p=u.pathname;if(r.method==='OPTIONS')return withCors(new Response(null,{status:204}));
  if(p==='/api/online/ping'&&r.method==='POST'){const b=await r.json().catch(()=>({})),id=String(b.id||'').slice(0,160);if(!id)return withCors(json({ok:false,error:'id required'},400));const now=Date.now(),online=cleanOnline(await readOnline(e),now);online[id]=now;await saveOnline(e,online);return withCors(json({ok:true,online:Object.keys(online).length}))}
  if(p==='/api/online'&&r.method==='GET'){const raw=await readOnline(e),online=cleanOnline(raw);if(Object.keys(raw).length!==Object.keys(online).length)await saveOnline(e,online);return withCors(json({ok:true,online:Object.keys(online).length}))}

  if(p==='/api/user/login'&&r.method==='POST'){
    const b=await r.json().catch(()=>({}));
    const username=String(b.username||b.name||'').trim().slice(0,100);
    const number=String(b.number||b.phone||'').replace(/\s+/g,'').trim().slice(0,40);
    const deviceId=String(b.deviceId||r.headers.get('X-ViP-Device-ID')||'').slice(0,160);
    const deviceName=String(b.deviceName||'Unknown device').trim().slice(0,100);
    if(username.length<2)return withCors(json({ok:false,error:'নাম কমপক্ষে ২ অক্ষরের হতে হবে'},400));
    if(!/^\+?[0-9]{6,20}$/.test(number))return withCors(json({ok:false,error:'সঠিক নাম্বার দিন (কমপক্ষে ৬ সংখ্যা)'},400));
    if(await deviceBlocked(e,deviceId))return withCors(json({ok:false,error:'এই ডিভাইসটি ব্লক করা হয়েছে',blocked:true},403));
    const users=await readUsers(e);let user=users.find(x=>String(x.username||'').toLowerCase()===username.toLowerCase());
    let created=false;
    if(!user){const salt=crypto.randomUUID();user={id:crypto.randomUUID(),username,numberHash:await hash(salt+number),numberSalt:salt,createdAt:new Date().toISOString(),lastLoginAt:null,lastDeviceId:null,lastDeviceName:'',activeSessionToken:null,activeDeviceId:null};users.push(user);created=true;}
    else if(user.numberHash){const ok=user.numberHash===await hash(String(user.numberSalt||'')+number);if(!ok)return withCors(json({ok:false,error:'নাম অথবা নাম্বার সঠিক নয়'},401));}
    else return withCors(json({ok:false,error:'এই অ্যাকাউন্টে এখনো নাম্বার সেট করা হয়নি। Admin থেকে Set Number করুন।',needsNumber:true},409));
    if(user.activeSessionToken){const active=await kv(e).get(USER_SESSION_PREFIX+user.activeSessionToken);if(active){let a={};try{a=JSON.parse(active)}catch{}if(a.deviceId&&deviceId&&a.deviceId!==deviceId)return withCors(json({ok:false,error:'এই অ্যাকাউন্ট অন্য একটি ডিভাইসে লগইন করা আছে। আগে Logout করুন।',alreadyLoggedIn:true},409));await kv(e).delete(USER_SESSION_PREFIX+user.activeSessionToken);}}
    const now=new Date().toISOString();user.lastLoginAt=now;user.lastDeviceId=deviceId||null;user.lastDeviceName=deviceName;const t=token();user.activeSessionToken=t;user.activeDeviceId=deviceId||null;await saveUsers(e,users);
    if(deviceId){const ds=await readDevices(e);let d=ds.find(x=>x.deviceId===deviceId);if(d?.blocked)return withCors(json({ok:false,error:'এই ডিভাইসটি ব্লক করা হয়েছে',blocked:true},403));if(!d){d={deviceId,name:deviceName,userAgent:r.headers.get('user-agent')||'',approved:true,blocked:false,status:'Logged in',createdAt:now,lastSeen:now,username:user.username};ds.push(d)}else{d.name=deviceName||d.name;d.username=user.username;d.lastSeen=now;d.status='Logged in';d.approved=true}await saveDevices(e,ds)}
    await kv(e).put(USER_SESSION_PREFIX+t,JSON.stringify({userId:user.id,username:user.username,deviceId}),{expirationTtl:USER_TTL});
    return withCors(json({ok:true,created,username:user.username},200,{headers:{'Set-Cookie':`VIP_USER_SESSION=${encodeURIComponent(t)}; Max-Age=${USER_TTL}; Path=/; HttpOnly; Secure; SameSite=Lax`}}));
  }
  if(p==='/api/user/session'&&r.method==='GET'){const s=await userSession(r,e);if(!s)return withCors(json({ok:false,error:'Unauthorized'},401));if(await deviceBlocked(e,s.deviceId))return withCors(json({ok:false,error:'Blocked',blocked:true},403));return withCors(json({ok:true,loggedIn:true,username:s.username}))}
  if(p==='/api/user/logout'&&r.method==='POST'){
    const t=cookies(r).VIP_USER_SESSION,s=await userSession(r,e);if(t)await kv(e).delete(USER_SESSION_PREFIX+t);
    if(s){const users=await readUsers(e),u0=users.find(x=>x.id===s.userId);if(u0&&u0.activeSessionToken===t){u0.activeSessionToken=null;u0.activeDeviceId=null;await saveUsers(e,users)}if(s.deviceId){const ds=await readDevices(e),d=ds.find(x=>x.deviceId===s.deviceId);if(d){d.status='Logged out';d.lastSeen=new Date().toISOString();await saveDevices(e,ds)}}}
    return withCors(json({ok:true},200,{headers:{'Set-Cookie':'VIP_USER_SESSION=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax'}}));
  }
  if(p==='/api/admin/login'&&r.method==='POST'){const b=await r.json().catch(()=>({}));if(!adminPassword(e)||String(b.password||'')!==adminPassword(e))return withCors(json({ok:false,error:'Unauthorized'},401));const t=token();await kv(e).put(ADMIN_SESSION_PREFIX+t,'1',{expirationTtl:ADMIN_TTL});return withCors(json({ok:true,expiresIn:ADMIN_TTL},200,{headers:{'Set-Cookie':`VIP_ADMIN_SESSION=${t}; Max-Age=${ADMIN_TTL}; Path=/; HttpOnly; Secure; SameSite=Lax`}}))}
  if(p==='/api/admin/session'&&r.method==='GET')return withCors((await authorized(r,e))?json({ok:true,expiresIn:ADMIN_TTL}):json({ok:false,error:'Unauthorized'},401));
  if(p==='/api/admin/logout'&&r.method==='POST'){const t=cookies(r).VIP_ADMIN_SESSION;if(t)await kv(e).delete(ADMIN_SESSION_PREFIX+t);return withCors(json({ok:true},200,{headers:{'Set-Cookie':'VIP_ADMIN_SESSION=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax'}}))}
  if(r.method==='GET'&&p==='/api/state'){const s=await readState(e);return withCors(json({channels:s.channels||[],categories:s.categories||[],notice:s.notice||{},headline:s.headline||''}))}
  if(r.method==='GET'&&p==='/api/playlist'){const s=await readState(e);return withCors(json({channels:s.channels||[],categories:s.categories||[]}))}
  if(p==='/api/device/register'&&r.method==='POST'){const b=await r.json().catch(()=>({})),id=String(b.deviceId||r.headers.get('X-ViP-Device-ID')||'');if(!id)return withCors(json({ok:false,error:'deviceId required'},400));const ds=await readDevices(e);let d=ds.find(x=>x.deviceId===id);if(d?.blocked)return withCors(json({ok:false,error:'Blocked',blocked:true},403));if(!d){d={deviceId:id,name:String(b.name||'Unknown device'),userAgent:String(b.userAgent||r.headers.get('user-agent')||'').slice(0,200),approved:false,blocked:false,createdAt:new Date().toISOString(),lastSeen:new Date().toISOString()};ds.push(d)}else d.lastSeen=new Date().toISOString();await saveDevices(e,ds);return withCors(json({ok:true,device:d,settings:await readSettings(e)}))}
  if(p==='/api/device/check'&&r.method==='GET'){const id=u.searchParams.get('deviceId')||r.headers.get('X-ViP-Device-ID')||'',d=(await readDevices(e)).find(x=>x.deviceId===id);if(d?.blocked)return withCors(json({ok:false,approved:false,blocked:true,device:d,settings:await readSettings(e)},403));return withCors(json({ok:true,approved:!!d?.approved,device:d||null,settings:await readSettings(e)}))}

  const g=await requireAdmin(r,e);if(g)return withCors(g);
  if(p==='/api/admin/ping'&&r.method==='GET')return withCors(json({ok:true,connected:true}));
  if(p==='/api/admin/state'&&r.method==='GET')return withCors(json({ok:true,state:await readState(e)}));
  if(p==='/api/admin/state'&&r.method==='PUT'){const b=await r.json().catch(()=>({})),old=await readState(e),s={...old,...b};if(Array.isArray(b.channels))s.channels=b.channels.map(norm);if(Array.isArray(b.categories))s.categories=b.categories.map(x=>String(x).trim()).filter(Boolean);else s.categories=old.categories;const saved=await saveState(e,s);return withCors(json({ok:true,state:saved}))}
  if(p==='/api/admin/users'&&r.method==='GET'){const users=await readUsers(e),ds=await readDevices(e);const safe=users.map(u=>({id:u.id,username:u.username,numberSet:!!u.numberHash,createdAt:u.createdAt||null,lastLoginAt:u.lastLoginAt||null,lastDeviceId:u.lastDeviceId||null,lastDeviceName:u.lastDeviceName||'',devices:ds.filter(d=>d.username===u.username).map(d=>({deviceId:d.deviceId,name:d.name,status:d.status||'',blocked:!!d.blocked,lastSeen:d.lastSeen||null}))}));return withCors(json({ok:true,users:safe}))}
  if(p==='/api/admin/users/set-number'&&r.method==='POST'){const b=await r.json().catch(()=>({})),id=String(b.userId||''),number=String(b.number||'').replace(/\s+/g,'');if(!/^\+?[0-9]{6,20}$/.test(number))return withCors(json({ok:false,error:'Invalid number'},400));const users=await readUsers(e),u0=users.find(x=>x.id===id);if(!u0)return withCors(json({ok:false,error:'User not found'},404));const salt=crypto.randomUUID();u0.numberSalt=salt;u0.numberHash=await hash(salt+number);u0.passwordHash=undefined;u0.salt=undefined;u0.numberUpdatedAt=new Date().toISOString();await saveUsers(e,users);return withCors(json({ok:true}))}
  if(p==='/api/admin/users/reset-password'&&r.method==='POST')return withCors(json({ok:false,error:'Password login has been removed. Use Set Number instead.'},410));
  if(p==='/api/admin/devices'&&r.method==='GET')return withCors(json({ok:true,devices:await readDevices(e),settings:await readSettings(e)}));
  for(const action of ['block','unblock','approve'])if(p==='/api/admin/devices/'+action&&r.method==='POST'){const b=await r.json().catch(()=>({})),ds=await readDevices(e),d=ds.find(x=>x.deviceId===String(b.deviceId||''));if(!d)return withCors(json({ok:false,error:'Device not found'},404));if(action==='block'){d.blocked=true;d.approved=false;d.status='Blocked'}if(action==='unblock'){d.blocked=false;d.approved=false;d.status='Logged out'}if(action==='approve'){d.approved=true;d.blocked=false;d.status='Approved'}await saveDevices(e,ds);return withCors(json({ok:true,device:d}))}
  if(p==='/api/admin/devices'&&r.method==='DELETE'){const id=u.searchParams.get('deviceId')||'';await saveDevices(e,(await readDevices(e)).filter(x=>x.deviceId!==id));return withCors(json({ok:true}))}
  if(p==='/api/admin/settings'&&r.method==='GET')return withCors(json({ok:true,settings:await readSettings(e)}));
  if(p==='/api/admin/settings'&&r.method==='PUT'){const b=await r.json().catch(()=>({})),s={...(await readSettings(e)),...b};await kv(e).put(SETTINGS_KEY,JSON.stringify(s));return withCors(json({ok:true,settings:s}))}
  if(p==='/api/admin/import-m3u-url'&&r.method==='POST'){const b=await r.json().catch(()=>({}));if(!/^https?:\/\//i.test(String(b.url||'')))return withCors(json({ok:false,error:'Invalid M3U URL'},400));const x=await fetch(b.url);if(!x.ok)return withCors(json({ok:false,error:'M3U URL failed: '+x.status},400));const s=await readState(e);s.channels=parseM3U(await x.text());s.categories=defaultState().categories;return withCors(json({ok:true,count:s.channels.length,state:await saveState(e,s)}))}
  if(p==='/api/admin/import-m3u'&&r.method==='POST'){const s=await readState(e);s.channels=parseM3U(await r.text());s.categories=defaultState().categories;return withCors(json({ok:true,count:s.channels.length,state:await saveState(e,s)}))}
  if(p==='/api/xtream/import'&&r.method==='POST'){const b=await r.json().catch(()=>({}));try{const list=await fetchXtream(b.server,b.username,b.password,b.limit||'all'),s=await readState(e);s.channels=list;s.categories=defaultState().categories;const saved=await saveState(e,s);return withCors(json({ok:true,count:list.length,state:saved}))}catch(err){return withCors(json({ok:false,error:err.message||'Xtream import failed'},400))}}
  return withCors(json({ok:false,error:'API route not found'},404));
}
export default{async fetch(r,e){return new URL(r.url).pathname.startsWith('/api/')?handle(r,e):e.ASSETS.fetch(r)}};
