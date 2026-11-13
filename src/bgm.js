// 日の出・月の出シミュレーター用の BGM と効果音（Web Audio で合成するオリジナル曲。音源ファイルなし）
// 夜明けの空をイメージした静かなアンビエント:
//   ゆっくり移り変わる和音のパッド＋低いドローン＋五音音階（ニ長調ペンタトニック）のチャイム＋長い残響。
//
// スマホで音が割れない（ビリつかない）よう、BGM の 1 ループと効果音は、ページを開いたときに
// OfflineAudioContext で前もって録音（合成）しておく。再生中はその録音を流すだけなので、
// 景色の描画などで画面側が重くなっても音の処理は軽いまま。
// setMood(0〜1) で 夜（こもった音）〜 昼（明るい音）にフィルターで音色を変える。

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const N = (s) => {
  const m = s.match(/^([A-G])(#|b)?(\d)$/);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  return base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
};

const RATE = 32000;       // 前もって録音するときのサンプリング周波数（容量と合成時間を抑える）
const BAR = 4.2;          // 1 小節の長さ [秒]
const CHORD_BARS = 2;     // 和音が変わる間隔
// D△9 → Bm7(11) → G△7 → A6sus4
const PROG = [
  { bass: 'D2', pad: ['A3', 'C#4', 'E4', 'F#4'] },
  { bass: 'B1', pad: ['F#3', 'A3', 'D4', 'E4'] },
  { bass: 'G1', pad: ['F#3', 'B3', 'D4', 'A4'] },
  { bass: 'A1', pad: ['E3', 'A3', 'B3', 'D4'] },
];
const LOOP_BARS = PROG.length * CHORD_BARS; // 和音の進行 1 周分（約 34 秒。スマホでも数秒で録音できる長さ）
const LOOP_SEC = LOOP_BARS * BAR;
const TAIL_SEC = 6;       // 残響の余韻（ループの頭に重ねてつなぎ目をなくす）
// ペンタトニック（D E F# A B）
const PENTA = ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5', 'D6'].map(N);

// ---------- 合成の部品（どの AudioContext でも使える） ----------
function makeImpulse(c, sec, decay) {
  const len = Math.floor(c.sampleRate * sec);
  const buf = c.createBuffer(2, len, c.sampleRate);
  let seed = 99;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 1073741823.5 - 1; };
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = rnd() * (1 - i / len) ** decay;
  }
  return buf;
}
function tone(c, out, type, freq, t, dur, vol, { to, attack = 0.005 } = {}) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.05);
}
// 鐘・チャイム（倍音が非整数）
function bell(c, out, m, t, vol, decay = 3.2) {
  const f = mtof(m);
  for (const [ratio, v, dec] of [[1, 1, decay], [2.76, 0.28, decay * 0.45], [5.4, 0.12, decay * 0.25], [2, 0.18, decay * 0.7]]) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f * ratio;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dec + 0.05);
  }
}
function pad(c, out, midis, t, dur) {
  for (const m of midis) {
    for (const [type, det, vol] of [['sine', -4, 0.05], ['triangle', 5, 0.03]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = mtof(m); o.detune.value = det;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
      g.gain.setValueAtTime(vol, t + dur * 0.7);
      g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + dur + 1.6);
    }
  }
}
function drone(c, out, m, t, dur) {
  const g = c.createGain(), g2 = c.createGain();
  const o = c.createOscillator(), o2 = c.createOscillator();
  o.type = 'sine'; o.frequency.value = mtof(m);
  o2.type = 'sine'; o2.frequency.value = mtof(m + 12); o2.detune.value = 3;
  g2.gain.value = 0.3;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.11, t + 1.8);
  g.gain.setValueAtTime(0.11, t + dur - 0.5);
  g.gain.linearRampToValueAtTime(0, t + dur + 1.2);
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(out);
  o.start(t); o2.start(t); o.stop(t + dur + 1.3); o2.stop(t + dur + 1.3);
}

// ---------- BGM の 1 ループを前もって録音する ----------
async function renderLoop() {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const len = Math.ceil((LOOP_SEC + TAIL_SEC) * RATE);
  const c = new OAC(2, len, RATE);
  const dry = c.createGain(); dry.gain.value = 0.5;
  const rev = c.createConvolver(); rev.buffer = makeImpulse(c, 4.5, 2.6);
  const wet = c.createGain(); wet.gain.value = 0.28;
  dry.connect(c.destination); dry.connect(rev); rev.connect(wet); wet.connect(c.destination);
  const padBus = c.createBiquadFilter(); padBus.type = 'lowpass'; padBus.frequency.value = 2400; padBus.Q.value = 0.4;
  padBus.connect(dry);
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < LOOP_BARS; i++) {
    const t = i * BAR;
    const chord = PROG[Math.floor(i / CHORD_BARS) % PROG.length];
    if (i % CHORD_BARS === 0) {
      pad(c, padBus, chord.pad.map(N), t, BAR * CHORD_BARS);
      drone(c, dry, N(chord.bass), t, BAR * CHORD_BARS);
    }
    // チャイム（まばらに、ときどき 5 度上の余韻）
    let last = -1;
    for (let s = 0; s < 8; s++) {
      if (rand() > 0.3) continue;
      let k = 1 + Math.floor(rand() * (PENTA.length - 1));
      if (k === last) k = Math.max(0, k - 1);
      last = k;
      const tt = t + (s / 8) * BAR + rand() * 0.04;
      bell(c, dry, PENTA[k], tt, 0.05 + 0.04 * rand());
      if (rand() < 0.15) bell(c, dry, PENTA[k] + 7, tt + BAR / 8, 0.025);
    }
  }
  const buf = await c.startRendering();
  // 余韻をループの頭に重ねて、ループのつなぎ目で音が途切れないようにする
  const loopLen = Math.round(LOOP_SEC * RATE);
  const out = new AudioBuffer({ numberOfChannels: 2, length: loopLen, sampleRate: RATE });
  for (let ch = 0; ch < 2; ch++) {
    const src = buf.getChannelData(ch), dst = out.getChannelData(ch);
    dst.set(src.subarray(0, loopLen));
    for (let i = loopLen; i < src.length; i++) dst[i - loopLen] += src[i];
  }
  return out;
}

// ---------- 効果音を前もって録音する ----------
const SFX = {
  // ふつうのボタン: 木琴のような短い音
  click: [0.25, (c, o, t) => { tone(c, o, 'sine', 1320, t, 0.09, 0.22, { to: 1180 }); tone(c, o, 'triangle', 660, t, 0.06, 0.08); }],
  // スライダー・小さな操作: ごく軽い音
  tick: [0.08, (c, o, t) => tone(c, o, 'sine', 2100, t, 0.03, 0.06)],
  // オン・オフ
  on: [0.35, (c, o, t) => { tone(c, o, 'sine', 880, t, 0.08, 0.18); tone(c, o, 'sine', 1320, t + 0.06, 0.12, 0.18); }],
  off: [0.35, (c, o, t) => { tone(c, o, 'sine', 1320, t, 0.08, 0.16); tone(c, o, 'sine', 880, t + 0.06, 0.12, 0.16); }],
  // パネルを開く・閉じる
  open: [1.5, (c, o, t) => { bell(c, o, N('A5'), t, 0.12, 1.2); bell(c, o, N('D6'), t + 0.07, 0.1, 1.2); }],
  close: [1.3, (c, o, t) => { bell(c, o, N('D6'), t, 0.1, 1.0); bell(c, o, N('A5'), t + 0.07, 0.1, 1.0); }],
  // 日の出・月の出などへジャンプ: 上がっていくチャイム
  jump: [2.0, (c, o, t) => ['D5', 'F#5', 'A5', 'D6'].forEach((n, i) => bell(c, o, N(n), t + i * 0.06, 0.1, 1.6))],
  // 日の入・月の入: 下がっていくチャイム
  jumpDown: [2.0, (c, o, t) => ['D6', 'A5', 'F#5', 'D5'].forEach((n, i) => bell(c, o, N(n), t + i * 0.06, 0.1, 1.6))],
  // 開始: きらめくアルペジオ
  start: [2.8, (c, o, t) => ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6'].forEach((n, i) => bell(c, o, N(n), t + i * 0.055, 0.09, 2.2))],
  play: [0.3, (c, o, t) => { tone(c, o, 'triangle', 660, t, 0.1, 0.16); tone(c, o, 'triangle', 990, t + 0.07, 0.14, 0.16); }],
  pause: [0.3, (c, o, t) => { tone(c, o, 'triangle', 990, t, 0.1, 0.14); tone(c, o, 'triangle', 660, t + 0.07, 0.14, 0.14); }],
  // ダイヤモンド／パール現象が見つかった
  found: [3.0, (c, o, t) => ['A5', 'D6', 'F#6', 'A6'].forEach((n, i) => bell(c, o, N(n), t + i * 0.09, 0.1, 2.5))],
  error: [0.25, (c, o, t) => tone(c, o, 'square', 220, t, 0.16, 0.06, { to: 160 })],
};
async function renderSfx(name) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const [sec, fn] = SFX[name];
  const rate = 44100;
  const c = new OAC(2, Math.ceil((sec + 0.6) * rate), rate);
  const out = c.createGain(); out.gain.value = 0.45;
  out.connect(c.destination);
  // 少しだけ残響
  const rev = c.createConvolver(); rev.buffer = makeImpulse(c, 0.6, 3);
  const wet = c.createGain(); wet.gain.value = 0.18;
  out.connect(rev); rev.connect(wet); wet.connect(c.destination);
  fn(c, out, 0.005);
  return c.startRendering();
}

export function createBgm() {
  let ctx = null, master = null, filter = null, sfxOut = null;
  let loopBuf = null, src = null;
  let playing = false, mood = 1;
  const sfxBufs = {};

  // ページを開いたらすぐ、裏で録音を始める（ユーザーの操作は不要）
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ready = (async () => {
    if (!OAC) return;
    try {
      // 効果音を先に（短いのですぐ終わる）。1 つずつ順に作って、画面の操作を重くしない
      for (const name of Object.keys(SFX)) {
        sfxBufs[name] = await renderSfx(name);
        await new Promise((r) => setTimeout(r, 0));
      }
      loopBuf = await renderLoop();
      if (playing) startSource();
    } catch (e) { /* 録音できない環境では無音 */ }
  })();

  function setup() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'balanced' }); } catch { ctx = new AC(); }
    master = ctx.createGain(); master.gain.value = 0;
    filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = 0.3;
    filter.frequency.value = cutoff();
    filter.connect(master); master.connect(ctx.destination);
    sfxOut = ctx.createGain(); sfxOut.gain.value = 1;
    sfxOut.connect(ctx.destination);
    return true;
  }
  const cutoff = () => 900 + 9000 * mood ** 1.5;

  function startSource() {
    if (!ctx || !loopBuf || src) return;
    src = ctx.createBufferSource();
    src.buffer = loopBuf; src.loop = true;
    src.connect(filter);
    src.start();
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0.9, now + 3);
  }

  return {
    ready,
    unlock() {
      if (!setup()) return;
      if (ctx.state === 'suspended') ctx.resume();
      // iOS: 無音を一度鳴らして解錠
      const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
    },
    start() {
      if (!setup() || playing) return;
      playing = true;
      if (ctx.state === 'suspended') ctx.resume();
      startSource(); // まだ録音中なら、終わった時点で鳴り始める
    },
    stop() {
      if (!playing) return;
      playing = false;
      if (!src) return;
      const s = src, now = ctx.currentTime;
      src = null;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 1.2);
      s.stop(now + 1.3);
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    // 0（夜）〜 1（昼）
    setMood(m) {
      const v = Math.max(0, Math.min(1, m));
      if (Math.abs(v - mood) < 0.01) return;
      mood = v;
      if (filter) filter.frequency.setTargetAtTime(cutoff(), ctx.currentTime, 1.5);
    },
    sfx(name) {
      if (!sfxBufs[name] || !setup()) return;
      if (ctx.state === 'suspended') ctx.resume();
      const s = ctx.createBufferSource();
      s.buffer = sfxBufs[name];
      s.connect(sfxOut);
      s.start();
    },
  };
}
