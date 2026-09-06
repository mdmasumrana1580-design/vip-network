/* ViP-TV app.js
 * Uses the existing Worker /api/playlist as the single source of truth.
 * One M3U import can contain TV + Movie/Series; Worker auto-categorizes it.
 */
const VIP_WORKER_API = "";
const PLAYLIST_URL = "/api/playlist";

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

function apiUrl(path) {
  return (window.VIP_WORKER_API || VIP_WORKER_API || "").replace(/\/$/, "") + path;
}

function esc(value) {
  return String(value || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

/* Frontend fallback detector. Worker is authoritative, but this also protects
   older KV records that do not yet have a Movie category. */
function catFor(name, group, existing) {
  const preset = String(existing || "").trim();
  if (/^movie$/i.test(preset)) return "Movie";
  const text = ((name || "") + " " + (group || "")).toLowerCase();

  if (/\b(movie|movies|film|films|cinema|web[\s._-]*movie|vod|video[\s._-]*on[\s._-]*demand)\b/.test(text) ||
      /\b(series|serial|season|episode|episod|s\d{1,2}e\d{1,3})\b/.test(text)) {
    return "Movie";
  }
  if (/sport|cricket|football|fifa|eurosport|willow|ten\s*cricket|ptv\s*sports|tsn|espn|bein|wwe|golf|nfl|nba/.test(text)) {
    return "Sports";
  }
  if (/bangla|bangladesh|\bbd\b|somoy|jamuna|ekattor|dbc|maasranga|atn|channel\s*24|news24|independent|ntv|rtv|banglavision|boishakhi|gazi tv|\bgtv\b|b tv|duronto|deepto|nagorik|mohona|asian tv|desh tv|bijoy tv|mytv|satv|ekushey|bishwa|bangla tv|\bbtv\b/.test(text)) {
    return "BD";
  }
  if (/india|indian|sony|zee|star|colors|\bset\b|\bsab\b|aaj tak|ndtv|republic|news18|times now|india tv|dd national|dd sports|sun tv|asianet|vijay|jaya|starplus|star gold|sony max|sony pix|sony wah|sony yay|sony pal|&pictures|b4u|movies now|mnx|hbo india/.test(text)) {
    return "India";
  }
  return "Others";
}

function normalizeChannel(c) {
  const name = String(c.name || c.title || "Unnamed");
  const group = String(c.group || c.groupTitle || c.category || "");
  const cat = catFor(name, group, c.cat || c.category);
  return {
    name,
    cat,
    category: cat,
    url: String(c.url || c.stream || c.streamUrl || ""),
    logo: String(c.logo || c.tvgLogo || c["tvg-logo"] || ""),
    status: String(c.status || "Unknown")
  };
}

const RENDER_BATCH_SIZE = 120;
let renderedCount = 0;
let filteredChannels = [];
let loadMoreButton = null;

function ensureLoadMoreButton() {
  if (loadMoreButton && loadMoreButton.isConnected) return loadMoreButton;
  loadMoreButton = document.createElement("button");
  loadMoreButton.type = "button";
  loadMoreButton.id = "loadMoreChannels";
  loadMoreButton.className = "load-more-btn";
  loadMoreButton.textContent = "Load More";
  loadMoreButton.style.cssText = "display:block;margin:16px auto 24px;padding:10px 22px;border:0;border-radius:10px;cursor:pointer;font-weight:700;";
  loadMoreButton.addEventListener("click", () => {
    appendNextBatch();
  });
  if (grid && grid.parentNode) grid.parentNode.insertBefore(loadMoreButton, grid.nextSibling);
  return loadMoreButton;
}

function appendNextBatch() {
  if (!grid) return;
  const end = Math.min(renderedCount + RENDER_BATCH_SIZE, filteredChannels.length);
  const frag = document.createDocumentFragment();

  for (let i = renderedCount; i < end; i++) {
    const c = filteredChannels[i];
    const el = document.createElement("article");
    el.className = "card";
    const icon = c.logo
      ? '<img src="' + esc(c.logo) + '" alt="" loading="lazy">'
      : "<span>" + (c.cat === "Movie" ? "🎬" : "TV") + "</span>";

    el.innerHTML =
      '<div class="circle">' + icon + '</div>' +
      '<div class="label">' + esc(c.name) + '</div>';
    el.addEventListener("click", () => play(c));
    frag.appendChild(el);
  }

  grid.appendChild(frag);
  renderedCount = end;
  visibleChannels = filteredChannels;

  const more = ensureLoadMoreButton();
  const remaining = filteredChannels.length - renderedCount;
  if (remaining > 0) {
    more.hidden = false;
    more.textContent = `Load More (${remaining} remaining)`;
  } else {
    more.hidden = true;
  }
}

function render() {
  if (!grid) return;
  grid.innerHTML = "";
  renderedCount = 0;
  filteredChannels = channels.filter(c => current === "All" || c.cat === current);
  visibleChannels = filteredChannels;

  empty.hidden = filteredChannels.length > 0;
  if (!filteredChannels.length) {
    empty.textContent = channels.length ? "No channels found" : "Loading channels...";
    if (loadMoreButton) loadMoreButton.hidden = true;
    return;
  }

  appendNextBatch();
}

function stopPlayback() {
  if (hls) {
    try { hls.destroy(); } catch (_) {}
    hls = null;
  }
  video.pause();
  video.removeAttribute("src");
  video.load();
}

function play(c) {
  currentChannelIndex = visibleChannels.indexOf(c);
  if (welcomeVideo) welcomeVideo.classList.add("welcome-hidden");
  if (videoBox) videoBox.classList.remove("welcome-active");

  const liveBadge = document.getElementById("liveBadge");
  if (liveBadge) liveBadge.style.display = "flex";

  section.hidden = false;
  const title = document.getElementById("playerTitle");
  const note = document.getElementById("note");
  if (title) title.textContent = c.name;
  if (note) note.style.display = "none";

  stopPlayback();
  video.autoplay = true;
  video.playsInline = true;
  video.muted = false;
  video.volume = 1;

  const start = () => {
    const p = video.play();
    if (p && p.catch) {
      p.catch(() => {
        if (note) {
          note.textContent = "ভিডিও চালু করা যাচ্ছে না। অন্যটি চেষ্টা করুন।";
          note.style.display = "block";
        }
      });
    }
  };

  if (/\.m3u8(\?|$)/i.test(c.url) && window.Hls && Hls.isSupported()) {
    hls = new Hls({ enableWorker:true, lowLatencyMode:true, backBufferLength:30 });
    hls.attachMedia(video);
    hls.on(Hls.Events.MEDIA_ATTACHED, () => hls && hls.loadSource(c.url));
    hls.on(Hls.Events.MANIFEST_PARSED, start);
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data || !data.fatal || !hls) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        try { hls.recoverMediaError(); } catch (_) {}
      } else {
        try { hls.destroy(); } catch (_) {}
        hls = null;
        if (note) {
          note.textContent = "ভিডিও লোড করা যাচ্ছে না। অন্যটি চেষ্টা করুন।";
          note.style.display = "block";
        }
      }
    });
  } else {
    video.src = c.url;
    video.addEventListener("loadedmetadata", start, {once:true});
    video.addEventListener("canplay", start, {once:true});
    start();
  }
}

function changeChannel(step) {
  if (!visibleChannels.length) return;
  let i = currentChannelIndex;
  if (i < 0) i = 0;
  i = (i + step + visibleChannels.length) % visibleChannels.length;
  currentChannelIndex = i;
  play(visibleChannels[i]);
}

async function loadVipPlaylist() {
  const response = await fetch(apiUrl(PLAYLIST_URL), {cache:"no-store"});
  if (!response.ok) throw new Error("Playlist API HTTP " + response.status);
  const data = await response.json();
  const raw = Array.isArray(data) ? data : (data.channels || []);
  channels = raw.map(normalizeChannel).filter(c => c.url);
  render();
}

function initWelcome() {
  if (!welcomeVideo) return;
  welcomeVideo.muted = true;
  welcomeVideo.defaultMuted = true;
  welcomeVideo.playsInline = true;
  if (videoBox) videoBox.classList.add("welcome-active");
  const badge = document.getElementById("liveBadge");
  if (badge) badge.style.display = "none";
  const hide = () => {
    welcomeVideo.classList.add("welcome-hidden");
    if (videoBox) videoBox.classList.remove("welcome-active");
  };
  welcomeVideo.addEventListener("ended", hide, {once:true});
  welcomeVideo.addEventListener("error", hide, {once:true});
  welcomeVideo.play().catch(() => {});
}

function initCategories() {
  document.querySelectorAll("#cats button").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#cats button").forEach(b => b.classList.remove("active"));
      button.classList.add("active");
      current = button.dataset.cat || "All";
      render();
    });
  });
}

function initPlayerControls() {
  const mute = document.getElementById("vipMute");
  const volume = document.getElementById("vipVolume");
  const fullscreen = document.getElementById("vipFullscreen");
  const prev = document.getElementById("prevChannel");
  const next = document.getElementById("nextChannel");
  const close = document.getElementById("closePlayer");

  if (mute) mute.addEventListener("click", e => {
    e.preventDefault();
    video.muted = !video.muted;
    mute.textContent = video.muted || video.volume === 0 ? "🔇" : "🔊";
  });
  if (volume) volume.addEventListener("input", () => {
    video.volume = Number(volume.value);
    video.muted = video.volume === 0;
    if (mute) mute.textContent = video.muted ? "🔇" : "🔊";
  });
  video.addEventListener("volumechange", () => {
    if (volume) volume.value = String(video.volume);
    if (mute) mute.textContent = video.muted || video.volume === 0 ? "🔇" : "🔊";
  });
  if (prev) prev.addEventListener("click", e => {e.preventDefault(); e.stopPropagation(); changeChannel(-1);});
  if (next) next.addEventListener("click", e => {e.preventDefault(); e.stopPropagation(); changeChannel(1);});
  if (close) close.addEventListener("click", stopPlayback);

  if (fullscreen) fullscreen.addEventListener("click", async e => {
    e.preventDefault();
    try {
      if (!document.fullscreenElement && videoBox && videoBox.requestFullscreen) {
        await videoBox.requestFullscreen();
        try { await screen.orientation.lock("landscape"); } catch (_) {}
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
        try { screen.orientation.unlock(); } catch (_) {}
      }
    } catch (_) {}
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initWelcome();
  initCategories();
  initPlayerControls();

  empty.hidden = false;
  empty.textContent = "Loading channels...";

  loadVipPlaylist().catch(error => {
    console.error(error);
    empty.hidden = false;
    empty.textContent = "Playlist load করা যায়নি। Admin Panel থেকে M3U import করুন।";
  });

  document.documentElement.style.overflowX = "hidden";
  document.documentElement.style.overflowY = "auto";
  document.body.style.overflowX = "hidden";
  document.body.style.overflowY = "auto";
});
