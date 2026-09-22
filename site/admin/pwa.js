(()=>{
  const base=new URL('./',location.href);
  const manifest=new URL('manifest.webmanifest',base);
  let link=document.querySelector('link[rel="manifest"]');
  if(!link){
    link=document.createElement('link');
    link.rel='manifest';
    document.head.appendChild(link);
  }
  link.href=manifest.href;
  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.pathname}).catch(()=>{});
    });
  }
})();
