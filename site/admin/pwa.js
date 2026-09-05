(()=>{
  const base=new URL('./',location.href);
  const manifest=new URL('manifest.webmanifest',base);
  const link=document.querySelector('link[rel="manifest"]')||document.createElement('link');
  link.rel='manifest'; link.href=manifest.href;
  if(!link.parentNode)document.head.appendChild(link);
  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.pathname}).catch(()=>{}));
  }
})();
