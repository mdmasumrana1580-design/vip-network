/* ViP-Network Admin Free/Paid integration loader
   Preserves the current admin/app.js logic and adds Free/Paid controls to Add/Edit.
*/
(async function(){
  const ORIGINAL='https://raw.githubusercontent.com/mdmasumrana1580-design/vip-network/refs/heads/main/site/admin/app.js?vip-admin-original=1';
  try{
    const r=await fetch(ORIGINAL,{cache:'no-store'});
    if(!r.ok) throw new Error('Original Admin Panel code could not be loaded ('+r.status+')');
    let src=await r.text();

    const marker='Object.assign(window,{showSection,loginWorker,logoutWorker,refreshData,preview,editChannel,saveSelectedChannel,deleteChannel';
    const injected=`
/* --- ViP Free/Paid Add/Edit integration --- */
(function(){
  function vipAddAccessFields(){
    const addForm=document.getElementById('channelForm');
    if(addForm && !document.getElementById('addAccess')){
      const wrap=document.createElement('label');
      wrap.innerHTML='👑 Free / Paid<select name="access" id="addAccess"><option value="free">🆓 FREE — No Crown</option><option value="paid">👑 PAID — Crown</option></select>';
      addForm.querySelector('button[type="submit"]')?.before(wrap);
    }
    const grid=document.querySelector('.edit-grid');
    if(grid && !document.getElementById('editAccess')){
      const wrap=document.createElement('label');
      wrap.innerHTML='👑 Free / Paid<select id="editAccess"><option value="free">🆓 FREE — No Crown</option><option value="paid">👑 PAID — Crown</option></select>';
      grid.appendChild(wrap);
    }
  }

  vipAddAccessFields();

  const form=document.getElementById('channelForm');
  if(form){
    form.addEventListener('submit',function(){
      const name=form.querySelector('[name="name"]')?.value?.trim();
      const value=document.getElementById('addAccess')?.value;
      if(name && value) channelAccess[normalizeAccessName(name)]=value==='free'?'free':'paid';
    },true);
  }

  const originalFillEditPanel=fillEditPanel;
  window.fillEditPanel=fillEditPanel=function(c){
    originalFillEditPanel(c);
    vipAddAccessFields();
    const el=document.getElementById('editAccess');
    if(el) el.value=getAccess(c.name);
  };

  const originalSaveSelectedChannel=saveSelectedChannel;
  window.saveSelectedChannel=async function(){
    const beforeName=document.getElementById('editName')?.value?.trim();
    const access=document.getElementById('editAccess')?.value;
    const result=await originalSaveSelectedChannel();
    const current=selected>=0?channels[selected]:null;
    const name=current?.name||beforeName;
    if(name && access){
      channelAccess[normalizeAccessName(name)]=access==='free'?'free':'paid';
      await saveAccessSettings();
      render();
      if(selected>=0) fillEditPanel(channels[selected]);
    }
    return result;
  };

  const originalEditChannel=editChannel;
  window.editChannel=function(i){
    const c=channels[i];
    if(!c) return;
    preview(i);
    showSection('dashboard');
    vipAddAccessFields();
    const el=document.getElementById('editAccess');
    if(el) el.value=getAccess(c.name);
  };

  vipAddAccessFields();
  /* Ensure access settings are loaded before the normal initial render. */
  const originalLoadRemoteState=loadRemoteState;
  loadRemoteState=async function(){
    await loadAccessSettings();
    return originalLoadRemoteState();
  };
})();
`;
    if(!src.includes(marker)) throw new Error('Admin app.js structure changed; patch stopped safely.');
    src=src.replace(marker, injected+'\\n'+marker);

    // Ensure Add/Edit controls are created before the original init runs.
    const initMarker='(async function init(){';
    if(!src.includes(initMarker)) throw new Error('Admin init marker not found; patch stopped safely.');

    // Evaluate the patched current app in global scope.
    const blob=new Blob([src],{type:'text/javascript'});
    const url=URL.createObjectURL(blob);
    const s=document.createElement('script');
    s.src=url;
    s.onload=()=>setTimeout(()=>URL.revokeObjectURL(url),1000);
    s.onerror=()=>{URL.revokeObjectURL(url); throw new Error('Patched Admin Panel failed to start');};
    document.head.appendChild(s);
  }catch(e){
    document.body.innerHTML='<div style="padding:24px;font-family:system-ui;background:#07111d;color:#fff;min-height:100vh"><h2>VIP-Network Admin Panel</h2><p style="color:#ff8b96">Admin Panel could not start.</p><pre style="white-space:pre-wrap;color:#b9c9d9">'+String(e.message||e).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</pre></div>';
  }
})();