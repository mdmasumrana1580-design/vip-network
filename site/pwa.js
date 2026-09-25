let deferredPrompt = null;

(function () {
  const getBtn = () => document.getElementById('installAppBtn');

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function hideInstallButton() {
    const b = getBtn();
    if (b) b.hidden = true;
  }

  function showInstallHelp() {
    let box = document.getElementById('pwaInstallHelp');
    if (box) return;
    box = document.createElement('div');
    box.id = 'pwaInstallHelp';
    box.style.cssText =
      'position:fixed;left:14px;right:14px;bottom:18px;z-index:2147483647;' +
      'padding:14px 16px;border-radius:14px;background:#10151d;color:#fff;' +
      'box-shadow:0 10px 35px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.16);' +
      'font:700 14px/1.45 system-ui,sans-serif;text-align:center;';
    box.innerHTML =
      '<div style="margin-bottom:8px">App Install is not available right now.</div>' +
      '<div style="font-size:12px;opacity:.85;font-weight:500">Chrome menu ⋮ → Add to Home screen / Install app ব্যবহার করুন।</div>' +
      '<button type="button" style="margin-top:10px;border:0;border-radius:9px;padding:8px 14px;font-weight:800">OK</button>';
    box.querySelector('button').onclick = () => box.remove();
    document.body.appendChild(box);
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    const b = getBtn();
    if (b && !isStandalone()) {
      b.hidden = false;
      b.onclick = async () => {
        if (!deferredPrompt) {
          showInstallHelp();
          return;
        }
        try {
          const promptEvent = deferredPrompt;
          deferredPrompt = null;
          await promptEvent.prompt();
          const choice = await promptEvent.userChoice;
          if (choice && choice.outcome === 'accepted') hideInstallButton();
          else {
            const btn = getBtn();
            if (btn) btn.hidden = false;
          }
        } catch (e) {
          deferredPrompt = null;
          const btn = getBtn();
          if (btn) btn.hidden = false;
          showInstallHelp();
        }
      };
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallButton();
  });

  window.addEventListener('load', () => {
    if (isStandalone()) hideInstallButton();
  });
})();

(() => {
  const CHECK_MS = 15 * 60 * 1000;
  let refreshing = false;
  let registration = null;

  function showUpdatePrompt(reg) {
    if (document.getElementById('pwaUpdatePrompt')) return;
    const box = document.createElement('div');
    box.id = 'pwaUpdatePrompt';
    box.innerHTML = '<div class="pwa-update-title">নতুন আপডেট এসেছে</div><div class="pwa-update-text">Website/App-এর নতুন ভার্সন প্রস্তুত। আপডেট করতে নিচের বাটনে চাপুন।</div><div class="pwa-update-actions"><button id="pwaUpdateNow" type="button">UPDATE NOW</button><button id="pwaUpdateLater" type="button">পরে</button></div>';
    Object.assign(box.style,{position:'fixed',left:'14px',right:'14px',bottom:'18px',zIndex:'2147483647',padding:'16px',borderRadius:'16px',background:'#10151d',color:'#fff',boxShadow:'0 10px 35px rgba(0,0,0,.55)',border:'1px solid rgba(255,255,255,.16)',fontFamily:'system-ui,sans-serif'});
    const title=box.querySelector('.pwa-update-title');Object.assign(title.style,{fontSize:'18px',fontWeight:'800',marginBottom:'6px'});
    const txt=box.querySelector('.pwa-update-text');Object.assign(txt.style,{fontSize:'14px',opacity:'.85',lineHeight:'1.45',marginBottom:'12px'});
    const actions=box.querySelector('.pwa-update-actions');Object.assign(actions.style,{display:'flex',gap:'8px'});
    box.querySelectorAll('button').forEach(b=>Object.assign(b.style,{border:0,borderRadius:'10px',padding:'10px 14px',fontWeight:'800',cursor:'pointer'}));
    box.querySelector('#pwaUpdateNow').style.background='#18c77b';box.querySelector('#pwaUpdateNow').style.color='#06140d';
    box.querySelector('#pwaUpdateLater').style.background='#2b3340';box.querySelector('#pwaUpdateLater').style.color='#fff';
    box.querySelector('#pwaUpdateNow').onclick=()=>{if(reg&&reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});};
    box.querySelector('#pwaUpdateLater').onclick=()=>box.remove();
    document.body.appendChild(box);
  }

  async function registerSW(){
    if(!('serviceWorker'in navigator))return;
    try{
      registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
      if(registration.waiting)showUpdatePrompt(registration);
      registration.addEventListener('updatefound',()=>{
        const w=registration.installing;if(!w)return;
        w.addEventListener('statechange',()=>{
          if(w.state==='installed'&&navigator.serviceWorker.controller)showUpdatePrompt(registration);
        });
      });
      setInterval(()=>registration.update().catch(()=>{}),CHECK_MS);
      window.addEventListener('focus',()=>registration.update().catch(()=>{}));
    }catch(e){}
  }

  navigator.serviceWorker?.addEventListener('controllerchange',()=>{
    if(refreshing)return;
    refreshing=true;
    window.location.reload();
  });
  window.addEventListener('load',registerSW);
})();
