/* VIP NETWORK ADMIN — updated: 5-minute secure session + history back + ADMIN+TV PWA */
const DEFAULT_WORKER_API=(window.VIP_ADMIN_WORKER_API||window.location.origin);
const seed=[{name:'Somoy TV',category:'News',logo:'',url:'https://example.com/somoy.m3u8',status:'Active'},{name:'Jamuna TV',category:'News',logo:'',url:'https://example.com/jamuna.m3u8',status:'Active'},{name:'ATN News',category:'News',logo:'',url:'https://example.com/atn.m3u8',status:'Active'}];
let WORKER_API=DEFAULT_WORKER_API,connected=false,channels=[],categories=['New Style','Sports','BD','India','Other','Movie & Series'],selected=null,dashPage=1,managerPage=1;
const CATEGORY_ORDER=['New Style','Sports','BD','India','Other','Movie & Series'];
const CATEGORY_ALIASES={'NEW STYLE':'New Style','SPORTS':'Sports','BD':'BD','INDIA':'India','OTHER':'Other','OTHERS':'Other','MOVIE':'Movie & Series','MOVIES':'Movie & Series','MOVIE & SERIES':'Movie & Series'};
function canonicalCategory(v){const k=String(v||'').trim().toUpperCase();return CATEGORY_ALIASES[k]||String(v||'').trim()||'Other'}
function buildCategories(stateCats=[],list=[]){const extras=[...(Array.isArray(stateCats)?stateCats:[]),...(Array.isArray(list)?list.map(c=>c.category):[])].map(c=>canonicalCategory(c)).filter(Boolean);return [...new Set([...CATEGORY_ORDER,...extras])]}
function categoryButton(name,active=false){const safe=esc(name);return `<button type="button" class="category-btn ${active?'active':''}" data-category="${safe}" onclick="filterCategory(${JSON.stringify(name)})">${safe}</button>`}
function filterCategory(name){const cat=name==='All Categories'?'All Categories':canonicalCategory(name);const d=document.getElementById('dashCat'),m=document.getElementById('managerCat');if(d)d.value=cat;if(m)m.value=cat;dashPage=1;managerPage=1;showSection('dashboard');render();}

const PAGE_SIZE=10;
function saveLocal(){localStorage.setItem('vipChannels',JSON.stringify(channels));localStorage.setItem('vipCategories',JSON.stringify(categories));}
function toast(t){const x=document.getElementById('toast');if(!x)return;x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2200)}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function statusClass(s){return String(s||'Unknown').toLowerCase().replace(/\s*\/\s*/g,'-').replace(/\s+/g,'-')}
function logoHTML(c){return c.logo?`<img class="logo-cell" src="${esc(c.logo)}" onerror="this.style.display='none'">`:`<div class="logo-cell" style="display:grid;place-items:center;color:#08a9ff;font-weight:800">TV</div>`}
async function api(path,options={}){const headers=new Headers(options.headers||{});headers.set('Accept','application/json');if(options.body&&!(options.body instanceof FormData)&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');const r=await fetch(WORKER_API.replace(/\/$/,'')+path,{...options,headers,credentials:'include',cache:'no-store'});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={raw:text}}if(!r.ok)throw new Error(data?.error||data?.message||('HTTP '+r.status));return data;}
function showLogin(show=true){document.getElementById('loginModal')?.classList.toggle('show',show)}
function setLoginStatus(t,bad=false){const x=document.getElementById('loginStatus');if(x){x.textContent=t;x.style.color=bad?'#ff7070':''}}
async function loginWorker(){const url=document.getElementById('workerUrl').value.trim().replace(/\/$/,''),pw=document.getElementById('workerPassword').value;if(!url||!pw)return setLoginStatus('Enter Worker URL and Admin Password.',true);WORKER_API=url;setLoginStatus('Connecting…');try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:pw})});connected=true;showLogin(false);setBackendState(true);setLoginStatus('');const pf=document.getElementById('workerPassword');if(pf)pf.value='';await loadRemoteState();await loadDevices();toast('Connected • session valid for 5 minutes')}catch(e){connected=false;setBackendState(false);setLoginStatus('Login failed: '+e.message,true)}}
document.getElementById('loginBtn').onclick=loginWorker;
document.getElementById('workerPassword').addEventListener('keydown',e=>{if(e.key==='Enter')loginWorker()});
async function logoutWorker(){try{await api('/api/admin/logout',{method:'POST'})}catch{}connected=false;setBackendState(false);showLogin(true);document.getElementById('workerPassword').value='';toast('Logged out')}
function setBackendState(ok){document.querySelectorAll('.online').forEach(x=>x.innerHTML=ok?'<i></i> Online':'<i style="background:#ff5d73"></i> Offline');document.querySelectorAll('.status-bar b').forEach(x=>x.innerHTML=`Backend connection: <i style="color:${ok?'#43e59a':'#ff5d73'}">${ok?'Connected':'Offline'}</i>`)}
function showSection(id,fromHistory=false){document.querySelectorAll('.section').forEach(x=>x.classList.remove('active-section'));const el=document.getElementById(id);if(el)el.classList.add('active-section');document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.section===id));document.getElementById('sidebar')?.classList.remove('open');render();if(id==='devices'&&connected)loadDevices();if(!fromHistory){history.pushState({adminSection:id},'',`#${encodeURIComponent(id)}`)}}
window.addEventListener('popstate',()=>{const id=decodeURIComponent(location.hash.slice(1)||'dashboard');showSection(document.getElementById(id)?id:'dashboard',true)});
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>showSection(b.dataset.section)));
document.querySelectorAll('.import-tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.import-tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.import-pane').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById('import-'+b.dataset.importTab)?.classList.add('active')}));
document.getElementById('menuBtn')?.addEventListener('click',()=>document.getElementById('sidebar')?.classList.toggle('open'));
function applyTheme(theme){const light=theme==='light';document.body.classList.toggle('light',light);document.documentElement.style.colorScheme=light?'light':'dark';const b=document.getElementById('themeBtn');if(b){b.textContent=light?'☀':'☾';b.title=light?'Switch to dark theme':'Switch to light theme';b.setAttribute('aria-pressed',String(light))}const m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',light?'#f4f7fb':'#020d19');localStorage.setItem('vipAdminTheme',light?'light':'dark')}
function toggleTheme(){applyTheme(document.body.classList.contains('light')?'dark':'light');toast(document.body.classList.contains('light')?'Light theme enabled':'Dark theme enabled')}
document.getElementById('themeBtn').onclick=toggleTheme;
applyTheme(localStorage.getItem('vipAdminTheme')||'dark');
document.getElementById('profileBtn')?.addEventListener('click',()=>toast(connected?'ADMIN • Connected':'ADMIN • Not connected'));
function normalizeChannels(x){if(!Array.isArray(x))return [];return x.map(c=>({name:c.name||c.title||'Unnamed',category:c.category||c.group||c.groupTitle||'Other',logo:c.logo||c.tvgLogo||'',url:c.url||c.stream||c.streamUrl||'',status:c.status||'Unknown',...c})).filter(c=>c.url||c.name)}
function extractState(data){const s=data?.state&&typeof data.state==='object'?data.state:data;const list=s?.channels||s?.playlist?.channels||data?.channels||data?.playlist||[];return{channels:normalizeChannels(list),notice:s?.notice||data?.notice||{},headline:s?.headline||data?.headline||''}}
async function loadRemoteState(){if(!connected)return;try{const data=await api('/api/admin/state');const s=extractState(data);channels=s.channels;if(!channels.length){const p=await api('/api/admin/playlist');channels=normalizeChannels(p?.channels||p?.playlist||p)}categories=buildCategories(data?.state?.categories||data?.categories,channels);saveLocal();render();fillNotice(s.notice,s.headline);document.getElementById('syncTime').textContent=new Date().toLocaleString()}catch(e){if(String(e.message).includes('Unauthorized')){connected=false;showLogin(true);setLoginStatus('Session expired. Please login again.',true)}toast('Could not load Worker state: '+e.message);setBackendState(false)}}
async function saveRemoteState(extra={}){if(!connected){saveLocal();return true}try{await api('/api/admin/state',{method:'PUT',body:JSON.stringify({channels,categories,...extra})});saveLocal();document.getElementById('syncTime').textContent=new Date().toLocaleString();return true}catch(e){toast('Worker save failed: '+e.message);return false}}
function filtered(list,searchId,catId,statusId){let s=(document.getElementById(searchId)?.value||'').toLowerCase(),cat=document.getElementById(catId)?.value||'All Categories',st=document.getElementById(statusId)?.value||'All Status';return list.filter(c=>(!s||String(c.name).toLowerCase().includes(s))&&(cat==='All Categories'||canonicalCategory(c.category)===canonicalCategory(cat))&&(st==='All Status'||c.status===st))}
function render(){
  renderDashboard();
  renderManager();
  renderCategories();
  renderNotice();
  renderSettings();
  renderAnalytics();
  renderDevices();
}

function renderDashboard(){
  const grid=document.getElementById('dashboardGrid');
  if(!grid)return;
  const cat=document.getElementById('dashCat');
  if(cat){
    const current=cat.value||'All Categories';
    cat.innerHTML='<option>All Categories</option>'+categories.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    cat.value=categories.includes(current)?current:'All Categories';
  }
  const list=filtered(channels,'dashSearch','dashCat','dashStatus');
  const total=channels.length,active=channels.filter(x=>String(x.status).toLowerCase()==='active').length;
  document.getElementById('totalChannels')&&(document.getElementById('totalChannels').textContent=total);
  document.getElementById('activeChannels')&&(document.getElementById('activeChannels').textContent=active);
  document.getElementById('categoryCount')&&(document.getElementById('categoryCount').textContent=categories.length);
  const pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));dashPage=Math.min(dashPage,pages);
  const rows=list.slice((dashPage-1)*PAGE_SIZE,dashPage*PAGE_SIZE);
  grid.innerHTML=rows.length?rows.map(c=>`
    <div class="channel-card">
      <div class="channel-logo">${logoHTML(c)}</div>
      <div class="channel-info">
        <strong>${esc(c.name)}</strong>
        <span>${esc(canonicalCategory(c.category))}</span>
        <small class="${statusClass(c.status)}">${esc(c.status||'Unknown')}</small>
      </div>
      <button type="button" onclick="previewChannel(${channels.indexOf(c)})">▶</button>
    </div>`).join(''):'<div class="empty">No channels found.</div>';
  renderPager('dashPager',pages,dashPage,p=>{dashPage=p;renderDashboard()});
}

function renderManager(){
  const box=document.getElementById('channelTableBody');
  if(!box)return;
  const cat=document.getElementById('managerCat');
  if(cat){
    const current=cat.value||'All Categories';
    cat.innerHTML='<option>All Categories</option>'+categories.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    cat.value=categories.includes(current)?current:'All Categories';
  }
  const list=filtered(channels,'managerSearch','managerCat','managerStatus');
  const pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));managerPage=Math.min(managerPage,pages);
  const rows=list.slice((managerPage-1)*PAGE_SIZE,managerPage*PAGE_SIZE);
  box.innerHTML=rows.length?rows.map(c=>{
    const i=channels.indexOf(c);
    return `<tr>
      <td>${logoHTML(c)}</td>
      <td><b>${esc(c.name)}</b><br><small>${esc(c.url)}</small></td>
      <td>${esc(canonicalCategory(c.category))}</td>
      <td><span class="badge ${statusClass(c.status)}">${esc(c.status||'Unknown')}</span></td>
      <td>
        <button type="button" onclick="previewChannel(${i})">▶</button>
        <button type="button" onclick="editChannel(${i})">✏️</button>
        <button type="button" class="del" onclick="deleteChannel(${i})">🗑️</button>
      </td>
    </tr>`;
  }).join(''):'<tr><td colspan="5" class="empty">No channels found.</td></tr>';
  renderPager('managerPager',pages,managerPage,p=>{managerPage=p;renderManager()});
}

function renderPager(id,pages,current,fn){
  const box=document.getElementById(id);if(!box)return;
  if(pages<=1){box.innerHTML='';return}
  let h='';
  for(let i=1;i<=pages;i++)h+=`<button type="button" class="${i===current?'active':''}" data-page="${i}">${i}</button>`;
  box.innerHTML=h;
  box.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>fn(Number(b.dataset.page))));
}

function renderCategories(){
  const box=document.getElementById('categoryList');if(!box)return;
  box.innerHTML=categories.map(c=>`
    <div class="category-item">
      <span>${esc(c)}</span>
      ${CATEGORY_ORDER.includes(c)?'':`<button type="button" onclick="removeCategory(${JSON.stringify(c)})">✕</button>`}
    </div>`).join('');
}

function renderNotice(){
  const n=JSON.parse(localStorage.getItem('vipNotice')||'{}');
  if(document.getElementById('noticeText')&&!document.getElementById('noticeText').value)
    document.getElementById('noticeText').value=n.text||'';
  if(document.getElementById('noticeEnabled'))
    document.getElementById('noticeEnabled').checked=n.enabled!==false;
}

function renderSettings(){
  const s=JSON.parse(localStorage.getItem('vipSettings')||'{}');
  const map={siteName:'siteName',siteLogo:'siteLogo',primaryColor:'primaryColor'};
  Object.entries(map).forEach(([k,id])=>{
    const el=document.getElementById(id);
    if(el&&s[k]!=null&&!el.value)el.value=s[k];
  });
}

function renderAnalytics(){
  const total=channels.length;
  const active=channels.filter(x=>String(x.status).toLowerCase()==='active').length;
  const inactive=total-active;
  const a=document.getElementById('analyticsTotal'),b=document.getElementById('analyticsActive'),c=document.getElementById('analyticsInactive');
  if(a)a.textContent=total;
  if(b)b.textContent=active;
  if(c)c.textContent=inactive;
}

function previewChannel(i){
  const c=channels[i];if(!c)return;
  const modal=document.getElementById('previewModal');
  const title=document.getElementById('previewTitle');
  const video=document.getElementById('previewVideo');
  if(title)title.textContent=c.name||'Preview';
  if(video){
    video.src=c.url||'';
    video.load();
    video.play().catch(()=>{});
  }
  if(modal)modal.classList.add('show');
}

function closePreview(){
  const modal=document.getElementById('previewModal');
  const video=document.getElementById('previewVideo');
  if(video){video.pause();video.removeAttribute('src');video.load()}
  modal?.classList.remove('show');
}

window.previewChannel=previewChannel;
window.closePreview=closePreview;

async function deleteChannel(i){
  const c=channels[i];if(!c)return;
  if(!confirm('Delete channel “'+c.name+'” ?'))return;
  channels.splice(i,1);
  await saveRemoteState();
  render();
  toast('Channel deleted');
}

function editChannel(i){
  const c=channels[i];if(!c)return;
  selected=i;
  const map={channelName:c.name,channelCategory:canonicalCategory(c.category),channelLogo:c.logo||'',channelUrl:c.url||'',channelStatus:c.status||'Active'};
  Object.entries(map).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v});
  showSection('add-channel');
  const btn=document.getElementById('saveChannelBtn');
  if(btn)btn.textContent='Update Channel';
}

function clearChannelForm(){
  selected=null;
  ['channelName','channelLogo','channelUrl'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
  const cat=document.getElementById('channelCategory');if(cat)cat.value=categories[0]||'Other';
  const st=document.getElementById('channelStatus');if(st)st.value='Active';
  const btn=document.getElementById('saveChannelBtn');if(btn)btn.textContent='Save Channel';
}

async function saveChannel(){
  const name=document.getElementById('channelName')?.value.trim();
  const url=document.getElementById('channelUrl')?.value.trim();
  const category=canonicalCategory(document.getElementById('channelCategory')?.value);
  const logo=document.getElementById('channelLogo')?.value.trim()||'';
  const status=document.getElementById('channelStatus')?.value||'Active';
  if(!name||!url){toast('Channel name and stream URL are required');return}
  const obj={name,url,category,logo,status};
  if(selected==null)channels.push(obj);else channels[selected]={...channels[selected],...obj};
  categories=buildCategories(categories,channels);
  await saveRemoteState();
  saveLocal();render();toast(selected==null?'Channel added':'Channel updated');
  clearChannelForm();
}

document.getElementById('saveChannelBtn')?.addEventListener('click',saveChannel);
document.getElementById('clearChannelBtn')?.addEventListener('click',clearChannelForm);

function parseM3U(text){
  const lines=String(text||'').split(/\r?\n/),out=[];let meta=null;
  for(const line0 of lines){
    const line=line0.trim();
    if(!line)continue;
    if(line.toUpperCase().startsWith('#EXTINF:')){
      const comma=line.indexOf(',');
      const info=comma>=0?line.slice(comma+1).trim():'Unnamed';
      const attrs={};
      line.replace(/([\w-]+)="([^"]*)"/g,(_,k,v)=>{attrs[k]=v;return _});
      meta={name:info,category:attrs['group-title']||attrs['group']||'Other',logo:attrs['tvg-logo']||attrs['logo']||''};
    }else if(!line.startsWith('#')&&meta){
      out.push({...meta,url:line,status:'Active'});meta=null;
    }
  }
  return out;
}

async function importM3UText(text){
  const parsed=parseM3U(text);
  if(!parsed.length){toast('No valid M3U channels found');return 0}
  channels=[...channels,...parsed];
  categories=buildCategories(categories,channels);
  await saveRemoteState();
  saveLocal();render();
  toast(parsed.length+' channels imported');
  return parsed.length;
}

async function importM3UUrl(){
  const url=document.getElementById('m3uUrl')?.value.trim();
  if(!url){toast('M3U URL দিন');return}
  try{
    toast('Loading M3U…');
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    await importM3UText(await r.text());
  }catch(e){toast('M3U import failed: '+e.message)}
}

document.getElementById('importM3uUrlBtn')?.addEventListener('click',importM3UUrl);

document.getElementById('m3uFile')?.addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{await importM3UText(await file.text())}catch(err){toast('File import failed: '+err.message)}
});

async function importXtream(){
  const host=document.getElementById('xtreamHost')?.value.trim().replace(/\/$/,'');
  const username=document.getElementById('xtreamUser')?.value.trim();
  const password=document.getElementById('xtreamPass')?.value||'';
  if(!host||!username||!password){toast('Xtream Host, Username এবং Password দিন');return}
  try{
    const base=host+'/player_api.php?username='+encodeURIComponent(username)+'&password='+encodeURIComponent(password);
    const r=await fetch(base,{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const data=await r.json();
    const streams=Array.isArray(data)?data:(data.live_streams||[]);
    const parsed=streams.map(x=>({name:x.name||x.stream_display_name||'Unnamed',category:x.category_name||'Other',logo:x.stream_icon||'',url:host+'/live/'+encodeURIComponent(username)+'/'+encodeURIComponent(password)+'/'+x.stream_id+'.m3u8',status:'Active'}));
    if(!parsed.length){toast('No Xtream channels found');return}
    channels=[...channels,...parsed];categories=buildCategories(categories,channels);await saveRemoteState();saveLocal();render();toast(parsed.length+' Xtream channels imported');
  }catch(e){toast('Xtream import failed: '+e.message)}
}
document.getElementById('importXtreamBtn')?.addEventListener('click',importXtream);
function addCategory(){
  const input=document.getElementById('newCategory');
  const name=canonicalCategory(input?.value);
  if(!name||name==='Other'){toast('Category name দিন');return}
  if(!categories.includes(name))categories.push(name);
  input.value='';
  saveRemoteState();
  render();
  toast('Category added');
}

async function removeCategory(name){
  name=canonicalCategory(name);
  if(CATEGORY_ORDER.includes(name)){
    toast('Default category cannot be removed');
    return;
  }
  if(!confirm('Remove category “'+name+'” ?'))return;
  categories=categories.filter(c=>c!==name);
  channels.forEach(c=>{if(canonicalCategory(c.category)===name)c.category='Other'});
  await saveRemoteState();
  saveLocal();
  render();
  toast('Category removed');
}

document.getElementById('addCategoryBtn')?.addEventListener('click',addCategory);

async function backupData(){
  const data={
    version:1,
    exportedAt:new Date().toISOString(),
    channels,
    categories,
    notice:JSON.parse(localStorage.getItem('vipNotice')||'{}'),
    settings:JSON.parse(localStorage.getItem('vipSettings')||'{}')
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='vip-network-backup-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast('Backup downloaded');
}

document.getElementById('backupBtn')?.addEventListener('click',backupData);
document.getElementById('exportBtn')?.addEventListener('click',backupData);

async function restoreBackup(file){
  if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    const list=data.channels||data.playlist?.channels;
    if(!Array.isArray(list))throw new Error('Invalid backup file');
    channels=normalizeChannels(list);
    categories=buildCategories(data.categories,channels);
    if(data.notice)localStorage.setItem('vipNotice',JSON.stringify(data.notice));
    if(data.settings)localStorage.setItem('vipSettings',JSON.stringify(data.settings));
    await saveRemoteState();
    saveLocal();
    render();
    toast('Backup restored');
  }catch(e){
    toast('Restore failed: '+e.message);
  }
}

document.getElementById('restoreFile')?.addEventListener('change',e=>{
  restoreBackup(e.target.files?.[0]);
});

async function clearAllChannels(){
  if(!confirm('সব channel মুছে ফেলতে চান?'))return;
  channels=[];
  await saveRemoteState();
  saveLocal();
  render();
  toast('All channels cleared');
}

document.getElementById('clearAllBtn')?.addEventListener('click',clearAllChannels);

function saveNotice(){
  const text=document.getElementById('noticeText')?.value||'';
  const enabled=document.getElementById('noticeEnabled')?.checked!==false;
  const notice={text,enabled};
  localStorage.setItem('vipNotice',JSON.stringify(notice));
  saveRemoteState({notice});
  toast('Notice saved');
}

document.getElementById('saveNoticeBtn')?.addEventListener('click',saveNotice);

function fillNotice(notice={},headline=''){
  const n=notice&&typeof notice==='object'?notice:{};
  const text=document.getElementById('noticeText');
  const enabled=document.getElementById('noticeEnabled');
  if(text)text.value=n.text||headline||'';
  if(enabled)enabled.checked=n.enabled!==false;
}

function saveSettings(){
  const settings={
    siteName:document.getElementById('siteName')?.value||'',
    siteLogo:document.getElementById('siteLogo')?.value||'',
    primaryColor:document.getElementById('primaryColor')?.value||''
  };
  localStorage.setItem('vipSettings',JSON.stringify(settings));
  saveRemoteState({settings});
  toast('Settings saved');
}

document.getElementById('saveSettingsBtn')?.addEventListener('click',saveSettings);

function searchEverything(){
  renderDashboard();
  renderManager();
}

document.getElementById('dashSearch')?.addEventListener('input',()=>{
  dashPage=1;
  renderDashboard();
});

document.getElementById('managerSearch')?.addEventListener('input',()=>{
  managerPage=1;
  renderManager();
});

document.getElementById('dashCat')?.addEventListener('change',()=>{
  dashPage=1;
  renderDashboard();
});

document.getElementById('managerCat')?.addEventListener('change',()=>{
  managerPage=1;
  renderManager();
});

document.getElementById('dashStatus')?.addEventListener('change',()=>{
  dashPage=1;
  renderDashboard();
});

document.getElementById('managerStatus')?.addEventListener('change',()=>{
  managerPage=1;
  renderManager();
});

document.getElementById('closePreview')?.addEventListener('click',closePreview);
document.getElementById('previewModal')?.addEventListener('click',e=>{
  if(e.target===e.currentTarget)closePreview();
});

async function loadDevices(){
  const box=document.getElementById('deviceList');
  if(!box)return;
  if(!connected){
    box.innerHTML='<div class="empty">Please login first.</div>';
    return;
  }
  try{
    const d=await api('/api/admin/devices');
    const list=Array.isArray(d.devices)?d.devices:[];
    if(!list.length){
      box.innerHTML='<div class="empty">No devices found.</div>';
      return;
    }
    box.innerHTML=list.map(x=>{
      const id=esc(x.deviceId||'');
      const name=esc(x.name||x.userName||'Unknown');
      const deviceName=esc(x.deviceName||'—');
      const status=String(x.status||'').toLowerCase()==='blocked'?'Blocked':'Allowed';
      return `<div class="device-card">
        <div class="device-main">
          <div class="device-title">${name}</div>
          <div class="device-meta"><b>Device Name:</b> ${deviceName}</div>
          <div class="device-meta"><b>Device ID:</b> <span style="word-break:break-all">${id}</span></div>
          <div class="device-meta"><b>Status:</b> ${status}</div>
        </div>
        <div class="device-actions">
          ${status==='Blocked'
            ? `<button type="button" onclick="unblockDevice('${id}')">Unblock</button>`
            : `<button type="button" onclick="blockDevice('${id}')">Block</button>`}
          <button type="button" class="del" onclick="deleteDevice('${id}')">🗑️ Delete Account</button>
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
  try{
    await api('/api/admin/devices/block',{
      method:'POST',
      body:JSON.stringify({deviceId})
    });
    await loadDevices();
    toast('Device blocked');
  }catch(e){
    alert(e.message);
  }
}

async function unblockDevice(deviceId){
  if(!confirm('এই device-টি unblock করতে চান?'))return;
  try{
    await api('/api/admin/devices/unblock',{
      method:'POST',
      body:JSON.stringify({deviceId})
    });
    await loadDevices();
    toast('Device unblocked');
  }catch(e){
    alert(e.message);
  }
}

async function approveDevice(deviceId){
  try{
    await api('/api/admin/devices/approve',{
      method:'POST',
      body:JSON.stringify({deviceId})
    });
    await loadDevices();
    toast('Device approved');
  }catch(e){
    alert(e.message);
  }
}

async function approveAllDevices(){
  if(!confirm('সব pending device approve করতে চান?'))return;
  try{
    await api('/api/admin/devices/approve-all',{method:'POST'});
    await loadDevices();
    toast('All devices approved');
  }catch(e){
    alert(e.message);
  }
}

async function logoutAllDevices(){
  if(!confirm('সব device logout করতে চান?'))return;
  try{
    await api('/api/admin/devices/logout-all',{method:'POST'});
    await loadDevices();
    toast('All devices logged out');
  }catch(e){
    alert(e.message);
  }
}

async function deleteDevice(deviceId){
  if(!confirm('এই account/device record মুছে ফেলতে চান?'))return;
  try{
    await api('/api/admin/devices?deviceId='+encodeURIComponent(deviceId),{
      method:'DELETE'
    });
    await loadDevices();
    toast('Account deleted');
  }catch(e){
    alert(e.message);
  }
}

window.loadDevices=loadDevices;
window.blockDevice=blockDevice;
window.unblockDevice=unblockDevice;
window.approveDevice=approveDevice;
window.approveAllDevices=approveAllDevices;
window.logoutAllDevices=logoutAllDevices;
window.deleteDevice=deleteDevice;
window.showSection=showSection;
window.filterCategory=filterCategory;
window.editChannel=editChannel;
window.deleteChannel=deleteChannel;
window.saveChannel=saveChannel;
window.importM3UUrl=importM3UUrl;
window.importXtream=importXtream;

function initLocal(){
  try{
    const lc=JSON.parse(localStorage.getItem('vipChannels')||'[]');
    const cats=JSON.parse(localStorage.getItem('vipCategories')||'[]');
    if(Array.isArray(lc)&&lc.length)channels=normalizeChannels(lc);
    categories=buildCategories(cats,channels);
  }catch(e){
    channels=[];
    categories=[...CATEGORY_ORDER];
  }
  render();
}

async function init(){
  initLocal();
  try{
    const s=await api('/api/admin/session');
    if(s?.ok||s?.loggedIn){
      connected=true;
      showLogin(false);
      setBackendState(true);
      await loadRemoteState();
      await loadDevices();
    }else{
      connected=false;
      setBackendState(false);
      showLogin(true);
    }
  }catch(e){
    connected=false;
    setBackendState(false);
    showLogin(true);
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  init();
});
