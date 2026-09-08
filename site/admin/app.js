const API=(window.VIP_ADMIN_WORKER_API||window.location.origin).replace(/\/$/,'');
let connected=false,channels=[],categories=['SPORTS','BD','INDIA','OTHERS'],selected=-1;
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function toast(t){const x=document.getElementById('toast');x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2400)}
function logAction(text){const a=JSON.parse(localStorage.getItem('vipActivity')||'[]');a.unshift({text,time:new Date().toLocaleString()});localStorage.setItem('vipActivity',JSON.stringify(a.slice(0,100)));renderLogs()}
function renderLogs(){const box=document.getElementById('activityList');if(!box)return;const a=JSON.parse(localStorage.getItem('vipActivity')||'[]');box.innerHTML=a.length?a.map(x=>`<div><b>${esc(x.text)}</b><small>${esc(x.time)}</small></div>`).join(''):'No activity yet.'}
function clearLogs(){localStorage.removeItem('vipActivity');renderLogs();toast('Activity logs cleared')}
async function api(path,opt={}){const h=new Headers(opt.headers||{});h.set('Accept','application/json');if(opt.body&&!h.has('Content-Type'))h.set('Content-Type','application/json');const r=await fetch(API+path,{...opt,headers:h,credentials:'include',cache:'no-store'});const text=await r.text();let d={};try{d=text?JSON.parse(text):{}}catch{d={raw:text}}if(!r.ok)throw new Error(d.error||('HTTP '+r.status));return d}
function setBackend(ok){connected=ok;const e=document.getElementById('backendState');if(e)e.textContent=ok?'Connected':'Offline';document.querySelectorAll('.online').forEach(x=>x.innerHTML=ok?'<i></i> Online':'Offline')}
function showLogin(show=true){document.getElementById('loginModal').classList.toggle('show',show)}
function loginStatus(t,bad=false){const x=document.getElementById('loginStatus');x.textContent=t;x.style.color=bad?'#ff7b8d':'#76d7ff'}
async function loginWorker(){const p=document.getElementById('workerPassword').value;if(!p)return loginStatus('Enter Admin Password.',true);const b=document.getElementById('loginBtn');b.disabled=true;loginStatus('Connecting...');try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:p})});setBackend(true);showLogin(false);document.getElementById('workerPassword').value='';await loadRemoteState();await loadDevices();logAction('Admin logged in');toast('Connected')}catch(e){loginStatus('Login failed: '+e.message,true)}finally{b.disabled=false}}
async function logoutWorker(){try{await api('/api/admin/logout',{method:'POST'})}catch{}setBackend(false);showLogin(true);logAction('Admin logged out')}
function norm(c){return {name:c.name||c.title||'Unnamed',category:c.category||c.group||'OTHERS',logo:c.logo||c.tvgLogo||'',url:c.url||c.stream||'',status:c.status||'Unknown'}}
async function loadRemoteState(){const d=await api('/api/admin/state');const s=d.state||d;channels=Array.isArray(s.channels)?s.channels.map(norm):[];categories=[...new Set([...categories,...channels.map(x=>x.category).filter(Boolean)])];saveLocal();render();const t=document.getElementById('syncTime');if(t)t.textContent=new Date().toLocaleString()}
function saveLocal(){localStorage.setItem('vipChannels',JSON.stringify(channels));localStorage.setItem('vipCategories',JSON.stringify(categories))}
async function saveRemoteState(extra={}){try{await api('/api/admin/state',{method:'PUT',body:JSON.stringify({channels,...extra})});saveLocal();return true}catch(e){toast('Save failed: '+e.message);return false}}
function logo(c){return c.logo?`<img class="logo-cell" src="${esc(c.logo)}" onerror="this.style.display='none'">`:'<span class="logo-cell"></span>'}
function rows(list,full=false){return list.map((c,i)=>{const idx=channels.indexOf(c);return `<tr class="channel-row" onclick="preview(${idx})"><td>${i+1}</td><td>${logo(c)}</td><td><b>${esc(c.name)}</b></td><td>${esc(c.category)}</td><td><span class="badge ${String(c.status).toLowerCase()}">● ${esc(c.status)}</span></td>${full?`<td>${esc(c.url)}</td>`:''}<td><div class="actions"><button onclick="preview(${idx})">▶</button><button onclick="editChannel(${idx})">✎</button><button class="del" onclick="deleteChannel(${idx})">⌫</button></div></td></tr>`}).join('')}
function filter(list,sid,cid,stid){const s=(document.getElementById(sid)?.value||'').toLowerCase(),c=document.getElementById(cid)?.value||'All Categories',st=document.getElementById(stid)?.value||'All Status';return list.filter(x=>(!s||x.name.toLowerCase().includes(s))&&(c==='All Categories'||x.category===c)&&(st==='All Status'||x.status===st))}
function fillSelect(id){const e=document.getElementById(id);if(!e)return;const old=e.value;e.innerHTML='<option>All Categories</option>'+categories.map(x=>`<option>${esc(x)}</option>`).join('');if([...e.options].some(o=>o.value===old))e.value=old}
function render(){['dashCat','managerCat'].forEach(fillSelect);const add=document.getElementById('addCategory');if(add)add.innerHTML=categories.map(x=>`<option>${esc(x)}</option>`).join('');document.getElementById('totalStat').textContent=channels.length;document.getElementById('activeStat').textContent=channels.filter(x=>x.status==='Active').length;document.getElementById('deadStat').textContent=channels.filter(x=>x.status==='Dead').length;document.getElementById('categoryStat').textContent=categories.length;const d=filter(channels,'dashSearch','dashCat','dashStatus'),m=filter(channels,'managerSearch','managerCat','managerStatus');document.getElementById('channelRows').innerHTML=rows(d);document.getElementById('managerRows').innerHTML=rows(m,true);const cl=document.getElementById('categoryList');if(cl)cl.innerHTML=categories.map((x,i)=>`<span>${esc(x)} <button onclick="removeCategory(${i})">×</button></span>`).join('')}
let vipHls=null;
function loadHls(){
  return new Promise(resolve=>{
    if(window.Hls)return resolve(true);
    if(document.getElementById('vipHlsScript'))return resolve(false);
    const s=document.createElement('script');
    s.id='vipHlsScript';
    s.src='https://cdn.jsdelivr.net/npm/hls.js@latest';
    s.onload=()=>resolve(!!window.Hls);
    s.onerror=()=>resolve(false);
    document.head.appendChild(s);
  });
}
async function playStream(url){
  const v=document.getElementById('player');
  if(!url)return;
  if(vipHls){try{vipHls.destroy()}catch{}vipHls=null}
  v.pause();
  v.removeAttribute('src');
  v.load();
  const isHls=/\.m3u8(?:$|[?#])/i.test(url);
  if(isHls){
    const ok=await loadHls();
    if(ok && window.Hls && Hls.isSupported()){
      vipHls=new Hls({enableWorker:true,lowLatencyMode:true});
      vipHls.loadSource(url);
      vipHls.attachMedia(v);
      vipHls.on(Hls.Events.MANIFEST_PARSED,()=>v.play().catch(()=>{}));
      vipHls.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal)toast('This stream cannot be played or blocks browser access')});
      return;
    }
  }
  v.src=url;
  v.play().catch(()=>{});
}
function preview(i){selected=i;const c=channels[i];if(!c)return;document.getElementById('pName').textContent=c.name;document.getElementById('pCategory').textContent=c.category;document.getElementById('pStatus').textContent=c.status;document.getElementById('testUrl').value=c.url;playStream(c.url);document.getElementById('videoPlaceholder').style.display='none'}
async function deleteChannel(i){if(!channels[i]||!confirm('Delete this channel?'))return;const name=channels[i].name;channels.splice(i,1);if(await saveRemoteState()){render();logAction('Deleted channel: '+name);toast('Channel deleted')}}
async function editChannel(i){const c=channels[i];if(!c)return;const name=prompt('Channel name:',c.name);if(name===null)return;const url=prompt('Stream URL:',c.url);if(url===null)return;const cat=prompt('Category:',c.category)||c.category;c.name=name.trim()||c.name;c.url=url.trim();c.category=cat;if(!categories.includes(cat))categories.push(cat);if(await saveRemoteState()){render();logAction('Edited channel: '+c.name);toast('Channel updated')}}
function parseM3U(text){const l=String(text||'').replace(/\r/g,'').split('\n'),out=[];let meta=null;for(const raw of l){const x=raw.trim();if(x.startsWith('#EXTINF')){const comma=x.indexOf(','),name=comma>=0?x.slice(comma+1).trim():'Channel',logo=(x.match(/tvg-logo="([^"]*)"/i)||[])[1]||'',category=(x.match(/group-title="([^"]*)"/i)||[])[1]||'OTHERS';meta={name,logo,category};continue}if(x&&!x.startsWith('#')&&meta){out.push({...meta,url:x,status:'Active'});meta=null}}return out}
async function importM3U(){const list=parseM3U(document.getElementById('m3uText').value);if(!list.length)return toast('No valid channels found');channels=list;categories=[...new Set([...categories,...list.map(x=>x.category)])];if(await saveRemoteState()){render();logAction('Imported '+list.length+' channels from M3U text');toast(list.length+' channels imported')}}
async function importM3UUrl(){const url=document.getElementById('m3uUrl').value.trim();if(!url)return toast('Enter M3U URL');try{const d=await api('/api/admin/import-m3u-url',{method:'POST',body:JSON.stringify({url})});await loadRemoteState();logAction('Imported playlist URL');toast((d.count||0)+' channels imported')}catch(e){toast('Import failed: '+e.message)}}
async function importXtream(){const server=document.getElementById('xtServer').value.trim(),username=document.getElementById('xtUser').value.trim(),password=document.getElementById('xtPass').value,limit=document.getElementById('xtLimit').value;if(!server||!username||!password)return toast('Enter server, username and password');try{const d=await api('/api/xtream/import',{method:'POST',body:JSON.stringify({server,username,password,limit})});await loadRemoteState();logAction('Imported Xtream playlist');toast((d.count||0)+' channels imported')}catch(e){toast('Xtream import failed: '+e.message)}}
async function addCategory(){const e=document.getElementById('newCat'),n=e.value.trim();if(!n)return;if(categories.includes(n))return toast('Already exists');categories.push(n);saveLocal();render();e.value='';logAction('Added category: '+n)}
function removeCategory(i){const n=categories[i];if(channels.some(x=>x.category===n))return toast('Category is in use');categories.splice(i,1);saveLocal();render();logAction('Removed category: '+n)}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportData(){download('vip-network-backup.json',JSON.stringify({channels,categories},null,2),'application/json');logAction('Exported JSON backup')}
function exportM3U(){download('vip-network-playlist.m3u','#EXTM3U\n'+channels.map(c=>`#EXTINF:-1 tvg-logo="${c.logo}" group-title="${c.category}",${c.name}\n${c.url}`).join('\n'),'audio/x-mpegurl');logAction('Exported M3U playlist')}
async function clearAll(){if(!confirm('Clear all channels?'))return;channels=[];if(await saveRemoteState()){render();logAction('Cleared all channels')}}
function testStream(){const u=document.getElementById('testUrl').value.trim();if(!u)return;playStream(u);document.getElementById('videoPlaceholder').style.display='none'}
async function refreshData(){try{if(connected)await loadRemoteState();else render();toast('Data refreshed')}catch(e){toast(e.message)}}
async function loadDevices(){const box=document.getElementById('deviceList');if(!connected){box.textContent='Please login first.';return}box.textContent='Loading devices...';try{const d=await api('/api/admin/devices'),list=d.devices||[];box.innerHTML=list.length?list.map(x=>{const id=esc(x.deviceId||''),blocked=x.blocked||x.status==='Blocked';return `<div><b>👤 Username: ${esc(x.username||'No username')}</b><br><b>💻 Device: ${esc(x.name||'Unknown device')}</b><br><small>🆔 ${esc(x.deviceId||'')} • 🕒 ${esc(x.lastSeen||x.createdAt||'')}</small><div class="device-actions">${blocked?`<button onclick="unblockDevice('${id}')">Unblock</button>`:`<button onclick="blockDevice('${id}')">Block</button>`}<button onclick="deleteDevice('${id}')">Delete</button></div></div>`}).join(''):'No devices registered.'}catch(e){box.textContent='Could not load devices: '+e.message}}
async function blockDevice(id){if(!confirm('Block this device?'))return;try{await api('/api/admin/devices/block',{method:'POST',body:JSON.stringify({deviceId:id})});await loadDevices();logAction('Blocked device: '+id)}catch(e){toast(e.message)}}
async function unblockDevice(id){try{await api('/api/admin/devices/unblock',{method:'POST',body:JSON.stringify({deviceId:id})});await loadDevices();logAction('Unblocked device: '+id)}catch(e){toast(e.message)}}
async function deleteDevice(id){if(!confirm('Delete this device?'))return;try{await api('/api/admin/devices?deviceId='+encodeURIComponent(id),{method:'DELETE'});await loadDevices();logAction('Deleted device: '+id)}catch(e){toast(e.message)}}
function showSection(id,fromHistory=false){if(!document.getElementById(id))id='dashboard';document.querySelectorAll('.section').forEach(x=>x.classList.remove('active-section'));document.getElementById(id).classList.add('active-section');document.querySelectorAll('[data-section]').forEach(x=>x.classList.toggle('active',x.dataset.section===id));document.getElementById('sidebar').classList.remove('open');if(id==='devices')loadDevices();if(id==='activity')renderLogs();if(!fromHistory){history.pushState({adminSection:id},'',location.pathname+location.search+'#'+encodeURIComponent(id))}window.scrollTo({top:0,behavior:'smooth'})}
window.addEventListener('popstate',()=>{const id=decodeURIComponent(location.hash.slice(1)||'dashboard');showSection(id,true)});
window.addEventListener('hashchange',()=>{const id=decodeURIComponent(location.hash.slice(1)||'dashboard');showSection(id,true)});
document.querySelectorAll('[data-section]').forEach(b=>b.addEventListener('click',()=>showSection(b.dataset.section)));
document.getElementById('liveGroup').addEventListener('click',()=>document.getElementById('liveSub').classList.toggle('open'));
document.getElementById('menuBtn').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
document.getElementById('loginBtn').addEventListener('click',loginWorker);
document.getElementById('workerPassword').addEventListener('keydown',e=>{if(e.key==='Enter')loginWorker()});
document.getElementById('loginEye').addEventListener('click',()=>{const x=document.getElementById('workerPassword');x.type=x.type==='password'?'text':'password'});
document.getElementById('themeBtn').addEventListener('click',()=>document.body.classList.toggle('light'));
document.getElementById('m3uFile').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>document.getElementById('m3uText').value=r.result;r.readAsText(f)});
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.import-pane').forEach(x=>x.classList.toggle('active',x.id==='import-'+b.dataset.tab))}));
document.getElementById('channelForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target),c={name:f.get('name'),category:f.get('category'),logo:f.get('logo'),url:f.get('url'),status:f.get('status')};channels.push(c);if(await saveRemoteState()){e.target.reset();render();logAction('Added channel: '+c.name);toast('Channel added')}});
document.getElementById('noticeForm').addEventListener('submit',async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target));try{await saveRemoteState({notice:{...x,enabled:x.enabled==='Yes'},headline:x.text});logAction('Updated website notice');toast('Banner saved')}catch{}});
document.getElementById('settingsForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/admin/settings',{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});logAction('Updated website settings');toast('Settings saved')}catch(err){toast(err.message)}});
Object.assign(window,{showSection,loginWorker,logoutWorker,refreshData,preview,editChannel,deleteChannel,importM3U,importM3UUrl,importXtream,addCategory,removeCategory,exportData,exportM3U,clearAll,testStream,loadDevices,blockDevice,unblockDevice,deleteDevice,clearLogs});
(async function init(){const lc=JSON.parse(localStorage.getItem('vipChannels')||'null'),cat=JSON.parse(localStorage.getItem('vipCategories')||'null');if(Array.isArray(lc))channels=lc.map(norm);if(Array.isArray(cat))categories=cat;render();renderLogs();const initial=decodeURIComponent(location.hash.slice(1)||'dashboard');history.replaceState({adminSection:initial},'',location.pathname+location.search+'#'+encodeURIComponent(initial));showSection(initial,true);try{await api('/api/admin/session');setBackend(true);showLogin(false);await loadRemoteState();await loadDevices()}catch{setBackend(false);showLogin(true)}})();
