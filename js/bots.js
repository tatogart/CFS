// ИИ ботов: закупка, тактика раунда, раскидка гранат, стрельба
import * as THREE from '../vendor/three.module.min.js';
import { CELL } from './maps.js?v=1793105575';
import { WEAPONS } from './data.js?v=1793105575';

const G = 15;
const v3 = () => new THREE.Vector3();
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const rand = (a, b) => a + Math.random() * (b - a);

// Подбор траектории броска: гравитация и точка вылета — как в Game.throwNade
export function solveThrow(world, from, to, fixedT) {
  const times = fixedT ? [fixedT] : [1.0, 1.25, 1.5, 1.8, 2.1, 2.5, 2.9];
  for (const T of times) {
    const v = new THREE.Vector3((to.x - from.x) / T, (to.y - from.y + 0.5 * G * T * T) / T, (to.z - from.z) / T);
    if (v.length() > 21) continue;
    let ok = true;
    for (let t = 0.04; t < T - 0.1; t += 0.04) {
      const x = from.x + v.x * t, y = from.y + v.y * t - 0.5 * G * t * t, z = from.z + v.z * t;
      if (y < world.hAtPos(x, z) + 0.12 || y > 30) { ok = false; break; }
    }
    if (ok) return v;
  }
  return null;
}

// Тактика команд на раунд
export function planRound(g) {
  const w = g.world, sites = ['A', 'B'];
  const tSite = sites[Math.random() < 0.5 ? 0 : 1];
  const Ts = g.actors.filter(a => a.team === 'T' && a.bot), CTs = g.actors.filter(a => a.team === 'CT' && a.bot);
  const fast = g.diff.id === 'harmless' || g.diff.id === 'easy';
  g.plan = {
    T: { site: tSite, execAt: fast ? 0 : rand(18, 40), lurker: (!fast && Ts.length >= 4) ? Ts[Ts.length - 1] : null, executing: fast },
    CT: {},
  };
  // спецназ: делим по точкам
  CTs.forEach((a, i) => { g.plan.CT[a.id] = i % 2 ? 'A' : 'B'; });
  if (CTs.length >= 3 && Math.random() < 0.5) g.plan.CT[CTs[2].id] = 'A';
  g.intel = { T: null, CT: null };
}

export class Bot {
  constructor(g, a, d) {
    this.g = g; this.a = a; this.d = d; this.comp = d.comp || 0;
    this._e = v3(); this._t = v3();
  }
  get w() { return this.g.world; }

  // ---------- закупка ----------
  buy() {
    const g = this.g, a = this.a, T = a.team === 'T';
    const half = g.o.winTo - 1, pistol = g.round === 1 || g.round === half + 1;
    const nadeSkill = this.d.nades;
    const tryB = id => g.buy(a, id);
    if (pistol) {
      if (Math.random() < 0.5) tryB('vest'); else { if (Math.random() < nadeSkill) tryB('smoke'); tryB('flash'); }
      if (!T && Math.random() < 0.3) tryB('kit');
      return;
    }
    const m = a.money;
    if (m >= 3800) {
      const awp = m >= 6200 && Math.random() < 0.2;
      tryB(awp ? 'awp' : T ? 'ak47' : 'm4a4');
      tryB('vesthelm');
    } else if (m >= 2600) { tryB(T ? 'galil' : 'famas'); tryB('vest'); }
    else if (m >= 1900 && Math.random() < 0.5) { tryB(T ? 'mac10' : 'mp9'); tryB('vest'); }
    else if (m >= 900 && Math.random() < 0.6) tryB('deagle');
    // гранаты по уровню
    if (Math.random() < nadeSkill) tryB('smoke');
    if (Math.random() < nadeSkill) tryB('flash');
    if (Math.random() < nadeSkill * 0.8) tryB('molotov');
    if (Math.random() < nadeSkill * 0.5) tryB('he');
    if (Math.random() < nadeSkill * 0.6) tryB('flash');
    if (!T && a.money > 600) tryB('kit');
  }

  // ---------- раунд ----------
  onRoundStart() {
    this.buy();
    const g = this.g, a = this.a;
    this.selectPrimary();
    this.path = null; this.pi = 0; this.goal = null; this.target = null; this.lastTarget = null;
    this.thinkT = Math.random() * 0.3; this.react = 0; this.err = { p: 0, y: 0 }; this.burst = 0; this.pauseT = 0;
    this.strafeT = 0; this.strafeDir = 1; this.stuckT = 0; this.lastPos = a.pos.clone(); this.nadeQueue = []; this.nadeT = 0; this.usedCTnades = new Set();
    this.mode = 'move'; this.look = null; this.holdT = 0; this.searchPos = null; this.headAim = Math.random() < this.d.head;
    const w = this.w;
    if (a.team === 'T') {
      const P = g.plan.T, site = P.lurker === a ? (P.site === 'A' ? 'B' : 'A') : P.site;
      this.site = site;
      const sc = w.sites[site].center;
      const p = w.path(a.pos, sc);
      // точка сбора перед точкой
      this.stage = null;
      if (p && !P.executing) {
        let acc = 0;
        for (let i = p.length - 1; i > 0; i--) { acc += p[i].distanceTo(p[i - 1]); if (acc > 15) { this.stage = p[i - 1].clone().add(new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1))); break; } }
      }
      this.setGoal(this.stage || this.siteSpot(site));
      this.watch = sc;
    } else {
      this.site = g.plan.CT[a.id] || 'A';
      this.setGoal(this.holdSpot(this.site));
    }
  }
  selectPrimary() { const a = this.a; this.g.selectSlot(a, a.weapons[1] ? 1 : 2, true); }
  siteSpot(site) {
    const w = this.w, c = w.sites[site].center, cells = w.sites[site].filter(([i, j]) => w.walk(i, j));
    // ближе к центру
    cells.sort((p, q) => (Math.hypot(p[0] * CELL - c.x, p[1] * CELL - c.z) - Math.hypot(q[0] * CELL - c.x, q[1] * CELL - c.z)));
    const pick = cells[Math.floor(Math.random() * Math.min(cells.length, 10))];
    return w.cellCenter(pick[0], pick[1]);
  }
  holdSpot(site) {
    const w = this.w, cells = w.sites[site].filter(([i, j]) => w.walk(i, j));
    // предпочитаем клетки у укрытий
    const scored = cells.map(([i, j]) => { let n = 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!w.walk(i + di, j + dj)) n++; return [i, j, n + Math.random() * 1.5]; });
    scored.sort((p, q) => q[2] - p[2]);
    const pick = scored[Math.floor(Math.random() * Math.min(6, scored.length))];
    const spot = w.cellCenter(pick[0], pick[1]);
    // смотрим в сторону, откуда придут террористы
    const tsp = w.spawns.T[0], p = w.path(spot, w.cellCenter(tsp[0], tsp[1]));
    this.watch = null;
    if (p) { let acc = 0; for (let i = 1; i < p.length; i++) { acc += p[i].distanceTo(p[i - 1]); this.watch = p[i]; if (acc > 8) break; } }
    return spot;
  }
  setGoal(p) {
    this.goal = p ? p.clone() : null; this.pi = 1;
    const g = this.g;
    this.path = p ? this.w.path(this.a.pos, p, (i, j) => g.fires.some(f => Math.hypot((i + 0.5) * CELL - f.c.x, (j + 0.5) * CELL - f.c.z) < f.r + 1)) : null;
  }
  onHurt(att, dir) {
    if (att && att !== this.a && att.team !== this.a.team) {
      this.aware = att; this.awareT = this.g.time;
      if (!this.target) { this.look = att.pos.clone(); }
    }
  }
  onPlanted(bomb) {
    const a = this.a;
    if (a.team === 'CT') { this.site = bomb.site; this.setGoal(bomb.pos); this.mode = 'retake'; }
    else { const spot = this.siteSpot(bomb.site); spot.lerp(bomb.pos, 0.2); this.setGoal(spot); this.mode = 'post'; this.watch = this.w.sites[bomb.site].center; }
  }

  // ---------- восприятие ----------
  canSee(e) {
    const g = this.g, a = this.a;
    if (a.blind > 0.6) return false;
    const eye = g.eyePos(a, this._e);
    const dx = e.pos.x - eye.x, dz = e.pos.z - eye.z, d = Math.hypot(dx, dz);
    if (d > 75 * this.d.spot) return false;
    const yawTo = Math.atan2(-dx, -dz);
    const fov = (this.target === e || g.time - (this.awareT || -9) < 2) ? Math.PI : 1.35;
    if (Math.abs(angDiff(yawTo, a.yaw)) > fov) return false;
    const pts = [1.62 - 0.45 * e.crouchK, 1.15 - 0.3 * e.crouchK, 0.6];
    for (const h of pts) {
      this._t.set(e.pos.x, e.pos.y + h, e.pos.z);
      if (g.world.los(eye, this._t) && !g.smokeBlocks(eye, this._t)) return true;
    }
    return false;
  }
  think() {
    const g = this.g, a = this.a;
    const enemies = g.actors.filter(e => e.alive && e.team !== a.team);
    let best = null, bd = 1e9;
    for (const e of enemies) {
      if (!this.canSee(e)) continue;
      const d = e.pos.distanceTo(a.pos); if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      if (best !== this.target) {
        const quick = best === this.lastTarget && g.time - this.lostT < 2;
        this.react = this.d.react * rand(0.8, 1.3) * (quick ? 0.35 : 1);
        if (a.blind > 0.2) this.react += 0.4;
        const errMag = this.d.aim * (1 + bd / 35);
        this.err = { p: rand(-1, 1) * errMag * 0.6, y: rand(-1, 1) * errMag };
        this.headAim = Math.random() < this.d.head;
        this.target = best;
      }
      this.seenPos = best.pos.clone(); this.seenT = g.time;
      g.intel[a.team] = { pos: best.pos.clone(), t: g.time };
    } else if (this.target) {
      this.lastTarget = this.target; this.lostT = g.time; this.target = null;
    }
    // слух
    if (!this.target) {
      for (const e of enemies) {
        if (g.time - (e.noiseT || -9) < 0.6 && e.pos.distanceTo(a.pos) < (e.noiseR || 0) * this.d.spot) { this.look = e.pos.clone(); this.lookT = g.time; this.heard = e.pos.clone(); this.heardT = g.time; break; }
      }
    }
    this.tactics(enemies);
  }

  // ---------- тактика ----------
  tactics(enemies) {
    const g = this.g, a = this.a, w = this.w, P = g.plan;
    const B = g.bomb;
    if (this.target) return;
    // подобрать бомбу
    if (a.team === 'T' && B && B.dropped && !this.toBomb) {
      const near = g.actors.filter(x => x.alive && x.team === 'T' && x.bot).sort((p, q) => p.pos.distanceTo(B.pos) - q.pos.distanceTo(B.pos))[0];
      if (near === a) { this.toBomb = true; this.setGoal(B.pos); }
    }
    if (this.toBomb && (!B || !B.dropped)) { this.toBomb = false; if (a.hasBomb) this.setGoal(this.siteSpot(this.site)); }
    // атака террористов
    if (a.team === 'T' && !this.toBomb && this.mode === 'move') {
      const elapsed = 115 - g.roundTime;
      if (!P.T.executing) {
        const ts = g.actors.filter(x => x.alive && x.team === 'T' && x.bot && x !== P.T.lurker);
        const ready = ts.every(x => !x.brain.stage || x.pos.distanceTo(x.brain.stage) < 3);
        if (elapsed > P.T.execAt || (ready && elapsed > 10) || g.roundTime < 45) { P.T.executing = true; P.T.execStart = g.time; }
      }
      if (P.T.executing && !this.executing) {
        this.executing = true;
        this.planNades('T', this.site);
        this.execDelay = g.time + (this.nadeQueue.length ? 1.6 : 0.1) + rand(0, 0.6);
      }
      if (this.executing && this.execDelay && g.time > this.execDelay) {
        this.execDelay = 0;
        this.setGoal(this.siteSpot(this.site));
      }
      // на точке с бомбой — закладываем
      if (a.hasBomb && w.siteAt(a.pos.x, a.pos.z) && g.state === 'live') { this.planting = true; }
    }
    if (a.team === 'T' && this.mode === 'post' && !this.path && Math.random() < 0.02) this.setGoal(this.siteSpot(this.site));
    // спецназ: защита / ротация / ответная раскидка
    if (a.team === 'CT' && this.mode === 'move') {
      const intel = g.intel.CT;
      if (intel && g.time - intel.t < 3) {
        const dA = intel.pos.distanceTo(w.sites.A.center), dB = intel.pos.distanceTo(w.sites.B.center);
        const hot = dA < dB ? 'A' : 'B';
        if (hot !== this.site && Math.min(dA, dB) < 22 && Math.random() < this.d.nades * 0.5 && !this.rotated) { this.rotated = true; this.site = hot; this.setGoal(this.holdSpot(hot)); }
        if (!this.nadeQueue.length && g.time > (this.planT || 0)) { this.planT = g.time + 2; this.planNades('CT', hot, intel.pos); }
      } else if (this.heard && g.time - this.heardT < 2) {
        const hot = this.heard.distanceTo(w.sites.A.center) < this.heard.distanceTo(w.sites.B.center) ? 'A' : 'B';
        if (!this.nadeQueue.length && g.time > (this.planT || 0)) { this.planT = g.time + 2; this.planNades('CT', hot, this.heard); }
      }
    }
    if (a.team === 'CT' && this.mode === 'retake' && B && B.planted && !B.done) {
      const d = a.pos.distanceTo(B.pos);
      const tLeft = B.timer, need = a.kit ? 5 : 10;
      if (d < 1.3 && tLeft > need - 0.3) this.defusing = true;
      else if (!this.path) this.setGoal(B.pos);
    }
    // охота за звуками, если нечего делать
    if (!this.path && this.mode === 'move' && a.team === 'CT' && g.roundTime < 30 && Math.random() < 0.05) {
      const intel = g.intel.CT; if (intel) this.setGoal(intel.pos);
    }
    if (a.team === 'T' && this.executing && !this.path && !a.hasBomb && Math.random() < 0.01 && (!B || !B.planted)) {
      // ищем врагов, если бомба у другого
      const intel = g.intel.T; if (intel) this.setGoal(intel.pos);
    }
  }
  // раскидка: выбираем гранаты под эту точку
  planNades(side, site, near) {
    const g = this.g, a = this.a, map = g.o.map;
    if (Math.random() > this.d.nades) return;
    const list = map.nades.filter(n => n.side === side && (n.site === site || (side === 'T' && n.site === 'mid' && g.plan.T.lurker === a)));
    for (const n of list) {
      const have = a.nades.filter(x => x === n.type).length - this.nadeQueue.filter(q => q.type === n.type).length;
      if (have <= 0) continue;
      if (this.usedCTnades.has(n.mark + n.type)) continue;
      const cell = g.world.marks[n.mark]; if (!cell) continue;
      const tgt = g.world.cellCenter(cell[0], cell[1]);
      if (near && tgt.distanceTo(near) > 16) continue;
      // за одну гранату конкретного типа отвечает один бот
      const key = side + site + n.mark + n.type;
      g.nadeClaims = g.nadeClaims || {};
      if (g.nadeClaims[key] === g.round) continue;
      g.nadeClaims[key] = g.round;
      this.usedCTnades.add(n.mark + n.type);
      const jitter = { esports: 0, hard: 0.35, medium: 1.4, easy: 3, harmless: 4 }[this.d.id] || 0;
      tgt.x += rand(-jitter, jitter); tgt.z += rand(-jitter, jitter);
      this.nadeQueue.push({ type: n.type, tgt, name: n.name, tries: 0 });
    }
    // дым первым, потом молотов, флешки последними
    const ord = { smoke: 0, molotov: 1, he: 2, flash: 3 };
    this.nadeQueue.sort((p, q) => ord[p.type] - ord[q.type]);
  }
  tryNade() {
    const g = this.g, a = this.a, q = this.nadeQueue[0];
    if (!q || g.time < this.nadeT) return false;
    if (!a.nades.includes(q.type)) { this.nadeQueue.shift(); return false; }
    const from = g.eyePos(a, v3());
    const d = from.distanceTo(q.tgt);
    q.since = q.since || g.time;
    if (g.time - q.since > 9) { this.nadeQueue.shift(); return false; }
    if (g.time < (q.next || 0)) return false;
    q.next = g.time + 0.15;
    if (d > 34) return false;
    let v;
    if (q.type === 'flash') v = solveThrow(g.world, from, q.tgt.clone().setY(2.6), 1.4) || solveThrow(g.world, from, q.tgt.clone().setY(0.1));
    else if (q.type === 'he') v = solveThrow(g.world, from, q.tgt.clone().setY(0.4), 1.6) || solveThrow(g.world, from, q.tgt.clone().setY(0.1));
    else v = solveThrow(g.world, from, q.tgt.clone().setY(0.06));
    if (!v) return false;
    // разворачиваемся по направлению броска
    a.yaw = Math.atan2(-v.x, -v.z); a.pitch = Math.atan2(v.y, Math.hypot(v.x, v.z));
    const prev = a.slot;
    g.selectSlot(a, 4, true);
    a.cur = { id: q.type, nade: true };
    g.throwNade(a, q.type, v);
    g.selectSlot(a, prev === 4 ? (a.weapons[1] ? 1 : 2) : prev, true);
    this.nadeQueue.shift();
    this.nadeT = g.time + (q.type === 'smoke' ? 0.7 : 0.45);
    return true;
  }

  // ---------- кадр ----------
  update(dt, frozen) {
    const g = this.g, a = this.a, inp = a.in;
    inp.fire = false; inp.use = false; inp.jump = false; inp.walk = false; inp.crouch = false;
    if (frozen) { inp.mx = inp.mz = 0; this.idleLook(dt); return; }
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.12 + Math.random() * 0.06; this.think(); }
    const T = this.target;
    // ---- бой ----
    if (T && T.alive) {
      this.react -= dt;
      const eye = g.eyePos(a, this._e);
      const aimH = this.headAim ? 1.62 - 0.45 * T.crouchK : 1.22 - 0.3 * T.crouchK;
      // упреждение
      const lead = this.d.id === 'esports' ? 0.08 : 0.0;
      const tx = T.pos.x + T.vel.x * lead, ty = T.pos.y + aimH, tz = T.pos.z + T.vel.z * lead;
      const dx = tx - eye.x, dy = ty - eye.y, dz = tz - eye.z, hd = Math.hypot(dx, dz);
      // постоянное «дрожание» прицела — чем слабее бот, тем сильнее
      const tt = g.time + a.id * 1.7, wob = this.d.aim * 0.8;
      const wy = wob * (Math.sin(tt * 1.9) * 0.6 + Math.sin(tt * 4.3) * 0.4), wp = wob * 0.6 * Math.sin(tt * 2.7 + 1);
      const wantY = Math.atan2(-dx, -dz) + this.err.y + wy, wantP = Math.atan2(dy, hd) + this.err.p + wp;
      const settle = 1 - Math.exp(-dt * (0.4 + this.d.turn * 0.25));
      this.err.y -= this.err.y * settle; this.err.p -= this.err.p * settle;
      this.turnTo(wantY, wantP, dt, this.d.turn * (a.blind > 0.3 ? 0.3 : 1));
      const ey = Math.abs(angDiff(wantY - this.err.y, a.yaw)), ep = Math.abs(wantP - this.err.p - a.pitch);
      const dist = Math.hypot(dx, dy, dz);
      const tol = Math.atan2(0.32, dist) + 0.01;
      const def = a.cur && WEAPONS[a.cur.id];
      // перезарядка/смена на пистолет
      if (a.cur && !a.cur.nade && def && def.mag && a.cur.mag === 0) { if (a.cur.reserve <= 0 && a.weapons[2] && a.slot !== 2) g.selectSlot(a, 2); else g.reload(a); }
      if (a.cur && (a.cur.nade || a.cur.c4)) this.selectPrimary();
      // стрельба
      let shoot = this.react <= 0 && ey < tol * 1.6 && ep < tol * 1.6 && Math.random() < this.d.fire + 0.2;
      if (def && def.type === 'knife' && dist > 2) shoot = false;
      if (shoot && def) {
        if (def.scope && !a.scope) a.scope = 1;
        if (def.type === 'rifle' || def.type === 'smg') {
          const burstLen = dist > 22 ? Math.max(2, this.d.burst / 3) : this.d.burst * 2;
          if (this.pauseT > 0) { this.pauseT -= dt; }
          else { inp.fire = true; this.burst += dt / def.rate; if (this.burst > burstLen) { this.burst = 0; this.pauseT = (dist > 22 ? 0.35 : 0.15) * (1 + (1 - this.d.fire) * 6) + (1 - this.d.comp) * 0.3; } }
        } else if (def.type === 'pistol' || def.type === 'sniper') {
          if (this.pauseT > 0) this.pauseT -= dt;
          else { inp.fire = (this.tap = !this.tap); if (inp.fire) this.pauseT = (1 - this.d.fire) * 0.9 + (1 - this.d.comp) * 0.15; }
        } else inp.fire = true;
      }
      // движение в бою
      inp.mx = inp.mz = 0;
      if (def && def.type === 'knife') this.moveToward(T.pos, 1);
      else if (this.d.strafe > 0 && dist > 4) {
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafeT = rand(0.3, 0.8); this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.crouchSpray = Math.random() < this.d.strafe * 0.25 && dist < 18; }
        const stopForShot = inp.fire && this.d.strafe >= 0.7;
        if (!stopForShot && Math.random() < this.d.strafe + 0.2) { const sy = Math.cos(a.yaw), sz = -Math.sin(a.yaw); inp.mx = sy * this.strafeDir; inp.mz = sz * this.strafeDir; }
        if (this.crouchSpray && inp.fire) inp.crouch = true;
        // не уходить в пропасть/огонь
        const nx = a.pos.x + inp.mx * 0.8, nz = a.pos.z + inp.mz * 0.8;
        if (!g.world.walk(Math.floor(nx / CELL), Math.floor(nz / CELL))) { inp.mx = -inp.mx; inp.mz = -inp.mz; this.strafeDir *= -1; }
      }
      if (g.inFire(a.pos)) this.followPath(dt);
      return;
    }
    // ---- закладка / разминирование ----
    if (this.planting && a.hasBomb && g.world.siteAt(a.pos.x, a.pos.z) && g.state === 'live') { inp.mx = inp.mz = 0; inp.use = true; inp.crouch = true; this.idleLook(dt); return; }
    this.planting = false;
    if (this.defusing && g.bomb && g.bomb.planted && !g.bomb.done && a.pos.distanceTo(g.bomb.pos) < 1.5) { inp.mx = inp.mz = 0; inp.use = true; this.idleLook(dt); return; }
    this.defusing = false;
    // ---- гранаты ----
    if (this.nadeQueue.length && !g.inFire(a.pos)) {
      if (this.tryNade()) { inp.mx = inp.mz = 0; return; }
    }
    // перезарядка вне боя
    const cur = a.cur, def = cur && WEAPONS[cur.id];
    if (def && def.mag && cur.mag < def.mag * 0.4 && cur.reserve > 0) g.reload(a);
    if (cur && (cur.nade || cur.c4)) this.selectPrimary();
    if (a.scope) a.scope = 0;
    // ---- передвижение ----
    this.followPath(dt);
  }
  followPath(dt) {
    const g = this.g, a = this.a, inp = a.in;
    if (!this.path || this.pi >= this.path.length) {
      this.path = null; inp.mx = inp.mz = 0;
      this.holdLook(dt);
      return;
    }
    const wp = this.path[this.pi];
    const dx = wp.x - a.pos.x, dz = wp.z - a.pos.z, d = Math.hypot(dx, dz);
    if (d < (this.pi === this.path.length - 1 ? 0.5 : 0.9)) { this.pi++; return; }
    inp.mx = dx / d; inp.mz = dz / d;
    // осторожный шаг на сложных уровнях, когда рядом точка противника
    if (this.d.strafe >= 0.7 && a.team === 'T' && this.executing === false && this.stage && a.pos.distanceTo(this.stage) < 6) inp.walk = true;
    // смотрим по ходу движения, либо на звук
    let ly = Math.atan2(-dx, -dz), lp = 0;
    if (this.look && g.time - (this.lookT || 0) < 1.5) { const lx = this.look.x - a.pos.x, lz = this.look.z - a.pos.z; ly = Math.atan2(-lx, -lz); }
    this.turnTo(ly, lp, dt, Math.min(this.d.turn, 6));
    // застревание
    this.stuckT += dt;
    if (this.stuckT > 1) {
      if (a.pos.distanceTo(this.lastPos) < 0.4) { inp.jump = true; const goal = this.goal; if (goal) this.setGoal(goal.clone().add(new THREE.Vector3(rand(-1.5, 1.5), 0, rand(-1.5, 1.5)))); }
      this.stuckT = 0; this.lastPos.copy(a.pos);
    }
  }
  holdLook(dt) {
    const a = this.a, g = this.g;
    let tgt = null;
    if (this.look && g.time - (this.lookT || 0) < 3) tgt = this.look;
    else if (this.watch) tgt = this.watch;
    if (tgt) { const dx = tgt.x - a.pos.x, dz = tgt.z - a.pos.z; this.turnTo(Math.atan2(-dx, -dz) + Math.sin(g.time * 0.7 + a.id) * 0.25, 0, dt, 3); }
    else this.idleLook(dt);
    if (this.d.strafe >= 0.7 && a.team === 'CT') a.in.crouch = false;
  }
  idleLook(dt) { const a = this.a; a.pitch += (0 - a.pitch) * Math.min(1, dt * 3); }
  turnTo(wy, wp, dt, speed) {
    const a = this.a, dy = angDiff(wy, a.yaw), mx = speed * dt;
    a.yaw += Math.abs(dy) < mx ? dy : Math.sign(dy) * mx;
    a.yaw += dy * Math.min(1, dt * speed * 0.5) * 0.2;
    const dp = wp - a.pitch; a.pitch += Math.abs(dp) < mx ? dp : Math.sign(dp) * mx;
  }
  moveToward(p, k) { const a = this.a, dx = p.x - a.pos.x, dz = p.z - a.pos.z, d = Math.hypot(dx, dz) || 1; a.in.mx = dx / d * k; a.in.mz = dz / d * k; }
}
