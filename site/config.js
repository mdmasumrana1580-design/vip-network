/* VIP-NETWORK public site configuration + live Worker/KV sync */
window.VIP_WORKER_API = 'https://vip-network-tv.vip-network.workers.dev';
window.VIP_ONLINE_ENDPOINT = window.VIP_WORKER_API + '/api/visitor';

(function () {
  const API = window.VIP_WORKER_API.replace(/\/$/, '');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[m]));

  async function syncSite() {
    try {
      const [stateRes, settingsRes] = await Promise.all([
        fetch(API + '/api/state', { cache: 'no-store' }),
        fetch(API + '/api/settings', { cache: 'no-store' })
      ]);
      const state = stateRes.ok ? await stateRes.json() : {};
      const settings = settingsRes.ok ? await settingsRes.json() : {};

      const name = String(settings.siteName || 'VIP NETWORK');
      const subtitle = String(settings.subtitle || 'Live TV & Entertainment');
      document.title = name;
      document.querySelectorAll('.brand-wrap img.logo-image, .logo-image img').forEach(img => {
        if (settings.logo) img.src = settings.logo;
        img.alt = name;
      });
      const track = document.querySelector('.headline-track');
      const notice = state.notice || {};
      const msg = String(notice.text || state.headline || '');
      if (track && msg) {
        const x = esc(msg);
        track.innerHTML = '<span>' + x + '</span><span>' + x + '</span>';
      }
      const headline = document.querySelector('.headline');
      if (headline) headline.style.display = notice.enabled === false ? 'none' : '';

      const nav = document.getElementById('cats');
      const cats = Array.isArray(state.categories) ? state.categories : [];
      if (nav) {
        const preferred = ['All','Sports','BD','India','Others','Movie','Series'];
        const wanted = [...preferred, ...cats];
        wanted.forEach(cat => {
          if (cat === 'All') return;
          if (!nav.querySelector('[data-cat="' + CSS.escape(cat) + '"]')) {
            const b = document.createElement('button');
            b.type = 'button'; b.dataset.cat = cat; b.textContent = String(cat).toUpperCase();
            nav.appendChild(b);
          }
        });
      }
      document.querySelectorAll('.site-footer').forEach(f => f.textContent = '© 2026 ' + name + '. ALL RIGHTS RESERVED.');
      document.documentElement.dataset.vipSubtitle = subtitle;
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncSite, { once: true });
  else syncSite();
  setInterval(syncSite, 30000);
})();
