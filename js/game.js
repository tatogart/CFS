// Ядро матча: актёры, физика, оружие, гранаты, бомба, раунды, HUD
import * as THREE from '../vendor/three.module.min.js';
import { CELL } from './maps.js';
import { World } from './world.js';
import { WEAPONS, NADES, GEAR, agentById, AGENTS, SKINS, KNIVES } from './data.js';
import { AgentModel, buildWeapon, buildViewArms, mat } from './models.js';
import { play, soundFor } from './sfx.js';
import { Bot, planRound } from './bots.js';
import { weaponIconURL, mapThumbURL } from './art.js';

export const GRAV = 15;
const EYE = 1.62, EYE_C = 1.15, RADIUS = 0.32, STEP = 0.45, JUMP_V = 5.9;
const ROUND_TIME = 115, FREEZE = 6, BOMB_TIME = 40, END_TIME = 5, PLANT_TIME = 3.2;
const BOT_NAMES = ['Кирпич', 'Тень', 'Шрам', 'Волк', 'Сокол', 'Гром', 'Лис', 'Боцман', 'Призрак', 'Рыжий', 'Седой', 'Бархан', 'Ястреб', 'Кобра', 'Мангуст'];
const ZONES = [['head', 1.66, 0.15, 4], ['chest', 1.33, 0.26, 1], ['stomach', 1.05, 0.24, 1.25], ['legs', 0.68, 0.2, 0.75], ['legs', 0.32, 0.17, 0.75]];

let softTex = null;
function softSprite() {
  if (softTex) return softTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); softTex = new THREE.CanvasTexture(cv); return softTex;
}
function textSprite(text, color) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d');
  g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(text, 128, 44); g.fillStyle = color; g.fillText(text, 128, 44);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
  sp.scale.set(1.6, 0.4, 1); sp.renderOrder = 10; return sp;
}

export class Game {
  constructor(renderer, opts, ui) {
    this.r = renderer; this.o = opts; this.ui = ui; this.ctrl = opts.controls;
    this.practice = opts.diff.id === 'none';
    this.admin = opts.admin || {};
    this.diff = opts.diff;
    this.settings = opts.settings;
    this.quality = opts.quality;
    this.scene = new THREE.Scene();
    const th = opts.map.theme;
    this.scene.background = new THREE.Color(th.sky);
    this.scene.fog = new THREE.Fog(th.fog, 40, th.void ? 260 : 140);
    this.world = new World(opts.map, this.quality);
    this.scene.add(this.world.group);
    const hemi = new THREE.HemisphereLight('#ffffff', th.floor, 0.85); this.scene.add(hemi);
    const sun = this.sun = new THREE.DirectionalLight(th.sun, 1.5);
    const cx = this.world.w * CELL / 2, cz = this.world.h * CELL / 2;
    sun.position.set(cx + 30, 60, cz + 20); sun.target.position.set(cx, 0, cz); this.scene.add(sun, sun.target);
    if (this.quality >= 2) {
      sun.castShadow = true; const s = sun.shadow; s.mapSize.set(2048, 2048); const ext = Math.max(cx, cz) + 4;
      s.camera.left = -ext; s.camera.right = ext; s.camera.top = ext; s.camera.bottom = -ext; s.camera.near = 10; s.camera.far = 160; s.bias = -0.0006;
    }
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.25));
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, innerWidth / innerHeight, 0.05, 600);
    this.baseFov = this.settings.fov;
    // вьюмодель
    this.vmScene = new THREE.Scene();
    this.vmCam = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.01, 10);
    this.vmScene.add(new THREE.HemisphereLight('#ffffff', '#555555', 1.6));
    const vl = new THREE.DirectionalLight('#ffffff', 1.2); vl.position.set(1, 2, 1); this.vmScene.add(vl);
    this.vm = new THREE.Group(); this.vmScene.add(this.vm);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: '#ffcc66', blending: THREE.AdditiveBlending, depthTest: false, transparent: true }));
    this.flash.scale.setScalar(0.22); this.flash.visible = false; this.vmScene.add(this.flash);

    this.actors = []; this.nades = []; this.smokes = []; this.fires = []; this.fx = []; this.decals = [];
    this.time = 0; this.score = { T: 0, CT: 0 }; this.round = 0; this.lossStreak = { T: 0, CT: 0 };
    this.feed = []; this.bomb = null; this.state = 'freeze'; this.stateT = 0;
    this.playerSide = opts.side;
    this._initTracers();
    this._spawnActors();
    this.startRound(true);
    this.minimapBg = new Image(); this.minimapBg.src = mapThumbURL(opts.map, 4);
  }

  // ---------- актёры ----------
  _spawnActors() {
    const lo = this.o.loadout, side = this.playerSide, n = this.practice ? 0 : this.o.size;
    const mkActor = (name, team, bot, agentId) => {
      const agent = agentById[agentId] || AGENTS.find(a => a.team === team);
      const a = {
        id: this.actors.length, name, team, bot, agent,
        pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0,
        hp: 100, armor: 0, helmet: false, kit: false, alive: true, money: 800,
        weapons: { 1: null, 2: null, 3: null }, nades: [], slot: 3, last: 2, cur: null,
        fireCd: 0, reloadT: 0, switchT: 0, punch: { p: 0, y: 0 }, recoilIdx: 0, lastShot: -10, released: true,
        crouchK: 0, onGround: true, in: { mx: 0, mz: 0, jump: false, crouch: false, walk: false, fire: false, use: false },
        kills: 0, deaths: 0, roundKills: 0, blind: 0, plantT: 0, defuseT: 0, scope: 0, lastFired: -10, lastSeen: {}, stepT: 0,
        skins: {},
      };
      a.model = new AgentModel(agent, 'knife');
      if (!bot) a.model.root.visible = false;
      this.scene.add(a.model.root);
      if (bot && !this.practice) { a.brain = new Bot(this, a, this.diff); }
      this.actors.push(a);
      return a;
    };
    const p = this.player = mkActor('Вы', side, false, this.o.agents[side]);
    p.skins = { ...lo };
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    const enemy = side === 'T' ? 'CT' : 'T';
    const teamAgents = t => AGENTS.filter(a => a.team === t);
    for (let i = 0; i < n - 1; i++) { const ag = teamAgents(side)[i % 5]; const b = mkActor(names.pop(), side, true, ag.id); this._botSkins(b); }
    for (let i = 0; i < n; i++) { const ag = teamAgents(enemy)[(i + 2) % 5]; const b = mkActor(names.pop(), enemy, true, ag.id); this._botSkins(b); }
    // имена союзников над головой
    for (const a of this.actors) if (a.bot && a.team === side) { a.tag = textSprite(a.name, '#7ee08a'); this.scene.add(a.tag); }
    this._buildViewmodel();
  }
  _botSkins(b) {
    if (Math.random() < 0.5) for (const s of SKINS) if (!KNIVES[s.weapon] && Math.random() < 0.12) b.skins[s.weapon] = s.id;
  }
  give(a, id) {
    const def = WEAPONS[id];
    const inst = { id, mag: def.mag || 0, reserve: def.reserve || 0, skin: a.skins[id] || null };
    if (id === 'knife') { inst.model = a.skins.knife ? a.skins.knife.model : 'knife'; inst.skin = a.skins.knife ? a.skins.knife.skin : null; }
    a.weapons[def.slot] = inst;
    return inst;
  }
  resetLoadout(a, full) {
    a.weapons = { 1: null, 2: null, 3: null }; a.nades = []; a.armor = 0; a.helmet = false; a.kit = false;
    this.give(a, 'knife'); this.give(a, a.team === 'T' ? 'glock' : 'usp');
    if (full) a.money = 800;
  }
  spawnPos(team, k) {
    const list = this.world.spawns[team].filter(([i, j]) => this.world.walk(i, j));
    const used = this.actors.filter(x => x.team === team).length;
    const [i, j] = list[(k * 7 + Math.floor(Math.random() * 3)) % list.length];
    return this.world.cellCenter(i, j);
  }

  // ---------- раунды ----------
  startRound(first) {
    this.round++;
    const half = this.o.winTo - 1;
    if (!first && !this.practice && this.round === half + 1) this._swapSides();
    this.state = this.practice ? 'live' : 'freeze'; this.stateT = this.practice ? 1e9 : FREEZE;
    this.roundTime = ROUND_TIME; this.bomb = null;
    for (const n of this.nades) n.mesh && this.scene.remove(n.mesh); this.nades = [];
    for (const s of this.smokes) this.scene.remove(s.grp); this.smokes = [];
    for (const f of this.fires) this.scene.remove(f.grp); this.fires = [];
    for (const d of this.decals) this.scene.remove(d); this.decals = [];
    if (this.c4mesh) { this.scene.remove(this.c4mesh); this.c4mesh = null; }
    const counts = { T: 0, CT: 0 };
    for (const a of this.actors) {
      const pistolRound = first || (this.round === half + 1);
      if (!a.alive || pistolRound) this.resetLoadout(a, pistolRound);
      a.alive = true; a.hp = 100; a.blind = 0; a.plantT = 0; a.defuseT = 0; a.scope = 0; a.roundKills = 0; a.reloadT = 0; a.switchT = 0;
      a.vel.set(0, 0, 0); a.pos.copy(this.spawnPos(a.team, counts[a.team]++)); a.crouchK = 0;
      a.model.revive(); a.model.root.visible = a.bot;
      // смотрим вдоль маршрута к ближайшей точке
      const c = this.world.sites.A.center, d = this.world.sites.B.center;
      const route = this.world.path(a.pos, a.pos.distanceTo(c) < a.pos.distanceTo(d) ? c : d);
      const tgt = route && route.length > 1 ? route[1] : c;
      a.yaw = Math.atan2(-(tgt.x - a.pos.x), -(tgt.z - a.pos.z)); a.pitch = 0;
      if (this.practice) { a.money = 16000; }
      a.hasBomb = false;
      this.selectSlot(a, a.weapons[1] ? 1 : 2, true);
    }
    if (!this.practice) {
      const ts = this.actors.filter(a => a.team === 'T');
      if (ts.length) { const c = ts[Math.floor(Math.random() * ts.length)]; c.hasBomb = true; }
      planRound(this);
      for (const a of this.actors) if (a.brain) a.brain.onRoundStart();
    }
    this.ui.roundStart && this.ui.roundStart(this);
    this.centerMsg(this.practice ? 'Тренировка: B — закупка, гранаты бесплатные' : (this.round === 1 ? 'Пистолетный раунд' : `Раунд ${this.round}`), 2.5);
  }
  _swapSides() {
    for (const a of this.actors) { a.team = a.team === 'T' ? 'CT' : 'T'; a.money = 800; a.kills = a.kills; const ag = a.bot ? AGENTS.filter(x => x.team === a.team)[a.id % 5] : agentById[this.o.agents[a.team]];
      this.scene.remove(a.model.root); a.agent = ag; a.model = new AgentModel(ag, 'knife'); this.scene.add(a.model.root); this.resetLoadout(a, true); }
    this.score = { T: this.score.CT, CT: this.score.T }; this.lossStreak = { T: 0, CT: 0 };
    this.playerSide = this.player.team;
    this._buildViewmodel();
    this.centerMsg('Смена сторон!', 3);
  }
  endRound(winner, reason) {
    if (this.state === 'end') return;
    this.state = 'end'; this.stateT = END_TIME;
    this.score[winner]++;
    const loser = winner === 'T' ? 'CT' : 'T';
    this.lossStreak[winner] = 0; this.lossStreak[loser] = Math.min(4, this.lossStreak[loser] + 1);
    const lossMoney = 1400 + 500 * (this.lossStreak[loser] - 1);
    for (const a of this.actors) {
      if (a.team === winner) a.money += reason === 'bomb' ? 3500 : 3250;
      else a.money += lossMoney + (a.team === 'T' && this.bomb && this.bomb.planted ? 800 : 0);
      a.money = Math.min(16000, a.money);
    }
    const text = winner === 'T' ? 'Террористы победили' : 'Спецназ победил';
    this.centerMsg(text + (reason === 'bomb' ? ' — бомба взорвана' : reason === 'defuse' ? ' — бомба обезврежена' : reason === 'time' ? ' — время вышло' : ''), END_TIME - 0.5, winner === 'T' ? '#e8b04a' : '#6aa8ff');
    play(winner === this.player.team ? 'win' : 'lose');
    this.ui.onRoundEnd && this.ui.onRoundEnd(this, winner);
  }
  checkWin() {
    if (this.practice || this.state !== 'live' && this.state !== 'planted') return;
    const aliveT = this.actors.some(a => a.alive && a.team === 'T'), aliveCT = this.actors.some(a => a.alive && a.team === 'CT');
    const planted = this.bomb && this.bomb.planted;
    if (!aliveCT) this.endRound('T', 'elim');
    else if (!aliveT && !planted) this.endRound('CT', 'elim');
  }
  centerMsg(t, dur = 2, color = '#fff') { this.ui.center(t, dur, color); }

  // ---------- оружие ----------
  selectSlot(a, slot, instant) {
    let inst = null;
    if (slot === 4) { if (!a.nades.length) return; a.nadeIdx = ((a.slot === 4 ? (a.nadeIdx || 0) + 1 : (a.nadeIdx || 0))) % a.nades.length; inst = { id: a.nades[a.nadeIdx], nade: true }; }
    else if (slot === 5) { if (!a.hasBomb) return; inst = { id: 'c4', c4: true }; }
    else { inst = a.weapons[slot]; if (!inst) return; }
    if (a.slot !== slot) a.last = a.slot;
    a.slot = slot; a.cur = inst; a.reloadT = 0; a.scope = 0; a.switchT = instant ? 0 : 0.45; a.recoilIdx = 0;
    if (!instant && this.isView(a)) play('draw');
    const modelId = inst.nade || inst.c4 ? inst.id : (inst.model || inst.id);
    a.model.setWeapon(modelId, inst.skin);
  }
  cycle(a, dir) {
    const order = [1, 2, 3, 4, 5].filter(s => (s <= 3 ? a.weapons[s] : s === 4 ? a.nades.length : a.hasBomb));
    let i = order.indexOf(a.slot); i = (i + dir + order.length) % order.length; this.selectSlot(a, order[i]);
  }
  canBuy(a) {
    if (this.practice) return true;
    if (!(this.state === 'freeze' || (this.state === 'live' && ROUND_TIME - this.roundTime < 20))) return false;
    return this.world.inSpawn(a.pos.x, a.pos.z, a.team);
  }
  priceOf(a, id) {
    if (WEAPONS[id]) return WEAPONS[id].price;
    if (NADES[id]) return a.team === 'CT' && id === 'molotov' ? NADES[id].ctPrice : NADES[id].price;
    if (GEAR[id]) return id === 'vesthelm' && a.armor >= 100 && !a.helmet ? 350 : GEAR[id].price;
    return 0;
  }
  canTeam(a, id) { const d = WEAPONS[id] || GEAR[id]; return !(d && d.team && d.team !== a.team); }
  buy(a, id) {
    if (!this.canBuy(a) || !this.canTeam(a, id)) return false;
    const price = this.priceOf(a, id); if (a.money < price && !this.practice) return false;
    if (WEAPONS[id]) { const def = WEAPONS[id]; const cur = a.weapons[def.slot]; if (cur && cur.id === id) { cur.reserve = def.reserve; if (!this.practice) return false; } this.give(a, id); this.selectSlot(a, def.slot); }
    else if (NADES[id]) { const cnt = a.nades.filter(n => n === id).length; if (cnt >= NADES[id].max || a.nades.length >= 4) return false; a.nades.push(id); }
    else if (id === 'vest') { if (a.armor >= 100) return false; a.armor = 100; }
    else if (id === 'vesthelm') { if (a.armor >= 100 && a.helmet) return false; a.armor = 100; a.helmet = true; }
    else if (id === 'kit') { if (a.kit || a.team !== 'CT') return false; a.kit = true; }
    if (!this.practice) a.money -= price;
    if (a === this.player) play('buy');
    return true;
  }
  _buildViewmodel(a = this.viewing || this.player) {
    if (!a || !a.cur) return;
    const inst = a.cur, id = inst.nade || inst.c4 ? inst.id : (inst.model || inst.id);
    this.vmKey = a.id + '|' + a.agent.id + '|' + id + '|' + inst.skin;
    this.vm.clear();
    const gun = buildWeapon(id, inst.skin);
    const arms = buildViewArms(a.agent);
    const g = new THREE.Group(); g.add(gun);
    const R = arms.userData.right, L = arms.userData.left;
    R.position.set(0.01, -0.05, 0.05); R.rotation.set(0.75, 0.25, 0); g.add(R);
    const fore = gun.userData.fore;
    if (inst.nade || inst.c4 || WEAPONS[id] && WEAPONS[id].type === 'knife' || KNIVES[id] || id === 'knife') { L.position.set(-0.36, -0.2, 0.12); L.rotation.set(0.6, -0.4, 0); }
    else if (WEAPONS[id] && WEAPONS[id].type === 'pistol') { L.position.set(-0.03, -0.07, 0.04); L.rotation.set(0.75, -0.35, 0); }
    else { L.position.set(fore.x - 0.03, fore.y - 0.03, fore.z + 0.02); L.rotation.set(0.7, -0.5, 0); }
    g.add(L);
    g.scale.setScalar(0.62);
    this.vmGun = g; this.vmMuzzle = gun.userData.muzzle.clone();
    this.vm.add(g);
    const t = WEAPONS[id] ? WEAPONS[id].type : 'nade';
    this.vmBase = t === 'pistol' ? new THREE.Vector3(0.13, -0.13, -0.36) : t === 'knife' || t === 'nade' || !WEAPONS[id] ? new THREE.Vector3(0.15, -0.14, -0.32) : new THREE.Vector3(0.14, -0.15, -0.34);
    this.vmKick = 0; this.vmDraw = 1;
  }
  eyePos(a, out = new THREE.Vector3()) { return out.set(a.pos.x, a.pos.y + EYE - (EYE - EYE_C) * a.crouchK, a.pos.z); }
  aimDir(a, out = new THREE.Vector3(), extraP = 0, extraY = 0) {
    const p = a.pitch + extraP, y = a.yaw + extraY;
    return out.set(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
  }
  hspeed(a) { return Math.hypot(a.vel.x, a.vel.z); }

  tryFire(a) {
    const inst = a.cur; if (!inst || a.fireCd > 0 || a.switchT > 0) return;
    if (inst.c4) return;
    if (inst.nade) { this.throwNade(a, inst.id); return; }
    const def = WEAPONS[inst.id];
    if (def.type === 'knife') { this.knife(a); a.fireCd = def.rate; return; }
    if (a.reloadT > 0) return;
    if (!def.auto && !a.released) return;
    if (inst.mag <= 0) { if (a.released) { if (a === this.player) play('empty'); this.reload(a); } a.released = false; return; }
    a.released = false;
    inst.mag--; a.fireCd = def.rate; a.lastFired = this.time;
    if (a === this.player && this.admin.ammo) inst.mag++;
    if (this.time - a.lastShot > def.rate * 2.2) a.recoilIdx = Math.max(0, a.recoilIdx - (this.time - a.lastShot) * 10);
    a.lastShot = this.time;
    // разброс
    const sp = this.hspeed(a);
    let spread = def.spread;
    const mv = Math.max(0, Math.min(1, (sp - 1.3) / (def.speed - 1.3)));
    spread += def.move * mv;
    if (!a.onGround) spread += def.move * 1.6 + 0.04;
    if (a.crouchK > 0.5) spread *= 0.75;
    if (def.scope && !a.scope) spread += def.noscope;
    spread += def.recoil * 0.25 * Math.min(a.recoilIdx, 10) * (def.type === 'pistol' ? 0.6 : 0.15);
    const pellets = 1;
    const comp = a.bot ? a.brain.comp : 0;
    for (let k = 0; k < pellets; k++) {
      const rr = Math.sqrt(Math.random()) * spread, ang = Math.random() * Math.PI * 2;
      const dir = this.aimDir(a, new THREE.Vector3(), a.punch.p * (1 - comp) + Math.sin(ang) * rr, a.punch.y * (1 - comp) + Math.cos(ang) * rr);
      this.bullet(a, dir, def);
    }
    // отдача
    const ri = a.recoilIdx;
    a.punch.p += def.recoil * (ri < 3 ? 0.7 : ri < 9 ? 1.1 : 0.4);
    a.punch.y += def.recoil * (ri < 6 ? (Math.random() - 0.5) * 0.4 : Math.sin(ri * 0.55) * 0.9);
    a.punch.p = Math.min(a.punch.p, 0.22);
    a.recoilIdx += 1;
    if (def.scope && a.scope) { a.scope = 0; a.rescope = def.rate * 0.95; }
    // звук и вспышка
    const snd = soundFor(inst.id);
    if (this.isView(a)) { play(snd, 0, 0, a === this.player ? 1 : 0.8); this.vmKick = 1; this.flash.visible = !def.silenced; this.flashT = 0.05; this.flash.material.rotation = Math.random() * 6; }
    else { const [d, pan] = this.listen(a.pos); play(snd, d, pan); this.worldFlash(a); }
    this.noise(a, def.silenced ? 8 : 35);
    if (inst.mag === 0 && a.bot) this.reload(a);
  }
  noise(a, radius) { a.noiseR = radius; a.noiseT = this.time; }
  isView(a) { return a === (this.viewing || this.player); }
  listen(p) { const pl = this.viewing || this.player, dx = p.x - pl.pos.x, dz = p.z - pl.pos.z, d = Math.hypot(dx, dz); const right = [Math.cos(pl.yaw), -Math.sin(pl.yaw)]; const pan = d > 0.1 ? (dx * right[0] + dz * right[1]) / d : 0; return [d, pan * 0.8]; }
  worldFlash(a) {
    const m = a.model; if (!m.gun || !m.root.visible) return;
    const p = m.gun.userData.muzzle.clone(); m.gun.localToWorld(p);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: '#ffc060', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    s.position.copy(p); s.scale.setScalar(0.5); this.scene.add(s); this.fx.push({ obj: s, t: 0.05 });
  }
  reload(a) {
    const inst = a.cur; if (!inst || inst.nade || inst.c4) return; const def = WEAPONS[inst.id];
    if (!def.mag || a.reloadT > 0 || inst.mag >= def.mag || inst.reserve <= 0) return;
    a.reloadT = def.reload; a.scope = 0;
    if (this.isView(a)) play('reload'); else { const [d, pan] = this.listen(a.pos); play('reload', d, pan); }
  }
  // точки попаданий по актёру
  hitTest(o, d, maxT, shooter) {
    let best = null;
    for (const v of this.actors) {
      if (!v.alive || v === shooter) continue;
      if (v.team === shooter.team && !this.practice) continue;
      const s = 1 - 0.3 * v.crouchK;
      // быстрый отсев
      const cx = v.pos.x - o.x, cz = v.pos.z - o.z, tc = cx * d.x + cz * d.z;
      if (tc < -1 || tc > maxT + 1) continue;
      for (const [zone, hy, r, mult] of ZONES) {
        const px = v.pos.x - o.x, py = v.pos.y + hy * s - o.y, pz = v.pos.z - o.z;
        const tca = px * d.x + py * d.y + pz * d.z; if (tca < 0) continue;
        const d2 = px * px + py * py + pz * pz - tca * tca, rr = r * r; if (d2 > rr) continue;
        const t = tca - Math.sqrt(rr - d2);
        if (t < maxT && (!best || t < best.t)) best = { v, t, zone, mult };
      }
    }
    return best;
  }
  bullet(a, dir, def) {
    const o = this.eyePos(a);
    const maxD = 150;
    const hit = this.world.rayHit(o.x, o.y, o.z, dir.x, dir.y, dir.z, maxD);
    const h = this.hitTest(o, dir, hit.t, a);
    const end = new THREE.Vector3().copy(o).addScaledVector(dir, h ? h.t : hit.t);
    // трассер от дула
    let from;
    if (a === this.player) from = new THREE.Vector3().copy(o).addScaledVector(dir, 0.6).add(new THREE.Vector3(Math.cos(a.yaw) * 0.12, -0.1, -Math.sin(a.yaw) * 0.12));
    else from = new THREE.Vector3().copy(o).addScaledVector(dir, 0.6).add(new THREE.Vector3(0, -0.15, 0));
    if (Math.random() < (a === this.player ? 0.35 : 0.6)) this.tracer(from, end);
    if (h) {
      this.damage(h.v, a, def.dmg * Math.pow(0.985, h.t / 5), h.zone, h.mult, def, dir);
      this.puff(end, '#a01010', 0.35);
    } else if (hit.t < maxD) {
      this.decal(end, hit.n);
      this.puff(end, '#9a9184', 0.25);
    }
  }
  knife(a) {
    const o = this.eyePos(a), dir = this.aimDir(a);
    if (this.isView(a)) { this.vmKick = 1; play('knife'); } else { const [d, pan] = this.listen(a.pos); play('knife', d, pan); }
    for (const v of this.actors) {
      if (!v.alive || v === a || (v.team === a.team && !this.practice)) continue;
      const to = new THREE.Vector3(v.pos.x - o.x, v.pos.y + 1.2 - o.y, v.pos.z - o.z), d = to.length();
      if (d > 2.0) continue;
      to.normalize(); if (to.dot(dir) < 0.75) continue;
      // удар в спину сильнее
      const behind = Math.cos(v.yaw - a.yaw) > 0.5;
      this.damage(v, a, behind ? 90 : 40, 'chest', 1, WEAPONS.knife, dir);
      return;
    }
  }
  damage(v, a, raw, zone, mult, def, dir) {
    if (!v.alive) return;
    if (v === this.player && this.admin.god) return;
    if (a === this.player && v !== a && this.admin.oneshot) raw *= 20;
    let dmg = raw * mult;
    const pen = def.pen || 1;
    if (v.armor > 0 && zone !== 'legs' && (zone !== 'head' || v.helmet)) { const ad = dmg * (1 - pen) * 0.5; v.armor = Math.max(0, v.armor - ad); dmg *= pen; }
    dmg = Math.round(dmg);
    v.hp -= dmg; v.lastHurt = this.time; v.lastAttacker = a;
    if (v.brain) v.brain.onHurt(a, dir);
    if (a === this.player) { play(zone === 'head' ? 'head' : 'hit'); this.ui.hitmark(zone === 'head'); }
    if (v === this.player) { play('hurt'); this.ui.hurt(dir, this.player); }
    // замедление от попадания
    v.vel.x *= 0.5; v.vel.z *= 0.5;
    if (v.hp <= 0) this.kill(v, a, def, zone === 'head', dir);
  }
  kill(v, a, def, hs, dir) {
    v.hp = 0; v.alive = false; v.deaths++;
    const fwd = dir ? (-Math.sin(v.yaw) * dir.x - Math.cos(v.yaw) * dir.z) : 1;
    v.model.kill(fwd > 0 ? -1 : 1);
    v.model.root.visible = true;
    if (v === this.player) { this.vm.visible = false; }
    if (a && a !== v) {
      if (a.team !== v.team) { a.kills++; a.roundKills++; a.money = Math.min(16000, a.money + (def.kill || 300)); }
      if (a === this.player && this.ui.onKill) this.ui.onKill(hs);
    }
    // бомба выпадает
    if (v.hasBomb) { v.hasBomb = false; this.dropBomb(v.pos); }
    const wid = def ? (def === WEAPONS.knife && a && a.cur && a.cur.model ? a.cur.model : Object.keys(WEAPONS).find(k => WEAPONS[k] === def) || def.icon) : 'skull';
    this.ui.feed(a, v, wid, hs, this.player);
    this.checkWin();
  }

  // ---------- гранаты ----------
  throwNade(a, type, vel) {
    const i = a.nades.indexOf(type); if (i < 0) return;
    a.nades.splice(i, 1);
    const o = this.eyePos(a);
    if (!vel) {
      const d = this.aimDir(a, new THREE.Vector3(), 0.08);
      vel = d.multiplyScalar(a.in.walk ? 9 : 16).add(new THREE.Vector3(a.vel.x * 0.5, 0, a.vel.z * 0.5));
    }
    const mesh = buildWeapon(type, null); mesh.scale.setScalar(1.3);
    mesh.position.copy(o); this.scene.add(mesh);
    this.nades.push({ type, pos: o.clone(), vel: vel.clone(), t: 0, owner: a, mesh, landed: false });
    if (this.isView(a)) { this.vmKick = 1; play('throw'); }
    if (!this.practice || a.bot) {
      if (a.nades.length) this.selectSlot(a, 4, false); else this.selectSlot(a, a.weapons[1] ? 1 : 2);
    } else {
      a.nades.push(type); this.selectSlot(a, 4, true);
    }
  }
  _updNades(dt) {
    for (let k = this.nades.length - 1; k >= 0; k--) {
      const n = this.nades[k]; n.t += dt;
      const sub = 3, h = dt / sub;
      for (let s = 0; s < sub && !n.dead; s++) {
        n.vel.y -= GRAV * h;
        let nx = n.pos.x + n.vel.x * h, nz = n.pos.z + n.vel.z * h, ny = n.pos.y + n.vel.y * h;
        if (this.world.hAtPos(nx, n.pos.z) > n.pos.y) { n.vel.x *= -0.45; nx = n.pos.x; this._bounce(n); }
        if (this.world.hAtPos(nx, nz) > n.pos.y) { n.vel.z *= -0.45; nz = n.pos.z; this._bounce(n); }
        const gh = Math.max(this.world.hAtPos(nx, nz), -70);
        if (ny <= gh + 0.05 && n.vel.y < 0) {
          ny = gh + 0.05; n.vel.y = -n.vel.y * 0.35;
          const fr = n.type === 'smoke' ? 0.25 : 0.55; n.vel.x *= fr; n.vel.z *= fr;
          if (Math.abs(n.vel.y) < 1.2) n.vel.y = 0;
          this._bounce(n);
          if (n.type === 'molotov' && gh >= 0) { this.popNade(n); }
        }
        if (ny > 30) ny = 30;
        n.pos.set(nx, ny, nz);
      }
      if (n.dead) { this.nades.splice(k, 1); continue; }
      n.mesh.position.copy(n.pos); n.mesh.rotation.x += dt * 8; n.mesh.rotation.z += dt * 5;
      const sp = n.vel.length();
      if ((n.type === 'he' && n.t > 1.6) || (n.type === 'flash' && n.t > 1.4) || (n.type === 'smoke' && ((sp < 0.4 && n.t > 0.6) || n.t > 3.5)) || (n.type === 'molotov' && n.t > 2.4) || n.pos.y < -50) this.popNade(n);
      if (n.dead) this.nades.splice(k, 1);
    }
  }
  _bounce(n) { if (n.t - (n.lb || 0) > 0.12) { n.lb = n.t; const [d, pan] = this.listen(n.pos); play('bounce', d, pan); } }
  popNade(n) {
    if (n.dead) return; n.dead = true; this.scene.remove(n.mesh);
    const [d, pan] = this.listen(n.pos), p = n.pos.clone();
    if (p.y < -40) return;
    if (n.type === 'he') {
      play('he', d, pan); this.explosionFx(p, 3);
      for (const v of this.actors) {
        if (!v.alive) continue;
        const e = this.eyePos(v), dist = e.distanceTo(p); if (dist > 8) continue;
        if (!this.world.los(p.clone().setY(p.y + 0.3), new THREE.Vector3(v.pos.x, v.pos.y + 1, v.pos.z))) continue;
        let dmg = 98 * Math.max(0, 1 - dist / 8); if (v.armor > 0) { dmg *= 0.55; v.armor = Math.max(0, v.armor - dmg * 0.3); }
        if (v.team === n.owner.team && v !== n.owner && !this.practice) continue;
        this.damage(v, n.owner, dmg, 'chest', 1, { pen: 1, kill: 300, icon: 'he' }, new THREE.Vector3().subVectors(v.pos, p).normalize());
      }
    } else if (n.type === 'flash') {
      play('flash', d, pan); this.explosionFx(p, 1.5, '#ffffff');
      const fp = p.clone().setY(p.y + 0.2);
      for (const v of this.actors) {
        if (!v.alive) continue;
        const e = this.eyePos(v), dist = e.distanceTo(fp); if (dist > 32) continue;
        if (!this.world.los(fp, e) || this.smokeBlocks(fp, e)) continue;
        const to = new THREE.Vector3().subVectors(fp, e).normalize(), dot = to.dot(this.aimDir(v));
        let amt = dot > 0.6 ? 1 : dot > 0.1 ? 0.6 : dot > -0.4 ? 0.3 : 0.12;
        amt *= Math.max(0.2, 1 - dist / 34);
        const dur = 4.6 * amt;
        if (dur > v.blind) v.blind = dur;
        if (v === this.player) this.ui.flashed(dur);
      }
    } else if (n.type === 'smoke') {
      play('smoke', d, pan); this.spawnSmoke(p.setY(Math.max(0, p.y)));
    } else if (n.type === 'molotov') {
      play('fire', d, pan);
      const gp = p.clone().setY(Math.max(0, this.world.hAtPos(p.x, p.z)));
      if (this.smokes.some(s => s.c.distanceTo(gp) < s.r * 0.8)) { this.puff(gp, '#888', 0.8); return; }
      this.spawnFire(gp, n.owner);
    }
  }
  spawnSmoke(p) {
    const grp = new THREE.Group(); grp.position.copy(p);
    const parts = [];
    const nP = this.quality >= 1 ? 22 : 14;
    for (let i = 0; i < nP; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: new THREE.Color().setHSL(0, 0, 0.72 + Math.random() * 0.12), transparent: true, opacity: 0.0, depthWrite: false, fog: true }));
      const a = Math.random() * 6.28, r = Math.random() * 2.6, y = 0.4 + Math.random() * 2.6;
      s.userData.o = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r); s.userData.sz = 2.6 + Math.random() * 1.6;
      grp.add(s); parts.push(s);
    }
    this.scene.add(grp);
    // дым тушит огонь
    for (const f of this.fires) if (f.c.distanceTo(p) < 4) f.t = Math.min(f.t, 0.3);
    this.smokes.push({ c: p.clone().setY(p.y + 1.3), r: 0, R: 3.6, t: 0, life: 17.5, grp, parts });
  }
  smokeBlocks(a, b) {
    for (const s of this.smokes) {
      if (s.r < 1) continue;
      const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z, L2 = abx * abx + aby * aby + abz * abz;
      let t = ((s.c.x - a.x) * abx + (s.c.y - a.y) * aby + (s.c.z - a.z) * abz) / L2; t = Math.max(0, Math.min(1, t));
      const px = a.x + abx * t - s.c.x, py = (a.y + aby * t - s.c.y) * 1.4, pz = a.z + abz * t - s.c.z;
      if (px * px + py * py + pz * pz < s.r * s.r * 0.85) return true;
    }
    return false;
  }
  spawnFire(p, owner) {
    const grp = new THREE.Group(); grp.position.copy(p); const parts = [];
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: i % 3 ? '#ff7a1a' : '#ffd23a', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 2.4; s.userData.o = new THREE.Vector3(Math.cos(a) * r, 0.3, Math.sin(a) * r); s.userData.ph = Math.random() * 6;
      grp.add(s); parts.push(s);
    }
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.5, depthWrite: false }));
    scorch.position.y = 0.02; grp.add(scorch);
    this.scene.add(grp);
    this.fires.push({ c: p.clone(), r: 2.6, t: 7, grp, parts, owner });
  }
  inFire(p) { for (const f of this.fires) if (Math.hypot(p.x - f.c.x, p.z - f.c.z) < f.r + 0.3 && p.y < f.c.y + 1) return f; return null; }
  explosionFx(p, size, color = '#ffb04a') {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    s.position.copy(p); s.scale.setScalar(size * 2); this.scene.add(s); this.fx.push({ obj: s, t: 0.35, grow: size * 6 });
  }

  // ---------- эффекты ----------
  _initTracers() {
    this.tracers = [];
    for (let i = 0; i < 40; i++) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.8 }));
      l.visible = false; l.frustumCulled = false; this.scene.add(l); this.tracers.push({ l, t: 0 });
    }
    this.tracerI = 0;
    this.decalGeo = new THREE.PlaneGeometry(0.12, 0.12); this.decalMat = new THREE.MeshBasicMaterial({ color: '#1a1714', transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  }
  tracer(a, b) {
    const tr = this.tracers[this.tracerI++ % this.tracers.length];
    const arr = tr.l.geometry.attributes.position.array; arr[0] = a.x; arr[1] = a.y; arr[2] = a.z; arr[3] = b.x; arr[4] = b.y; arr[5] = b.z;
    tr.l.geometry.attributes.position.needsUpdate = true; tr.l.visible = true; tr.t = 0.06;
  }
  decal(p, n) {
    const d = new THREE.Mesh(this.decalGeo, this.decalMat);
    d.position.copy(p).addScaledVector(n, 0.01); d.lookAt(p.clone().add(n)); this.scene.add(d); this.decals.push(d);
    if (this.decals.length > 80) this.scene.remove(this.decals.shift());
  }
  puff(p, color, size) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color, transparent: true, opacity: 0.8, depthWrite: false }));
    s.position.copy(p); s.scale.setScalar(size); this.scene.add(s); this.fx.push({ obj: s, t: 0.3, grow: size * 3 });
  }

  // ---------- бомба ----------
  dropBomb(p) {
    this.bomb = { planted: false, dropped: true, pos: p.clone().setY(Math.max(0, this.world.hAtPos(p.x, p.z))) };
    this._c4Mesh(this.bomb.pos);
  }
  _c4Mesh(p) {
    if (this.c4mesh) this.scene.remove(this.c4mesh);
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.22), mat('#6b5a3a')); b.position.y = 0.05; g.add(b);
    const scr = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.08), mat('#2a3a2a')); scr.position.set(0.05, 0.11, 0); g.add(scr);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2020' })); led.position.set(-0.08, 0.12, 0); g.add(led);
    g.userData.led = led; g.position.copy(p); this.scene.add(g); this.c4mesh = g;
  }
  plant(a) {
    a.hasBomb = false;
    const site = this.world.siteAt(a.pos.x, a.pos.z) === 1 ? 'A' : 'B';
    this.bomb = { planted: true, pos: a.pos.clone(), timer: BOMB_TIME, site, beep: 0 };
    this._c4Mesh(this.bomb.pos);
    this.state = 'planted';
    a.money += 300;
    this.centerMsg(`Бомба заложена на ${site}!`, 2.5, '#ff6a4a');
    play('plant');
    this.selectSlot(a, a.weapons[1] ? 1 : 2);
    for (const b of this.actors) if (b.brain) b.brain.onPlanted(this.bomb);
  }
  _updBomb(dt) {
    const B = this.bomb;
    if (!B) return;
    if (B.dropped) {
      for (const a of this.actors) if (a.alive && a.team === 'T' && !(a === this.player && this.time < (B.noPick || 0)) && Math.hypot(a.pos.x - B.pos.x, a.pos.z - B.pos.z) < 0.9) {
        a.hasBomb = true; this.bomb = null; this.scene.remove(this.c4mesh); this.c4mesh = null;
        if (a === this.player) this.centerMsg('Вы подобрали бомбу (5)', 1.5);
        return;
      }
      return;
    }
    if (!B.planted || B.done) return;
    B.timer -= dt;
    B.beep -= dt;
    const rate = B.timer > 20 ? 1 : B.timer > 10 ? 0.5 : B.timer > 4 ? 0.25 : 0.12;
    if (B.beep <= 0) { B.beep = rate; const [d, pan] = this.listen(B.pos); play('beep', d * 0.5, pan); if (this.c4mesh) this.c4mesh.userData.led.visible = true; }
    else if (this.c4mesh && B.beep < rate * 0.6) this.c4mesh.userData.led.visible = false;
    if (B.timer <= 0) {
      B.done = true; const [d, pan] = this.listen(B.pos); play('boom', d * 0.3, pan); this.explosionFx(B.pos.clone().setY(1), 10);
      for (const v of this.actors) if (v.alive) { const dist = v.pos.distanceTo(B.pos); if (dist < 20) { const dmg = 500 * (1 - dist / 20); this.damage(v, null, dmg, 'chest', 1, { pen: 1 }, null); } }
      if (this.state !== 'end') this.endRound('T', 'bomb');
    }
  }

  // ---------- игрок ----------
  _playerInput(dt) {
    const p = this.player, c = this.ctrl, st = c.s;
    const [lx, ly] = c.takeLook();
    if (this.ui.menuOpen()) { c.edges.clear(); p.in.fire = false; p.in.mx = p.in.mz = 0; p.in.jump = p.in.crouch = p.in.use = false; return; }
    if (c.edge('pause') || c.edge('unlocked')) { this.ui.pause(); return; }
    if (c.edge('buy')) { if (this.canBuy(p)) this.ui.openBuy(); else this.centerMsg('Закупка недоступна', 1); }
    if (!p.alive) {
      if (c.edge('fireP')) this.spectNext(1);
      if (c.edge('aim')) this.spectNext(-1);
      if (c.edge('jumpP') || c.edge('swap')) this.spectTP = !this.spectTP;
      c.edges.clear(); return;
    }
    const zoom = p.scope ? (p.scope === 1 ? 0.45 : 0.18) : 1;
    const sens = 0.0022 * (this.settings.sens || 1) * zoom;
    p.yaw -= lx * sens; p.pitch -= ly * sens * (this.settings.invertY ? -1 : 1);
    p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch));
    const f = st.my, r = st.mx;
    const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    p.in.mx = -sy * f + cy * r; p.in.mz = -cy * f - sy * r;
    const L = Math.hypot(p.in.mx, p.in.mz); if (L > 1) { p.in.mx /= L; p.in.mz /= L; }
    p.in.jump = st.jump || c.edge('jumpP'); p.in.crouch = st.crouch; p.in.walk = st.walk; p.in.use = st.use;
    p.in.fire = st.fire;
    if (c.edge('fireR')) p.released = true;
    if (!st.fire) p.released = true;
    if (c.edge('reload')) this.reload(p);
    for (const s of [1, 2, 3, 4, 5]) if (c.edge('slot' + s)) this.selectSlot(p, s);
    if (c.edge('last')) this.selectSlot(p, p.last);
    if (c.edge('next') || c.edge('swap')) this.cycle(p, 1);
    if (c.edge('prev')) this.cycle(p, -1);
    if (c.edge('nade')) { if (p.nades.length) this.selectSlot(p, 4); else this.centerMsg('Нет гранат', 1); }
    if (c.edge('aim')) {
      const def = p.cur && WEAPONS[p.cur.id];
      if (def && def.scope && p.switchT <= 0 && p.reloadT <= 0) p.scope = (p.scope + 1) % 3;
    }
    if (c.edge('bomb')) this.selectSlot(p, 5);
    if (c.edge('drop') && p.hasBomb) {
      p.hasBomb = false; const d = this.aimDir(p); this.dropBomb(new THREE.Vector3(p.pos.x + d.x * 1.5, 0, p.pos.z + d.z * 1.5));
      this.bomb.noPick = this.time + 1.5; if (p.slot === 5) this.selectSlot(p, p.weapons[1] ? 1 : 2);
    }
    c.edge('fireP');
  }
  spectNext(dir = 1) {
    // сначала союзники, если их нет — любой живой
    let al = this.actors.filter(a => a.alive && a !== this.player && a.team === this.player.team);
    if (!al.length) al = this.actors.filter(a => a.alive && a !== this.player);
    if (!al.length) { this.spect = null; return; }
    const i = al.indexOf(this.spect); this.spect = al[(i + dir + al.length) % al.length];
    this.camYaw = this.spect.yaw; this.camPitch = this.spect.pitch;
  }

  // ---------- физика ----------
  _blocked(x, z, feet) {
    const w = this.world, i0 = Math.floor((x - RADIUS) / CELL), i1 = Math.floor((x + RADIUS) / CELL), j0 = Math.floor((z - RADIUS) / CELL), j1 = Math.floor((z + RADIUS) / CELL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const h = w.hAt(i, j);
      if (h > feet + STEP) {
        const cx = Math.max(i * CELL, Math.min(x, (i + 1) * CELL)), cz = Math.max(j * CELL, Math.min(z, (j + 1) * CELL));
        if ((cx - x) ** 2 + (cz - z) ** 2 < RADIUS * RADIUS) return true;
      }
    }
    return false;
  }
  _ground(x, z, feet) {
    const w = this.world, r = RADIUS * 0.7; let g = -1e9;
    for (const [ox, oz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) { const h = w.hAtPos(x + ox, z + oz); if (h <= feet + STEP + 0.01 && h > g) g = h; }
    return g;
  }
  _move(a, dt) {
    if (!a.alive) return;
    const inst = a.cur, def = inst && WEAPONS[inst.id];
    let max = def ? def.speed : 5.8;
    if (inst && inst.nade) max = 6.0;
    if (a.in.walk) max *= 0.52;
    const wantC = a.in.crouch ? 1 : 0;
    a.crouchK += (wantC - a.crouchK) * Math.min(1, dt * 12);
    if (a.crouchK > 0.5) max *= 0.34;
    if (a.scope) max *= 0.6;
    if (a.plantT > 0 || a.defuseT > 0) max = 0;
    if (a === this.player && this.admin.speed) max *= 1.6;
    const f = this.inFire(a.pos); if (f) { a.fireDmgT = (a.fireDmgT || 0) + dt; if (a.fireDmgT > 0.25) { a.fireDmgT = 0; this.damage(a, f.owner, 10, 'legs', 1.0, { pen: 1, kill: 300, icon: 'molotov' }, null); } }
    if (!a.alive) return;
    const wx = a.in.mx * max, wz = a.in.mz * max;
    const acc = a.onGround ? 48 : 8;
    let dx = wx - a.vel.x, dz = wz - a.vel.z; const dl = Math.hypot(dx, dz), stepA = acc * dt;
    if (dl > stepA) { dx *= stepA / dl; dz *= stepA / dl; }
    a.vel.x += dx; a.vel.z += dz;
    if (a.in.jump && a.onGround && a.crouchK < 0.9) { a.vel.y = JUMP_V; a.onGround = false; }
    a.vel.y -= GRAV * dt;
    let nx = a.pos.x + a.vel.x * dt, nz = a.pos.z + a.vel.z * dt;
    if (this._blocked(nx, a.pos.z, a.pos.y)) { nx = a.pos.x; a.vel.x = 0; }
    if (this._blocked(nx, nz, a.pos.y)) { nz = a.pos.z; a.vel.z = 0; }
    a.pos.x = nx; a.pos.z = nz;
    let ny = a.pos.y + a.vel.y * dt;
    const g = this._ground(a.pos.x, a.pos.z, a.pos.y);
    if (ny <= g) { if (!a.onGround && a.vel.y < -11) this.damage(a, a, (-a.vel.y - 11) * 9, 'legs', 1, { pen: 1, icon: 'fall' }, null); ny = g; a.vel.y = 0; a.onGround = true; }
    else if (ny > g + 0.05) a.onGround = false;
    // ступенька вверх при беге не нужна: ящики 1м — только прыжком
    a.pos.y = ny;
    if (a.pos.y < -12) { this.damage(a, a, 999, 'chest', 1, { pen: 1, icon: 'fall' }, null); }
    // шаги
    const hs = this.hspeed(a);
    if (a.onGround && hs > 3.2 && !a.in.walk && a.crouchK < 0.5) {
      a.stepT -= dt * hs; if (a.stepT <= 0) { a.stepT = 2.2; this.noise(a, 16); if (!this.isView(a)) { const [d, pan] = this.listen(a.pos); if (d < 30) play('step', d, pan); } else play('step', 0, 0, 0.45); }
    }
  }
  _separate() {
    const L = this.actors;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j]; if (!a.alive || !b.alive) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.6 && d > 0.001 && Math.abs(a.pos.y - b.pos.y) < 1.5) {
        const push = (0.6 - d) / 2, ux = dx / d * push, uz = dz / d * push;
        if (!this._blocked(a.pos.x - ux, a.pos.z - uz, a.pos.y)) { a.pos.x -= ux; a.pos.z -= uz; }
        if (!this._blocked(b.pos.x + ux, b.pos.z + uz, b.pos.y)) { b.pos.x += ux; b.pos.z += uz; }
      }
    }
  }
  _weapons(a, dt) {
    if (!a.alive) return;
    a.fireCd -= dt; a.switchT = Math.max(0, a.switchT - dt); a.blind = Math.max(0, a.blind - dt);
    if (a.rescope > 0) { a.rescope -= dt; if (a.rescope <= 0 && a === this.player) a.scope = 0; }
    const def = a.cur && WEAPONS[a.cur.id];
    if (a.reloadT > 0) {
      a.reloadT -= dt;
      if (a.reloadT <= 0 && a.cur) { const need = def.mag - a.cur.mag, take = Math.min(need, a.cur.reserve); a.cur.mag += take; a.cur.reserve -= take; }
    }
    // восстановление отдачи
    const rec = Math.min(1, dt * (this.time - a.lastShot > 0.15 ? 9 : 3));
    a.punch.p -= a.punch.p * rec; a.punch.y -= a.punch.y * rec;
    if (this.time - a.lastShot > 0.4) a.recoilIdx = Math.max(0, a.recoilIdx - dt * 14);
    if (a.in.fire && this.state !== 'freeze') this.tryFire(a);
    if (!a.in.fire) a.released = true;
    // закладка / разминирование
    const T = a.team === 'T';
    if (T && a.hasBomb && a.in.use && a.onGround && this.world.siteAt(a.pos.x, a.pos.z) && (this.state === 'live')) {
      if (a.cur && !a.cur.c4) this.selectSlot(a, 5, true);
      a.plantT += dt; if (a.plantT >= PLANT_TIME) { a.plantT = 0; this.plant(a); }
    } else a.plantT = 0;
    const B = this.bomb;
    if (!T && B && B.planted && !B.done && a.in.use && a.pos.distanceTo(B.pos) < 1.6) {
      if (a.defuseT === 0) { const [d, pan] = this.listen(a.pos); play('defuse', d, pan); }
      a.defuseT += dt;
      if (a.defuseT >= (a.kit ? 5 : 10)) { B.done = true; a.defuseT = 0; a.money += 300; this.endRound('CT', 'defuse'); }
    } else a.defuseT = 0;
  }

  // ---------- главный цикл ----------
  update(dt) {
    this.time += dt;
    // состояние раунда
    if (!this.practice) {
      this.stateT -= dt;
      if (this.state === 'freeze' && this.stateT <= 0) { this.state = 'live'; this.centerMsg('Вперёд!', 1); play('round'); }
      else if (this.state === 'live') { this.roundTime -= dt; if (this.roundTime <= 0) this.endRound('CT', 'time'); }
      else if (this.state === 'end' && this.stateT <= 0) {
        const max = (this.o.winTo - 1) * 2;
        if (this.score.T >= this.o.winTo || this.score.CT >= this.o.winTo || this.round >= max) { this.over = true; this.ui.matchOver(this); return; }
        this.startRound(false);
      }
    }
    if (this.admin.money) this.player.money = 16000;
    this._playerInput(dt);
    if (this.over) return;
    // в тренировке — возрождение
    if (this.practice && !this.player.alive) {
      this.respawnT = (this.respawnT || 0) + dt;
      if (this.respawnT > 2) {
        this.respawnT = 0; const p = this.player;
        p.alive = true; p.hp = 100; p.vel.set(0, 0, 0); p.pos.copy(this.spawnPos(p.team, 0)); p.blind = 0;
        this.vm.visible = true; this.selectSlot(p, p.weapons[1] ? 1 : 2, true); this.centerMsg('Возрождение', 1);
      }
    }
    const frozen = this.state === 'freeze';
    for (const a of this.actors) if (a.brain && a.alive) a.brain.update(dt, frozen);
    for (const a of this.actors) {
      if (frozen) { a.in.mx = a.in.mz = 0; a.in.jump = false; }
      this._move(a, dt);
    }
    this._separate();
    for (const a of this.actors) this._weapons(a, dt);
    this._updNades(dt);
    this._updBomb(dt);
    // дым
    for (let k = this.smokes.length - 1; k >= 0; k--) {
      const s = this.smokes[k]; s.t += dt;
      s.r = Math.min(s.R, s.R * s.t / 1.2);
      const fade = s.t > s.life - 2 ? Math.max(0, (s.life - s.t) / 2) : 1;
      for (const p of s.parts) { const g = Math.min(1, s.t / 1.2); p.position.copy(p.userData.o).multiplyScalar(0.3 + 0.7 * g); p.position.y = p.userData.o.y * (0.4 + 0.6 * g) - 1.3 + 1.3; p.scale.setScalar(p.userData.sz * (0.4 + 0.6 * g)); p.material.opacity = 0.92 * fade; }
      if (s.t > s.life) { this.scene.remove(s.grp); this.smokes.splice(k, 1); }
    }
    for (let k = this.fires.length - 1; k >= 0; k--) {
      const f = this.fires[k]; f.t -= dt;
      for (const p of f.parts) { const ph = this.time * 9 + p.userData.ph; p.position.set(p.userData.o.x, 0.3 + Math.abs(Math.sin(ph)) * 0.5, p.userData.o.z); p.scale.setScalar(0.8 + Math.abs(Math.sin(ph * 0.7)) * 0.9); p.material.opacity = Math.min(1, f.t); }
      if (f.t <= 0) { this.scene.remove(f.grp); this.fires.splice(k, 1); }
    }
    for (let k = this.fx.length - 1; k >= 0; k--) {
      const e = this.fx[k]; e.t -= dt;
      if (e.grow) e.obj.scale.addScalar(e.grow * dt);
      if (e.obj.material) e.obj.material.opacity = Math.max(0, Math.min(1, e.t * 5));
      if (e.t <= 0) { this.scene.remove(e.obj); e.obj.material && e.obj.material.dispose(); this.fx.splice(k, 1); }
    }
    for (const t of this.tracers) if (t.l.visible) { t.t -= dt; if (t.t <= 0) t.l.visible = false; }
    this.checkWin();
    // модели
    for (const a of this.actors) {
      if (a === this.player && a.alive) continue;
      const m = a.model; m.root.position.copy(a.pos); m.root.rotation.y = a.yaw;
      m.update({ dt, speed: a.alive ? this.hspeed(a) : 0, crouch: a.crouchK > 0.5, pitch: a.pitch, airborne: !a.onGround, firing: this.time - a.lastFired < 0.08 });
      if (a.tag) { a.tag.visible = a.alive && a.model.root.visible; a.tag.position.set(a.pos.x, a.pos.y + 2.15 - a.crouchK * 0.4, a.pos.z); }
    }
    if (this.c4mesh && this.bomb && !this.bomb.planted) this.c4mesh.rotation.y += dt;
    this._camera(dt);
  }
  _camera(dt) {
    const p = this.player;
    let view = p;
    if (!p.alive && !this.practice) {
      this.deadT = (this.deadT || 0) + dt;
      if (this.deadT > 1.5) {
        if (!this.spect || !this.spect.alive) this.spectNext(1);
        if (this.spect) view = this.spect;
      }
    } else this.deadT = 0;
    this.viewing = view;
    const fp = view !== p && !this.spectTP;
    p.model.root.visible = !p.alive && view !== p;
    for (const a of this.actors) if (a.bot) {
      a.model.root.visible = !(fp && a === view && a.alive);
      if (a.tag && a === view && view !== p) a.tag.visible = false;
    }
    if (view !== p && this.spectTP) {
      // вид от третьего лица
      const e = this.eyePos(view), dir = this.aimDir(view);
      const off = new THREE.Vector3(-dir.x * 2.6, -dir.y * 2.6 + 0.6, -dir.z * 2.6), L = off.length();
      off.divideScalar(L);
      const d = this.world.ray(e.x, e.y, e.z, off.x, off.y, off.z, L);
      this.camera.position.copy(e).addScaledVector(off, Math.max(0.3, d - 0.3));
      this.camera.lookAt(e.x + dir.x * 5, e.y + dir.y * 5, e.z + dir.z * 5);
      this.vm.visible = false;
      if (this.camera.fov !== this.baseFov) { this.camera.fov = this.baseFov; this.camera.updateProjectionMatrix(); }
      return;
    }
    // вид от первого лица (свой или наблюдаемого)
    const e = this.eyePos(view);
    if (!view.alive) e.y = view.pos.y + 0.3;
    this.camera.position.copy(e);
    let yaw = view.yaw, pitch = view.pitch;
    if (view !== p) {
      // сглаживаем повороты бота
      if (this.camYaw == null) { this.camYaw = yaw; this.camPitch = pitch; }
      let dy = yaw - this.camYaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      const k = Math.min(1, dt * 14);
      this.camYaw += dy * k; this.camPitch += (pitch - this.camPitch) * k;
      yaw = this.camYaw; pitch = this.camPitch;
    }
    const vp = pitch + view.punch.p * 0.5, vy = yaw + view.punch.y * 0.5;
    this.camera.rotation.order = 'YXZ'; this.camera.rotation.set(vp, vy, 0);
    const fov = view.scope === 1 ? 40 : view.scope === 2 ? 15 : this.baseFov;
    if (this.camera.fov !== fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    // вьюмодель
    if (view.cur) {
      const inst = view.cur, id = inst.nade || inst.c4 ? inst.id : (inst.model || inst.id);
      if (this.vmKey !== view.id + '|' + view.agent.id + '|' + id + '|' + inst.skin) this._buildViewmodel(view);
    }
    this.vm.visible = view.alive && !view.scope;
    if (this.vmGun) {
      const sp = this.hspeed(view), bob = view.onGround ? sp / 6 : 0;
      this.bobT = (this.bobT || 0) + dt * sp * 1.6;
      this.vmKick = Math.max(0, (this.vmKick || 0) - dt * 9);
      this.vmDraw = Math.max(0, (this.vmDraw || 0) - dt * 3.2);
      const rl = view.cur && WEAPONS[view.cur.id] ? WEAPONS[view.cur.id].reload : 1;
      const reload = view.reloadT > 0 ? Math.sin(Math.min(1, view.reloadT / (rl || 1)) * Math.PI) : 0;
      const b = this.vmBase;
      const knifeT = view.cur && (view.cur.id === 'knife') ? this.vmKick : 0;
      this.vmGun.position.set(b.x + Math.sin(this.bobT) * 0.012 * bob, b.y - Math.abs(Math.cos(this.bobT)) * 0.012 * bob - reload * 0.12 - this.vmDraw * 0.25 - view.crouchK * 0.01, b.z + this.vmKick * 0.05 * (knifeT ? -1.5 : 1));
      this.vmGun.rotation.set(this.vmKick * 0.08 + reload * 0.7 - this.vmDraw * 0.6 - knifeT * 0.6, 0.05 + knifeT * 0.8, -reload * 0.3 + knifeT * 0.5);
      this.vmGun.updateMatrixWorld();
      if (this.flashT > 0) { this.flashT -= dt; const m = this.vmMuzzle.clone().applyMatrix4(this.vmGun.matrixWorld); this.flash.position.copy(m); } else this.flash.visible = false;
    }
  }
  render() {
    const r = this.r;
    r.autoClear = true; r.render(this.scene, this.camera);
    if (this.vm.visible) { r.autoClear = false; r.clearDepth(); r.render(this.vmScene, this.vmCam); r.autoClear = true; }
  }
  resize() { this.camera.aspect = this.vmCam.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.vmCam.updateProjectionMatrix(); }
  dispose() {
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  // находится ли камера в дыму
  camInSmoke() { const c = this.camera.position; for (const s of this.smokes) if (s.c.distanceTo(c) < s.r * 0.9) return Math.min(1, s.r / s.R); return 0; }
}
