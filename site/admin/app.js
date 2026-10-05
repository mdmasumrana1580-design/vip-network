const API=(window.VIP_ADMIN_WORKER_API||window.location.origin).replace(/\/$/,'');
let connected=false,channels=[],categories=['SPORTS','BD','INDIA','OTHERS'],selected=-1,deferredPrompt=null;
let channelAccess={};
const FREE_DEFAULTS=['A Sports HD','ATN Bangla','BTV','Makkah Live','Independent','RTV','Ananda TV','HUM TV','Sony Max 2','Sony Aath','Enter 10 Bangla','Zee Bangla HD','B4U Music','Sony YaY','9XM','T Sports HD','Star Sports SL 2','Sony Ten 1','Star Sports 1'];
const $=id=>document.getElementById(id);
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function toast(t){const x=$('toast');if(!x)return;x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2400)}
async function api(path,opt={}){const h=new Headers(opt.headers||{});h.set('Accept','application/json');if(opt.body&&!h.has('Content-Type'))h.set('Content-Type','application/json');const r=await fetch(API+path,{...opt,headers:h,credentials:'include',cache:'no-store'});const text=await r.text();let d={};try{d=text?JSON.parse(text):{}}catch{d={raw:text}}if(!r.ok)throw new Error(d.error||('HTTP '+r.status));return d}
function norm(c){return{name:c.name||c.title||'Unnamed',category:c.category||c.group||'OTHERS',logo:c.logo||c.tvgLogo||'',url:c.url||c.stream||'',status:c.status||'Unknown'}}
function setBackend(ok){connected=ok;if($('backendState'))$('backendState').textContent=ok?'Connected':'Offline'}
function showLogin(show=true){$('loginModal')?.classList.toggle('show',show)}
function loginStatus(t,bad=false){const x=$('loginStatus');if(x){x.textContent=t;x.style.color=bad?'#ff7b8d':'#76d7ff'}}
async function logoutWorker(){try{await api('/api/admin/logout',{method:'POST'})}catch{}setBackend(false);showLogin(true);logAction('Admin logged out')}
function logAction(text){const a=JSON.parse(localStorage.getItem('vipActivity')||'[]');a.unshift({text,time:new Date().toLocaleString()});localStorage.setItem('vipActivity',JSON.stringify(a.slice(0,100)));renderLogs()}
async function loginWorker(){const p=$('workerPassword').value;if(!p)return loginStatus('Enter Admin Password.',true);const b=$('loginBtn');b.disabled=true;try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:p})});setBackend(true);showLogin(false);$('workerPassword').value='';await loadRemoteState();await loadAccessSettings();await loadDevices();logAction('Admin logged in');toast('Connected')}catch(e){loginStatus('Login failed: '+e.message,true)}finally{b.disabled=false}}
async function loadRemoteState(){const d=await api('/api/admin/state');const s=d.state||d;channels=Array.isArray(s.channels)?s.channels.map(norm):[];categories=[...new Set([...categories,...channels.map(x=>x.category).filter(Boolean)])];saveLocal();render();renderAccessPanel();if($('syncTime'))$('syncTime').textContent=new Date().toLocaleString()}
function saveLocal(){localStorage.setItem('vipChannels',JSON.stringify(channels));localStorage.setItem('vipCategories',JSON.stringify(categories))}
function normalizeName(v){return String(v||'').replace(/\s+/g,' ').trim().toLowerCase()}
function defaultAccess(name){return FREE_DEFAULTS.some(x=>normalizeName(x)===normalizeName(name))?'free':'paid'}
function getAccess(name){const k=normalizeName(name);return Object.prototype.hasOwnProperty.call(channelAccess,k)?(channelAccess[k]==='free'?'free':'paid'):defaultAccess(name)}
async function loadAccessSettings(){
  try{
    const d=await api('/api/admin/settings');
    const s=d.settings||{};
    channelAccess=(s.channelAccess&&typeof s.channelAccess==='object')?s.channelAccess:{};
    renderAccessPanel();
  }catch(e){channelAccess={};}
}
async function saveAccessSettings(){
  try{
    await api('/api/admin/settings',{method:'PUT',body:JSON.stringify({channelAccess})});
    renderAccessPanel();toast('Channel access saved');
    logAction('Updated Free / Paid channel access');
  }catch(e){toast('Access save failed: '+e.message)}
}
function setAccess(name,value){
  channelAccess[normalizeName(name)]=value==='free'?'free':'paid';
  saveAccessSettings();
}
function ensureAccessUI(){
  if($('accessManagement'))return;
  const nav=document.querySelector('.sidebar');
  const addNav=document.createElement('button');addNav.className='nav-item';addNav.dataset.section='accessManagement';addNav.innerHTML='👑 <span>Free / Paid Control</span>';
  const addButton=document.querySelector('[data-section="channels"]');
  if(addButton)addButton.insertAdjacentElement('afterend',addNav);else nav?.appendChild(addNav);

  const content=document.querySelector('.content');
  const sec=document.createElement('section');sec.id='accessManagement';sec.className='section';
  sec.innerHTML=`<div class="page-head"><div><h1>Free / Paid Control</h1><p>Free channel-এ কোনো 👑 থাকবে না। Paid channel-এ 👑 দেখাবে এবং active package প্রয়োজন হবে।</p></div><button class="primary" id="accessSaveAll">💾 Save Access</button></div>
  <div class="panel"><div class="filters"><input id="accessSearch" placeholder="Search channel..."><select id="accessFilter"><option value="all">All</option><option value="free">🆓 Free</option><option value="paid">👑 Paid</option></select></div>
  <div id="accessRows" style="display:grid;gap:8px"></div></div>`;
  content?.insertBefore(sec,content.firstElementChild);
  addNav.addEventListener('click',()=>showSection('accessManagement'));
  $('accessSaveAll').addEventListener('click',saveAccessSettings);
  $('accessSearch').addEventListener('input',renderAccessPanel);$('accessFilter').addEventListener('change',renderAccessPanel);
  const style=document.createElement('style');style.textContent=`
    #accessRows .access-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(127,160,190,.18);border-radius:12px;background:rgba(10,20,32,.55)}
    #accessRows .access-logo{width:38px;height:38px;border-radius:50%;object-fit:cover;background:#07111d;flex:0 0 38px}
    #accessRows .access-name{flex:1;min-width:0}.access-name b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.access-name small{opacity:.65}
    #accessRows select{min-width:105px;border-radius:9px;padding:8px;background:#071423;color:inherit;border:1px solid rgba(127,160,190,.25)}
  `;document.head.appendChild(style);
}
function renderAccessPanel(){
  const box=$('accessRows');if(!box)return;
  const q=($('accessSearch')?.value||'').toLowerCase().trim(),f=$('accessFilter')?.value||'all';
  const list=channels.filter(c=>(!q||c.name.toLowerCase().includes(q))).filter(c=>f==='all'||getAccess(c.name)===f);
  box.innerHTML=list.map(c=>{
    const a=getAccess(c.name);
    return `<div class="access-row"><img class="access-logo" src="${esc(c.logo)}" onerror="this.style.display='none'"><div class="access-name"><b>${esc(c.name)}</b><small>${esc(c.category)}</small></div><select onchange="setChannelAccess('${esc(c.name).replace(/'/g,"&#039;")}',this.value)"><option value="free" ${a==='free'?'selected':''}>🆓 FREE</option><option value="paid" ${a==='paid'?'selected':''}>👑 PAID</option></select></div>`;
  }).join('')||'<div style="padding:18px;text-align:center;opacity:.7">No channels found.</div>';
}
function setChannelAccess(name,value){setAccess(name,value)}
function saveRemoteState(extra={}){return (async()=>{try{await api('/api/admin/state',{method:'PUT',body:JSON.stringify({channels,...extra})});saveLocal();return true}catch(e){toast('Save failed: '+e.message);return false}})()}
function logo(c){return c.logo?`<img class="logo-cell" src="${esc(c.logo)}" onerror="this.style.display='none'">`:'<span class="logo-cell"></span>'}
function rows(list,full=false){return list.map((c,i)=>{const idx=channels.indexOf(c);return `<tr class="channel-row ${idx===selected?'selected-row':''}" onclick="preview(${idx})"><td>${i+1}</td><td>${logo(c)}</td><td><b>${esc(c.name)}</b></td><td class="${full?'':'hide-small'}">${esc(c.category)}</td><td class="${full?'':'hide-small'}"><span class="badge">${getAccess(c.name)==='free'?'🆓 FREE':'👑 PAID'} · ${esc(c.status)}</span></td>${full?`<td>${esc(c.url)}</td>`:''}<td><div class="actions"><button onclick="event.stopPropagation();preview(${idx})">▶</button><button onclick="event.stopPropagation();editChannel(${idx})">✎</button><button class="del" onclick="event.stopPropagation();deleteChannel(${idx})">⌫</button></div></td></tr>`}).join('')}
function filter(list,sid,cid,stid){const s=($(sid)?.value||'').toLowerCase(),c=$(cid)?.value||'All Categories',st=$(stid)?.value||'All Status';return list.filter(x=>(!s||x.name.toLowerCase().includes(s))&&(c==='All Categories'||x.category===c)&&(st==='All Status'||x.status===st))}
function fillSelect(id){const e=$(id);if(!e)return;const old=e.value;e.innerHTML='<option>All Categories</option>'+categories.map(x=>`<option>${esc(x)}</option>`).join('');if([...e.options].some(o=>o.value===old))e.value=old}
function render(){['dashCat','managerCat'].forEach(fillSelect);const add=$('addCategory');if(add)add.innerHTML=categories.map(x=>`<option>${esc(x)}</option>`).join('');$('totalStat').textContent=channels.length;$('activeStat').textContent=channels.filter(x=>x.status==='Active').length;$('deadStat').textContent=channels.filter(x=>x.status==='Dead').length;$('categoryStat').textContent=categories.length;const d=filter(channels,'dashSearch','dashCat','dashStatus'),m=filter(channels,'managerSearch','managerCat','managerStatus');$('channelRows').innerHTML=rows(d);$('managerRows').innerHTML=rows(m,true);const cl=$('categoryList');if(cl)cl.innerHTML=categories.map((x,i)=>`<span>${esc(x)} <button onclick="removeCategory(${i})">×</button></span>`).join('');renderAccessPanel()}
let vipHls=null;
function loadHls(){return new Promise(resolve=>{if(window.Hls)return resolve(true);const old=document.getElementById('vipHlsScript');if(old)return old.addEventListener('load',()=>resolve(!!window.Hls),{once:true});const s=document.createElement('script');s.id='vipHlsScript';s.src='https://cdn.jsdelivr.net/npm/hls.js@latest';s.onload=()=>resolve(!!window.Hls);s.onerror=()=>resolve(false);document.head.appendChild(s)})}
async function playStream(url){const v=$('player');if(!url)return;if(vipHls){try{vipHls.destroy()}catch{}vipHls=null}v.pause();v.removeAttribute('src');v.load();if(/\.m3u8(?:$|[?#])/i.test(url)){const ok=await loadHls();if(ok&&window.Hls&&Hls.isSupported()){vipHls=new Hls({enableWorker:true,lowLatencyMode:true});vipHls.loadSource(url);vipHls.attachMedia(v);vipHls.on(Hls.Events.MANIFEST_PARSED,()=>v.play().catch(()=>{}));return}}v.src=url;v.play().catch(()=>{})}
function preview(i){selected=i;const c=channels[i];if(!c)return;$('pName').textContent=c.name;$('pCategory').textContent=c.category;$('editName').value=c.name;$('editCategory').value=c.category;$('editLogo').value=c.logo;$('editUrl').value=c.url;playStream(c.url);$('videoPlaceholder').style.display='none';render()}
async function saveSelectedChannel(){const c=channels[selected];if(!c)return toast('Select a channel first');const name=$('editName').value.trim(),category=$('editCategory').value.trim()||'OTHERS';const oldName=c.name;c.name=name||c.name;c.category=category;c.logo=$('editLogo').value.trim();c.url=$('editUrl').value.trim();if(oldName!==c.name){const oldKey=normalizeName(oldName);if(Object.prototype.hasOwnProperty.call(channelAccess,oldKey)){channelAccess[normalizeName(c.name)]=channelAccess[oldKey];delete channelAccess[oldKey];}}if(!categories.includes(category))categories.push(category);if(await saveRemoteState()){await saveAccessSettings();render();logAction('Edited channel: '+c.name);toast('Channel updated')}}
async function deleteSelectedChannel(){if(selected<0||!channels[selected])return;if(!confirm('Delete this channel?'))return;const old=channels[selected].name;channels.splice(selected,1);delete channelAccess[normalizeName(old)];selected=-1;if(await saveRemoteState()){await saveAccessSettings();render();$('pName').textContent='—';$('pCategory').textContent='—';$('player').removeAttribute('src');$('player').load();$('videoPlaceholder').style.display='grid';toast('Channel deleted')}}
async function deleteChannel(i){selected=i;await deleteSelectedChannel()}
function editChannel(i){preview(i);showSection('dashboard');setTimeout(()=>$('editName').focus(),150)}
function parseM3U(text){const l=String(text||'').replace(/\r/g,'').split('\n'),out=[];let meta=null;for(const raw of l){const x=raw.trim();if(x.startsWith('#EXTINF')){const comma=x.indexOf(','),name=comma>=0?x.slice(comma+1).trim():'Channel',logo=(x.match(/tvg-logo="([^"]*)"/i)||[])[1]||'',category=(x.match(/group-title="([^"]*)"/i)||[])[1]||'OTHERS';meta={name,logo,category};continue}if(x&&!x.startsWith('#')&&meta){out.push({...meta,url:x,status:'Active'});meta=null}}return out}
async function importM3U(){const list=parseM3U($('m3uText').value);if(!list.length)return toast('No valid channels found');channels=list;categories=[...new Set([...categories,...list.map(x=>x.category)])];if(await saveRemoteState()){await saveAccessSettings();render();toast(list.length+' channels imported')}}
async function importXtream(){const server=$('xtServer').value.trim(),username=$('xtUser').value.trim(),password=$('xtPass').value,limit=$('xtLimit').value;if(!server||!username||!password)return toast('Enter server, username and password');try{const d=await api('/api/xtream/import',{method:'POST',body:JSON.stringify({server,username,password,limit})});await loadRemoteState();logAction('Imported Xtream playlist');toast((d.count||0)+' channels imported')}catch(e){toast('Xtream import failed: '+e.message)}}
async function importM3UUrl(){const url=$('m3uUrl').value.trim();if(!url)return toast('Enter M3U URL');try{const d=await api('/api/admin/import-m3u-url',{method:'POST',body:JSON.stringify({url})});await loadRemoteState();toast((d.count||0)+' channels imported')}catch(e){toast('Import failed: '+e.message)}}
function addCategory(){const e=$('newCat'),n=e.value.trim();if(!n)return;if(categories.includes(n))return toast('Already exists');categories.push(n);saveLocal();render();e.value=''}
function removeCategory(i){const n=categories[i];if(channels.some(x=>x.category===n))return toast('Category is in use');categories.splice(i,1);saveLocal();render()}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportData(){download('vip-network-backup.json',JSON.stringify({channels,categories,channelAccess},null,2),'application/json')}
function exportM3U(){download('vip-network-playlist.m3u','#EXTM3U\n'+channels.map(c=>`#EXTINF:-1 tvg-logo="${c.logo}" group-title="${c.category}",${c.name}\n${c.url}`).join('\n'),'audio/x-mpegurl')}
async function clearAll(){if(!confirm('Clear all channels?'))return;channels=[];channelAccess={};selected=-1;if(await saveRemoteState()){await saveAccessSettings();render();toast('All channels cleared')}}
async function refreshData(){try{if(connected){await loadRemoteState();await loadAccessSettings()}else render();toast('Data refreshed')}catch(e){toast(e.message)}}
async function loadDevices(){const box=$('deviceList');if(!box)return;if(!connected){box.textContent='Please login first.';return}box.textContent='Loading devices...';try{const d=await api('/api/admin/devices'),list=d.devices||[];box.innerHTML=list.length?list.map(x=>{const id=esc(x.deviceId||''),blocked=x.blocked||x.status==='Blocked';return `<div><b>${esc(x.username||'Unknown user')}</b> — ${esc(x.name||'Unknown device')}<br><small>${esc(x.deviceId||'')} • ${esc(x.lastSeen||x.createdAt||'')}</small><div class="device-actions">${blocked?`<button onclick="unblockDevice('${id}')">Unblock</button>`:`<button onclick="blockDevice('${id}')">Block</button>`}<button onclick="deleteDevice('${id}')">Delete</button></div></div>`}).join(''):'No devices registered.'}catch(e){box.textContent='Could not load devices: '+e.message}}
async function blockDevice(id){try{await api('/api/admin/devices/block',{method:'POST',body:JSON.stringify({deviceId:id})});await loadDevices()}catch(e){toast(e.message)}}
async function unblockDevice(id){try{await api('/api/admin/devices/unblock',{method:'POST',body:JSON.stringify({deviceId:id})});await loadDevices()}catch(e){toast(e.message)}}
async function deleteDevice(id){if(!confirm('Delete this device?'))return;try{await api('/api/admin/devices?deviceId='+encodeURIComponent(id),{method:'DELETE'});await loadDevices()}catch(e){toast(e.message)}}
function renderLogs(){const box=$('activityList');if(!box)return;const a=JSON.parse(localStorage.getItem('vipActivity')||'[]');box.innerHTML=a.length?a.map(x=>`<div><b>${esc(x.text)}</b><small>${esc(x.time)}</small></div>`).join(''):'No activity yet.'}
function clearLogs(){localStorage.removeItem('vipActivity');renderLogs();toast('Activity logs cleared')}
function showSection(id,fromHistory=false){if(!$(id))id='dashboard';document.querySelectorAll('.section').forEach(x=>x.classList.remove('active-section'));$(id).classList.add('active-section');document.querySelectorAll('[data-section]').forEach(x=>x.classList.toggle('active',x.dataset.section===id));$('sidebar').classList.remove('open');if(id==='devices')loadDevices();if(id==='accessManagement')renderAccessPanel();if(!fromHistory)history.pushState({adminSection:id},'',location.pathname+location.search+'#'+encodeURIComponent(id));window.scrollTo({top:0,behavior:'smooth'})}
window.addEventListener('popstate',()=>showSection(decodeURIComponent(location.hash.slice(1)||'dashboard'),true));
function applyTheme(theme){const light=theme==='light';document.body.classList.toggle('light',light);$('themeBtn').textContent=light?'☀':'☾';localStorage.setItem('vipAdminTheme',light?'light':'dark')}
ensureAccessUI();
document.querySelectorAll('[data-section]').forEach(b=>b.addEventListener('click',()=>showSection(b.dataset.section)));
$('menuBtn').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
$('loginBtn').addEventListener('click',loginWorker);
$('workerPassword').addEventListener('keydown',e=>{if(e.key==='Enter')loginWorker()});
$('loginEye').addEventListener('click',()=>{const x=$('workerPassword');x.type=x.type==='password'?'text':'password'});
$('themeBtn').addEventListener('click',()=>applyTheme(document.body.classList.contains('light')?'dark':'light'));
$('m3uFile').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>$('m3uText').value=r.result;r.readAsText(f)});
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.import-pane').forEach(x=>x.classList.toggle('active',x.id==='import-'+b.dataset.tab))}));
['dashSearch','managerSearch','dashCat','managerCat','dashStatus','managerStatus'].forEach(id=>$(id)?.addEventListener('input',render));
$('globalSearch').addEventListener('input',e=>{$('dashSearch').value=e.target.value;$('managerSearch').value=e.target.value;render()});
$('channelForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target),c={name:f.get('name'),category:f.get('category'),logo:f.get('logo'),url:f.get('url'),status:f.get('status')};channels.push(c);if(await saveRemoteState()){await saveAccessSettings();e.target.reset();render();logAction('Added channel: '+c.name);toast('Channel added')}});
$('noticeForm').addEventListener('submit',async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target));await saveRemoteState({notice:{...x,enabled:x.enabled==='Yes'},headline:x.text});toast('Banner saved')});
$('settingsForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/admin/settings',{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});toast('Settings saved')}catch(err){toast(err.message)}});
$('installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').hidden=true});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').hidden=false});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
Object.assign(window,{showSection,loginWorker,logoutWorker,refreshData,preview,editChannel,deleteChannel,saveSelectedChannel,deleteSelectedChannel,importM3U,importM3UUrl,importXtream,addCategory,removeCategory,exportData,exportM3U,clearAll,loadDevices,blockDevice,unblockDevice,deleteDevice,clearLogs,setChannelAccess,renderAccessPanel});
