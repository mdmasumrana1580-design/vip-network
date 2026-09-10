
/* VIP NETWORK — Safe Dashboard UI
   Removes only the requested visual controls and adds an Import File menu.
   Existing app.js functions are reused; no API/KV logic is changed.
*/
(function(){
  'use strict';

  function switchImport(tab){
    const btn=document.querySelector('.import-tab[data-import-tab="'+tab+'"]');
    if(btn) btn.click();
    if(typeof showSection==='function') showSection('import');
  }

  function init(){
    /* Remove the non-functional Manage Playlist quick button only.
       Keep the underlying Channel Manager section for compatibility. */
    document.querySelectorAll('.quick-grid > button').forEach(btn=>{
      const text=(btn.textContent||'').trim().toLowerCase();
      if(text.includes('manage playlist')) btn.remove();
    });

    /* Remove the requested A/profile control without touching theme toggle. */
    const profile=document.getElementById('profileBtn');
    if(profile) profile.remove();

    const quick=[...document.querySelectorAll('.quick-grid > button')];
    const importBtn=quick.find(b=>(b.textContent||'').toLowerCase().includes('import file'));
    if(!importBtn || document.querySelector('.vip-import-wrap')) return;

    const wrap=document.createElement('div');
    wrap.className='vip-import-wrap';
    importBtn.parentNode.insertBefore(wrap,importBtn);
    wrap.appendChild(importBtn);

    importBtn.setAttribute('aria-haspopup','menu');
    importBtn.setAttribute('aria-expanded','false');
    importBtn.innerHTML='<span class="quick-icon">⇩</span><b>Import File</b><span class="vip-import-chevron">⌄</span>';

    const menu=document.createElement('div');
    menu.className='vip-import-menu';
    menu.setAttribute('role','menu');
    menu.innerHTML=
      '<button type="button" role="menuitem" data-tab="url"><span class="vip-import-icon">🔗</span><span>M3U URL</span><span class="vip-import-chevron">›</span></button>'+
      '<button type="button" role="menuitem" data-tab="file"><span class="vip-import-icon">📄</span><span>M3U File</span><span class="vip-import-chevron">›</span></button>'+
      '<button type="button" role="menuitem" data-tab="xtream"><span class="vip-import-icon">⚡</span><span>Xtream Codes</span><span class="vip-import-chevron">›</span></button>';
    wrap.appendChild(menu);

    importBtn.onclick=function(e){
      e.preventDefault();
      e.stopPropagation();
      const open=wrap.classList.toggle('open');
      importBtn.setAttribute('aria-expanded',String(open));
    };

    menu.querySelectorAll('button[data-tab]').forEach(b=>{
      b.addEventListener('click',function(e){
        e.stopPropagation();
        switchImport(this.dataset.tab);
        wrap.classList.remove('open');
        importBtn.setAttribute('aria-expanded','false');
      });
    });

    document.addEventListener('click',function(e){
      if(!wrap.contains(e.target)){
        wrap.classList.remove('open');
        importBtn.setAttribute('aria-expanded','false');
      }
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
