const STATE_KEY = 'vip_state_v1';
const DEVICES_KEY = 'vip_devices_v1';
const SETTINGS_KEY = 'vip_settings_v1';
const USERS_KEY = 'vip_users_v1';
const ONLINE_KEY = 'vip_online_v1';
const ADMIN_SESSION_PREFIX = 'vip_admin_session:';
const USER_SESSION_PREFIX = 'vip_user_session:';

// Admin session: 30 minutes.
const ADMIN_TTL = 60 * 30;
// Visitor sessions remain valid for 30 days, subject to device/block checks.
const USER_TTL = 60 * 60 * 24 * 30;

const adminPassword = e => e.ADMIN_PASSWORD || e.ADMIN_PASSWOED || '';
const kv = e => e.VIP_PLAYLIST || e.PLAYLIST_KV;
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization, X-ViP-Device-ID'
};

const json = (d, s = 200, x = {}) => {
  const h = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...(x.headers || {})
  });
  return new Response(JSON.stringify(d), { status: s, headers: h });
};

const withCors = r => {
  const h = new Headers(r.headers);
  for (const [k, v] of Object.entries(cors)) h.set(k, v);
  return new Response(r.body, { status: r.status, headers: h });
};

function cookies(r) {
  const o = {};
  (r.headers.get('Cookie') || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return o;
}

function norm(c = {}) {
  return {
    name: String(c.name || c.title || 'Unnamed'),
    category: String(c.category || c.group || c.groupTitle || 'Other'),
    logo: String(c.logo || c.tvgLogo || c['tvg-logo'] || ''),
    url: String(c.url || c.stream || c.streamUrl || ''),
    status: String(c.status || 'Unknown')
  };
}

function splitPlaylistState(s = {}) {
  const legacy = Array.isArray(s.channels) ? s.channels.map(norm) : [];
  let tvChannels = Array.isArray(s.tvChannels) ? s.tvChannels.map(norm) : legacy.filter(c => String(c.category || '').toUpperCase() !== 'MOVIE & SERIES');
  let movieSeries = Array.isArray(s.movieSeries) ? s.movieSeries.map(c => ({ ...norm(c), category: 'MOVIE & SERIES' })) : legacy.filter(c => String(c.category || '').toUpperCase() === 'MOVIE & SERIES').map(c => ({ ...norm(c), category: 'MOVIE & SERIES' }));
  movieSeries = movieSeries.map(c => ({ ...c, category: 'MOVIE & SERIES' }));
  return { ...s, tvChannels, movieSeries, channels: [...tvChannels, ...movieSeries], categories: ['SPORTS','BD','INDIA','OTHERS','MOVIE & SERIES'] };
}
async function readState(e) {
  const r = await kv(e).get(STATE_KEY);
  try { return splitPlaylistState(r ? JSON.parse(r) : { channels: [], notice: { text: '', type: 'Information', enabled: true }, headline: '' }); }
  catch { return splitPlaylistState({ channels: [], notice: {}, headline: '' }); }
}
async function saveState(e, s) { await kv(e).put(STATE_KEY, JSON.stringify(splitPlaylistState(s))); }
async function readDevices(e) { try { return JSON.parse((await kv(e).get(DEVICES_KEY)) || '[]'); } catch { return []; } }
async function saveDevices(e, x) { await kv(e).put(DEVICES_KEY, JSON.stringify(x)); }
async function readSettings(e) { try { return JSON.parse((await kv(e).get(SETTINGS_KEY)) || '{"deviceLimit":1,"accessMode":"auto"}'); } catch { return { deviceLimit: 1, accessMode: 'auto' }; } }
async function readUsers(e) { try { return JSON.parse((await kv(e).get(USERS_KEY)) || '[]'); } catch { return []; } }
async function saveUsers(e, x) { await kv(e).put(USERS_KEY, JSON.stringify(x)); }
async function readOnline(e) { try { return JSON.parse((await kv(e).get(ONLINE_KEY)) || '{}'); } catch { return {}; } }
async function saveOnline(e, x) { await kv(e).put(ONLINE_KEY, JSON.stringify(x), { expirationTtl: 120 }); }

function cleanOnline(x, now = Date.now()) {
  const out = {};
  for (const [k, v] of Object.entries(x || {})) {
    if (typeof v === 'number' && now - v < 60000) out[k] = v;
  }
  return out;
}

async function hash(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function token() { return crypto.randomUUID(); }
function clientIP(r) { return String(r.headers.get('CF-Connecting-IP') || r.headers.get('X-Forwarded-For') || r.headers.get('X-Real-IP') || '').split(',')[0].trim().slice(0, 80) || '—'; }
function bangladeshTime(iso) { try { return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(iso)); } catch { return iso; } }

function bangladeshDailyWindow(iso) {
  try {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d);
    const o = Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
    let day = `${o.year}-${o.month}-${o.day}`;
    const hour = Number(o.hour);
    // A new User-login window begins at 06:00 Bangladesh time.
    if (hour < 6) {
      const prev = new Date(d.getTime()-24*60*60*1000);
      const p = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(prev);
      day = p;
    }
    return day;
  } catch { return ''; }
}

async function deviceBlocked(e, id) {
  if (!id) return false;
  const d = (await readDevices(e)).find(x => x.deviceId === id);
  return !!d?.blocked;
}

async function authorized(r, e) {
  const p = adminPassword(e), c = cookies(r), t = c.VIP_ADMIN_SESSION;
  if (!p) return false;
  if (t && await kv(e).get(ADMIN_SESSION_PREFIX + t)) return true;
  return r.headers.get('Authorization') === `Bearer ${p}`;
}
async function requireAdmin(r, e) {
  return (await authorized(r, e)) ? null : json({ ok: false, error: 'Unauthorized' }, 401);
}

function parseM3U(t, forceMovie = false) {
  const a = String(t || '').replace(/\r/g, '').split('\n'), o = [];
  let m = null;
  for (const q of a) {
    const l = q.trim();
    if (l.startsWith('#EXTINF')) {
      const c = l.indexOf(','), gm = l.match(/group-title="([^"]*)"/i), lm = l.match(/tvg-logo="([^"]*)"/i);
      m = { name: c >= 0 ? l.slice(c + 1).trim() : 'Live Channel', category: gm ? gm[1] : 'Other', logo: lm ? lm[1] : '' };
      continue;
    }
    if (l && !l.startsWith('#') && m) {
      if (/^(https?|rtmp|rtsp|hls):\/\//i.test(l)) {
        const item = norm({ ...m, url: l, status: 'Unknown' });
        if (forceMovie) item.category = 'MOVIE & SERIES';
        o.push(item);
      }
      m = null;
    }
  }
  return o;
}

async function userSession(r, e) {
  const t = cookies(r).VIP_USER_SESSION;
  if (!t) return null;
  const raw = await kv(e).get(USER_SESSION_PREFIX + t);
  if (!raw) return null;
  try { return { token: t, ...JSON.parse(raw) }; } catch { return null; }
}

async function handle(r, e) {
  const u = new URL(r.url), p = u.pathname;
  if (r.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }));

  if (p === '/api/online/ping' && r.method === 'POST') {
    const b = await r.json().catch(() => ({})), id = String(b.id || '').slice(0, 160);
    if (!id) return withCors(json({ ok: false, error: 'id required' }, 400));
    const now = Date.now(), online = cleanOnline(await readOnline(e), now);
    online[id] = now;
    await saveOnline(e, online);
    return withCors(json({ ok: true, online: Object.keys(online).length }));
  }

  if (p === '/api/online' && r.method === 'GET') {
    const raw = await readOnline(e), online = cleanOnline(raw);
    if (Object.keys(raw).length !== Object.keys(online).length) await saveOnline(e, online);
    return withCors(json({ ok: true, online: Object.keys(online).length }));
  }

  if (p === '/api/user/login' && r.method === 'POST') {
    const b = await r.json().catch(() => ({}));
    const username = String(b.username || b.name || '').trim().slice(0,100);
    const number = String(b.number || b.phone || '').trim().slice(0,30);
    const deviceId = String(b.deviceId || r.headers.get('X-ViP-Device-ID') || '').slice(0,160);
    const deviceName = String(b.deviceName || '').trim().slice(0,100) || 'Mobile Device';
    const ip = clientIP(r);
    if (username.length < 1 || !deviceId) return withCors(json({ ok:false, error:'Name and device information are required' },400));
    if (await deviceBlocked(e, deviceId)) return withCors(json({ ok:false,error:'This device has been blocked',blocked:true },403));

    const users = await readUsers(e);
    let user = users.find(x => String(x.username || '').toLowerCase() === username.toLowerCase());
    let created = false;
    if (!user) {
      user = { id:crypto.randomUUID(), username, createdAt:new Date().toISOString(), lastLoginAt:null, lastDeviceId:null, lastDeviceName:'', number:'', ip:'', activeSessionToken:null };
      users.push(user); created = true;
    }

    // One active device per account. Same device can log in again; another active device is rejected.
    if (user.activeSessionToken) {
      const activeRaw = await kv(e).get(USER_SESSION_PREFIX + user.activeSessionToken);
      if (activeRaw) {
        let active={}; try{active=JSON.parse(activeRaw)}catch{}
        if (active.deviceId && active.deviceId !== deviceId) {
          // Treat the same account + same number + same device name as a
          // re-login from the same physical device. This also recovers from
          // a stale/localStorage device-id after browser data was refreshed.
          const sameDeviceIdentity = String(user.number || '').trim() &&
            String(number || '').trim() &&
            String(user.number || '').trim() === String(number || '').trim() &&
            String(user.lastDeviceName || '').trim().toLowerCase() === String(deviceName || '').trim().toLowerCase();
          if (!sameDeviceIdentity) {
            return withCors(json({ok:false,error:'এই অ্যাকাউন্ট অন্য একটি ডিভাইসে লগইন করা আছে। আগে Logout করুন।',alreadyLoggedIn:true},409));
          }
        }
        await kv(e).delete(USER_SESSION_PREFIX + user.activeSessionToken);
      }
    }

    const now = new Date().toISOString();
    user.lastLoginAt=now; user.lastDeviceId=deviceId; user.lastDeviceName=deviceName; user.number=number || user.number || ''; user.ip=ip || user.ip || '—'; user.lastLoginBD=bangladeshTime(now); user.dailyWindowBD=bangladeshDailyWindow(now);
    const t=token(); user.activeSessionToken=t; await saveUsers(e,users);

    const ds=await readDevices(e);
    let d=ds.find(x=>x.deviceId===deviceId);
    if (d?.blocked) return withCors(json({ok:false,error:'This device has been blocked',blocked:true},403));
    if (!d) {
      d={deviceId,name:deviceName,deviceName,userName:username,username,number,ip,userId:user.id,userAgent:r.headers.get('user-agent')||'',approved:true,blocked:false,status:'Logged in',createdAt:now,lastSeen:now,lastLoginAt:now,lastLoginBD:bangladeshTime(now)};
      ds.push(d);
    } else {
      d.deviceName=deviceName; d.name=deviceName; d.userName=username; d.username=username; d.number=number || d.number || ''; d.ip=ip || d.ip || '—'; d.userId=user.id; d.approved=true; d.blocked=false; d.status='Logged in'; d.lastSeen=now; d.lastLoginAt=now; d.lastLoginBD=bangladeshTime(now);
    }
    await saveDevices(e,ds);
    await kv(e).put(USER_SESSION_PREFIX+t,JSON.stringify({userId:user.id,username:user.username,deviceId}),{expirationTtl:USER_TTL});
    return withCors(json({ok:true,created,username:user.username,user:{name:username,number,deviceName}},200,{headers:{'Set-Cookie':`VIP_USER_SESSION=${encodeURIComponent(t)}; Max-Age=${USER_TTL}; Path=/; HttpOnly; Secure; SameSite=Lax`}}));
  }

  if (p === '/api/user/session' && r.method === 'GET') {
    const s = await userSession(r, e);
    if (!s) return withCors(json({ ok: false, error: 'Unauthorized' }, 401));
    // Legacy Guest sessions are never treated as User sessions.
    // Current Guest mode is client-only and does not call this endpoint.
    if (s.guest) return withCors(json({ ok: true, guest: true, username: 'Guest' }));
    if (s.deviceId) {
      const d = (await readDevices(e)).find(x => x.deviceId === s.deviceId);
      if (!d) return withCors(json({ ok: false, error: 'Account removed', reason: 'removed' }, 401));
    }
    if (await deviceBlocked(e, s.deviceId)) return withCors(json({ ok: false, error: 'Blocked', blocked: true }, 403));
    return withCors(json({ ok: true, username: s.username }));
  }

  if (p === '/api/user/logout' && r.method === 'POST') {
    const t = cookies(r).VIP_USER_SESSION;
    if (t) {
      const raw = await kv(e).get(USER_SESSION_PREFIX + t);
      if (raw) {
        try {
          const s = JSON.parse(raw), users = await readUsers(e), u0 = users.find(x => x.id === s.userId);
          if (u0 && u0.activeSessionToken === t) { u0.activeSessionToken = null; await saveUsers(e, users); }
        } catch {}
      }
      await kv(e).delete(USER_SESSION_PREFIX + t);
    }
    return withCors(json({ ok: true }, 200, { headers: { 'Set-Cookie': 'VIP_USER_SESSION=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax' } }));
  }

  if (p === '/api/admin/login' && r.method === 'POST') {
    const b = await r.json().catch(() => ({}));
    if (!adminPassword(e) || String(b.password || '') !== adminPassword(e)) return withCors(json({ ok: false, error: 'Unauthorized' }, 401));
    const t = token();
    await kv(e).put(ADMIN_SESSION_PREFIX + t, '1', { expirationTtl: ADMIN_TTL });
    return withCors(json({ ok: true, expiresIn: ADMIN_TTL }, 200, { headers: { 'Set-Cookie': `VIP_ADMIN_SESSION=${t}; Max-Age=${ADMIN_TTL}; Path=/; HttpOnly; Secure; SameSite=Lax` } }));
  }

  if (p === '/api/admin/session' && r.method === 'GET') return withCors((await authorized(r, e)) ? json({ ok: true, expiresIn: ADMIN_TTL }) : json({ ok: false, error: 'Unauthorized' }, 401));
  if (p === '/api/admin/logout' && r.method === 'POST') {
    const t = cookies(r).VIP_ADMIN_SESSION;
    if (t) await kv(e).delete(ADMIN_SESSION_PREFIX + t);
    return withCors(json({ ok: true }, 200, { headers: { 'Set-Cookie': 'VIP_ADMIN_SESSION=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax' } }));
  }

  if (r.method === 'GET' && p === '/api/state') {
    const s = await readState(e);
    return withCors(json({ channels: s.channels || [], tvChannels: s.tvChannels || [], movieSeries: s.movieSeries || [], categories: s.categories || [], notice: s.notice || {}, headline: s.headline || '' }));
  }
  if (r.method === 'GET' && p === '/api/playlist') {
    const s = await readState(e);
    return withCors(json({ channels: s.channels || [] }));
  }

  if (p === '/api/device/register' && r.method === 'POST') {
    const b=await r.json().catch(()=>({})), id=String(b.deviceId||r.headers.get('X-ViP-Device-ID')||'');
    if(!id)return withCors(json({ok:false,error:'deviceId required'},400));
    const ds=await readDevices(e); let d=ds.find(x=>x.deviceId===id);
    if(d?.blocked)return withCors(json({ok:false,error:'Blocked',blocked:true},403));
    const now=new Date().toISOString(), number=String(b.number||b.phone||'').trim().slice(0,30), ip=clientIP(r);
    const deviceName=String(b.deviceName||b.name||'Mobile Device').slice(0,100);
    const explicitUserName=String(b.userName||b.username||'').trim().slice(0,100);
    if(!d){ d={deviceId:id,name:deviceName,deviceName,userName:explicitUserName||'Guest',username:explicitUserName||'Guest',number,ip,userAgent:String(b.userAgent||r.headers.get('user-agent')||'').slice(0,200),approved:true,blocked:false,status:'Logged in',createdAt:now,lastSeen:now,lastLoginAt:now,lastLoginBD:bangladeshTime(now)}; ds.push(d); }
    else { d.name=deviceName||d.name; d.deviceName=deviceName||d.deviceName||d.name; if(explicitUserName){d.userName=explicitUserName;d.username=explicitUserName;} d.number=number||d.number||''; d.ip=ip||d.ip||'—'; d.approved=true; d.blocked=false; d.status='Logged in'; d.lastSeen=now; d.lastLoginAt=now; d.lastLoginBD=bangladeshTime(now); }
    await saveDevices(e,ds); return withCors(json({ok:true,autoLogin:true,device:d,settings:await readSettings(e)}));
  }

  if (p === '/api/guest/register' && r.method === 'POST') {
    const b = await r.json().catch(() => ({})), id = String(b.deviceId || b.visitorId || r.headers.get('X-ViP-Device-ID') || '');
    if (!id) return withCors(json({ ok: false, error: 'deviceId required' }, 400));
    const ds = await readDevices(e); let d = ds.find(x => x.deviceId === id);
    if (d?.blocked) return withCors(json({ ok:false, blocked:true, error:'Blocked' },403));
    const now=new Date().toISOString(), ip=clientIP(r), deviceName=String(b.deviceName||'Guest Device').slice(0,100);
    if(!d){ d={deviceId:id,name:deviceName,deviceName,userName:'Guest',username:'Guest',number:'',ip,userAgent:r.headers.get('user-agent')||'',approved:true,blocked:false,status:'Logged in',createdAt:now,lastSeen:now,lastLoginAt:now,lastLoginBD:bangladeshTime(now)}; ds.push(d); }
    else { d.name=deviceName; d.deviceName=deviceName; d.userName=d.userName||'Guest'; d.username=d.userName; d.ip=ip; d.approved=true; d.status='Logged in'; d.lastSeen=now; d.lastLoginAt=now; d.lastLoginBD=bangladeshTime(now); }
    await saveDevices(e,ds);
    const t=token();
    await kv(e).put(USER_SESSION_PREFIX+t,JSON.stringify({userId:null,username:d.userName||'Guest',deviceId:id,guest:true}),{expirationTtl:USER_TTL});
    return withCors(json({ok:true,autoLogin:true,guest:true,device:d},200,{headers:{'Set-Cookie':`VIP_USER_SESSION=${encodeURIComponent(t)}; Max-Age=${USER_TTL}; Path=/; HttpOnly; Secure; SameSite=Lax`}}));
  }

  if (p === '/api/device/check' && r.method === 'GET') {
    const id = u.searchParams.get('deviceId') || r.headers.get('X-ViP-Device-ID') || '';
    const d = (await readDevices(e)).find(x => x.deviceId === id);
    if (d?.blocked) return withCors(json({ ok: false, approved: false, blocked: true, device: d, settings: await readSettings(e) }, 403));
    return withCors(json({ ok: true, approved: !!d?.approved, device: d || null, settings: await readSettings(e) }));
  }

  const g = await requireAdmin(r, e);
  if (g) return withCors(g);

  if (p === '/api/admin/ping' && r.method === 'GET') return withCors(json({ ok: true, connected: true }));
  if (p === '/api/admin/state' && r.method === 'GET') return withCors(json({ ok: true, state: await readState(e) }));
  if (p === '/api/admin/state' && r.method === 'PUT') {
    const b = await r.json().catch(() => ({})), s = { ...(await readState(e)), ...b };
    if (Array.isArray(b.tvChannels)) s.tvChannels = b.tvChannels.map(norm);
    if (Array.isArray(b.movieSeries)) s.movieSeries = b.movieSeries.map(c => ({ ...norm(c), category: 'MOVIE & SERIES' }));
    if (Array.isArray(b.channels) && !Array.isArray(b.tvChannels) && !Array.isArray(b.movieSeries)) s.channels = b.channels.map(norm);
    await saveState(e, s);
    return withCors(json({ ok: true, state: await readState(e) }));
  }

  if (p === '/api/admin/users' && r.method === 'GET') {
    const users = await readUsers(e), ds = await readDevices(e);
    const isGuestDevice = d => !!d?.guest || String(d?.username || d?.userName || '').trim().toLowerCase() === 'guest';
    const safe = users.filter(u => String(u?.username || '').trim().toLowerCase() !== 'guest').map(u => ({
      id: u.id, username: u.username, number: u.number || '', createdAt: u.createdAt || null,
      lastLoginAt: u.lastLoginAt || null, lastDeviceId: u.lastDeviceId || null,
      lastDeviceName: u.lastDeviceName || '',
      devices: ds.filter(d => !isGuestDevice(d) && d.username === u.username).map(d => ({ deviceId: d.deviceId, name: d.name, status: d.status || '', blocked: !!d.blocked, lastSeen: d.lastSeen || null }))
    }));
    safe.sort((a, b) => String(b.lastLoginAt || '').localeCompare(String(a.lastLoginAt || '')));
    const latestUser = safe[0] || null; return withCors(json({ ok: true, users: safe, latest: latestUser }));
  }

  if (p === '/api/admin/users/reset-password' && r.method === 'POST') {
    const b = await r.json().catch(() => ({})), id = String(b.userId || ''), newPassword = String(b.newPassword || '');
    if (newPassword.length < 4) return withCors(json({ ok: false, error: 'Password must be at least 4 characters' }, 400));
    const users = await readUsers(e), u0 = users.find(x => x.id === id);
    if (!u0) return withCors(json({ ok: false, error: 'User not found' }, 404));
    u0.salt = crypto.randomUUID();
    u0.passwordHash = await hash(u0.salt + newPassword);
    u0.passwordChangedAt = new Date().toISOString();
    await saveUsers(e, users);
    return withCors(json({ ok: true }));
  }

  if (p === '/api/admin/devices' && r.method === 'GET') {
    const devices = await readDevices(e);
    return withCors(json({ ok: true, devices, settings: await readSettings(e) }));
  }
  for (const action of ['block', 'unblock', 'approve']) {
    if (p === '/api/admin/devices/' + action && r.method === 'POST') {
      const b = await r.json().catch(() => ({})), ds = await readDevices(e), d = ds.find(x => x.deviceId === String(b.deviceId || ''));
      if (!d) return withCors(json({ ok: false, error: 'Device not found' }, 404));
      const users = await readUsers(e);
      const u0 = users.find(x => (d.userId && x.id === d.userId) || (d.username && String(x.username).toLowerCase() === String(d.username).toLowerCase()));
      if (action === 'block') { d.blocked = true; d.approved = false; d.status = 'Blocked'; if (u0?.activeSessionToken) { await kv(e).delete(USER_SESSION_PREFIX + u0.activeSessionToken); u0.activeSessionToken = null; } }
      if (action === 'unblock') { d.blocked = false; d.approved = true; d.status = 'Logged out'; }
      if (action === 'approve') { d.approved = true; d.blocked = false; d.status = 'Logged in'; }
      if (u0) await saveUsers(e, users); await saveDevices(e, ds);
      return withCors(json({ ok: true, device: d }));
    }
  }

  if (p === '/api/admin/devices' && r.method === 'DELETE') {
    const id = u.searchParams.get('deviceId') || ''; const ds = await readDevices(e), d = ds.find(x => x.deviceId === id);
    if (d) { const users = await readUsers(e), u0 = users.find(x => (d.userId && x.id === d.userId) || (d.username && String(x.username).toLowerCase() === String(d.username).toLowerCase())); if (u0?.activeSessionToken) { await kv(e).delete(USER_SESSION_PREFIX + u0.activeSessionToken); u0.activeSessionToken = null; await saveUsers(e, users); } }
    await saveDevices(e, ds.filter(x => x.deviceId !== id)); return withCors(json({ ok: true, removed: true }));
  }

  if (p === '/api/admin/settings' && r.method === 'GET') return withCors(json({ ok: true, settings: await readSettings(e) }));
  if (p === '/api/admin/settings' && r.method === 'PUT') {
    const b = await r.json().catch(() => ({})), s = { ...(await readSettings(e)), ...b };
    await kv(e).put(SETTINGS_KEY, JSON.stringify(s));
    return withCors(json({ ok: true, settings: s }));
  }

  async function importPlaylistFromUrl(target, movie = false) {
    const x = await fetch(target);
    if (!x.ok) throw new Error('M3U URL failed');
    const s = await readState(e);
    if (movie) s.movieSeries = parseM3U(await x.text(), true);
    else s.tvChannels = parseM3U(await x.text(), false);
    await saveState(e, s);
    return readState(e);
  }
  if ((p === '/api/admin/import-m3u-url' || p === '/api/admin/import-tv-m3u-url') && r.method === 'POST') {
    const b = await r.json().catch(() => ({})), target = String(b.url || '');
    if (!/^https?:\/\//i.test(target)) return withCors(json({ ok: false, error: 'Invalid M3U URL' }, 400));
    try { const s = await importPlaylistFromUrl(target, false); return withCors(json({ ok: true, count: s.tvChannels.length, state: s })); }
    catch (err) { return withCors(json({ ok: false, error: err.message }, 400)); }
  }
  if (p === '/api/admin/import-movie-m3u-url' && r.method === 'POST') {
    const b = await r.json().catch(() => ({})), target = String(b.url || '');
    if (!/^https?:\/\//i.test(target)) return withCors(json({ ok: false, error: 'Invalid M3U URL' }, 400));
    try { const s = await importPlaylistFromUrl(target, true); return withCors(json({ ok: true, count: s.movieSeries.length, state: s })); }
    catch (err) { return withCors(json({ ok: false, error: err.message }, 400)); }
  }
  if ((p === '/api/admin/import-m3u' || p === '/api/admin/import-tv-m3u') && r.method === 'POST') {
    const b = await r.text(), s = await readState(e);
    s.tvChannels = parseM3U(b, false);
    await saveState(e, s);
    return withCors(json({ ok: true, count: s.tvChannels.length, state: await readState(e) }));
  }
  if (p === '/api/admin/import-movie-m3u' && r.method === 'POST') {
    const b = await r.text(), s = await readState(e);
    s.movieSeries = parseM3U(b, true);
    await saveState(e, s);
    return withCors(json({ ok: true, count: s.movieSeries.length, state: await readState(e) }));
  }

  return withCors(json({ ok: false, error: 'API route not found' }, 404));
}

export default {
  async fetch(r, e) {
    return new URL(r.url).pathname.startsWith('/api/') ? handle(r, e) : e.ASSETS.fetch(r);
  }
};
