const PLAYLIST_URL = "https://raw.githubusercontent.com/mdmasumrana1580-design/Playlist-/refs/heads/main/Playlist";
const PLAYLIST_CACHE_KEY = "vip-network-last-good-playlist-v1";
const PLAYLIST_REFRESH_MS = 10 * 60 * 1000;
const STREAM_FALLBACK_URL = "https://mp3tourl.com/videos/1789615987340-af8196aa-b471-46d6-b1a6-ce56f31a1da8.mp4";
const VIP_WORKER_API = window.VIP_WORKER_API || "";

let channels = [];
let current = "ALL";
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

  // Real online visitors: every browser gets a temporary ID and sends a heartbeat.
  // The Worker stores it in KV for 60 seconds, then /api/online returns the active count.
  const onlineApi = (window.VIP_WORKER_API || window.location.origin).replace(/\/$/, "");
  let onlineId = localStorage.getItem("vipOnlineId");
  if (!onlineId) {
    onlineId = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());
    localStorage.setItem("vipOnlineId", onlineId);
  }

  const refreshOnline = async function () {
    try {
      await fetch(onlineApi + "/api/online/ping", {
        method: "POST",
        headers: {"content-type":"application/json"},
        body: JSON.stringify({id: onlineId}),
        cache: "no-store"
      });
      const r = await fetch(onlineApi + "/api/online", {cache:"no-store"});
      if (!r.ok) throw new Error("online endpoint: " + r.status);
      const d = await r.json();
      updateOnlineVisitors(d.online);
    } catch (e) {
      console.warn("Online counter unavailable", e);
      updateOnlineVisitors(null);
    }
  };

  refreshOnline();
  setInterval(refreshOnline, 5*60*1000);
}

initVisitorCounter();
// Login-free guest identification: a browser gets a persistent random Visitor ID.
// This identifies the browser/device, not the real-world person.
async function initGuestTracker(){
  try{
    const key='vip-guest-visitor-id';
    let visitorId=localStorage.getItem(key);
    if(!visitorId){visitorId=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now());localStorage.setItem(key,visitorId)}
    const api=(window.VIP_WORKER_API||window.location.origin).replace(/\/$/,'');
    const deviceName=(navigator.userAgentData?.platform||navigator.platform||'Guest Browser')+' / '+(navigator.userAgentData?.mobile?'Mobile':'Browser');
    const send=async()=>{
      try{
        const r=await fetch(api+'/api/guest/ping',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({visitorId,deviceId:window.VIP_DEVICE_ID||'',deviceName,category:current,channel:document.title}),cache:'no-store'});
        if(r.status===403){
          console.warn('Guest visitor is blocked');
          // Keep the persistent visitor/device IDs intact while blocked so the same visitor cannot bypass the block by receiving a new ID.
          if(typeof window.VIP_SHOW_BLOCKED_PAGE==='function') window.VIP_SHOW_BLOCKED_PAGE();
          return false
        }
      }catch(e){console.warn('Guest tracker unavailable',e)}
      return true;
    };
    await fetch(api+'/api/guest/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({visitorId,deviceName}),cache:'no-store'}).catch(()=>{});
    send(); setInterval(send,5*60*1000);
  }catch(e){console.warn('Guest ID unavailable',e)}
}
initGuestTracker();


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
    if (/movie|movies|film|series|web\s*series|ott|cinema|flix/.test(text)) return "MOVIE & SERIES";
  if (/sport|cricket|football|fifa|espn|bein|wwe|golf|nfl|nba|ten\s*cricket|ptv\s*sports/.test(text)) return "SPORTS";
  if (/bangladesh|\bbd\b|bangla|somoy|jamuna|ekattor|dbc|maasranga|atn|channel\s*24|news24|independent|ntv|rtv|banglavision|boishakhi|gazi\s*tv|btv|duronto|deepto|nagorik|mohona|asian\s*tv|desh\s*tv|bijoy\s*tv|mytv|satv|ekushey/.test(text)) return "BD";
  if (/india|indian|sony|zee|star|colors|set\b|sab\b|aaj\s*tak|ndtv|republic|news18|times\s*now|india\s*tv|dd\s*(national|sports)|sun\s*tv|asianet|vijay|jaya|starplus|star\s*gold|sony\s*(max|pix|wah|yay|pal)|&pictures|b4u|movies\s*now|mnx|hbo\s*india/.test(text)) return "INDIA";
  return "OTHER";
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
      if (/^(https?|rtmp|rtsp|hls):\/\//i.test(line)) {
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
    const categoryOk = current === "ALL" || c.cat === current;
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

function play(c, clickedCard, retryOriginal) {
  currentChannelIndex = visibleChannels.indexOf(c);
  if (welcomeVideo) welcomeVideo.classList.add("welcome-hidden");
  if (videoBox) videoBox.classList.remove("welcome-active");
  const liveBadge = document.getElementById("liveBadge");
  if (liveBadge) liveBadge.style.display = "flex";

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
  video.muted = false;
  video.volume = 1;

  const originalUrl = c.url;
  let fallbackUsed = !retryOriginal && c._usingFallback === true;
  const sourceUrl = fallbackUsed ? STREAM_FALLBACK_URL : originalUrl;

  function showPlaybackError() {
    const note = document.getElementById("note");
    note.textContent = "ভিডিও চালু করা যাচ্ছে না।";
    note.style.display = "block";
  }

  function switchToFallback() {
    if (fallbackUsed) {
      showPlaybackError();
      return;
    }
    fallbackUsed = true;
    c._usingFallback = true;
    if (hls) {
      try { hls.destroy(); } catch (e) {}
      hls = null;
    }
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.src = STREAM_FALLBACK_URL;
    video.addEventListener("loadedmetadata", startPlayback, {once:true});
    video.addEventListener("canplay", startPlayback, {once:true});
    startPlayback();
  }

  function startPlayback() {
    const p = video.play();
    if (p && p.catch) p.catch(function () {
      if (!fallbackUsed) switchToFallback();
      else showPlaybackError();
    });
  }

  if (/\.m3u8(\?|$)/i.test(sourceUrl) && window.Hls && Hls.isSupported()) {
    hls = new Hls({ enableWorker:true, lowLatencyMode:true, backBufferLength:30 });
    hls.attachMedia(video);
    hls.on(Hls.Events.MEDIA_ATTACHED, function () {
      if (hls) hls.loadSource(sourceUrl);
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
        switchToFallback();
      }
    });
  } else {
    video.src = sourceUrl;
    video.addEventListener("loadedmetadata", startPlayback, {once:true});
    video.addEventListener("canplay", startPlayback, {once:true});
    video.addEventListener("error", function () {
      if (!fallbackUsed) switchToFallback();
      else showPlaybackError();
    }, {once:true});
    startPlayback();
  }
}

async function requestNativeFullscreen() {
  if (!videoBox) return;
  try {
    if (videoBox.requestFullscreen) {
      await videoBox.requestFullscreen({navigationUI:"hide"});
    } else if (videoBox.webkitRequestFullscreen) {
      videoBox.webkitRequestFullscreen();
    } else {
      videoBox.classList.add("vip-css-fullscreen");
    }
  } catch (e) {
    videoBox.classList.add("vip-css-fullscreen");
  }
  try {
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock("landscape");
    }
  } catch (e) {
    // Orientation locking is browser-dependent; keep normal fullscreen if unavailable.
  }
}

async function exitNativeFullscreen() {
  try {
    if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch (e) {}
  if (videoBox) {
    videoBox.classList.remove("vip-css-fullscreen","vip-fullscreen","is-fullscreen","vip-orientation-fallback");
  }
  try {
    if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
  } catch (e) {}
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
    if (video) {
      video.style.width = isFs ? "100%" : "";
      video.style.height = isFs ? "100%" : "";
      video.style.objectFit = isFs ? "cover" : "";
      video.style.objectPosition = isFs ? "center center" : "";
    }
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
document.addEventListener("fullscreenchange", function(){ if(!document.fullscreenElement){ try{screen.orientation?.unlock?.()}catch(e){} } syncFullscreenState(); });
document.addEventListener("webkitfullscreenchange", function(){ syncFullscreenState(); });
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

function currentChannelUrl() {
  const c = visibleChannels[currentChannelIndex];
  return c && c.url ? c.url : "";
}

function currentChannelName() {
  const c = visibleChannels[currentChannelIndex];
  return c && c.name ? c.name : "";
}

async function fetchMoviePlaylistFromWorker(){const apiBase=(window.VIP_WORKER_API||window.location.origin).replace(/\/$/,'');const r=await fetch(apiBase+'/api/movie-playlist',{cache:'no-store'});if(!r.ok)throw new Error('Movie playlist load failed: '+r.status);const data=await r.json();return (Array.isArray(data?.channels)?data.channels:[]).map(c=>({name:c.name||'Movie',cat:'MOVIE & SERIES',url:c.url||'',logo:c.logo||''})).filter(c=>c.url);}

async function fetchPlaylistFromWorker() {
  const apiBase = (window.VIP_WORKER_API || window.location.origin).replace(/\/$/, "");
  if (!apiBase) return [];
  const r = await fetch(apiBase + "/api/playlist", {cache:"no-store"});
  if (!r.ok) throw new Error("Worker playlist load failed: " + r.status);
  const data = await r.json();
  const list = Array.isArray(data?.channels) ? data.channels : [];
  return list.map(function(c){
    return {name:c.name||"Live Channel",cat:catFor(c.name,c.category),url:c.url||"",logo:c.logo||""};
  }).filter(function(c){return c.url;});
}

async function fetchPlaylistFromGithub() {
  const response = await fetch(PLAYLIST_URL, {
    cache: "no-store",
    headers: {"cache-control":"no-cache"}
  });
  if (!response.ok) throw new Error("GitHub playlist load failed: " + response.status);
  const parsed = parseM3U(await response.text());
  if (!parsed.length) throw new Error("GitHub playlist is empty or invalid");
  return parsed.filter(function(c){return c.cat !== 'MOVIE & SERIES';});
}

function saveLastGoodPlaylist(list) {
  try {
    localStorage.setItem(PLAYLIST_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      channels: list
    }));
  } catch (e) {
    console.warn("Could not cache playlist", e);
  }
}

function loadLastGoodPlaylist() {
  try {
    const raw = localStorage.getItem(PLAYLIST_CACHE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data && data.channels) ? data.channels.filter(function(c){return !c || c.cat !== 'MOVIE & SERIES';}) : [];
  } catch (e) {
    return [];
  }
}

async function loadVipPlaylist() {
  const apiBase = (window.VIP_WORKER_API || window.location.origin).replace(/\/$/, "");
  if (apiBase) {
    try {
      let managed = await fetchPlaylistFromWorker();
      try { const movies=await fetchMoviePlaylistFromWorker(); managed=managed.concat(movies); } catch(e) { console.warn('Movie playlist unavailable',e); }
      if (managed.length) {
        saveLastGoodPlaylist(managed);
        return managed;
      }
    } catch (e) {
      console.warn("Worker playlist unavailable; trying GitHub.", e);
    }
  }

  try {
    const fresh = await fetchPlaylistFromGithub();
    saveLastGoodPlaylist(fresh);
    return fresh;
  } catch (githubError) {
    console.warn("GitHub playlist load failed; using last successful playlist.", githubError);
  }

  const cached = loadLastGoodPlaylist();
  if (cached.length) return cached;
  throw new Error("Playlist load failed");
}

async function refreshVipPlaylist() {
  try {
    let fresh = [];
    try { fresh = await fetchPlaylistFromWorker(); } catch (e) {}
    if (!fresh.length) fresh = await fetchPlaylistFromGithub();
    try { fresh = fresh.concat(await fetchMoviePlaylistFromWorker()); } catch(e) { console.warn('Movie playlist refresh unavailable',e); }
    const oldCurrentName = currentChannelName ? currentChannelName() : "";
    const oldWasFallback = currentChannelUrl ? currentChannelUrl() === STREAM_FALLBACK_URL : false;
    channels = fresh;
    saveLastGoodPlaylist(fresh);
    render();
    if (oldCurrentName && oldWasFallback) {
      const updated = channels.find(function(c){ return c.name === oldCurrentName; });
      if (updated) play(updated, null, true);
    }
    console.log("VIP playlist auto-refreshed:", channels.length);
    return true;
  } catch (e) {
    console.warn("VIP playlist refresh failed; keeping current playlist.", e);
    return false;
  }
}

setInterval(refreshVipPlaylist, PLAYLIST_REFRESH_MS);

(function () {
  var s = document.createElement("style");
  s.textContent = ".headline-track span{color:#fff !important;}";
  document.head.appendChild(s);
})();

async function loadVipNotice() {
  const apiBase = (window.VIP_WORKER_API || "").replace(/\/$/, "");
  if (!apiBase) return;
  try {
    const r = await fetch(apiBase + "/api/state", {cache:"no-store"});
    if (!r.ok) return;
    const data = await r.json();
    const notice = data.notice || {};
    const text = notice.enabled === false ? "" : String(notice.text || data.headline || "");
    const track = document.querySelector(".headline-track");
    if (track && text) track.innerHTML = "<span>"+esc(text)+"</span><span>"+esc(text)+"</span>";
  } catch (e) {}
}

Promise.all([loadVipPlaylist(), loadVipNotice()])
  .then(function (result) {
    const parsed = result[0];
    if (!parsed.length) throw new Error("No valid channels");
    channels = parsed;
    render();
  })
  .catch(function (error) {
    console.error(error);
    empty.hidden = false;
    empty.textContent = "Playlist load করা যায়নি। M3U link check করুন।";
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
