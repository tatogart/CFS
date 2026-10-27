// Синтезированные звуки (WebAudio), без файлов
let ctx = null, master = null, noiseBuf = null, vol = 0.7;
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ctx = null; }
}
export function setVolume(v) { vol = v; if (master) master.gain.value = v; }

function out(gain, pan) {
  const g = ctx.createGain(); g.gain.value = gain;
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan || 0)); g.connect(p); p.connect(master); }
  else g.connect(master);
  return g;
}
function noise(dur, freq, q, gain, pan, type = 'lowpass', decay = 8) {
  const t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const env = ctx.createGain(); env.gain.setValueAtTime(1, t); env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(env); env.connect(out(gain, pan));
  src.start(t, Math.random() * 0.5, dur + 0.05);
}
function tone(freq, dur, gain, pan, type = 'sine', slide = 0) {
  const t = ctx.currentTime, o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  const env = ctx.createGain(); env.gain.setValueAtTime(gain, t); env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(env); env.connect(out(1, pan)); o.start(t); o.stop(t + dur + 0.02);
}
// d — дистанция до слушателя, pan — стерео
export function play(name, d = 0, pan = 0) {
  if (!ctx) return;
  const att = 1 / (1 + d * d * 0.004);
  if (att < 0.02) return;
  switch (name) {
    case 'rifle': noise(0.22, 2400, 0.7, 0.9 * att, pan); tone(110, 0.12, 0.5 * att, pan, 'triangle', 0.4); break;
    case 'ak47': noise(0.26, 1900, 0.8, 1.0 * att, pan); tone(95, 0.14, 0.6 * att, pan, 'triangle', 0.4); break;
    case 'pistol': noise(0.15, 3200, 0.8, 0.7 * att, pan); tone(160, 0.08, 0.4 * att, pan, 'triangle', 0.5); break;
    case 'silenced': noise(0.08, 1200, 1.2, 0.35 * att, pan); break;
    case 'smg': noise(0.14, 3000, 0.7, 0.65 * att, pan); break;
    case 'awp': noise(0.5, 1300, 0.6, 1.2 * att, pan); tone(70, 0.35, 0.9 * att, pan, 'sawtooth', 0.3); break;
    case 'deagle': noise(0.3, 1600, 0.6, 1.0 * att, pan); tone(80, 0.2, 0.7 * att, pan, 'triangle', 0.3); break;
    case 'knife': noise(0.12, 5000, 2, 0.3 * att, pan, 'bandpass'); break;
    case 'step': noise(0.06, 500, 1, 0.22 * att, pan); break;
    case 'reload': tone(900, 0.04, 0.15 * att, pan, 'square'); setTimeout(() => ctx && tone(600, 0.05, 0.15 * att, pan, 'square'), 120); break;
    case 'empty': tone(1400, 0.03, 0.15, pan, 'square'); break;
    case 'hit': tone(1800, 0.05, 0.25, 0, 'square', 0.7); break;
    case 'head': tone(2600, 0.12, 0.35, 0, 'sine', 0.9); tone(3900, 0.08, 0.15, 0, 'sine'); break;
    case 'hurt': noise(0.15, 700, 1, 0.5, 0); break;
    case 'he': noise(0.9, 800, 0.5, 1.5 * att, pan); tone(55, 0.7, 1.0 * att, pan, 'sine', 0.4); break;
    case 'flash': noise(0.25, 6000, 0.5, 0.8 * att, pan, 'highpass'); tone(3000, 0.4, 0.2 * att, pan); break;
    case 'smoke': noise(1.6, 2500, 0.3, 0.45 * att, pan, 'highpass', 2); break;
    case 'fire': noise(1.2, 900, 0.4, 0.6 * att, pan); break;
    case 'bounce': tone(700, 0.04, 0.2 * att, pan, 'triangle'); break;
    case 'beep': tone(2200, 0.08, 0.25 * att, pan, 'sine'); break;
    case 'plant': tone(1000, 0.1, 0.25, 0, 'square'); break;
    case 'boom': noise(2.0, 500, 0.4, 2.0 * att, pan); tone(40, 1.6, 1.4 * att, pan, 'sine', 0.5); break;
    case 'buy': tone(880, 0.06, 0.15, 0, 'triangle'); tone(1320, 0.08, 0.1, 0, 'triangle'); break;
    case 'tick': tone(1200, 0.03, 0.08, 0, 'square'); break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => ctx && tone(f, 0.3, 0.2, 0, 'triangle'), i * 110)); break;
    case 'lose': [400, 330, 260].forEach((f, i) => setTimeout(() => ctx && tone(f, 0.35, 0.2, 0, 'triangle'), i * 140)); break;
    case 'rare': [700, 900, 1200, 1600, 2100].forEach((f, i) => setTimeout(() => ctx && tone(f, 0.4, 0.15, 0, 'sine'), i * 90)); break;
  }
}
export function soundFor(id) {
  if (id === 'ak47' || id === 'galil') return 'ak47';
  if (id === 'm4a4' || id === 'famas') return 'rifle';
  if (id === 'usp') return 'silenced';
  if (id === 'mp9' || id === 'mac10') return 'smg';
  if (id === 'awp') return 'awp';
  if (id === 'deagle') return 'deagle';
  if (id === 'glock') return 'pistol';
  return 'knife';
}
