// Music kit: встроенные киты синтезируются на лету (секвенсор WebAudio),
// свой кит — треки игрока из файлов (хранятся в IndexedDB на устройстве).
import { audioCtx, initAudio } from './sfx.js?v=1793207997';

// ступени ладов (полутоны)
const MINOR = [0, 2, 3, 5, 7, 8, 10], PHRYG = [0, 1, 3, 5, 7, 8, 10], DORIAN = [0, 2, 3, 5, 7, 9, 10];
// pattern: строки по 16 шагов; цифра — ступень лада (лид), '.' — пауза; ударные: x — удар
// bassy: true — бассовые киты (808, wobble, рис), иначе — мелодичные и спокойные
// bassType: 808 | wobble | reese | saw | soft | none
export const KITS = [
  { id: 'cfs', name: 'CFS — Стандартный', author: 'CFS', col: '#f0a020', bpm: 92, root: 45, scale: MINOR, prog: [0, 5, 3, 4], lead: 'tri',
    kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.', bass: '0...0...0.0.....', mel: '4.3.2...0...2.3.', pad: true },
  { id: 'neon', name: 'Неоновая ночь', author: 'Synthwave', col: '#ff3fb4', bpm: 104, root: 45, scale: MINOR, prog: [0, 5, 2, 6], lead: 'saw',
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: '0.0.0.0.0.0.0.0.', mel: '7.6.4.2.4...0...', pad: true },
  { id: 'trap', name: 'Бит на район', author: 'Trap', col: '#9b5cff', bpm: 140, root: 41, scale: PHRYG, prog: [0, 0, 5, 1], lead: 'bell', bassy: true, bassType: '808', kickV: 1.2,
    kick: 'x......x..x.....', snare: '........x.......', hat: 'xxx.x.xxx.xxx.xx', bass: '0......0..0.....', mel: '..4...3...1...0.', pad: false },
  { id: 'drive', name: 'Овердрайв', author: 'DnB', col: '#3cc8ff', bpm: 172, root: 40, scale: DORIAN, prog: [0, 3, 4, 3], lead: 'square', bassy: true, bassType: 'reese',
    kick: 'x.........x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: '0..0..0...0.0...', mel: '4...5...7...5.4.', pad: true },
  { id: 'arena', name: 'Арена', author: 'Hard', col: '#ff5a3a', bpm: 128, root: 43, scale: MINOR, prog: [0, 5, 6, 4], lead: 'saw',
    kick: 'x...x...x...x...', snare: '....x.......x..x', hat: '..x...x...x...x.', bass: '.0.0.0.0.0.0.0.0', mel: '0.0.3.0.5.0.3.2.', pad: true },
  // ---- бассовые ----
  { id: 'basement', name: 'Подвал 808', author: 'Bass Boosted', col: '#ff2a55', bpm: 136, root: 36, scale: PHRYG, prog: [0, 0, 1, 5], lead: 'bell', bassy: true, bassType: '808', bassV: 0.8, kickV: 1.4,
    kick: 'x.....x...x.....', snare: '........x.......', hat: 'x.xxx.x.x.xxx.xx', bass: '0.....0...0...0.', mel: '....4.....3.1...', pad: false },
  { id: 'phonk', name: 'Дрифт Фонк', author: 'Phonk', col: '#c03cff', bpm: 124, root: 37, scale: PHRYG, prog: [0, 5, 0, 1], lead: 'cow', bassy: true, bassType: '808', bassV: 0.7, kickV: 1.3,
    kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx', bass: '0.......0.0.....', mel: '0.1.0.4.3.1.0...', pad: false },
  { id: 'wobble', name: 'Вобл-Удар', author: 'Dubstep', col: '#4cff3c', bpm: 140, root: 38, scale: MINOR, prog: [0, 0, 5, 3], lead: 'square', bassy: true, bassType: 'wobble', bassV: 0.5, kickV: 1.3,
    kick: 'x.........x.....', snare: '........x.......', hat: 'x...x...x...x...', bass: '0.......0...0...', mel: '................', pad: false },
  { id: 'subzero', name: 'Сабзиро', author: 'Drill', col: '#3c8cff', bpm: 142, root: 39, scale: MINOR, prog: [0, 3, 5, 4], lead: 'bell', bassy: true, bassType: '808', bassV: 0.75, kickV: 1.1,
    kick: 'x.........x.....', snare: '......x.......x.', hat: 'x..x..x.x..x.x..', bass: '0..0......0..0..', mel: '7...6...4.....3.', pad: true },
  // ---- без баса / мелодичные ----
  { id: 'lofi', name: 'Лоу-фай вечер', author: 'Lo-Fi', col: '#e0b080', bpm: 78, root: 50, scale: DORIAN, prog: [0, 3, 1, 4], lead: 'tri', bassType: 'soft', bassV: 0.12, kickV: 0.6,
    kick: 'x......x..x.....', snare: '....x.......x...', hat: '..x...x...x...x.', bass: '0.......0.......', mel: '4.2.....3.1.....', pad: true },
  { id: 'piano', name: 'Ночной город', author: 'Melodic', col: '#a0c8ff', bpm: 96, root: 52, scale: MINOR, prog: [0, 5, 2, 6], lead: 'bell', bassType: 'none', kickV: 0.5,
    kick: 'x.......x.......', snare: '', hat: '....x.......x...', bass: '', mel: '0.2.4.7.6.4.2.4.', pad: true },
  { id: 'chip', name: '8-бит Герой', author: 'Chiptune', col: '#ffd84c', bpm: 150, root: 57, scale: MINOR, prog: [0, 5, 3, 4], lead: 'square', bassType: 'soft', bassV: 0.08, kickV: 0.6,
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: '0.0.0.0.0.0.0.0.', mel: '0.2.4.7.4.2.7.9.', pad: false },
  { id: 'fog', name: 'Туман', author: 'Ambient', col: '#8ad8c8', bpm: 70, root: 50, scale: DORIAN, prog: [0, 4, 5, 3], lead: 'tri', bassType: 'none',
    kick: '', snare: '', hat: '', bass: '', mel: '4.......2.......', pad: true },
];

let onEnd = null;
export function onMusicEnd(fn) { onEnd = fn; }
let gain = null, musicVol = 0.5, kitId = 'cfs', timer = null, seq = null, audioEl = null, fadeT = null;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function out() {
  const ctx = audioCtx(); if (!ctx) return null;
  if (!gain) { gain = ctx.createGain(); gain.gain.value = musicVol; gain.connect(ctx.destination); }
  return ctx;
}
export function setMusicVolume(v) { musicVol = v; if (gain) gain.gain.value = v; if (audioEl) audioEl.volume = Math.min(1, v); }
export function setKit(id) { kitId = id; }
export function currentKit() { return kitId; }

// ---------- инструменты ----------
function env(ctx, g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
let noiseBuf = null;
function noise(ctx) { if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return noiseBuf; }
function kick(ctx, t, dst, v = 1) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(v > 1 ? 36 : 42, t + 0.12); env(ctx, g, t, 0.003, v > 1 ? 0.5 : 0.35, Math.min(1.3, 0.9 * v)); o.connect(g); g.connect(dst); o.start(t); o.stop(t + 0.4); }
function snare(ctx, t, dst, v = 1) {
  const s = ctx.createBufferSource(); s.buffer = noise(ctx); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
  const g = ctx.createGain(); env(ctx, g, t, 0.002, 0.18, 0.5 * v); s.connect(f); f.connect(g); g.connect(dst); s.start(t, Math.random() * 0.5, 0.25);
  const o = ctx.createOscillator(), g2 = ctx.createGain(); o.frequency.value = 190; env(ctx, g2, t, 0.002, 0.08, 0.3 * v); o.connect(g2); g2.connect(dst); o.start(t); o.stop(t + 0.12);
}
function hat(ctx, t, dst, v = 1) { const s = ctx.createBufferSource(); s.buffer = noise(ctx); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500; const g = ctx.createGain(); env(ctx, g, t, 0.001, 0.045, 0.16 * v); s.connect(f); f.connect(g); g.connect(dst); s.start(t, Math.random() * 0.5, 0.06); }
// 808: синус с «подтяжкой» высоты и перегрузом; обертон — чтобы бас был слышен и на динамиках телефона
let clipCurve = null;
function bass808(ctx, t, dst, freq, dur, v) {
  if (!clipCurve) { clipCurve = new Float32Array(1024); for (let i = 0; i < 1024; i++) clipCurve[i] = Math.tanh((i / 512 - 1) * 2.5); }
  const o = ctx.createOscillator(), ws = ctx.createWaveShaper(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(freq * 2.2, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
  ws.curve = clipCurve; o.connect(ws); ws.connect(g); g.connect(dst);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006); g.gain.setValueAtTime(v, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.05);
  const h = ctx.createOscillator(), hg = ctx.createGain(); h.type = 'triangle'; h.frequency.value = freq * 2; h.connect(hg); hg.connect(dst);
  hg.gain.setValueAtTime(0.0001, t); hg.gain.exponentialRampToValueAtTime(v * 0.18, t + 0.01); hg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7);
  h.start(t); h.stop(t + dur);
}
// wobble: две пилы через резонансный фильтр, частоту которого качает LFO в такт
function wobble(ctx, t, dst, freq, dur, v, rate) {
  const f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  f.type = 'lowpass'; f.Q.value = 9; f.frequency.value = 520; lfo.type = 'sine'; lfo.frequency.value = rate; lg.gain.value = 480;
  lfo.connect(lg); lg.connect(f.frequency); f.connect(g); g.connect(dst);
  for (const d of [-14, 14]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = d; o.connect(f); o.start(t); o.stop(t + dur + 0.05); }
  const s = ctx.createOscillator(), sg = ctx.createGain(); s.frequency.value = freq / 2; sg.gain.value = 0.7; s.connect(sg); sg.connect(g); s.start(t); s.stop(t + dur + 0.05);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.setValueAtTime(v, t + dur * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  lfo.start(t); lfo.stop(t + dur + 0.05);
}
function bassNote(ctx, t, dst, kit, freq, spb) {
  const ty = kit.bassType || 'saw', v = kit.bassV;
  if (ty === 'none') return;
  if (ty === '808') return bass808(ctx, t, dst, freq, spb * 6, v ?? 0.6);
  if (ty === 'wobble') return wobble(ctx, t, dst, freq, spb * 7.5, v ?? 0.45, kit.bpm / 60 * 2);
  if (ty === 'reese') return synth(ctx, t, dst, freq, spb * 2.6, 'saw', v ?? 0.3, 520, 22);
  if (ty === 'soft') return synth(ctx, t, dst, freq, spb * 2, 'tri', v ?? 0.15, 500, 2);
  synth(ctx, t, dst, freq, spb * 1.8, 'saw', v ?? 0.22, 700, 3);
}
function synth(ctx, t, dst, freq, dur, type, peak, cutoff = 2400, detune = 0) {
  const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.35), t + dur);
  f.connect(g); g.connect(dst);
  const types = type === 'cow' ? ['square', 'square'] : type === 'bell' ? ['sine', 'sine'] : type === 'tri' ? ['triangle', 'sine'] : [type === 'square' ? 'square' : 'sawtooth', type === 'square' ? 'square' : 'sawtooth'];
  types.forEach((ty, i) => { const o = ctx.createOscillator(); o.type = ty; o.frequency.value = freq * (type === 'bell' && i ? 2.01 : type === 'cow' && i ? 1.48 : 1); o.detune.value = i ? detune || 7 : -(detune || 7); o.connect(f); o.start(t); o.stop(t + dur + 0.05); });
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

// ---------- секвенсор ----------
// mode: menu (петля), start (начало раунда), mvp (гимн MVP), bomb (последние 10 секунд)
function startSeq(kit, mode, maxSec) {
  const ctx = out(); if (!ctx) return;
  const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(gain);
  const st = { kit, mode, bus, step: 0, t: ctx.currentTime + 0.08, until: maxSec ? ctx.currentTime + maxSec : Infinity, bar: 0 };
  const spb = 60 / kit.bpm / 4 * (kit.half ? 1 : 1);
  const tick = () => {
    while (st.t < ctx.currentTime + 0.15) {
      if (st.t > st.until) { stopSeq(0.8); if (onEnd && mode !== 'menu') setTimeout(onEnd, 900); return; }
      const i = st.step % 16, bar = Math.floor(st.step / 16), chord = kit.prog[bar % kit.prog.length];
      const deg = n => kit.scale[((n % 7) + 7) % 7] + 12 * Math.floor(n / 7);
      const rootN = kit.root + deg(chord);
      const intro = mode === 'menu' && bar < 2, hot = mode === 'bomb';
      if (!intro || hot) {
        if (kit.kick[i] === 'x' || (hot && i % 4 === 0)) kick(ctx, st.t, bus, kit.kickV || 1);
        if (kit.snare[i] === 'x' && !hot) snare(ctx, st.t, bus);
        if (kit.hat[i] === 'x' || hot) hat(ctx, st.t, bus, hot ? 0.8 + (i % 2) * 0.4 : 1);
        if (kit.bass[i] !== '.' && kit.bass[i]) bassNote(ctx, st.t, bus, kit, mtof(rootN - 12), spb);
      }
      const m = kit.mel[i];
      if (m !== '.' && mode !== 'bomb' && (mode !== 'menu' || bar % 4 >= 1)) synth(ctx, st.t, bus, mtof(kit.root + 12 + deg(chord + +m)), spb * 1.7, kit.lead, mode === 'mvp' ? 0.2 : 0.13, 3200, 9);
      if (hot && i % 2 === 0) synth(ctx, st.t, bus, mtof(kit.root + 24 + (bar % 2 ? 1 : 0)), spb * 0.8, 'square', 0.06, 2500);
      if (kit.pad && i === 0 && mode !== 'bomb') for (const n of [0, 2, 4]) synth(ctx, st.t, bus, mtof(kit.root + deg(chord + n)), spb * 15, 'saw', 0.045, 1100, 12);
      st.t += spb; st.step++;
    }
  };
  seq = st; tick(); timer = setInterval(tick, 40);
}
function stopSeq(fade = 0.5) {
  if (timer) { clearInterval(timer); timer = null; }
  const st = seq; seq = null;
  const ctx = audioCtx();
  if (st && ctx) { st.bus.gain.setValueAtTime(st.bus.gain.value, ctx.currentTime); st.bus.gain.linearRampToValueAtTime(0, ctx.currentTime + fade); setTimeout(() => { try { st.bus.disconnect(); } catch (e) { /* */ } }, fade * 1000 + 200); }
}

// ---------- свой кит (файлы игрока) ----------
const DB = 'cfs_music', STORE = 'tracks';
function db() { return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
export async function saveTrack(slot, file) { const d = await db(); return new Promise((res, rej) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put({ blob: file, name: file.name }, slot); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
export async function loadTrack(slot) { try { const d = await db(); return await new Promise(res => { const r = d.transaction(STORE).objectStore(STORE).get(slot); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }); } catch (e) { return null; } }
export async function deleteTrack(slot) { const d = await db(); return new Promise(res => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(slot); tx.oncomplete = () => res(); }); }
async function playFile(mode, maxSec) {
  // для каждого режима свой файл; если его нет — главный трек
  const rec = (await loadTrack(mode)) || (await loadTrack('menu'));
  if (!rec) return false;
  stopAll(0.2);
  const a = new Audio(URL.createObjectURL(rec.blob)); a.loop = mode === 'menu'; a.volume = Math.min(1, musicVol);
  audioEl = a; a.play().catch(() => {});
  if (maxSec) fadeT = setTimeout(() => { fadeAudio(a, 1); if (onEnd) setTimeout(onEnd, 1100); }, maxSec * 1000);
  return true;
}
function fadeAudio(a, sec) {
  if (!a) return; const v0 = a.volume, t0 = performance.now();
  const step = () => { const k = (performance.now() - t0) / (sec * 1000); if (k >= 1) { a.pause(); URL.revokeObjectURL(a.src); if (audioEl === a) audioEl = null; return; } a.volume = v0 * (1 - k); requestAnimationFrame(step); };
  step();
}
function stopAll(fade = 0.5) { stopSeq(fade); if (fadeT) { clearTimeout(fadeT); fadeT = null; } if (audioEl) { fadeAudio(audioEl, fade); } }

// ---------- API ----------
const DUR = { start: 6, mvp: 9, bomb: 10.5, menu: 0 };
export async function playMusic(mode, kit = kitId) {
  initAudio(); if (!audioCtx()) return;
  if (musicVol <= 0) return;
  if (mode === 'menu' && (seq && seq.mode === 'menu' && seq.kit.id === kit || audioEl && audioEl.loop && kit === 'custom')) return;
  if (kit === 'custom') { if (await playFile(mode, DUR[mode])) return; kit = 'cfs'; }
  stopAll(0.3);
  startSeq(KITS.find(k => k.id === kit) || KITS[0], mode, DUR[mode]);
}
export function stopMusic(fade = 0.6) { stopAll(fade); }
// приложение свёрнуто / вкладка скрыта: глушим всё, при возврате продолжаем
let hiddenPaused = false;
export function setHidden(h) {
  const ctx = audioCtx();
  if (h) { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); if (audioEl && !audioEl.paused) { audioEl.pause(); hiddenPaused = true; } }
  else { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); if (hiddenPaused && audioEl) audioEl.play().catch(() => {}); hiddenPaused = false; }
}
export function musicMode() { return seq ? seq.mode : audioEl ? 'file' : null; }
