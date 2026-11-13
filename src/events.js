// 出没・南中・山頂との重なり（ダイヤモンド／パール現象）の計算
import { bodyPosition } from './astro.js';

const MIN = 60000;
const wrap180 = (a) => ((a % 360) + 540) % 360 - 180;
// 暦（国立天文台の暦と同じ定義）: 天体の上辺が海抜0mの平らな地平線に接する。大気差 35′08″
const STD_REFR = 35.13 / 60;

// f(t) の符号が変わる時刻を探す（step ごとに調べ、二分法で 1 秒まで詰める）
function crossings(f, fExact, t0, t1, step) {
  const out = [];
  let ta = t0, fa = f(ta);
  for (let tb = t0 + step; tb <= t1 + 1; tb += step) {
    const fb = f(tb);
    if ((fa < 0) !== (fb < 0)) {
      let lo = ta, hi = tb;
      const rising = fb >= 0;
      while (hi - lo > 1000) {
        const mid = (lo + hi) / 2;
        if ((fExact(mid) >= 0) === rising) hi = mid; else lo = mid;
      }
      out.push({ t: (lo + hi) / 2, type: rising ? 'rise' : 'set' });
    }
    ta = tb; fa = fb;
  }
  return out;
}

/**
 * 1 日（t0〜t1）の出没
 * horizon: { coarse(az) → 地形の見かけの高度[deg], exact(az) → 同（その方位で計算し直した値） }
 *          null なら暦（海抜0mの平らな地平線）
 */
export function riseSet(body, t0, t1, lat, lon, horizon) {
  const pos = (t) => bodyPosition(body, t, lat, lon);
  let f, fx;
  if (horizon) {
    f = (t) => { const p = pos(t); return p.appAlt + p.sd - horizon.coarse(p.az); };
    fx = (t) => { const p = pos(t); return p.appAlt + p.sd - horizon.exact(p.az); };
  } else {
    f = fx = (t) => { const p = pos(t); return p.alt + p.sd + STD_REFR; };
  }
  return crossings(f, fx, t0, t1, 4 * MIN).map((e) => {
    const p = pos(e.t);
    return { ...e, az: p.az, alt: p.appAlt, horizon: horizon ? horizon.exact(p.az) : 0 };
  });
}

// 南中（その日いちばん高くなる時刻）
export function transit(body, t0, t1, lat, lon) {
  const alt = (t) => bodyPosition(body, t, lat, lon).alt;
  let best = null;
  const step = 10 * MIN;
  for (let t = t0; t <= t1; t += step) {
    const a = alt(t);
    if (alt(t - step) < a && alt(t + step) <= a) {
      // 黄金分割で詰める
      let lo = t - step, hi = t + step;
      for (let i = 0; i < 40 && hi - lo > 1000; i++) {
        const m1 = hi - (hi - lo) * 0.618, m2 = lo + (hi - lo) * 0.618;
        if (alt(m1) < alt(m2)) lo = m1; else hi = m2;
      }
      const tt = (lo + hi) / 2;
      if (tt >= t0 && tt < t1) { const p = bodyPosition(body, tt, lat, lon); best = { t: tt, az: p.az, alt: p.appAlt }; }
    }
  }
  return best;
}

export function dayEvents(t0, lat, lon, horizon) {
  const t1 = t0 + 86400000;
  const res = {};
  for (const body of ['sun', 'moon']) {
    res[body] = {
      terrain: horizon ? riseSet(body, t0, t1, lat, lon, horizon) : [],
      cal: riseSet(body, t0, t1, lat, lon, null),
      transit: transit(body, t0, t1, lat, lon),
    };
  }
  return res;
}

/**
 * 天体が方位 az・見かけの高度 alt の点（山頂など）に重なる時刻を探す
 * 方位が一致する瞬間の高度差が「視半径＋tol」以内なら重なりとみなす
 */
export function alignments(body, targetAz, targetAlt, t0, days, lat, lon, tol = 0.15) {
  const out = [];
  const step = 8 * MIN;
  const t1 = t0 + days * 86400000;
  const g = (t) => wrap180(bodyPosition(body, t, lat, lon).az - targetAz);
  let ta = t0, pa = bodyPosition(body, ta, lat, lon), ga = wrap180(pa.az - targetAz);
  for (let tb = t0 + step; tb <= t1; tb += step) {
    const pb = bodyPosition(body, tb, lat, lon), gb = wrap180(pb.az - targetAz);
    // 方位が目標を横切った（±180°の折り返しは除く）・高度が近い
    if ((ga < 0) !== (gb < 0) && Math.abs(ga - gb) < 90 &&
        Math.min(Math.abs(pa.appAlt - targetAlt), Math.abs(pb.appAlt - targetAlt)) < 4) {
      let lo = ta, hi = tb;
      const up = gb >= 0;
      while (hi - lo > 1000) {
        const mid = (lo + hi) / 2;
        if ((g(mid) >= 0) === up) hi = mid; else lo = mid;
      }
      const t = (lo + hi) / 2;
      const p = bodyPosition(body, t, lat, lon);
      const dAlt = p.appAlt - targetAlt;
      if (Math.abs(dAlt) <= p.sd + tol) {
        const rising = bodyPosition(body, t + MIN, lat, lon).alt > p.alt;
        out.push({ body, t, dAlt, sd: p.sd, rising, az: p.az, alt: p.appAlt });
      }
    }
    ta = tb; pa = pb; ga = gb;
  }
  return out;
}
