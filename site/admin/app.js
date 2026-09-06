const API=(window.VIP_ADMIN_WORKER_API||window.location.origin).replace(/\/$/,'');
let connected=false,state={channels:[],categories:[],notice:''};

const $=s=>document.querySelector(s);
async function api(path,opt={}){
  const r=await fetch(API+path,{credentials:'include',cache:'no-store',headers:{'content-type':'application/json',...(opt.headers||{})},...opt});
  const text=await r.text(); let data={}; try{data=JSON.parse(text)}catch{}
  if(!r.ok) throw new Error(data.error||`HTTP ${r.status}`);
  return data;
}
const toast=m=>{let e=$('#toast');if(!e){e=document.createElement('div');e.id='toast';e.style='position:fixed;right:15px;bottom:15px;padding:12px 16px;background:#18202b;color:#fff;border-radius:10px;z-index:99999';document.body.appendChild(e)}e.textContent=m;e.style.display='block';setTimeout(()=>e.style.display='none',2500)};
async function load(){
  try{let s=await api('/api/admin/state');state=s;connected=true;render();toast('Connected — Worker/KV');}
  catch(e){connected=false;toast('Connection failed: '+e.message);}
}
async function save(){
  if(!connected) throw new Error('Admin not connected to Worker');
  const s=await api('/api/admin/state',{method:'PUT',body:JSON.stringify(state)});
  state=s.state||state; render(); toast('Saved to Cloudflare KV');
}
function render(){
  const notice=$('#noticeText')||$('#notice'); if(notice) notice.value=state.notice||'';
  const list=$('#channelList'); if(list) list.innerHTML=state.channels.map((c,i)=>`<div class="channel-row"><b>${i+1}. ${esc(c.name)}</b><small>${esc(c.category)} · ${c.enabled?'Active':'Disabled'}</small></div>`).join('');
}
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
window.VIPAdmin={
  async login(password){const r=await api('/api/admin/login',{method:'POST',body:JSON.stringify({password})});connected=!!r.ok;await load();return r},
  load,save,
  async saveNotice(text){state.notice=String(text||'');await save()},
  async addChannel(c){state.channels.push({...c,id:c.id||crypto.randomUUID(),enabled:c.enabled!==false});if(c.category&&!state.categories.includes(c.category))state.categories.push(c.category);await save()},
  async deleteChannel(id){state.channels=state.channels.filter(c=>c.id!==id);await save()},
  async importM3UUrl(url){const r=await api('/api/admin/import-m3u-url',{method:'POST',body:JSON.stringify({url})});state=r.state;render();toast(`M3U imported: ${r.count}`);return r},
  async importM3UText(text){const r=await api('/api/admin/import-m3u',{method:'POST',body:JSON.stringify({text})});state=r.state;render();toast(`M3U imported: ${r.count}`);return r},
  async importXtream(data){const r=await api('/api/xtream/import',{method:'POST',body:JSON.stringify(data)});state=r.state;render();toast(`Xtream imported: ${r.count}`);return r}
};
document.addEventListener('DOMContentLoaded',()=>load());
