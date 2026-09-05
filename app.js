const PLAYLIST_URL = "./playlist.m3u";
const VIP_WORKER_API = "";

let channels = [];
let current = "All";
let hls = null;
let currentChannelIndex = -1;
let visibleChannels = [];

const grid = document.getElementById("grid");
const empty = document.getElementById("empty");
const video = document.getElementById("video");
const section = document.getElementById("playerSection");
const welcomeVideo = document.getElementById("welcomeVideo");
const videoBox = document.querySelector(".video-box");
if (welcomeVideo) {
  welcomeVideo.muted = true;
  welcomeVideo.defaultMuted = true;
  welcomeVideo.playsInline = true;
  if (videoBox) videoBox.classList.add("welcome-active");
  const liveBadge = document.getElementById("liveBadge");
  if (liveBadge) liveBadge.style.display = "none";
  const hideWelcome = function () {
    welcomeVideo.classList.add("welcome-hidden");
    if (videoBox) videoBox.classList.remove("welcome-active");
  };
  welcomeVideo.addEventListener("ended", hideWelcome, {once:true});
  welcomeVideo.addEventListener("error", hideWelcome, {once:true});
  welcomeVideo.load();
  const startWelcome = function () {
    const p = welcomeVideo.play();
    if (p && p.catch) p.catch(function () {
      // Keep the intro visible; a muted MP4 is allowed to autoplay on supported browsers.
    });
  };
  welcomeVideo.addEventListener("loadeddata", startWelcome, {once:true});
  setTimeout(startWelcome, 150);
}

// Compact visitor stats in the header.
// Total visitors uses the current key-free Abacus counter service.
// Online visitors needs a real-time tracking backend; until one is connected,
// the UI shows a dash instead of displaying a misleading/fake number.
const VISITOR_COUNTER_KEY = "vip-network-masum-2026-total-visitors";
const VISITOR_COUNTER_API = "https://abacus.jasoncameron.dev";

function updateHeaderVisitor(value) {
  const el = document.getElementById("headerTotalVisitors");
  if (!el) return;
  const n = Number(value);
  el.textContent = Number.isFinite(n) ? n.toLocaleString("en-US") : "—";
}

function updateOnlineVisitors(value) {
  const el = document.getElementById("headerOnlineVisitors");
  if (!el) return;
  const n = Number(value);
  el.textContent = Number.isFinite(n) ? n.toLocaleString("en-US") : "—";
}

async function initVisitorCounter() {
  const sessionKey = "vipVisitorCounted";
  try {
    const counted = sessionStorage.getItem(sessionKey);
    let data;
    if (!counted) {
      const hit = await fetch(VISITOR_COUNTER_API + "/hit/" + encodeURIComponent("vip-network-masum-2026") + "/" + encodeURIComponent("total"), {
        method: "GET", cache: "no-store"
      });
      if (!hit.ok) throw new Error("counter hit failed: " + hit.status);
      data = await hit.json();
      sessionStorage.setItem(sessionKey, "1");
    } else {
      const current = await fetch(VISITOR_COUNTER_API + "/get/" + encodeURIComponent("vip-network-masum-2026") + "/" + encodeURIComponent("total"), {
        method: "GET", cache: "no-store"
      });
      if (!current.ok) throw new Error("counter get failed: " + current.status);
      data = await current.json();
    }
    updateHeaderVisitor(data.value);
  } catch (error) {
    console.warn("Visitor counter unavailable", error);
  }

  // Real shared Online Now requires a hosted realtime tracker.
  // Set window.VIP_ONLINE_ENDPOINT in config.js after creating your tracker.
  // The endpoint must return JSON like: {"online": 5}.
  if (window.VIP_ONLINE_ENDPOINT) {
    const refreshOnline = async function () {
      try {
        const r = await fetch(window.VIP_ONLINE_ENDPOINT, {cache:"no-store"});
        if (!r.ok) throw new Error("online endpoint: " + r.status);
        const d = await r.json();
        updateOnlineVisitors(d.online);
      } catch (e) {
        console.warn("Online counter unavailable", e);
      }
    };
    refreshOnline();
    setInterval(refreshOnline, 15000);
  } else {
    updateOnlineVisitors(null);
  }
}

initVisitorCounter();

// Premium overlay controls: click/tap the video to show, tap again to hide.
const vipVideoBox = document.getElementById("vipVideoBox");
const vipBottomControls = document.getElementById("vipBottomControls");
const vipMute = document.getElementById("vipMute");
const vipVolume = document.getElementById("vipVolume");
const vipFullscreen = document.getElementById("vipFullscreen");
const vipFullscreenLauncher = document.getElementById("vipFullscreenLauncher");
let vipControlsTimer = null;

function showVipControls() {
  if (!vipVideoBox) return;
  vipVideoBox.classList.add("vip-controls-visible");
  if (vipControlsTimer) clearTimeout(vipControlsTimer);
  vipControlsTimer = setTimeout(function(){
    vipVideoBox.classList.remove("vip-controls-visible");
  }, 4000);
}
function toggleVipControls() {
  if (!vipVideoBox) return;
  if (vipVideoBox.classList.contains("vip-controls-visible")) {
    vipVideoBox.classList.remove("vip-controls-visible");
    if (vipControlsTimer) clearTimeout(vipControlsTimer);
  } else {
    showVipControls();
  }
}

if (vipVideoBox) {
  vipVideoBox.addEventListener("click", function(e) {
    if (e.target.closest("button,input,.plyr__controls,.landscape-channel-controls,.vip-bottom-controls")) return;
    toggleVipControls();
  });
}

if (vipMute) vipMute.addEventListener("click", function(e){
  e.preventDefault(); e.stopPropagation();
  video.muted = !video.muted;
  vipMute.textContent = video.muted || video.volume === 0 ? "🔇" : "🔊";
  showVipControls();
});
if (vipVolume) vipVolume.addEventListener("input", function(e){
  e.stopPropagation();
  video.volume = Number(vipVolume.value);
  video.muted = video.volume === 0;
  vipMute.textContent = video.muted ? "🔇" : "🔊";
  showVipControls();
});
if (vipFullscreenLauncher) vipFullscreenLauncher.addEventListener("click", function(e){
  e.preventDefault(); e.stopPropagation();
  toggleNativeFullscreen();
  showVipControls();
});
if (vipFullscreen) vipFullscreen.addEventListener("click", function(e){
  e.preventDefault(); e.stopPropagation();
  toggleNativeFullscreen();
  showVipControls();
});

video.addEventListener("volumechange", function(){
  if (vipVolume) vipVolume.value = String(video.volume);
  if (vipMute) vipMute.textContent = video.muted || video.volume === 0 ? "🔇" : "🔊";
});


function esc(value) {
  return String(value || "").replace(/[&<>"']/g, function (m) {
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m];
  });
}

function catFor(name, group) {
  const text = ((name || "") + " " + (group || "")).toLowerCase();

  // SPORTS comes first, so sports channels stay together even if they are BD/India.
  if (/sport|cricket|football|fifa|eurosport|willow|ten\s*cricket|ptv\s*sports|tsn|espn|bein|wwe|golf|nfl|nba/.test(text)) {
    return "Sports";
  }

  // Bangladesh channels
  if (/bangla|bangladesh|bd\b|somoy|jamuna|ekattor|ekattor tv|dbc|maasranga|atn|channel\s*24|news24|independent|ntv|rtv|banglavision|boishakhi|gazi tv|gtv|b tv|bengal|duronto|deepto|nagorik|mohona|asian tv|desh tv|bijoy tv|mytv|satv|ekushey|bishwa|bangla tv|btv/.test(text)) {
    return "BD";
  }

  // India channels
  if (/india|indian|sony|zee|star|colors|set\b|sab\b|aaj tak|ndtv|republic|news18|times now|india tv|dd national|dd sports|sun tv|asianet|vijay|jaya|starplus|star gold|sony max|sony pix|sony wah|sony yay|sony pal|&pictures|b4u|movies now|mnx|hbo india/.test(text)) {
    return "India";
  }

  return "Others";
}

function parseM3U(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const out = [];
  let meta = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      const comma = line.indexOf(",");
      const name = comma >= 0 ? line.slice(comma + 1).trim() : "Live Channel";
      const groupMatch = line.match(/group-title="([^"]*)"/i);
      const logoMatch = line.match(/tvg-logo="([^"]*)"/i);

      meta = {
        name: name || "Live Channel",
        group: groupMatch ? groupMatch[1] : "",
        logo: logoMatch ? logoMatch[1] : ""
      };
      continue;
    }

    if (line.startsWith("#")) continue;

    if (meta) {
      if (/^(https?|rtmp|rtsp):\/\//i.test(line)) {
        out.push({
          name: meta.name,
          cat: catFor(meta.name, meta.group),
          url: line,
          logo: meta.logo
        });
      }
      meta = null;
    }
  }

  return out;
}

function render() {
  const q = "";

  grid.innerHTML = "";

  const list = channels.filter(function (c) {
    const categoryOk = current === "All" || c.cat === current;
    const searchOk = c.name.toLowerCase().includes(q);
    return categoryOk && searchOk;
  });
  visibleChannels = list;

  empty.hidden = list.length > 0;
  if (!list.length) {
    empty.textContent = channels.length ? "No channels found" : "Loading channels...";
  }

  list.forEach(function (c) {
    const el = document.createElement("article");
    el.className = "card";

    const icon = c.logo
      ? '<img src="' + esc(c.logo) + '" alt="" loading="lazy">'
      : "<span>TV</span>";

    el.innerHTML =
      '<div class="circle">' + icon + '</div>' +
      '<div class="label">' + esc(c.name) + '</div>';

    el.addEventListener("click", function () {
      play(c, el);
    });

    grid.appendChild(el);
  });
}

function play(c, clickedCard) {
  currentChannelIndex = visibleChannels.indexOf(c);
  if (welcomeVideo) welcomeVideo.classList.add("welcome-hidden");
  if (videoBox) videoBox.classList.remove("welcome-active");
  const liveBadge = document.getElementById("liveBadge");
  if (liveBadge) liveBadge.style.display = "flex";

  // The player is permanently reserved on the page and visually fixed below the header.
  // Selecting a channel therefore never inserts/removes layout and never changes scrollTop.
  section.hidden = false;
  document.getElementById("playerTitle").textContent = c.name;
  document.getElementById("note").style.display = "none";

  if (hls) {
    try { hls.destroy(); } catch (e) {}
    hls = null;
  }

  video.pause();
  video.removeAttribute("src");
  video.load();
  video.autoplay = true;
  video.playsInline = true;
  // Start with sound enabled. Because the channel card click is a user gesture,
  // browsers are more likely to allow playback with audio. Some mobile browsers
  // may still enforce their own autoplay policy.
  video.muted = false;
  video.volume = 1;

  function startPlayback() {
    const p = video.play();
    if (p && p.catch) {
      p.catch(function () {
        const note = document.getElementById("note");
        note.textContent = "ভিডিও চালু করা যাচ্ছে না। অন্য চ্যানেল চেষ্টা করুন।";
        note.style.display = "block";
      });
    }
  }

  if (/\.m3u8(\?|$)/i.test(c.url) && window.Hls && Hls.isSupported()) {
    hls = new Hls({ enableWorker:true, lowLatencyMode:true, backBufferLength:30 });
    hls.attachMedia(video);
    hls.on(Hls.Events.MEDIA_ATTACHED, function () {
      if (hls) hls.loadSource(c.url);
    });
    hls.on(Hls.Events.MANIFEST_PARSED, function () {
      video.muted = false;
      video.volume = 1;
      startPlayback();
    });
    hls.on(Hls.Events.ERROR, function (_event, data) {
      if (!data || !data.fatal || !hls) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        try { hls.recoverMediaError(); } catch (e) {}
      } else {
        try { hls.destroy(); } catch (e) {}
        hls = null;
        const note = document.getElementById("note");
        note.textContent = "ভিডিও লোড করা যাচ্ছে না। অন্য চ্যানেল চেষ্টা করুন।";
        note.style.display = "block";
      }
    });
  } else {
    video.src = c.url;
    video.addEventListener("loadedmetadata", startPlayback, {once:true});
    video.addEventListener("canplay", startPlayback, {once:true});
    startPlayback();
  }
}


// V31: real fullscreen + landscape on supported Android browsers/PWAs.
// The fullscreen button uses the browser Fullscreen API first, then locks
// orientation to landscape. This is required because CSS fullscreen alone
// cannot reliably rotate a phone in Chrome.
async function requestNativeFullscreen() {
  if (!vipVideoBox) return false;

  try {
    if (!document.fullscreenElement && vipVideoBox.requestFullscreen) {
      await vipVideoBox.requestFullscreen({ navigationUI: "hide" });
    }
  } catch (e) {
    // Some browsers reject navigationUI; retry without options.
    try {
      if (!document.fullscreenElement && vipVideoBox.requestFullscreen) {
        await vipVideoBox.requestFullscreen();
      }
    } catch (e2) {}
  }

  // Orientation locking is normally permitted after entering fullscreen.
  try {
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock("landscape");
    }
  } catch (e) {
    // Installed PWAs can still use the manifest orientation setting.
  }

  vipVideoBox.classList.add("vip-css-fullscreen");
  document.body.classList.add("vip-player-fullscreen");
  setFullscreenButtonState();
  return true;
}

async function exitNativeFullscreen() {
  try {
    if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
  } catch (e) {}

  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
  } catch (e) {}

  if (videoBox) videoBox.classList.remove("vip-css-fullscreen", "vip-orientation-fallback");
  document.body.classList.remove("vip-player-fullscreen");
  return true;
}

function isNativeFullscreen() {
  return !!(document.fullscreenElement || (videoBox && videoBox.classList.contains("vip-css-fullscreen")));
}

async function toggleNativeFullscreen() {
  if (isNativeFullscreen()) {
    await exitNativeFullscreen();
  } else {
    await requestNativeFullscreen();
  }
  syncFullscreenState();
  setTimeout(syncFullscreenState, 120);
  setTimeout(syncFullscreenState, 500);
}

function setFullscreenButtonState() {
  const isFs = isNativeFullscreen();
  if (videoBox) {
    videoBox.classList.toggle("vip-fullscreen", isFs);
    videoBox.classList.toggle("is-fullscreen", isFs);
    videoBox.classList.toggle("vip-css-fullscreen", isFs);
  }
  document.body.classList.toggle("vip-player-fullscreen", isFs);
  const controls = document.getElementById("landscapeChannelControls");
  if (controls) controls.setAttribute("aria-hidden", isFs ? "false" : "true");
}

function syncFullscreenState() {
  setFullscreenButtonState();
  requestAnimationFrame(setFullscreenButtonState);
}

function changeChannel(step) {
  if (!visibleChannels.length) return;
  let i = currentChannelIndex;
  if (i < 0) i = 0;
  i = (i + step + visibleChannels.length) % visibleChannels.length;
  currentChannelIndex = i;
  const wasFs = isNativeFullscreen() || (videoBox && videoBox.classList.contains("vip-css-fullscreen"));
  play(visibleChannels[i], null);
  if (wasFs) {
    // Reassert the overlay after the stream source changes.
    setTimeout(syncFullscreenState, 50);
  }
}

document.getElementById("prevChannel").addEventListener("click", function(e) {
  e.preventDefault(); e.stopPropagation(); changeChannel(-1); showVipControls();
});
document.getElementById("nextChannel").addEventListener("click", function(e) {
  e.preventDefault(); e.stopPropagation(); changeChannel(1); showVipControls();
});

window.addEventListener("orientationchange", syncFullscreenState);
document.addEventListener("fullscreenchange", syncFullscreenState);
document.addEventListener("webkitfullscreenchange", syncFullscreenState);
syncFullscreenState();

function closePlayer() {
  section.hidden = false;

  if (hls) {
    hls.destroy();
    hls = null;
  }

  video.pause();
  video.removeAttribute("src");
  video.load();
}

document.getElementById("closePlayer").addEventListener("click", closePlayer);

document.querySelectorAll("#cats button").forEach(function (button) {
  button.addEventListener("click", function () {
    document.querySelectorAll("#cats button").forEach(function (b) {
      b.classList.remove("active");
    });

    button.classList.add("active");
    current = button.dataset.cat;
    render();
  });
});

empty.hidden = false;
empty.textContent = "Loading channels...";

async function loadVipPlaylist() {
  // Admin/KV playlist is the primary source.
  try {
    const r = await fetch(VIP_WORKER_API + "/api/playlist", {cache:"no-store"});
    if (r.ok) {
      const text = await r.text();
      const parsed = parseM3U(text);
      if (parsed.length) return parsed;
    }
  } catch (e) {
    console.warn("Worker playlist unavailable; trying GitHub fallback.", e);
  }

  const response = await fetch(PLAYLIST_URL, {cache:"no-store"});
  if (!response.ok) throw new Error("Playlist load failed");
  return parseM3U(await response.text());
}

loadVipPlaylist()
  .then(function (parsed) {
    if (!parsed.length) throw new Error("No valid channels");
    channels = parsed;
    render();
  })
  .catch(function (error) {
    console.error(error);
    empty.hidden = false;
    empty.textContent = "Playlist load করা যায়নি। আবার Reload করুন।";
  });


/* V14: keep the page as a real root document scroll. Android Chrome can only
   collapse its address/search bar from root-page scrolling, not from a nested
   fixed #grid scroller. */
document.addEventListener("DOMContentLoaded", function(){
  const w=document.getElementById("welcomeVideo");
  const vb=w && w.closest(".video-box");
  if(w && vb && w.parentElement!==vb) vb.insertBefore(w,vb.firstChild);
  document.documentElement.style.overflowX="hidden";
  document.documentElement.style.overflowY="auto";
  document.body.style.overflowX="hidden";
  document.body.style.overflowY="auto";
  document.body.style.position="static";
  document.body.style.inset="auto";
});

// V12: block Android Chrome's native long-press video menu (Copy video frame / PiP)
// without disabling our normal tap-to-toggle controls.
(function preventNativeVideoLongPressMenu(){
  const targets = [
    document.getElementById("video"),
    document.getElementById("welcomeVideo"),
    document.getElementById("vipVideoBox")
  ].filter(Boolean);

  targets.forEach(function(el){
    ["contextmenu", "selectstart", "dragstart"].forEach(function(type){
      el.addEventListener(type, function(e){
        e.preventDefault();
        e.stopPropagation();
        return false;
      }, {capture:true});
    });
  });

  // Keep long-press from being interpreted as a text/drag gesture on touch devices.
  let touchStartAt = 0;
  let touchMoved = false;
  const box = document.getElementById("vipVideoBox");
  if (!box) return;

  box.addEventListener("touchstart", function(){
    touchStartAt = Date.now();
    touchMoved = false;
  }, {passive:true});
  box.addEventListener("touchmove", function(){
    touchMoved = true;
  }, {passive:true});
  box.addEventListener("touchend", function(){
    touchStartAt = 0;
    touchMoved = false;
  }, {passive:true});
})();
