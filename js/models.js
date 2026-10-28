// 3D-модели: агенты (человечки с IK-руками), оружие
import * as THREE from '../vendor/three.module.min.js';
import { patternCanvas, DEFAULT_PAT } from './art.js?v=1793206313';
import { skinById, WEAPONS, KNIVES } from './data.js?v=1793206313';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}
const texCache = new Map();
export function skinMaterial(skinId, fallback) {
  const key = skinId || ('def:' + fallback);
  if (texCache.has(key)) return texCache.get(key);
  const pat = skinId && skinById[skinId] ? skinById[skinId].pat : DEFAULT_PAT[fallback] || DEFAULT_PAT.rifle;
  const tex = new THREE.CanvasTexture(patternCanvas(pat, 256, 128));
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const m = new THREE.MeshLambertMaterial({ map: tex });
  texCache.set(key, m); return m;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const geoCache = new Map();
const G = (key, fn) => { if (!geoCache.has(key)) geoCache.set(key, fn()); return geoCache.get(key); };

// ---------- ОРУЖИЕ ----------
// Ствол смотрит в -Z, начало координат — рукоять (место правой руки).
// Возвращает группу и точку для левой руки (foregrip) и дульного среза (muzzle)
const W3D = {
  ak47: { parts: [[0, 0.04, -0.85, 0.028, 0.028, 0.05, 'd'], [0, 0.072, -0.04, 0.044, 0.012, 0.3, 'd'], [0, 0.074, -0.22, 0.03, 0.022, 0.04, 'd'], [0, -0.14, -0.155, 0.033, 0.08, 0.06, 'b', -0.75], [0, -0.035, -0.04, 0.012, 0.04, 0.05, 'd'], [0.028, 0.035, -0.08, 0.004, 0.03, 0.1, 'd'], [0, 0.02, 0.33, 0.05, 0.11, 0.025, 'd'], [0, 0.03, -0.12, 0.05, 0.075, 0.36, 'b'], [0, 0.02, 0.2, 0.045, 0.07, 0.26, 'w'], [0, 0.035, -0.4, 0.05, 0.06, 0.2, 'w'], [0, 0.04, -0.66, 0.018, 0.018, 0.34, 'd'], [0, 0.085, -0.38, 0.016, 0.016, 0.22, 'd'], [0, 0.085, -0.72, 0.01, 0.04, 0.01, 'd'], [0, -0.06, -0.12, 0.035, 0.14, 0.07, 'b', -0.35], [0, -0.05, 0.01, 0.035, 0.1, 0.045, 'd', 0.25]], fore: [0, -0.01, -0.4], muzzle: [0, 0.04, -0.84] },
  galil: { parts: [[0, 0.04, -0.85, 0.026, 0.026, 0.05, 'd'], [0, 0.072, -0.1, 0.04, 0.012, 0.26, 'd'], [0, 0.085, -0.62, 0.008, 0.035, 0.008, 'd'], [0, 0.03, -0.12, 0.05, 0.075, 0.36, 'b'], [0, 0.02, 0.19, 0.03, 0.05, 0.24, 'd'], [0, 0.035, -0.42, 0.05, 0.06, 0.22, 'b'], [0, 0.04, -0.68, 0.018, 0.018, 0.32, 'd'], [0, -0.06, -0.12, 0.035, 0.15, 0.07, 'b', -0.3], [0, -0.05, 0.01, 0.035, 0.1, 0.045, 'd', 0.25]], fore: [0, -0.01, -0.42], muzzle: [0, 0.04, -0.85] },
  m4a4: { parts: [[0, 0.035, -0.81, 0.026, 0.026, 0.05, 'd'], [0, 0.065, -0.38, 0.06, 0.01, 0.24, 'd'], [0.03, 0.035, -0.38, 0.006, 0.04, 0.22, 'd'], [-0.03, 0.035, -0.38, 0.006, 0.04, 0.22, 'd'], [0, 0.1, 0.0, 0.02, 0.03, 0.03, 'd'], [0, -0.035, -0.03, 0.012, 0.04, 0.05, 'd'], [0.03, 0.04, -0.02, 0.006, 0.02, 0.06, 'd'], [0, 0.03, -0.1, 0.05, 0.08, 0.34, 'b'], [0, 0.02, 0.22, 0.045, 0.08, 0.2, 'b'], [0, 0.03, 0.08, 0.025, 0.025, 0.12, 'd'], [0, 0.085, -0.1, 0.03, 0.02, 0.3, 'd'], [0, 0.035, -0.38, 0.055, 0.06, 0.24, 'b'], [0, 0.035, -0.64, 0.018, 0.018, 0.3, 'd'], [0, 0.085, -0.5, 0.012, 0.05, 0.012, 'd'], [0, -0.07, -0.1, 0.035, 0.15, 0.06, 'b', -0.12], [0, -0.05, 0.01, 0.035, 0.1, 0.045, 'd', 0.25]], fore: [0, -0.01, -0.38], muzzle: [0, 0.035, -0.8] },
  famas: { parts: [[0, 0.03, -0.64, 0.024, 0.024, 0.04, 'd'], [0, -0.02, -0.38, 0.02, 0.03, 0.08, 'd'], [0.03, 0.04, -0.15, 0.004, 0.04, 0.3, 'd'], [0, 0.03, -0.1, 0.055, 0.09, 0.62, 'b'], [0, 0.1, -0.12, 0.02, 0.02, 0.44, 'd'], [0, 0.08, 0.06, 0.02, 0.04, 0.02, 'd'], [0, 0.08, -0.3, 0.02, 0.04, 0.02, 'd'], [0, 0.03, -0.52, 0.018, 0.018, 0.22, 'd'], [0, -0.05, 0.12, 0.035, 0.1, 0.06, 'b'], [0, -0.05, 0.0, 0.035, 0.1, 0.045, 'd', 0.2]], fore: [0, -0.01, -0.3], muzzle: [0, 0.03, -0.64] },
  awp: { parts: [[0, 0.04, -0.99, 0.03, 0.03, 0.06, 'd'], [0.04, 0.05, -0.02, 0.05, 0.012, 0.012, 'd'], [0.065, 0.05, -0.02, 0.015, 0.015, 0.015, 'd', 0, 'sph'], [0, 0.11, -0.1, 0.012, 0.03, 0.03, 'd'], [0, 0.03, -0.08, 0.055, 0.08, 0.36, 'b'], [0, 0.02, 0.26, 0.05, 0.1, 0.3, 'b'], [0, 0.04, -0.66, 0.02, 0.02, 0.62, 'd'], [0, 0.11, -0.1, 0.035, 0.035, 0.3, 'd', 0, 'cyl'], [0, 0.11, -0.28, 0.05, 0.05, 0.06, 'd', 0, 'cyl'], [0, 0.11, 0.06, 0.045, 0.045, 0.05, 'd', 0, 'cyl'], [0, -0.04, -0.08, 0.04, 0.09, 0.08, 'b'], [0, -0.05, 0.03, 0.035, 0.1, 0.045, 'd', 0.25]], fore: [0, -0.01, -0.36], muzzle: [0, 0.04, -0.98] },
  mp9: { parts: [[0, 0.03, -0.35, 0.026, 0.026, 0.03, 'd'], [0, 0.075, -0.08, 0.03, 0.012, 0.2, 'd'], [0, 0.0, -0.02, 0.012, 0.04, 0.05, 'd'], [0, 0.03, -0.06, 0.05, 0.08, 0.3, 'b'], [0, 0.03, -0.26, 0.022, 0.022, 0.14, 'd'], [0, -0.04, -0.17, 0.025, 0.08, 0.025, 'd'], [0, -0.08, -0.02, 0.03, 0.15, 0.045, 'b'], [0, 0.05, 0.16, 0.02, 0.02, 0.16, 'd']], fore: [0, -0.06, -0.17], muzzle: [0, 0.03, -0.34] },
  mac10: { parts: [[0, 0.03, -0.33, 0.026, 0.026, 0.03, 'd'], [0, 0.082, -0.02, 0.012, 0.012, 0.18, 'd'], [0.03, 0.04, -0.06, 0.005, 0.03, 0.08, 'd'], [0, 0.03, -0.05, 0.055, 0.09, 0.26, 'b'], [0, 0.03, -0.24, 0.022, 0.022, 0.14, 'd'], [0, -0.08, 0.0, 0.035, 0.16, 0.05, 'b']], fore: [0, 0.0, -0.2], muzzle: [0, 0.03, -0.32] },
  glock: { parts: [[0, 0.083, -0.14, 0.008, 0.01, 0.01, 'd'], [0.016, 0.065, 0.0, 0.003, 0.02, 0.06, 'd'], [0, -0.005, -0.035, 0.01, 0.03, 0.035, 'd'], [0, 0.06, -0.06, 0.03, 0.04, 0.19, 'b'], [0, 0.03, -0.06, 0.028, 0.025, 0.17, 'd'], [0, -0.03, 0, 0.03, 0.11, 0.05, 'b', 0.25]], fore: [0, -0.03, 0.02], muzzle: [0, 0.06, -0.16] },
  usp: { parts: [[0, 0.083, -0.14, 0.008, 0.01, 0.01, 'd'], [0.016, 0.065, 0.0, 0.003, 0.02, 0.06, 'd'], [0, -0.005, -0.035, 0.01, 0.03, 0.035, 'd'], [0, 0.06, -0.06, 0.03, 0.04, 0.19, 'b'], [0, 0.06, -0.24, 0.032, 0.032, 0.17, 'd', 0, 'cyl'], [0, 0.03, -0.06, 0.028, 0.025, 0.17, 'd'], [0, -0.03, 0, 0.03, 0.11, 0.05, 'b', 0.25]], fore: [0, -0.03, 0.02], muzzle: [0, 0.06, -0.33] },
  deagle: { parts: [[0, 0.092, -0.17, 0.01, 0.012, 0.01, 'd'], [0, 0.092, 0.03, 0.02, 0.012, 0.01, 'd'], [0.019, 0.07, -0.02, 0.003, 0.02, 0.06, 'd'], [0, -0.01, -0.03, 0.01, 0.03, 0.04, 'd'], [0, 0.065, -0.07, 0.035, 0.05, 0.24, 'b'], [0, 0.03, -0.07, 0.032, 0.03, 0.2, 'd'], [0, -0.035, 0, 0.034, 0.12, 0.055, 'b', 0.25]], fore: [0, -0.03, 0.02], muzzle: [0, 0.065, -0.2] },
  knife: { parts: [[0, 0.0, 0.03, 0.03, 0.03, 0.11, 'd'], [0, 0.0, -0.03, 0.05, 0.04, 0.012, 'd'], [0, 0.005, -0.12, 0.006, 0.035, 0.17, 'b']], fore: [0, -0.05, 0.1], muzzle: [0, 0, -0.2] },
  he: { parts: [[0, 0.03, -0.03, 0.07, 0.07, 0.07, 'b', 0, 'sph']], fore: [0, -0.05, 0.1], muzzle: [0, 0, -0.05] },
  flash: { parts: [[0, 0.03, -0.03, 0.05, 0.11, 0.05, 'b', 0, 'cylv']], fore: [0, -0.05, 0.1], muzzle: [0, 0, -0.05] },
  smoke: { parts: [[0, 0.03, -0.03, 0.055, 0.11, 0.055, 'b', 0, 'cylv']], fore: [0, -0.05, 0.1], muzzle: [0, 0, -0.05] },
  molotov: { parts: [[0, 0.02, -0.03, 0.06, 0.1, 0.06, 'b', 0, 'cylv'], [0, 0.1, -0.03, 0.025, 0.07, 0.025, 'b', 0, 'cylv']], fore: [0, -0.05, 0.1], muzzle: [0, 0, -0.05] },
  c4: { parts: [[0, 0.02, -0.05, 0.12, 0.06, 0.18, 'b']], fore: [0, -0.03, -0.1], muzzle: [0, 0, -0.1] },
};
// новые стволы — на основе похожих моделей с доп. деталями
{
  const P = (base, extra, o = {}) => ({ parts: [...W3D[base].parts, ...extra], fore: o.fore || W3D[base].fore, muzzle: o.muzzle || W3D[base].muzzle });
  W3D.p250 = P('glock', [[0, 0.06, -0.15, 0.022, 0.022, 0.03, 'd']]);
  W3D.fiveseven = P('glock', [[0, 0.085, 0.03, 0.02, 0.012, 0.012, 'd'], [0, 0.06, -0.16, 0.028, 0.028, 0.04, 'b']], { muzzle: [0, 0.06, -0.19] });
  W3D.tec9 = { parts: [[0, 0.05, -0.08, 0.034, 0.05, 0.24, 'b'], [0, 0.05, -0.24, 0.02, 0.02, 0.1, 'd'], [0, -0.04, -0.12, 0.03, 0.12, 0.04, 'b', -0.1], [0, -0.03, 0.01, 0.03, 0.1, 0.045, 'd', 0.25]], fore: [0, -0.06, -0.12], muzzle: [0, 0.05, -0.3] };
  W3D.ump45 = P('mp9', [[0, 0.02, 0.2, 0.03, 0.06, 0.18, 'd'], [0, -0.07, -0.12, 0.035, 0.13, 0.05, 'b', -0.2]], { muzzle: [0, 0.03, -0.36] });
  W3D.mp7 = P('mp9', [[0, 0.09, -0.08, 0.02, 0.012, 0.22, 'd'], [0, -0.05, -0.22, 0.02, 0.07, 0.025, 'd']]);
  W3D.p90 = { parts: [[0, 0.02, -0.05, 0.06, 0.09, 0.42, 'b'], [0, 0.09, -0.08, 0.035, 0.03, 0.3, 'd'], [0, 0.03, -0.3, 0.02, 0.02, 0.1, 'd'], [0, -0.05, -0.04, 0.03, 0.08, 0.05, 'd', 0.2], [0, 0.075, -0.06, 0.04, 0.012, 0.22, 'b']], fore: [0, -0.02, -0.18], muzzle: [0, 0.03, -0.36] };
  W3D.nova = { parts: [[0, 0.02, 0.2, 0.045, 0.09, 0.26, 'w'], [0, 0.03, -0.05, 0.05, 0.07, 0.2, 'b'], [0, 0.05, -0.45, 0.022, 0.022, 0.6, 'd'], [0, 0.015, -0.32, 0.045, 0.045, 0.24, 'w'], [0, 0.0, -0.5, 0.02, 0.02, 0.36, 'd'], [0, -0.05, 0.01, 0.035, 0.1, 0.045, 'd', 0.25]], fore: [0, -0.02, -0.32], muzzle: [0, 0.05, -0.76] };
  W3D.xm1014 = { parts: [[0, 0.02, 0.22, 0.04, 0.08, 0.22, 'b'], [0, 0.03, -0.05, 0.05, 0.08, 0.26, 'b'], [0, 0.05, -0.45, 0.022, 0.022, 0.56, 'd'], [0, 0.015, -0.4, 0.024, 0.024, 0.5, 'd'], [0, -0.05, 0.01, 0.035, 0.1, 0.045, 'd', 0.25]], fore: [0, -0.02, -0.32], muzzle: [0, 0.05, -0.74] };
  W3D.negev = { parts: [[0, 0.02, 0.22, 0.04, 0.08, 0.22, 'd'], [0, 0.03, -0.08, 0.07, 0.11, 0.4, 'b'], [0, 0.04, -0.55, 0.026, 0.026, 0.5, 'd'], [0.0, -0.08, -0.08, 0.06, 0.12, 0.12, 'b'], [0.03, -0.08, -0.62, 0.008, 0.16, 0.008, 'd', 0.4], [-0.03, -0.08, -0.62, 0.008, 0.16, 0.008, 'd', 0.4], [0, -0.05, 0.03, 0.035, 0.1, 0.045, 'd', 0.25]], fore: [0, -0.02, -0.34], muzzle: [0, 0.04, -0.82] };
  W3D.m4a1s = P('m4a4', [[0, 0.035, -0.86, 0.034, 0.034, 0.2, 'd', 0, 'cyl']], { muzzle: [0, 0.035, -0.97] });
  W3D.sg553 = P('ak47', [[0, 0.12, -0.12, 0.032, 0.032, 0.2, 'd', 0, 'cyl'], [0, 0.12, -0.24, 0.045, 0.045, 0.04, 'd', 0, 'cyl']]);
  W3D.aug = P('famas', [[0, 0.13, -0.12, 0.034, 0.034, 0.24, 'd', 0, 'cyl'], [0, 0.13, -0.26, 0.046, 0.046, 0.04, 'd', 0, 'cyl']]);
  W3D.ssg08 = P('awp', [[0, 0.02, 0.26, 0.04, 0.07, 0.26, 'd']]);
  W3D.g3sg1 = P('galil', [[0, 0.12, -0.1, 0.034, 0.034, 0.28, 'd', 0, 'cyl'], [0, 0.12, -0.26, 0.048, 0.048, 0.05, 'd', 0, 'cyl']]);
  W3D.scar20 = P('m4a4', [[0, 0.13, -0.1, 0.034, 0.034, 0.28, 'd', 0, 'cyl'], [0, 0.13, -0.26, 0.048, 0.048, 0.05, 'd', 0, 'cyl']]);
}
for (const k of ['karambit', 'butterfly', 'bayonet', 'flip', 'gut', 'huntsman', 'falchion', 'talon', 'kukri', 'skeleton', 'stiletto', 'ursus', 'bowie']) W3D[k] = W3D.knife;
const NADE_COLORS = { he: '#3d5a2a', flash: '#9aa0a6', smoke: '#5d6b74', molotov: '#4a7a3a', c4: '#6b5a3a' };

export function buildWeapon(id, skinId) {
  const def = W3D[id] || W3D.knife;
  const grp = new THREE.Group();
  const isKnife = id === 'knife' || !!KNIVES[id];
  const bodyMat = NADE_COLORS[id] ? mat(NADE_COLORS[id]) : skinMaterial(skinId, isKnife ? 'knife' : 'rifle');
  const woodMat = skinId ? bodyMat : (id === 'ak47' ? skinMaterial(null, 'wood') : bodyMat);
  const dark = mat('#1d1f22');
  if (isKnife) return buildKnife(id, bodyMat, dark, grp, def);
  for (const p of def.parts) {
    const [x, y, z, w, h, d, k, rot = 0, shape] = p;
    let geo;
    if (shape === 'cyl') { geo = G('cyl' + w + d, () => new THREE.CylinderGeometry(w / 2, w / 2, d, 10).rotateX(Math.PI / 2)); }
    else if (shape === 'cylv') { geo = G('cylv' + w + h, () => new THREE.CylinderGeometry(w / 2, w / 2, h, 10)); }
    else if (shape === 'sph') { geo = G('sph' + w, () => new THREE.SphereGeometry(w / 2, 10, 8)); }
    else if (k === 'd' && w <= 0.025 && Math.abs(w - h) < 0.004 && d > w * 3) geo = G('cb' + w + d, () => new THREE.CylinderGeometry(w / 2, w / 2, d, 10).rotateX(Math.PI / 2));
    else geo = G(`b${w}_${h}_${d}`, () => box(w, h, d));
    const m = new THREE.Mesh(geo, k === 'd' ? dark : k === 'w' ? woodMat : bodyMat);
    m.position.set(x, y, z); m.rotation.x = rot; grp.add(m);
    // магазин: деталь под ствольной коробкой перед рукояткой (для анимации перезарядки)
    if (k !== 'w' && y < -0.035 && z < -0.03 && z > -0.42 && h >= 0.05 && w <= 0.06) m.userData.mag = true;
  }
  grp.userData.fore = new THREE.Vector3(...def.fore);
  grp.userData.muzzle = new THREE.Vector3(...def.muzzle);
  return grp;
}

// ---------- НОЖИ: настоящие формы клинков (вытянутый контур) ----------
// контур задаётся в плоскости (u — вперёд по клинку, v — вверх), толщина — по X
function bladeGeo(key, pts, depth, bevel = 0.0012) {
  return G('blade_' + key, () => {
    const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1 });
    g.translate(0, 0, -depth / 2); g.rotateY(Math.PI / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6 + 0.5, uv.getY(i) * 6 + 0.5);
    g.computeVertexNormals(); return g;
  });
}
const arc = (cu, cv, r, a0, a1, n) => { const o = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; o.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r]); } return o; };
function buildKnife(id, blade, dark, grp, def) {
  const grip = mat('#2a2b2e'), metal = mat('#8d939a');
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); grp.add(o); return o; };
  const rod = (w, h, d) => G(`b${w}_${h}_${d}`, () => box(w, h, d));
  if (id === 'karambit' || id === 'talon') {
    // изогнутый коготь
    const big = id === 'talon' ? 1.2 : 1;
    const outer = arc(0.0, -0.075 * big, 0.08 * big, 90, -28, 14), inner = arc(0.0, -0.075 * big, 0.055 * big, -12, 95, 12);
    add(bladeGeo(id, [[-0.012, 0.004], ...outer, ...inner, [-0.012, -0.02]], 0.004), blade);
    add(rod(0.022, 0.03, 0.1), grip, 0, -0.006, 0.055);
    for (const z of [0.02, 0.05, 0.08]) add(rod(0.024, 0.032, 0.006), dark, 0, -0.006, z);
    const ring = add(G('karring', () => new THREE.TorusGeometry(0.02, 0.006, 8, 18).rotateY(Math.PI / 2)), metal, 0, -0.008, 0.125);
    ring.userData.ring = true;
  } else if (id === 'butterfly') {
    add(bladeGeo('bfly', [[0, -0.011], [0.12, -0.011], [0.155, 0.0], [0.13, 0.006], [0.1, 0.011], [0, 0.011]], 0.0035), blade, 0, 0, -0.005);
    // две рукояти с прорезями
    for (const sx of [-1, 1]) { const h = new THREE.Group(); h.position.set(sx * 0.009, 0, 0); grp.add(h);
      const m = new THREE.Mesh(rod(0.007, 0.026, 0.12), metal); m.position.z = 0.06; h.add(m);
      for (let k = 0; k < 4; k++) { const sl = new THREE.Mesh(rod(0.008, 0.008, 0.016), dark); sl.position.set(0, 0, 0.025 + k * 0.026); h.add(sl); }
      h.userData.handle = sx; }
    add(G('bpin', () => new THREE.CylinderGeometry(0.004, 0.004, 0.026, 8).rotateZ(Math.PI / 2)), metal, 0, 0, 0.003);
  } else if (id === 'kukri' || id === 'bowie') {
    // тяжёлые клинки: кукри с изгибом вниз, боуи с обухом-«щучкой» и гардой
    const wood = mat(id === 'kukri' ? '#4a2e1a' : '#5a3a22'), brass = mat('#c8a040');
    const pts = id === 'kukri'
      ? [[0, -0.012], [0.05, -0.02], [0.1, -0.032], [0.15, -0.04], [0.185, -0.03], [0.195, -0.012], [0.175, -0.004], [0.13, -0.012], [0.08, -0.0], [0.04, 0.01], [0, 0.014]]
      : [[0, -0.016], [0.14, -0.016], [0.195, -0.002], [0.17, 0.008], [0.145, 0.005], [0.115, 0.017], [0, 0.017]];
    add(bladeGeo(id, pts, 0.005), blade).userData.blade = true;
    if (id === 'bowie') add(rod(0.018, 0.07, 0.008), brass, 0, 0.0, 0.004); else add(rod(0.016, 0.04, 0.008), brass, 0, 0, 0.004);
    add(G('hgrip_' + id, () => new THREE.CylinderGeometry(0.0145, id === 'kukri' ? 0.019 : 0.016, 0.105, 10).rotateX(Math.PI / 2)), wood, 0, -0.003, 0.062);
    add(G('hpom', () => new THREE.SphereGeometry(0.016, 10, 8)), id === 'kukri' ? metal : brass, 0, -0.003, 0.118);
    for (const z of [0.035, 0.09]) add(G('kring', () => new THREE.CylinderGeometry(0.0175, 0.0175, 0.006, 10).rotateX(Math.PI / 2)), brass, 0, -0.003, z);
  } else if (id === 'skeleton') {
    // рукоять-скелет: две полосы стали и кольцо, обмотка паракордом
    add(bladeGeo(id, [[0, -0.012], [0.1, -0.012], [0.145, 0.0], [0.115, 0.011], [0, 0.012]], 0.0045), blade).userData.blade = true;
    for (const sy of [-1, 1]) add(rod(0.006, 0.006, 0.1), metal, 0, sy * 0.011 - 0.002, 0.055);
    add(rod(0.006, 0.028, 0.008), metal, 0, -0.002, 0.004);
    add(G('skring', () => new THREE.TorusGeometry(0.017, 0.004, 8, 18).rotateY(Math.PI / 2)), metal, 0, -0.002, 0.118).userData.ring = true;
    const cord = mat('#7a1a1a'); for (let k = 0; k < 5; k++) add(rod(0.008, 0.03, 0.006), cord, 0, -0.002, 0.03 + k * 0.016);
  } else if (id === 'stiletto' || id === 'ursus') {
    // складные: клинок на оси, может раскладываться
    const pts = id === 'stiletto' ? [[0, -0.007], [0.15, -0.004], [0.178, 0], [0.15, 0.005], [0, 0.007]] : [[0, -0.013], [0.11, -0.013], [0.135, -0.004], [0.152, 0.011], [0, 0.013]];
    const piv = new THREE.Group(); piv.position.set(0, 0, 0.0); grp.add(piv); piv.userData.fold = true;
    const bl = new THREE.Mesh(bladeGeo(id, pts, id === 'stiletto' ? 0.004 : 0.0045), blade); piv.add(bl);
    const hm = mat(id === 'stiletto' ? '#3a2a22' : '#1e2226');
    add(rod(0.013, id === 'stiletto' ? 0.02 : 0.028, 0.115), hm, 0, -0.002, 0.06);
    for (const sx of [-1, 1]) add(rod(0.002, id === 'stiletto' ? 0.022 : 0.03, 0.11), metal, sx * 0.0075, -0.002, 0.062);
    add(G('fpin', () => new THREE.CylinderGeometry(0.004, 0.004, 0.018, 8).rotateZ(Math.PI / 2)), metal, 0, 0, 0.004);
    if (id === 'stiletto') { add(rod(0.016, 0.03, 0.005), metal, 0, -0.002, 0.004); add(rod(0.015, 0.021, 0.008), metal, 0, -0.002, 0.118); }
  } else {
    // штык-нож, складной, крюк, охотничий, фальшион, обычный нож
    const big = id === 'bayonet' || id === 'huntsman';
    const L = big ? 0.17 : 0.13, H = big ? 0.016 : 0.014;
    const shapes = {
      flip: [[0, -0.012], [0.11, -0.012], [0.145, -0.002], [0.12, 0.01], [0, 0.012]],
      gut: [[0, -0.013], [0.11, -0.013], [0.15, 0.0], [0.125, 0.012], [0.1, 0.012], [0.09, 0.003], [0.076, 0.012], [0, 0.013]],
      huntsman: [[0, -0.017], [0.13, -0.017], [0.18, 0], [0.14, 0.016], [0, 0.016]],
      falchion: [[0, -0.012], [0.1, -0.014], [0.15, -0.006], [0.172, 0.014], [0.14, 0.008], [0.1, 0.012], [0, 0.012]],
    };
    add(bladeGeo(id, shapes[id] || [[0, -H], [L * 0.82, -H], [L, -0.002], [L * 0.86, H * 0.45], [L * 0.6, H], [0, H]], 0.0045), blade);
    if (id === 'huntsman') for (let k = 0; k < 6; k++) add(rod(0.005, 0.005, 0.006), dark, 0, 0.018, -0.03 - k * 0.012);
    if (id !== 'flip') add(rod(0.006, 0.004, L * 0.6), dark, 0, H * 0.35, -L * 0.35);
    add(rod(0.016, 0.06, 0.012), metal, 0, -0.004, 0.004);
    add(G('kgrip' + big, () => new THREE.CylinderGeometry(0.015, 0.017, 0.11, 10).rotateX(Math.PI / 2)), grip, 0, -0.004, 0.065);
    for (const z of [0.03, 0.06, 0.09]) add(G('kring', () => new THREE.CylinderGeometry(0.0175, 0.0175, 0.006, 10).rotateX(Math.PI / 2)), dark, 0, -0.004, z);
    add(rod(0.02, 0.024, 0.012), metal, 0, -0.004, 0.122);
  }
  // клинок смотрит вперёд (-Z), рукоять — назад к ладони
  grp.userData.fore = new THREE.Vector3(...def.fore);
  grp.userData.muzzle = new THREE.Vector3(...def.muzzle);
  grp.userData.knife = id;
  return grp;
}

// ---------- АГЕНТЫ ----------
const UPPER = 0.29, LOWER = 0.28, THIGH = 0.44, SHIN = 0.44;
function capsule(r, len, m) {
  const g = G(`cap${r}_${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 8));
  return new THREE.Mesh(g, m);
}
function addHeadgear(head, kind, c) {
  const S = (r, col, sx = 1, sy = 1, sz = 1, part = 1) => { const m = new THREE.Mesh(G(`hs${r}${part}`, () => new THREE.SphereGeometry(r, 14, 10, 0, Math.PI * 2, 0, Math.PI * part)), mat(col)); m.scale.set(sx, sy, sz); head.add(m); return m; };
  const B = (w, h, d, col, x, y, z) => { const m = new THREE.Mesh(G(`b${w}_${h}_${d}`, () => box(w, h, d)), mat(col)); m.position.set(x, y, z); head.add(m); return m; };
  const eyes = () => { B(0.03, 0.018, 0.01, '#111', -0.04, 0.02, -0.108); B(0.03, 0.018, 0.01, '#111', 0.04, 0.02, -0.108); };
  switch (kind) {
    case 'balaclava': S(0.122, c.head, 0.95, 1.08, 1); B(0.12, 0.035, 0.02, c.skin, 0, 0.02, -0.11); eyes(); break;
    case 'bandana': eyes(); S(0.124, c.head, 0.96, 1.0, 1, 0.42); B(0.2, 0.09, 0.05, c.head, 0, -0.06, -0.09); break;
    case 'cap': eyes(); S(0.125, c.head, 0.97, 1, 1, 0.45); B(0.16, 0.012, 0.1, c.head, 0, 0.03, -0.14); B(0.13, 0.04, 0.02, '#2a1a10', 0, -0.07, -0.105); break;
    case 'beanie': eyes(); S(0.126, c.head, 0.97, 1.12, 1, 0.5); B(0.2, 0.03, 0.2, c.accent, 0, 0.045, 0).visible = false; break;
    case 'gasmask': {
      S(0.122, c.head, 0.96, 1.06, 1);
      const mk = new THREE.Mesh(G('gm', () => new THREE.CylinderGeometry(0.05, 0.065, 0.08, 10).rotateX(Math.PI / 2)), mat('#222'));
      mk.position.set(0, -0.05, -0.12); head.add(mk);
      for (const sx of [-1, 1]) {
        const f = new THREE.Mesh(G('gf', () => new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10)), mat(c.accent));
        f.position.set(sx * 0.07, -0.07, -0.1); f.rotation.z = sx * 1.1; head.add(f);
        const l = new THREE.Mesh(G('gl', () => new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12).rotateX(Math.PI / 2)), mat('#4a6070', { emissive: '#0a1218' }));
        l.position.set(sx * 0.045, 0.025, -0.115); head.add(l);
      }
      break;
    }
    case 'helmet': eyes(); S(0.142, c.head, 1, 0.92, 1.05, 0.5).position.y = 0.02; B(0.18, 0.01, 0.03, '#111', 0, 0.06, -0.135); B(0.13, 0.04, 0.02, '#111', 0, -0.06, -0.105); break;
    case 'visor': S(0.142, c.head, 1, 0.92, 1.05, 0.5).position.y = 0.02; B(0.2, 0.11, 0.015, '#1b2a3a', 0, -0.01, -0.135).material = mat('#203245', { transparent: true, opacity: 0.85 }); break;
    case 'goggles': S(0.142, c.head, 1, 0.92, 1.05, 0.5).position.y = 0.02; B(0.17, 0.045, 0.03, '#111', 0, 0.03, -0.12); B(0.05, 0.03, 0.01, '#3a7aa0', -0.04, 0.03, -0.136); B(0.05, 0.03, 0.01, '#3a7aa0', 0.04, 0.03, -0.136); for (const sx of [-1, 1]) B(0.03, 0.07, 0.06, c.accent, sx * 0.13, -0.01, 0); break;
    default: eyes();
  }
}

export class AgentModel {
  constructor(agent, weaponId = 'ak47', skinId = null) {
    const c = agent.c;
    this.c = c;
    const root = this.root = new THREE.Group();
    const hips = this.hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
    const pants = mat(c.pants), shirt = mat(c.shirt), vest = mat(c.vest), skinM = mat(c.skin), glove = mat(c.glove), boots = mat(c.boots);
    const pelvis = new THREE.Mesh(G('pelvis', () => box(0.34, 0.18, 0.22)), pants); pelvis.position.y = 0.0; hips.add(pelvis);
    const belt = new THREE.Mesh(G('belt', () => box(0.35, 0.04, 0.23)), mat('#1a1a1a')); belt.position.y = 0.08; hips.add(belt);
    // торс
    const torso = this.torso = new THREE.Group(); torso.position.y = 0.08; hips.add(torso);
    const chest = new THREE.Mesh(G('chest', () => new THREE.CylinderGeometry(0.2, 0.17, 0.5, 10).scale(1, 1, 0.62)), shirt); chest.position.y = 0.27; torso.add(chest);
    const vestM = new THREE.Mesh(G('vest', () => box(0.4, 0.38, 0.27)), vest); vestM.position.set(0, 0.29, 0); torso.add(vestM);
    for (let i = -1; i <= 1; i++) { const p = new THREE.Mesh(G('pouch', () => box(0.09, 0.1, 0.05)), mat(c.vest)); p.position.set(i * 0.11, 0.18, -0.155); torso.add(p); const t = new THREE.Mesh(G('ptop', () => box(0.092, 0.025, 0.052)), mat(c.accent)); t.position.set(i * 0.11, 0.235, -0.156); torso.add(t); }
    const shoulderPad = G('spad', () => new THREE.SphereGeometry(0.075, 10, 8));
    for (const sx of [-1, 1]) { const s = new THREE.Mesh(shoulderPad, shirt); s.position.set(sx * 0.21, 0.47, 0); s.scale.set(1, 0.85, 1); torso.add(s); }
    const neck = new THREE.Mesh(G('neck', () => new THREE.CylinderGeometry(0.055, 0.06, 0.1, 8)), skinM); neck.position.y = 0.56; torso.add(neck);
    const head = this.head = new THREE.Group(); head.position.y = 0.69; torso.add(head);
    const headM = new THREE.Mesh(G('head', () => new THREE.SphereGeometry(0.115, 16, 12)), skinM); headM.scale.set(0.92, 1.06, 1); head.add(headM);
    const nose = new THREE.Mesh(G('nose', () => box(0.025, 0.035, 0.03)), skinM); nose.position.set(0, -0.005, -0.112); head.add(nose);
    addHeadgear(head, agent.head, c);
    // руки (IK): сегменты в пространстве торса
    this.arms = [];
    for (const sx of [-1, 1]) {
      const up = capsule(0.052, UPPER - 0.1, shirt), lo = capsule(0.046, LOWER - 0.09, shirt);
      const hand = new THREE.Mesh(G('hand', () => box(0.07, 0.085, 0.09)), glove);
      const elbow = new THREE.Mesh(G('elb', () => new THREE.SphereGeometry(0.05, 8, 6)), shirt);
      torso.add(up, lo, hand, elbow);
      this.arms.push({ sx, up, lo, hand, elbow, shoulder: new THREE.Vector3(sx * 0.22, 0.45, 0) });
    }
    // ноги (FK)
    this.legs = [];
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(sx * 0.1, -0.03, 0); hips.add(hip);
      const thigh = capsule(0.075, THIGH - 0.15, pants); thigh.position.y = -THIGH / 2; hip.add(thigh);
      const knee = new THREE.Group(); knee.position.y = -THIGH; hip.add(knee);
      const pad = new THREE.Mesh(G('kpad', () => box(0.1, 0.1, 0.05)), mat(c.vest)); pad.position.set(0, 0, -0.06); knee.add(pad);
      const shin = capsule(0.062, SHIN - 0.12, pants); shin.position.y = -SHIN / 2; knee.add(shin);
      const boot = new THREE.Mesh(G('boot', () => box(0.11, 0.09, 0.25)), boots); boot.position.set(0, -SHIN - 0.02, -0.04); knee.add(boot);
      this.legs.push({ hip, knee });
    }
    // оружие в руках
    this.gunHolder = new THREE.Group(); this.gunHolder.position.set(0.12, 0.33, -0.3); torso.add(this.gunHolder);
    this.setWeapon(weaponId, skinId);
    this.phase = 0; this.dead = false; this.deathT = 0;
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    this._v = new THREE.Vector3(); this._q = new THREE.Quaternion();
  }
  setGloves(skinId) {
    const m = skinId ? skinMaterial(skinId) : mat(this.c.glove);
    for (const a of this.arms) a.hand.material = m;
  }
  setWeapon(id, skinId) {
    if (this.gunId === id && this.gunSkin === skinId) return;
    this.gunId = id; this.gunSkin = skinId;
    if (this.gun) this.gunHolder.remove(this.gun);
    this.gun = buildWeapon(id, skinId); this.gun.scale.setScalar(1.05);
    this.gunHolder.add(this.gun);
    const t = WEAPONS[id] ? WEAPONS[id].type : 'nade';
    this.oneHand = t === 'knife' || t === 'nade' || !WEAPONS[id];
    this.pistol = t === 'pistol';
    this.gun.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }
  // сегмент между двумя точками
  _seg(mesh, a, b) {
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    this._v.copy(b).sub(a).normalize();
    mesh.quaternion.setFromUnitVectors(UPV, this._v);
  }
  _solveArm(arm, target) {
    const s = arm.shoulder, d = tmp1.copy(target).sub(s);
    let len = d.length(); const maxL = UPPER + LOWER - 0.005;
    if (len > maxL) { d.multiplyScalar(maxL / len); len = maxL; target = tmp2.copy(s).add(d); }
    const a = (UPPER * UPPER - LOWER * LOWER + len * len) / (2 * len);
    const h = Math.sqrt(Math.max(0, UPPER * UPPER - a * a));
    const dir = d.normalize();
    const pole = tmp3.set(arm.sx * 0.8, -1, 0.2).normalize();
    pole.sub(tmp4.copy(dir).multiplyScalar(pole.dot(dir))).normalize();
    const elbow = tmp4.copy(s).addScaledVector(dir, a).addScaledVector(pole, h);
    this._seg(arm.up, s, elbow); this._seg(arm.lo, elbow, target);
    arm.elbow.position.copy(elbow);
    arm.hand.position.copy(target); arm.hand.quaternion.copy(arm.lo.quaternion);
  }
  // st: {speed, crouch, pitch, dt, airborne, firing}
  update(st) {
    const dt = st.dt;
    if (this.dead) {
      this.deathT = Math.min(1, this.deathT + dt * 2.6);
      const e = 1 - Math.pow(1 - this.deathT, 3);
      this.hips.rotation.x = e * this.fallDir * 1.45;
      this.hips.position.y = 0.95 - e * 0.78;
      this.legs.forEach((l, i) => { l.hip.rotation.x = e * 0.3 * this.fallDir; l.knee.rotation.x = -e * 0.4; });
      this.torso.rotation.x = 0;
      return;
    }
    const sp = Math.min(1, st.speed / 5.5);
    this.phase += dt * (3 + st.speed * 1.5);
    const crouch = st.crouch ? 1 : 0;
    this.crouchK = (this.crouchK || 0) + (crouch - (this.crouchK || 0)) * Math.min(1, dt * 10);
    const ck = this.crouchK;
    const sw = Math.sin(this.phase) * 0.62 * sp * (1 - ck * 0.5);
    this.hips.position.y = 0.95 - ck * 0.36 + Math.abs(Math.cos(this.phase)) * 0.03 * sp;
    for (let i = 0; i < 2; i++) {
      const l = this.legs[i], s = i ? -sw : sw;
      l.hip.rotation.x = ck * 1.25 + s;
      const bend = Math.max(0, Math.sin(this.phase + (i ? Math.PI : 0) + 0.9)) * 0.9 * sp;
      l.knee.rotation.x = -(ck * 1.9 + bend);
    }
    if (st.airborne) { this.legs[0].hip.rotation.x = 0.6; this.legs[1].hip.rotation.x = 0.2; this.legs[0].knee.rotation.x = -1.0; this.legs[1].knee.rotation.x = -0.6; }
    this.torso.rotation.x = -ck * 0.15;
    this.torso.rotation.y = Math.sin(this.phase) * 0.06 * sp;
    // прицеливание: наклоняем держатель оружия и голову
    const p = THREE.MathUtils.clamp(st.pitch, -1.2, 1.2);
    this.head.rotation.x = p * 0.6;
    const kick = st.firing ? 0.03 : 0;
    this.gunHolder.rotation.x = p;
    if (this.oneHand) this.gunHolder.position.set(0.16, 0.3, -0.26 + kick);
    else if (this.pistol) this.gunHolder.position.set(0.02, 0.4, -0.42 + kick);
    else this.gunHolder.position.set(0.11, 0.38, -0.26 + kick);
    this.gunHolder.updateMatrix();
    // правая рука — на рукоять, левая — на цевьё
    const grip = tmp5.set(0, -0.02, 0).applyMatrix4(this.gunHolder.matrix);
    this._solveArm(this.arms[1], grip);
    if (this.oneHand) {
      const free = tmp6.set(-0.2, 0.18 + Math.sin(this.phase) * 0.04 * sp, -0.12);
      this._solveArm(this.arms[0], free);
    } else {
      const fore = tmp6.copy(this.gun.userData.fore).multiplyScalar(1.05).applyMatrix4(this.gunHolder.matrix);
      if (this.pistol) fore.x -= 0.03;
      this._solveArm(this.arms[0], fore);
    }
  }
  kill(dir = 1) { this.dead = true; this.deathT = 0; this.fallDir = dir; }
  revive() { this.dead = false; this.hips.rotation.set(0, 0, 0); this.hips.position.y = 0.95; this.crouchK = 0; }
}
const UPV = new THREE.Vector3(0, 1, 0);
const tmp1 = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3(), tmp4 = new THREE.Vector3(), tmp5 = new THREE.Vector3(), tmp6 = new THREE.Vector3();

// Руки от первого лица
export function buildViewArms(agent, gloveSkin) {
  const c = agent.c, grp = new THREE.Group(), kind = gloveSkin && skinById[gloveSkin] ? skinById[gloveSkin].weapon : null;
  const sleeve = mat(c.shirt), glove = gloveSkin ? skinMaterial(gloveSkin) : mat(c.glove), strap = gloveSkin ? mat('#1a1b1e') : mat(c.glove);
  const mkArm = sx => {
    const g = new THREE.Group();
    const fore = new THREE.Mesh(G('vfore', () => new THREE.CylinderGeometry(0.035, 0.042, 0.34, 10).rotateX(Math.PI / 2)), sleeve);
    fore.position.z = 0.17; g.add(fore);
    const cuff = new THREE.Mesh(G('vcuff', () => new THREE.CylinderGeometry(0.044, 0.044, 0.04, 10).rotateX(Math.PI / 2)), mat(c.accent)); cuff.position.z = 0.02; g.add(cuff);
    // кисть: ладонь, согнутые пальцы и большой палец
    const hand = new THREE.Group(); hand.position.z = -0.03; g.add(hand);
    const palm = new THREE.Mesh(G('vpalm', () => box(0.064, 0.05, 0.08)), glove); hand.add(palm);
    for (let f = 0; f < 4; f++) { const fi = new THREE.Mesh(G('vfing', () => box(0.0145, 0.018, 0.05)), glove); fi.position.set(-0.024 + f * 0.016, -0.03, -0.035); fi.rotation.x = 1.1; hand.add(fi); }
    const th = new THREE.Mesh(G('vthumb', () => box(0.016, 0.018, 0.045)), glove); th.position.set(-sx * 0.036, 0.0, -0.03); th.rotation.set(0.4, sx * 0.5, 0); hand.add(th);
    const band = new THREE.Mesh(G('vband', () => box(0.07, 0.056, 0.016)), strap); band.position.z = 0.04; hand.add(band);
    // форма зависит от типа перчаток
    if (kind === 'broken') hand.children.forEach(o => { if (o.geometry === G('vfing') || o.geometry === G('vthumb')) o.material = mat(c.skin); });   // без пальцев
    if (kind === 'bloodhound' || kind === 'hydra') { const k = new THREE.Mesh(G('vknuck', () => box(0.068, 0.016, 0.026)), mat(kind === 'hydra' ? '#2a3a2a' : '#1a1b1e')); k.position.set(0, 0.02, -0.03); hand.add(k); }
    if (kind === 'hydra' || kind === 'bloodhound') { const cf = new THREE.Mesh(G('vcuff2', () => new THREE.CylinderGeometry(0.047, 0.047, 0.07, 10).rotateX(Math.PI / 2)), glove); cf.position.z = 0.065; hand.add(cf); }
    if (kind === 'tactical') for (let k = 0; k < 2; k++) { const st = new THREE.Mesh(G('vstrap', () => box(0.072, 0.012, 0.012)), mat('#d0a020')); st.position.set(0, 0.026, 0.005 + k * 0.022); hand.add(st); }
    return g;
  };
  grp.userData.right = mkArm(1); grp.userData.left = mkArm(-1);
  grp.add(grp.userData.right, grp.userData.left);
  return grp;
}
