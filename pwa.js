(function(){
  const btn=document.getElementById('installAppBtn');
  let deferredPrompt=null;
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
  if(standalone()){ if(btn) btn.hidden=true; return; }
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault(); deferredPrompt=e;
    if(btn) btn.hidden=false;
  });
  if(btn) btn.addEventListener('click',async()=>{
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt=null; btn.hidden=true;
  });
  window.addEventListener('appinstalled',()=>{ deferredPrompt=null; if(btn) btn.hidden=true; });
})();
