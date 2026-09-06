let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;

  const button = document.getElementById('installAppBtn');
  if (button) {
    button.hidden = false;
    button.onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      button.hidden = true;
    };
  }
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const button = document.getElementById('installAppBtn');
  if (button) button.hidden = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}
