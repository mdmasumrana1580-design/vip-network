const STATE_KEY='vip_state_v1',
DEVICES_KEY='vip_devices_v1',
SETTINGS_KEY='vip_settings_v1',
USERS_KEY='vip_users_v1',
ONLINE_KEY='vip_online_v1',
ADMIN_SESSION_PREFIX='vip_admin_session:',
USER_SESSION_PREFIX='vip_user_session:',
ADMIN_TTL=1800;

const adminPassword=e=>e.ADMIN_PASSWORD||e.ADMIN_PASSWOED||'';
const kv=e=>e.VIP_PLAYLIST||e.PLAYLIST_KV;

const ONLINE_MEMORY=new Map();

const cors={
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers':'Content-Type, Authorization, X-ViP-Device-ID'
};

const json=(d,s=200,x={})=>{
  const h=new Headers({
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    ...(x.headers||{})
  });

  return new Response(
    JSON.stringify(d),
    {
      status:s,
      headers:h
    }
  );
};

const withCors=r=>{
  const h=new Headers(r.headers);

  for(const [k,v] of Object.entries(cors)){
    h.set(k,v);
  }

  return new Response(
    r.body,
    {
      status:r.status,
      headers:h
    }
  );
};

function cookies(r){
  const o={};

  (r.headers.get('Cookie')||'')
    .split(';')
    .forEach(p=>{
      const i=p.indexOf('=');

      if(i>0){
        o[p.slice(0,i).trim()]=decodeURIComponent(
          p.slice(i+1).trim()
        );
      }
    });

  return o;
}

function norm(c={}){
  return {
    name:String(c.name||c.title||'Unnamed'),
    category:String(
      c.category||
      c.group||
      c.groupTitle||
      'Other'
    ),
    logo:String(
      c.logo||
      c.tvgLogo||
      c['tvg-logo']||
      ''
    ),
    url:String(
      c.url||
      c.stream||
      c.streamUrl||
      ''
    ),
    status:String(c.status||'Unknown')
  };
}

async function readState(e){
  const r=await kv(e).get(STATE_KEY);

  try{
    return r
      ? JSON.parse(r)
      : {
          channels:[],
          notice:{
            text:'',
            type:'Information',
            enabled:true
          },
          headline:''
        };
  }catch{
    return {
      channels:[],
      notice:{},
      headline:''
    };
  }
}

async function saveState(e,s){
  await kv(e).put(
    STATE_KEY,
    JSON.stringify(s)
  );
}

async function readDevices(e){
  try{
    return JSON.parse(
      (await kv(e).get(DEVICES_KEY))||'[]'
    );
  }catch{
    return [];
  }
}

async function saveDevices(e,x){
  const data=JSON.stringify(
    Array.isArray(x)?x:[]
  );

  let last;

  for(let i=0;i<2;i++){
    try{
      await kv(e).put(
        DEVICES_KEY,
        data
      );

      return true;

    }catch(err){
      last=err;
    }
  }

  throw last||new Error(
    'Device data could not be saved'
  );
}

async function readSettings(e){
  try{
    return JSON.parse(
      (await kv(e).get(SETTINGS_KEY))||
      '{"deviceLimit":1,"accessMode":"approval"}'
    );
  }catch{
    return {
      deviceLimit:1,
      accessMode:'approval'
    };
  }
}

async function readUsers(e){
  try{
    return JSON.parse(
      (await kv(e).get(USERS_KEY))||'[]'
    );
  }catch{
    return [];
  }
}

async function saveUsers(e,x){
  const data=JSON.stringify(
    Array.isArray(x)?x:[]
  );

  await kv(e).put(
    USERS_KEY,
    data
  );

  return true;
}

function cleanOnlineMap(now=Date.now()){
  for(const [k,v] of ONLINE_MEMORY){
    if(now-v>=120000){
      ONLINE_MEMORY.delete(k);
    }
  }
}

async function hash(s){
  const b=await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(s)
  );

  return [
    ...new Uint8Array(b)
  ]
    .map(x=>x.toString(16).padStart(2,'0'))
    .join('');
}

function token(){
  return crypto.randomUUID();
}

async function deviceBlocked(e,id){
  if(!id) return false;

  const d=(await readDevices(e))
    .find(x=>x.deviceId===id);

  return !!d?.blocked;
}

async function adminCookie(r,e){
  const t=cookies(r).VIP_ADMIN_SESSION;

  if(!t) return false;

  const [ts,sig]=String(t).split('.');
  const n=Number(ts);

  if(
    !Number.isFinite(n)||
    Date.now()-n>ADMIN_TTL*1000
  ){
    return false;
  }

  const key=await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(
      adminPassword(e)
    ),
    {
      name:'HMAC',
      hash:'SHA-256'
    },
    false,
    ['verify']
  );

  const data=new TextEncoder().encode(
    String(ts)
  );

  const bytes=new Uint8Array(
    (sig||'')
      .match(/.{1,2}/g)
      ?.map(h=>parseInt(h,16))||[]
  );

  return (
    bytes.length===32 &&
    await crypto.subtle.verify(
      'HMAC',
      key,
      bytes,
      data
    )
  );
}

async function adminCookieToken(e){
  const ts=String(Date.now());

  const key=await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(
      adminPassword(e)
    ),
    {
      name:'HMAC',
      hash:'SHA-256'
    },
    false,
    ['sign']
  );

  const b=new Uint8Array(
    await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(ts)
    )
  );

  const sig=[
    ...b
  ]
    .map(x=>x.toString(16).padStart(2,'0'))
    .join('');

  return ts+'.'+sig;
}

async function authorized(r,e){
  const p=adminPassword(e);

  if(!p) return false;

  if(await adminCookie(r,e)){
    return true;
  }

  return (
    r.headers.get('Authorization')===
    `Bearer ${p}`
  );
}

async function requireAdmin(r,e){
  return(
    await authorized(r,e)
  )
    ?null
    :json(
      {
        ok:false,
        error:'Unauthorized'
      },
      401
    );
}

function parseM3U(t){
  const a=String(t||'')
    .replace(/\r/g,'')
    .split('\n');

  const o=[];
  let m=null;

  for(const q of a){

    const l=q.trim();

    if(l.startsWith('#EXTINF')){

      const c=l.indexOf(',');
      const gm=l.match(
        /group-title="([^"]*)"/i
      );
      const lm=l.match(
        /tvg-logo="([^"]*)"/i
      );

      m={
        name:
          c>=0
            ?l.slice(c+1).trim()
            :'Live Channel',

        category:
          gm
            ?gm[1]
            :'Other',

        logo:
          lm
            ?lm[1]
            :''
      };

      continue;
    }

    if(
      l &&
      !l.startsWith('#') &&
      m
    ){

      if(
        /^(https?|rtmp|rtsp|hls):\/\//i
          .test(l)
      ){

        o.push(
          norm({
            ...m,
            url:l,
            status:'Unknown'
          })
        );

      }

      m=null;
    }
  }

  return o;
}

async function userSession(r,e){
  const t=cookies(r).VIP_USER_SESSION;

  if(!t) return null;

  const raw=await kv(e).get(
    USER_SESSION_PREFIX+t
  );

  if(!raw) return null;

  try{
    return{
      token:t,
      ...JSON.parse(raw)
    };
  }catch{
    return null;
  }
}

function normalizeNumber(s){
  return String(s||'')
    .replace(/[০-৯]/g,c=>
      String(
        '০১২৩৪৫৬৭৮৯'.indexOf(c)
      )
    )
    .replace(/[^0-9+]/g,'');
}

async function handle(r,e){

  const u=new URL(r.url);
  const p=u.pathname;

  if(r.method==='OPTIONS'){
    return withCors(
      new Response(null,{status:204})
    );
  }

  if(
    p==='/api/online/ping' &&
    r.method==='POST'
  ){

    const b=await r.json().catch(()=>({}));

    const id=String(
      b.id||''
    ).slice(0,160);

    if(!id){
      return withCors(
        json(
          {
            ok:false,
            error:'id required'
          },
          400
        )
      );
    }

    const now=Date.now();

    cleanOnlineMap(now);

    ONLINE_MEMORY.set(
      id,
      now
    );

    return withCors(
      json({
        ok:true,
        online:ONLINE_MEMORY.size
      })
    );
  }

  if(
    p==='/api/online' &&
    r.method==='GET'
  ){

    cleanOnlineMap();

    return withCors(
      json({
        ok:true,
        online:ONLINE_MEMORY.size
      })
    );
  }

  /*
   * =====================================================
   * USER LOGIN
   * Username + Number + Device Name
   * NO PASSWORD
   * =====================================================
   */

  if(
    p==='/api/user/login' &&
    r.method==='POST'
  ){

    try{

      const b=await r.json().catch(()=>({}));

      const username=String(
        b.username||
        b.name||
        ''
      )
        .trim()
        .slice(0,100);

      const number=normalizeNumber(
        b.number||''
      ).slice(0,20);

      const deviceId=String(
        b.deviceId||
        r.headers.get(
          'X-ViP-Device-ID'
        )||
        ''
      ).slice(0,160);

      const deviceName=String(
        b.deviceName||
        'Unknown device'
      )
        .trim()
        .slice(0,100);

      if(username.length<2){

        return withCors(
          json(
            {
              ok:false,
              error:'নাম / Username দিন'
            },
            400
          )
        );
      }

      if(number.length<6){

        return withCors(
          json(
            {
              ok:false,
              error:'সঠিক নাম্বার দিন'
            },
            400
          )
        );
      }

      if(deviceName.length<2){

        return withCors(
          json(
            {
              ok:false,
              error:'Device Name দিন'
            },
            400
          )
        );
      }

      if(
        await deviceBlocked(
          e,
          deviceId
        )
      ){

        return withCors(
          json(
            {
              ok:false,
              error:'This device has been blocked',
              blocked:true
            },
            403
          )
        );
      }

      const users=await readUsers(e);

      let user=users.find(
        x=>
          String(
            x.username||''
          ).toLowerCase()===
          username.toLowerCase()
      );

      let created=false;

      /*
       * নতুন Username হলে account তৈরি হবে
       */

      if(!user){

        const salt=
          crypto.randomUUID();

        user={
          id:crypto.randomUUID(),

          username,

          numberHash:
            await hash(
              salt+number
            ),

          numberSalt:salt,

          createdAt:
            new Date().toISOString(),

          lastLoginAt:null,

          lastDeviceId:null,

          lastDeviceName:''
        };

        users.push(user);

        created=true;

      }else{

        /*
         * পুরোনো Username হলে
         * Number verify হবে
         */

        const stored=String(
          user.numberHash||''
        );

        const salt=String(
          user.numberSalt||''
        );

        if(!stored||!salt){

          return withCors(
            json(
              {
                ok:false,
                error:
                  'এই অ্যাকাউন্টে নাম্বার সেট করা হয়নি। Admin থেকে Set Number করুন।',
                needsNumber:true
              },
              409
            )
          );
        }

        const incomingHash=
          await hash(
            salt+number
          );

        if(
          stored!==incomingHash
        ){

          return withCors(
            json(
              {
                ok:false,
                error:
                  'Username বা Number সঠিক নয়'
              },
              401
            )
          );
        }
      }

      /*
       * User information update
       */

      user.lastLoginAt=
        new Date().toISOString();

      user.lastDeviceId=
        deviceId||
        user.lastDeviceId||
        null;

      user.lastDeviceName=
        deviceName||
        user.lastDeviceName||
        '';

      await saveUsers(
        e,
        users
      );

      /*
       * Device save / update
       */

      if(deviceId){

        const ds=
          await readDevices(e);

        let d=ds.find(
          x=>
            String(
              x?.deviceId||''
            )===deviceId
        );

        if(d?.blocked){

          return withCors(
            json(
              {
                ok:false,
                error:
                  'This device has been blocked',
                blocked:true
              },
              403
            )
          );
        }

        const now=
          new Date().toISOString();

        if(!d){

          d={
            deviceId:deviceId,

            name:
              deviceName||
              'Unknown device',

            userAgent:
              r.headers.get(
                'user-agent'
              )||'',

            approved:true,

            blocked:false,

            status:'Logged in',

            createdAt:now,

            lastSeen:now,

            username:user.username
          };

          /*
           * IMPORTANT:
           * নতুন device অবশ্যই list-এ add হবে
           */
          ds.push(d);

        }else{

          d.name=
            deviceName||
            d.name||
            'Unknown device';

          d.username=
            user.username;

          d.lastSeen=now;

          d.status=
            'Logged in';

          d.approved=true;

          d.blocked=false;
        }

        await saveDevices(
          e,
          ds
        );
      }

      /*
       * Create user session
       */

      const t=token();

      await kv(e).put(
        USER_SESSION_PREFIX+t,
        JSON.stringify({
          userId:user.id,

          username:user.username,

          deviceId:deviceId,

          createdAt:
            new Date().toISOString()
        })
      );

      return withCors(
        json(
          {
            ok:true,
            created:created,
            username:user.username
          },
          200,
          {
            headers:{
              'Set-Cookie':
                `VIP_USER_SESSION=${encodeURIComponent(t)}; Expires=Fri, 31 Dec 2099 23:59:59 GMT; Path=/; HttpOnly; Secure; SameSite=Lax`
            }
          }
        )
      );

    }catch(err){

      return withCors(
        json(
          {
            ok:false,
            error:
              'Login server error. আবার চেষ্টা করুন।'
          },
          500
        )
      );
    }
  }

  /*
   * USER SESSION
   */

  if(
    p==='/api/user/session' &&
    r.method==='GET'
  ){

    const s=
      await userSession(r,e);

    if(!s){

      return withCors(
        json(
          {
            ok:false,
            error:'Unauthorized'
          },
          401
        )
      );
    }

    const ds=
      await readDevices(e);

    const d=ds.find(
      x=>
        String(
          x?.deviceId||''
        )===
        String(
          s.deviceId||''
        )
    );

    if(!d){

      return withCors(
        json(
          {
            ok:false,
            error:'Device removed',
            removed:true
          },
          401
        )
      );
    }

    if(d.blocked){

      return withCors(
        json(
          {
            ok:false,
            error:'Blocked',
            blocked:true
          },
          403
        )
      );
    }

    return withCors(
      json({
        ok:true,
        username:s.username,
        deviceId:s.deviceId,
        device:d
      })
    );
  }

  /*
   * USER LOGOUT
   */

  if(
    p==='/api/user/logout' &&
    r.method==='POST'
  ){

    const t=
      cookies(r).VIP_USER_SESSION;

    if(t){
      await kv(e).delete(
        USER_SESSION_PREFIX+t
      );
    }

    return withCors(
      json(
        {
          ok:true
        },
        200,
        {
          headers:{
            'Set-Cookie':
              'VIP_USER_SESSION=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax'
          }
        }
      )
    );
  }

  /*
   * ADMIN LOGIN
   */

  if(
    p==='/api/admin/login' &&
    r.method==='POST'
  ){

    const b=
      await r.json().catch(()=>({}));

    if(
      !adminPassword(e)||
      String(
        b.password||
        b.adminPassword||
        ''
      )!==adminPassword(e)
    ){

      return withCors(
        json(
          {
            ok:false,
            error:'Unauthorized'
          },
          401
        )
      );
    }

    const t=
      await adminCookieToken(e);

    return withCors(
      json(
        {
          ok:true,
          expiresIn:ADMIN_TTL
        },
        200,
        {
          headers:{
            'Set-Cookie':
              `VIP_ADMIN_SESSION=${t}; Max-Age=${ADMIN_TTL}; Path=/; HttpOnly; Secure; SameSite=Lax`
          }
        }
      )
    );
  }

  /*
   * ADMIN SESSION
   */

  if(
    p==='/api/admin/session' &&
    r.method==='GET'
  ){

    return withCors(
      (
        await authorized(r,e)
      )
        ?json({
          ok:true,
          expiresIn:ADMIN_TTL
        })
        :json(
          {
            ok:false,
            error:'Unauthorized'
          },
          401
        )
    );
  }

  /*
   * ADMIN LOGOUT
   */

  if(
    p==='/api/admin/logout' &&
    r.method==='POST'
  ){

    return withCors(
      json(
        {
          ok:true
        },
        200,
        {
          headers:{
            'Set-Cookie':
              'VIP_ADMIN_SESSION=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax'
          }
        }
      )
    );
  }

  /*
   * PUBLIC STATE
   */

  if(
    r.method==='GET' &&
    p==='/api/state'
  ){

    const s=
      await readState(e);

    return withCors(
      json({
        channels:s.channels||[],
        notice:s.notice||{},
        headline:s.headline||''
      })
    );
  }

  if(
    r.method==='GET' &&
    p==='/api/playlist'
  ){

    const s=
      await readState(e);

    return withCors(
      json({
        channels:s.channels||[]
      })
    );
  }

  /*
   * DEVICE REGISTER
   */

  if(
    p==='/api/device/register' &&
    r.method==='POST'
  ){

    const b=
      await r.json().catch(()=>({}));

    const id=String(
      b.deviceId||
      r.headers.get(
        'X-ViP-Device-ID'
      )||
      ''
    );

    if(!id){

      return withCors(
        json(
          {
            ok:false,
            error:'deviceId required'
          },
          400
        )
      );
    }

    const ds=
      await readDevices(e);

    let d=
      ds.find(
        x=>x.deviceId===id
      );

    if(d?.blocked){

      return withCors(
        json(
          {
            ok:false,
            error:'Blocked',
            blocked:true
          },
          403
        )
      );
    }

    if(!d){

      d={
        deviceId:id,

        name:String(
          b.name||
          'Unknown device'
        ),

        userAgent:String(
          b.userAgent||
          r.headers.get(
            'user-agent'
          )||
          ''
        ).slice(0,200),

        approved:false,

        blocked:false,

        createdAt:
          new Date().toISOString(),

        lastSeen:
          new Date().toISOString()
      };

      ds.push(d);

    }else{

      d.lastSeen=
        new Date().toISOString();
    }

    await saveDevices(
      e,
      ds
    );

    return withCors(
      json({
        ok:true,
        device:d,
        settings:
          await readSettings(e)
      })
    );
  }

  /*
   * DEVICE CHECK
   */

  if(
    p==='/api/device/check' &&
    r.method==='GET'
  ){

    const id=
      u.searchParams.get(
        'deviceId'
      )||
      r.headers.get(
        'X-ViP-Device-ID'
      )||
      '';

    const d=
      (await readDevices(e))
        .find(
          x=>x.deviceId===id
        );

    if(d?.blocked){

      return withCors(
        json(
          {
            ok:false,
            approved:false,
            blocked:true,
            device:d,
            settings:
              await readSettings(e)
          },
          403
        )
      );
    }

    return withCors(
      json({
        ok:true,
        approved:!!d?.approved,
        device:d||null,
        settings:
          await readSettings(e)
      })
    );
  }

  /*
   * ADMIN AUTHORIZATION
   */

  const g=
    await requireAdmin(r,e);

  if(g){
    return withCors(g);
  }

  /*
   * ADMIN PING
   */

  if(
    p==='/api/admin/ping' &&
    r.method==='GET'
  ){

    return withCors(
      json({
        ok:true,
        connected:true
      })
    );
  }

  /*
   * ADMIN STATE
   */

  if(
    p==='/api/admin/state' &&
    r.method==='GET'
  ){

    return withCors(
      json({
        ok:true,
        state:
          await readState(e)
      })
    );
  }

  if(
    p==='/api/admin/state' &&
    r.method==='PUT'
  ){

    const b=
      await r.json().catch(()=>({}));

    const s={
      ...(await readState(e)),
      ...b
    };

    if(
      Array.isArray(
        b.channels
      )
    ){

      s.channels=
        b.channels.map(norm);
    }

    await saveState(
      e,
      s
    );

    return withCors(
      json({
        ok:true,
        state:s
      })
    );
  }

  /*
   * ADMIN USERS
   */

  if(
    p==='/api/admin/users' &&
    r.method==='GET'
  ){

    const users=
      await readUsers(e);

    const ds=
      await readDevices(e);

    const safe=
      users.map(u=>({
        id:u.id,

        username:u.username,

        createdAt:
          u.createdAt||null,

        lastLoginAt:
          u.lastLoginAt||null,

        lastDeviceId:
          u.lastDeviceId||null,

        lastDeviceName:
          u.lastDeviceName||'',

        devices:
          ds
            .filter(
              d=>d.username===u.username
            )
            .map(d=>({
              deviceId:d.deviceId,
              name:d.name,
              status:d.status||'',
              blocked:!!d.blocked,
              lastSeen:d.lastSeen||null
            }))
      }));

    return withCors(
      json({
        ok:true,
        users:safe
      })
    );
  }

  /*
   * ADMIN SET NUMBER
   */

  if(
    (
      p==='/api/admin/users/set-number'||
      p==='/api/admin/users/reset-password'
    ) &&
    r.method==='POST'
  ){

    const b=
      await r.json().catch(()=>({}));

    const id=
      String(
        b.userId||''
      );

    const users=
      await readUsers(e);

    const u=
      users.find(
        x=>x.id===id
      );

    if(!u){

      return withCors(
        json(
          {
            ok:false,
            error:'User not found'
          },
          404
        )
      );
    }

    if(
      p==='/api/admin/users/set-number'||
      b.newNumber!==undefined
    ){

      const n=
        normalizeNumber(
          b.number??
          b.newNumber??
          ''
        );

      if(n.length<6){

        return withCors(
          json(
            {
              ok:false,
              error:
                'Number must be at least 6 digits'
            },
            400
          )
        );
      }

      u.numberSalt=
        crypto.randomUUID();

      u.numberHash=
        await hash(
          u.numberSalt+n
        );

      u.numberChangedAt=
        new Date().toISOString();

      await saveUsers(
        e,
        users
      );

      return withCors(
        json({
          ok:true,
          type:'number'
        })
      );
    }

    const newPassword=
      String(
        b.newPassword||''
      );

    if(newPassword.length<4){

      return withCors(
        json(
          {
            ok:false,
            error:
              'Password must be at least 4 characters'
          },
          400
        )
      );
    }

    u.salt=
      crypto.randomUUID();

    u.passwordHash=
      await hash(
        u.salt+
        newPassword
      );

    u.passwordChangedAt=
      new Date().toISOString();

    await saveUsers(
      e,
      users
    );

    return withCors(
      json({
        ok:true,
        type:'password'
      })
    );
  }

  /*
   * ADMIN DEVICES
   */

  if(
    p==='/api/admin/devices' &&
    r.method==='GET'
  ){

    const list=
      (await readDevices(e))
        .sort(
          (a,b)=>
            (
              Date.parse(
                b.lastSeen||
                b.createdAt||
                ''
              )||0
            )-
            (
              Date.parse(
                a.lastSeen||
                a.createdAt||
                ''
              )||0
            )
        );

    return withCors(
      json({
        ok:true,
        devices:list,
        settings:
          await readSettings(e)
      })
    );
  }

  /*
   * ADMIN DEVICE ACTIONS
   */

  for(
    const action of [
      'block',
      'unblock',
      'approve'
    ]
  ){

    if(
      p==='/api/admin/devices/'+action &&
      r.method==='POST'
    ){

      try{

        const b=
          await r.json().catch(()=>({}));

        const id=
          String(
            b.deviceId||''
          ).trim();

        if(!id){

          return withCors(
            json(
              {
                ok:false,
                error:'deviceId required'
              },
              400
            )
          );
        }

        const ds=
          await readDevices(e);

        const d=
          ds.find(
            x=>
              String(
                x?.deviceId||''
              )===id
          );

        if(!d){

          return withCors(
            json(
              {
                ok:false,
                error:'Device not found'
              },
              404
            )
          );
        }

        if(action==='block'){

          d.blocked=true;
          d.approved=false;
          d.status='Blocked';
        }

        if(action==='unblock'){

          d.blocked=false;
          d.approved=false;
          d.status='Logged out';
        }

        if(action==='approve'){

          d.approved=true;
          d.blocked=false;
          d.status='Approved';
        }

        d.updatedAt=
          new Date().toISOString();

        await saveDevices(
          e,
          ds
        );

        return withCors(
          json({
            ok:true,
            device:d
          })
        );

      }catch(err){

        return withCors(
          json(
            {
              ok:false,
              error:
                'Device update could not be saved. Please retry.'
            },
            503
          )
        );
      }
    }
  }

  /*
   * ADMIN DEVICE DELETE
   */

  if(
    p==='/api/admin/devices' &&
    r.method==='DELETE'
  ){

    try{

      const id=
        String(
          u.searchParams.get(
            'deviceId'
          )||''
        ).trim();

      if(!id){

        return withCors(
          json(
            {
              ok:false,
              error:'deviceId required'
            },
            400
          )
        );
      }

      const ds=
        await readDevices(e);

      const next=
        ds.filter(
          x=>
            String(
              x?.deviceId||''
            )!==id
        );

      await saveDevices(
        e,
        next
      );

      return withCors(
        json({
          ok:true,
          deleted:
            next.length!==ds.length
        })
      );

    }catch(err){

      return withCors(
        json(
          {
            ok:false,
            error:
              'Device delete could not be saved. Please retry.'
          },
          503
        )
      );
    }
  }

  /*
   * ADMIN SETTINGS
   */

  if(
    p==='/api/admin/settings' &&
    r.method==='GET'
  ){

    return withCors(
      json({
        ok:true,
        settings:
          await readSettings(e)
      })
    );
  }

  if(
    p==='/api/admin/settings' &&
    r.method==='PUT'
  ){

    const b=
      await r.json().catch(()=>({}));

    const s={
      ...(await readSettings(e)),
      ...b
    };

    await kv(e).put(
      SETTINGS_KEY,
      JSON.stringify(s)
    );

    return withCors(
      json({
        ok:true,
        settings:s
      })
    );
  }

  /*
   * ADMIN IMPORT M3U URL
   */

  if(
    p==='/api/admin/import-m3u-url' &&
    r.method==='POST'
  ){

    const b=
      await r.json().catch(()=>({}));

    if(
      !/^https?:\/\//i.test(
        String(b.url||'')
      )
    ){

      return withCors(
        json(
          {
            ok:false,
            error:'Invalid M3U URL'
          },
          400
        )
      );
    }

    const x=
      await fetch(b.url);

    const s=
      await readState(e);

    if(!x.ok){

      return withCors(
        json(
          {
            ok:false,
            error:'M3U URL failed'
          },
          400
        )
      );
    }

    s.channels=
      parseM3U(
        await x.text()
      );

    await saveState(
      e,
      s
    );

    return withCors(
      json({
        ok:true,
        count:s.channels.length
      })
    );
  }

  /*
   * ADMIN IMPORT M3U FILE
   */

  if(
    p==='/api/admin/import-m3u' &&
    r.method==='POST'
  ){

    const b=
      await r.text();

    const s=
      await readState(e);

    s.channels=
      parseM3U(b);

    await saveState(
      e,
      s
    );

    return withCors(
      json({
        ok:true,
        count:s.channels.length
      })
    );
  }

  /*
   * XTREAM IMPORT
   */

  if(
    p==='/api/xtream/import' &&
    r.method==='POST'
  ){

    try{

      const b=
        await r.json().catch(()=>({}));

      const server=
        String(
          b.server||''
        ).replace(/\/$/,'');

      const user=
        String(
          b.username||''
        );

      const pass=
        String(
          b.password||''
        );

      if(
        !/^https?:\/\//i.test(server)||
        !user||
        !pass
      ){

        return withCors(
          json(
            {
              ok:false,
              error:
                'Invalid Xtream credentials'
            },
            400
          )
        );
      }

      const q=
        server+
        '/player_api.php?username='+
        encodeURIComponent(user)+
        '&password='+
        encodeURIComponent(pass)+
        '&action=get_live_streams';

      const x=
        await fetch(q);

      if(!x.ok){

        return withCors(
          json(
            {
              ok:false,
              error:
                'Xtream server request failed'
            },
            400
          )
        );
      }

      const arr=
        await x.json();

      if(!Array.isArray(arr)){

        return withCors(
          json(
            {
              ok:false,
              error:
                'Xtream returned invalid data'
            },
            400
          )
        );
      }

      const limit=
        b.limit==='all'
          ?arr.length
          :Math.max(
            1,
            Math.min(
              arr.length,
              Number(b.limit)||100
            )
          );

      const items=
        arr
          .slice(0,limit)
          .map(v=>
            norm({
              name:
                v.name||
                v.stream_display_name||
                'Live Channel',

              category:
                v.category_name||
                v.category_id||
                'OTHERS',

              logo:
                v.stream_icon||
                '',

              url:
                server+
                '/live/'+
                encodeURIComponent(user)+
                '/'+
                encodeURIComponent(pass)+
                '/'+
                String(v.stream_id)+
                '.m3u8',

              status:'Active'
            })
          );

      const st=
        await readState(e);

      st.channels=items;

      await saveState(
        e,
        st
      );

      return withCors(
        json({
          ok:true,
          count:items.length
        })
      );

    }catch(err){

      return withCors(
        json(
          {
            ok:false,
            error:
              'Xtream import failed'
          },
          400
        )
      );
    }
  }

  return withCors(
    json(
      {
        ok:false,
        error:'API route not found'
      },
      404
    )
  );
}

export default{
  async fetch(r,e){

    return new URL(r.url)
      .pathname
      .startsWith('/api/')
      ?handle(r,e)
      :e.ASSETS.fetch(r);
  }
};
