// Мир: сетка карты, геометрия, лучи, навигация
import * as THREE from '../vendor/three.module.min.js';
import { CELL, setCell } from './maps.js?v=1793206313';
import { rng, shade } from './art.js?v=1793206313';
import { decorate, roofStyle } from './decor.js?v=1793206313';

const WALK = new Set(['.', 'w', 'T', 'K', 'A', 'B', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

// value-noise fbm для «живых» текстур
function makeNoise(S, seed, oct = 4) {
  const R = rng(seed), out = new Float32Array(S * S);
  let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const g = 4 << o, grid = new Float32Array((g + 1) * (g + 1));
    for (let i = 0; i < grid.length; i++) grid[i] = R();
    for (let i = 0; i <= g; i++) { grid[i * (g + 1) + g] = grid[i * (g + 1)]; grid[g * (g + 1) + i] = grid[i]; }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const fx = x / S * g, fy = y / S * g, ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = grid[iy * (g + 1) + ix], b = grid[iy * (g + 1) + ix + 1], c = grid[(iy + 1) * (g + 1) + ix], d = grid[(iy + 1) * (g + 1) + ix + 1];
      out[y * S + x] += amp * ((a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy);
    }
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
function hex2rgb(h) { if (h[0] !== '#') return h.match(/\d+/g).slice(0, 3).map(Number); const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function texCanvas(kind, base, alt, seed) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), R = rng(seed);
  const n1 = makeNoise(S, seed * 7 + 1, 5), n2 = makeNoise(S, seed * 13 + 5, 3);
  const [br, bg, bb] = hex2rgb(base), [ar, ag, ab] = hex2rgb(alt);
  // карта «высот» по шаблону: швы кладки, плитки и т.п. (1 — поверхность, 0 — шов)
  const H = new Float32Array(S * S).fill(1), tint = new Float32Array(S * S);
  const rect = (x0, y0, w, h, gap, t) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const X = ((x % S) + S) % S, Y = ((y % S) + S) % S, e = Math.min(x - x0, y - y0, x0 + w - 1 - x, y0 + h - 1 - y);
      H[Y * S + X] = e < gap ? 0 : Math.min(1, 0.55 + (e - gap) * 0.25); tint[Y * S + X] = t;
    }
  };
  switch (kind) {
    case 'bricks': for (let y = 0, r = 0; y < S; y += 16, r++) for (let x = (r % 2) * 16 - 32; x < S; x += 32) rect(x, y, 32, 16, 1, R()); break;
    case 'stone': for (let y = 0, r = 0; y < S; y += 32, r++) { let x = -R() * 30; while (x < S) { const w = 30 + R() * 30; rect(Math.round(x), y, Math.round(w), 32, 2, R()); x += w; } } break;
    case 'panel': for (let y = 0; y < S; y += 128) for (let x = 0; x < S; x += 128) rect(x, y, 128, 128, 2, R() * 0.4); break;
    case 'tiles': for (let y = 0; y < S; y += 64) for (let x = 0; x < S; x += 64) rect(x, y, 64, 64, 2, R()); break;
    case 'cobble': for (let k = 0; k < 420; k++) { const cx = R() * S, cy = R() * S, rr = 6 + R() * 5, t = R(); for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) { const d = Math.hypot(x, y * 1.2) / rr; if (d < 1) { const X = ((Math.round(cx + x) % S) + S) % S, Y = ((Math.round(cy + y) % S) + S) % S; H[Y * S + X] = d > 0.86 ? 0.5 : 1 - d * d * 0.25; tint[Y * S + X] = t; } } } break;
    case 'wood': for (let y = 0; y < S; y += 32) rect(0, y, S, 32, 2, R()); break;
    case 'metal': for (let x = 0; x < S; x += 32) rect(x, 0, 32, S, 1, R() * 0.3); break;
    case 'concrete': rect(0, 0, S, S, 1, 0.5); break;
    case 'rooftiles': for (let y = 0, r = 0; y < S; y += 16, r++) for (let x = (r % 2) * 8; x < S + 16; x += 16) { for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) { const X = (x + xx) % S, Y = y + yy, c = Math.abs(xx - 7.5) / 8; H[Y * S + X] = yy > 13 ? 0 : 1 - c * c * 0.7 - yy / 60; tint[Y * S + X] = (r * 13 + x) % 7 / 7; } } break;
  }
  const img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, n = n1[i], m = n2[i];
    let h = H[i];
    // освещение рельефа: сравнение с соседом сверху-слева
    const hu = H[((y - 1 + S) % S) * S + ((x - 1 + S) % S)];
    let shade = 0.86 + (h - hu) * 0.3 + (n - 0.5) * 0.32;
    const t = tint[i] * 0.35 + m * 0.3;
    let r = br + (ar - br) * t, gg = bg + (ag - bg) * t, b = bb + (ab - bb) * t;
    if (kind === 'grass') { shade = 0.75 + n * 0.5 + (R() - 0.5) * 0.25; }
    else if (kind === 'sand' || kind === 'gravel') shade = 0.8 + n * 0.35 + (R() - 0.5) * (kind === 'gravel' ? 0.5 : 0.12);
    else if (kind === 'plaster') shade = 0.78 + n * 0.35 + (m > 0.62 ? -(m - 0.62) * 0.8 : 0);
    else if (kind === 'water') { r = 40; gg = 105 + n * 40; b = 140 + n * 50; shade = 1; }
    if (h === 0) shade *= 0.62;
    // грязь: тёмные пятна
    const dirt = Math.max(0, m - 0.6) * 0.9;
    shade *= 1 - dirt;
    { const L = 0.3 * r + 0.59 * gg + 0.11 * b, k = 0.32; r += (L - r) * k; gg += (L - gg) * k; b += (L - b) * k; shade *= 0.92; }
    d[i * 4] = Math.max(0, Math.min(255, r * shade)); d[i * 4 + 1] = Math.max(0, Math.min(255, gg * shade)); d[i * 4 + 2] = Math.max(0, Math.min(255, b * shade)); d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // детали поверх
  if (kind === 'wood') { g.strokeStyle = 'rgba(30,18,8,0.7)'; g.lineWidth = 8; g.strokeRect(4, 4, S - 8, S - 8); g.beginPath(); g.moveTo(8, 8); g.lineTo(S - 8, S - 8); g.stroke(); }
  if (kind === 'concrete' || kind === 'plaster') { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { g.beginPath(); let x = R() * S, y = R() * S; g.moveTo(x, y); for (let j = 0; j < 8; j++) { x += (R() - 0.5) * 30; y += R() * 14; g.lineTo(x, y); } g.stroke(); } }
  if (kind === 'metal') { g.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 16; y < S; y += 64) for (let x = 8; x < S; x += 32) { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); } }
  if (kind === 'panel') { g.fillStyle = alt; g.globalAlpha = 0.7; g.fillRect(0, S - 30, S, 10); g.globalAlpha = 1; }
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 8;
  return tx;
}

// тёмный низ стен: цвет вершин от y0 (тень) до y0+len (полный свет)
function aoColors(geo, y0, len) {
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const t = Math.min(1, Math.max(0, (pos.getY(i) - y0) / len)); const c = 0.5 + 0.5 * Math.sqrt(t); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = c; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

export class World {
  constructor(map, quality = 1) {
    setCell(map.cell || 3);
    this.map = map; this.quality = quality;
    const grid = map.grid; this.h = grid.length; this.w = grid[0].length;
    this.cells = grid.map(r => r.split(''));
    this.H = new Float32Array(this.w * this.h);
    // FL — высота пола клетки (рампы, платформы), W — можно ли ходить
    this.FL = grid.elev ? Float32Array.from(grid.elev) : new Float32Array(this.w * this.h);
    this.W = new Uint8Array(this.w * this.h);
    this.marks = {}; this.sites = { A: [], B: [] }; this.spawns = { T: [], CT: [] };
    const R = rng(map.id.length * 977 + 13);
    const blockH = {};
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const ch = this.cells[j][i], k = j * this.w + i;
      const fl = this.FL[k];
      let hh = fl;
      if (ch === '#') { const bk = (i >> 2) + ',' + (j >> 2); if (!(bk in blockH)) blockH[bk] = 4.5 + Math.floor(R() * 4) * 0.8; hh = blockH[bk]; }
      else if (ch === 'c') hh = fl + 1.0; else if (ch === 'C') hh = fl + 2.0; else if (ch === 'R') hh = fl + 3.4; else if (ch === 'v') hh = -60;
      else this.W[k] = 1;
      this.H[k] = hh;
      if (ch === 'A' || ch === 'B') this.sites[ch].push([i, j]);
      if (ch === 'T') this.spawns.T.push([i, j]);
      if (ch === 'K') this.spawns.CT.push([i, j]);
      if (ch >= '1' && ch <= '9') this.marks[ch] = [i, j];
    }
    // стены всегда выше соседних платформ
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const k = j * this.w + i; if (this.cells[j][i] !== '#') continue;
      let m = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const q = this.idx(i + di, j + dj); if (q >= 0 && this.W[q]) m = Math.max(m, this.FL[q]); }
      this.H[k] += m;
    }
        // ящики на точках тоже часть точки
    for (const s of ['A', 'B']) {
      let sx = 0, sz = 0; for (const [i, j] of this.sites[s]) { sx += i; sz += j; }
      const n = this.sites[s].length;
      // у карт «Напарников» одна точка, у арен — ни одной
      if (!n) { const o = this.sites[s === 'A' ? 'B' : 'A']; this.sites[s].center = null; this.sites[s].alias = o; continue; }
      const ci = Math.round(sx / n - 0.5 + 0.5), cj = Math.round(sz / n);
      this.sites[s].center = new THREE.Vector3((sx / n + 0.5) * CELL, this.FL[this.idx(Math.floor(sx / n), Math.floor(sz / n))] || 0, (sz / n + 0.5) * CELL);
    }
    for (const s of ['A', 'B']) if (!this.sites[s].center) this.sites[s].center = this.sites[s].alias.center || new THREE.Vector3(this.w * CELL / 2, 0, this.h * CELL / 2);
    this.siteOf = new Uint8Array(this.w * this.h);
    const inRect = (s) => { let x0 = 1e9, x1 = -1, z0 = 1e9, z1 = -1; for (const [i, j] of this.sites[s]) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); z0 = Math.min(z0, j); z1 = Math.max(z1, j); } return [x0, x1, z0, z1]; };
    for (const [s, v] of [['A', 1], ['B', 2]]) { const [x0, x1, z0, z1] = inRect(s); for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) if (this.H[j * this.w + i] >= 0) this.siteOf[j * this.w + i] = v; }
    this.group = new THREE.Group();
    this._build();
  }
  idx(i, j) { return (i < 0 || j < 0 || i >= this.w || j >= this.h) ? -1 : j * this.w + i; }
  hAt(i, j) { const k = this.idx(i, j); return k < 0 ? 99 : this.H[k]; }
  hAtPos(x, z) { return this.hAt(Math.floor(x / CELL), Math.floor(z / CELL)); }
  walk(i, j) { const k = this.idx(i, j); return k >= 0 && this.W[k] === 1; }
  fl(i, j) { const k = this.idx(i, j); return k < 0 ? 0 : this.FL[k]; }
  flAt(x, z) { return this.fl(Math.floor(x / CELL), Math.floor(z / CELL)); }
  // можно ли перейти между соседними клетками (ступенька не выше 0.5 м)
  step(i, j, a, b) { return Math.abs(this.fl(i, j) - this.fl(a, b)) <= 0.5; }
  cellCenter(i, j, y) { return new THREE.Vector3((i + 0.5) * CELL, y == null ? this.fl(i, j) : y, (j + 0.5) * CELL); }
  siteAt(x, z) { const k = this.idx(Math.floor(x / CELL), Math.floor(z / CELL)); return k < 0 ? 0 : this.siteOf[k]; }
  inSpawn(x, z, team) { const k = this.idx(Math.floor(x / CELL), Math.floor(z / CELL)); if (k < 0) return false; const ch = this.cells[Math.floor(z / CELL)][Math.floor(x / CELL)]; return ch === (team === 'T' ? 'T' : 'K'); }

  _build() {
    const th = this.map.theme, q = this.quality;
    const wallTex = texCanvas(th.wallTex, th.wall, th.wall2, 1), floorTex = texCanvas(th.floorTex, th.floor, shade(th.floor, -0.1), 2);
    const crateTex = texCanvas('wood', th.crate, shade(th.crate, -0.25), 3), bigTex = texCanvas('metal', shade(th.crate, -0.1), th.crate, 4), waterTex = texCanvas('water', '#2f6f96', '#3f8fb5', 5);
    const trainTex = texCanvas('metal', '#7a2f25', '#5a1f18', 6);
    const wallMat = new THREE.MeshLambertMaterial({ map: wallTex, vertexColors: true });
    // крыши: черепица, мох или плоский бетон
    const rs = roofStyle(this.map);
    const roofTex = rs === 'tiles' ? texCanvas('rooftiles', '#b0583a', '#8a3f24', 8) : rs === 'moss' ? texCanvas('stone', '#66734f', '#4a5a3a', 8) : texCanvas('concrete', shade(th.wall, -0.28), shade(th.wall, -0.4), 8);
    const roofMat = new THREE.MeshLambertMaterial({ map: roofTex, vertexColors: true });
    const wallMats = [wallMat, wallMat, roofMat, wallMat, wallMat, wallMat];
    const geo = new THREE.BoxGeometry(CELL, 1, CELL);
    // UV по высоте: повтор текстуры
    const counts = { wall: 0 }, walls = [];
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const hh = this.H[j * this.w + i]; if (this.cells[j][i] !== '#') continue;
      let exposed = false;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k2 = this.idx(i + di, j + dj); if (k2 >= 0 && this.cells[j + dj][i + di] !== '#') exposed = true; }
      walls.push([i, j, hh]);
    }
    // группируем по высоте для правильного тайлинга текстуры
    const byH = {};
    for (const w of walls) { w[2] = Math.round(w[2] * 2) / 2; (byH[w[2]] = byH[w[2]] || []).push(w); }
    for (const hk in byH) {
      const hh = +hk, list = byH[hk];
      const g2 = geo.clone(); g2.scale(1, hh, 1);
      const uv = g2.attributes.uv; const vrep = hh / CELL;
      for (let f = 0; f < uv.count; f++) { const face = Math.floor(f / 4); if (face !== 2 && face !== 3) uv.setY(f, uv.getY(f) * vrep); }
      aoColors(g2, -hh / 2, 2.6);
      const m = new THREE.InstancedMesh(g2, wallMats, list.length);
      const mtx = new THREE.Matrix4();
      list.forEach(([i, j], n) => { mtx.makeTranslation((i + 0.5) * CELL, hh / 2, (j + 0.5) * CELL); m.setMatrixAt(n, mtx); });
      m.receiveShadow = true; m.castShadow = q >= 1;
      this.group.add(m);
    }
    // пол
    const fw = this.w * CELL, fh = this.h * CELL;
    if (!th.void) {
      floorTex.repeat.set(this.w / 2, this.h / 2);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshLambertMaterial({ map: floorTex }));
      floor.rotation.x = -Math.PI / 2; floor.position.set(fw / 2, 0, fh / 2); floor.receiveShadow = true;
      this.group.add(floor);
    } else {
      // пол только под проходимыми клетками
      const fgeo = new THREE.PlaneGeometry(CELL, CELL).rotateX(-Math.PI / 2);
      const fl = []; for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) if (this.H[j * this.w + i] >= 0) fl.push([i, j]);
      floorTex.repeat.set(1, 1);
      const m = new THREE.InstancedMesh(fgeo, new THREE.MeshLambertMaterial({ map: floorTex }), fl.length);
      const mtx = new THREE.Matrix4(); fl.forEach(([i, j], n) => { mtx.makeTranslation((i + 0.5) * CELL, this.fl(i, j), (j + 0.5) * CELL); m.setMatrixAt(n, mtx); });
      m.receiveShadow = true; this.group.add(m);
      // край небоскрёба и город внизу
      const city = new THREE.Group(), R = rng(77), cm = new THREE.MeshLambertMaterial({ color: '#8c99a6' }), cm2 = new THREE.MeshLambertMaterial({ color: '#6d7a88' });
      for (let n = 0; n < 60; n++) { const bh = 20 + R() * 60, bw = 8 + R() * 14; const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw), R() < 0.5 ? cm : cm2); const a = R() * 6.28, r = 60 + R() * 120; b.position.set(fw / 2 + Math.cos(a) * r, -70 + bh / 2, fh / 2 + Math.sin(a) * r); city.add(b); }
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshLambertMaterial({ color: '#5d6a5a' })); ground.rotation.x = -Math.PI / 2; ground.position.set(fw / 2, -70, fh / 2); city.add(ground);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(fw - 4 * CELL, 3, fh - 4 * CELL), new THREE.MeshLambertMaterial({ color: '#7d8287' })); slab.position.set(fw / 2, -1.55, fh / 2); city.add(slab);
      this.group.add(city);
    }
    // приподнятые площадки, рампы и лестницы: столбики высотой с пол клетки
    {
      const raised = [];
      for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) { const k = j * this.w + i; if (this.cells[j][i] !== '#' && this.cells[j][i] !== 'v' && this.FL[k] > 0.01) raised.push([i, j, this.FL[k]]); }
      if (raised.length) {
        const t2 = floorTex.clone(); t2.needsUpdate = true; t2.repeat.set(0.5, 0.5);
        const sideTex = wallTex.clone(); sideTex.needsUpdate = true; sideTex.repeat.set(1, 0.4);
        const top = new THREE.MeshLambertMaterial({ map: t2 }), side = new THREE.MeshLambertMaterial({ map: sideTex, color: '#d8d0c4' });
        const rg = new THREE.BoxGeometry(CELL, 1, CELL).translate(0, -0.5, 0); aoColors(rg, -1, 1.2);
        top.vertexColors = side.vertexColors = true;
        const m = new THREE.InstancedMesh(rg, [side, side, top, side, side, side], raised.length);
        const mtx = new THREE.Matrix4(), sc = new THREE.Matrix4();
        raised.forEach(([i, j, f], n) => { mtx.makeTranslation((i + 0.5) * CELL, f, (j + 0.5) * CELL); sc.makeScale(1, f, 1); mtx.multiply(sc); m.setMatrixAt(n, mtx); });
        m.receiveShadow = true; m.castShadow = q >= 1; this.group.add(m);
      }
    }
    // вода, ящики, вагоны, цветные спавны
    const addCells = (pred, geoFn, mt) => {
      const list = []; for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) if (pred(this.cells[j][i])) list.push([i, j]);
      if (!list.length) return;
      const g = geoFn(); const m = new THREE.InstancedMesh(g.geo, mt, list.length); const mtx = new THREE.Matrix4();
      list.forEach(([i, j], n) => { mtx.makeTranslation((i + 0.5) * CELL, g.y + this.fl(i, j), (j + 0.5) * CELL); m.setMatrixAt(n, mtx); });
      m.castShadow = q >= 1; m.receiveShadow = true; this.group.add(m);
    };
    addCells(c => c === 'w', () => ({ geo: new THREE.PlaneGeometry(CELL, CELL).rotateX(-Math.PI / 2), y: 0.02 }), new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.9 }));
    addCells(c => c === 'c', () => ({ geo: new THREE.BoxGeometry(CELL * 0.92, 1.0, CELL * 0.92), y: 0.5 }), new THREE.MeshLambertMaterial({ map: crateTex }));
    addCells(c => c === 'C', () => ({ geo: new THREE.BoxGeometry(CELL * 0.98, 2.0, CELL * 0.98), y: 1.0 }), new THREE.MeshLambertMaterial({ map: bigTex }));
    addCells(c => c === 'R', () => ({ geo: new THREE.BoxGeometry(CELL, 3.4, CELL * 0.9), y: 1.7 + 0.0 }), new THREE.MeshLambertMaterial({ map: trainTex }));
    decorate(this, this.group, q);
    // буквы точек на полу
    for (const s of ['A', 'B']) {
      if (!this.sites[s].length) continue;
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
      g.font = 'bold 110px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(190,20,20,0.75)'; g.fillText(s, 64, 70);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const d = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
      d.rotation.x = -Math.PI / 2; const c = this.sites[s].center; d.position.set(c.x, this.flAt(c.x, c.z) + 0.03, c.z); this.group.add(d);
    }
  }

  // Луч по сетке: возвращает дистанцию до стены (или maxD)
  ray(ox, oy, oz, dx, dy, dz, maxD, step = 0.06) {
    let x = ox, y = oy, z = oz;
    for (let t = 0; t < maxD; t += step) {
      x = ox + dx * t; y = oy + dy * t; z = oz + dz * t;
      if (y <= 0) { const k = this.idx(Math.floor(x / CELL), Math.floor(z / CELL)); if (k < 0 || this.H[k] >= 0) return t; }
      const hh = this.hAtPos(x, z);
      if (hh === 99 || y < hh) return t;
      if (y > 40) return maxD;
    }
    return maxD;
  }
  // луч с нормалью поверхности (для следов от пуль)
  rayHit(ox, oy, oz, dx, dy, dz, maxD) {
    const t = this.ray(ox, oy, oz, dx, dy, dz, maxD);
    const n = new THREE.Vector3(0, 1, 0);
    if (t < maxD) {
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t, px = x - dx * 0.07, pz = z - dz * 0.07, py = y - dy * 0.07;
      const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL), pi = Math.floor(px / CELL), pj = Math.floor(pz / CELL);
      const top = this.hAt(ci, cj);
      if (y <= 0.01 || (py >= top - 0.01 && top < 90)) n.set(0, 1, 0);
      else if (ci !== pi) n.set(Math.sign(pi - ci), 0, 0);
      else if (cj !== pj) n.set(0, 0, Math.sign(pj - cj));
    }
    return { t, n };
  }
  // видимость между двумя точками (без учёта дыма)
  los(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    return this.ray(a.x, a.y, a.z, dx / d, dy / d, dz / d, d, 0.12) >= d - 0.13;
  }
  // путь по сетке A* (8 направлений), смягчённый
  path(from, to, blocked) {
    const W = this.w, Hh = this.h;
    let si = Math.floor(from.x / CELL), sj = Math.floor(from.z / CELL), ti = Math.floor(to.x / CELL), tj = Math.floor(to.z / CELL);
    if (!this.walk(ti, tj)) { const n = this.nearestWalk(ti, tj); if (!n) return null; [ti, tj] = n; }
    if (!this.walk(si, sj)) { const n = this.nearestWalk(si, sj); if (!n) return null; [si, sj] = n; }
    const N = W * Hh, gS = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const open = [], start = sj * W + si, goal = tj * W + ti;
    const hf = k => { const i = k % W, j = (k / W) | 0; const dx = Math.abs(i - ti), dz = Math.abs(j - tj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    gS[start] = 0; open.push([hf(start), start]);
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false, iter = 0;
    while (open.length && iter++ < 25000) {
      let bi = 0; for (let n = 1; n < open.length; n++) if (open[n][0] < open[bi][0]) bi = n;
      const [, k] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (closed[k]) continue; closed[k] = 1;
      if (k === goal) { found = true; break; }
      const i = k % W, j = (k / W) | 0;
      for (const [di, dj, c] of DIRS) {
        const a = i + di, b = j + dj; if (!this.walk(a, b) || !this.step(i, j, a, b)) continue;
        if (di && dj && (!this.walk(i + di, j) || !this.walk(i, j + dj) || !this.step(i, j, i + di, j) || !this.step(i, j, i, j + dj))) continue;
        const nk = b * W + a; if (closed[nk]) continue;
        let cost = c;
        // ближе к стенам дороже — боты не трутся об углы
        if (!this.walk(a + 1, b) || !this.walk(a - 1, b) || !this.walk(a, b + 1) || !this.walk(a, b - 1)) cost += 0.35;
        if (blocked && blocked(a, b)) cost += 25;
        const ng = gS[k] + cost;
        if (ng < gS[nk]) { gS[nk] = ng; came[nk] = k; open.push([ng + hf(nk), nk]); }
      }
    }
    if (!found) return null;
    const cells = []; for (let k = goal; k !== -1; k = came[k]) cells.push(k);
    cells.reverse();
    const pts = cells.map(k => this.cellCenter(k % W, (k / W) | 0));
    pts[pts.length - 1] = new THREE.Vector3(to.x, 0, to.z);
    if (!this.walk(Math.floor(to.x / CELL), Math.floor(to.z / CELL))) pts[pts.length - 1] = this.cellCenter(ti, tj);
    // сглаживание: выкидываем точки, если отрезок проходим
    const out = [pts[0]]; let a = 0;
    while (a < pts.length - 1) {
      let b = pts.length - 1;
      while (b > a + 1 && !this.walkLine(pts[a], pts[b])) b--;
      out.push(pts[b]); a = b;
    }
    return out;
  }
  walkLine(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.4);
    let pi = Math.floor(a.x / CELL), pj = Math.floor(a.z / CELL);
    for (let s = 0; s <= n; s++) {
      const t = s / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
      for (const [ox, oz] of [[0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]]) { const a2 = Math.floor((x + ox) / CELL), b2 = Math.floor((z + oz) / CELL); if (!this.walk(a2, b2) || !this.step(ci, cj, a2, b2)) return false; }
      if (s && (pi !== ci || pj !== cj) && !this.step(pi, pj, ci, cj)) return false;
      pi = ci; pj = cj;
    }
    return true;
  }
  nearestWalk(i, j) {
    for (let r = 0; r < 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (this.walk(i + di, j + dj)) return [i + di, j + dj];
    return null;
  }
  randomCell(list, R = Math.random) { const [i, j] = list[Math.floor(R() * list.length)]; return this.cellCenter(i, j); }
  randomWalkIn(list) { const ok = list.filter(([i, j]) => this.walk(i, j)); return this.randomCell(ok.length ? ok : list); }
}
