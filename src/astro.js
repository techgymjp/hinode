// 太陽・月の位置計算（外部ライブラリなし）
// 太陽: 天文年鑑の簡易式（誤差 約0.01°）
// 月: Meeus『Astronomical Algorithms』47章の主要項（誤差 約0.01°）、地心→測心の視差補正つき
// 時刻はすべて UTC のミリ秒（Date.getTime()）で扱う。

const DEG = Math.PI / 180;
const sin = (d) => Math.sin(d * DEG), cos = (d) => Math.cos(d * DEG);
const norm360 = (a) => ((a % 360) + 360) % 360;
export const DELTA_T = 69.5; // TT - UT [秒]（2020年代）

export const jdOf = (ms) => ms / 86400000 + 2440587.5;
const tOf = (ms) => (jdOf(ms) + DELTA_T / 86400 - 2451545) / 36525; // TT のユリウス世紀

function obliquity(T) { return 23.439291 - 0.0130042 * T; }
function nutationLon(T) { return -0.00478 * sin(125.04452 - 1934.136261 * T); }

// 太陽の視黄経・距離 [au]
export function sunEcliptic(ms) {
  const n = jdOf(ms) + DELTA_T / 86400 - 2451545;
  const L = norm360(280.460 + 0.9856474 * n);
  const g = norm360(357.528 + 0.9856003 * n);
  const lam = L + 1.915 * sin(g) + 0.020 * sin(2 * g);
  const r = 1.00014 - 0.01671 * cos(g) - 0.00014 * cos(2 * g);
  return { lam: norm360(lam), beta: 0, dist: r };
}

// 月の黄経・黄緯・距離 [km]（地心）
const LR = [ // D, M, M', F, Σl(1e-6°), Σr(1e-3 km)
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925], [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138], [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661], [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208], [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003], [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884], [0, 1, 2, 0, -2120, 5751],
  [0, 2, 0, 0, -2069, 0], [2, -2, -1, 0, 2048, -4950], [2, 0, 1, -2, -1773, 4130],
  [2, 0, 0, 2, -1595, 0], [4, -1, -1, 0, 1215, -3958], [0, 0, 2, 2, -1110, 0],
  [3, 0, -1, 0, -892, 3258], [2, 1, 1, 0, -810, 2616], [4, -1, -2, 0, 759, -1897],
  [0, 2, -1, 0, -713, -2117], [2, 2, -1, 0, -700, 2354], [2, 1, -2, 0, 691, 0],
  [2, -1, 0, -2, 596, 0], [4, 0, 1, 0, 549, -1423], [0, 0, 4, 0, 537, -1117],
  [4, -1, 0, 0, 520, -1571], [1, 0, -2, 0, -487, -1739], [2, 1, 0, -2, -399, 0],
  [0, 0, 2, -2, -381, -4421], [1, 1, 1, 0, 351, 0], [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0], [2, -1, 2, 0, 327, 0], [0, 2, 1, 0, -323, 1165],
  [1, 1, -1, 0, 299, 0], [2, 0, 3, 0, 294, 0],
];
const BT = [ // D, M, M', F, Σb(1e-6°)
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749], [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410], [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335], [0, 0, 3, 1, 1107],
  [4, 0, 0, -1, 1021], [4, 0, -1, 1, 833],
];
export function moonEcliptic(ms) {
  const T = tOf(ms);
  const Lp = norm360(218.3164477 + 481267.88123421 * T);
  const D = norm360(297.8501921 + 445267.1114034 * T);
  const M = norm360(357.5291092 + 35999.0502909 * T);
  const Mp = norm360(134.9633964 + 477198.8675055 * T);
  const F = norm360(93.2720950 + 483202.0175233 * T);
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.290 * T, A3 = 313.45 + 481266.484 * T;
  let sl = 0, sr = 0, sb = 0;
  for (const [d, m, mp, f, l, r] of LR) {
    const arg = d * D + m * M + mp * Mp + f * F;
    const e = m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E;
    sl += l * e * sin(arg);
    sr += r * e * cos(arg);
  }
  for (const [d, m, mp, f, b] of BT) {
    const e = m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E;
    sb += b * e * sin(d * D + m * M + mp * Mp + f * F);
  }
  sl += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
  sb += -2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - F) + 175 * sin(A1 + F) + 127 * sin(Lp - Mp) - 115 * sin(Lp + Mp);
  return { lam: norm360(Lp + sl / 1e6 + nutationLon(T)), beta: sb / 1e6, dist: 385000.56 + sr / 1000 };
}

function eclToEq(lam, beta, T) {
  const e = obliquity(T);
  const ra = Math.atan2(sin(lam) * cos(e) - Math.tan(beta * DEG) * sin(e), cos(lam)) / DEG;
  const dec = Math.asin(sin(beta) * cos(e) + cos(beta) * sin(e) * sin(lam)) / DEG;
  return { ra: norm360(ra), dec };
}

// グリニッジ平均恒星時 [deg]
function gmst(ms) {
  const d = jdOf(ms) - 2451545, T = d / 36525;
  return norm360(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T);
}

// 赤道座標 → 地平座標（方位は北=0°、東回り）
function toHorizontal(ra, dec, ms, lat, lon) {
  const H = gmst(ms) + lon - ra;
  const alt = Math.asin(sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H)) / DEG;
  const az = Math.atan2(-cos(dec) * sin(H), sin(dec) * cos(lat) - cos(dec) * sin(lat) * cos(H)) / DEG;
  return { az: norm360(az), alt };
}

// 大気差（真高度 → 見かけの高度への加算量）[deg]。Sæmundsson の式。地平線より下は -1° の値で頭打ち
export function refraction(alt) {
  const h = Math.max(-1, alt);
  if (h > 85) return 0;
  return 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * DEG) / 60;
}

// 太陽の位置: az, alt（真高度）, appAlt（見かけの高度）, sd（視半径 deg）
export function sunPosition(ms, lat, lon) {
  const T = tOf(ms);
  const s = sunEcliptic(ms);
  const { ra, dec } = eclToEq(s.lam, 0, T);
  const h = toHorizontal(ra, dec, ms, lat, lon);
  // 地平視差（8.8″）
  h.alt -= 0.00244 * cos(h.alt);
  return { az: h.az, alt: h.alt, appAlt: h.alt + refraction(h.alt), sd: 0.2666 / s.dist, lam: s.lam, ra, dec };
}

// 月の位置（測心）: az, alt, appAlt, sd, dist
export function moonPosition(ms, lat, lon) {
  const T = tOf(ms);
  const m = moonEcliptic(ms);
  const { ra, dec } = eclToEq(m.lam, m.beta, T);
  const h = toHorizontal(ra, dec, ms, lat, lon);
  const par = Math.asin(6378.14 / m.dist) / DEG; // 地平視差
  const alt = h.alt - par * cos(h.alt);
  // 観測者からの距離（視半径の補正用）
  const topoDist = m.dist - 6378.14 * Math.max(0, sin(h.alt));
  return { az: h.az, alt, appAlt: alt + refraction(alt), sd: Math.asin(1737.4 / topoDist) / DEG, dist: m.dist, lam: m.lam, beta: m.beta, ra, dec };
}

// 月と太陽の離角（地心）と輝面比
export function moonPhase(ms) {
  const s = sunEcliptic(ms), m = moonEcliptic(ms);
  const elong = Math.acos(cos(m.beta) * cos(m.lam - s.lam)) / DEG;     // 0〜180
  // 位相角
  const i = Math.atan2(149597870.7 * s.dist * sin(elong), m.dist - 149597870.7 * s.dist * cos(elong)) / DEG;
  const k = (1 + cos(i)) / 2;
  const waxing = norm360(m.lam - s.lam) < 180;
  return { illum: k, elong, waxing, lonDiff: norm360(m.lam - s.lam) };
}

// 直前の新月（朔）の時刻
export function prevNewMoon(ms) {
  let t = ms;
  for (let i = 0; i < 10; i++) {
    const d = norm360(moonEcliptic(t).lam - sunEcliptic(t).lam); // 0〜360（朔から増える）
    const step = (i === 0 ? d : (d > 180 ? d - 360 : d)) / 12.19 * 86400000;
    t -= step;
    if (Math.abs(step) < 1000) break;
  }
  return t;
}
export const moonAge = (ms) => (ms - prevNewMoon(ms)) / 86400000;

// 月齢から月の呼び名
export function moonName(age) {
  const names = [
    [0.8, '新月（朔）'], [1.8, '二日月'], [3.8, '三日月'], [6.3, '七日月ごろ'], [8.3, '上弦の月'],
    [11.3, '十日夜の月ごろ'], [12.8, '十三夜月'], [13.8, '小望月'], [15.6, '満月（望）'],
    [16.6, '十六夜（いざよい）'], [17.6, '立待月'], [18.6, '居待月'], [19.6, '寝待月'], [20.6, '更待月'],
    [23.3, '下弦の月'], [26.8, '有明月'], [28.5, '晦日月'], [30.5, '新月（朔）'],
  ];
  for (const [a, n] of names) if (age < a) return n;
  return '新月（朔）';
}

// 天体の位置を返す関数（名前で選ぶ）
export const bodyPosition = (body, ms, lat, lon) => (body === 'sun' ? sunPosition(ms, lat, lon) : moonPosition(ms, lat, lon));

// 地図上の 2 点間の方位角（月の明るい側の向き用、地平座標上での大円の方向）[deg, 上=0 右=90]
export function bearingOnSky(az1, alt1, az2, alt2) {
  const dA = (az2 - az1) * DEG, a1 = alt1 * DEG, a2 = alt2 * DEG;
  return Math.atan2(Math.sin(dA) * Math.cos(a2), Math.cos(a1) * Math.sin(a2) - Math.sin(a1) * Math.cos(a2) * Math.cos(dA)) / DEG;
}

// ---------- 日本時間（JST）ユーティリティ ----------
export const JST = 9 * 3600000;
export const jstMidnight = (y, m, d) => Date.UTC(y, m - 1, d) - JST;
export function jstParts(ms) {
  const d = new Date(ms + JST);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh: d.getUTCHours(), mm: d.getUTCMinutes(), ss: d.getUTCSeconds(), wd: d.getUTCDay() };
}
export function fmtHM(ms) {
  if (ms == null) return '--:--';
  const p = jstParts(ms + 30000); // 秒は四捨五入
  return `${String(p.hh).padStart(2, '0')}:${String(p.mm).padStart(2, '0')}`;
}
