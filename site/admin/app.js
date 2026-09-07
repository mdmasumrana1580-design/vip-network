const DEFAULT_WORKER_API=(window.VIP_ADMIN_WORKER_API||window.location.origin).replace(/\/$/,'');
let WORKER_API=DEFAULT_WORKER_API;
let adminLoggedIn=false;

async function api(path,opts={}){
  const r=await fetch(WORKER_API+path,{
    ...opts,
    credentials:'include',
    headers:{'Content-Type':'application/json',...(opts.headers||{})},
    cache:'no-store'
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.message||d.error||('HTTP '+r.status));
  return d;
}

function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function bdTime(v){
  if(!v)return '—';
  const d=new Date(v);
  if(Number.isNaN(d.getTime()))return esc(v);
  return d.toLocaleString('en-GB',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})+' (BD)';
}

async function loadDevices(){
  const box=$('deviceList');
  if(!box)return;
  try{
    const d=await api('/api/admin/devices');
    const list=Array.isArray(d.devices)?d.devices:[];
    if(!list.length){box.innerHTML='<div class="empty">No devices found.</div>';return}
    box.innerHTML=list.map(x=>{
      const id=esc(x.deviceId||'');
      const name=esc(x.name||x.userName||'Unknown');
      const deviceName=esc(x.deviceName||'—');
      const status=String(x.status||'').toLowerCase()==='blocked'?'Blocked':'Allowed';
      const statusClass=status==='Blocked'?'blocked':'allowed';
      return `<div class="device-card" style="position:relative">
        <div class="device-main">
          <div class="device-title">${name}</div>
          <div class="device-meta"><b>Device Name:</b> ${deviceName}</div>
          <div class="device-meta"><b>Device ID:</b> <span style="word-break:break-all">${id}</span></div>
          <div class="device-meta"><b>Status:</b> <span class="${statusClass}">${status}</span></div>
          <div class="device-meta"><b>Last Login:</b> ${bdTime(x.lastLogin)}</div>
        </div>
        <div class="device-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          ${status==='Blocked'
            ? `<button type="button" onclick="unblockDevice('${id}')">Unblock</button>`
            : `<button type="button" onclick="blockDevice('${id}')">Block</button>`}
          <button type="button" class="del" onclick="deleteDevice('${id}','${esc(name).replace(/'/g,"&#39;")}')" style="background:#b42318!important;color:#fff!important">🗑️ Delete Account</button>
        </div>
      </div>`;
    }).join('');
  }catch(e){
    box.innerHTML='<div class="empty">Unable to load devices.</div>';
    console.error(e);
  }
}

async function blockDevice(deviceId){
  if(!confirm('এই device-টি block করতে চান?'))return;
  try{await api('/api/admin/devices/block',{method:'POST',body:JSON.stringify({deviceId})});await loadDevices()}catch(e){alert(e.message)}
}
async function unblockDevice(deviceId){
  if(!confirm('এই device-টি unblock করতে চান?'))return;
  try{await api('/api/admin/devices/unblock',{method:'POST',body:JSON.stringify({deviceId})});await loadDevices()}catch(e){alert(e.message)}
}
async function deleteDevice(deviceId,name){
  const ok=confirm('Delete Account\\n\\nUsername: '+name+'\\nDevice ID: '+deviceId+'\\n\\nশুধু এই account/device record মুছে যাবে। অন্য account, playlist, player, settings বা channel পরিবর্তন হবে না।\\n\\nআপনি কি নিশ্চিত?');
  if(!ok)return;
  try{
    await api('/api/admin/devices?deviceId='+encodeURIComponent(deviceId),{method:'DELETE'});
    alert('Account deleted successfully. এই device-এ পরেরবার Login করতে হবে।');
    await loadDevices();
  }catch(e){alert(e.message)}
}

async function adminLogin(){
  const password=$('adminPassword')?.value||'';
  const apiInput=$('workerApi')?.value?.trim();
  if(apiInput)WORKER_API=apiInput.replace(/\/$/,'');
  if(!password){alert('Admin Password দিন।');return}
  try{
    await api('/api/admin/login',{method:'POST',body:JSON.stringify({password})});
    adminLoggedIn=true;
    if($('loginModal'))$('loginModal').style.display='none';
    await initAdmin();
  }catch(e){alert(e.message||'Admin login failed')}
}

async function adminLogout(){
  try{await api('/api/admin/logout',{method:'POST'})}catch(e){}
  adminLoggedIn=false;
  if($('loginModal'))$('loginModal').style.display='';
}

async function initAdmin(){
  try{
    const s=await api('/api/admin/session');
    if(s.ok||s.loggedIn){adminLoggedIn=true;if($('loginModal'))$('loginModal').style.display='none'}
  }catch(e){}
  if(adminLoggedIn)loadDevices();
}

/* Preserve existing admin UI controls by wiring common button IDs when present. */
document.addEventListener('DOMContentLoaded',()=>{
  const loginBtn=$('loginBtn');
  if(loginBtn)loginBtn.addEventListener('click',adminLogin);
  const logoutBtn=$('logoutBtn');
  if(logoutBtn)logoutBtn.addEventListener('click',adminLogout);
  const refreshBtn=$('refreshDevices');
  if(refreshBtn)refreshBtn.addEventListener('click',loadDevices);
  initAdmin();
});
