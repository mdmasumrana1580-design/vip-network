/* VIP-Network — Free/Paid + Device Guard
   Keeps the original device protection and adds reliable channel badges/access.
*/
(function () {
  "use strict";

  const DEVICE_KEY = "vip-network-device-id";
  const FREE_DEFAULTS = [
    "A Sports HD","ATN Bangla","BTV","Makkah Live","Independent","RTV",
    "Ananda TV","HUM TV","Sony Max 2","Sony Aath","Enter 10 Bangla",
    "Zee Bangla HD","B4U Music","Sony YaY","9XM","T Sports HD",
    "Star Sports SL 2","Sony Ten 1","Star Sports 1"
  ];

  const normalize = (v) => String(v || "")
    .toLowerCase()
    .replace(/[&]/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId) {
    deviceId = (crypto.randomUUID ? crypto.randomUUID() :
      "dev-" + Date.now() + "-" + Math.random().toString(36).slice(2));
    localStorage.setItem(DEVICE_KEY, deviceId);
  }
  window.VIP_DEVICE_ID = deviceId;

  const apiBase = () =>
    (window.VIP_WORKER_API || window.location.origin).replace(/\/$/, "");

  let blocked = false;
  let accessMap = Object.create(null);
  let settingsLoaded = false;
  let oneShotPaymentBypass = false;
  let replayingPaidClick = false;

  function defaultAccess(name) {
    return FREE_DEFAULTS.some(x => normalize(x) === normalize(name)) ? "free" : "paid";
  }

  function accessFor(name) {
    const key = normalize(name);
    if (Object.prototype.hasOwnProperty.call(accessMap, key)) {
      return String(accessMap[key]).toLowerCase() === "free" ? "free" : "paid";
    }
    return defaultAccess(name);
  }

  async function loadAccess() {
    try {
      const r = await fetch(apiBase() + "/api/device/check?deviceId=" +
        encodeURIComponent(deviceId), {
          headers: { "X-ViP-Device-ID": deviceId },
          cache: "no-store"
        });
      const d = await r.json().catch(() => ({}));
      const map = d && d.settings && d.settings.channelAccess;
      if (map && typeof map === "object") {
        accessMap = Object.create(null);
        Object.keys(map).forEach(k => {
          accessMap[normalize(k)] = map[k];
        });
      }
      settingsLoaded = true;
      decorateAll();
      return d;
    } catch (e) {
      return null;
    }
  }

  function showBlocked() {
    if (blocked) return;
    blocked = true;
    try {
      document.documentElement.innerHTML =
        '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>VIP NETWORK — Device Blocked</title><style>' +
        '*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#020508;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Arial,"Noto Sans Bengali",sans-serif}' +
        'body{min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center}' +
        '.box{padding:30px 18px;max-width:700px}.lock{font-size:90px}.title{display:inline-block;border:2px solid #e5ad24;border-radius:999px;padding:12px 22px;color:#ffd85a;font-weight:900;font-size:28px}.txt{font-size:19px;line-height:1.6;margin:25px 0}.contact{display:inline-block;padding:14px 25px;border:2px solid #e5ad24;border-radius:999px;color:#ffd85a;text-decoration:none;font-weight:800}</style></head>' +
        '<body><main class="box"><div class="lock">🔒</div><div class="title">🛡️ ডিভাইস ব্লক করা হয়েছে</div>' +
        '<p class="txt">আপনার ডিভাইসটি অ্যাডমিনিস্ট্রেটর কর্তৃক ব্লক করা হয়েছে।<br>অনুগ্রহ করে অ্যাডমিনিস্ট্রেটরের সাথে যোগাযোগ করুন।</p>' +
        '<a class="contact" href="https://m.me/alexranaroy" target="_blank" rel="noopener">🎧 অ্যাডমিনের সাথে যোগাযোগ করুন</a></main></body>';
    } catch (e) {
      document.body.innerHTML = '<h1 style="padding:24px;text-align:center">আপনার ডিভাইসটি ব্লক করা হয়েছে</h1>';
    }
  }
  window.VIP_SHOW_BLOCKED_PAGE = showBlocked;

  /* Existing app.js asks /api/payment/access for every card.
     This one-shot bypass makes FREE channels genuinely free without editing app.js. */
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    let url = "";
    try { url = typeof input === "string" ? input : input.url; } catch (e) {}
    if (oneShotPaymentBypass && /\/api\/payment\/access(?:\?|$)/.test(url || "")) {
      oneShotPaymentBypass = false;
      return Promise.resolve(new Response(
        JSON.stringify({ ok: true, active: true, blocked: false }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ));
    }
    return nativeFetch(input, init);
  };

  function getCardName(card) {
    const text = card && card.querySelector(".label");
    return text ? text.textContent.trim() : "";
  }

  function addBadge(card, paid) {
    if (!card) return;
    card.dataset.vipAccess = paid ? "paid" : "free";
    // site/app.js renders the single visible 👑 crown for paid channels.
  }

  function decorate(card) {
    const name = getCardName(card);
    if (!name) return;
    addBadge(card, accessFor(name) === "paid");
  }

  function decorateAll() {
    document.querySelectorAll(".card").forEach(decorate);
  }

  // No separate badge is injected here; app.js owns the visible 👑 crown.


  const observer = new MutationObserver(() => decorateAll());
  observer.observe(document.documentElement, { childList:true, subtree:true });

  /* Capture the click before app.js.
     FREE: let app.js continue, but bypass only its payment check.
     PAID: check subscription first; if active, replay the original click once. */
  document.addEventListener("click", async function (event) {
    const card = event.target && event.target.closest
      ? event.target.closest(".card") : null;
    if (!card || blocked) return;

    const name = getCardName(card);
    if (!name) return;

    const type = accessFor(name);

    if (type === "free") {
      oneShotPaymentBypass = true;
      return;
    }

    if (replayingPaidClick) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      const r = await nativeFetch(apiBase() + "/api/payment/access", {
        credentials: "include",
        cache: "no-store"
      });
      const access = await r.json().catch(() => null);

      if (access && access.ok && access.blocked === true) {
        showBlocked();
        return;
      }

      /* No valid access session must never fail open into paid playback. */
      if (!access || access.ok !== true || access.active !== true) {
        location.href = "/";
        return;
      }

      /* Active package: replay app.js card handler once. */
      replayingPaidClick = true;
      setTimeout(() => {
        oneShotPaymentBypass = true;
        card.click();
        setTimeout(() => { replayingPaidClick = false; }, 0);
      }, 0);
    } catch (e) {
      /* Payment/access check unavailable: fail closed so paid channels cannot become free. */
      location.href = "/";
    }
  }, true);

  async function checkDevice() {
    if (blocked) return false;
    try {
      const name = localStorage.getItem("vip-network-device-name") ||
        ((/Mobi|Android/i.test(navigator.userAgent)) ? "Mobile Device" : "Browser Device");

      const reg = await nativeFetch(apiBase() + "/api/device/register", {
        method:"POST",
        headers:{"content-type":"application/json","X-ViP-Device-ID":deviceId},
        body:JSON.stringify({
          deviceId:deviceId,
          deviceName:name,
          userAgent:navigator.userAgent
        }),
        cache:"no-store"
      });
      const rd = await reg.json().catch(() => ({}));

      if (reg.status === 403 || rd.blocked === true || (rd.device && rd.device.blocked === true)) {
        showBlocked();
        return false;
      }

      const d = await loadAccess();
      if (d && (d.blocked === true ||
        (d.device && d.device.blocked === true) ||
        String(d.device && d.device.status || "").toLowerCase() === "blocked")) {
        showBlocked();
        return false;
      }
      return true;
    } catch (e) {
      return true;
    }
  }

  checkDevice();
  setInterval(checkDevice, 10000);
  window.addEventListener("focus", checkDevice);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkDevice();
  });
})();
