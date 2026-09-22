/* VIP-TV device/user display fix */
(function(){
  const esc2=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const bdTime=v=>{try{return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}).format(new Date(v))+' BD'}catch{return v||'—'}};
  async function loadUsersFixed(){
    if(typeof connected!=='undefined'&&!connected)return;
    const box=document.getElementById('deviceList'); if(!box)return;
    box.innerHTML='<div>Loading users…</div>';
    try{
      const d=await api('/api/admin/devices'); const list=Array.isArray(d)?d:(d.devices||d.data||[]);
      const count=document.getElementById('deviceConnected'); if(count)count.textContent=list.length;
      const limit=d?.settings?.deviceLimit??d?.settings?.maxDevices??d?.deviceLimit??'—'; const allowed=document.getElementById('deviceAllowed'); if(allowed)allowed.textContent=limit;
      box.innerHTML=list.length?list.map(x=>{
        const blocked=x.status==='Blocked'||x.blocked===true, name=x.userName||x.username||x.user||'Guest', number=x.number||x.mobile||x.phone||'—', device=x.deviceName||x.name||'Mobile Device', ip=x.ip||x.ipAddress||'—', when=x.lastLoginAt||x.lastLogin||x.lastSeen||x.createdAt||'';
        return `<div class="device-user-card" style="padding:14px 10px;border-bottom:1px solid rgba(120,220,220,.14)"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b style="font-size:16px">${esc2(name)}</b><b style="color:${blocked?'#ff5b67':'#39e58c'}">${blocked?'Blocked':'Logged in'}</b></div><div style="margin-top:5px;line-height:1.55"><b>Name:</b> ${esc2(name)}<br><b>Number:</b> ${esc2(number)}<br><b>Device:</b> ${esc2(device)}<br><b>Time:</b> ${esc2(bdTime(when))}<br><b>IP:</b> ${esc2(ip)}</div><div class="actions" style="display:flex;gap:6px;margin-top:9px">${blocked?`<button onclick="unblockDevice('${esc2(x.deviceId||x.id||'')}')" style="flex:1">Unblock</button>`:`<button onclick="blockDevice('${esc2(x.deviceId||x.id||'')}')" style="flex:1;background:#b40016">Block</button>`}<button class="del" onclick="deleteDevice('${esc2(x.deviceId||x.id||'')}')" style="flex:1">Delete</button></div></div>`;
      }).join(''):'<div>No users registered.</div>';
    }catch(e){box.innerHTML='<div>Could not load users: '+esc2(e.message)+'</div>'}
  }
  window.blockDevice=async id=>{if(!id)return;try{await api('/api/admin/devices/block',{method:'POST',body:JSON.stringify({deviceId:id})});await loadUsersFixed();toast('User blocked')}catch(e){toast(e.message)}};
  window.unblockDevice=async id=>{if(!id)return;try{await api('/api/admin/devices/unblock',{method:'POST',body:JSON.stringify({deviceId:id})});await loadUsersFixed();toast('User unblocked')}catch(e){toast(e.message)}};
  window.loadDevices=loadUsersFixed;
  setTimeout(loadUsersFixed,250);
})();
