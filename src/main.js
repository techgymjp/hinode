import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MOUNTAINS from './data/mountains.json';
import STRUCTURES from './data/structures.json';
import OBSERVATORIES from './data/observatories.json';
import { createBgm } from './bgm.js';
import {
  sunPosition, moonPosition, moonPhase, moonAge, moonName, bearingOnSky,
  JST, jstMidnight, jstParts, fmtHM,
} from './astro.js';

// ---------------- サウンド（BGM・効果音） ----------------
const audio = createBgm();
const pref = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : v === '1'; } catch { return def; } };
const savePref = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* 保存できない環境 */ } };
let bgmOn = pref('hinode.bgm', true);
let sfxOn = pref('hinode.sfx', true);
const sfx = (name) => { if (sfxOn) audio.sfx(name); };
let lastTick = 0;
const sfxTick = () => { const n = performance.now(); if (n - lastTick > 90) { lastTick = n; sfx('tick'); } };

const DEG = Math.PI / 180;
const MIN = 60000, DAY = 86400000;
const $ = (id) => document.getElementById(id);
const wrap180 = (a) => ((a % 360) + 540) % 360 - 180;
const DIRS = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
const dirName = (az) => DIRS[Math.round(((az % 360) + 360) % 360 / 22.5) % 16];
const fmtDist = (m) => (m < 10000 ? (m / 1000).toFixed(1) : Math.round(m / 1000)) + 'km';
const WD = ['日', '月', '火', '水', '木', '金', '土'];
const CLASS_LABEL = { 100: '日本百名山', 200: '日本二百名山', 300: '日本三百名山' };
const RANK = { 100: 3, 200: 2, 300: 1, 0: 0 };
const rank = (p) => RANK[p.cls] || 0;
const NAME_COUNT = {};
for (const m of MOUNTAINS) NAME_COUNT[m.name] = (NAME_COUNT[m.name] || 0) + 1;
const uniqueName = (m) => (NAME_COUNT[m.name] > 1 && m.pref ? `${m.name}（${m.pref}）` : m.name);
const HEIGHTS = [1.6, 5, 10, 20, 30, 50, 100, 150, 200, 300, 500, 700, 1000, 1500, 2000, 3000, 5000];
const pad2 = (n) => String(n).padStart(2, '0');
const dateStr = (ms) => { const p = jstParts(ms); return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`; };
const parseDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? jstMidnight(+m[1], +m[2], +m[3]) : null; };
const todayT0 = () => { const p = jstParts(Date.now()); return jstMidnight(p.y, p.m, p.d); };

// ---------------- 状態 ----------------
const state = {
  obs: null,            // { lat, lon, ground, name }
  hIdx: 0, hOverride: null,
  heading: 90, pitch: 3, fov: 60,
  peaks: [],
  showLabels: false,
  t: Date.now(),        // 表示している時刻（UTC ms）
  dayT0: todayT0(),     // 表示している日の 0:00（JST）
  events: null,         // その日の出没
  horizon: null,        // Float32Array(3600) 地形の地平線 tan
  playing: false,
  selPeak: null,        // 最後にタップした山
};
const eyeHeight = () => (state.hOverride != null ? state.hOverride : HEIGHTS[state.hIdx]);
const h0 = () => (state.obs ? state.obs.ground + eyeHeight() : 0);

function snowline() {
  const v = $('opt-snow').value;
  if (v !== 'auto') return +v;
  const m = jstParts(state.t).m;
  return { 1: 1500, 2: 1500, 3: 1600, 4: 1900, 5: 2300, 6: 2700, 7: 0, 8: 0, 9: 0, 10: 2900, 11: 2500, 12: 1700 }[m];
}

// ---------------- 画面上のエラー表示 ----------------
function showError(msg) {
  try { toast(`エラー: ${msg}`, 'bad', 6000); } catch { alert(`エラー: ${msg}`); }
}
window.addEventListener('error', (e) => showError(e.message || String(e.error)));
window.addEventListener('unhandledrejection', (e) => showError((e.reason && e.reason.message) || String(e.reason)));

// ---------------- 標高タイル（メインスレッドで取得・デコード） ----------------
const DEM_SOURCES = {
  gsi: {
    url: (z, x, y) => `https://cyberjapandata.gsi.go.jp/xyz/dem_png/${z}/${x}/${y}.png`,
    decode(r, g, b) {
      const v = r * 65536 + g * 256 + b;
      if (v === 8388608) return 0;
      return (v < 8388608 ? v : v - 16777216) * 0.01;
    },
  },
  terrarium: {
    url: (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
    decode: (r, g, b) => r * 256 + g + b / 256 - 32768,
  },
};
const decodeCanvas = document.createElement('canvas');
decodeCanvas.width = decodeCanvas.height = 256;
const decodeCtx = decodeCanvas.getContext('2d', { willReadFrequently: true });
function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像のデコードに失敗')); };
    img.src = url;
  });
}
async function fetchTile(src, z, x, y) {
  const s = DEM_SOURCES[src];
  const res = await fetch(s.url(z, x, y), { mode: 'cors' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const img = await loadImage(await res.blob());
  decodeCtx.clearRect(0, 0, 256, 256);
  decodeCtx.drawImage(img, 0, 0);
  const px = decodeCtx.getImageData(0, 0, 256, 256).data;
  const out = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) {
    const h = s.decode(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
    out[i] = h > 0 ? h : 0;
  }
  return out;
}
async function fetchPhoto(z, x, y) {
  const res = await fetch(`https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/${z}/${x}/${y}.jpg`, { mode: 'cors' });
  if (!res.ok) return null;
  const img = await loadImage(await res.blob());
  decodeCtx.clearRect(0, 0, 256, 256);
  decodeCtx.drawImage(img, 0, 0);
  return new Uint8Array(decodeCtx.getImageData(0, 0, 256, 256).data.buffer.slice(0));
}
async function provideTile(m) {
  let data = null;
  if (m.kind === 'photo') {
    try { data = await fetchPhoto(m.z, m.x, m.y); } catch { data = null; }
    worker.postMessage({ type: 'tile', tid: m.tid, data }, data ? [data.buffer] : []);
    return;
  }
  try {
    data = await fetchTile(m.source, m.z, m.x, m.y);
  } catch {
    if (m.source !== 'terrarium') { try { data = await fetchTile('terrarium', m.z, m.x, m.y); } catch { data = null; } }
  }
  worker.postMessage({ type: 'tile', tid: m.tid, data }, data ? [data.buffer] : []);
}

// ---------------- Worker ----------------
const worker = new Worker(new URL('./worker.js', import.meta.url));
let reqId = 0;
const pending = new Map();
let progressFn = null;
function call(msg) {
  const id = ++reqId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ ...msg, id });
  });
}
worker.onerror = (e) => showError(`Worker: ${e.message || '読み込みに失敗しました'}`);
worker.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'needTile') { provideTile(m); return; }
  if (m.type === 'progress') { if (progressFn) progressFn(m.p); return; }
  if (m.type === 'rendered') { onRendered(m); return; }
  const p = pending.get(m.id);
  if (!p) return;
  pending.delete(m.id);
  if (m.type === 'error') p.reject(new Error(m.message)); else p.resolve(m);
};
function initWorker() {
  worker.postMessage({ type: 'init', peaks: MOUNTAINS, structures: STRUCTURES, source: $('opt-source').value });
  worker.postMessage({ type: 'options', buildings: $('opt-buildings').checked });
}

// ---------------- 描画 ----------------
const scene = $('scene'), overlay = $('overlay');
const sctx = scene.getContext('2d'), octx = overlay.getContext('2d');
const imgCanvas = document.createElement('canvas');
const ictx = imgCanvas.getContext('2d');
const layer = document.createElement('canvas');     // 地形だけを重ねる層（夜の暗さを地形にだけかける）
const lctx = layer.getContext('2d');
let imgParams = null;
let rendering = false, dirty = false, interacting = false, idleTimer = 0;
let cssW = 0, cssH = 0, dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cssW = window.innerWidth; cssH = window.innerHeight;
  for (const c of [scene, overlay, layer]) { c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr); }
  invalidate();
}
window.addEventListener('resize', resize);

const focal = () => cssW / (state.fov * DEG);
function project(az, tanAlt) {
  const f = focal();
  return { x: cssW / 2 + wrap180(az - state.heading) * DEG * f, y: cssH / 2 - f * (tanAlt - Math.tan(state.pitch * DEG)) };
}
function unproject(x, y) {
  const f = focal();
  return { az: (state.heading + (x - cssW / 2) / f / DEG + 360) % 360, tanAlt: (cssH / 2 - y) / f + Math.tan(state.pitch * DEG) };
}

const MARGIN_X = 2.4, MARGIN_Y = 1.6;
let panVelocity = 0;
let sceneVersion = 0;
function invalidate() { sceneVersion++; requestRender(); }
const fullQuality = () => Math.min(dpr, cssW < 700 ? 1.25 : 1.5);
const lowQuality = () => Math.min(dpr, 1) * 0.5;

// 地形の陰影に使う光の向き（太陽が出ていれば太陽の方角。10°刻みで描き直す）
let lightKey = '';
function lightDir() {
  const s = sunPosition(state.t, state.obs.lat, state.obs.lon);
  if (s.alt > -2) return { az: Math.round(s.az / 10) * 10, el: Math.round(Math.max(0, s.alt) / 10) * 10 };
  return { az: 210, el: 35 };
}
function checkLight() {
  if (!state.obs) return;
  const l = lightDir(), k = `${l.az}/${l.el}`;
  if (k !== lightKey) { lightKey = k; invalidate(); }
}

function needsRender(final) {
  const p = imgParams;
  if (!p || p.version !== sceneVersion) return true;
  const fNow = focal();
  if (Math.abs(wrap180(p.heading - state.heading)) + state.fov / 2 > p.fov / 2 + 0.01) return true;
  const fImg = p.width / (p.fov * DEG);
  const tImg = Math.tan(p.pitch * DEG), tNow = Math.tan(state.pitch * DEG);
  const hImg = (p.height / 2) / fImg, hNow = (cssH / 2) / fNow;
  if (tNow + hNow > tImg + hImg + 1e-4 || tNow - hNow < tImg - hImg - 1e-4) return true;
  const ratio = fImg / (fNow * (final ? fullQuality() : lowQuality()));
  if (final) return ratio < 0.92 || ratio > 2.2;
  return ratio < 0.5;
}
function requestRender() {
  draw();
  if (!state.obs || !cssW) return;
  if (needsRender(!interacting)) {
    dirty = true;
    if (!rendering) sendRender();
  }
}
function renderParams() {
  const l = lightDir();
  return { h0: h0(), snowline: snowline(), lightAz: l.az, lightEl: l.el };
}
function sendRender() {
  if (!state.obs || !cssW) return;
  dirty = false;
  rendering = true;
  const q = interacting ? lowQuality() : fullQuality();
  const lead = interacting ? Math.max(-state.fov * 0.8, Math.min(state.fov * 0.8, panVelocity * 0.35)) : 0;
  worker.postMessage({
    type: 'render', id: ++reqId, version: sceneVersion,
    heading: (state.heading + lead + 360) % 360, pitch: state.pitch, fov: Math.min(359, state.fov * MARGIN_X),
    width: Math.round(cssW * Math.min(359 / state.fov, MARGIN_X) * q), height: Math.round(cssH * MARGIN_Y * q),
    ...renderParams(),
  });
}
// ---- 360°の低解像度パノラマ（下絵） ----
const PANO_W = 2048, PANO_STRIPS = 8, PANO_TAN = 0.36;
const PANO_F = PANO_W / (2 * Math.PI);
const PANO_H = Math.round(2 * PANO_F * PANO_TAN);
const panoCanvas = document.createElement('canvas');
panoCanvas.width = PANO_W; panoCanvas.height = PANO_H;
const pctx = panoCanvas.getContext('2d');
let panoStrips = [];
let panoHasAny = false;
function resetPano() { panoStrips = new Array(PANO_STRIPS).fill(-1); }
resetPano();
function nextPanoStrip() {
  const cur = Math.floor(((state.heading % 360) + 360) % 360 / (360 / PANO_STRIPS));
  for (let k = 0; k < PANO_STRIPS; k++) {
    const i = (cur + (k % 2 ? (k + 1) / 2 : -k / 2) + PANO_STRIPS) % PANO_STRIPS;
    if (panoStrips[i] !== sceneVersion) return i;
  }
  return -1;
}
function sendPanoStrip() {
  const i = nextPanoStrip();
  if (i < 0 || !state.obs) return false;
  rendering = true;
  const sw = PANO_W / PANO_STRIPS;
  worker.postMessage({
    type: 'render', id: ++reqId, version: sceneVersion, pano: i,
    heading: (i + 0.5) * (360 / PANO_STRIPS), pitch: 0, fov: 360 / PANO_STRIPS,
    width: sw, height: PANO_H, ...renderParams(),
  });
  return true;
}
function onRendered(m) {
  rendering = false;
  if (m.params.pano !== undefined) {
    const i = m.params.pano;
    pctx.clearRect(i * (PANO_W / PANO_STRIPS), 0, PANO_W / PANO_STRIPS, PANO_H);
    pctx.putImageData(m.img, i * (PANO_W / PANO_STRIPS), 0);
    panoStrips[i] = m.params.version;
    panoHasAny = true;
    if (dirty || needsRender(!interacting)) sendRender();
    else sendPanoStrip();
    draw();
    return;
  }
  imgCanvas.width = m.img.width; imgCanvas.height = m.img.height;
  ictx.putImageData(m.img, 0, 0);
  imgParams = m.params;
  draw();
  if (dirty || needsRender(!interacting)) sendRender();
  else if (!interacting) sendPanoStrip();
}

// ---------------- 空の色 ----------------
// 太陽高度ごとの（天頂側, 地平線側）の色
const SKY_KEYS = [
  [-90, [3, 5, 12], [8, 12, 26]],
  [-18, [4, 7, 16], [11, 18, 38]],
  [-12, [10, 16, 40], [30, 42, 74]],
  [-8, [18, 26, 60], [90, 76, 110]],
  [-4, [31, 45, 92], [217, 132, 94]],
  [0, [54, 80, 143], [245, 162, 106]],
  [5, [74, 124, 198], [240, 210, 170]],
  [20, [63, 127, 214], [188, 214, 240]],
  [90, [52, 112, 205], [180, 208, 238]],
];
function skyColors(sunAlt) {
  let i = 0;
  while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] < sunAlt) i++;
  const [a0, t0, h0c] = SKY_KEYS[i], [a1, t1, h1] = SKY_KEYS[i + 1];
  const k = Math.max(0, Math.min(1, (sunAlt - a0) / (a1 - a0)));
  const mix = (p, q) => p.map((v, j) => Math.round(v + (q[j] - v) * k));
  return { top: mix(t0, t1), hor: mix(h0c, h1) };
}
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
// 夜の暗さ（地形にかける）
function nightTint(sunAlt, moonUp) {
  let a;
  if (sunAlt >= 6) a = 0;
  else if (sunAlt >= -12) a = (6 - sunAlt) / 18 * 0.8;
  else a = 0.82;
  a = Math.max(0, a - moonUp * 0.12);
  return a;
}

// ---------------- 星（実際の恒星ではなく、疑似乱数で配置した星。日周運動はする） ----------------
const STARS = (() => {
  let s = 12345;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const list = [];
  for (let i = 0; i < 700; i++) {
    const ra = r() * 360, dec = Math.asin(r() * 2 - 1) / DEG;
    list.push({ ra, dec, mag: r() ** 3 });
  }
  return list;
})();
function starAltAz(ra, dec, lst, lat) {
  const H = (lst - ra) * DEG, d = dec * DEG, la = lat * DEG;
  const alt = Math.asin(Math.sin(la) * Math.sin(d) + Math.cos(la) * Math.cos(d) * Math.cos(H));
  const az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(la) - Math.cos(d) * Math.sin(la) * Math.cos(H));
  return { alt: alt / DEG, az: ((az / DEG) + 360) % 360 };
}
const lstOf = (ms, lon) => ((280.46061837 + 360.98564736629 * (ms / DAY + 2440587.5 - 2451545) + lon) % 360 + 360) % 360;

// 月の形を描く（brightAngle: 明るい側の向き。画面上で 上=0° 右=90°）
function drawMoonDisc(ctx, x, y, r, illum, brightAngle, alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((brightAngle - 90) * DEG);
  ctx.globalAlpha = alpha;
  // 暗い部分（地球照）
  ctx.fillStyle = 'rgba(70,80,100,0.55)';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  // 明るい部分
  ctx.fillStyle = '#f6f2df';
  ctx.beginPath();
  const n = 32, kx = 1 - 2 * illum;
  for (let i = 0; i <= n; i++) { const th = -Math.PI / 2 + Math.PI * i / n; ctx.lineTo(r * Math.cos(th), r * Math.sin(th)); }
  for (let i = n; i >= 0; i--) { const th = -Math.PI / 2 + Math.PI * i / n; ctx.lineTo(r * kx * Math.cos(th), r * Math.sin(th)); }
  ctx.fill();
  ctx.restore();
}

// 1 日の軌跡（10 分ごと）をキャッシュ
let pathCache = { key: '', sun: [], moon: [] };
function dayPaths() {
  const key = `${state.dayT0}/${state.obs.lat}/${state.obs.lon}`;
  if (pathCache.key !== key) {
    const sun = [], moon = [];
    for (let t = state.dayT0; t <= state.dayT0 + DAY; t += 10 * MIN) {
      sun.push({ t, ...sunPosition(t, state.obs.lat, state.obs.lon) });
      moon.push({ t, ...moonPosition(t, state.obs.lat, state.obs.lon) });
    }
    pathCache = { key, sun, moon };
  }
  return pathCache;
}

// 空・太陽・月・軌跡（地形の後ろ）
function drawSky(sun, moon, phase) {
  const W = scene.width, H = scene.height;
  const f = W / (state.fov * DEG);
  const tp = Math.tan(state.pitch * DEG);
  const yOf = (alt) => H / 2 - f * (Math.tan(Math.max(-80, Math.min(80, alt)) * DEG) - tp);
  const xOf = (az) => W / 2 + wrap180(az - state.heading) * DEG * f;
  const horizonY = yOf(0);
  const { top, hor } = skyColors(sun.alt);
  const grad = sctx.createLinearGradient(0, yOf(45), 0, horizonY);
  grad.addColorStop(0, rgb(top)); grad.addColorStop(1, rgb(hor));
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, W, H);

  // 太陽の方角の地平線付近の明るみ（朝焼け・夕焼け）
  if (sun.alt > -14 && sun.alt < 25) {
    const sx = xOf(sun.az), sy = yOf(Math.max(sun.alt, -2));
    const k = sun.alt > 8 ? (25 - sun.alt) / 17 : sun.alt > -6 ? 1 : (sun.alt + 14) / 8;
    const rad = f * 35 * DEG;
    const g2 = sctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
    g2.addColorStop(0, `rgba(255,190,120,${0.55 * k})`);
    g2.addColorStop(0.4, `rgba(255,150,100,${0.22 * k})`);
    g2.addColorStop(1, 'rgba(255,150,100,0)');
    sctx.fillStyle = g2;
    sctx.fillRect(0, 0, W, H);
  }

  // 星
  const darkness = sun.alt < -6 ? Math.min(1, (-6 - sun.alt) / 8) : 0;
  if (darkness > 0) {
    const lst = lstOf(state.t, state.obs.lon);
    const moonGlow = moon.alt > 0 ? phase.illum * 0.5 : 0;
    for (const s of STARS) {
      if (s.mag > 0.75 * (1 - moonGlow) + 0.05) continue;
      const p = starAltAz(s.ra, s.dec, lst, state.obs.lat);
      if (p.alt < -1) continue;
      const x = xOf(p.az), y = yOf(p.alt);
      if (x < 0 || x > W || y < 0 || y > H) continue;
      const a = darkness * (1 - s.mag) * (1 - moonGlow * 0.6);
      sctx.fillStyle = `rgba(255,255,245,${a})`;
      sctx.fillRect(x, y, (1 + (1 - s.mag) * 1.4) * dpr, (1 + (1 - s.mag) * 1.4) * dpr);
    }
  }

  // 1 日の軌跡と時刻の目盛り
  const paths = dayPaths();
  const drawPath = (list, color, label) => {
    sctx.save();
    sctx.strokeStyle = color; sctx.lineWidth = 1.6 * dpr; sctx.setLineDash([6 * dpr, 5 * dpr]);
    sctx.beginPath();
    let pen = false, prevX = 0;
    for (const p of list) {
      const x = xOf(p.az), y = yOf(p.appAlt);
      if (p.appAlt < -12 || (pen && Math.abs(x - prevX) > W * 0.6)) { pen = false; continue; }
      if (pen) sctx.lineTo(x, y); else sctx.moveTo(x, y);
      pen = true; prevX = x;
    }
    sctx.stroke();
    sctx.setLineDash([]);
    sctx.fillStyle = color;
    sctx.font = `${11 * dpr}px system-ui, sans-serif`;
    sctx.textAlign = 'center';
    for (const p of list) {
      if ((p.t - state.dayT0) % (60 * MIN) !== 0 || p.appAlt < -8) continue;
      const x = xOf(p.az), y = yOf(p.appAlt);
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
      sctx.beginPath(); sctx.arc(x, y, 2.4 * dpr, 0, Math.PI * 2); sctx.fill();
      sctx.fillText(`${label}${jstParts(p.t).hh}時`, x, y - 6 * dpr);
    }
    sctx.restore();
  };
  drawPath(paths.sun, 'rgba(255,214,120,0.75)', '');
  drawPath(paths.moon, 'rgba(200,220,255,0.7)', '');

  // 太陽
  {
    const x = xOf(sun.az), y = yOf(sun.appAlt);
    const r = Math.max(sun.sd * DEG * f, 6 * dpr);
    if (x > -r * 8 && x < W + r * 8 && y > -r * 8 && y < H + r * 8) {
      const low = Math.max(0, Math.min(1, (6 - sun.appAlt) / 7));
      const g = sctx.createRadialGradient(x, y, r * 0.8, x, y, r * 6);
      g.addColorStop(0, `rgba(255,${230 - 70 * low},${170 - 110 * low},0.6)`);
      g.addColorStop(1, 'rgba(255,200,120,0)');
      sctx.fillStyle = g;
      sctx.beginPath(); sctx.arc(x, y, r * 6, 0, Math.PI * 2); sctx.fill();
      sctx.fillStyle = `rgb(255,${252 - 80 * low},${235 - 160 * low})`;
      sctx.beginPath(); sctx.arc(x, y, r, 0, Math.PI * 2); sctx.fill();
    }
  }
  // 月
  {
    const x = xOf(moon.az), y = yOf(moon.appAlt);
    const r = Math.max(moon.sd * DEG * f, 7 * dpr);
    if (x > -r * 4 && x < W + r * 4 && y > -r * 4 && y < H + r * 4) {
      const g = sctx.createRadialGradient(x, y, r, x, y, r * 4);
      g.addColorStop(0, `rgba(220,230,255,${0.25 * phase.illum})`);
      g.addColorStop(1, 'rgba(220,230,255,0)');
      sctx.fillStyle = g;
      sctx.beginPath(); sctx.arc(x, y, r * 4, 0, Math.PI * 2); sctx.fill();
      const ang = bearingOnSky(moon.az, moon.appAlt, sun.az, sun.appAlt);
      drawMoonDisc(sctx, x, y, r, phase.illum, ang, sun.alt > 0 ? 0.85 : 1);
    }
  }
}

function draw() {
  if (!state.obs) return;
  const W = scene.width, H = scene.height;
  const fNow = W / (state.fov * DEG);
  const tp = Math.tan(state.pitch * DEG);
  const sun = sunPosition(state.t, state.obs.lat, state.obs.lon);
  const moon = moonPosition(state.t, state.obs.lat, state.obs.lon);
  const phase = moonPhase(state.t);
  drawSky(sun, moon, phase);

  // 地形（空は透明）を層に描いてから、夜の暗さをかけて重ねる
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, W, H);
  lctx.imageSmoothingEnabled = true;
  let covered = false;
  let imgRect = null;
  if (imgParams) {
    const p = imgParams;
    const fImg = p.width / (p.fov * DEG);
    const s = fNow / fImg;
    const xc = W / 2 + wrap180(p.heading - state.heading) * DEG * fNow;
    const yc = H / 2 - fNow * (Math.tan(p.pitch * DEG) - tp);
    imgRect = [xc - p.width * s / 2, yc - p.height * s / 2, p.width * s, p.height * s];
    covered = imgRect[0] <= 0 && imgRect[1] <= 0 && imgRect[0] + imgRect[2] >= W && imgRect[1] + imgRect[3] >= H && p.version === sceneVersion;
  }
  if (panoHasAny && !covered) {
    const s = fNow / PANO_F;
    const yTop = H / 2 - fNow * (PANO_TAN - tp);
    const x0 = W / 2 - ((((state.heading % 360) + 360) % 360) * DEG) * fNow;
    const pw = PANO_W * s;
    for (let k = -1; k <= 1; k++) {
      const x = x0 + k * pw;
      if (x + pw < 0 || x > W) continue;
      lctx.drawImage(panoCanvas, x, yTop, pw, PANO_H * s);
    }
  }
  if (imgRect) lctx.drawImage(imgCanvas, ...imgRect);
  const tint = nightTint(sun.alt, moon.alt > 0 ? phase.illum : 0);
  lctx.globalCompositeOperation = 'source-atop';
  if (tint > 0) { lctx.fillStyle = `rgba(6,10,26,${tint})`; lctx.fillRect(0, 0, W, H); }
  // 朝夕の赤み
  if (sun.alt > -4 && sun.alt < 10) {
    const k = 1 - Math.abs(sun.alt - 2) / 8;
    lctx.fillStyle = `rgba(255,120,60,${0.13 * Math.max(0, k)})`;
    lctx.fillRect(0, 0, W, H);
  }
  lctx.globalCompositeOperation = 'source-over';
  sctx.drawImage(layer, 0, 0);

  drawOverlay(sun, moon);
  updateCompass(sun, moon);
}

// ---------------- 前面の表示（山名・出没の印） ----------------
function drawOverlay(sun, moon) {
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  octx.clearRect(0, 0, cssW, cssH);
  if (state.showLabels) drawLabels(state.peaks.filter((p) => p.visible && !p.here), '#fff');
  if (state.selPeak) drawLabels([state.selPeak], '#ffd166', true);

  // 出没の位置（地形の稜線上）
  if (state.events) {
    const marks = [];
    for (const body of ['sun', 'moon']) {
      for (const e of state.events[body].terrain) marks.push({ ...e, body });
    }
    octx.font = 'bold 12px system-ui, sans-serif';
    octx.textAlign = 'center';
    for (const m of marks) {
      const pt = project(m.az, Math.tan(m.horizon * DEG));
      if (pt.x < -40 || pt.x > cssW + 40) continue;
      const col = m.body === 'sun' ? '#ffb347' : '#b9d4ff';
      octx.strokeStyle = col; octx.fillStyle = col; octx.lineWidth = 2;
      octx.beginPath(); octx.moveTo(pt.x, pt.y - 2); octx.lineTo(pt.x, pt.y - 22); octx.stroke();
      octx.beginPath(); octx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2); octx.fill();
      const label = `${EV_NAME[m.body][m.type]} ${fmtHM(m.t)}`;
      const w = octx.measureText(label).width + 10;
      octx.fillStyle = 'rgba(0,0,0,0.6)';
      octx.fillRect(pt.x - w / 2, pt.y - 40, w, 18);
      octx.fillStyle = col;
      octx.fillText(label, pt.x, pt.y - 27);
    }
  }
  // 画面外の太陽・月の方向
  for (const [b, p, col] of [['☀', sun, '#ffcf70'], ['☾', moon, '#cfe0ff']]) {
    if (p.appAlt < -3) continue;
    const d = wrap180(p.az - state.heading);
    if (Math.abs(d) < state.fov / 2) continue;
    const right = d > 0;
    const topLimit = $('info').getBoundingClientRect().bottom + 22;
    const bottomLimit = cssH - ($('timebar').offsetHeight || 170) - 20;
    const y = Math.max(topLimit, Math.min(bottomLimit, project(p.az, Math.tan(Math.min(60, p.appAlt) * DEG)).y));
    octx.font = 'bold 14px system-ui, sans-serif';
    const text = right ? `${b} ${Math.round(Math.abs(d))}° ▶` : `◀ ${Math.round(Math.abs(d))}° ${b}`;
    const w = octx.measureText(text).width + 16;
    const x = right ? cssW - w - 8 : 8;
    octx.fillStyle = 'rgba(10,20,34,0.6)';
    octx.fillRect(x, y - 13, w, 24);
    octx.fillStyle = col; octx.textAlign = 'left';
    octx.fillText(text, x + 8, y + 4);
  }
}

function drawLabels(list, color, big = false) {
  const placed = [];
  const items = list
    .map((p) => ({ p, ...project(p.az, p.tanAlt) }))
    .filter((o) => o.x > -50 && o.x < cssW + 50 && o.y > -20 && o.y < cssH + 20)
    .sort((a, b) => (rank(b.p) - rank(a.p)) || (b.p.elev - a.p.elev));
  octx.font = `${big ? 'bold 17px' : 'bold 13px'} system-ui, sans-serif`;
  octx.textAlign = 'center';
  for (const o of items) {
    const label = big ? `${o.p.name}（${fmtDist(o.p.dist)}）` : o.p.name;
    const w = octx.measureText(label).width + 10, hgt = big ? 23 : 18;
    let ly = null;
    for (let k = 0; k < 6; k++) {
      const yy = o.y - 48 - k * (hgt + 2);
      const box = { x0: o.x - w / 2, x1: o.x + w / 2, y0: yy - hgt, y1: yy };
      if (yy - hgt < 10) break;
      if (!placed.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1)) { placed.push(box); ly = yy; break; }
    }
    if (ly === null) continue;
    octx.strokeStyle = color; octx.lineWidth = 1;
    octx.beginPath(); octx.moveTo(o.x, o.y - 3); octx.lineTo(o.x, ly); octx.stroke();
    octx.fillStyle = 'rgba(0,0,0,0.55)';
    octx.fillRect(o.x - w / 2, ly - hgt, w, hgt);
    octx.fillStyle = color;
    octx.fillText(label, o.x, ly - (big ? 6 : 5));
  }
}

function updateCompass(sun, moon) {
  $('compass-dial').setAttribute('transform', `rotate(${-state.heading})`);
  const half = Math.min(state.fov / 2, 80) * DEG, r = 40;
  $('compass-fov').setAttribute('d', `M0,0 L${-r * Math.sin(half)},${-r * Math.cos(half)} A${r},${r} 0 0 1 ${r * Math.sin(half)},${-r * Math.cos(half)} Z`);
  const place = (id, p) => {
    const el = $(id);
    el.style.opacity = p.appAlt > -1 ? 1 : 0.3;
    el.setAttribute('transform', `translate(${36 * Math.sin(p.az * DEG)},${-36 * Math.cos(p.az * DEG)})`);
  };
  place('compass-sun', sun); place('compass-moon', moon);
  const hd = ((Math.round(state.heading) % 360) + 360) % 360;
  $('compass-label').textContent = `${dirName(hd)} ${hd}°`;
  $('height-label').innerHTML = `<span class="h-ground">地上${eyeHeight()}m</span><span class="h-total">標高${Math.round(h0())}m</span>`;
}

// ---------------- 情報パネル ----------------
const EV_NAME = { sun: { rise: '日の出', set: '日の入り' }, moon: { rise: '月の出', set: '月の入り' } };
function updateInfo() {
  if (!state.obs) return;
  const p = jstParts(state.t);
  $('info-place').textContent = state.obs.name || '選択地点';
  $('info-date').textContent = `${p.y}年${p.m}月${p.d}日（${WD[p.wd]}）`;
  $('info-clock').textContent = `${pad2(p.hh)}:${pad2(p.mm)}`;
  const sun = sunPosition(state.t, state.obs.lat, state.obs.lon);
  const moon = moonPosition(state.t, state.obs.lat, state.obs.lon);
  const ph = moonPhase(state.t);
  const age = moonAge(state.t);
  const vis = (b) => {
    if (!state.horizon) return '';
    const hz = horizonAlt(b.az);
    if (b.appAlt + b.sd < hz) return '（地形に隠れている）';
    if (b.appAlt - b.sd < hz) return '（稜線にかかる）';
    return '';
  };
  $('info-sun').textContent = `太陽 ${dirName(sun.az)} ${sun.az.toFixed(1)}°・高度 ${sun.appAlt.toFixed(1)}°${vis(sun)}`;
  $('info-moon').textContent = `月齢 ${age.toFixed(1)} ${moonName(age)}・輝面 ${Math.round(ph.illum * 100)}%\n月 ${dirName(moon.az)} ${moon.az.toFixed(1)}°・高度 ${moon.appAlt.toFixed(1)}°${vis(moon)}`;
  const ic = $('moon-icon'), ictx2 = ic.getContext('2d');
  ictx2.clearRect(0, 0, ic.width, ic.height);
  drawMoonDisc(ictx2, 22, 22, 18, ph.illum, ph.waxing ? 90 : -90);
  // スライダー
  $('time-slider').value = Math.round((state.t - state.dayT0) / MIN);
  if ($('date').value !== dateStr(state.dayT0)) $('date').value = dateStr(state.dayT0);
  // BGM の明るさ
  audio.setMood(Math.max(0, Math.min(1, (sun.alt + 10) / 20)));
}
// 最高点が手前の肩（富士山の火口縁など）にわずかに隠れている山は、その方角の稜線を山頂として扱う
function fixPeaks() {
  if (!state.horizon) return;
  for (const p of state.peaks) {
    if (p.visible || p.here || p.dist < 1000) continue;
    const sky = horizonAlt(p.az);
    if (sky - Math.atan(p.tanAlt) / DEG < 0.6) { p.visible = true; p.tanAlt = Math.tan(sky * DEG); p.shoulder = true; }
  }
}
function horizonAlt(az) {
  const hz = state.horizon;
  if (!hz) return 0;
  const n = hz.length, x = (((az % 360) + 360) % 360) / (360 / n);
  const i = Math.floor(x) % n, j = (i + 1) % n, f = x - Math.floor(x);
  return Math.atan(hz[i] * (1 - f) + hz[j] * f) / DEG;
}

// ダイヤモンド富士・パール富士のように呼ぶときの山の名前
const shortName = (p) => (p.name === '富士山' ? '富士' : p.name);
// 出没の方角にある山（稜線がその山なら山の名前を付ける）
function peakAt(e, body) {
  let best = null, bd = 1.5;
  for (const p of state.peaks) {
    if (!p.visible || p.here || p.structure) continue;
    const d = Math.abs(wrap180(p.az - e.az));
    if (d < bd && Math.abs(Math.atan(p.tanAlt) / DEG - e.horizon) < 0.35) { bd = d; best = p; }
  }
  if (!best) return '';
  // 出没の前後 8 分の通り道が山頂（稜線の点）を通れば、ダイヤモンド／パール
  const top = Math.atan(best.tanAlt) / DEG;
  for (let t = e.t - 8 * MIN; t <= e.t + 8 * MIN; t += 10000) {
    const pos = (body === 'sun' ? sunPosition : moonPosition)(t, state.obs.lat, state.obs.lon);
    const dx = wrap180(pos.az - best.az) * Math.cos(top * DEG), dy = pos.appAlt - top;
    if (Math.hypot(dx, dy) <= pos.sd * 1.05) return `<span class="diamond">${body === 'sun' ? 'ダイヤモンド' : 'パール'}${shortName(best)}</span>`;
  }
  return `${best.name}の${wrap180(e.az - best.az) > 0 ? '右' : '左'}から`.replace('から', e.type === 'rise' ? 'から' : 'へ');
}

function renderEvents() {
  const box = $('events');
  if (!state.events) { box.innerHTML = '<div class="ev-wait">出没を計算中…</div>'; return; }
  const items = [];
  for (const body of ['sun', 'moon']) {
    const ev = state.events[body];
    for (const e of ev.terrain) items.push({ body, e, cal: ev.cal.find((c) => c.type === e.type) });
    // 暦では出没があるのに、地形に隠れて見えない
    for (const c of ev.cal) {
      if (!ev.terrain.some((e) => e.type === c.type)) items.push({ body, e: null, cal: c });
    }
    if (ev.transit) items.push({ body, transit: ev.transit });
  }
  items.sort((a, b) => (a.e || a.cal || a.transit).t - (b.e || b.cal || b.transit).t);
  const ico = (b, type) => (b === 'sun' ? (type === 'rise' ? '🌅' : type === 'set' ? '🌇' : '☀') : (type === 'rise' ? '🌙' : type === 'set' ? '🌘' : '🌕'));
  box.innerHTML = items.map((it, i) => {
    if (it.transit) {
      return `<button class="ev ${it.body}" data-i="${i}"><span class="ev-name">${ico(it.body, 'transit')} ${it.body === 'sun' ? '南中' : '月の南中'}</span><b>${fmtHM(it.transit.t)}</b><span class="ev-sub">高度${it.transit.alt.toFixed(1)}°</span></button>`;
    }
    const type = (it.e || it.cal).type;
    const name = EV_NAME[it.body][type];
    if (!it.e) {
      return `<button class="ev ${it.body} hidden-ev" data-i="${i}"><span class="ev-name">${ico(it.body, type)} ${name}</span><b>地形で見えない</b><span class="ev-sub">暦 ${fmtHM(it.cal.t)}</span></button>`;
    }
    const diff = it.cal ? Math.round((it.e.t - it.cal.t) / MIN) : null;
    const diffTxt = diff === null ? '' : diff === 0 ? '暦と同じ' : `暦 ${fmtHM(it.cal.t)}（${diff > 0 ? '+' : ''}${diff}分）`;
    const pk = peakAt(it.e, it.body);
    return `<button class="ev ${it.body}" data-i="${i}"><span class="ev-name">${ico(it.body, type)} ${name}</span><b>${fmtHM(it.e.t)}</b><span class="ev-sub">${dirName(it.e.az)} ${it.e.az.toFixed(0)}°${pk ? '・' + pk : ''}</span><span class="ev-sub">${diffTxt}</span></button>`;
  }).join('') || '<div class="ev-wait">この日は出没がありません</div>';
  box.querySelectorAll('.ev').forEach((b) => b.addEventListener('click', () => {
    const it = items[+b.dataset.i];
    const target = it.transit || it.e || it.cal;
    const down = !it.transit && target.type === 'set';
    sfx(down ? 'jumpDown' : 'jump');
    stopPlay();
    // 出の少し前・入りの少し後から見られるように、時刻はちょうどに合わせる
    setTime(target.t);
    const alt = it.transit ? target.alt : (it.e ? it.e.horizon : 0);
    const fov = it.transit ? Math.max(state.fov, 50) : Math.min(state.fov, 30);
    animateTo(target.az, Math.min(55, alt + (it.transit ? 0 : fov * 0.12)), fov);
  }));
}

// ---------------- 日付・時刻 ----------------
let eventsReq = 0;
async function loadDay() {
  if (!state.obs) return;
  state.events = null;
  renderEvents();
  const my = ++eventsReq;
  const r = await call({ type: 'day', t0: state.dayT0, days: 1 });
  if (my !== eventsReq) return;
  state.events = r.days[0];
  renderEvents();
  draw();
}
function setTime(t, { quiet = false } = {}) {
  const newT0 = (() => { const p = jstParts(t); return jstMidnight(p.y, p.m, p.d); })();
  state.t = t;
  if (newT0 !== state.dayT0) {
    const oldMonth = jstParts(state.dayT0).m;
    state.dayT0 = newT0;
    loadDay();
    if (jstParts(newT0).m !== oldMonth && $('opt-snow').value === 'auto') invalidate();
  }
  checkLight();
  updateInfo();
  draw();
  if (!quiet) updateHash();
}
$('time-slider').addEventListener('input', (e) => {
  stopPlay();
  sfxTick();
  setTime(state.dayT0 + +e.target.value * MIN);
});
$('date').addEventListener('change', (e) => {
  const t0 = parseDate(e.target.value);
  if (t0 == null) return;
  sfx('click');
  setTime(t0 + (state.t - state.dayT0));
});
const shiftDay = (n) => {
  const p = jstParts(state.dayT0 + n * DAY + 3 * 3600000);
  const t0 = jstMidnight(p.y, p.m, p.d);
  setTime(t0 + (state.t - state.dayT0));
};
bindRepeat($('btn-dprev'), () => { sfx('click'); shiftDay(-1); });
bindRepeat($('btn-dnext'), () => { sfx('click'); shiftDay(1); });
bindRepeat($('btn-tminus'), () => { sfxTick(); stopPlay(); setTime(Math.round((state.t - MIN) / MIN) * MIN); }, 120);
bindRepeat($('btn-tplus'), () => { sfxTick(); stopPlay(); setTime(Math.round((state.t + MIN) / MIN) * MIN); }, 120);
$('btn-now').addEventListener('click', () => {
  sfx('click');
  stopPlay();
  setTime(Math.floor(Date.now() / MIN) * MIN);
});

// 再生（分刻みで時間を進める）
let playRaf = 0, playLast = 0;
function startPlay() {
  state.playing = true;
  $('btn-play').textContent = '❚❚';
  $('btn-play').classList.add('on');
  playLast = performance.now();
  const step = (now) => {
    if (!state.playing) return;
    const dt = Math.min(0.25, (now - playLast) / 1000);
    playLast = now;
    const speed = +$('speed').value; // 分/秒
    setTime(state.t + dt * speed * MIN, { quiet: true });
    playRaf = requestAnimationFrame(step);
  };
  playRaf = requestAnimationFrame(step);
}
function stopPlay() {
  if (!state.playing) return;
  state.playing = false;
  cancelAnimationFrame(playRaf);
  $('btn-play').textContent = '▶';
  $('btn-play').classList.remove('on');
  state.t = Math.round(state.t / 1000) * 1000;
  updateHash();
}
$('btn-play').addEventListener('click', () => {
  if (state.playing) { sfx('pause'); stopPlay(); } else { sfx('play'); startPlay(); }
});
$('speed').addEventListener('change', () => sfx('click'));

// ---------------- 操作（ドラッグ・ピンチ・タップ） ----------------
const pointers = new Map();
let gesture = null;
const view = $('view');
function setInteracting(on) {
  clearTimeout(idleTimer);
  if (on) interacting = true;
  else idleTimer = setTimeout(() => { interacting = false; panVelocity = 0; requestRender(); }, 180);
}
function clampView() {
  state.fov = Math.max(0.8, Math.min(100, state.fov));
  state.pitch = Math.max(-40, Math.min(60, state.pitch));
  state.heading = (state.heading + 360) % 360;
}
view.addEventListener('pointerdown', (e) => {
  view.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
  gesture = snapshotGesture();
});
view.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX; p.y = e.clientY;
  if (!gesture) return;
  const pts = [...pointers.values()];
  const f = focal();
  const axisOf = (dx, dy) => (Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v');
  if (pts.length >= 2) {
    const [a, b] = pts;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const dx = mx - gesture.mx, dy = my - gesture.my;
    if (!gesture.axis) {
      const pinch = Math.abs(dist - gesture.dist), pan = Math.hypot(dx, dy);
      if (pinch > 18 && pinch > pan * 0.8) gesture.axis = 'zoom';
      else if (pan > 12) gesture.axis = axisOf(dx, dy);
    }
    if (gesture.axis === 'zoom') state.fov = gesture.fov * gesture.dist / Math.max(dist, 1);
    else if (gesture.axis === 'h') state.heading = gesture.heading - dx / f / DEG;
    else if (gesture.axis === 'v') state.pitch = Math.atan(Math.tan(gesture.pitch * DEG) + dy / f) / DEG;
    if (gesture.axis) gesture.moved = true;
  } else if (pts.length === 1) {
    const dx = p.x - gesture.mx, dy = p.y - gesture.my;
    if (!gesture.axis && Math.hypot(p.x - p.x0, p.y - p.y0) > 8) gesture.axis = axisOf(dx, dy);
    if (gesture.axis === 'h') state.heading = gesture.heading - dx / f / DEG;
    else if (gesture.axis === 'v') state.pitch = Math.atan(Math.tan(gesture.pitch * DEG) + dy / f) / DEG;
    if (gesture.axis) gesture.moved = true;
  }
  if (gesture.moved) {
    clampView();
    const now = performance.now();
    if (gesture.lastT) {
      const dt = Math.max(1, now - gesture.lastT) / 1000;
      panVelocity = panVelocity * 0.6 + wrap180(state.heading - gesture.lastH) / dt * 0.4;
    }
    gesture.lastT = now; gesture.lastH = state.heading;
    setInteracting(true); requestRender();
  }
});
function endPointer(e) {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  pointers.delete(e.pointerId);
  const wasMulti = gesture && gesture.count > 1;
  if (gesture && !gesture.moved && !wasMulti && pointers.size === 0 && performance.now() - p.t0 < 600) onTap(p.x, p.y);
  gesture = pointers.size ? snapshotGesture() : null;
  if (gesture && wasMulti) gesture.count = 2;
  setInteracting(false);
  if (!pointers.size) updateHash();
}
view.addEventListener('pointerup', endPointer);
view.addEventListener('pointercancel', endPointer);
function snapshotGesture() {
  const pts = [...pointers.values()];
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 1;
  return { mx, my, dist, fov: state.fov, heading: state.heading, pitch: state.pitch, moved: false, count: pts.length, axis: null };
}
view.addEventListener('wheel', (e) => {
  e.preventDefault();
  state.fov *= Math.exp(e.deltaY * 0.0015);
  clampView(); setInteracting(true); requestRender(); setInteracting(false);
}, { passive: false });
window.addEventListener('keydown', (e) => {
  if (!state.obs || ['INPUT', 'SELECT'].includes(e.target.tagName)) return;
  if (e.key === ' ') { e.preventDefault(); $('btn-play').click(); return; }
  if (e.key === ',' || e.key === '.') { stopPlay(); setTime(state.t + (e.key === '.' ? MIN : -MIN)); return; }
  const k = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, 2], ArrowDown: [0, -2] }[e.key];
  if (!k) return;
  state.heading += k[0] * state.fov / 60; state.pitch += k[1];
  clampView(); requestRender();
});
document.addEventListener('gesturestart', (e) => e.preventDefault());

// タップ: 山・太陽・月の名前を表示
function onTap(x, y) {
  if (!state.obs) return;
  const sun = sunPosition(state.t, state.obs.lat, state.obs.lon);
  const moon = moonPosition(state.t, state.obs.lat, state.obs.lon);
  for (const [b, p] of [['太陽', sun], ['月', moon]]) {
    const q = project(p.az, Math.tan(p.appAlt * DEG));
    if (Math.hypot(q.x - x, q.y - y) < Math.max(24, p.sd * DEG * focal() * 1.3)) {
      sfx('click');
      toast(`${b}：${dirName(p.az)} ${p.az.toFixed(2)}°・高度 ${p.appAlt.toFixed(2)}°`, '', 2600);
      return;
    }
  }
  let best = null, bd = 40;
  for (const p of state.peaks) {
    if (!p.visible || p.here) continue;
    const q = project(p.az, p.tanAlt);
    const d = Math.hypot(q.x - x, Math.max(0, q.y - y - 10) * 0.5 + Math.max(0, y - q.y - 60));
    if (Math.abs(q.x - x) < bd && d < bd) { bd = d; best = p; }
  }
  if (best) {
    sfx('click');
    state.selPeak = best;
    toast(`${best.name}（${best.yomi}）標高${best.elev}m・${dirName(best.az)} ${best.az.toFixed(1)}°・${fmtDist(best.dist)}\n「ダイヤモンド」で太陽・月が山頂に重なる日を探せます`, '', 3800);
  } else {
    state.selPeak = null;
  }
  draw();
}

// ---------------- 高さ ▲▼ ----------------
function bindRepeat(btn, fn, minDelay = 120) {
  let t = 0;
  const stop = () => { clearTimeout(t); t = 0; };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    fn();
    const rep = (delay) => { t = setTimeout(() => { fn(); rep(Math.max(minDelay, delay * 0.8)); }, delay); };
    rep(450);
  });
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointerleave', stop);
  btn.addEventListener('pointercancel', stop);
}
let heightTimer = 0;
function changeHeight(dir) {
  let n;
  if (state.hOverride != null) {
    const cur = state.hOverride;
    n = dir > 0 ? HEIGHTS.findIndex((v) => v > cur) : HEIGHTS.length - 1 - [...HEIGHTS].reverse().findIndex((v) => v < cur);
    if (n < 0 || n >= HEIGHTS.length) return;
    state.hOverride = null;
  } else {
    n = Math.max(0, Math.min(HEIGHTS.length - 1, state.hIdx + dir));
    if (n === state.hIdx) return;
  }
  sfx('click');
  state.hIdx = n;
  invalidate();
  clearTimeout(heightTimer);
  heightTimer = setTimeout(refreshTerrainDependent, 400);
}
bindRepeat($('btn-up'), () => changeHeight(1));
bindRepeat($('btn-down'), () => changeHeight(-1));

// 視点の高さが変わったら、見える山・地平線・出没を計算し直す
async function refreshTerrainDependent() {
  state.events = null; renderEvents();
  const pk = await call({ type: 'peaks', h0: h0() });
  state.peaks = pk.peaks;
  if (state.selPeak) state.selPeak = state.peaks.find((p) => p.name === state.selPeak.name && p.lat === state.selPeak.lat) || null;
  const hz = await call({ type: 'horizon', h0: h0() });
  state.horizon = hz.horizon;
  fixPeaks();
  await loadDay();
  updateInfo();
  updateHash();
}

// ---------------- トースト ----------------
function toast(msg, cls = '', ms = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.className = `show ${cls}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.className = ''; }, ms);
}

function animateTo(az, pitch, fov = state.fov) {
  const hh = state.heading, p0 = state.pitch, f0 = state.fov, dh = wrap180(az - hh), dp = pitch - p0;
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 800), e = k * k * (3 - 2 * k);
    state.heading = hh + dh * e; state.pitch = p0 + dp * e; state.fov = f0 * (fov / f0) ** e;
    clampView(); interacting = k < 1; requestRender();
    if (k < 1) requestAnimationFrame(step); else updateHash();
  };
  requestAnimationFrame(step);
}

// ---------------- 月間表 ----------------
let tableMonth = null;
async function openTable() {
  const p = jstParts(state.dayT0);
  tableMonth = { y: p.y, m: p.m };
  $('table-modal').classList.remove('hidden');
  await fillTable();
}
async function fillTable() {
  const { y, m } = tableMonth;
  $('table-title').textContent = `${y}年${m}月`;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const t0 = jstMidnight(y, m, 1);
  $('table-body').innerHTML = '<div class="ev-wait">計算中… <span id="table-prog">0%</span></div>';
  progressFn = (q) => { const el = $('table-prog'); if (el) el.textContent = `${Math.round(q * 100)}%`; };
  const r = await call({ type: 'day', t0, days });
  progressFn = null;
  if (tableMonth.y !== y || tableMonth.m !== m) return;
  const cell = (ev, type) => {
    const e = ev.terrain.find((x) => x.type === type), c = ev.cal.find((x) => x.type === type);
    if (!e && !c) return '<td class="na">—</td>';
    return `<td>${e ? fmtHM(e.t) : '<span class="hid">隠</span>'}<small>${c ? fmtHM(c.t) : '—'}</small></td>`;
  };
  const rows = r.days.map((d, i) => {
    const t = t0 + i * DAY;
    const pp = jstParts(t);
    const age = moonAge(t + 12 * 3600000);
    const ph = moonPhase(t + 12 * 3600000);
    const ic = `<canvas class="mini-moon" width="36" height="36" data-illum="${ph.illum}" data-wax="${ph.waxing ? 1 : 0}"></canvas>`;
    const cls = [pp.wd === 0 ? 'sun-day' : pp.wd === 6 ? 'sat-day' : '', t === state.dayT0 ? 'cur' : ''].join(' ');
    return `<tr class="${cls}" data-t="${t}"><th>${pp.d}<small>${WD[pp.wd]}</small></th>${cell(d.sun, 'rise')}${cell(d.sun, 'set')}${cell(d.moon, 'rise')}${cell(d.moon, 'set')}<td class="age">${ic}${age.toFixed(1)}</td></tr>`;
  }).join('');
  $('table-body').innerHTML = `<table class="month"><thead><tr><th>日</th><th>日の出</th><th>日の入</th><th>月の出</th><th>月の入</th><th>月齢<small>正午</small></th></tr></thead><tbody>${rows}</tbody></table>`;
  $('table-body').querySelectorAll('canvas.mini-moon').forEach((c) => {
    drawMoonDisc(c.getContext('2d'), 18, 18, 14, +c.dataset.illum, c.dataset.wax === '1' ? 90 : -90);
  });
  $('table-body').querySelectorAll('tr[data-t]').forEach((tr) => tr.addEventListener('click', () => {
    sfx('click');
    closeModal('table-modal');
    setTime(+tr.dataset.t + (state.t - state.dayT0));
  }));
  const cur = $('table-body').querySelector('tr.cur');
  if (cur) cur.scrollIntoView({ block: 'center' });
}
$('btn-table').addEventListener('click', () => { sfx('open'); stopPlay(); openTable(); });
$('btn-mprev').addEventListener('click', () => { sfx('click'); tableMonth.m--; if (tableMonth.m < 1) { tableMonth.m = 12; tableMonth.y--; } fillTable(); });
$('btn-mnext').addEventListener('click', () => { sfx('click'); tableMonth.m++; if (tableMonth.m > 12) { tableMonth.m = 1; tableMonth.y++; } fillTable(); });
function closeModal(id) { $(id).classList.add('hidden'); }
$('btn-table-close').addEventListener('click', () => { sfx('close'); closeModal('table-modal'); });

// ---------------- ダイヤモンド・パール予報 ----------------
function openAlign() {
  // 見えている山（富士山・百名山を上に、近い順）
  const list = state.peaks.filter((p) => p.visible && !p.here && !p.structure && p.dist > 1500)
    .sort((a, b) => ((b.name === '富士山') - (a.name === '富士山')) || (rank(b) - rank(a)) || (a.dist - b.dist));
  const sel = $('align-peak');
  sel.innerHTML = list.length
    ? list.map((p, i) => `<option value="${i}">${p.name}（${p.elev}m・${dirName(p.az)} ${p.az.toFixed(0)}°・${fmtDist(p.dist)}）</option>`).join('')
    : '<option value="">ここから見える山がありません</option>';
  sel._list = list;
  if (state.selPeak) {
    const i = list.findIndex((p) => p.name === state.selPeak.name && p.lat === state.selPeak.lat);
    if (i >= 0) sel.value = String(i);
  }
  $('align-body').innerHTML = '';
  $('align-modal').classList.remove('hidden');
}
async function runAlign() {
  const sel = $('align-peak');
  const p = sel._list && sel._list[+sel.value];
  if (!p) return;
  sfx('click');
  $('align-body').innerHTML = '<div class="ev-wait">1年分を計算中…</div>';
  const peakAlt = Math.atan(p.tanAlt) / DEG;
  const r = await call({ type: 'align', az: p.az, alt: peakAlt, t0: state.dayT0, days: 366 });
  // 地平線（山頂の稜線）より下を通るもの・太陽の高い日中の月は見えにくいので印を付ける
  const rows = r.list.map((a) => {
    const pp = jstParts(a.t);
    const isSun = a.body === 'sun';
    const ph = isSun ? null : moonPhase(a.t);
    const sunAlt = isSun ? null : sunPosition(a.t, state.obs.lat, state.obs.lon).alt;
    const name = isSun ? 'ダイヤモンド' : 'パール';
    const center = Math.abs(a.dAlt) < a.sd * 0.4 ? '◎ 山頂のほぼ真上' : a.dAlt > 0 ? '○ 少し上を通る' : '○ 少し下（山頂にかかる）';
    let note = '';
    if (!isSun) {
      if (ph.illum < 0.08) note = '・新月前後で見えない';
      else if (sunAlt > -4) note = '・明るい空';
    }
    return `<li data-t="${a.t}" class="${isSun ? 'sun' : 'moon'}"><span class="a-date">${pp.y}/${pp.m}/${pp.d}（${WD[pp.wd]}）<b>${fmtHM(a.t)}</b></span><span class="a-kind">${name}${shortName(p)}・${a.rising ? '昇る' : '沈む'}</span><span class="a-sub">${center}${isSun ? '' : `・月齢${moonAge(a.t).toFixed(1)}`}${note}</span></li>`;
  });
  $('align-body').innerHTML = rows.length
    ? `<ul class="align-list">${rows.join('')}</ul>`
    : '<div class="ev-wait">1年以内に山頂に重なる日はありません（太陽・月が通らない方角です）</div>';
  if (rows.length) sfx('found');
  $('align-body').querySelectorAll('li[data-t]').forEach((li) => li.addEventListener('click', () => {
    sfx('jump');
    closeModal('align-modal');
    stopPlay();
    state.selPeak = p;
    setTime(+li.dataset.t - 2 * MIN);
    animateTo(p.az, peakAlt + 0.8, 6);
  }));
}
$('btn-align').addEventListener('click', () => { sfx('open'); stopPlay(); openAlign(); });
$('btn-align-run').addEventListener('click', runAlign);
$('btn-align-close').addEventListener('click', () => { sfx('close'); closeModal('align-modal'); });
for (const id of ['table-modal', 'align-modal']) {
  $(id).addEventListener('click', (e) => { if (e.target.id === id) { sfx('close'); closeModal(id); } });
}

// ---------------- そのほかのボタン ----------------
$('btn-labels').addEventListener('click', () => {
  state.showLabels = !state.showLabels;
  sfx(state.showLabels ? 'on' : 'off');
  $('btn-labels').classList.toggle('on', state.showLabels);
  draw();
});
$('btn-place').addEventListener('click', () => { sfx('open'); stopPlay(); openPicker(); });
function updateBgmButton() {
  $('btn-bgm').classList.toggle('on', bgmOn);
  $('btn-bgm').textContent = bgmOn ? '♪ BGM' : '♪ オフ';
}
$('btn-bgm').addEventListener('click', () => {
  bgmOn = !bgmOn;
  savePref('hinode.bgm', bgmOn);
  audio.unlock();
  sfx(bgmOn ? 'on' : 'off');
  if (bgmOn) audio.start(); else audio.stop();
  updateBgmButton();
});
updateBgmButton();
$('opt-sfx').checked = sfxOn;
$('opt-sfx').addEventListener('change', () => { sfxOn = $('opt-sfx').checked; savePref('hinode.sfx', sfxOn); sfx('on'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) audio.suspend(); else audio.resume(); });
// 設定の開閉・選択にも効果音
document.querySelector('.settings summary').addEventListener('click', () => sfx('click'));
for (const id of ['opt-source', 'opt-snow']) $(id).addEventListener('change', () => sfx('click'));

// ---------------- 共有（URL に地点・日時・向きを入れる） ----------------
function updateHash() {
  if (!state.obs) return;
  const p = jstParts(state.t);
  const q = new URLSearchParams({
    lat: state.obs.lat.toFixed(5), lon: state.obs.lon.toFixed(5),
    d: dateStr(state.t), t: `${pad2(p.hh)}${pad2(p.mm)}`,
    h: String(eyeHeight()), az: state.heading.toFixed(1), fov: state.fov.toFixed(1), pt: state.pitch.toFixed(1),
  });
  if (state.obs.name) q.set('n', state.obs.name);
  if (state.obs.summit) q.set('s', String(state.obs.summit));
  history.replaceState(null, '', `#${q}`);
}
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const lat = +q.get('lat'), lon = +q.get('lon');
  if (!q.get('lat') || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    lat, lon, name: q.get('n') || '共有された地点', summit: +q.get('s') || 0,
    d: q.get('d'), t: q.get('t'), h: +q.get('h') || 0, az: +q.get('az'), fov: +q.get('fov'), pt: +q.get('pt'),
  };
}
$('btn-share').addEventListener('click', async () => {
  sfx('click');
  updateHash();
  const url = location.href;
  const p = jstParts(state.t);
  const text = `${state.obs.name || '選択地点'}の${p.m}月${p.d}日 ${fmtHM(state.t)} の空 #日の出月の出シミュレーター`;
  if (navigator.share) {
    try { await navigator.share({ title: '日の出・月の出シミュレーター', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('この画面のURLをコピーしました', 'good', 2000); }
  catch { toast(url, '', 5000); }
});

// ---------------- コンパス（端末の向き） ----------------
let deviceHeading = null;
function onOrientation(e) {
  let h = null;
  if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
  else if (e.absolute && typeof e.alpha === 'number') h = 360 - e.alpha;
  if (h === null) return;
  const so = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  deviceHeading = (h + so + 360) % 360;
}
async function enableCompass() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== 'granted') return;
    }
  } catch { return; }
  window.addEventListener('deviceorientationabsolute', onOrientation);
  window.addEventListener('deviceorientation', onOrientation);
}

// ---------------- 開始・地点の読み込み ----------------
// view: 共有 URL から復元する向き・時刻
async function startAt(lat, lon, { name = '', summit = 0, snapped = false, deck = 0, view: v = null } = {}) {
  $('start').classList.add('hidden');
  $('picker').classList.add('hidden');
  $('loading').classList.remove('hidden');
  $('loading-bar').style.width = '0%';
  $('loading-text').textContent = `${name ? name + ' の' : ''}地形データを読み込み中…`;
  stopPlay();
  progressFn = (p) => { $('loading-bar').style.width = `${Math.round(p * 100)}%`; };
  try {
    const r = await call({ type: 'load', lat, lon });
    let ground = r.ground;
    if (summit) ground = Math.max(ground, summit);
    state.obs = { lat, lon, ground, name, summit };
    const urbanStart = !summit && !deck && $('opt-buildings').checked && r.urban > 0.35;
    state.hIdx = urbanStart ? HEIGHTS.indexOf(30) : 0;
    state.hOverride = deck || null;
    if (v && v.h) {
      const i = HEIGHTS.indexOf(v.h);
      if (i >= 0) { state.hIdx = i; state.hOverride = null; } else state.hOverride = v.h;
    }
    $('loading-text').textContent = '見える山を計算中…';
    const pk = await call({ type: 'peaks', h0: h0() });
    state.peaks = pk.peaks;
    state.selPeak = null;
    $('loading-text').textContent = '地平線（山の稜線）を計算中…';
    $('loading-bar').style.width = '0%';
    const hz = await call({ type: 'horizon', h0: h0() });
    state.horizon = hz.horizon;
    fixPeaks();
    $('loading-text').textContent = '日の出・月の出を計算中…';

    // 日付と時刻
    const startDay = parseDate(v && v.d) ?? parseDate($('start-date').value) ?? todayT0();
    state.dayT0 = startDay;
    const ev = (await call({ type: 'day', t0: startDay, days: 1 })).days[0];
    state.events = ev;
    let t;
    let focus = null;
    if (v && /^\d{4}$/.test(v.t || '')) {
      t = startDay + (+v.t.slice(0, 2) * 60 + +v.t.slice(2)) * MIN;
    } else if (startDay === todayT0()) {
      t = Math.floor(Date.now() / MIN) * MIN;
    } else {
      // ほかの日: 日の出の少し前から
      const rise = ev.sun.terrain.find((e) => e.type === 'rise') || ev.sun.cal.find((e) => e.type === 'rise');
      t = rise ? Math.floor(rise.t / MIN) * MIN - 10 * MIN : startDay + 6 * 60 * MIN;
      if (rise) focus = rise;
    }
    state.t = t;
    // 向き: 太陽が出ていれば太陽、なければ次に昇る天体の方角
    if (v && Number.isFinite(v.az) && v.fov) {
      state.heading = v.az; state.fov = v.fov; state.pitch = Number.isFinite(v.pt) ? v.pt : 3;
    } else {
      if (!focus) {
        const sun = sunPosition(t, lat, lon), moon = moonPosition(t, lat, lon);
        const allEv = [...ev.sun.terrain.map((e) => ({ ...e, b: 'sun' })), ...ev.moon.terrain.map((e) => ({ ...e, b: 'moon' }))].sort((a, b) => a.t - b.t);
        if (sun.appAlt > horizonAlt(sun.az)) focus = { az: sun.az, horizon: Math.min(sun.appAlt, 30) - 8 };
        else if (moon.appAlt > horizonAlt(moon.az)) focus = { az: moon.az, horizon: Math.min(moon.appAlt, 30) - 8 };
        else focus = allEv.find((e) => e.t > t && e.type === 'rise') || allEv.find((e) => e.t > t) || { az: 90, horizon: 0 };
      }
      state.heading = focus.az;
      state.fov = window.innerWidth < window.innerHeight ? 45 : 60;
      state.pitch = Math.max(-10, (focus.horizon || 0) + state.fov * 0.1);
      clampView();
    }
    ['info', 'compass', 'height-ctrl', 'timebar'].forEach((id) => $(id).classList.remove('hidden'));
    panoHasAny = false; pctx.clearRect(0, 0, PANO_W, PANO_H); resetPano();
    imgParams = null;
    lightKey = '';
    if (bgmOn) audio.start();
    $('loading').classList.add('hidden');
    progressFn = null;
    resize();
    renderEvents();
    setTime(state.t);
    const notes = [];
    if (snapped) notes.push(`${name} 山頂（標高${summit}m）から見ています`);
    if (deck) notes.push(`${name}（地上${deck}m）から見ています`);
    if (urbanStart) notes.push('市街地のため、ビルの屋上（地上30m）から見ています。▼で地上に降りられます');
    notes.push('下のスライダーで時刻、▶で分刻みに再生できます');
    toast(notes.join('\n'), '', 4500);
  } catch (err) {
    progressFn = null;
    $('loading').classList.add('hidden');
    toast(`読み込みに失敗しました: ${err.message}`, 'bad', 4000);
    if (!state.obs) $('start').classList.remove('hidden');
  }
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('位置情報が使えません')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(e), { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });
}
const SUMMIT_SNAP_M = 100;
function nearbySummit(lat, lon) {
  let best = null, bd = SUMMIT_SNAP_M;
  for (const m of MOUNTAINS) {
    const d = Math.hypot((m.lat - lat) * 111320, (m.lon - lon) * 111320 * Math.cos(lat * DEG));
    if (d <= bd) { bd = d; best = m; }
  }
  return best;
}
const inJapan = (lat, lon) => lat > 20 && lat < 46.5 && lon > 122 && lon < 154.5;

$('btn-start').addEventListener('click', async () => {
  audio.unlock();
  sfx('start');
  initWorker();
  enableCompass();
  try {
    const { lat, lon } = await getPosition();
    if (!inJapan(lat, lon)) { toast('現在地が日本国外のため、地点を選んでください', 'bad', 3500); openPicker(); return; }
    const sm = nearbySummit(lat, lon);
    if (sm) startAt(sm.lat, sm.lon, { name: uniqueName(sm), summit: sm.elev, snapped: true });
    else startAt(lat, lon, { name: '現在地' });
  } catch {
    sfx('error');
    toast('現在地を取得できませんでした。地点を選んでください', 'bad', 3500);
    openPicker();
  }
});
$('btn-start-place').addEventListener('click', () => { audio.unlock(); sfx('open'); initWorker(); enableCompass(); openPicker(); });
$('start-date').value = dateStr(Date.now());
$('start-date').addEventListener('change', () => sfx('click'));
{
  const sh = readHash();
  if (sh) {
    const b = $('btn-start-shared');
    b.classList.remove('hidden');
    b.textContent = `共有された地点で見る（${sh.name}）`;
    b.addEventListener('click', () => {
      audio.unlock(); sfx('start'); initWorker(); enableCompass();
      startAt(sh.lat, sh.lon, { name: sh.name, summit: sh.summit, view: sh });
    });
  }
}

// ---------------- 地点選択（地図） ----------------
let map = null, marker = null, picked = null;
function openPicker() {
  $('picker').classList.remove('hidden');
  if (!map) {
    map = L.map('map', { zoomControl: true, attributionControl: true }).setView([36.2, 138.2], 6);
    L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>',
    }).addTo(map);
    const icon = L.divIcon({ className: '', html: '<div style="width:16px;height:16px;border-radius:50%;background:#e76f51;border:3px solid #fff;box-shadow:0 1px 4px #0008"></div>', iconSize: [16, 16] });
    marker = L.marker([0, 0], { icon });
    for (const m of MOUNTAINS) {
      L.circleMarker([m.lat, m.lon], { radius: 2 + rank(m) * 0.7, color: ['#6c757d', '#52796f', '#2a6f97', '#c1121f'][rank(m)], weight: 1, fillOpacity: 0.8 })
        .bindTooltip(`${m.name} ${m.elev}m${CLASS_LABEL[m.cls] ? '（' + CLASS_LABEL[m.cls] + '）' : ''}`).on('click', () => pick(m.lat, m.lon, uniqueName(m), m.elev)).addTo(map);
    }
    map.on('click', (e) => pick(e.latlng.lat, e.latlng.lng, '', false));
  }
  if (state.obs) pick(state.obs.lat, state.obs.lon, state.obs.name, state.obs.summit || false);
  setTimeout(() => map.invalidateSize(), 50);
}
function pick(lat, lon, name, summit, deck = 0) {
  sfx('tick');
  picked = { lat, lon, name, summit, deck };
  marker.setLatLng([lat, lon]).addTo(map);
  if (!deck) $('deck-select').value = '';
  $('picker-info').textContent = deck ? `${name}（地上${deck}m）` : `${name ? name + (summit ? ' 山頂' : '') + ' ' : ''}(${lat.toFixed(4)}, ${lon.toFixed(4)})`;
  $('btn-picker-ok').disabled = false;
}
$('btn-picker-ok').addEventListener('click', () => {
  if (!picked) return;
  audio.unlock();
  sfx('start');
  enableCompass();
  // 地点を変えたときは、表示中の日付を引き継ぐ
  if (state.obs) $('start-date').value = dateStr(state.dayT0);
  startAt(picked.lat, picked.lon, { name: picked.name || '選択地点', summit: picked.summit, deck: picked.deck });
});
$('btn-picker-cancel').addEventListener('click', () => {
  sfx('close');
  $('picker').classList.add('hidden');
  if (!state.obs) $('start').classList.remove('hidden');
});
$('btn-here').addEventListener('click', async () => {
  sfx('click');
  try {
    const { lat, lon } = await getPosition();
    const sm = nearbySummit(lat, lon);
    map.setView([lat, lon], 13);
    if (sm) pick(sm.lat, sm.lon, uniqueName(sm), sm.elev);
    else pick(lat, lon, '現在地', false);
  } catch {
    sfx('error');
    toast('現在地を取得できませんでした', 'bad');
  }
});
$('search').addEventListener('change', (e) => {
  const v = e.target.value.trim();
  const m = MOUNTAINS.find((x) => uniqueName(x) === v) || MOUNTAINS.find((x) => x.name === v || x.yomi === v);
  if (!m) return;
  map.setView([m.lat, m.lon], 12);
  pick(m.lat, m.lon, uniqueName(m), m.elev);
  e.target.blur();
});
{
  const areas = [...new Set(OBSERVATORIES.map((o) => o.area))];
  $('deck-select').innerHTML = '<option value="">展望台から見る…</option>' + areas.map((a) =>
    `<optgroup label="${a}">${OBSERVATORIES.map((o, i) => (o.area === a ? `<option value="${i}">${o.name}（${o.deck}m）</option>` : '')).join('')}</optgroup>`).join('');
}
$('deck-select').addEventListener('change', (e) => {
  if (e.target.value === '') return;
  const o = OBSERVATORIES[+e.target.value];
  map.setView([o.lat, o.lon], 14);
  pick(o.lat, o.lon, o.name, 0, o.deck);
});
$('btn-start-deck').addEventListener('click', () => {
  audio.unlock(); sfx('open'); initWorker(); enableCompass(); openPicker();
  setTimeout(() => { $('deck-select').focus(); if ($('deck-select').showPicker) try { $('deck-select').showPicker(); } catch { /* 非対応 */ } }, 300);
});
$('peak-list').innerHTML = MOUNTAINS.map((m) => `<option value="${uniqueName(m)}">${m.yomi} ${m.elev}m</option>`).join('');
$('opt-source').addEventListener('change', () => initWorker());
$('opt-snow').addEventListener('change', () => invalidate());
$('opt-buildings').addEventListener('change', () => {
  sfx($('opt-buildings').checked ? 'on' : 'off');
  worker.postMessage({ type: 'options', buildings: $('opt-buildings').checked });
  if (state.obs) { invalidate(); refreshTerrainDependent(); }
});
resize();
window.__hinode = state; // デバッグ用
// 下部パネルの高さ（高さボタン・トーストの位置合わせ用）
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--timebar-h', `${$('timebar').offsetHeight}px`);
}).observe($('timebar'));
