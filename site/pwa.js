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

const lockPortrait = async () => {
  try {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (standalone && screen.orientation?.lock) await screen.orientation.lock('portrait');
  } catch (_) {}
};

const hideVipSplash = () => {
  const splash = document.getElementById('vipSplash');
  if (!splash) return;
  splash.classList.add('vip-splash-hide');
  window.setTimeout(() => splash.remove(), 450);
};

window.addEventListener('load', () => {
  lockPortrait();
  window.setTimeout(hideVipSplash, 1600);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  }
}, { once: true });

// Failsafe: never leave the splash blocking the app indefinitely.
window.setTimeout(hideVipSplash, 4500);
