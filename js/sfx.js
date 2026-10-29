// Звуки: синтезируются один раз в буферы при старте, без файлов.
// Дальние звуки приглушаются фильтром, есть панорама и ограничение числа голосов.
let ctx = null, master = null, reverb = null, vol = 0.8, B = {}, voices = 0;
const MAX_VOICES = 28;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = vol;
    master.connect(comp); comp.connect(ctx.destination);
    // реверберация: синтезированный импульсный отклик (ранние отражения + хвост)
    const SR = ctx.sampleRate, L = Math.floor(SR * 1.8), ir = ctx.createBuffer(2, L, SR);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < L; i++) { const t = i / SR; d[i] = (Math.random() * 2 - 1) * Math.exp(-t / 0.42) * (t < 0.006 ? t / 0.006 : 1); }
      for (let k = 0; k < 9; k++) { const at = Math.floor((0.012 + Math.random() * 0.09) * SR); d[at] += (Math.random() < 0.5 ? -1 : 1) * (0.9 - k * 0.07); }
    }
    reverb = ctx.createConvolver(); reverb.buffer = ir;
    const rl = ctx.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 4500;
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    reverb.connect(rl); rl.connect(wet); wet.connect(master);
    build();
  } catch (e) { ctx = null; }
}
export function setVolume(v) { vol = v; if (master) master.gain.value = v; }

// ---------- синтез ----------
const TAU = Math.PI * 2;
function mkbuf(dur, fn, peak = 0.9) {
  const SR = ctx.sampleRate, n = Math.max(1, Math.floor(dur * SR)), b = ctx.createBuffer(1, n, SR), d = b.getChannelData(0);
  fn(d, n, SR);
  let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(d[i]));
  if (m > 0) { const k = peak / m; for (let i = 0; i < n; i++) d[i] *= k; }
  // мягкое затухание в конце, без щелчка
  const f = Math.min(n, Math.floor(0.01 * SR)); for (let i = 0; i < f; i++) d[n - 1 - i] *= i / f;
  return b;
}
const lpK = (fc, SR) => 1 - Math.exp(-TAU * fc / SR);
// выстрел: щелчок + тело + удар + эхо
function gun(o) {
  return mkbuf(o.len, (d, n, SR) => {
    let lp1 = 0, lp2 = 0, lp3 = 0, hpS = 0, ph = 0;
    const kb = lpK(o.body, SR), kt = lpK(o.tailF, SR), kc = lpK(o.crackF || 4000, SR);
    for (let i = 0; i < n; i++) {
      const t = i / SR, x = Math.random() * 2 - 1;
      hpS += kc * (x - hpS); const crack = (x - hpS) * Math.exp(-t / 0.004) * o.crack;
      lp1 += kb * (x - lp1); const body = lp1 * Math.exp(-t / o.bodyDec) * 2.2;
      ph += TAU * o.thump * (1 + 2.5 * Math.exp(-t / 0.012)) / SR;
      const thump = Math.sin(ph) * Math.exp(-t / o.thumpDec) * o.thumpA;
      lp2 += kt * (x - lp2); lp3 += kt * (lp2 - lp3);
      const tail = lp3 * 3 * o.tail * Math.exp(-t / o.tailDec) * (1 - Math.exp(-t / 0.015));
      const sub = Math.sin(TAU * 52 * t) * Math.exp(-t / 0.05) * (o.sub || 0.6);
      d[i] = Math.tanh((crack * 1.3 + body + thump + tail + sub) * (o.drive || 1.6) * 1.35);
    }
    if (o.bolt) clickAt(d, SR, o.bolt, [2300, 3400, 5200], 0.22, 0.01);
  });
}
// затухающие синусы (металл, «динь», клики)
function ring(len, partials, noiseA = 0, noiseDec = 0.003) {
  return mkbuf(len, (d, n, SR) => {
    for (let i = 0; i < n; i++) {
      const t = i / SR; let v = 0;
      for (const [f, a, dec] of partials) v += Math.sin(TAU * f * t) * a * Math.exp(-t / dec);
      if (noiseA) v += (Math.random() * 2 - 1) * noiseA * Math.exp(-t / noiseDec);
      d[i] = v;
    }
  });
}
function clickAt(d, SR, at, freqs, amp, dec = 0.012) {
  const s = Math.floor(at * SR);
  for (let i = 0; i < SR * 0.08 && s + i < d.length; i++) {
    const t = i / SR; let v = (Math.random() * 2 - 1) * Math.exp(-t / 0.0015) * 0.6;
    for (const f of freqs) v += Math.sin(TAU * f * t) * Math.exp(-t / dec) / freqs.length;
    d[s + i] += v * amp;
  }
}
function noiseShape(len, envFn, fc, type = 'lp') {
  return mkbuf(len, (d, n, SR) => {
    let a = 0, b2 = 0; const k = lpK(fc, SR);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 2 - 1; a += k * (x - a); b2 += k * (a - b2);
      d[i] = (type === 'lp' ? b2 * 3 : x - a) * envFn(i / SR, len);
    }
  });
}
// полосовой шум с движущейся частотой (взмах ножа)
function whoosh(len, f0, f1) {
  return mkbuf(len, (d, n, SR) => {
    let low = 0, band = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, u = t / len, fc = f0 + (f1 - f0) * Math.sin(u * Math.PI);
      const f = 2 * Math.sin(Math.PI * fc / SR), q = 0.35;
      const x = Math.random() * 2 - 1; low += f * band; const high = x - low - q * band; band += f * high;
      d[i] = band * Math.sin(u * Math.PI) ** 2;
    }
  });
}
function tones(notes, len, soft = 1) {
  return mkbuf(len, (d, n, SR) => {
    for (const [f, at, dur, a] of notes) {
      const s = Math.floor(at * SR), e = Math.min(n, s + Math.floor(dur * SR));
      for (let i = s; i < e; i++) {
        const t = (i - s) / SR, env = Math.min(1, t / 0.008) * Math.exp(-t / (dur * 0.45));
        d[i] += (Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * f * 2 * t) * soft) * env * a;
      }
    }
  }, 0.8);
}

function build() {
  const v = (k, fn, cnt = 2) => { B[k] = []; for (let i = 0; i < cnt; i++) B[k].push(fn()); };
  v('ak47', () => gun({ len: 0.75, crack: 0.9, body: 1400, bodyDec: 0.05, thump: 70, thumpDec: 0.06, thumpA: 1.1, tail: 0.5, tailF: 700, tailDec: 0.22 , bolt: 0.07}));
  v('rifle', () => gun({ len: 0.7, crack: 0.8, body: 1900, bodyDec: 0.04, thump: 85, thumpDec: 0.05, thumpA: 0.9, tail: 0.45, tailF: 800, tailDec: 0.2 , bolt: 0.065}));
  v('smg', () => gun({ len: 0.5, crack: 0.8, body: 2400, bodyDec: 0.03, thump: 110, thumpDec: 0.035, thumpA: 0.6, tail: 0.35, tailF: 1000, tailDec: 0.14 , bolt: 0.05}));
  v('pistol', () => gun({ len: 0.55, crack: 1.0, body: 2600, bodyDec: 0.03, thump: 120, thumpDec: 0.035, thumpA: 0.6, tail: 0.35, tailF: 1100, tailDec: 0.16 , bolt: 0.06}));
  v('deagle', () => gun({ len: 0.9, crack: 1.0, body: 1300, bodyDec: 0.07, thump: 60, thumpDec: 0.09, thumpA: 1.3, tail: 0.6, tailF: 650, tailDec: 0.3, drive: 2 , bolt: 0.08}));
  v('awp', () => gun({ len: 1.4, crack: 1.1, body: 1100, bodyDec: 0.09, thump: 46, thumpDec: 0.16, thumpA: 1.8, tail: 0.8, tailF: 500, tailDec: 0.5, drive: 2.6, sub: 1.0, bolt: 0.55 }));
  v('shotgun', () => gun({ len: 1.0, crack: 1.2, body: 900, bodyDec: 0.08, thump: 55, thumpDec: 0.11, thumpA: 1.6, tail: 0.7, tailF: 550, tailDec: 0.35, drive: 2.4, bolt: 0.3 }));
  v('silenced', () => mkbuf(0.25, (d, n, SR) => { let a = 0; const k = lpK(1800, SR); for (let i = 0; i < n; i++) { const t = i / SR, x = Math.random() * 2 - 1; a += k * (x - a); d[i] = a * Math.exp(-t / 0.025) * 2 + Math.sin(TAU * 180 * t) * Math.exp(-t / 0.02) * 0.4; } clickAt(d, SR, 0.03, [3200, 4700], 0.35); }));
  v('step', () => mkbuf(0.14, (d, n, SR) => { let a = 0, b2 = 0; const k = lpK(380 + Math.random() * 200, SR); for (let i = 0; i < n; i++) { const t = i / SR, x = Math.random() * 2 - 1; a += k * (x - a); b2 += k * (a - b2); d[i] = b2 * 4 * Math.exp(-t / 0.022) + Math.sin(TAU * 75 * t) * Math.exp(-t / 0.02) * 0.5 + (x - a) * 0.08 * Math.exp(-Math.abs(t - 0.035) / 0.006); } }), 4);
  B.knife = [whoosh(0.22, 500, 2600), whoosh(0.2, 700, 3000)];
  B.throw = [whoosh(0.3, 300, 1500)];
  B.reload = [mkbuf(0.9, (d, n, SR) => { clickAt(d, SR, 0.0, [1900, 3100], 0.7, 0.01); clickAt(d, SR, 0.38, [900, 1500, 2600], 1.0, 0.02); clickAt(d, SR, 0.66, [2400, 3600, 5200], 0.8, 0.012); clickAt(d, SR, 0.72, [1700, 2900], 0.6, 0.01); })];
  B.draw = [mkbuf(0.3, (d, n, SR) => { clickAt(d, SR, 0.0, [2100, 3300], 0.5, 0.008); clickAt(d, SR, 0.12, [1500, 2600], 0.7, 0.012); })];
  B.empty = [mkbuf(0.08, (d, n, SR) => clickAt(d, SR, 0, [2800, 4100], 1, 0.006))];
  B.hit = [mkbuf(0.12, (d, n, SR) => { let a = 0; const k = lpK(500, SR); for (let i = 0; i < n; i++) { const t = i / SR, x = Math.random() * 2 - 1; a += k * (x - a); d[i] = a * 3 * Math.exp(-t / 0.025) + Math.sin(TAU * 140 * t) * Math.exp(-t / 0.03) * 0.6; } })];
  B.head = [ring(0.5, [[2950, 0.6, 0.18], [4420, 0.35, 0.12], [6180, 0.2, 0.06], [1480, 0.25, 0.1]], 0.5, 0.002)];
  B.hurt = [mkbuf(0.25, (d, n, SR) => { let a = 0; const k = lpK(300, SR); for (let i = 0; i < n; i++) { const t = i / SR, x = Math.random() * 2 - 1; a += k * (x - a); d[i] = a * 3 * Math.exp(-t / 0.05) + Math.sin(TAU * 90 * t) * Math.exp(-t / 0.06) * 0.7; } })];
  B.he = [gun({ len: 2.4, crack: 1.2, body: 900, bodyDec: 0.18, thump: 40, thumpDec: 0.35, thumpA: 1.8, tail: 1.0, tailF: 380, tailDec: 0.7, drive: 2.5 })];
  B.boom = [gun({ len: 3.5, crack: 1.2, body: 700, bodyDec: 0.3, thump: 32, thumpDec: 0.6, thumpA: 2.0, tail: 1.2, tailF: 300, tailDec: 1.1, drive: 3 })];
  B.flash = [gun({ len: 1.0, crack: 1.4, body: 3500, bodyDec: 0.04, thump: 90, thumpDec: 0.05, thumpA: 0.5, tail: 0.5, tailF: 1400, tailDec: 0.25, crackF: 6000 })];
  B.ring = [tones([[3700, 0, 2.6, 0.5]], 2.6, 0)];
  B.smoke = [noiseShape(2.4, (t, L) => Math.min(1, t / 0.04) * Math.exp(-t / 0.9) * (0.8 + 0.2 * Math.sin(t * 40)), 3000, 'hp')];
  B.fire = [mkbuf(1.6, (d, n, SR) => {
    for (let k = 0; k < 14; k++) { const f = 3000 + Math.random() * 5000, s = Math.floor(Math.random() * 0.12 * SR); for (let i = 0; i < SR * 0.05 && s + i < n; i++) { const t = i / SR; d[s + i] += Math.sin(TAU * f * t) * Math.exp(-t / 0.01) * 0.3; } }
    let a = 0; const kk = lpK(900, SR);
    for (let i = 0; i < n; i++) { const t = i / SR, x = Math.random() * 2 - 1; a += kk * (x - a); d[i] += a * 2.5 * Math.min(1, t / 0.15) * Math.exp(-t / 0.7) + x * 0.4 * Math.exp(-t / 0.01); }
  })];
  B.bounce = [ring(0.12, [[1450, 0.6, 0.03], [2650, 0.3, 0.02]], 0.4, 0.001), ring(0.12, [[1250, 0.6, 0.03], [2300, 0.3, 0.02]], 0.4, 0.001)];
  B.beep = [tones([[1040, 0, 0.09, 0.35], [2080, 0, 0.05, 0.06]], 0.12, 0.9)];
  B.plant = [tones([[1400, 0, 0.07, 0.5], [1650, 0.12, 0.07, 0.5], [1400, 0.24, 0.07, 0.5], [2100, 0.4, 0.12, 0.6]], 0.6, 0.3)];
  B.defuse = [mkbuf(0.4, (d, n, SR) => { clickAt(d, SR, 0, [2500, 3700], 0.6, 0.008); clickAt(d, SR, 0.15, [2200, 3300], 0.6, 0.008); clickAt(d, SR, 0.3, [2700, 4000], 0.6, 0.008); })];
  B.tick = [mkbuf(0.03, (d, n, SR) => clickAt(d, SR, 0, [900, 1400], 0.35, 0.003))];
  B.ui = [tones([[880, 0, 0.06, 0.4]], 0.08, 0)];
  B.buy = [tones([[740, 0, 0.08, 0.4], [1110, 0.06, 0.12, 0.35]], 0.22, 0)];
  B.win = [tones([[523, 0, 0.35, 0.35], [659, 0.1, 0.35, 0.35], [784, 0.2, 0.4, 0.35], [1047, 0.32, 0.7, 0.4]], 1.1)];
  B.lose = [tones([[440, 0, 0.4, 0.35], [349, 0.18, 0.45, 0.35], [262, 0.38, 0.8, 0.35]], 1.2)];
  B.rare = [tones([[880, 0, 0.5, 0.3], [1109, 0.08, 0.5, 0.3], [1319, 0.16, 0.5, 0.3], [1760, 0.24, 0.9, 0.35], [2217, 0.36, 1.0, 0.25]], 1.5)];
  B.spray = [mkbuf(0.9, (d, n, SR) => { clickAt(d, SR, 0, [2400, 3600], 0.5, 0.01); clickAt(d, SR, 0.08, [2600, 3900], 0.4, 0.01); let a = 0; const k = lpK(5000, SR); for (let i = 0; i < n; i++) { const t = i / SR, x = Math.random() * 2 - 1; a += k * (x - a); const env = t < 0.15 ? 0 : Math.min(1, (t - 0.15) / 0.03) * Math.exp(-(t - 0.15) / 0.5); d[i] += (x - a) * env * 0.8; } })];
  B.round = [tones([[660, 0, 0.12, 0.3], [990, 0.13, 0.2, 0.3]], 0.4, 0)];
}

const REV = { ak47: 0.5, rifle: 0.5, smg: 0.45, pistol: 0.45, deagle: 0.55, shotgun: 0.6, awp: 0.6, silenced: 0.2, he: 0.7, boom: 0.8, flash: 0.6, fire: 0.3, step: 0.15, bounce: 0.2, beep: 0.25, knife: 0.15, reload: 0.15, hurt: 0.15, smoke: 0.3 };
const VARY = new Set(['ak47', 'rifle', 'smg', 'pistol', 'deagle', 'shotgun', 'awp', 'silenced', 'step', 'knife', 'bounce', 'hit']);
// громкость по типам
const GAIN = { ak47: 0.95, rifle: 0.9, smg: 0.8, pistol: 0.8, deagle: 0.95, shotgun: 1.0, awp: 1.0, silenced: 0.5, step: 0.45, knife: 0.5, throw: 0.4, reload: 0.5, draw: 0.4, empty: 0.5,
  hit: 0.55, head: 0.6, hurt: 0.6, he: 1.0, boom: 1.0, flash: 0.9, ring: 0.2, smoke: 0.5, fire: 0.7, bounce: 0.4, beep: 0.45, plant: 0.5, defuse: 0.5,
  tick: 0.25, ui: 0.3, spray: 0.5, buy: 0.4, win: 0.5, lose: 0.5, rare: 0.5, round: 0.4 };
// d — дистанция, pan — стерео (-1..1), k — множитель громкости
export function play(name, d = 0, pan = 0, k = 1) {
  if (!ctx || !B[name]) return;
  if (voices >= MAX_VOICES && d > 4) return;
  const att = 1 / (1 + d * d * 0.0035);
  const g0 = (GAIN[name] || 0.5) * att * k;
  if (g0 < 0.012) return;
  const list = B[name], src = ctx.createBufferSource();
  src.buffer = list[Math.floor(Math.random() * list.length)];
  if (VARY.has(name)) src.playbackRate.value = 0.95 + Math.random() * 0.1;
  let node = src;
  if (d > 3) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.max(700, 16000 / (1 + d * 0.09)); node.connect(f); node = f; }
  const g = ctx.createGain(); g.gain.value = g0; node.connect(g); node = g;
  if (ctx.createStereoPanner && pan) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); node = p; }
  node.connect(master);
  if (reverb && REV[name]) { const sg = ctx.createGain(); sg.gain.value = g0 * REV[name] * (0.6 + Math.min(1.4, d / 25)); g.connect(sg); sg.connect(reverb); }
  voices++; src.onended = () => { voices--; };
  src.start();
}
export function soundFor(id) {
  if (id === 'ak47' || id === 'galil' || id === 'negev' || id === 'sg553') return 'ak47';
  if (id === 'm4a4' || id === 'famas' || id === 'aug') return 'rifle';
  if (id === 'usp' || id === 'm4a1s') return 'silenced';
  if (id === 'mp9' || id === 'mac10' || id === 'ump45' || id === 'mp7' || id === 'p90') return 'smg';
  if (id === 'awp' || id === 'ssg08') return 'awp';
  if (id === 'g3sg1' || id === 'scar20') return 'deagle';
  if (id === 'nova' || id === 'xm1014') return 'shotgun';
  if (id === 'deagle') return 'deagle';
  if (id === 'glock' || id === 'p250' || id === 'tec9' || id === 'fiveseven') return 'pistol';
  return 'knife';
}
export function audioCtx() { return ctx; }

// ---------- фон карты: ветер, гул, птицы ----------
let amb = null;
export function startAmbience(style) {
  stopAmbience(0);
  if (!ctx) return;
  const SR = ctx.sampleRate, len = SR * 6, buf = ctx.createBuffer(2, len, SR);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let l = 0;
    for (let i = 0; i < len; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
    const X = SR; for (let i = 0; i < X; i++) { const t = i / X; d[i] = d[i] * t + d[len - X + i] * (1 - t); }  // бесшовная петля
  }
  const indoor = style === 'indoor' || style === 'industrial';
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = indoor ? 160 : 520;
  const g = ctx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(indoor ? 0.16 : 0.11, ctx.currentTime + 3);
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.06; lg.gain.value = indoor ? 0.02 : 0.05; lfo.connect(lg); lg.connect(g.gain); lfo.start();
  src.connect(lp); lp.connect(g); g.connect(master); src.start();
  const nodes = [src, lfo], timers = [];
  if (indoor) { for (const f of [60, 120]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = f; og.gain.value = f === 60 ? 0.012 : 0.005; o.connect(og); og.connect(g); o.start(); nodes.push(o); } }
  amb = { g, nodes, timers };
}
export function stopAmbience(fade = 1) {
  if (!amb || !ctx) { amb = null; return; }
  const a = amb; amb = null;
  a.timers.forEach(clearTimeout);
  a.g.gain.cancelScheduledValues(ctx.currentTime); a.g.gain.setValueAtTime(a.g.gain.value, ctx.currentTime); a.g.gain.linearRampToValueAtTime(0, ctx.currentTime + fade + 0.01);
  setTimeout(() => { for (const n of a.nodes) { try { n.stop(); } catch (e) { /* уже остановлен */ } } try { a.g.disconnect(); } catch (e) { /* */ } }, fade * 1000 + 100);
}
