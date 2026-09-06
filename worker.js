const STATE_KEY='vip_state_v2';
const SETTINGS_KEY='vip_settings_v2';
const DEVICES_KEY='vip_devices_v2';
const SESSION_PREFIX='vip_admin_session:';
const SESSION_TTL=60*60;

const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{
  status,headers:{'content-type':'application/json; charset=utf-8',...extra}
});
const cors=(h={})=>({
  'access-control-allow-origin': '*',
  'access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers':'Content-Type, Authorization, X-ViP-Device-ID',
  ...h
});
const kv=env=>env.VIP_PLAYLIST||env.PLAYLIST_KV;
const adminPassword=env=>env.ADMIN_PASSWORD||'';
const cookieName='VIP_ADMIN_SESSION';

function normalizeChannel(x={},i=0){
  return {
    id:String(x.id||crypto.randomUUID()),
    name:String(x.name||x.title||`Channel ${i+1}`),
    url:String(x.url||x.stream_url||x.streamUrl||''),
    logo:String(x.logo||x.logoUrl||''),
    category:String(x.category||x.group||x.groupTitle||'Others'),
    enabled:x.enabled!==false
  };
}
function normalizeState(x){
  const s=x&&typeof x==='object'?x:{};
  const channels=Array.isArray(s.channels)?s.channels.map(normalizeChannel):[];
  const categories=[...new Set((Array.isArray(s.categories)?s.categories:[]).map(String).filter(Boolean).concat(channels.map(c=>c.category)))];
  return {channels,categories:categories.length?categories:['BD','India','Sports','Movie','Series','Others'],notice:String(s.notice||''),updatedAt:Date.now()};
}
async function getState(env){
  const store=kv(env);
  if(!store) return normalizeState({});
  return normalizeState(await store.get(STATE_KEY,'json')||{});
}
async function saveState(env,state){
  const store=kv(env);
  if(!store) throw new Error('VIP_PLAYLIST KV binding is missing');
  const clean=normalizeState(state);
  await store.put(STATE_KEY,JSON.stringify(clean));
  return clean;
}
async function getSettings(env){
  const store=kv(env);
  if(!store) return {};
  return await store.get(SETTINGS_KEY,'json')||{};
}
async function saveSettings(env,data){
  const store=kv(env);
  if(!store) throw new Error('VIP_PLAYLIST KV binding is missing');
  await store.put(SETTINGS_KEY,JSON.stringify(data||{}));
  return data||{};
}
function parseCookies(req){
  const out={}; for(const p of (req.headers.get('cookie')||'').split(';')){
    const i=p.indexOf('='); if(i>0) out[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim());
  } return out;
}
async function requireAdmin(req,env){
  const sid=parseCookies(req)[cookieName];
  if(!sid) return false;
  const store=kv(env); if(!store) return false;
  return !!(await store.get(SESSION_PREFIX+sid));
}
async function fetchText(url){
  const r=await fetch(url,{redirect:'follow'});
  if(!r.ok) throw new Error(`URL returned ${r.status}`);
  return await r.text();
}
function parseM3U(text){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);
  const out=[]; let meta=null;
  for(const line of lines){
    const s=line.trim(); if(!s) continue;
    if(s.startsWith('#EXTINF:')){
      const attrs={}; for(const m of s.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[m[1]]=m[2];
      const comma=s.indexOf(','); const name=comma>=0?s.slice(comma+1).trim():'Channel';
      meta={name,logo:attrs['tvg-logo']||'',category:attrs['group-title']||''};
    } else if(!s.startsWith('#') && meta){
      const c=normalizeChannel({name:meta.name,logo:meta.logo,category:meta.category||'Others',url:s},out.length);
      out.push(c); meta=null;
    }
  }
  return out;
}
function autoCategory(name,group=''){
  const s=(name+' '+group).toLowerCase();
  if(/movie|film|cinema/.test(s)) return 'Movie';
  if(/series|season|episode|drama/.test(s)) return 'Series';
  if(/sport|espn|bein|ten sport|star sport/.test(s)) return 'Sports';
  if(/india|hindi|zee|sony|colors/.test(s)) return 'India';
  if(/bangla|bd |bangladesh|btv|somoy|jamuna|ntv|ekattor/.test(s)) return 'BD';
  return group||'Others';
}
function parseXtream(data){
  const arr=Array.isArray(data)?data:[];
  return arr.map((x,i)=>normalizeChannel({
    id:x.stream_id||x.series_id||crypto.randomUUID(),
    name:x.name||`Stream ${i+1}`, logo:x.stream_icon||x.cover||'',
    category:autoCategory(x.name||'',x.category_name||''),
    url:x.stream_url||x.url||''
  },i)).filter(x=>x.url);
}
async function route(req,env){
  const u=new URL(req.url), p=u.pathname, method=req.method;
  if(method==='OPTIONS') return new Response(null,{status:204,headers:cors()});

  if(p==='/api/admin/login' && method==='POST'){
    const body=await req.json().catch(()=>({}));
    if(!adminPassword(env) || String(body.password||'')!==adminPassword(env)) return json({ok:false,error:'Invalid password'},401,cors());
    const sid=crypto.randomUUID(), store=kv(env);
    if(!store) return json({ok:false,error:'VIP_PLAYLIST KV binding missing'},500,cors());
    await store.put(SESSION_PREFIX+sid,'1',{expirationTtl:SESSION_TTL});
    return json({ok:true},200,cors({'set-cookie':`${cookieName}=${encodeURIComponent(sid)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`}));
  }
  if(p==='/api/admin/session' && method==='GET') return json({ok:await requireAdmin(req,env)},200,cors());
  if(p==='/api/admin/logout'){
    const sid=parseCookies(req)[cookieName],store=kv(env); if(sid&&store) await store.delete(SESSION_PREFIX+sid);
    return json({ok:true},200,cors({'set-cookie':`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}));
  }
  if(p==='/api/state' || p==='/api/playlist'){
    const s=await getState(env);
    return json(p==='/api/playlist'?s.channels:s,200,cors({'cache-control':'no-store'}));
  }
  if(p==='/api/admin/ping') return (await requireAdmin(req,env))?json({ok:true},200,cors()):json({ok:false},401,cors());

  if(p.startsWith('/api/admin/')){
    if(!(await requireAdmin(req,env))) return json({ok:false,error:'Unauthorized'},401,cors());
    try{
      if(p==='/api/admin/state' && method==='GET') return json(await getState(env),200,cors());
      if(p==='/api/admin/state' && method==='PUT'){
        const body=await req.json(); return json({ok:true,state:await saveState(env,body)},200,cors());
      }
      if(p==='/api/admin/playlist' && method==='GET') return json(await getState(env),200,cors());
      if(p==='/api/admin/playlist' && method==='PUT'){
        const body=await req.json(); return json({ok:true,state:await saveState(env,body)},200,cors());
      }
      if(p==='/api/admin/settings' && method==='GET') return json(await getSettings(env),200,cors());
      if(p==='/api/admin/settings' && method==='PUT') return json({ok:true,settings:await saveSettings(env,await req.json())},200,cors());
      if(p==='/api/admin/import-m3u-url' && method==='POST'){
        const {url}=await req.json(); if(!url) throw new Error('M3U URL required');
        const channels=parseM3U(await fetchText(url));
        const s=await getState(env); s.channels=channels; s.categories=[...new Set(channels.map(c=>c.category))];
        return json({ok:true,count:channels.length,state:await saveState(env,s)},200,cors());
      }
      if(p==='/api/admin/import-m3u' && method==='POST'){
        const body=await req.json(); const channels=parseM3U(String(body.text||''));
        const s=await getState(env); s.channels=channels; s.categories=[...new Set(channels.map(c=>c.category))];
        return json({ok:true,count:channels.length,state:await saveState(env,s)},200,cors());
      }
      if(p==='/api/xtream/import' && method==='POST'){
        const body=await req.json(); let base=String(body.url||'').replace(/\/+$/,'');
        if(!base) throw new Error('Xtream server URL required');
        const u=new URL(base); u.searchParams.set('username',body.username||''); u.searchParams.set('password',body.password||'');
        u.searchParams.set('type','m3u_plus');
        const text=await fetchText(u.toString()); const channels=parseM3U(text);
        const s=await getState(env); s.channels=channels; s.categories=[...new Set(channels.map(c=>c.category))];
        return json({ok:true,count:channels.length,state:await saveState(env,s)},200,cors());
      }
      if(p==='/api/admin/export-m3u' && method==='GET'){
        const s=await getState(env);
        const body='#EXTM3U\n'+s.channels.map(c=>`#EXTINF:-1 tvg-logo="${c.logo}" group-title="${c.category}",${c.name}\n${c.url}`).join('\n');
        return new Response(body,{headers:{'content-type':'audio/x-mpegurl; charset=utf-8',...cors()}});
      }
      if(p==='/api/admin/check-all') return json({ok:true,results:[]},200,cors());
      if(p==='/api/admin/devices' || p.startsWith('/api/admin/device')) return json({ok:true,devices:[]},200,cors());
    }catch(e){ return json({ok:false,error:e.message||'Server error'},400,cors()); }
  }
  return env.ASSETS.fetch(req);
}
export default {fetch(req,env){return route(req,env).catch(e=>json({ok:false,error:e.message||'Internal error'},500,cors()));}};
