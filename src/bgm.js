// 日の出・月の出シミュレーター用の BGM と効果音を Web Audio で合成する（音源ファイル不要のオリジナル曲）
// 夜明けの空をイメージした静かなアンビエント:
//   ゆっくり移り変わる和音のパッド＋低いドローン＋五音音階（ニ長調ペンタトニック）のチャイム＋長い残響。
//   setMood(0〜1) で 夜（暗く・まばら）〜 昼（明るく・音数多め）に音色が変わる。

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const N = (s) => {
  const m = s.match(/^([A-G])(#|b)?(\d)$/);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  return base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
};

const BAR = 4.2;          // 1 小節の長さ [秒]
const CHORD_BARS = 2;     // 和音が変わる間隔
// D△9 → Bm7(11) → G△7 → A6sus4
const PROG = [
  { bass: 'D2', pad: ['A3', 'C#4', 'E4', 'F#4'] },
  { bass: 'B1', pad: ['F#3', 'A3', 'D4', 'E4'] },
  { bass: 'G1', pad: ['F#3', 'B3', 'D4', 'A4'] },
  { bass: 'A1', pad: ['E3', 'A3', 'B3', 'D4'] },
];
// ペンタトニック（D E F# A B）
const PENTA = ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5', 'D6'].map(N);

export function createBgm() {
  let ctx = null, master = null, musicBus = null, padFilter = null, sfxOut = null, reverb = null;
  let playing = false, timer = 0, nextTime = 0, step = 0;
  let mood = 1;          // 0=夜 1=昼
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
    }
    return buf;
  }

  function setup() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    reverb = ctx.createConvolver();
    reverb.buffer = impulse(4.5, 2.6);
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    reverb.connect(wet); wet.connect(ctx.destination);

    master = ctx.createGain(); master.gain.value = 0;
    master.connect(ctx.destination); master.connect(reverb);
    musicBus = ctx.createGain(); musicBus.gain.value = 1;
    padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.Q.value = 0.4;
    padFilter.frequency.value = 2000;
    padFilter.connect(master);
    musicBus.connect(master);

    sfxOut = ctx.createGain(); sfxOut.gain.value = 0.45;
    sfxOut.connect(ctx.destination);
    const sfxWet = ctx.createGain(); sfxWet.gain.value = 0.35;
    sfxOut.connect(sfxWet); sfxWet.connect(reverb);
    return true;
  }

  // ---- 曲の部品 ----
  function pad(midis, t, dur) {
    for (const m of midis) {
      for (const [type, det, vol] of [['sine', -4, 0.05], ['triangle', 5, 0.03]]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = mtof(m); o.detune.value = det;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
        g.gain.setValueAtTime(vol, t + dur * 0.7);
        g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
        o.connect(g); g.connect(padFilter);
        o.start(t); o.stop(t + dur + 1.6);
      }
    }
  }
  function drone(m, t, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = mtof(m);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = mtof(m + 12); o2.detune.value = 3;
    const g2 = ctx.createGain(); g2.gain.value = 0.3;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.11, t + 1.8);
    g.gain.setValueAtTime(0.11, t + dur - 0.5);
    g.gain.linearRampToValueAtTime(0, t + dur + 1.2);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
    o.start(t); o2.start(t); o.stop(t + dur + 1.3); o2.stop(t + dur + 1.3);
  }
  // 鐘・チャイム（倍音が非整数）
  function bell(m, t, vol, out = musicBus, decay = 3.2) {
    const f = mtof(m);
    for (const [ratio, v, dec] of [[1, 1, decay], [2.76, 0.28, decay * 0.45], [5.4, 0.12, decay * 0.25], [2, 0.18, decay * 0.7]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * ratio;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * v, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + dec + 0.05);
    }
  }

  function scheduleBar(i, t) {
    const chord = PROG[Math.floor(i / CHORD_BARS) % PROG.length];
    if (i % CHORD_BARS === 0) {
      pad(chord.pad.map(N), t, BAR * CHORD_BARS);
      drone(N(chord.bass), t, BAR * CHORD_BARS);
    }
    // チャイム: 昼ほど音数が多く高め、夜はまばらで低め
    const slots = 8;
    const density = 0.12 + 0.28 * mood;
    let last = -1;
    for (let s = 0; s < slots; s++) {
      if (rand() > density) continue;
      const lo = mood < 0.4 ? 0 : 2, hi = mood < 0.4 ? 7 : PENTA.length;
      let k = lo + Math.floor(rand() * (hi - lo));
      if (k === last) k = Math.min(hi - 1, k + 1);
      last = k;
      const tt = t + (s / slots) * BAR + rand() * 0.04;
      bell(PENTA[k], tt, 0.05 + 0.04 * rand());
      // ときどき 5 度上の余韻
      if (rand() < 0.15) bell(PENTA[k] + 7, tt + BAR / slots, 0.025);
    }
  }

  function tick() {
    while (nextTime < ctx.currentTime + 1.2) {
      scheduleBar(step++, nextTime);
      nextTime += BAR;
    }
  }

  // ---- 効果音 ----
  function tone(type, freq, t, dur, vol, { to, attack = 0.005 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxOut);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const SFX = {
    // ふつうのボタン: 木琴のような短い音
    click: (t) => { tone('sine', 1320, t, 0.09, 0.22, { to: 1180 }); tone('triangle', 660, t, 0.06, 0.08); },
    // スライダー・小さな操作: ごく軽い音
    tick: (t) => tone('sine', 2100, t, 0.03, 0.06),
    // オン・オフ
    on: (t) => { tone('sine', 880, t, 0.08, 0.18); tone('sine', 1320, t + 0.06, 0.12, 0.18); },
    off: (t) => { tone('sine', 1320, t, 0.08, 0.16); tone('sine', 880, t + 0.06, 0.12, 0.16); },
    // パネルを開く・閉じる
    open: (t) => { bell(N('A5'), t, 0.12, sfxOut, 1.2); bell(N('D6'), t + 0.07, 0.1, sfxOut, 1.2); },
    close: (t) => { bell(N('D6'), t, 0.1, sfxOut, 1.0); bell(N('A5'), t + 0.07, 0.1, sfxOut, 1.0); },
    // 日の出・月の出などへジャンプ: 上がっていくチャイム
    jump: (t) => ['D5', 'F#5', 'A5', 'D6'].forEach((n, i) => bell(N(n), t + i * 0.06, 0.1, sfxOut, 1.6)),
    // 日の入・月の入: 下がっていくチャイム
    jumpDown: (t) => ['D6', 'A5', 'F#5', 'D5'].forEach((n, i) => bell(N(n), t + i * 0.06, 0.1, sfxOut, 1.6)),
    // 開始: きらめくアルペジオ
    start: (t) => ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6'].forEach((n, i) => bell(N(n), t + i * 0.055, 0.09, sfxOut, 2.2)),
    play: (t) => { tone('triangle', 660, t, 0.1, 0.16); tone('triangle', 990, t + 0.07, 0.14, 0.16); },
    pause: (t) => { tone('triangle', 990, t, 0.1, 0.14); tone('triangle', 660, t + 0.07, 0.14, 0.14); },
    // ダイヤモンド／パール現象が見つかった
    found: (t) => { ['A5', 'D6', 'F#6', 'A6'].forEach((n, i) => bell(N(n), t + i * 0.09, 0.1, sfxOut, 2.5)); },
    error: (t) => { tone('square', 220, t, 0.16, 0.06, { to: 160 }); },
  };

  return {
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
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0.5, now + 3);
      nextTime = now + 0.1;
      tick();
      timer = setInterval(tick, 300);
    },
    stop() {
      if (!playing) return;
      playing = false;
      clearInterval(timer);
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 1.2);
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && playing) ctx.resume(); },
    // 0（夜）〜 1（昼）
    setMood(m) {
      mood = Math.max(0, Math.min(1, m));
      if (!ctx) return;
      padFilter.frequency.setTargetAtTime(500 + 2600 * mood, ctx.currentTime, 1.5);
    },
    sfx(name) {
      if (!setup() || !SFX[name]) return;
      if (ctx.state === 'suspended') ctx.resume();
      SFX[name](ctx.currentTime + 0.005);
    },
  };
}
