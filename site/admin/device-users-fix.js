/* VIP-TV Admin — stable User & Device Management UI
 * Loaded after app.js. UI/API only; no worker changes.
 */
(function(){
  'use strict';
  const esc2=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const dateMs=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?t:0};
  const bdTime=v=>{
    if(!v)return '—';
    try{return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(v))+' BD'}catch{return String(v)}
  };
  const idOf=x=>String(x?.deviceId||x?.id||'');
  const isBlocked=x=>x?.blocked===true || String(x?.status||'').toLowerCase()==='blocked';

  function renderLatest(list){
    const box=document.getElementById('latestLoginBox');
    if(!box)return;
    const latest=list.find(x=>dateMs(x.lastLoginAt||x.lastLogin||x.lastSeen||x.createdAt)>0);
    if(!latest){box.hidden=true;box.innerHTML='';return;}
    box.hidden=false;
    const name=latest.userName||latest.username||latest.user||'Guest';
    const number=latest.number||latest.mobile||latest.phone||'—';
    const device=latest.deviceName||latest.name||'Mobile Device';
    const when=latest.lastLoginAt||latest.lastLogin||latest.lastSeen||latest.createdAt;
    box.innerHTML='<div class="latest-login-card"><div><span class="latest-kicker">LATEST LOGIN</span><strong>'+esc2(name)+'</strong><small>'+esc2(number)+' • '+esc2(device)+'</small></div><time>'+esc2(bdTime(when))+'</time></div>';
  }

  async function loadUsersFixed(){
    if(typeof connected!=='undefined' && !connected){
      const box=document.getElementById('deviceList'); if(box)box.textContent='Please login first.';
      return;
    }
    const box=document.getElementById('deviceList'); if(!box)return;
    box.innerHTML='<div class="loading-row">Loading users…</div>';
    try{
      const d=await api('/api/admin/devices');
      const list=(Array.isArray(d)?d:(d?.devices||d?.data||[])).slice().sort((a,b)=>{
        return dateMs(b.lastLoginAt||b.lastLogin||b.lastSeen||b.createdAt)-dateMs(a.lastLoginAt||a.lastLogin||a.lastSeen||a.createdAt);
      });
      renderLatest(list);
      const count=document.getElementById('deviceConnected'); if(count)count.textContent=list.length;
      const limit=d?.settings?.deviceLimit??d?.settings?.maxDevices??d?.deviceLimit;
      const allowed=document.getElementById('deviceAllowed'); if(allowed)allowed.textContent=limit??'—';
      if(!list.length){box.innerHTML='<div class="empty-row">No users registered.</div>';return;}
      box.innerHTML=list.map((x,i)=>{
        const id=esc2(idOf(x));
        const blocked=isBlocked(x);
        const name=x.userName||x.username||x.user||'Guest';
        const number=x.number||x.mobile||x.phone||'—';
        const device=x.deviceName||x.name||'Mobile Device';
        const ip=x.ip||x.ipAddress||'—';
        const when=x.lastLoginAt||x.lastLogin||x.lastSeen||x.createdAt||'';
        return '<article class="device-user-card '+(blocked?'is-blocked':'')+'">'
          +'<div class="device-card-head"><div class="device-serial">#'+(i+1)+'</div><div class="device-person"><strong>'+esc2(name)+'</strong><span>'+esc2(blocked?'Blocked':'Logged in')+'</span></div></div>'
          +'<div class="device-meta">'
          +'<div><b>Name</b><span>'+esc2(name)+'</span></div>'
          +'<div><b>Number</b><span>'+esc2(number)+'</span></div>'
          +'<div><b>Device</b><span>'+esc2(device)+'</span></div>'
          +'<div><b>Last Login</b><span>'+esc2(bdTime(when))+'</span></div>'
          +'<div><b>IP</b><span>'+esc2(ip)+'</span></div>'
          +'</div>'
          +'<div class="device-actions-fixed">'
          +(blocked?'<button class="unblock-btn" onclick="unblockDevice(\''+id+'\')">🔓 Unblock</button>':'<button class="block-btn" onclick="blockDevice(\''+id+'\')">⛔ Block</button>')
          +'<button class="delete-btn" onclick="deleteDevice(\''+id+'\')">Delete</button>'
          +'</div></article>';
      }).join('');
    }catch(e){
      renderLatest([]);
      box.innerHTML='<div class="empty-row">Could not load users: '+esc2(e.message)+'</div>';
    }
  }

  window.blockDevice=async function(id){
    if(!id)return;
    if(!confirm('Block this device? It will lose website access immediately.'))return;
    try{await api('/api/admin/devices/block',{method:'POST',body:JSON.stringify({deviceId:id})});await loadUsersFixed();if(typeof logAction==='function')logAction('Blocked device: '+id);if(typeof toast==='function')toast('Device blocked — website access denied');}
    catch(e){if(typeof toast==='function')toast(e.message);}
  };
  window.unblockDevice=async function(id){
    if(!id)return;
    try{await api('/api/admin/devices/unblock',{method:'POST',body:JSON.stringify({deviceId:id})});await loadUsersFixed();if(typeof logAction==='function')logAction('Unblocked device: '+id);if(typeof toast==='function')toast('Device unblocked');}
    catch(e){if(typeof toast==='function')toast(e.message);}
  };
  window.loadDevices=loadUsersFixed;
  window.deleteDevice=async function(id){
    if(!id||!confirm('Delete this device?'))return;
    try{await api('/api/admin/devices?deviceId='+encodeURIComponent(id),{method:'DELETE'});await loadUsersFixed();if(typeof logAction==='function')logAction('Deleted device: '+id);if(typeof toast==='function')toast('Device deleted');}
    catch(e){if(typeof toast==='function')toast(e.message);}
  };

  function boot(){setTimeout(()=>{if(typeof connected!=='undefined'&&connected)loadUsersFixed();},350);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
