/**
 * VIP NETWORK unified Worker
 * - Serves the static website + /admin from ASSETS
 * - Stores playlist/notice/settings/devices in KV
 * - Protects admin endpoints with ADMIN_PASSWORD secret
 *
 * Required:
 *   ADMIN_PASSWORD = Cloudflare Worker Secret
 *   PLAYLIST_KV    = KV namespace binding
 *   ASSETS         = assets binding for ./site
 */
const STATE_KEY = "vip_state_v1";
const DEVICES_KEY = "vip_devices_v1";
const SETTINGS_KEY = "vip_settings_v1";

const json = (data, status=200, extra={}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {"content-type":"application/json; charset=utf-8", "cache-control":"no-store", ...extra}
  });

const cors = {
  "access-control-allow-origin":"*",
  "access-control-allow-methods":"GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers":"Content-Type, Authorization, X-ViP-Device-ID"
};

function withCors(resp) {
  const h = new Headers(resp.headers);
  Object.entries(cors).forEach(([k,v])=>h.set(k,v));
  return new Response(resp.body, {status:resp.status, statusText:resp.statusText, headers:h});
}

function norm(c={}) {
  return {
    name: String(c.name || c.title || "Unnamed"),
    category: String(c.category || c.group || c.groupTitle || "Other"),
    logo: String(c.logo || c.tvgLogo || c["tvg-logo"] || ""),
    url: String(c.url || c.stream || c.streamUrl || ""),
    status: String(c.status || "Unknown")
  };
}

function parseM3U(text) {
  const lines = String(text||"").replace(/\r/g,"").split("\n");
  const out=[]; let meta=null;
  for (const raw of lines) {
    const line=raw.trim(); if(!line) continue;
    if (line.startsWith("#EXTINF")) {
      const comma=line.indexOf(",");
      const name=comma>=0 ? line.slice(comma+1).trim() : "Live Channel";
      const gm=line.match(/group-title="([^"]*)"/i);
      const lm=line.match(/tvg-logo="([^"]*)"/i);
      meta={name:name||"Live Channel", category:gm?gm[1]:"Other", logo:lm?lm[1]:""};
      continue;
    }
    if (line.startsWith("#")) continue;
    if (meta) {
      if (/^(https?|rtmp|rtsp|hls):\/\//i.test(line)) {
        out.push(norm({...meta,url:line,status:"Unknown"}));
      }
      meta=null;
    }
  }
  return out;
}

async function readState(env) {
  const raw = await (env.VIP_PLAYLIST || env.PLAYLIST_KV).get(STATE_KEY);
  if (!raw) return {channels:[], notice:{text:"",type:"Information",enabled:true}, headline:""};
  try { return JSON.parse(raw); } catch { return {channels:[],notice:{},headline:""}; }
}
async function saveState(env, state) {
  await (env.VIP_PLAYLIST || env.PLAYLIST_KV).put(STATE_KEY, JSON.stringify(state));
}
async function readDevices(env) {
  const raw = await (env.VIP_PLAYLIST || env.PLAYLIST_KV).get(DEVICES_KEY);
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}
async function saveDevices(env, list) {
  await (env.VIP_PLAYLIST || env.PLAYLIST_KV).put(DEVICES_KEY, JSON.stringify(list));
}
async function readSettings(env) {
  const raw = await (env.VIP_PLAYLIST || env.PLAYLIST_KV).get(SETTINGS_KEY);
  try { return raw ? JSON.parse(raw) : {deviceLimit:1, accessMode:"approval"}; } catch { return {deviceLimit:1, accessMode:"approval"}; }
}

function authorized(request, env) {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) return false;
  const auth = request.headers.get("Authorization") || "";
  return auth === `Bearer ${expected}`;
}

async function requireAdmin(request, env) {
  if (!authorized(request, env)) return json({ok:false,error:"Unauthorized"},401);
  return null;
}

function m3u(channels) {
  return "#EXTM3U\n" + channels.map(c =>
    `#EXTINF:-1 tvg-logo="${String(c.logo||"").replace(/"/g,'&quot;')}" group-title="${String(c.category||"Other").replace(/"/g,'&quot;')}",${String(c.name||"Channel").replace(/\n/g," ")}\n${c.url}`
  ).join("\n");
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "OPTIONS") return withCors(new Response(null,{status:204}));

  // Public website API
  if (request.method==="GET" && path==="/api/state") {
    const s=await readState(env);
    return withCors(json({channels:s.channels||[], notice:s.notice||{}, headline:s.headline||""}));
  }
  if (request.method==="GET" && path==="/api/playlist") {
    const s=await readState(env);
    return withCors(json({channels:s.channels||[]}));
  }

  // Device registration/check (public, device-id based)
  if (path==="/api/device/register" && request.method==="POST") {
    const body=await request.json().catch(()=>({}));
    const deviceId=String(body.deviceId||request.headers.get("X-ViP-Device-ID")||"");
    if(!deviceId) return withCors(json({ok:false,error:"deviceId required"},400));
    const devices=await readDevices(env);
    let d=devices.find(x=>x.deviceId===deviceId);
    if(!d){
      d={deviceId,name:String(body.name||"Unknown device"),userAgent:String(body.userAgent||request.headers.get("user-agent")||"").slice(0,200),approved:false,createdAt:new Date().toISOString(),lastSeen:new Date().toISOString()};
      devices.push(d); await saveDevices(env,devices);
    } else { d.lastSeen=new Date().toISOString(); await saveDevices(env,devices); }
    const settings=await readSettings(env);
    return withCors(json({ok:true,device:d,settings}));
  }
  if (path==="/api/device/check" && request.method==="GET") {
    const id=url.searchParams.get("deviceId")||request.headers.get("X-ViP-Device-ID")||"";
    const devices=await readDevices(env), d=devices.find(x=>x.deviceId===id);
    return withCors(json({ok:true,approved:!!d?.approved,device:d||null,settings:await readSettings(env)}));
  }

  // Admin protected API
  const guard=await requireAdmin(request,env); if(guard) return withCors(guard);

  if (path==="/api/admin/ping" && request.method==="GET") return withCors(json({ok:true,connected:true}));
  if (path==="/api/admin/state" && request.method==="GET") return withCors(json({ok:true,state:await readState(env)}));
  if (path==="/api/admin/state" && request.method==="PUT") {
    const b=await request.json().catch(()=>({}));
    const old=await readState(env);
    const state={
      ...old,
      ...b,
      channels:Array.isArray(b.channels)?b.channels.map(norm):old.channels||[]
    };
    await saveState(env,state);
    return withCors(json({ok:true,state}));
  }
  if (path==="/api/admin/playlist" && request.method==="GET") {
    const s=await readState(env); return withCors(json({ok:true,channels:s.channels||[]}));
  }
  if (path==="/api/admin/playlist" && request.method==="PUT") {
    const b=await request.json().catch(()=>({}));
    const channels=Array.isArray(b.channels)?b.channels.map(norm):[];
    const s=await readState(env); s.channels=channels; await saveState(env,s);
    return withCors(json({ok:true,count:channels.length}));
  }
  if (path==="/api/admin/import-m3u" && request.method==="POST") {
    const ct=request.headers.get("content-type")||"";
    let text="";
    if(ct.includes("application/json")) { const b=await request.json(); text=String(b.text||b.m3u||""); }
    else text=await request.text();
    const channels=parseM3U(text);
    const s=await readState(env); s.channels=channels; await saveState(env,s);
    return withCors(json({ok:true,count:channels.length}));
  }
  if (path==="/api/admin/import-m3u-url" && request.method==="POST") {
    const b=await request.json().catch(()=>({}));
    const target=String(b.url||"");
    if(!/^https?:\/\//i.test(target)) return withCors(json({ok:false,error:"Invalid M3U URL"},400));
    const r=await fetch(target,{redirect:"follow"});
    if(!r.ok) return withCors(json({ok:false,error:`M3U URL HTTP ${r.status}`},400));
    const channels=parseM3U(await r.text());
    const s=await readState(env); s.channels=channels; await saveState(env,s);
    return withCors(json({ok:true,count:channels.length}));
  }
  if (path==="/api/xtream/import" && request.method==="POST") {
    const b=await request.json().catch(()=>({}));
    const server=String(b.server||"").replace(/\/$/,"");
    const user=String(b.username||""); const pass=String(b.password||"");
    if(!server||!user||!pass) return withCors(json({ok:false,error:"server, username and password required"},400));
    const apiUrl=server+"/player_api.php?username="+encodeURIComponent(user)+"&password="+encodeURIComponent(pass)+"&action=get_live_streams";
    const r=await fetch(apiUrl);
    if(!r.ok) return withCors(json({ok:false,error:`Xtream HTTP ${r.status}`},400));
    const data=await r.json();
    if(!Array.isArray(data)) return withCors(json({ok:false,error:"Xtream returned invalid data"},400));
    const lim=String(b.limit||"all"); const items=lim==="all"?data:data.slice(0,Number(lim)||100);
    const base=server+"/live/"+encodeURIComponent(user)+"/"+encodeURIComponent(pass)+"/";
    const channels=items.map(x=>norm({name:x.name||("Channel "+x.stream_id),category:x.category_name||"Other",logo:x.stream_icon||"",url:base+encodeURIComponent(String(x.stream_id))+".m3u8",status:"Unknown"}));
    const s=await readState(env); s.channels=channels; await saveState(env,s);
    return withCors(json({ok:true,count:channels.length}));
  }
  if (path==="/api/admin/check-all" && request.method==="POST") {
    const s=await readState(env); const channels=s.channels||[];
    const checked=await Promise.all(channels.map(async c=>{
      try {
        const r=await fetch(c.url,{method:"GET",redirect:"follow"});
        return {...c,status:r.ok?"Active":"Dead"};
      } catch { return {...c,status:"Dead"}; }
    }));
    s.channels=checked; await saveState(env,s);
    return withCors(json({ok:true,count:checked.length,channels:checked}));
  }
  if (path==="/api/admin/settings" && request.method==="GET") return withCors(json({ok:true,settings:await readSettings(env)}));
  if (path==="/api/admin/settings" && request.method==="PUT") {
    const b=await request.json().catch(()=>({})); const s={...(await readSettings(env)),...b};
    await (env.VIP_PLAYLIST || env.PLAYLIST_KV).put(SETTINGS_KEY,JSON.stringify(s)); return withCors(json({ok:true,settings:s}));
  }
  if (path==="/api/admin/devices" && request.method==="GET") return withCors(json({ok:true,devices:await readDevices(env),settings:await readSettings(env)}));
  if (path==="/api/admin/devices/approve" && request.method==="POST") {
    const b=await request.json().catch(()=>({})); const id=String(b.deviceId||"");
    const list=await readDevices(env); const d=list.find(x=>x.deviceId===id); if(!d)return withCors(json({ok:false,error:"Device not found"},404));
    d.approved=true; d.status="Approved"; await saveDevices(env,list); return withCors(json({ok:true,device:d}));
  }
  if (path==="/api/admin/devices/approve-all" && request.method==="POST") {
    const list=await readDevices(env); list.forEach(d=>{d.approved=true;d.status="Approved"}); await saveDevices(env,list); return withCors(json({ok:true,count:list.length}));
  }
  if (path==="/api/admin/devices/logout-all" && request.method==="POST") {
    const list=await readDevices(env); list.forEach(d=>{d.approved=false;d.status="Logged out"}); await saveDevices(env,list); return withCors(json({ok:true}));
  }
  if (path==="/api/admin/devices" && request.method==="PUT") {
    const b=await request.json().catch(()=>({})); const list=await readDevices(env); const id=String(b.deviceId||""); const d=list.find(x=>x.deviceId===id);
    if(!d)return withCors(json({ok:false,error:"Device not found"},404)); Object.assign(d,b); await saveDevices(env,list); return withCors(json({ok:true,device:d}));
  }
  if (path==="/api/admin/devices" && request.method==="DELETE") {
    const id=url.searchParams.get("deviceId")||""; const list=await readDevices(env).then(a=>a.filter(x=>x.deviceId!==id)); await saveDevices(env,list); return withCors(json({ok:true}));
  }
  if (path==="/api/admin/export-m3u" && request.method==="GET") {
    const s=await readState(env); return new Response(m3u(s.channels||[]),{headers:{"content-type":"audio/x-mpegurl","cache-control":"no-store",...cors}});
  }

  return withCors(json({ok:false,error:"API route not found"},404));
}

export default {
  async fetch(request, env, ctx) {
    const url=new URL(request.url);
    if(url.pathname.startsWith("/api/")) return handleApi(request,env);
    // Static website/admin files
    return env.ASSETS.fetch(request);
  }
};
