// Мир: сетка карты, геометрия, лучи, навигация
import * as THREE from '../vendor/three.module.min.js';
import { CELL } from './maps.js';
import { rng, shade } from './art.js';

const WALK = new Set(['.', 'w', 'T', 'K', 'A', 'B', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

function texCanvas(kind, base, alt, seed) {
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), R = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  const noise = (n, a, sz = 2) => { for (let i = 0; i < n; i++) { g.fillStyle = R() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`; g.fillRect(R() * S, R() * S, sz, sz); } };
  switch (kind) {
    case 'bricks': {
      const bh = 16, bw = 32; g.strokeStyle = shade(base, -0.35); g.lineWidth = 2;
      for (let y = 0; y < S; y += bh) { const off = (y / bh) % 2 ? bw / 2 : 0;
        for (let x = -bw; x < S; x += bw) { g.fillStyle = R() < 0.3 ? alt : base; g.fillRect(x + off + 1, y + 1, bw - 2, bh - 2); g.strokeRect(x + off, y, bw, bh); } }
      noise(900, 0.06); break;
    }
    case 'plaster': noise(2500, 0.05, 3); g.fillStyle = shade(base, -0.15); for (let i = 0; i < 6; i++) { g.globalAlpha = 0.25; g.beginPath(); g.ellipse(R() * S, R() * S, 10 + R() * 20, 6 + R() * 12, R() * 3, 0, 7); g.fill(); } g.globalAlpha = 1; g.fillStyle = shade(base, -0.3); g.fillRect(0, S - 10, S, 10); break;
    case 'stone': {
      g.strokeStyle = shade(base, -0.4); g.lineWidth = 2;
      for (let y = 0; y < S; y += 21) for (let x = (y / 21 % 2) * 14; x < S; x += 28 + R() * 10) { g.fillStyle = R() < 0.4 ? alt : shade(base, (R() - 0.5) * 0.15); g.fillRect(x, y, 26, 19); g.strokeRect(x, y, 26, 19); }
      noise(1200, 0.07); break;
    }
    case 'panel': {
      g.strokeStyle = shade(base, -0.25); g.lineWidth = 2;
      for (let y = 0; y < S; y += 32) for (let x = 0; x < S; x += 64) { g.fillStyle = shade(base, (R() - 0.5) * 0.08); g.fillRect(x, y, 64, 32); g.strokeRect(x, y, 64, 32); g.fillStyle = shade(base, -0.4); g.fillRect(x + 4, y + 4, 2, 2); g.fillRect(x + 58, y + 4, 2, 2); }
      g.fillStyle = alt; g.fillRect(0, S - 18, S, 6); noise(600, 0.04); break;
    }
    case 'concrete': noise(3000, 0.05, 2); g.strokeStyle = shade(base, -0.2); g.lineWidth = 1; g.strokeRect(0, 0, S, S); g.beginPath(); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke(); break;
    case 'sand': noise(4000, 0.05, 2); for (let i = 0; i < 20; i++) { g.fillStyle = shade(base, -0.12); g.globalAlpha = 0.3; g.fillRect(R() * S, R() * S, 8 + R() * 18, 2); } g.globalAlpha = 1; break;
    case 'tiles': g.strokeStyle = shade(base, -0.25); g.lineWidth = 2; for (let y = 0; y < S; y += 32) for (let x = 0; x < S; x += 32) { g.fillStyle = shade(base, (R() - 0.5) * 0.12); g.fillRect(x, y, 32, 32); g.strokeRect(x, y, 32, 32); } noise(1200, 0.04); break;
    case 'cobble': for (let i = 0; i < 70; i++) { g.fillStyle = shade(base, (R() - 0.5) * 0.25); g.strokeStyle = shade(base, -0.35); g.beginPath(); g.ellipse(R() * S, R() * S, 7 + R() * 6, 5 + R() * 5, R() * 3, 0, 7); g.fill(); g.stroke(); } noise(800, 0.05); break;
    case 'grass': noise(5000, 0.08, 2); g.fillStyle = shade(base, 0.15); for (let i = 0; i < 300; i++) g.fillRect(R() * S, R() * S, 1, 3); break;
    case 'gravel': for (let i = 0; i < 1400; i++) { g.fillStyle = shade(base, (R() - 0.5) * 0.5); g.fillRect(R() * S, R() * S, 2 + R() * 2, 2 + R() * 2); } break;
    case 'wood': g.strokeStyle = shade(base, -0.4); g.lineWidth = 3; g.strokeRect(2, 2, S - 4, S - 4); for (let y = 0; y < S; y += 16) { g.fillStyle = shade(base, (R() - 0.5) * 0.2); g.fillRect(4, y + 1, S - 8, 14); } g.beginPath(); g.moveTo(4, 4); g.lineTo(S - 4, S - 4); g.moveTo(S - 4, 4); g.lineTo(4, S - 4); g.lineWidth = 6; g.stroke(); break;
    case 'metal': noise(1500, 0.05); g.fillStyle = shade(base, -0.25); for (let x = 0; x < S; x += 16) g.fillRect(x, 0, 3, S); break;
    case 'water': { const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, '#2f6f96'); gr.addColorStop(1, '#3f8fb5'); g.fillStyle = gr; g.fillRect(0, 0, S, S); g.strokeStyle = 'rgba(255,255,255,0.15)'; for (let i = 0; i < 12; i++) { g.beginPath(); const y = R() * S; g.moveTo(0, y); g.bezierCurveTo(S / 3, y - 6, S * 2 / 3, y + 6, S, y); g.stroke(); } break; }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

export class World {
  constructor(map, quality = 1) {
    this.map = map; this.quality = quality;
    const grid = map.grid; this.h = grid.length; this.w = grid[0].length;
    this.cells = grid.map(r => r.split(''));
    this.H = new Float32Array(this.w * this.h);
    this.marks = {}; this.sites = { A: [], B: [] }; this.spawns = { T: [], CT: [] };
    const R = rng(map.id.length * 977 + 13);
    const blockH = {};
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const ch = this.cells[j][i], k = j * this.w + i;
      let hh = 0;
      if (ch === '#') { const bk = (i >> 2) + ',' + (j >> 2); if (!(bk in blockH)) blockH[bk] = 4.5 + Math.floor(R() * 4) * 0.8; hh = blockH[bk]; }
      else if (ch === 'c') hh = 1.0; else if (ch === 'C') hh = 2.0; else if (ch === 'R') hh = 3.4; else if (ch === 'v') hh = -60;
      this.H[k] = hh;
      if (ch === 'A' || ch === 'B') this.sites[ch].push([i, j]);
      if (ch === 'T') this.spawns.T.push([i, j]);
      if (ch === 'K') this.spawns.CT.push([i, j]);
      if (ch >= '1' && ch <= '9') this.marks[ch] = [i, j];
    }
    // ящики на точках тоже часть точки
    for (const s of ['A', 'B']) {
      let sx = 0, sz = 0; for (const [i, j] of this.sites[s]) { sx += i; sz += j; }
      const n = this.sites[s].length;
      this.sites[s].center = new THREE.Vector3((sx / n + 0.5) * CELL, 0, (sz / n + 0.5) * CELL);
    }
    this.siteOf = new Uint8Array(this.w * this.h);
    const inRect = (s) => { let x0 = 1e9, x1 = -1, z0 = 1e9, z1 = -1; for (const [i, j] of this.sites[s]) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); z0 = Math.min(z0, j); z1 = Math.max(z1, j); } return [x0, x1, z0, z1]; };
    for (const [s, v] of [['A', 1], ['B', 2]]) { const [x0, x1, z0, z1] = inRect(s); for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) if (this.H[j * this.w + i] >= 0) this.siteOf[j * this.w + i] = v; }
    this.group = new THREE.Group();
    this._build();
  }
  idx(i, j) { return (i < 0 || j < 0 || i >= this.w || j >= this.h) ? -1 : j * this.w + i; }
  hAt(i, j) { const k = this.idx(i, j); return k < 0 ? 99 : this.H[k]; }
  hAtPos(x, z) { return this.hAt(Math.floor(x / CELL), Math.floor(z / CELL)); }
  walk(i, j) { const k = this.idx(i, j); return k >= 0 && this.H[k] === 0; }
  cellCenter(i, j, y = 0) { return new THREE.Vector3((i + 0.5) * CELL, y, (j + 0.5) * CELL); }
  siteAt(x, z) { const k = this.idx(Math.floor(x / CELL), Math.floor(z / CELL)); return k < 0 ? 0 : this.siteOf[k]; }
  inSpawn(x, z, team) { const k = this.idx(Math.floor(x / CELL), Math.floor(z / CELL)); if (k < 0) return false; const ch = this.cells[Math.floor(z / CELL)][Math.floor(x / CELL)]; return ch === (team === 'T' ? 'T' : 'K'); }

  _build() {
    const th = this.map.theme, q = this.quality;
    const wallTex = texCanvas(th.wallTex, th.wall, th.wall2, 1), floorTex = texCanvas(th.floorTex, th.floor, shade(th.floor, -0.1), 2);
    const crateTex = texCanvas('wood', th.crate, th.crate, 3), bigTex = texCanvas('metal', shade(th.crate, -0.1), th.crate, 4), waterTex = texCanvas('water', '#2f6f96', '#3f8fb5', 5);
    const trainTex = texCanvas('metal', '#7a2f25', '#5a1f18', 6);
    const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
    const geo = new THREE.BoxGeometry(CELL, 1, CELL);
    // UV по высоте: повтор текстуры
    const counts = { wall: 0 }, walls = [];
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const hh = this.H[j * this.w + i]; if (hh < 4) continue;
      let exposed = false;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = this.hAt(i + di, j + dj); if (n < 4 && n !== 99) exposed = true; }
      if (exposed) walls.push([i, j, hh]);
    }
    // группируем по высоте для правильного тайлинга текстуры
    const byH = {};
    for (const w of walls) (byH[w[2]] = byH[w[2]] || []).push(w);
    for (const hk in byH) {
      const hh = +hk, list = byH[hk];
      const g2 = geo.clone(); g2.scale(1, hh, 1);
      const uv = g2.attributes.uv; const vrep = hh / CELL;
      for (let f = 0; f < uv.count; f++) { const face = Math.floor(f / 4); if (face !== 2 && face !== 3) uv.setY(f, uv.getY(f) * vrep); }
      const m = new THREE.InstancedMesh(g2, wallMat, list.length);
      const mtx = new THREE.Matrix4();
      list.forEach(([i, j], n) => { mtx.makeTranslation((i + 0.5) * CELL, hh / 2, (j + 0.5) * CELL); m.setMatrixAt(n, mtx); });
      m.receiveShadow = true; m.castShadow = q >= 2;
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
      const mtx = new THREE.Matrix4(); fl.forEach(([i, j], n) => { mtx.makeTranslation((i + 0.5) * CELL, 0, (j + 0.5) * CELL); m.setMatrixAt(n, mtx); });
      m.receiveShadow = true; this.group.add(m);
      // край небоскрёба и город внизу
      const city = new THREE.Group(), R = rng(77), cm = new THREE.MeshLambertMaterial({ color: '#8c99a6' }), cm2 = new THREE.MeshLambertMaterial({ color: '#6d7a88' });
      for (let n = 0; n < 60; n++) { const bh = 20 + R() * 60, bw = 8 + R() * 14; const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw), R() < 0.5 ? cm : cm2); const a = R() * 6.28, r = 60 + R() * 120; b.position.set(fw / 2 + Math.cos(a) * r, -70 + bh / 2, fh / 2 + Math.sin(a) * r); city.add(b); }
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshLambertMaterial({ color: '#5d6a5a' })); ground.rotation.x = -Math.PI / 2; ground.position.set(fw / 2, -70, fh / 2); city.add(ground);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(fw - 4 * CELL, 3, fh - 4 * CELL), new THREE.MeshLambertMaterial({ color: '#7d8287' })); slab.position.set(fw / 2, -1.55, fh / 2); city.add(slab);
      this.group.add(city);
    }
    // вода, ящики, вагоны, цветные спавны
    const addCells = (pred, geoFn, mt) => {
      const list = []; for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) if (pred(this.cells[j][i])) list.push([i, j]);
      if (!list.length) return;
      const g = geoFn(); const m = new THREE.InstancedMesh(g.geo, mt, list.length); const mtx = new THREE.Matrix4();
      list.forEach(([i, j], n) => { mtx.makeTranslation((i + 0.5) * CELL, g.y, (j + 0.5) * CELL); m.setMatrixAt(n, mtx); });
      m.castShadow = q >= 2; m.receiveShadow = true; this.group.add(m);
    };
    addCells(c => c === 'w', () => ({ geo: new THREE.PlaneGeometry(CELL, CELL).rotateX(-Math.PI / 2), y: 0.02 }), new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.9 }));
    addCells(c => c === 'c', () => ({ geo: new THREE.BoxGeometry(CELL * 0.92, 1.0, CELL * 0.92), y: 0.5 }), new THREE.MeshLambertMaterial({ map: crateTex }));
    addCells(c => c === 'C', () => ({ geo: new THREE.BoxGeometry(CELL * 0.98, 2.0, CELL * 0.98), y: 1.0 }), new THREE.MeshLambertMaterial({ map: bigTex }));
    addCells(c => c === 'R', () => ({ geo: new THREE.BoxGeometry(CELL, 3.4, CELL * 0.9), y: 1.7 + 0.0 }), new THREE.MeshLambertMaterial({ map: trainTex }));
    // буквы точек на полу
    for (const s of ['A', 'B']) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
      g.font = 'bold 110px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(190,20,20,0.75)'; g.fillText(s, 64, 70);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const d = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
      d.rotation.x = -Math.PI / 2; const c = this.sites[s].center; d.position.set(c.x, 0.03, c.z); this.group.add(d);
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
    while (open.length && iter++ < 6000) {
      let bi = 0; for (let n = 1; n < open.length; n++) if (open[n][0] < open[bi][0]) bi = n;
      const [, k] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (closed[k]) continue; closed[k] = 1;
      if (k === goal) { found = true; break; }
      const i = k % W, j = (k / W) | 0;
      for (const [di, dj, c] of DIRS) {
        const a = i + di, b = j + dj; if (!this.walk(a, b)) continue;
        if (di && dj && (!this.walk(i + di, j) || !this.walk(i, j + dj))) continue;
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
    for (let s = 0; s <= n; s++) {
      const t = s / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      for (const [ox, oz] of [[0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]]) if (!this.walk(Math.floor((x + ox) / CELL), Math.floor((z + oz) / CELL))) return false;
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
