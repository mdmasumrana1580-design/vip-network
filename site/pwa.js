(function(){
  const btn=document.getElementById("installAppBtn");
  let deferred=null;
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferred=e;if(btn)btn.hidden=false;});
  if(btn) btn.addEventListener("click",async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice;deferred=null;btn.hidden=true;});
})();