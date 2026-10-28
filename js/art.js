// Процедурная графика: узоры скинов, миниатюры оружия, кейсов и карт
import { skinById, WEAPONS, KNIVES, GLOVES } from './data.js?v=1793184313';

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hashStr = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

const patCache = new Map();
export function patternCanvas(pat, w = 256, h = 128) {
  const key = JSON.stringify(pat) + w + 'x' + h;
  if (patCache.has(key)) return patCache.get(key);
  const cv = mk(w, h), g = cv.getContext('2d'), c = pat.c, R = rng(hashStr(key));
  const fillAll = col => { g.fillStyle = col; g.fillRect(0, 0, w, h); };
  switch (pat.t) {
    case 'stripes': {
      fillAll(c[0]); g.fillStyle = c[1];
      for (let x = -h; x < w + h; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 10, 0); g.lineTo(x + 10 - h, h); g.lineTo(x - h, h); g.fill(); }
      break;
    }
    case 'camo': {
      fillAll(c[0]);
      for (let k = 1; k < c.length; k++) {
        g.fillStyle = c[k];
        for (let n = 0; n < 16; n++) {
          const x = R() * w, y = R() * h, r = 6 + R() * 16;
          g.beginPath();
          for (let a = 0; a < 7; a++) { const ang = a / 7 * Math.PI * 2, rr = r * (0.6 + R() * 0.7); g.lineTo(x + Math.cos(ang) * rr * 1.5, y + Math.sin(ang) * rr); }
          g.fill();
        }
      }
      break;
    }
    case 'digital': {
      fillAll(c[0]); const s = 6;
      for (let k = 1; k < c.length; k++) { g.fillStyle = c[k]; for (let n = 0; n < 50; n++) { const x = Math.floor(R() * w / s) * s, y = Math.floor(R() * h / s) * s; g.fillRect(x, y, s * (1 + Math.floor(R() * 3)), s * (1 + Math.floor(R() * 2))); } }
      break;
    }
    case 'tiger': {
      fillAll(c[0]); g.fillStyle = c[1];
      for (let x = 0; x < w; x += 16 + R() * 10) {
        g.beginPath(); const wv = 6 + R() * 8; g.moveTo(x, 0);
        for (let y = 0; y <= h; y += 8) g.lineTo(x + Math.sin(y * 0.09 + x) * wv, y);
        for (let y = h; y >= 0; y -= 8) g.lineTo(x + 4 + R() * 3 + Math.sin(y * 0.09 + x) * wv, y);
        g.fill();
      }
      break;
    }
    case 'fade': {
      const gr = g.createLinearGradient(0, 0, w, h * 0.4);
      c.forEach((col, i) => gr.addColorStop(i / (c.length - 1), col));
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      break;
    }
    case 'carbon': {
      fillAll(c[0]);
      for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) { g.fillStyle = ((x + y) / 4) % 2 ? c[2] : c[0]; g.fillRect(x, y, 4, 4); }
      g.fillStyle = c[1]; g.fillRect(0, h * 0.42, w, h * 0.06); g.fillRect(0, h * 0.58, w, h * 0.03);
      for (let x = 20; x < w; x += 60) { g.beginPath(); g.moveTo(x, h * 0.2); g.lineTo(x + 26, h * 0.2); g.lineTo(x + 40, h * 0.42); g.lineTo(x + 30, h * 0.42); g.fill(); }
      break;
    }
    case 'splat': {
      fillAll(c[0]);
      for (let k = 1; k < c.length; k++) {
        g.fillStyle = c[k];
        for (let n = 0; n < 9; n++) {
          const x = R() * w, y = R() * h, r = 4 + R() * 12;
          g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
          for (let d = 0; d < 7; d++) { const a = R() * 7, l = r + R() * 18; g.beginPath(); g.arc(x + Math.cos(a) * l, y + Math.sin(a) * l, 1 + R() * 3, 0, 7); g.fill(); }
        }
      }
      break;
    }
    case 'hex': {
      fillAll(c[0]); const s = 10, hh = s * Math.sqrt(3);
      for (let y = -hh, row = 0; y < h + hh; y += hh / 2, row++) for (let x = (row % 2) * s * 1.5; x < w + s * 3; x += s * 3) {
        g.beginPath(); for (let a = 0; a < 6; a++) g.lineTo(x + Math.cos(a * Math.PI / 3) * s, y + Math.sin(a * Math.PI / 3) * s); g.closePath();
        if (c[2] && R() < 0.25) { g.fillStyle = c[2]; g.fill(); }
        g.strokeStyle = c[1]; g.lineWidth = 1.5; g.stroke();
      }
      break;
    }
    case 'neon': {
      fillAll(c[0]); g.lineCap = 'round';
      for (let n = 0; n < 14; n++) {
        const col = c[1 + (n % (c.length - 1))]; g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 8; g.lineWidth = 2 + R() * 2;
        g.beginPath(); let x = R() * w, y = R() * h; g.moveTo(x, y);
        for (let s = 0; s < 4; s++) { x += (R() - 0.5) * 90; y += (R() - 0.5) * 50; g.lineTo(x, y); }
        g.stroke();
      }
      g.shadowBlur = 0;
      break;
    }
    case 'marble': {
      const img = g.createImageData(w, h), d = img.data, cols = c.map(hexRgb), ph = R() * 10;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let v = Math.sin(x * 0.04 + Math.sin(y * 0.07 + ph) * 2.2 + Math.sin((x + y) * 0.023) * 1.6);
        v = (v + 1) / 2 * (cols.length - 1); const i0 = Math.min(cols.length - 2, Math.floor(v)), f = v - i0;
        const a = cols[i0], b = cols[i0 + 1], o = (y * w + x) * 4;
        d[o] = a[0] + (b[0] - a[0]) * f; d[o + 1] = a[1] + (b[1] - a[1]) * f; d[o + 2] = a[2] + (b[2] - a[2]) * f; d[o + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      break;
    }
    case 'fire': {
      fillAll(c[0]);
      for (let n = 0; n < 40; n++) {
        const x = R() * w, bh = h * (0.3 + R() * 0.6), gr = g.createLinearGradient(0, h, 0, h - bh);
        gr.addColorStop(0, c[1]); gr.addColorStop(0.7, c[2]); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - 10, h); g.quadraticCurveTo(x - 12 + R() * 8, h - bh * 0.5, x + (R() - 0.5) * 10, h - bh); g.quadraticCurveTo(x + 10, h - bh * 0.5, x + 10, h); g.fill();
      }
      break;
    }
    case 'asiimov': {
      fillAll(c[0]); g.fillStyle = c[1]; g.fillRect(w * 0.55, 0, w * 0.45, h);
      g.beginPath(); g.moveTo(w * 0.45, 0); g.lineTo(w * 0.58, 0); g.lineTo(w * 0.5, h); g.lineTo(w * 0.4, h); g.fill();
      g.strokeStyle = c[2]; g.lineWidth = 3;
      for (let n = 0; n < 6; n++) { g.beginPath(); const y = 10 + n * 20; g.moveTo(0, y); g.lineTo(w * 0.3, y); g.lineTo(w * 0.36, y + 8); g.lineTo(w, y + 8); g.stroke(); }
      g.fillStyle = c[2]; g.fillRect(w * 0.7, h * 0.3, 24, 10); g.fillRect(w * 0.1, h * 0.6, 40, 6);
      break;
    }
    case 'lightning': {
      fillAll(c[0]); g.strokeStyle = c[1]; g.shadowColor = c[1]; g.shadowBlur = 10;
      for (let n = 0; n < 6; n++) {
        g.lineWidth = 1.5 + R() * 2; g.beginPath(); let x = R() * w, y = 0; g.moveTo(x, y);
        while (y < h) { x += (R() - 0.5) * 40; y += 8 + R() * 14; g.lineTo(x, y); }
        g.stroke();
      }
      g.shadowBlur = 0;
      break;
    }
    case 'web': {
      fillAll(c[0]); g.strokeStyle = c[1]; g.lineWidth = 1.6;
      const cx = w * 0.5, cy = h * 0.5;
      for (let a = 0; a < 16; a++) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a / 16 * 6.283) * w, cy + Math.sin(a / 16 * 6.283) * w); g.stroke(); }
      for (let r = 10; r < w; r += 14) { g.beginPath(); for (let a = 0; a <= 16; a++) { const an = a / 16 * 6.283, rr = r * (a % 2 ? 0.92 : 1); g.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); } g.stroke(); }
      break;
    }
    case 'case': {
      // закалка: синие и золотые разводы на стали
      const img = g.createImageData(w, h), d = img.data, cols = c.map(hexRgb), ph = R() * 10;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = Math.sin(x * 0.05 + Math.sin(y * 0.09 + ph) * 3) * 0.5 + Math.sin((x - y) * 0.031 + ph) * 0.5;
        const k = v > 0.25 ? 0 : v < -0.35 ? 1 : 2, a = cols[k], o = (y * w + x) * 4, n = (R() - 0.5) * 18;
        d[o] = a[0] + n; d[o + 1] = a[1] + n; d[o + 2] = a[2] + n; d[o + 3] = 255;
      }
      g.putImageData(img, 0, 0); break;
    }
    case 'damascus': {
      fillAll(c[0]); g.lineWidth = 2;
      for (let y = -20; y < h + 20; y += 5) { g.strokeStyle = (y / 5) % 2 ? c[1] : c[2]; g.beginPath(); for (let x = 0; x <= w; x += 6) g.lineTo(x, y + Math.sin(x * 0.06 + y * 0.2) * 7 + Math.sin(x * 0.17) * 2); g.stroke(); }
      break;
    }
    case 'slaughter': {
      fillAll(c[1]);
      for (let n = 0; n < 26; n++) { g.fillStyle = n % 3 ? c[0] : c[2]; g.beginPath(); const x = R() * w, y = R() * h; for (let a = 0; a < 9; a++) { const ang = a / 9 * 6.283, rr = 6 + R() * 18; g.lineTo(x + Math.cos(ang) * rr * 1.3, y + Math.sin(ang) * rr); } g.fill(); }
      break;
    }
    default: fillAll(c[0] || '#555');
  }
  // лёгкий шум износа
  g.globalAlpha = 0.06; for (let n = 0; n < 300; n++) { g.fillStyle = R() < 0.5 ? '#000' : '#fff'; g.fillRect(R() * w, R() * h, 1 + R() * 2, 1); } g.globalAlpha = 1;
  patCache.set(key, cv);
  return cv;
}
export function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

export const DEFAULT_PAT = {
  rifle: { t: 'solid', c: ['#3a3a3c'] }, wood: { t: 'solid', c: ['#7a4a22'] }, knife: { t: 'fade', c: ['#c9ced3', '#8b9096'] },
};

// ---- силуэты оружия (координаты в поле 256x96) ----
// k: b — корпус (скин), d — тёмный металл, w — дерево (скин у AK), h — отверстие
const SHAPES = {
  ak47: [
    { k: 'w', p: [6, 40, 62, 36, 70, 46, 66, 56, 14, 68, 6, 62] },
    { k: 'b', p: [64, 34, 152, 34, 152, 52, 64, 54] },
    { k: 'w', p: [152, 37, 196, 38, 196, 49, 152, 50] },
    { k: 'd', p: [150, 32, 198, 32, 198, 36, 150, 36] },
    { k: 'd', r: [196, 40, 54, 4] }, { k: 'd', r: [228, 33, 4, 8] }, { k: 'd', r: [70, 30, 10, 4] },
    { k: 'b', p: [108, 52, 127, 52, 134, 70, 126, 92, 108, 88, 115, 70] },
    { k: 'd', p: [80, 52, 94, 52, 90, 78, 76, 76] },
  ],
  galil: [
    { k: 'd', p: [6, 38, 60, 38, 64, 50, 54, 50, 50, 44, 14, 46, 14, 58, 6, 62] },
    { k: 'b', p: [60, 34, 152, 34, 152, 53, 60, 54] },
    { k: 'b', p: [152, 37, 200, 38, 200, 50, 152, 50] },
    { k: 'd', r: [200, 40, 50, 4] }, { k: 'd', r: [226, 32, 4, 9] },
    { k: 'b', p: [110, 53, 128, 53, 136, 72, 128, 92, 110, 88, 117, 72] },
    { k: 'd', p: [76, 53, 90, 53, 86, 78, 72, 76] },
  ],
  m4a4: [
    { k: 'b', p: [6, 38, 46, 36, 50, 58, 8, 62] },
    { k: 'd', r: [46, 40, 22, 8] },
    { k: 'b', p: [66, 32, 152, 32, 152, 52, 66, 52] },
    { k: 'd', r: [78, 25, 66, 6] },
    { k: 'b', r: [152, 34, 54, 16] },
    { k: 'd', r: [206, 39, 44, 4] }, { k: 'd', r: [200, 25, 5, 10] },
    { k: 'b', p: [112, 52, 128, 52, 132, 84, 116, 86] },
    { k: 'd', p: [76, 52, 90, 52, 86, 76, 72, 74] },
  ],
  famas: [
    { k: 'b', p: [14, 32, 196, 32, 200, 40, 200, 54, 20, 60, 12, 56] },
    { k: 'd', p: [56, 18, 176, 18, 176, 24, 166, 24, 166, 32, 66, 32, 66, 24, 56, 24] },
    { k: 'd', r: [200, 40, 46, 5] },
    { k: 'd', p: [128, 54, 144, 54, 140, 80, 126, 78] },
    { k: 'b', p: [68, 56, 86, 56, 86, 78, 70, 78] },
  ],
  awp: [
    { k: 'b', p: [4, 36, 68, 34, 76, 44, 72, 60, 48, 62, 42, 52, 12, 52, 10, 62, 4, 62] },
    { k: 'h', p: [22, 42, 40, 42, 40, 47, 22, 47] },
    { k: 'b', r: [72, 36, 96, 16] },
    { k: 'd', r: [168, 40, 84, 5] },
    { k: 'd', r: [88, 22, 70, 10] }, { k: 'd', p: [80, 18, 92, 22, 92, 32, 80, 36] }, { k: 'd', p: [154, 22, 168, 18, 168, 36, 154, 32] },
    { k: 'd', r: [110, 32, 8, 5] },
    { k: 'b', r: [120, 52, 18, 18] },
    { k: 'd', p: [80, 52, 94, 52, 90, 74, 78, 72] },
  ],
  mp9: [
    { k: 'd', r: [20, 34, 44, 6] },
    { k: 'b', p: [62, 28, 182, 28, 182, 52, 62, 54] },
    { k: 'd', r: [182, 35, 40, 8] },
    { k: 'd', p: [150, 52, 162, 52, 160, 80, 150, 80] },
    { k: 'b', p: [104, 52, 122, 52, 124, 90, 106, 90] },
    { k: 'd', r: [70, 22, 90, 6] },
  ],
  mac10: [
    { k: 'b', p: [70, 26, 182, 26, 182, 56, 70, 56] },
    { k: 'd', r: [182, 34, 46, 8] },
    { k: 'b', p: [98, 56, 122, 56, 120, 92, 98, 92] },
    { k: 'd', r: [94, 88, 30, 6] },
    { k: 'd', r: [74, 20, 30, 6] },
  ],
  glock: [
    { k: 'b', p: [44, 24, 214, 24, 214, 46, 44, 46] },
    { k: 'd', p: [56, 46, 204, 46, 204, 56, 56, 56] },
    { k: 'b', p: [60, 54, 106, 54, 98, 92, 60, 90] },
    { k: 'd', p: [106, 56, 136, 56, 132, 70, 108, 70] },
  ],
  usp: [
    { k: 'b', p: [36, 26, 182, 26, 182, 44, 36, 44] },
    { k: 'd', r: [182, 28, 70, 14] },
    { k: 'd', p: [48, 44, 172, 44, 172, 54, 48, 54] },
    { k: 'b', p: [52, 52, 96, 52, 88, 92, 54, 90] },
    { k: 'd', p: [96, 54, 124, 54, 120, 68, 98, 68] },
  ],
  deagle: [
    { k: 'b', p: [30, 20, 222, 20, 222, 46, 30, 46] },
    { k: 'd', p: [40, 46, 210, 46, 210, 58, 40, 58] },
    { k: 'b', p: [50, 56, 100, 56, 92, 94, 50, 92] },
    { k: 'd', p: [100, 58, 132, 58, 128, 74, 102, 74] },
    { k: 'd', r: [214, 16, 6, 6] },
  ],
  knife: [
    { k: 'b', p: [104, 40, 226, 40, 252, 48, 226, 56, 104, 56] },
    { k: 'd', r: [94, 30, 10, 36] },
    { k: 'd', p: [16, 40, 94, 38, 94, 58, 16, 58, 10, 50] },
  ],
  bayonet: [
    { k: 'b', p: [104, 38, 222, 38, 254, 48, 222, 58, 160, 58, 150, 54, 104, 58] },
    { k: 'd', r: [94, 28, 10, 40] },
    { k: 'd', p: [14, 40, 94, 38, 94, 58, 14, 58, 8, 49] },
  ],
  karambit: [
    { k: 'b', p: [116, 50, 150, 38, 182, 26, 214, 24, 238, 34, 246, 52, 230, 44, 206, 40, 182, 46, 156, 60, 128, 68] },
    { k: 'd', p: [44, 52, 120, 46, 128, 66, 50, 74] },
    { k: 'd', c: [34, 64, 15] }, { k: 'h', c: [34, 64, 8] },
  ],
  butterfly: [
    { k: 'b', p: [116, 42, 220, 42, 246, 49, 220, 56, 116, 56] },
    { k: 'd', p: [14, 34, 116, 38, 116, 46, 14, 44] },
    { k: 'd', p: [14, 52, 116, 52, 116, 60, 14, 64] },
    { k: 'h', r: [30, 38, 60, 3] }, { k: 'h', r: [30, 56, 60, 3] },
  ],
  flip: [
    { k: 'b', p: [110, 40, 214, 38, 246, 46, 214, 56, 110, 56] },
    { k: 'd', p: [16, 42, 112, 38, 112, 58, 22, 60, 10, 52] }, { k: 'h', c: [100, 48, 4] },
  ],
  gut: [
    { k: 'b', p: [108, 40, 210, 40, 248, 50, 214, 56, 190, 52, 182, 58, 170, 52, 108, 56] },
    { k: 'd', r: [98, 30, 10, 36] }, { k: 'd', p: [16, 40, 98, 38, 98, 58, 16, 58, 10, 49] },
  ],
  huntsman: [
    { k: 'b', p: [112, 36, 196, 36, 252, 50, 214, 60, 112, 60] }, { k: 'd', r: [130, 38, 50, 4] },
    { k: 'd', r: [100, 26, 12, 44] }, { k: 'd', p: [14, 40, 100, 38, 100, 58, 14, 60, 8, 50] },
  ],
  falchion: [
    { k: 'b', p: [110, 46, 190, 40, 232, 30, 250, 34, 226, 54, 110, 58] },
    { k: 'd', r: [100, 34, 10, 30] }, { k: 'd', p: [16, 40, 100, 40, 100, 58, 20, 62, 8, 50] },
  ],
  talon: [
    { k: 'b', p: [112, 52, 150, 42, 190, 26, 226, 20, 248, 30, 252, 50, 236, 42, 210, 36, 186, 44, 160, 60, 128, 68] },
    { k: 'd', p: [40, 52, 116, 46, 124, 66, 46, 74] }, { k: 'd', c: [30, 64, 14] }, { k: 'h', c: [30, 64, 7] },
  ],
  kukri: [
    { k: 'b', p: [108, 44, 150, 50, 190, 62, 222, 70, 246, 60, 250, 46, 232, 50, 200, 50, 168, 40, 140, 36, 108, 36] },
    { k: 'd', r: [98, 30, 10, 26] }, { k: 'w', p: [16, 34, 98, 34, 98, 54, 22, 60, 8, 48] }, { k: 'd', c: [12, 46, 8] },
  ],
  bowie: [
    { k: 'b', p: [110, 34, 206, 34, 252, 48, 226, 58, 206, 52, 186, 60, 110, 60] },
    { k: 'd', r: [98, 18, 12, 56] }, { k: 'w', p: [16, 38, 98, 38, 98, 58, 20, 60, 8, 48] }, { k: 'd', c: [12, 48, 9] },
  ],
  skeleton: [
    { k: 'b', p: [110, 40, 200, 40, 246, 48, 210, 56, 110, 56] },
    { k: 'd', p: [32, 36, 108, 38, 108, 58, 32, 60] }, { k: 'h', r: [40, 44, 60, 8] }, { k: 'd', c: [22, 48, 14] }, { k: 'h', c: [22, 48, 8] },
  ],
  stiletto: [
    { k: 'b', p: [112, 44, 222, 45, 254, 48, 222, 52, 112, 53] },
    { k: 'd', r: [102, 36, 8, 24] }, { k: 'd', p: [16, 41, 102, 40, 102, 56, 16, 56, 8, 48] }, { k: 'h', c: [92, 48, 3] },
  ],
  ursus: [
    { k: 'b', p: [108, 38, 220, 38, 244, 44, 252, 56, 108, 58] },
    { k: 'd', p: [14, 38, 108, 36, 108, 60, 18, 62, 8, 50] }, { k: 'h', c: [98, 48, 4] }, { k: 'h', r: [30, 46, 50, 3] },
  ],
  glove: [
    { k: 'b', p: [70, 38, 92, 22, 104, 22, 98, 40, 118, 16, 130, 18, 122, 42, 140, 16, 152, 20, 142, 44, 160, 26, 170, 30, 156, 54, 172, 46, 182, 52, 164, 72, 150, 86, 96, 86, 74, 70] },
    { k: 'd', p: [92, 84, 152, 84, 150, 94, 94, 94] },
  ],
  p250: [{ k: 'b', p: [48, 26, 206, 26, 206, 46, 48, 46] }, { k: 'd', p: [58, 46, 196, 46, 196, 54, 58, 54] }, { k: 'b', p: [62, 52, 104, 52, 96, 90, 62, 88] }, { k: 'd', p: [104, 54, 132, 54, 128, 68, 106, 68] }],
  fiveseven: [{ k: 'b', p: [40, 24, 214, 24, 214, 44, 40, 44] }, { k: 'd', p: [52, 44, 204, 44, 204, 52, 52, 52] }, { k: 'b', p: [58, 50, 100, 50, 94, 92, 60, 92] }, { k: 'd', p: [100, 52, 130, 52, 126, 66, 102, 66] }, { k: 'd', r: [210, 20, 4, 5] }],
  tec9: [{ k: 'b', p: [40, 30, 210, 30, 210, 50, 40, 50] }, { k: 'd', r: [210, 36, 30, 8] }, { k: 'b', p: [118, 50, 136, 50, 140, 92, 120, 92] }, { k: 'd', p: [60, 50, 92, 50, 86, 84, 60, 82] }],
  ump45: [{ k: 'd', p: [10, 34, 60, 34, 64, 54, 18, 58] }, { k: 'b', p: [60, 28, 186, 28, 186, 54, 60, 56] }, { k: 'd', r: [186, 36, 44, 8] }, { k: 'b', p: [116, 54, 134, 54, 140, 90, 120, 90] }, { k: 'd', p: [74, 54, 88, 54, 84, 78, 70, 76] }],
  mp7: [{ k: 'd', r: [20, 34, 44, 6] }, { k: 'b', p: [62, 26, 176, 26, 176, 52, 62, 54] }, { k: 'd', r: [176, 34, 44, 8] }, { k: 'd', p: [146, 52, 158, 52, 156, 76, 146, 76] }, { k: 'b', p: [96, 52, 114, 52, 116, 92, 98, 92] }, { k: 'd', r: [70, 20, 96, 6] }],
  p90: [{ k: 'b', p: [20, 40, 40, 26, 200, 26, 214, 34, 214, 52, 160, 60, 100, 60, 90, 76, 70, 76, 60, 60, 20, 58] }, { k: 'd', r: [60, 18, 130, 8] }, { k: 'd', r: [214, 38, 26, 7] }, { k: 'h', p: [100, 44, 124, 44, 124, 52, 100, 52] }],
  nova: [{ k: 'w', p: [6, 40, 60, 36, 66, 54, 12, 64] }, { k: 'b', p: [60, 34, 120, 34, 120, 52, 60, 54] }, { k: 'd', r: [120, 36, 128, 6] }, { k: 'w', r: [130, 44, 70, 10] }, { k: 'd', r: [200, 44, 48, 7] }, { k: 'd', p: [74, 52, 88, 52, 84, 74, 70, 72] }],
  xm1014: [{ k: 'b', p: [6, 38, 56, 36, 62, 56, 10, 62] }, { k: 'b', p: [56, 32, 130, 32, 130, 54, 56, 54] }, { k: 'd', r: [130, 34, 120, 6] }, { k: 'd', r: [130, 44, 90, 9] }, { k: 'd', p: [70, 54, 84, 54, 80, 76, 66, 74] }],
  negev: [{ k: 'd', p: [6, 36, 50, 34, 56, 56, 10, 62] }, { k: 'b', p: [50, 26, 150, 26, 150, 58, 50, 58] }, { k: 'd', r: [150, 34, 100, 8] }, { k: 'b', r: [96, 58, 34, 30] }, { k: 'd', p: [210, 42, 220, 42, 236, 80, 230, 82] }, { k: 'd', p: [214, 42, 222, 42, 206, 80, 200, 80] }],
  m4a1s: [{ k: 'b', p: [6, 38, 46, 36, 50, 58, 8, 62] }, { k: 'd', r: [46, 40, 22, 8] }, { k: 'b', p: [66, 32, 150, 32, 150, 52, 66, 52] }, { k: 'd', r: [78, 25, 66, 6] }, { k: 'b', r: [150, 34, 46, 16] }, { k: 'd', r: [196, 34, 56, 12] }, { k: 'b', p: [112, 52, 126, 52, 128, 78, 114, 80] }, { k: 'd', p: [76, 52, 90, 52, 86, 76, 72, 74] }],
  sg553: [{ k: 'd', p: [6, 38, 50, 36, 54, 56, 12, 60] }, { k: 'b', p: [50, 32, 156, 32, 156, 54, 50, 54] }, { k: 'd', r: [80, 16, 60, 12] }, { k: 'b', r: [156, 36, 44, 14] }, { k: 'd', r: [200, 40, 48, 5] }, { k: 'b', p: [104, 54, 122, 54, 130, 84, 112, 86] }, { k: 'd', p: [70, 54, 84, 54, 80, 76, 66, 74] }],
  aug: [{ k: 'b', p: [14, 32, 186, 32, 190, 40, 190, 56, 120, 56, 116, 72, 100, 72, 96, 56, 20, 60, 12, 56] }, { k: 'd', r: [70, 16, 76, 14] }, { k: 'd', r: [190, 40, 56, 5] }, { k: 'd', p: [150, 56, 164, 56, 160, 80, 148, 80] }, { k: 'b', p: [60, 56, 78, 56, 78, 80, 62, 80] }],
  ssg08: [{ k: 'b', p: [4, 38, 60, 36, 68, 46, 64, 60, 44, 62, 40, 52, 10, 54, 8, 62, 4, 62] }, { k: 'b', r: [64, 38, 80, 14] }, { k: 'd', r: [144, 41, 108, 4] }, { k: 'd', r: [80, 24, 60, 9] }, { k: 'd', p: [74, 20, 84, 24, 84, 34, 74, 38] }, { k: 'd', p: [140, 24, 150, 20, 150, 36, 140, 32] }, { k: 'b', r: [104, 52, 14, 14] }],
  g3sg1: [{ k: 'b', p: [4, 36, 56, 34, 62, 58, 8, 62] }, { k: 'b', p: [56, 32, 170, 32, 170, 54, 56, 54] }, { k: 'd', r: [80, 16, 66, 12] }, { k: 'd', r: [170, 38, 80, 6] }, { k: 'b', p: [110, 54, 128, 54, 130, 84, 112, 84] }, { k: 'd', p: [70, 54, 84, 54, 80, 76, 66, 74] }],
  scar20: [{ k: 'd', p: [4, 36, 56, 34, 62, 58, 8, 62] }, { k: 'b', p: [56, 30, 172, 30, 172, 54, 56, 54] }, { k: 'd', r: [78, 14, 70, 12] }, { k: 'd', r: [172, 38, 78, 6] }, { k: 'b', p: [112, 54, 128, 54, 130, 80, 114, 80] }, { k: 'd', p: [70, 54, 84, 54, 80, 76, 66, 74] }],
  he: [{ k: 'b', c: [128, 56, 30] }, { k: 'd', r: [118, 14, 20, 14] }, { k: 'd', p: [138, 18, 168, 30, 166, 36, 138, 26] }],
  flash: [{ k: 'b', r: [104, 26, 48, 62] }, { k: 'd', r: [112, 12, 32, 14] }, { k: 'd', p: [144, 16, 170, 28, 168, 34, 144, 24] }],
  smoke: [{ k: 'b', r: [102, 28, 52, 62] }, { k: 'd', r: [102, 52, 52, 8] }, { k: 'd', r: [112, 14, 32, 14] }, { k: 'd', p: [144, 18, 170, 30, 168, 36, 144, 26] }],
  molotov: [{ k: 'b', p: [106, 46, 150, 46, 154, 90, 102, 90] }, { k: 'b', p: [118, 46, 138, 46, 134, 22, 122, 22] }, { k: 'd', p: [120, 22, 136, 22, 150, 6, 142, 4, 128, 14] }],
  vest: [{ k: 'b', p: [86, 10, 110, 10, 128, 20, 146, 10, 170, 10, 176, 88, 80, 88] }, { k: 'd', r: [94, 44, 68, 10] }],
  vesthelm: [{ k: 'b', p: [70, 30, 90, 30, 104, 38, 118, 30, 138, 30, 144, 90, 64, 90] }, { k: 'd', p: [150, 46, 150, 26, 166, 8, 196, 8, 212, 26, 212, 46] }],
  kit: [{ k: 'b', r: [80, 28, 96, 54] }, { k: 'd', r: [104, 14, 48, 14] }, { k: 'd', r: [92, 42, 30, 6] }, { k: 'd', r: [134, 42, 30, 6] }],
};
const NADE_COL = { he: '#3d5a2a', flash: '#8a8f96', smoke: '#5d6b74', molotov: '#3d6a3a', vest: '#3e4a3a', vesthelm: '#3e4a3a', kit: '#2d4d8a' };

function pathShape(g, s, sx, sy) {
  g.beginPath();
  if (s.p) { for (let i = 0; i < s.p.length; i += 2) g.lineTo(s.p[i] * sx, s.p[i + 1] * sy); g.closePath(); }
  else if (s.r) g.rect(s.r[0] * sx, s.r[1] * sy, s.r[2] * sx, s.r[3] * sy);
  else if (s.c) g.arc(s.c[0] * sx, s.c[1] * sy, s.c[2] * Math.min(sx, sy), 0, Math.PI * 2);
}

// Миниатюра оружия: weapon — id оружия, skinId — скин или null
export function drawWeapon(cv, weapon, skinId, opts = {}) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  const shapes = GLOVES[weapon] ? SHAPES.glove : (SHAPES[weapon] || SHAPES.knife);
  const sx = W / 256, sy = H / 96;
  const skin = skinId ? skinById[skinId] : null;
  let pat;
  if (skin) pat = patternCanvas(skin.pat);
  else if (NADE_COL[weapon]) pat = patternCanvas({ t: 'solid', c: [NADE_COL[weapon]] });
  else if (KNIVES[weapon] || weapon === 'knife') pat = patternCanvas(DEFAULT_PAT.knife);
  else if (GLOVES[weapon]) pat = patternCanvas({ t: 'solid', c: ['#3a3d42'] });
  else pat = patternCanvas(DEFAULT_PAT.rifle);
  const woodPat = (!skin && weapon === 'ak47') ? patternCanvas(DEFAULT_PAT.wood) : pat;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 8 * sx; g.shadowOffsetY = 3 * sy;
  // тень силуэта
  g.fillStyle = '#000';
  for (const s of shapes) if (s.k !== 'h') { pathShape(g, s, sx, sy); g.fill(); }
  g.restore();
  for (const s of shapes) {
    if (s.k === 'h') continue;
    g.save(); pathShape(g, s, sx, sy); g.clip();
    if (s.k === 'd') {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#4a4d52'); gr.addColorStop(1, '#16181b');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    } else {
      g.drawImage(s.k === 'w' ? woodPat : pat, 0, 0, W, H);
    }
    const hl = g.createLinearGradient(0, 0, 0, H); hl.addColorStop(0, 'rgba(255,255,255,0.28)'); hl.addColorStop(0.45, 'rgba(255,255,255,0)'); hl.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = hl; g.fillRect(0, 0, W, H);
    g.restore();
    pathShape(g, s, sx, sy); g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = Math.max(1, 1.4 * sx); g.stroke();
  }
  g.save(); g.globalCompositeOperation = 'destination-out';
  for (const s of shapes) if (s.k === 'h') { pathShape(g, s, sx, sy); g.fill(); }
  g.restore();
  if (opts.glow) { g.globalCompositeOperation = 'destination-over'; const rg = g.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, W / 2); rg.addColorStop(0, opts.glow + '55'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
  return cv;
}
const iconCache = new Map();
export function weaponIconURL(weapon, skinId, w = 256, h = 96) {
  const key = weapon + '|' + skinId + '|' + w;
  if (!iconCache.has(key)) iconCache.set(key, drawWeapon(mk(w, h), weapon, skinId).toDataURL());
  return iconCache.get(key);
}

// ---- кейсы ----
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function emblem(g, type, cx, cy, s, col) {
  g.save(); g.translate(cx, cy); g.fillStyle = col; g.strokeStyle = col; g.lineWidth = s * 0.12; g.lineCap = 'round';
  if (type === 'sun') {
    g.beginPath(); g.arc(0, 0, s * 0.42, 0, 7); g.fill();
    for (let a = 0; a < 12; a++) { g.save(); g.rotate(a / 12 * 6.283); g.beginPath(); g.moveTo(0, -s * 0.55); g.lineTo(s * 0.1, -s * 0.85); g.lineTo(-s * 0.1, -s * 0.85); g.fill(); g.restore(); }
  } else if (type === 'star') {
    g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? s * 0.42 : s * 0.95; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
  } else if (type === 'bolt') {
    g.beginPath(); g.moveTo(s * 0.15, -s); g.lineTo(-s * 0.5, s * 0.1); g.lineTo(-s * 0.05, s * 0.1); g.lineTo(-s * 0.2, s); g.lineTo(s * 0.5, -s * 0.15); g.lineTo(s * 0.05, -s * 0.15); g.closePath(); g.fill();
  } else if (type === 'claw') {
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(k * s * 0.38 - s * 0.2, -s * 0.8); g.quadraticCurveTo(k * s * 0.38 + s * 0.3, 0, k * s * 0.38 - s * 0.05, s * 0.85); g.quadraticCurveTo(k * s * 0.38 + s * 0.1, 0, k * s * 0.38 - s * 0.2, -s * 0.8); g.fill(); }
  } else if (type === 'glove') {
    g.beginPath(); g.moveTo(-s * 0.5, s * 0.8); g.lineTo(-s * 0.55, -s * 0.1); g.lineTo(-s * 0.7, -s * 0.45); g.lineTo(-s * 0.45, -s * 0.5); g.lineTo(-s * 0.3, -s * 0.2); g.lineTo(-s * 0.3, -s * 0.85); g.lineTo(-s * 0.1, -s * 0.85); g.lineTo(-s * 0.05, -s * 0.3); g.lineTo(0, -s * 0.95); g.lineTo(s * 0.2, -s * 0.95); g.lineTo(s * 0.2, -s * 0.3); g.lineTo(s * 0.3, -s * 0.85); g.lineTo(s * 0.5, -s * 0.8); g.lineTo(s * 0.45, -s * 0.2); g.lineTo(s * 0.6, -s * 0.6); g.lineTo(s * 0.75, -s * 0.5); g.lineTo(s * 0.5, s * 0.8); g.closePath(); g.fill();
  } else if (type === 'blade') {
    g.rotate(-0.6); g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.22, -s * 0.2); g.lineTo(s * 0.1, s * 0.25); g.lineTo(-s * 0.1, s * 0.25); g.lineTo(-s * 0.15, -s * 0.3); g.closePath(); g.fill(); g.fillRect(-s * 0.35, s * 0.25, s * 0.7, s * 0.1); g.fillRect(-s * 0.08, s * 0.35, s * 0.16, s * 0.55);
  } else if (type === 'flake') {
    for (let a = 0; a < 6; a++) { g.save(); g.rotate(a / 6 * 6.283); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s * 0.9); g.moveTo(0, -s * 0.5); g.lineTo(s * 0.22, -s * 0.72); g.moveTo(0, -s * 0.5); g.lineTo(-s * 0.22, -s * 0.72); g.stroke(); g.restore(); }
  }
  g.restore();
}
export function drawCase(cv, cs) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, [c1, c2] = cs.col;
  g.clearRect(0, 0, W, H);
  const x = W * 0.08, y = H * 0.26, w = W * 0.84, h = H * 0.6, d = H * 0.1;
  // ручка
  g.lineWidth = H * 0.05; g.strokeStyle = '#1b1b1d'; rr(g, W * 0.38, H * 0.08, W * 0.24, H * 0.22, H * 0.05); g.stroke();
  g.strokeStyle = '#3a3b3f'; g.lineWidth = H * 0.025; rr(g, W * 0.38, H * 0.08, W * 0.24, H * 0.22, H * 0.05); g.stroke();
  // тень
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(W / 2, y + h + d * 0.6, w * 0.5, d * 0.6, 0, 0, 7); g.fill();
  // верхняя грань (перспектива)
  g.fillStyle = shade(c1, 0.25); g.beginPath(); g.moveTo(x + d, y - d); g.lineTo(x + w - d, y - d); g.lineTo(x + w, y); g.lineTo(x, y); g.closePath(); g.fill();
  // корпус
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, shade(c1, 0.1)); gr.addColorStop(0.5, c1); gr.addColorStop(1, c2);
  g.fillStyle = gr; rr(g, x, y, w, h, H * 0.05); g.fill();
  // рёбра
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
  for (let i = 1; i < 7; i++) { g.beginPath(); g.moveTo(x + w * i / 7, y + 4); g.lineTo(x + w * i / 7, y + h * 0.18); g.stroke(); g.beginPath(); g.moveTo(x + w * i / 7, y + h * 0.84); g.lineTo(x + w * i / 7, y + h - 4); g.stroke(); }
  // линия крышки
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y + h * 0.32, w, 3); g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(x, y + h * 0.32 + 3, w, 1);
  // панель с эмблемой
  const px = x + w * 0.3, py = y + h * 0.4, pw = w * 0.4, ph = h * 0.48;
  g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, px, py, pw, ph, 6); g.fill();
  const eg = g.createRadialGradient(px + pw / 2, py + ph / 2, 2, px + pw / 2, py + ph / 2, pw * 0.6); eg.addColorStop(0, shade(c1, 0.6)); eg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = eg; g.fillRect(px, py, pw, ph);
  emblem(g, cs.emblem, px + pw / 2, py + ph / 2, ph * 0.38, '#fff');
  // защёлки
  for (const lx of [x + w * 0.12, x + w * 0.8]) {
    const lg = g.createLinearGradient(lx, 0, lx + w * 0.08, 0); lg.addColorStop(0, '#b9bec4'); lg.addColorStop(0.5, '#eef1f4'); lg.addColorStop(1, '#7d8288');
    g.fillStyle = lg; rr(g, lx, y + h * 0.2, w * 0.08, h * 0.26, 3); g.fill(); g.fillStyle = '#222'; g.fillRect(lx + w * 0.025, y + h * 0.36, w * 0.03, h * 0.05);
  }
  // блик
  const hl = g.createLinearGradient(x, y, x + w * 0.6, y + h); hl.addColorStop(0, 'rgba(255,255,255,0.35)'); hl.addColorStop(0.35, 'rgba(255,255,255,0)');
  g.fillStyle = hl; rr(g, x, y, w, h, H * 0.05); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; rr(g, x, y, w, h, H * 0.05); g.stroke();
  return cv;
}
export function caseIconURL(cs, w = 280, h = 200) {
  const key = 'case|' + cs.id + w;
  if (!iconCache.has(key)) iconCache.set(key, drawCase(mk(w, h), cs).toDataURL());
  return iconCache.get(key);
}
export function shade(hex, t) {
  const [r, g, b] = hexRgb(hex);
  const f = v => Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ---- миниатюра карты ----
export function mapThumbURL(map, px = 5) {
  const key = 'map|' + map.id + px;
  if (iconCache.has(key)) return iconCache.get(key);
  const gr = map.grid, H = gr.length, W = gr[0].length, cv = mk(W * px, H * px), g = cv.getContext('2d'), th = map.theme;
  g.fillStyle = th.void ? '#7fa6c9' : shade(th.wall, -0.45); g.fillRect(0, 0, cv.width, cv.height);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const ch = gr[j][i]; let col = null;
    if (ch === '#') col = shade(th.wall, -0.3);
    else if (ch === 'v') continue;
    else if (ch === 'A' || ch === 'B') col = shade(th.floor, -0.05);
    else if (ch === 'T') col = '#b98b3c';
    else if (ch === 'K') col = '#4f77b5';
    else if (ch === 'c' || ch === 'C') col = th.crate;
    else if (ch === 'R') col = '#8a3b2e';
    else if (ch === 'w') col = '#3f86b5';
    else col = th.floor;
    if (gr.elev && col && col[0] === '#' && ch !== '#') { const e = gr.elev[j * W + i]; if (e) col = shade(col, Math.min(0.45, e * 0.1)); }
    g.fillStyle = col; g.fillRect(i * px, j * px, px, px);
  }
  // буквы точек
  for (const s of ['A', 'B']) {
    let sx = 0, sy = 0, n = 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (gr[j][i] === s) { sx += i; sy += j; n++; }
    if (!n) continue;
    g.font = `bold ${px * 5}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(200,30,30,0.9)'; g.fillText(s, (sx / n + 0.5) * px, (sy / n + 0.5) * px);
  }
  const url = cv.toDataURL(); iconCache.set(key, url); return url;
}

// ---- граффити: эффект баллончика (размытые края, подтёки, обводка) ----
export function drawGraffiti(cv, g0) {
  const g = cv.getContext('2d'), S = cv.width, c = g0.col, R = rng(hashStr(g0.id));
  g.clearRect(0, 0, S, S);
  g.save(); g.translate(S / 2, S / 2); g.scale(S / 256, S / 256);
  const spray = (fn, col, blur = 6, lw = 0) => { g.shadowColor = col; g.shadowBlur = blur; g.fillStyle = col; g.strokeStyle = col; if (lw) g.lineWidth = lw; fn(); g.shadowBlur = 0; };
  const text = (t, size, col, outline = '#111') => {
    g.font = `900 ${size}px Impact, "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = outline; g.strokeText(t, 0, 4);
    spray(() => g.fillText(t, 0, 4), col, 8);
    g.globalAlpha = 0.35; g.fillStyle = '#fff'; g.fillText(t, -3, -2); g.globalAlpha = 1;
  };
  switch (g0.id) {
    case 'cfs': g.rotate(-0.15); text('CFS', 110, c); break;
    case 'gg': g.rotate(-0.1); text('GG', 140, c); break;
    case 'ez': g.rotate(0.12); text('EZ', 140, c); break;
    case 'nice': g.rotate(-0.12); text('NICE', 92, c); break;
    case 'hs': g.rotate(-0.08); spray(() => { g.beginPath(); g.arc(0, -10, 70, 0, 7); g.lineWidth = 12; g.stroke(); g.beginPath(); g.moveTo(-95, -10); g.lineTo(95, -10); g.moveTo(0, -105); g.lineTo(0, 85); g.lineWidth = 8; g.stroke(); }, c, 8); text('HS', 60, '#fff', c); break;
    case 'heart': spray(() => { g.beginPath(); g.moveTo(0, 80); g.bezierCurveTo(-120, -10, -70, -110, 0, -45); g.bezierCurveTo(70, -110, 120, -10, 0, 80); g.fill(); }, c, 10); break;
    case 'crown': spray(() => { g.beginPath(); g.moveTo(-90, 60); g.lineTo(-100, -50); g.lineTo(-45, 0); g.lineTo(0, -80); g.lineTo(45, 0); g.lineTo(100, -50); g.lineTo(90, 60); g.closePath(); g.fill(); }, c, 8); g.fillStyle = '#e03030'; for (const x of [-50, 0, 50]) { g.beginPath(); g.arc(x, 35, 10, 0, 7); g.fill(); } break;
    case 'smile': spray(() => { g.beginPath(); g.arc(0, 0, 95, 0, 7); g.fill(); }, c, 10); g.fillStyle = '#111'; g.beginPath(); g.ellipse(-32, -25, 12, 20, 0, 0, 7); g.ellipse(32, -25, 12, 20, 0, 0, 7); g.fill(); g.lineWidth = 12; g.strokeStyle = '#111'; g.lineCap = 'round'; g.beginPath(); g.arc(0, 5, 55, 0.3, Math.PI - 0.3); g.stroke(); break;
    case 'skull': spray(() => { g.beginPath(); g.arc(0, -20, 80, Math.PI * 0.9, Math.PI * 2.1); g.lineTo(50, 70); g.lineTo(-50, 70); g.closePath(); g.fill(); }, c, 8); g.fillStyle = '#111'; g.beginPath(); g.arc(-32, -15, 22, 0, 7); g.arc(32, -15, 22, 0, 7); g.fill(); g.beginPath(); g.moveTo(0, 15); g.lineTo(-10, 35); g.lineTo(10, 35); g.fill(); for (const x of [-30, -10, 10, 30]) g.fillRect(x - 3, 48, 6, 22); break;
    case 'fire': spray(() => { g.beginPath(); g.moveTo(0, 100); g.bezierCurveTo(-100, 80, -80, -20, -30, -60); g.bezierCurveTo(-30, -20, -10, -10, 0, -110); g.bezierCurveTo(40, -40, 100, 0, 70, 60); g.bezierCurveTo(60, 90, 30, 100, 0, 100); g.fill(); }, c, 12); g.fillStyle = '#ffd23a'; g.beginPath(); g.moveTo(0, 90); g.bezierCurveTo(-45, 70, -30, 10, 0, -20); g.bezierCurveTo(30, 20, 45, 70, 0, 90); g.fill(); break;
  }
  // подтёки краски и брызги
  g.fillStyle = c; g.globalAlpha = 0.85;
  for (let k = 0; k < 6; k++) { const x = (R() - 0.5) * 160, y = 20 + R() * 50, L = 15 + R() * 40; g.fillRect(x, y, 3 + R() * 3, L); g.beginPath(); g.arc(x + 2.5, y + L, 3.5, 0, 7); g.fill(); }
  for (let k = 0; k < 120; k++) { const a = R() * 7, r = 90 + R() * 35; g.globalAlpha = R() * 0.6; g.fillRect(Math.cos(a) * r, Math.sin(a) * r, 2, 2); }
  g.restore(); g.globalAlpha = 1;
  return cv;
}
export function graffitiURL(g0, size = 128) {
  const key = 'gr|' + g0.id + size;
  if (!iconCache.has(key)) iconCache.set(key, drawGraffiti(mk(size, size), g0).toDataURL());
  return iconCache.get(key);
}

// ---- звания (как в CS:GO) ----
export const RANKS = ['Silver I', 'Silver II', 'Silver III', 'Silver IV', 'Silver Elite', 'Silver Elite Master',
  'Gold Nova I', 'Gold Nova II', 'Gold Nova III', 'Gold Nova Master', 'Master Guardian I', 'Master Guardian II',
  'Master Guardian Elite', 'Distinguished Master Guardian', 'Legendary Eagle', 'Legendary Eagle Master', 'Supreme Master First Class', 'The Global Elite'];
export function drawRank(cv, idx) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, s = W / 200;
  g.clearRect(0, 0, W, H); g.save(); g.scale(s, s);
  if (idx < 0) { // без звания
    g.fillStyle = '#2a313b'; rr(g, 20, 20, 160, 60, 10); g.fill(); g.strokeStyle = '#5a6470'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#9aa6b2'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 100, 51); g.restore(); return cv;
  }
  const grp = idx < 6 ? 0 : idx < 10 ? 1 : idx < 14 ? 2 : idx < 16 ? 3 : idx < 17 ? 4 : 5;
  const C = [['#dfe6ec', '#8b98a5', '#3a4652'], ['#ffe08a', '#d4a020', '#5a3a08'], ['#b8dcff', '#3f86d9', '#0e2a52'], ['#e7c8ff', '#9a5ad9', '#2a0e52'], ['#ffd0a0', '#e07a20', '#4a1e05'], ['#ffd0d0', '#e02a2a', '#4a0505']][grp];
  // плашка
  const bg = g.createLinearGradient(0, 15, 0, 85); bg.addColorStop(0, '#2b3440'); bg.addColorStop(1, '#10151b');
  g.fillStyle = bg; rr(g, 12, 15, 176, 70, 12); g.fill();
  g.strokeStyle = C[1]; g.lineWidth = 4; rr(g, 12, 15, 176, 70, 12); g.stroke();
  const metal = g.createLinearGradient(0, 20, 0, 80); metal.addColorStop(0, C[0]); metal.addColorStop(0.55, C[1]); metal.addColorStop(1, C[2]);
  g.fillStyle = metal; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2;
  const chevron = (x, y, w, h) => { g.beginPath(); g.moveTo(x - w, y - h); g.lineTo(x, y); g.lineTo(x + w, y - h); g.lineTo(x + w, y - h + 9); g.lineTo(x, y + 9); g.lineTo(x - w, y - h + 9); g.closePath(); g.fill(); g.stroke(); };
  const star = (x, y, r) => { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr2 = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } g.closePath(); g.fill(); g.stroke(); };
  const wings = () => { for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(100 + sx * 20, 50); for (let k = 0; k < 4; k++) { g.lineTo(100 + sx * (45 + k * 14), 30 + k * 5); g.lineTo(100 + sx * (38 + k * 14), 42 + k * 6); } g.lineTo(100 + sx * 22, 64); g.closePath(); g.fill(); g.stroke(); } };
  if (grp === 0) {
    const n = Math.min(idx + 1, 4);
    if (idx < 4) for (let k = 0; k < n; k++) chevron(100, 40 + k * 10 - (n - 1) * 5, 34, 14);
    else { for (let k = 0; k < 4; k++) chevron(100, 30 + k * 9, 34, 14); if (idx === 5) { star(52, 50, 12); star(148, 50, 12); } else star(100, 72, 9); }
  } else if (grp === 1) {
    const n = idx - 6 + 1; for (let k = 0; k < Math.min(n, 4); k++) star(100 + (k - (Math.min(n, 4) - 1) / 2) * 34, 50, 15);
  } else if (grp === 2) {
    g.beginPath(); g.arc(100, 50, 26, 0, 7); g.fill(); g.stroke();
    g.fillStyle = C[2]; g.beginPath(); g.moveTo(84, 50); g.lineTo(96, 62); g.lineTo(118, 38); g.lineWidth = 5; g.strokeStyle = C[0]; g.stroke(); g.fillStyle = metal; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2;
    const n = idx - 10; for (let k = 0; k < n; k++) star(40 + k * 0 + (k % 2 ? 120 : 0), 50, 10);
    if (idx === 13) { star(100, 26, 9); }
  } else if (grp === 3) { wings(); star(100, 50, 16); if (idx === 15) star(100, 76, 8); }
  else if (grp === 4) { wings(); g.beginPath(); g.arc(100, 50, 18, 0, 7); g.fill(); g.stroke(); star(100, 50, 10); }
  else { wings(); g.beginPath(); g.moveTo(100, 22); g.lineTo(122, 50); g.lineTo(100, 78); g.lineTo(78, 50); g.closePath(); g.fill(); g.stroke(); star(100, 50, 11); }
  g.restore();
  return cv;
}
export function rankURL(idx, w = 120) {
  const key = 'rank|' + idx + '|' + w;
  if (!iconCache.has(key)) iconCache.set(key, drawRank(mk(w, w / 2), idx).toDataURL());
  return iconCache.get(key);
}
