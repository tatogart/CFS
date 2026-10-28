// Детализация карт: только визуальные объекты, на столкновения и пули не влияют.
// Окна, двери, ставни, карнизы, фонари, навесы, кондиционеры, трубы, провода с бельём,
// деревья, крыши с баками и антеннами, город и горы на горизонте, пятна на полу.
import * as THREE from '../vendor/three.module.min.js';
import { CELL } from './maps.js?v=1793203411';
import { rng, shade } from './art.js?v=1793203411';

// стиль оформления по карте
const STYLE_BY_MAP = { dust2: 'dust', mirage: 'dust', inferno: 'inferno', nuke: 'industrial', overpass: 'park', ancient: 'jungle', anubis: 'egypt', vertigo: 'construction', train: 'industrial', aim: 'indoor', shortdust: 'dust', lake: 'lake', canals: 'inferno', baggage: 'indoor', shoots: 'dust', poolday: 'lake' };
const PAL = {
  dust: { shutters: ['#3f7f9a', '#8a3b2a', '#2f6b4f', '#b98a2e'], awn: [['#c0392b', '#efe6d2'], ['#2a6fa0', '#efe6d2'], ['#d9a53a', '#7a3a1a']], door: '#6b4a2b', tree: 'palm', roof: 'flat', bld: ['#d8bf8a', '#cdb07a', '#e2cfa0'], mtn: '#c9a878' },
  inferno: { shutters: ['#3d6b3a', '#4f7f45', '#6b8a3a'], awn: [['#8a2f2f', '#e8d8b8'], ['#2f5a3a', '#e8d8b8']], door: '#4a3220', tree: 'cypress', roof: 'tiles', bld: ['#c98f62', '#d4a77a', '#b9805a'], mtn: '#8fa07a' },
  industrial: { shutters: ['#5b6670'], awn: [], door: '#4f5a64', tree: 'broad', roof: 'flat', bld: ['#9aa3ab', '#7f8a94', '#b4b9bd'], mtn: '#8a9aa8' },
  park: { shutters: ['#556b4a', '#7a5a3a'], awn: [['#3a5a8a', '#dcdcdc']], door: '#3d4650', tree: 'broad', roof: 'flat', bld: ['#a8a296', '#8f958a', '#bdb6a6'], mtn: '#8a9a7a' },
  jungle: { shutters: ['#5a4a32'], awn: [], door: '#3e3020', tree: 'jungle', roof: 'moss', bld: ['#7f8a6c', '#6c785a'], mtn: '#5f7a5a' },
  egypt: { shutters: ['#2a6f8a', '#8a5a2a'], awn: [['#2a6f8a', '#e8d8a8'], ['#b5442a', '#e8d8a8']], door: '#5a3a1e', tree: 'palm', roof: 'flat', bld: ['#d4b07a', '#c9a46a', '#e0c290'], mtn: '#c8a070' },
  construction: { shutters: ['#6a7480'], awn: [], door: '#505a64', tree: null, roof: 'flat', bld: ['#a9adb1'], mtn: '#9aa8b4' },
  lake: { shutters: ['#f2f2f2', '#3a5a7a'], awn: [['#2a6fa0', '#ffffff'], ['#e05a3a', '#ffffff']], door: '#5a3e26', tree: 'pine', roof: 'tiles', bld: ['#e8e2d6', '#c9b89a'], mtn: '#6f8a6a' },
  indoor: { shutters: ['#5b6670'], awn: [], door: '#45505a', tree: null, roof: 'flat', bld: ['#8a929a'], mtn: '#9aa6b0' },
};

// всё складываем в несколько больших мешей: так быстрее, чем тысячи объектов
class Batch {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.idx = []; this.n = 0; }
  add(geo, m, color) {
    const p = geo.attributes.position, nn = geo.attributes.normal, ix = geo.index;
    const nm = _nm.getNormalMatrix(m), c = _c.set(color);
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(m); this.pos.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(nn, i).applyMatrix3(nm).normalize(); this.nor.push(_v.x, _v.y, _v.z);
      this.col.push(c.r, c.g, c.b);
    }
    if (ix) for (let i = 0; i < ix.count; i++) this.idx.push(ix.getX(i) + this.n);
    else for (let i = 0; i < p.count; i++) this.idx.push(i + this.n);
    this.n += p.count;
  }
  mesh(mat) {
    if (!this.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, mat);
  }
}
const _v = new THREE.Vector3(), _nm = new THREE.Matrix3(), _c = new THREE.Color();
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  cone: new THREE.ConeGeometry(1, 1, 8),
  pyr: new THREE.ConeGeometry(1, 1, 4),
  ball: new THREE.IcosahedronGeometry(1, 0),
  dome: new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  tower: new THREE.CylinderGeometry(0.62, 1, 1, 14, 1, true),
};
function mat4(x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

export function decorate(world, group, quality) {
  const map = world.map, th = map.theme, style = th.props || STYLE_BY_MAP[map.id] || 'dust', P = PAL[style] || PAL.dust;
  const R = rng(map.id.length * 131 + map.id.charCodeAt(0) * 7 + 3);
  const dens = quality >= 2 ? 1 : quality >= 1 ? 0.75 : 0.45;
  const W = world.w, Hh = world.h, cells = world.cells;
  const solid = new Batch(), glow = new Batch(), plant = new Batch();
  const isWall = (i, j) => i < 0 || j < 0 || i >= W || j >= Hh || cells[j][i] === '#';
  const wallC = th.wall, dark = shade(wallC, -0.32), trim = shade(wallC, -0.18), metal = '#7d858c', darkMetal = '#3c4248';
  const pick = a => a[Math.floor(R() * a.length)];

  // ---------- грани стен, обращённые к проходимым клеткам ----------
  const faces = [];
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    if (!world.walk(i, j)) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const wi = i + di, wj = j + dj; if (!isWall(wi, wj) || wi < 0 || wj < 0 || wi >= W || wj >= Hh) continue;
      const nx = -di, nz = -dj, base = world.fl(i, j), top = world.H[wj * W + wi];
      faces.push({ i, j, wi, wj, nx, nz, base, top, h: top - base, x: (wi + 0.5) * CELL + nx * CELL / 2, z: (wj + 0.5) * CELL + nz * CELL / 2, a: Math.atan2(nx, nz) });
    }
  }
  // коробка в локальных координатах грани: u — вдоль стены, y — вверх от пола, d — от стены
  const put = (b, f, u, y, d, w, h, dep, color, rx = 0, geo = GEO.box) => {
    const tx = f.nz, tz = -f.nx;
    b.add(geo, mat4(f.x + tx * u + f.nx * d, f.base + y, f.z + tz * u + f.nz * d, w, h, dep, f.a, rx), color);
  };
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  for (const f of faces) {
    if (f.h < 1.2) continue;
    // плинтус и карниз на каждой грани
    put(solid, f, 0, 0.16, 0.03, CELL, 0.32, 0.07, dark);
    put(solid, f, 0, f.h - 0.1, 0.1, CELL + 0.02, 0.2, 0.22, trim);
    if (f.h > 6) put(solid, f, 0, 4.2, 0.04, CELL, 0.12, 0.09, trim);
    const r = R();
    // окна
    if (f.h >= 3.6 && r < 0.3 * dens) {
      const rows = f.h > 6.4 ? [2.95, 5.2] : [Math.min(2.95, f.h - 1.0)];
      const sh = pick(P.shutters), lit = R() < 0.12;
      for (const y of rows) {
        put(lit ? glow : solid, f, 0, y, 0.01, 0.78, 1.05, 0.03, lit ? '#ffd88a' : '#1c262e');
        put(solid, f, 0, y + 0.57, 0.04, 0.96, 0.09, 0.09, trim); put(solid, f, 0, y - 0.57, 0.06, 1.04, 0.07, 0.18, trim);
        put(solid, f, -0.44, y, 0.04, 0.08, 1.16, 0.08, trim); put(solid, f, 0.44, y, 0.04, 0.08, 1.16, 0.08, trim);
        if (style === 'dust' || style === 'egypt') for (const u of [-0.2, 0, 0.2]) put(solid, f, u, y, 0.05, 0.03, 1.05, 0.03, darkMetal);
        if (style !== 'indoor' && style !== 'construction' && R() < 0.7) { put(solid, f, -0.66, y, 0.04, 0.4, 1.12, 0.04, sh); put(solid, f, 0.66, y, 0.04, 0.4, 1.12, 0.04, sh); }
        if (style === 'inferno' && R() < 0.6) { put(solid, f, 0, y - 0.72, 0.16, 0.84, 0.2, 0.22, '#5a3a22'); for (const u of [-0.3, -0.1, 0.1, 0.3]) put(plant, f, u, y - 0.55, 0.16, 0.16, 0.18, 0.16, R() < 0.5 ? '#c0302a' : '#4f8a3a', 0, GEO.ball); }
      }
    }
    // двери
    else if (f.h >= 2.7 && r < 0.36 * dens) {
      put(solid, f, 0, 1.05, 0.03, 1.0, 2.1, 0.06, P.door);
      put(solid, f, 0, 2.16, 0.06, 1.22, 0.14, 0.12, trim); put(solid, f, -0.55, 1.08, 0.06, 0.11, 2.16, 0.12, trim); put(solid, f, 0.55, 1.08, 0.06, 0.11, 2.16, 0.12, trim);
      put(solid, f, 0, 1.6, 0.065, 0.8, 0.04, 0.02, shade(P.door, -0.3)); put(solid, f, 0, 0.6, 0.065, 0.8, 0.04, 0.02, shade(P.door, -0.3));
      put(solid, f, 0.36, 1.0, 0.08, 0.06, 0.06, 0.06, '#c8a040');
      if (R() < 0.5) { put(solid, f, 0, 2.62, 0.16, 0.08, 0.08, 0.3, darkMetal); put(glow, f, 0, 2.5, 0.3, 0.14, 0.16, 0.14, '#ffe2a0'); }
      if (P.awn.length && f.h > 4 && R() < 0.55) {
        const [c1, c2] = pick(P.awn);
        for (let k = 0; k < 4; k++) put(solid, f, -0.6 + k * 0.4, 3.05, 0.45, 0.4, 0.04, 0.95, k % 2 ? c2 : c1, 0.38);
        put(solid, f, -0.78, 2.9, 0.75, 0.04, 0.04, 0.04, darkMetal); put(solid, f, 0.78, 2.9, 0.75, 0.04, 0.04, 0.04, darkMetal);
      }
    }
    // фонарь на стене
    else if (f.h >= 3 && r < 0.42 * dens) {
      put(solid, f, 0, 2.78, 0.16, 0.05, 0.05, 0.3, darkMetal);
      put(solid, f, 0, 2.68, 0.3, 0.2, 0.06, 0.2, darkMetal);
      put(glow, f, 0, 2.58, 0.3, 0.13, 0.15, 0.13, style === 'indoor' || style === 'industrial' ? '#e8f4ff' : '#ffd890');
    }
    // кондиционер
    else if (f.h >= 4.2 && r < 0.5 * dens && style !== 'jungle') {
      const y = 3.1 + R() * Math.min(1.5, f.h - 4.2);
      put(solid, f, 0, y, 0.24, 0.74, 0.5, 0.44, '#c9ccce'); put(solid, f, 0, y, 0.465, 0.5, 0.32, 0.02, '#6a7076');
      put(solid, f, -0.2, y - 0.3, 0.3, 0.04, 0.12, 0.3, darkMetal); put(solid, f, 0.2, y - 0.3, 0.3, 0.04, 0.12, 0.3, darkMetal);
    }
    // вывески (промзона, помещения)
    else if ((style === 'industrial' || style === 'indoor' || style === 'construction') && f.h >= 3.2 && r < 0.56 * dens) {
      const c = pick(['#c8a020', '#b03030', '#2a6aa8', '#3a8a4a']);
      put(solid, f, 0, 2.7, 0.03, 1.1, 0.5, 0.04, c); put(solid, f, 0, 2.7, 0.05, 0.9, 0.08, 0.02, '#f0f0f0');
    }
    // балконы на высоких стенах: плита, перила, цветы
    if (f.h >= 6 && style !== 'indoor' && style !== 'construction' && hash(f.wi * 3 + 1, f.wj * 7 + 2) < 0.16 * dens) {
      const y = 3.6, rail = style === 'inferno' || style === 'dust' || style === 'egypt' ? darkMetal : trim;
      put(solid, f, 0, y, 0.42, CELL * 0.9, 0.12, 0.84, shade(wallC, -0.08));
      for (const u of [-0.6, -0.3, 0, 0.3, 0.6]) put(solid, f, u, y + 0.42, 0.8, 0.04, 0.72, 0.04, rail);
      put(solid, f, 0, y + 0.8, 0.8, CELL * 0.9, 0.05, 0.06, rail);
      for (const sd of [-1, 1]) put(solid, f, sd * 0.66, y + 0.42, 0.42, 0.04, 0.72, 0.8, rail);
      put(solid, f, 0, y + 1.0, 0.02, 0.7, 1.3, 0.04, '#1c262e');   // дверь на балкон
      if (style === 'inferno' || style === 'lake' || style === 'park') for (const u of [-0.45, 0.4]) { put(solid, f, u, y + 0.16, 0.6, 0.2, 0.2, 0.2, '#8a4a2a'); put(plant, f, u, y + 0.35, 0.6, 0.26, 0.22, 0.26, R() < 0.5 ? '#c0302a' : '#4f8a3a', 0, GEO.ball); }
    }
    // лианы и мох
    if (style === 'jungle' && R() < 0.45) for (let k = 0; k < 3; k++) { const len = 0.8 + R() * Math.min(3, f.h - 0.5); put(plant, f, -0.6 + R() * 1.2, f.h - len / 2, 0.03, 0.07 + R() * 0.08, len, 0.05, R() < 0.5 ? '#3f6a2a' : '#557a35'); }
    // трубы вдоль стен
    if ((style === 'industrial' || style === 'construction' || style === 'indoor') && f.h > 4) {
      if (R() < 0.08) put(solid, f, 0.55, (f.h - 0.4) / 2, 0.12, 0.07, f.h - 0.4, 0.07, metal, 0, GEO.cyl);
    }
  }
  // горизонтальные трубы вдоль длинных стен
  if (style === 'industrial' || style === 'construction' || style === 'indoor') {
    for (const f of faces) {
      if (f.h <= 4 || hash(f.nx ? f.wi : f.wj, f.nx * 3 + f.nz) >= 0.3) continue;
      const tx = f.nz, tz = -f.nx;
      solid.add(GEO.cyl, mat4(f.x + f.nx * 0.18, f.base + 3.6, f.z + f.nz * 0.18, 0.09, CELL + 0.02, 0.09, Math.atan2(tx, tz), Math.PI / 2), hash(f.wi, 7) < 0.5 ? '#8a6a3a' : metal);
    }
  }

  // ---------- кусты и горшки с растениями у стен ----------
  {
    const bushCols = { jungle: ['#3d6b2a', '#2f5a24', '#4f7f32'], park: ['#4f7a35', '#5f8a3e', '#46702f'], lake: ['#3f6f3a', '#4f7f42', '#2f5a2e'], inferno: ['#4a6e32', '#3e5e2a', '#5a7a3a'], egypt: ['#6a7a3a', '#7a8a4a'], dust: ['#7a7a42', '#8a8048', '#6a6a3a'] }[style];
    if (bushCols) for (const f of faces) {
      if (f.h < 1.2 || cells[f.j][f.i] === 'w' || hash(f.i * 5 + f.nx, f.j * 3 + f.nz) > 0.11 * dens) continue;
      const tx = f.nz, tz = -f.nx, u = (hash(f.i, f.j) - 0.5) * 0.8, n = 2 + Math.floor(hash(f.j, f.i) * 3);
      if (style === 'dust' || style === 'egypt' ? hash(f.i + 9, f.j) < 0.5 : hash(f.i + 9, f.j) < 0.25) {
        // глиняный горшок с кустом
        const x = f.x + tx * u + f.nx * 0.35, z = f.z + tz * u + f.nz * 0.35;
        solid.add(GEO.cyl, mat4(x, f.base + 0.22, z, 0.24, 0.44, 0.24), style === 'inferno' ? '#a5502f' : '#9a6a3a');
        plant.add(GEO.ball, mat4(x, f.base + 0.62, z, 0.36, 0.34, 0.36, R() * 6), pick(bushCols));
      } else for (let k = 0; k < n; k++) {
        const uu = u + (k - n / 2) * 0.32, d = 0.3 + R() * 0.15, sc = 0.28 + R() * 0.2;
        plant.add(GEO.ball, mat4(f.x + tx * uu + f.nx * d, f.base + sc * 0.75, f.z + tz * uu + f.nz * d, sc * 1.2, sc, sc * 1.1, R() * 6), pick(bushCols));
      }
    }
  }

  // ---------- провода, бельё и гирлянды над узкими улицами ----------
  if (style !== 'indoor') {
    for (let j = 1; j < Hh - 1; j++) for (let i = 0; i < W - 2; i++) {
      for (const dir of [[1, 0], [0, 1]]) {
        if (!isWall(i, j) || isWall(i + dir[0], j + dir[1])) continue;
        let k = 1; while (k < 9 && !isWall(i + dir[0] * k, j + dir[1] * k)) k++;
        if (k < 3 || k >= 9 || R() > 0.07 * dens || i + dir[0] * k >= W || j + dir[1] * k >= Hh) continue;
        const ai = i, aj = j, bi = i + dir[0] * k, bj = j + dir[1] * k;
        const top = Math.min(world.H[aj * W + ai], world.H[bj * W + bi]) - 0.5; if (top < 3.6) continue;
        const x0 = (ai + 0.5 + dir[0] * 0.5) * CELL, z0 = (aj + 0.5 + dir[1] * 0.5) * CELL, x1 = (bi + 0.5 - dir[0] * 0.5) * CELL, z1 = (bj + 0.5 - dir[1] * 0.5) * CELL;
        const n = 8, L = Math.hypot(x1 - x0, z1 - z0), sag = 0.25 + L * 0.04, ry = Math.atan2(x1 - x0, z1 - z0);
        const pt = t => [x0 + (x1 - x0) * t, top - Math.sin(t * Math.PI) * sag, z0 + (z1 - z0) * t];
        for (let s = 0; s < n; s++) {
          const [ax, ay, az] = pt(s / n), [bx, by, bz] = pt((s + 1) / n), len = Math.hypot(bx - ax, by - ay, bz - az);
          solid.add(GEO.box, mat4((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, 0.03, 0.03, len, ry, -Math.atan2(by - ay, Math.hypot(bx - ax, bz - az))), '#1f1f1f');
        }
        const kind = style === 'inferno' || style === 'lake' ? (R() < 0.6 ? 'laundry' : 'lights') : style === 'dust' || style === 'egypt' ? (R() < 0.4 ? 'laundry' : 'wire') : 'wire';
        if (kind === 'laundry') for (let t = 0.15; t < 0.9; t += 0.12 + R() * 0.1) { const [x, y, z] = pt(t); plant.add(GEO.box, mat4(x, y - 0.3, z, 0.42 + R() * 0.2, 0.55 + R() * 0.25, 0.02, ry + Math.PI / 2), pick(['#e8e2d6', '#c0392b', '#2a6fa0', '#e0b040', '#3a8a4a', '#f0f0f0', '#a04a8a'])); }
        if (kind === 'lights') for (let t = 0.1; t < 0.95; t += 0.1) { const [x, y, z] = pt(t); glow.add(GEO.ball, mat4(x, y - 0.08, z, 0.07, 0.07, 0.07), pick(['#ffd890', '#ffb060', '#fff2c0'])); }
      }
    }
  }

  // ---------- крыши: баки, антенны, трубы, деревья за стенами ----------
  const interior = (i, j) => { for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (!isWall(i + di, j + dj)) return false; return true; };
  const deep = (i, j) => { for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (!isWall(i + di, j + dj)) return false; return true; };
  const treeC = { palm: 0.035, cypress: 0.05, broad: 0.05, jungle: 0.13, pine: 0.11 }[P.tree] || 0;
  for (let j = 1; j < Hh - 1; j++) for (let i = 1; i < W - 1; i++) {
    if (!isWall(i, j) || !interior(i, j)) continue;
    const top = world.H[j * W + i], x = (i + 0.5) * CELL, z = (j + 0.5) * CELL, r = R();
    if (treeC && r < treeC * dens) { tree(P.tree, x + (R() - 0.5) * CELL * 0.6, z + (R() - 0.5) * CELL * 0.6, top + 1.5 + R() * 4.5); continue; }
    if (style === 'indoor' || style === 'jungle') continue;
    if (r < treeC + 0.012 * dens) { // бак на ножках
      for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) solid.add(GEO.box, mat4(x + dx, top + 0.4, z + dz, 0.07, 0.8, 0.07), darkMetal);
      solid.add(GEO.cyl, mat4(x, top + 1.35, z, 0.65, 1.1, 0.65), style === 'dust' || style === 'egypt' ? '#3a3a3a' : '#9aa3ab');
    } else if (r < treeC + 0.022 * dens) { // антенна
      solid.add(GEO.cyl, mat4(x, top + 1.3, z, 0.03, 2.6, 0.03), darkMetal);
      for (let k = 0; k < 3; k++) solid.add(GEO.box, mat4(x, top + 1.6 + k * 0.4, z, 0.9 - k * 0.2, 0.03, 0.03, R() * 3), darkMetal);
    } else if (r < treeC + 0.034 * dens) { // дымоход / короб
      solid.add(GEO.box, mat4(x, top + 0.6, z, 0.6, 1.2, 0.6), shade(wallC, -0.1)); solid.add(GEO.box, mat4(x, top + 1.25, z, 0.8, 0.1, 0.8), dark);
    } else if (r < treeC + 0.044 * dens) { // спутниковая тарелка
      solid.add(GEO.dome, mat4(x, top + 0.9, z, 0.5, 0.18, 0.5, R() * 6, 1.1), '#e8e8e8'); solid.add(GEO.box, mat4(x, top + 0.45, z, 0.06, 0.9, 0.06), darkMetal);
    } else if (r < treeC + 0.06 * dens && deep(i, j) && style !== 'construction') { // надстройка на крыше
      const hh = 1.4 + R() * 2.2, w = CELL * (1.2 + R()), d = CELL * (1.2 + R());
      solid.add(GEO.box, mat4(x, top + hh / 2, z, w, hh, d), shade(wallC, (R() - 0.5) * 0.15));
      if (P.roof === 'tiles') solid.add(GEO.pyr, mat4(x, top + hh + 0.5, z, w * 0.75, 1.0, d * 0.75, Math.PI / 4), '#a5502f');
      else if (style === 'dust' || style === 'egypt') { if (R() < 0.35) solid.add(GEO.dome, mat4(x, top + hh, z, w * 0.4, w * 0.4, w * 0.4), shade(wallC, 0.15)); }
    }
  }
  function tree(kind, x, z, h) {
    if (kind === 'palm') {
      const seg = 6, lean = (R() - 0.5) * 0.5, ry = R() * 6.28;
      for (let s = 0; s < seg; s++) { const t = s / seg, y = h * (t + 0.5 / seg); solid.add(GEO.cyl, mat4(x + Math.sin(ry) * lean * t * t * h * 0.2, y, z + Math.cos(ry) * lean * t * t * h * 0.2, 0.2 - t * 0.06, h / seg + 0.05, 0.2 - t * 0.06), s % 2 ? '#7a5a3a' : '#6a4c30'); }
      const tx = x + Math.sin(ry) * lean * h * 0.2, tz = z + Math.cos(ry) * lean * h * 0.2;
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28 + R() * 0.3; plant.add(GEO.box, mat4(tx + Math.sin(a) * 1.1, h - 0.2, tz + Math.cos(a) * 1.1, 0.5, 0.05, 2.4, a, 0.35 + R() * 0.2), R() < 0.5 ? '#4a7a2e' : '#5f8a35'); }
    } else if (kind === 'cypress') {
      solid.add(GEO.cyl, mat4(x, h * 0.2, z, 0.14, h * 0.4, 0.14), '#5a4030');
      plant.add(GEO.cone, mat4(x, h * 0.62, z, 0.9, h * 0.8, 0.9), '#2f4f2a');
    } else if (kind === 'pine') {
      solid.add(GEO.cyl, mat4(x, h * 0.25, z, 0.16, h * 0.5, 0.16), '#5a4030');
      for (let k = 0; k < 3; k++) plant.add(GEO.cone, mat4(x, h * (0.45 + k * 0.17), z, 1.6 - k * 0.4, h * 0.32, 1.6 - k * 0.4), k % 2 ? '#2e5a34' : '#355f3a');
    } else {
      solid.add(GEO.cyl, mat4(x, h * 0.3, z, 0.2, h * 0.6, 0.2), '#5a4632');
      const n = kind === 'jungle' ? 4 : 3;
      for (let k = 0; k < n; k++) plant.add(GEO.ball, mat4(x + (R() - 0.5) * 1.6, h * (0.7 + R() * 0.25), z + (R() - 0.5) * 1.6, 1.3 + R() * 0.9, 1.0 + R() * 0.7, 1.3 + R() * 0.9, R() * 6), pick(kind === 'jungle' ? ['#3d6b2a', '#2f5a24', '#4f7f32'] : ['#4f7a35', '#5f8a3e', '#46702f']));
    }
  }

  // ---------- город и горы за пределами карты ----------
  const fw = W * CELL, fh = Hh * CELL, cx = fw / 2, cz = fh / 2;
  if (!th.void) {
    const sky = new Batch();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ color: shade(th.floor, -0.25) }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -0.05, cz); group.add(ground);
    const ring = (n, r0, r1, fn) => { for (let k = 0; k < n; k++) { const a = R() * 6.28, rr = r0 + R() * (r1 - r0); fn(cx + Math.cos(a) * (Math.max(fw, fh) / 2 + rr), cz + Math.sin(a) * (Math.max(fw, fh) / 2 + rr), a); } };
    const nB = Math.round((style === 'jungle' || style === 'lake' ? 40 : 110) * dens);
    ring(nB, 6, 70, (x, z, a) => {
      if (x > -2 && x < fw + 2 && z > -2 && z < fh + 2) return;
      const h = 5 + R() * (style === 'industrial' || style === 'construction' ? 22 : 12), w = 6 + R() * 12, d = 6 + R() * 12, c = pick(P.bld);
      sky.add(GEO.box, mat4(x, h / 2, z, w, h, d, a), c);
      if (P.roof === 'tiles') sky.add(GEO.pyr, mat4(x, h + 1.4, z, w * 0.72, 2.8, d * 0.72, a + Math.PI / 4), '#a5502f');
      else if ((style === 'dust' || style === 'egypt') && R() < 0.25) sky.add(GEO.dome, mat4(x, h, z, w * 0.35, w * 0.35, w * 0.35), shade(c, 0.12));
      if (h > 9) sky.add(GEO.box, mat4(x, h * 0.55, z, w + 0.1, 0.25, d + 0.1, a), shade(c, -0.2));
    });
    if (P.tree) ring(Math.round((style === 'jungle' || style === 'lake' ? 160 : 45) * dens), 4, 80, (x, z) => { if (x > -2 && x < fw + 2 && z > -2 && z < fh + 2) return; tree(P.tree, x, z, 5 + R() * 9); });
    // ориентиры: градирни, башни, купола
    if (style === 'industrial') for (let k = 0; k < 3; k++) { const a = R() * 6.28, r = Math.max(fw, fh) / 2 + 60 + R() * 40, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; sky.add(GEO.tower, mat4(x, 22, z, 16, 44, 16), '#c9cdd0'); }
    if (style === 'inferno' || style === 'lake') { const a = R() * 6.28, r = Math.max(fw, fh) / 2 + 45, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; sky.add(GEO.box, mat4(x, 14, z, 5, 28, 5), style === 'lake' ? '#e8e2d6' : '#c98f62'); sky.add(GEO.pyr, mat4(x, 30, z, 4, 4, 4, Math.PI / 4), '#a5502f'); }
    if (style === 'dust' || style === 'egypt') for (let k = 0; k < 2; k++) { const a = R() * 6.28, r = Math.max(fw, fh) / 2 + 50 + R() * 30, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; sky.add(GEO.cyl, mat4(x, 13, z, 1.6, 26, 1.6), '#e2cfa0'); sky.add(GEO.dome, mat4(x, 26, z, 2.2, 2.6, 2.2), '#d8bf8a'); sky.add(GEO.dome, mat4(x + 12, 10, z, 9, 9, 9), '#c9a86a'); sky.add(GEO.box, mat4(x + 12, 5, z, 16, 10, 16), '#d8bf8a'); }
    if (style === 'construction' || style === 'industrial') { const a = R() * 6.28, r = Math.max(fw, fh) / 2 + 55, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; sky.add(GEO.box, mat4(x, 25, z, 1.4, 50, 1.4), '#d4a020'); sky.add(GEO.box, mat4(x + 10, 50, z, 30, 1.2, 1.2), '#d4a020'); }
    const sm = sky.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); if (sm) group.add(sm);
    // горы вдали: заранее смешаны с цветом тумана, сам туман на них не действует
    const fogC = new THREE.Color(th.fog).lerp(new THREE.Color('#9aa3ab'), 0.45), mtn = new Batch();
    for (let k = 0; k < 18; k++) {
      const a = k / 18 * 6.28 + R() * 0.3, r = 330 + R() * 60, h = 30 + R() * 50, w = 70 + R() * 70;
      mtn.add(GEO.cone, mat4(cx + Math.cos(a) * r, h / 2 - 2, cz + Math.sin(a) * r, w, h, w * 0.7, R() * 6), '#' + new THREE.Color(P.mtn).lerp(fogC, 0.55 + R() * 0.15).getHexString());
    }
    const mm = mtn.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })); if (mm) group.add(mm);
  }

  // ---------- пятна, трещины, листья на полу ----------
  const decalTex = kind => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'), r2 = rng(kind.length * 17 + 5);
    if (kind === 'stain') { for (let k = 0; k < 14; k++) { const x = 64 + (r2() - 0.5) * 60, y = 64 + (r2() - 0.5) * 60, rr = 10 + r2() * 26; const gr = g.createRadialGradient(x, y, 1, x, y, rr); gr.addColorStop(0, 'rgba(30,24,16,.35)'); gr.addColorStop(1, 'rgba(30,24,16,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); } }
    if (kind === 'crack') { g.strokeStyle = 'rgba(20,16,12,.6)'; g.lineWidth = 1.5; for (let k = 0; k < 3; k++) { g.beginPath(); let x = 64, y = 64; g.moveTo(x, y); for (let s = 0; s < 9; s++) { x += (r2() - 0.5) * 26; y += (r2() - 0.5) * 26; g.lineTo(x, y); } g.stroke(); } }
    if (kind === 'leaves') { for (let k = 0; k < 40; k++) { g.fillStyle = ['rgba(120,90,40,.8)', 'rgba(90,110,40,.8)', 'rgba(140,70,30,.8)'][k % 3]; g.save(); g.translate(20 + r2() * 88, 20 + r2() * 88); g.rotate(r2() * 6); g.beginPath(); g.ellipse(0, 0, 5, 2.5, 0, 0, 7); g.fill(); g.restore(); } }
    if (kind === 'drain') { g.fillStyle = 'rgba(40,44,48,.95)'; g.beginPath(); g.arc(64, 64, 34, 0, 7); g.fill(); g.strokeStyle = 'rgba(90,96,102,.9)'; g.lineWidth = 4; g.stroke(); g.lineWidth = 2; for (let k = -24; k <= 24; k += 8) { g.beginPath(); g.moveTo(40, 64 + k); g.lineTo(88, 64 + k); g.stroke(); } }
    if (kind === 'sand') { for (let k = 0; k < 10; k++) { const x = 64 + (r2() - 0.5) * 50, y = 64 + (r2() - 0.5) * 50, rr = 14 + r2() * 24; const gr = g.createRadialGradient(x, y, 1, x, y, rr); gr.addColorStop(0, 'rgba(225,200,150,.55)'); gr.addColorStop(1, 'rgba(225,200,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); } }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const kinds = ['stain', 'crack', style === 'dust' || style === 'egypt' ? 'sand' : 'leaves', 'drain'];
  const spots = { stain: [], crack: [], sand: [], leaves: [], drain: [] };
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    if (!world.walk(i, j) || cells[j][i] === 'w') continue;
    const nearWall = isWall(i + 1, j) || isWall(i - 1, j) || isWall(i, j + 1) || isWall(i, j - 1);
    const r = R();
    if (r < (nearWall ? 0.09 : 0.03) * dens) spots[kinds[nearWall ? (R() < 0.6 ? 0 : 2) : Math.floor(R() * 3)]].push([i, j]);
    else if (r < 0.005 + (nearWall ? 0.09 : 0.03) * dens && !nearWall) spots.drain.push([i, j]);
  }
  for (const k of kinds) {
    const list = spots[k]; if (!list.length) continue;
    const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: decalTex(k), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), list.length);
    list.forEach(([i, j], n) => { const s = k === 'drain' ? 0.9 : 1.4 + R() * 2.2; m.setMatrixAt(n, mat4((i + 0.5 + (R() - 0.5) * 0.4) * CELL, world.fl(i, j) + 0.012, (j + 0.5 + (R() - 0.5) * 0.4) * CELL, s, 1, s, R() * 6.28)); });
    m.renderOrder = 1; group.add(m);
  }

  // ---------- ящики, контейнеры и вагоны: рамы, рёбра, колёса ----------
  {
    const crate = th.crate || '#8a6a44', cd = shade(crate, -0.35), cm = shade(crate, -0.2);
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const ch = cells[j][i], x = (i + 0.5) * CELL, z = (j + 0.5) * CELL, fl = world.fl(i, j);
      if (ch === 'c') {
        const h = 1.0, w = CELL * 0.92, e = w / 2 - 0.04;
        for (const [dx, dz] of [[-e, -e], [e, -e], [-e, e], [e, e]]) solid.add(GEO.box, mat4(x + dx, fl + h / 2, z + dz, 0.1, h + 0.01, 0.1), cd);
        for (const [dx, dz, sx, sz] of [[0, -e, w, 0.1], [0, e, w, 0.1], [-e, 0, 0.1, w], [e, 0, 0.1, w]]) { solid.add(GEO.box, mat4(x + dx, fl + h - 0.04, z + dz, sx, 0.09, sz), cd); solid.add(GEO.box, mat4(x + dx, fl + 0.05, z + dz, sx, 0.09, sz), cd); }
      } else if (ch === 'C') {
        const h = 2.0, w = CELL * 0.98;
        for (let k = 1; k < 4; k++) for (const [dx, dz, sx, sz] of [[0, -w / 2, w, 0.06], [0, w / 2, w, 0.06], [-w / 2, 0, 0.06, w], [w / 2, 0, 0.06, w]]) solid.add(GEO.box, mat4(x + dx, fl + h * k / 4, z + dz, sx + 0.02, 0.07, sz + 0.02), cm);
        solid.add(GEO.box, mat4(x, fl + h + 0.02, z, w * 0.9, 0.04, w * 0.9), cm);
      } else if (ch === 'R') {
        const h = 3.4, dw = CELL * 0.9;
        const horiz = (cells[j][i - 1] === 'R' || cells[j][i + 1] === 'R');
        const [sx, sz] = horiz ? [CELL + 0.01, dw + 0.06] : [dw + 0.06, CELL + 0.01];
        solid.add(GEO.box, mat4(x, fl + 0.3, z, sx, 0.6, sz), '#1f2226');
        solid.add(GEO.box, mat4(x, fl + h - 0.12, z, sx, 0.2, sz), shade('#7a2f25', -0.3));
        solid.add(GEO.box, mat4(x, fl + 1.9, z, sx * (horiz ? 1 : 1.01), 0.5, sz * (horiz ? 1.01 : 1)), '#2a3238');
        const along = horiz ? [1, 0] : [0, 1], side = horiz ? [0, 1] : [1, 0];
        for (const sd of [-1, 1]) solid.add(GEO.cyl, mat4(x + side[0] * sd * (dw / 2 - 0.05), fl + 0.42, z + side[1] * sd * (dw / 2 - 0.05), 0.42, 0.18, 0.42, horiz ? 0 : Math.PI / 2, Math.PI / 2), '#141618');
      }
    }
  }

  // ---------- буквы точек на стенах (как в CS) ----------
  for (const site of ['A', 'B']) {
    const S = world.sites[site]; if (!S.length) continue;
    const c = S.center, near = faces.filter(f => f.h > 2.6 && Math.hypot(f.x - c.x, f.z - c.z) < 16).sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z));
    const used = [];
    for (const f of near) {
      if (used.length >= 3) break;
      if (used.some(u => Math.hypot(u.x - f.x, u.z - f.z) < 9)) continue;
      used.push(f);
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
      g.font = 'bold 112px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(180,20,20,.9)'; g.fillText(site, 64, 70);
      g.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 140; k++) { g.globalAlpha = Math.random() * 0.5; g.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 5, 1 + Math.random() * 3); }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.set(f.x + f.nx * 0.03, f.base + 1.9, f.z + f.nz * 0.03); m.rotation.y = f.a; group.add(m);
    }
  }

  // ---------- сборка ----------
  const sm = solid.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (sm) { sm.castShadow = quality >= 2; sm.receiveShadow = true; group.add(sm); }
  const pm = plant.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  if (pm) { pm.castShadow = quality >= 2; group.add(pm); }
  const gm = glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
  if (gm) group.add(gm);
  return { style };
}

export function styleOf(map) { return map.theme.props || STYLE_BY_MAP[map.id] || 'dust'; }
// стиль крыш для world.js
export function roofStyle(map) { const st = map.theme.props || STYLE_BY_MAP[map.id] || 'dust'; return (PAL[st] || PAL.dust).roof; }
