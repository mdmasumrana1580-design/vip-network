/**
 * VIP-NETWORK unified Cloudflare Worker
 * Public website + Admin API + KV persistence.
 * Keeps the existing v1 KV keys so current data is preserved.
 */
const STATE_KEY='vip_state_v1';
const DEVICES_KEY='vip_devices_v1';
const SETTINGS_KEY='vip_settings_v1';
const SESSION_PREFIX='vip_admin_session:';
const VISITOR_KEY='vip_visitor_stats_v1';
const SESSION_TTL=300;

const adminPassword=env=>env.ADMIN_PASSWORD||env.ADMIN_PASSWOED||'';
const kv=env=>env.VIP_PLAYLIST||env.PLAYLIST_KV;

const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{
  status,
  headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}
});
const cors={
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers':'Content-Type, Authorization, X-ViP-Device-ID'
};
const withCors=(r)=>{const h=new Headers(r.headers);Object.entries(cors).forEach(([k,v])=>h.set(k,v));return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h});};

function detectCategory(name='',group='',metaLine=''){
  const text=`${name} ${group} ${metaLine}`.toLowerCase();
  if(/\b(movie|movies|film|films|cinema|cine|web[\s._-]*movie|full[\s._-]*movie|movie[\s._-]*hd|movie[\s._-]*4k|vod)\b/.test(text) ||
     /\b(series|serial|season|episode|episod|s\d{1,2}e\d{1,3}|tv[\s._-]*series|web[\s._-]*series)\b/.test(text)) return 'Movie';
  if(/sport|cricket|football|fifa|eurosport|willow|ten\s*cricket|ptv\s*sports|tsn|espn|bein|wwe|golf|nfl|nba/.test(text)) return 'Sports';
  if(/bangla|bangladesh|\bbd\b|somoy|jamuna|ekattor|dbc|maasranga|atn|channel\s*24|news24|independent|ntv|rtv|banglavision|boishakhi|gazi tv|\bgtv\b|b tv|bengal|duronto|deepto|nagorik|mohona|asian tv|desh tv|bijoy tv|mytv|satv|ekushey|bishwa|bangla tv|\bbtv\b/.test(text)) return 'BD';
  if(/india|indian|sony|zee|star|colors|\bset\b|\bsab\b|aaj tak|ndtv|republic|news18|times now|india tv|dd national|dd sports|sun tv|asianet|vijay|jaya|starplus|star gold|sony max|sony pix|sony wah|sony yay|&pictures|b4u|movies now|mnx|hbo india/.test(text)) return 'India';
  return 'Others';
}
function norm(c={}){
  const name=String(c.name||c.title||'Unnamed');
  const group=String(c.group||c.groupTitle||c.category||'');
  const category=String(c.category||c.cat||detectCategory(name,group,c.meta||''));
  return {
    id:String(c.id||crypto.randomUUID()),
    name, category, cat:category,
    logo:String(c.logo||c.tvgLogo||c['tvg-logo']||''),
    url:String(c.url||c.stream||c.streamUrl||''),
    status:String(c.status||'Unknown'),
    enabled:c.enabled!==false
  };
}
function normalizeState(s={}){
  const channels=Array.isArray(s.channels)?s.channels.map(norm):[];
  const derived=[...new Set(channels.map(c=>c.category).filter(Boolean))];
  const categories=[...new Set([...(Array.isArray(s.categories)?s.categories:[]).map(String),...derived])];
  return {
    ...s,
    channels,
    categories,
    notice:s.notice&&typeof s.notice==='object'?s.notice:{text:String(s.notice||''),type:'Information',enabled:true},
    headline:String(s.headline||'')
  };
}
async function readState(env){
  const store=kv(env); if(!store) return normalizeState({});
  const raw=await store.get(STATE_KEY);
  if(!raw) return normalizeState({});
  try{return normalizeState(JSON.parse(raw));}catch{return normalizeState({});}
}
async function saveState(env,state){
  const store=kv(env); if(!store) throw new Error('VIP_PLAYLIST KV binding is missing');
  const clean=normalizeState(state);
  await store.put(STATE_KEY,JSON.stringify(clean));
  return clean;
}
async function readDevices(env){
  const raw=await kv(env).get(DEVICES_KEY); try{return raw?JSON.parse(raw):[]}catch{return[]}
}
async function saveDevices(env,list){await kv(env).put(DEVICES_KEY,JSON.stringify(list))}
async function readSettings(env){
  const raw=await kv(env).get(SETTINGS_KEY); try{return raw?JSON.parse(raw):{deviceLimit:1,accessMode:'approval'}}catch{return{deviceLimit:1,accessMode:'approval'}}
}
async function saveSettings(env,data){const s={...(await readSettings(env)),...(data||{})};await kv(env).put(SETTINGS_KEY,JSON.stringify(s));return s}
function cookies(request){
  const out={}; for(const p of (request.headers.get('Cookie')||'').split(';')){const i=p.indexOf('=');if(i>0)out[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim())} return out;
}
async function authorized(request,env){
  const expected=adminPassword(env); if(!expected) return false;
  const token=cookies(request).VIP_ADMIN_SESSION;
  if(token && await kv(env).get(SESSION_PREFIX+token)) return true;
  const auth=request.headers.get('Authorization')||'';
  return auth===`Bearer ${expected}`;
}
async function requireAdmin(request,env){if(!(await authorized(request,env)))return json({ok:false,error:'Unauthorized'},401)}

function parseM3U(text){
  const lines=String(text||'').replace(/\r/g,'').split('\n'),out=[]; let meta=null;
  for(const raw of lines){
    const line=raw.trim(); if(!line)continue;
    if(line.startsWith('#EXTINF')){
      const comma=line.indexOf(','),name=comma>=0?line.slice(comma+1).trim():'Live Channel';
      const gm=line.match(/group-title="([^"]*)"/i),lm=line.match(/tvg-logo="([^"]*)"/i);
      meta={name:name||'Live Channel',group:gm?gm[1]:'',logo:lm?lm[1]:'',meta:line}; continue;
    }
    if(line.startsWith('#'))continue;
    if(meta){
      if(/^(https?|rtmp|rtsp|hls):\/\//i.test(line)){
        const category=detectCategory(meta.name,meta.group,meta.meta);
        out.push(norm({name:meta.name,category,cat:category,group:meta.group,logo:meta.logo,url:line,status:'Unknown'}));
      }
      meta=null;
    }
  }
  return out;
}
function m3u(channels){
  return '#EXTM3U\n'+channels.map(c=>`#EXTINF:-1 tvg-logo="${String(c.logo||'').replace(/"/g,'&quot;')}" group-title="${String(c.category||c.cat||'Other').replace(/"/g,'&quot;')}",${String(c.name||'Channel').replace(/\n/g,' ')}\n${c.url}`).join('\n');
}
async function visitorStats(env,body={}){
  const id=String(body.id||'').slice(0,120); if(!id)return{ok:false,error:'visitor id required'};
  const now=Date.now(),onlineTtl=45000; let stats={total:0,visitors:{}};
  try{const raw=await kv(env).get(VISITOR_KEY);if(raw)stats=JSON.parse(raw)}catch{}
  if(!Number.isFinite(Number(stats.total)))stats.total=0;
  if(!stats.visitors||typeof stats.visitors!=='object')stats.visitors={};
  const wasKnown=!!stats.visitors[id];
  if(body.newVisit&&!wasKnown)stats.total+=1;
  stats.visitors[id]=now;
  for(const [k,t] of Object.entries(stats.visitors)){if(!Number.isFinite(Number(t))||now-Number(t)>onlineTtl)delete stats.visitors[k]}
  await kv(env).put(VISITOR_KEY,JSON.stringify(stats));
  return{ok:true,total:stats.total,online:Object.keys(stats.visitors).length};
}
async function handleApi(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(request.method==='OPTIONS')return withCors(new Response(null,{status:204}));
  if(path==='/api/admin/login'&&request.method==='POST'){
    const b=await request.json().catch(()=>({})),password=String(b.password||'');
    if(!adminPassword(env)||password!==adminPassword(env))return withCors(json({ok:false,error:'Unauthorized'},401));
    const token=crypto.randomUUID();await kv(env).put(SESSION_PREFIX+token,'1',{expirationTtl:SESSION_TTL});
    return withCors(json({ok:true,expiresIn:SESSION_TTL},200,{'Set-Cookie':`VIP_ADMIN_SESSION=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL}; Path=/; HttpOnly; Secure; SameSite=Lax`}));
  }
  if(path==='/api/admin/session'&&request.method==='GET')return withCors((await authorized(request,env))?json({ok:true,expiresIn:SESSION_TTL}):json({ok:false,error:'Unauthorized'},401));
  if(path==='/api/admin/logout'&&request.method==='POST'){
    const token=cookies(request).VIP_ADMIN_SESSION;if(token)await kv(env).delete(SESSION_PREFIX+token);
    return withCors(json({ok:true},200,{'Set-Cookie':'VIP_ADMIN_SESSION=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax'}));
  }
  if(path==='/api/state'&&request.method==='GET'){
    const s=await readState(env);return withCors(json({channels:s.channels||[],categories:s.categories||[],notice:s.notice||{},headline:s.headline||''}));
  }
  if(path==='/api/playlist'&&request.method==='GET'){
    const s=await readState(env);return withCors(json({channels:s.channels||[]}));
  }
  if(path==='/api/settings'&&request.method==='GET')return withCors(json(await readSettings(env)));
  if(path==='/api/visitor'&&request.method==='POST'){const b=await request.json().catch(()=>({}));return withCors(json(await visitorStats(env,b)))}
  if(path==='/api/device/register'&&request.method==='POST'){
    const body=await request.json().catch(()=>({})),deviceId=String(body.deviceId||request.headers.get('X-ViP-Device-ID')||'');
    if(!deviceId)return withCors(json({ok:false,error:'deviceId required'},400));
    const devices=await readDevices(env);let d=devices.find(x=>x.deviceId===deviceId);
    if(!d){d={deviceId,name:String(body.name||'Unknown device'),userAgent:String(body.userAgent||request.headers.get('user-agent')||'').slice(0,200),approved:false,createdAt:new Date().toISOString(),lastSeen:new Date().toISOString()};devices.push(d)}
    else d.lastSeen=new Date().toISOString();
    await saveDevices(env,devices);return withCors(json({ok:true,device:d,settings:await readSettings(env)}));
  }
  if(path==='/api/device/check'&&request.method==='GET'){
    const id=url.searchParams.get('deviceId')||request.headers.get('X-ViP-Device-ID')||'',devices=await readDevices(env),d=devices.find(x=>x.deviceId===id);
    return withCors(json({ok:true,approved:!!d?.approved,device:d||null,settings:await readSettings(env)}));
  }
  const guard=await requireAdmin(request,env); if(guard)return withCors(guard);
  if(path==='/api/admin/ping'&&request.method==='GET')return withCors(json({ok:true,connected:true}));
  if(path==='/api/admin/state'&&request.method==='GET')return withCors(json({ok:true,state:await readState(env)}));
  if(path==='/api/admin/state'&&request.method==='PUT'){
    const b=await request.json().catch(()=>({})),old=await readState(env),state={...old,...b,channels:Array.isArray(b.channels)?b.channels.map(norm):old.channels||[],categories:Array.isArray(b.categories)?b.categories.map(String):old.categories||[]};
    return withCors(json({ok:true,state:await saveState(env,state)}));
  }
  if(path==='/api/admin/playlist'&&request.method==='GET'){const s=await readState(env);return withCors(json({ok:true,channels:s.channels||[]}))}
  if(path==='/api/admin/playlist'&&request.method==='PUT'){
    const b=await request.json().catch(()=>({})),s=await readState(env);s.channels=Array.isArray(b.channels)?b.channels.map(norm):[];return withCors(json({ok:true,state:await saveState(env,s)}))
  }
  if(path==='/api/admin/import-m3u'&&request.method==='POST'){
    const ct=request.headers.get('content-type')||'';let text='';
    if(ct.includes('application/json')){const b=await request.json();text=String(b.text||b.m3u||'')}else text=await request.text();
    const channels=parseM3U(text),s=await readState(env);s.channels=channels;s.categories=[...new Set(channels.map(c=>c.category))];
    return withCors(json({ok:true,count:channels.length,state:await saveState(env,s)}));
  }
  if(path==='/api/admin/import-m3u-url'&&request.method==='POST'){
    const b=await request.json().catch(()=>({})),target=String(b.url||'');
    if(!/^https?:\/\//i.test(target))return withCors(json({ok:false,error:'Invalid M3U URL'},400));
    const r=await fetch(target,{redirect:'follow'});if(!r.ok)return withCors(json({ok:false,error:`M3U URL HTTP ${r.status}`},400));
    const channels=parseM3U(await r.text()),s=await readState(env);s.channels=channels;s.categories=[...new Set(channels.map(c=>c.category))];
    return withCors(json({ok:true,count:channels.length,state:await saveState(env,s)}));
  }
  if(path==='/api/xtream/import'&&request.method==='POST'){
    const b=await request.json().catch(()=>({})),server=String(b.server||'').replace(/\/$/,''),user=String(b.username||''),pass=String(b.password||'');
    if(!server||!user||!pass)return withCors(json({ok:false,error:'server, username and password required'},400));
    const apiUrl=server+'/player_api.php?username='+encodeURIComponent(user)+'&password='+encodeURIComponent(pass)+'&action=get_live_streams';
    const r=await fetch(apiUrl,{redirect:'follow'});if(!r.ok)return withCors(json({ok:false,error:`Xtream HTTP ${r.status}`},400));
    const data=await r.json();if(!Array.isArray(data))return withCors(json({ok:false,error:'Xtream returned invalid data'},400));
    const lim=String(b.limit||'all'),items=lim==='all'?data:data.slice(0,Number(lim)||100);
    const base=server+'/live/'+encodeURIComponent(user)+'/'+encodeURIComponent(pass)+'/';
    const channels=items.map(x=>{const category=detectCategory(x.name||'',x.category_name||'','');return norm({name:x.name||('Channel '+x.stream_id),category,cat:category,logo:x.stream_icon||'',url:base+encodeURIComponent(String(x.stream_id))+'.m3u8',status:'Unknown'})});
    const s=await readState(env);s.channels=channels;s.categories=[...new Set(channels.map(c=>c.category))];
    return withCors(json({ok:true,count:channels.length,state:await saveState(env,s)}));
  }
  if(path==='/api/admin/check-all'&&request.method==='POST'){
    const s=await readState(env),channels=s.channels||[];
    const checked=await Promise.all(channels.map(async c=>{try{const r=await fetch(c.url,{method:'GET',redirect:'follow'});return{...c,status:r.ok?'Active':'Dead'}}catch{return{...c,status:'Dead'}}}));
    s.channels=checked;return withCors(json({ok:true,count:checked.length,channels:checked,state:await saveState(env,s)}));
  }
  if(path==='/api/admin/settings'&&request.method==='GET')return withCors(json({ok:true,settings:await readSettings(env)}));
  if(path==='/api/admin/settings'&&request.method==='PUT')return withCors(json({ok:true,settings:await saveSettings(env,await request.json())}));
  if(path==='/api/admin/devices'&&request.method==='GET')return withCors(json({ok:true,devices:await readDevices(env),settings:await readSettings(env)}));
  if(path==='/api/admin/devices/approve'&&request.method==='POST'){
    const b=await request.json().catch(()=>({})),id=String(b.deviceId||''),list=await readDevices(env),d=list.find(x=>x.deviceId===id);
    if(!d)return withCors(json({ok:false,error:'Device not found'},404));d.approved=true;d.status='Approved';await saveDevices(env,list);return withCors(json({ok:true,device:d}));
  }
  if(path==='/api/admin/devices/approve-all'&&request.method==='POST'){const list=await readDevices(env);list.forEach(d=>{d.approved=true;d.status='Approved'});await saveDevices(env,list);return withCors(json({ok:true,count:list.length}))}
  if(path==='/api/admin/devices/logout-all'&&request.method==='POST'){const list=await readDevices(env);list.forEach(d=>{d.approved=false;d.status='Logged out'});await saveDevices(env,list);return withCors(json({ok:true}))}
  if(path==='/api/admin/devices'&&request.method==='PUT'){
    const b=await request.json().catch(()=>({})),list=await readDevices(env),id=String(b.deviceId||''),d=list.find(x=>x.deviceId===id);
    if(!d)return withCors(json({ok:false,error:'Device not found'},404));Object.assign(d,b);await saveDevices(env,list);return withCors(json({ok:true,device:d}));
  }
  if(path==='/api/admin/devices'&&request.method==='DELETE'){
    const id=url.searchParams.get('deviceId')||'',list=(await readDevices(env)).filter(x=>x.deviceId!==id);await saveDevices(env,list);return withCors(json({ok:true}))
  }
  if(path==='/api/admin/export-m3u'&&request.method==='GET')return new Response(m3u((await readState(env)).channels||[]),{headers:{'content-type':'audio/x-mpegurl; charset=utf-8',...cors}});
  return withCors(json({ok:false,error:'API route not found'},404));
}
async function injectPublicSync(request,env,response){
  const url=new URL(request.url);
  if(request.method!=='GET'||url.pathname!=='/'&&url.pathname!=='/index.html')return response;
  const ct=response.headers.get('content-type')||''; if(!ct.includes('text/html'))return response;
  const html=await response.text();
  const script=`<script>
(function(){
 const API=location.origin;
 function setText(sel,text){document.querySelectorAll(sel).forEach(e=>e.textContent=text);}
 async function sync(){
  try{
   const r=await fetch(API+'/api/state',{cache:'no-store'}); if(!r.ok)return;
   const d=await r.json();
   const n=d.notice||{}, msg=String(n.text||d.headline||'');
   const notice=document.querySelector('.headline-track'); if(notice&&msg){notice.innerHTML='<span>'+msg.replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</span><span>'+msg.replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</span>';}
   if(n.enabled===false){const h=document.querySelector('.headline');if(h)h.style.display='none';}
   const cats=Array.isArray(d.categories)?d.categories:[];
   const nav=document.getElementById('cats');
   if(nav){
    const wanted=['All','Sports','BD','India','Others'];
    cats.forEach(c=>{if(!wanted.includes(c)&&!nav.querySelector('[data-cat="'+CSS.escape(c)+'"]')){const b=document.createElement('button');b.dataset.cat=c;b.textContent=String(c).toUpperCase();nav.appendChild(b);}});
   }
  }catch(e){}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
})();
</script>`;
  return new Response(html.replace('</body>',script+'</body>'),{status:response.status,headers:response.headers});
}
export default {async fetch(request,env){
  try{
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/'))return handleApi(request,env);
    const response=await env.ASSETS.fetch(request);
    return injectPublicSync(request,env,response);
  }catch(e){return withCors(json({ok:false,error:e.message||'Internal error'},500))}
}};
