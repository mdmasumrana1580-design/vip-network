/* VIP NETWORK ADMIN - fixed API/KV sync version */
const DEFAULT_WORKER_API = (window.VIP_ADMIN_WORKER_API || window.location.origin);
let WORKER_API = DEFAULT_WORKER_API.replace(/\/$/, "");
let connected = false;
let channels = [];
let categories = ['News','Entertainment','Sports','Kids','Movies','Music','Other'];
let selected = null, dashPage = 1, managerPage = 1;
const PAGE_SIZE = 10;

function esc(s){return String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function toast(t){const x=document.getElementById('toast');if(!x)return;x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2200);}
function saveLocal(){localStorage.setItem('vipChannels',JSON.stringify(channels));localStorage.setItem('vipCategories',JSON.stringify(categories));}
function setBackendState(ok){document.querySelectorAll('.online').forEach(x=>x.innerHTML=ok?'<i></i> Online':'<i style="background:#ff5d73"></i> Offline');document.querySelectorAll('.status-bar b').forEach(x=>x.innerHTML=`Backend connection: <i style="color:${ok?'#43e59a':'#ff5d73'}">${ok?'Connected':'Offline'}</i>`);}
async function api(path,options={}){
  const headers=new Headers(options.headers||{});
  headers.set('Accept','application/json');
  if(options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type','application/json');
  const r=await fetch(WORKER_API.replace(/\/$/,'')+path,{...options,headers,credentials:'include',cache:'no-store'});
  const text=await r.text(); let data={};
  try{data=text?JSON.parse(text):{};}catch{data={raw:text};}
  if(!r.ok) throw new Error(data?.error||data?.message||('HTTP '+r.status));
  return data;
}
function normalizeChannels(x){if(!Array.isArray(x))return [];return x.map(c=>({name:c.name||c.title||'Unnamed',category:c.category||c.group||c.groupTitle||'Other',logo:c.logo||c.tvgLogo||'',url:c.url||c.stream||c.streamUrl||'',status:c.status||'Unknown',...c})).filter(c=>c.url||c.name);}
function extractState(data){const s=data?.state&&typeof data.state==='object'?data.state:data;return{channels:normalizeChannels(s?.channels||s?.playlist?.channels||data?.channels||data?.playlist||[]),notice:s?.notice||data?.notice||{},headline:s?.headline||data?.headline||''};}
function applyTheme(theme){const light=theme==='light';document.body.classList.toggle('light',light);document.documentElement.style.colorScheme=light?'light':'dark';const b=document.getElementById('themeBtn');if(b){b.textContent=light?'☀':'☾';b.title=light?'Switch to dark theme':'Switch to light theme';}localStorage.setItem('vipAdminTheme',light?'light':'dark');}
function toggleTheme(){const light=document.body.classList.contains('light');applyTheme(light?'dark':'light');toast(light?'Dark theme enabled':'Light theme enabled');}

function showLogin(show=true){document.getElementById('loginModal')?.classList.toggle('show',show);}
function setLoginStatus(t,bad=false){const x=document.getElementById('loginStatus');if(x){x.textContent=t;x.style.color=bad?'#ff7070':'';}}
async function loginWorker(){
  const url=document.getElementById('workerUrl')?.value.trim().replace(/\/$/,'');
  const pw=document.getElementById('workerPassword')?.value;
  if(!url||!pw)return setLoginStatus('Enter Worker URL and Admin Password.',true);
  WORKER_API=url;setLoginStatus('Connecting…');
  try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:pw})});connected=true;setBackendState(true);showLogin(false);document.getElementById('workerPassword').value='';await loadRemoteState();await loadDevices();toast('Connected • session valid for 5 minutes');}
  catch(e){connected=false;setBackendState(false);setLoginStatus('Login failed: '+e.message,true);}
}
async function logoutWorker(){try{await api('/api/admin/logout',{method:'POST'});}catch{}connected=false;setBackendState(false);showLogin(true);toast('Logged out');}

async function loadRemoteState(){
  if(!connected)return;
  try{
    const data=await api('/api/admin/state');
    const s=extractState(data);
    channels=s.channels;
    categories=[...new Set(['News','Entertainment','Sports','Kids','Movies','Music','Other',...channels.map(c=>c.category).filter(Boolean)])];
    saveLocal();render();fillNotice(s.notice,s.headline);
    const sync=document.getElementById('syncTime');if(sync)sync.textContent=new Date().toLocaleString();
  }catch(e){
    if(String(e.message).toLowerCase().includes('unauthorized')){connected=false;setBackendState(false);showLogin(true);setLoginStatus('Session expired. Please login again.',true);}
    toast('Could not load Worker state: '+e.message);
  }
}

/* IMPORTANT: Worker /api/admin/state accepts channels, notice and headline in one PUT. */
async function saveRemoteState(extra={}){
  if(!connected){toast('Worker is not connected. Login first.',true);return false;}
  try{
    const payload={channels,...extra};
    await api('/api/admin/state',{method:'PUT',body:JSON.stringify(payload)});
    saveLocal();
    const sync=document.getElementById('syncTime');if(sync)sync.textContent=new Date().toLocaleString();
    return true;
  }catch(e){toast('Worker save failed: '+e.message);return false;}
}

function logoHTML(c){return c.logo?`<img class="logo-cell" src="${esc(c.logo)}" onerror="this.style.display='none'">`:`<div class="logo-cell" style="display:grid;place-items:center;color:#08a9ff;font-weight:800">TV</div>`;}
function statusClass(s){return String(s||'Unknown').toLowerCase().replace(/\s*\/\s*/g,'-').replace(/\s+/g,'-');}
function filtered(list,searchId,catId,statusId){const s=(document.getElementById(searchId)?.value||'').toLowerCase(),cat=document.getElementById(catId)?.value||'All Categories',st=document.getElementById(statusId)?.value||'All Status';return list.filter(c=>(!s||String(c.name).toLowerCase().includes(s))&&(cat==='All Categories'||c.category===cat)&&(st==='All Status'||c.status===st));}
function rows(list,full=false){return list.map((c,i)=>{const idx=channels.indexOf(c);return `<tr><td>${i+1}</td><td>${logoHTML(c)}</td><td><b>${esc(c.name)}</b></td><td>${esc(c.category)}</td><td><span class="badge ${statusClass(c.status)}">● ${esc(c.status)}</span></td>${full?`<td title="${esc(c.url)}">${esc(c.url).slice(0,42)}${String(c.url).length>42?'…':''}</td>`:''}<td><div class="actions"><button onclick="preview(${idx})">▶</button><button onclick="editChannel(${idx})">✎</button><button class="del" onclick="deleteChannel(${idx})">▣</button></div></td></tr>`}).join('');}
function renderPagination(total,page,setter){const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));page=Math.min(page,pages);let out=`<button ${page<=1?'disabled':''} onclick="${setter}(${page-1})">«</button>`;for(let p=1;p<=pages;p++)out+=`<button class="${p===page?'active':''}" onclick="${setter}(${p})">${p}</button>`;return out+`<button ${page>=pages?'disabled':''} onclick="${setter}(${page+1})">»</button>`;}
function setDashPage(p){dashPage=Math.max(1,p);render();}function setManagerPage(p){managerPage=Math.max(1,p);render();}
function render(){
  const total=channels.length;
  const e=id=>document.getElementById(id);
  if(e('totalStat'))e('totalStat').textContent=total;
  if(e('activeStat'))e('activeStat').textContent=channels.filter(c=>c.status==='Active').length;
  if(e('deadStat'))e('deadStat').textContent=channels.filter(c=>c.status==='Dead').length;
  if(e('unknownStat'))e('unknownStat').textContent=channels.filter(c=>c.status!=='Active'&&c.status!=='Dead').length;
  const opts='<option>All Categories</option>'+categories.map(c=>`<option>${esc(c)}</option>`).join('');
  ['dashCat','managerCat'].forEach(id=>{const el=e(id);if(el){const old=el.value;el.innerHTML=opts;if([...el.options].some(o=>o.value===old))el.value=old;}});
  const ac=e('addCategory');if(ac)ac.innerHTML=categories.map(c=>`<option>${esc(c)}</option>`).join('');
  const d=filtered(channels,'dashSearch','dashCat','dashStatus'),m=filtered(channels,'managerSearch','managerCat','managerStatus');
  dashPage=Math.min(dashPage,Math.max(1,Math.ceil(d.length/PAGE_SIZE)));managerPage=Math.min(managerPage,Math.max(1,Math.ceil(m.length/PAGE_SIZE)));
  if(e('channelRows'))e('channelRows').innerHTML=rows(d.slice((dashPage-1)*PAGE_SIZE,dashPage*PAGE_SIZE));
  if(e('managerRows'))e('managerRows').innerHTML=rows(m.slice((managerPage-1)*PAGE_SIZE,managerPage*PAGE_SIZE),true);
  if(e('pagination'))e('pagination').innerHTML=d.length?renderPagination(d.length,dashPage,'setDashPage'):'<span>No channels found</span>';
  if(e('categoryList'))e('categoryList').innerHTML=categories.map((c,i)=>`<span>${esc(c)} <button onclick="removeCategory(${i})">×</button></span>`).join('');
}
async function deleteChannel(i){if(!channels[i]||!confirm('Delete '+channels[i].name+'?'))return;const old=channels.splice(i,1);if(await saveRemoteState()){render();toast('Channel deleted');}else{channels.splice(i,0,old[0]);render();}}
async function editChannel(i){const c=channels[i];if(!c)return;const name=prompt('Channel name:',c.name);if(name===null)return;const url=prompt('Stream URL:',c.url);if(url===null)return;const cat=prompt('Category:',c.category)||c.category;Object.assign(c,{name:name.trim()||c.name,url:url.trim(),category:cat});if(!categories.includes(cat))categories.push(cat);if(await saveRemoteState()){render();toast('Channel updated');}}
document.getElementById('channelForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target),c={name:f.get('name'),category:f.get('category'),logo:f.get('logo'),url:f.get('url'),status:f.get('status')};channels.push(c);if(!categories.includes(c.category))categories.push(c.category);if(await saveRemoteState()){e.target.reset();render();showSection('channels');toast('Channel added successfully');}else{channels.pop();render();}});
function parseM3U(text){const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),out=[];for(let i=0;i<lines.length;i++){if(lines[i].startsWith('#EXTINF')){const info=lines[i],url=lines[i+1]||'';if(!url.startsWith('#')){const comma=info.indexOf(','),name=comma>=0?info.slice(comma+1).trim():'Unknown',logo=(info.match(/tvg-logo="([^"]*)"/i)||[])[1]||'',cat=(info.match(/group-title="([^"]*)"/i)||[])[1]||'Other';out.push({name,category:cat,logo,url,status:'Active'});i++;}}}return out;}
async function addImported(list,replace=false){if(!list.length)return toast('No valid channels found');const before=channels.slice();if(replace)channels=list;else channels.push(...list);list.forEach(c=>{if(c.category&&!categories.includes(c.category))categories.push(c.category);});if(await saveRemoteState()){render();showSection('channels');toast(list.length+' channels imported');}else{channels=before;render();}}
async function importM3U(){await addImported(parseM3U(document.getElementById('m3uText')?.value||''),true);if(document.getElementById('m3uText'))document.getElementById('m3uText').value='';}
async function importM3UUrl(){const u=document.getElementById('m3uUrl')?.value.trim();if(!u)return toast('Enter an M3U URL');if(!connected)return toast('Login to Worker before importing an M3U URL');try{toast('Worker is importing M3U…');const data=await api('/api/admin/import-m3u-url',{method:'POST',body:JSON.stringify({url:u})});await loadRemoteState();toast(data?.count?data.count+' channels imported':'M3U imported');document.getElementById('m3uUrl').value='';}catch(e){toast('Worker M3U import failed: '+e.message);}}
async function importXtream(){const server=document.getElementById('xtServer')?.value.trim().replace(/\/$/,''),user=document.getElementById('xtUser')?.value.trim(),pass=document.getElementById('xtPass')?.value,lim=document.getElementById('xtLimit')?.value;if(!server||!user||!pass)return toast('Enter server, username and password');if(!connected)return toast('Login to Worker before importing Xtream');try{toast('Worker is importing Xtream…');const data=await api('/api/xtream/import',{method:'POST',body:JSON.stringify({server,username:user,password:pass,limit:lim})});await loadRemoteState();toast(data?.count?data.count+' channels imported':'Xtream imported');}catch(e){toast('Xtream import failed: '+e.message);}}
async function addCategory(){const n=document.getElementById('newCat')?.value.trim();if(!n)return;if(categories.includes(n))return toast('Category already exists');categories.push(n);if(await saveRemoteState()){render();document.getElementById('newCat').value='';toast('Category added');}else{categories.pop();render();}}
async function removeCategory(i){const n=categories[i];if(channels.some(c=>c.category===n))return toast('Category is in use');const old=categories.splice(i,1)[0];if(await saveRemoteState()){render();toast('Category removed');}else{categories.splice(i,0,old);render();}}
function preview(i){selected=i;const c=channels[i];if(!c)return;document.getElementById('pName').textContent=c.name;document.getElementById('pCategory').textContent=c.category;document.getElementById('pUrl').textContent=c.url;document.getElementById('pStatus').textContent=c.status;document.getElementById('testUrl').value=c.url;const v=document.getElementById('player');v.src=c.url;document.getElementById('videoPlaceholder').style.display='none';toast(c.name+' selected');}
function showSection(id,fromHistory=false){document.querySelectorAll('.section').forEach(x=>x.classList.remove('active-section'));document.getElementById(id)?.classList.add('active-section');document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.section===id));document.getElementById('sidebar')?.classList.remove('open');render();if(!fromHistory)history.pushState({adminSection:id},'',`#${encodeURIComponent(id)}`);}
function fillNotice(notice={},headline=''){const f=document.getElementById('noticeForm');if(!f)return;f.elements.text.value=notice.text||headline||'';f.elements.type.value=notice.type||'Information';f.elements.enabled.value=(notice.enabled===false||notice.enabled==='No')?'No':'Yes';}
async function refreshData(){if(connected)await loadRemoteState();else toast('Login to Worker first');}
async function loadDevices(){if(!connected)return;const box=document.getElementById('deviceList');if(!box)return;try{const d=await api('/api/admin/devices'),list=d.devices||[];document.getElementById('deviceConnected').textContent=list.length;document.getElementById('deviceAllowed').textContent=d.settings?.deviceLimit??'—';box.innerHTML=list.length?list.map(x=>`<div><b>${esc(x.name||x.deviceId||'Device')}</b> <span>${esc(x.ip||'')}</span> <b>${esc(x.status||'Pending')}</b><div class="actions"><button onclick="approveDevice('${esc(x.deviceId||'')}')">✓</button><button class="del" onclick="deleteDevice('${esc(x.deviceId||'')}')">▣</button></div></div>`).join(''):'<div>No devices registered.</div>';}catch(e){box.innerHTML='<div>Could not load devices: '+esc(e.message)+'</div>';}}
async function approveDevice(id){if(!id)return;try{await api('/api/admin/devices/approve',{method:'POST',body:JSON.stringify({deviceId:id})});await loadDevices();toast('Device approved');}catch(e){toast(e.message);}}
async function approveAllDevices(){try{await api('/api/admin/devices/approve-all',{method:'POST',body:'{}'});await loadDevices();toast('All devices approved');}catch(e){toast(e.message);}}
async function logoutAllDevices(){if(!confirm('Log out all devices?'))return;try{await api('/api/admin/devices/logout-all',{method:'POST',body:'{}'});await loadDevices();toast('All devices logged out');}catch(e){toast(e.message);}}
async function deleteDevice(id){if(!id||!confirm('Delete this device?'))return;try{await api('/api/admin/devices?deviceId='+encodeURIComponent(id),{method:'DELETE'});await loadDevices();toast('Device deleted');}catch(e){toast(e.message);}}

document.getElementById('loginBtn')?.addEventListener('click',loginWorker);
document.getElementById('workerPassword')?.addEventListener('keydown',e=>{if(e.key==='Enter')loginWorker();});
document.getElementById('themeBtn')?.addEventListener('click',toggleTheme);
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>showSection(b.dataset.section)));
window.addEventListener('popstate',()=>showSection(decodeURIComponent(location.hash.slice(1)||'dashboard'),true));
document.querySelectorAll('.import-tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.import-tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.import-pane').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById('import-'+b.dataset.importTab)?.classList.add('active');}));
['dashSearch','dashCat','dashStatus','managerSearch','managerCat','managerStatus'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>{dashPage=1;managerPage=1;render();}));
document.getElementById('menuBtn')?.addEventListener('click',()=>document.getElementById('sidebar')?.classList.toggle('open'));
document.getElementById('playBtn')?.addEventListener('click',()=>{if(selected!==null)document.getElementById('player')?.play().catch(()=>toast('Browser blocked playback'));});
document.getElementById('reloadBtn')?.addEventListener('click',()=>document.getElementById('player')?.load());
document.getElementById('fullBtn')?.addEventListener('click',()=>document.getElementById('player')?.requestFullscreen?.());
document.getElementById('openBtn')?.addEventListener('click',()=>{if(selected!==null)window.open(channels[selected].url,'_blank');});
document.getElementById('noticeForm')?.addEventListener('submit',async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target)),notice={...x,enabled:x.enabled==='Yes'};if(!connected)return toast('Login to Worker first');if(await saveRemoteState({notice,headline:x.text}))toast('Banner saved to VIP NETWORK');});
document.getElementById('settingsForm')?.addEventListener('submit',async e=>{e.preventDefault();if(!connected)return toast('Login to Worker first');try{await api('/api/admin/settings',{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});toast('Website settings saved to Worker');}catch(e){toast('Settings save failed: '+e.message);}});

(async function init(){
  setBackendState(false);applyTheme(localStorage.getItem('vipAdminTheme')||'dark');
  const local=JSON.parse(localStorage.getItem('vipChannels')||'null');if(Array.isArray(local))channels=local;
  const cats=JSON.parse(localStorage.getItem('vipCategories')||'null');if(Array.isArray(cats)&&cats.length)categories=[...new Set(cats)];
  render();
  const input=document.getElementById('workerUrl');if(input)input.value=DEFAULT_WORKER_API;
  try{await api('/api/admin/session');connected=true;showLogin(false);setBackendState(true);await loadRemoteState();await loadDevices();}
  catch{showLogin(true);}
})();
