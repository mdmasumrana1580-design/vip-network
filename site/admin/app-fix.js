/* ViP NETWORK ADMIN — Device list fix
 * Add this script AFTER the existing app.js in site/admin/index.html.
 */
(function(){
  const originalLoadDevices=window.loadDevices;
  async function fixedLoadDevices(){
    if(typeof connected!=='undefined' && !connected)return;
    const box=document.getElementById('deviceList');
    if(!box)return;
    box.innerHTML='<div>Loading devices…</div>';
    try{
      const d=await api('/api/admin/devices');
      const list=(Array.isArray(d)?d:(d.devices||d.data||[])).slice().sort((a,b)=>new Date(b.lastLogin||b.lastSeen||b.createdAt||0)-new Date(a.lastLogin||a.lastSeen||a.createdAt||0));
      const n=document.getElementById('deviceConnected');if(n)n.textContent=list.length;
      const lim=document.getElementById('deviceAllowed');if(lim)lim.textContent=d?.settings?.deviceLimit??d?.settings?.maxDevices??d?.deviceLimit??'—';
      box.innerHTML=list.length?list.map(x=>{
        const id=String(x.deviceId||x.id||'');
        const isBlocked=x.blocked===true||String(x.status||'').toLowerCase()==='blocked';
        const last=x.lastLogin||x.lastSeen||x.createdAt||'';
        const action=isBlocked
          ? `<button onclick="unblockDevice('${esc(id)}')">🔓 Unblock</button>`
          : `<button onclick="approveDevice('${esc(id)}')">✓</button><button onclick="blockDevice('${esc(id)}')">⛔ Block</button><button onclick="revokeDevice('${esc(id)}')">↪</button>`;
        return `<div class="device-row"><b>${esc(x.userName||'No user')}</b><br><span>${esc(x.name||x.deviceName||'Device')}</span><br><small>${esc(id)}</small><br><small>Last login: ${esc(last?new Date(last).toLocaleString():'—')}</small> <b>${esc(isBlocked?'Blocked':(x.status|| (x.approved===false?'Pending':'Approved')))}</b><div class="actions">${action}<button class="del" onclick="deleteDevice('${esc(id)}')">▣</button></div></div>`;
      }).join(''):'<div>No devices registered.</div>';
    }catch(e){box.innerHTML='<div>Could not load devices: '+esc(e.message)+'</div>'}
  }
  window.loadDevices=fixedLoadDevices;
  window.blockDevice=async function(id){
    if(!id||!confirm('Block this device? It will lose website access immediately.'))return;
    try{await api('/api/admin/devices/block',{method:'POST',body:JSON.stringify({deviceId:id})});await fixedLoadDevices();toast('Device blocked — website access denied')}catch(e){toast(e.message)}
  };
  window.unblockDevice=async function(id){
    if(!id||!confirm('Unblock this device?'))return;
    try{await api('/api/admin/devices/unblock',{method:'POST',body:JSON.stringify({deviceId:id})});await fixedLoadDevices();toast('Device unblocked')}catch(e){toast(e.message)}
  };
  // Re-run once after the original app has finished its first async initialization.
  setTimeout(()=>{if(typeof connected!=='undefined'&&connected)fixedLoadDevices()},1500);
})();
