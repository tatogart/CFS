// Ядро матча: актёры, физика, оружие, гранаты, бомба, раунды, HUD
import * as THREE from '../vendor/three.module.min.js';
import { CELL } from './maps.js?v=1793126269';
import { World } from './world.js?v=1793126269';
import { WEAPONS, NADES, GEAR, agentById, AGENTS, SKINS, KNIVES, GRAFFITI } from './data.js?v=1793126269';
import { AgentModel, buildWeapon, buildViewArms, mat } from './models.js?v=1793126269';
import { play, soundFor } from './sfx.js?v=1793126269';
import { Bot, planRound } from './bots.js?v=1793126269';
import { weaponIconURL, mapThumbURL, drawGraffiti } from './art.js?v=1793126269';

export const GRAV = 15;
const EYE = 1.62, EYE_C = 1.15, RADIUS = 0.32, STEP = 0.45, JUMP_V = 5.9;
const ROUND_TIME = 115, FREEZE = 6, BOMB_TIME = 40, END_TIME = 5, PLANT_TIME = 3.2;
const BOT_NAMES = ['Кирпич', 'Тень', 'Шрам', 'Волк', 'Сокол', 'Гром', 'Лис', 'Боцман', 'Призрак', 'Рыжий', 'Седой', 'Бархан', 'Ястреб', 'Кобра', 'Мангуст'];
const ZONES = [['head', 1.66, 0.15, 4], ['chest', 1.33, 0.26, 1], ['stomach', 1.05, 0.24, 1.25], ['legs', 0.68, 0.2, 0.75], ['legs', 0.32, 0.17, 0.75]];

// текстуры клубов дыма: шум внутри мягкого круга
let cloudTex = null;
function cloudTextures() {
  if (cloudTex) return cloudTex;
  cloudTex = [];
  for (let v = 0; v < 3; v++) {
    const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
    for (let k = 0; k < 26; k++) {
      const a = Math.random() * 6.28, r = Math.random() * 30, x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r, rr = 18 + Math.random() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr); const l = 200 + Math.random() * 55;
      gr.addColorStop(0, `rgba(${l},${l},${l},0.35)`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    }
    // мягкий край
    g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(64, 64, 20, 64, 64, 64); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; cloudTex.push(t);
  }
  return cloudTex;
}
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
    this.aimMode = !!opts.map.aim;
    this.mode = opts.mode || 'casual';
    this.dm = this.mode === 'dm' && !opts.map.aim;
    this.oneSite = this.mode === 'wing' ? 'B' : null;
    this.roundLen = this.mode === 'wing' ? 90 : ROUND_TIME;
    this.dmTime = 300; this.dmLimit = 30;
    this.intel = { T: null, CT: null }; this.plan = { T: { site: 'A', execAt: 0, executing: true }, CT: {} };
    this.net = opts.net || null;
    this.isHost = !!(this.net && this.net.role === 'host'); this.isClient = !!(this.net && this.net.role === 'client');
    this.practice = !this.net && (opts.diff.id === 'none' || this.aimMode);
    this.aimStats = { kills: 0, hs: 0, shots: 0, hits: 0, t0: 0 };
    this.admin = opts.admin || {};
    this.diff = opts.diff;
    this.settings = opts.settings;
    this.quality = opts.quality;
    this.scene = new THREE.Scene();
    const th = opts.map.theme;
    this.scene.background = new THREE.Color(th.sky).lerp(new THREE.Color('#9aa3ab'), 0.4);
    this.scene.fog = new THREE.Fog(new THREE.Color(th.fog).lerp(new THREE.Color('#9aa3ab'), 0.45), 70, th.void ? 320 : 240);
    this.world = new World(opts.map, this.quality);
    this.scene.add(this.world.group);
    const hemi = new THREE.HemisphereLight('#c9d4de', '#5a5044', 1.2); this.scene.add(hemi);
    const sun = this.sun = new THREE.DirectionalLight('#ffe6c4', 2.9);
    // небо: купол с градиентом и солнцем
    {
      const cv = document.createElement('canvas'); cv.width = 32; cv.height = 256; const g = cv.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 256);
      const dz = c => '#' + new THREE.Color(c).lerp(new THREE.Color('#9aa3ab'), 0.4).getHexString();
      gr.addColorStop(0, '#46617c'); gr.addColorStop(0.42, dz(th.sky)); gr.addColorStop(0.5, dz(th.fog)); gr.addColorStop(1, dz(th.fog));
      g.fillStyle = gr; g.fillRect(0, 0, 32, 256);
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(450, 24, 16), new THREE.MeshBasicMaterial({ map: tx, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
      dome.renderOrder = -1; this.scene.add(dome); this.dome = dome;
      const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: '#fff6dc', fog: false, depthWrite: false, transparent: true, toneMapped: false }));
      sunS.scale.setScalar(80); dome.add(sunS); sunS.position.set(300, 260, 200).normalize().multiplyScalar(420);
    }
    const cx = this.world.w * CELL / 2, cz = this.world.h * CELL / 2;
    sun.position.set(cx + 30, 60, cz + 20); sun.target.position.set(cx, 0, cz); this.scene.add(sun, sun.target);
    if (this.quality >= 1) {
      sun.castShadow = true; const s = sun.shadow; s.mapSize.set(this.quality >= 2 ? 2048 : 1024, this.quality >= 2 ? 2048 : 1024); const ext = Math.max(cx, cz) + 4;
      s.camera.left = -ext; s.camera.right = ext; s.camera.top = ext; s.camera.bottom = -ext; s.camera.near = 10; s.camera.far = 160; s.bias = -0.0006;
    }
    this.scene.add(new THREE.AmbientLight('#b8c2cc', 0.3));
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
    const lo = this.o.loadout, side = this.playerSide, n = this.practice ? 0 : this.dm ? 5 : this.o.size;
    const mkActor = (name, team, bot, agentId, noBrain) => {
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
      this.scene.add(a.model.root);
      if (bot && !this.practice && !noBrain && !this.isClient) { a.brain = new Bot(this, a, this.diff); }
      this.actors.push(a);
      return a;
    };
    // клиент: состав игроков приходит от хоста
    if (this.isClient) {
      for (const d of this.net.actors) {
        const a = mkActor(d.name, d.team, d.bot, d.ag, true); a.nid = d.nid; a.skins = d.skins || {};
        if (a.skins.gloves) a.model.setGloves(a.skins.gloves);
        if (d.nid === this.net.myNid) { this.player = a; }
      }
      this.playerSide = this.player.team;
      this._finishActors(this.player.team);
      return;
    }
    const p = this.player = mkActor(this.net ? this.net.myName : 'Вы', side, false, this.o.agents[side]);
    p.skins = { ...lo }; p.nid = 0;
    if (p.skins.gloves) p.model.setGloves(p.skins.gloves);
    // хост: живые игроки из лобби
    const humans = { T: 1, CT: 0 }; humans.T = side === 'T' ? 1 : 0; humans.CT = side === 'CT' ? 1 : 0;
    if (this.isHost) for (const r of this.net.roster) {
      const a = mkActor(r.name, r.team, false, r.agents && r.agents[r.team]); a.nid = r.nid; a.remote = true; a.skins = r.skins || {}; a.agents = r.agents;
      if (a.skins.gloves) a.model.setGloves(a.skins.gloves);
      humans[r.team]++;
    }
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    const enemy = side === 'T' ? 'CT' : 'T';
    const teamAgents = t => AGENTS.filter(a => a.team === t);
    const noBots = this.net && this.diff.id === 'none';
    const nSide = noBots ? 0 : Math.max(0, n - humans[side]), nEnemy = noBots ? 0 : Math.max(0, n - humans[enemy]);
    for (let i = 0; i < nSide; i++) { const ag = teamAgents(side)[i % 5]; const b = mkActor(names.pop(), side, true, ag.id); this._botSkins(b); }
    for (let i = 0; i < nEnemy; i++) { const ag = teamAgents(enemy)[(i + 2) % 5]; const b = mkActor(names.pop(), enemy, true, ag.id); this._botSkins(b); }
    // тренировка аима: мишени-боты, которые не стреляют
    if (this.aimMode) for (let i = 0; i < 8; i++) { const ag = teamAgents(enemy)[i % 5]; const b = mkActor('Мишень ' + (i + 1), enemy, true, ag.id); b.target = true; }
    this._finishActors(side);
  }
  _finishActors(side) {
    for (const a of this.actors) a.model.root.visible = a !== this.player;
    this._retag();
    this._buildViewmodel();
  }
  // имена союзников над головой (людей — жёлтым)
  _retag() {
    for (const a of this.actors) { if (a.tag) { this.scene.remove(a.tag); a.tag = null; } }
    for (const a of this.actors) if (!this.dm && a !== this.player && a.team === this.player.team) { a.tag = textSprite(a.name, a.bot ? '#7ee08a' : '#ffd36a'); this.scene.add(a.tag); }
  }
  _botSkins(b) {
    if (Math.random() < 0.5) for (const s of SKINS) if (WEAPONS[s.weapon] && Math.random() < 0.12) b.skins[s.weapon] = s.id;
    const gold = SKINS.filter(s => s.rarity === 'gold');
    if (Math.random() < 0.3) { const k = gold.filter(s => KNIVES[s.weapon]); const sk = k[Math.floor(Math.random() * k.length)]; b.skins.knife = { model: sk.weapon, skin: sk.id }; }
    if (Math.random() < 0.3) { const gl = gold.filter(s => !KNIVES[s.weapon]); b.skins.gloves = gl[Math.floor(Math.random() * gl.length)].id; b.model.setGloves(b.skins.gloves); }
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
    this.roundTime = this.roundLen; this.bomb = null; this.defuser = null;
    if (this.dm) { this.state = 'live'; this.stateT = 1e9; }
    for (const n of this.nades) n.mesh && this.scene.remove(n.mesh); this.nades = [];
    for (const s of this.smokes) this.scene.remove(s.grp); this.smokes = [];
    for (const f of this.fires) this.scene.remove(f.grp); this.fires = [];
    for (const d of this.decals) this.scene.remove(d); this.decals = [];
    if (this.c4mesh) { this.scene.remove(this.c4mesh); this.c4mesh = null; }
    const counts = { T: 0, CT: 0 };
    for (const a of this.actors) {
      const pistolRound = first || (this.round === half + 1);
      if (!a.alive || pistolRound) this.resetLoadout(a, pistolRound);
      for (const sl of [1, 2]) { const w = a.weapons[sl]; if (w && WEAPONS[w.id] && WEAPONS[w.id].mag) { w.mag = WEAPONS[w.id].mag; w.reserve = WEAPONS[w.id].reserve; } }
      a.alive = true; a.hp = 100; a.blind = 0; a.plantT = 0; a.defuseT = 0; a.scope = 0; a.roundKills = 0; a.reloadT = 0; a.switchT = 0;
      a.vel.set(0, 0, 0); a.pos.copy(this.dm ? this.dmSpawnPos(a) : this.spawnPos(a.team, counts[a.team]++)); a.crouchK = 0;
      a.model.revive(); a.model.root.visible = a !== this.player;
      // смотрим вдоль маршрута к ближайшей точке
      const c = this.world.sites.A.center, d = this.world.sites.B.center;
      const route = this.world.path(a.pos, a.pos.distanceTo(c) < a.pos.distanceTo(d) ? c : d);
      const tgt = route && route.length > 1 ? route[1] : c;
      a.yaw = Math.atan2(-(tgt.x - a.pos.x), -(tgt.z - a.pos.z)); a.pitch = 0;
      if (this.practice) { a.money = 16000; }
      if (a.target) { this.give(a, a.team === 'T' ? 'ak47' : 'm4a4'); this.selectSlot(a, 1, true); this.aimRespawn(a); }
      if (this.aimMode && a === this.player && !a.weapons[1]) { this.give(a, a.team === 'T' ? 'ak47' : 'm4a4'); this.selectSlot(a, 1, true); }
      a.hasBomb = false;
      if (this.dm) this.dmLoadout(a);
      this.selectSlot(a, a.weapons[1] ? 1 : 2, true);
    }
    if (!this.practice && !this.dm) {
      const ts = this.actors.filter(a => a.team === 'T');
      if (ts.length) { const c = ts[Math.floor(Math.random() * ts.length)]; c.hasBomb = true; }
      planRound(this);
      for (const a of this.actors) if (a.brain) a.brain.onRoundStart();
    }
    this.ui.roundStart && this.ui.roundStart(this);
    this.ev({ e: 'round', r: this.round });
    if (this.dm) for (const a of this.actors) if (a.brain) a.brain.onRoundStart();
    this.gmsg(this.dm ? `Бой насмерть: каждый сам за себя · до ${this.dmLimit} убийств · B — любое оружие` : this.aimMode ? 'Тренировка аима: стреляй по мишеням · B — другое оружие' : this.practice ? 'Тренировка: B — закупка, гранаты бесплатные' : (this.round === 1 ? 'Пистолетный раунд' : `Раунд ${this.round}`), 2.5);
  }
  _swapSides() {
    for (const a of this.actors) { a.team = a.team === 'T' ? 'CT' : 'T'; a.money = 800; a.kills = a.kills; const ag = a.bot ? AGENTS.filter(x => x.team === a.team)[a.id % 5] : a.remote ? (agentById[a.agents && a.agents[a.team]] || AGENTS.find(x => x.team === a.team)) : agentById[this.o.agents[a.team]];
      this.scene.remove(a.model.root); a.agent = ag; a.model = new AgentModel(ag, 'knife'); if (a.skins.gloves) a.model.setGloves(a.skins.gloves); this.scene.add(a.model.root); this.resetLoadout(a, true); }
    this.score = { T: this.score.CT, CT: this.score.T }; this.lossStreak = { T: 0, CT: 0 };
    this.playerSide = this.player.team;
    this._retag();
    this._buildViewmodel();
    this.gmsg('Смена сторон!', 3);
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
    // MVP: больше всего убийств в раунде у победителей (или сапёр / тот, кто заложил)
    let mvp = this.actors.filter(a => a.team === winner).sort((x, y) => y.roundKills - x.roundKills)[0];
    if (reason === 'defuse' && this.defuser) mvp = this.defuser;
    if (reason === 'bomb' && this.bomb && this.bomb.planter) mvp = this.bomb.planter;
    if (mvp) mvp.mvps = (mvp.mvps || 0) + 1;
    const why = reason === 'bomb' ? 'Бомба взорвана' : reason === 'defuse' ? 'Бомба обезврежена' : reason === 'time' ? 'Время вышло' : 'Противник уничтожен';
    this.ui.roundBanner ? this.ui.roundBanner(winner, why, mvp, this) : this.centerMsg(winner, 3);
    this.ev({ e: 'end', w: winner, why, mvp: mvp ? mvp.id : -1 });
    play(winner === this.player.team ? 'win' : 'lose');
    this.ui.onRoundEnd && this.ui.onRoundEnd(this, winner);
  }
  checkWin() {
    if (this.dm) return;
    if (this.practice || this.state !== 'live' && this.state !== 'planted') return;
    const aliveT = this.actors.some(a => a.alive && a.team === 'T'), aliveCT = this.actors.some(a => a.alive && a.team === 'CT');
    const planted = this.bomb && this.bomb.planted;
    if (!aliveCT) this.endRound('T', 'elim');
    else if (!aliveT && !planted) this.endRound('CT', 'elim');
  }
  centerMsg(t, dur = 2, color = '#fff') { this.ui.center(t, dur, color); }
  gmsg(t, dur = 2, color = '#fff') { this.centerMsg(t, dur, color); this.ev({ e: 'msg', t, d: dur, c: color }); }
  ev(m) { if (this.isHost) this.net.broadcast({ t: 'ev', ...m }); }

  // ---------- оружие ----------
  selectSlot(a, slot, instant) {
    let inst = null;
    if (slot === 4) { if (!a.nades.length) return; a.nadeIdx = ((a.slot === 4 ? (a.nadeIdx || 0) + 1 : (a.nadeIdx || 0))) % a.nades.length; inst = { id: a.nades[a.nadeIdx], nade: true }; }
    else if (slot === 5) { if (!a.hasBomb) return; inst = { id: 'c4', c4: true }; }
    else { inst = a.weapons[slot]; if (!inst) return; }
    if (a.slot !== slot) a.last = a.slot;
    a.slot = slot; a.cur = inst; a.reloadT = 0; a.scope = 0; a.rescope = 0; this.inspectT = 0; a.switchT = instant ? 0 : 0.45; a.recoilIdx = 0;
    if (!instant && this.isView(a)) play('draw');
    const modelId = inst.nade || inst.c4 ? inst.id : (inst.model || inst.id);
    a.model.setWeapon(modelId, inst.skin);
  }
  cycle(a, dir) {
    const order = [1, 2, 3, 4, 5].filter(s => (s <= 3 ? a.weapons[s] : s === 4 ? a.nades.length : a.hasBomb));
    let i = order.indexOf(a.slot); i = (i + dir + order.length) % order.length; this.selectSlot(a, order[i]);
  }
  canBuy(a) {
    if (this.practice || this.dm) return true;
    if (!(this.state === 'freeze' || (this.state === 'live' && this.roundLen - this.roundTime < 20))) return false;
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
    if (this.isClient && a === this.player) { if (!this.canBuy(a) || !this.canTeam(a, id) || a.money < this.priceOf(a, id)) return false; this.net.toHost({ t: 'cmd', c: 'buy', v: id }); play('buy'); return true; }
    if (!this.canBuy(a) || !this.canTeam(a, id)) return false;
    const price = this.priceOf(a, id); if (a.money < price && !this.practice && !this.dm) return false;
    if (WEAPONS[id]) { const def = WEAPONS[id]; const cur = a.weapons[def.slot]; if (cur && cur.id === id) { cur.reserve = def.reserve; if (!this.practice) return false; } this.give(a, id); this.selectSlot(a, def.slot); }
    else if (NADES[id]) { const cnt = a.nades.filter(n => n === id).length; if (cnt >= NADES[id].max || a.nades.length >= 4) return false; a.nades.push(id); }
    else if (id === 'vest') { if (a.armor >= 100) return false; a.armor = 100; }
    else if (id === 'vesthelm') { if (a.armor >= 100 && a.helmet) return false; a.armor = 100; a.helmet = true; }
    else if (id === 'kit') { if (a.kit || a.team !== 'CT') return false; a.kit = true; }
    if (!this.practice && !this.dm) a.money -= price;
    if (a === this.player) play('buy');
    if (a.remote) this.net.send(a.nid, { t: 'ev', e: 'snd', s: 'buy' });
    return true;
  }
  _buildViewmodel(a = this.viewing || this.player) {
    if (!a || !a.cur) return;
    const inst = a.cur, id = inst.nade || inst.c4 ? inst.id : (inst.model || inst.id);
    this.vmKey = a.id + '|' + a.agent.id + '|' + id + '|' + inst.skin + '|' + (a.skins.gloves || '');
    this.vm.clear();
    const gun = buildWeapon(id, inst.skin);
    const arms = buildViewArms(a.agent, a.skins.gloves);
    const g = new THREE.Group(); g.add(gun);
    const R = arms.userData.right, L = arms.userData.left;
    R.position.set(0.01, -0.05, 0.05); R.rotation.set(0.75, 0.25, 0); g.add(R);
    this.vmSpin = null; this.vmKnife = null;
    if (inst.id === 'knife') {
      // нож крутится вокруг своей точки (у керамбита — кольцо), руки остаются на месте
      const base = new THREE.Group(); base.scale.setScalar(1.8); base.rotation.set(0.3, 0, -0.15);
      const piv = inst.model === 'karambit' || inst.model === 'talon' ? new THREE.Vector3(0, -0.008, 0.125) : new THREE.Vector3(0, -0.004, 0.04);
      const spin = new THREE.Group(); spin.position.copy(piv); base.add(spin);
      g.remove(gun); gun.position.copy(piv).negate(); spin.add(gun); g.add(base);
      this.vmSpin = spin; this.vmKnife = gun;
      R.position.set(0.0, -0.06, inst.model === 'karambit' || inst.model === 'talon' ? 0.2 : 0.17); R.rotation.set(0.9, 0.2, 0);
    }
    const fore = gun.userData.fore;
    if (inst.nade || inst.c4 || WEAPONS[id] && WEAPONS[id].type === 'knife' || KNIVES[id] || id === 'knife') { L.position.set(-0.36, -0.2, 0.12); L.rotation.set(0.6, -0.4, 0); }
    else if (WEAPONS[id] && WEAPONS[id].type === 'pistol') { L.position.set(-0.03, -0.07, 0.04); L.rotation.set(0.75, -0.35, 0); }
    else { L.position.set(fore.x - 0.03, fore.y - 0.03, fore.z + 0.02); L.rotation.set(0.7, -0.5, 0); }
    g.add(L);
    g.scale.setScalar(0.62);
    this.vmGun = g; this.vmMuzzle = gun.userData.muzzle.clone();
    this.vm.add(g);
    this.vm.scale.x = this.settings.hand === 'left' ? -1 : 1;
    this.vmCam.fov = this.settings.vmfov || 62; this.vmCam.updateProjectionMatrix();
    const t = WEAPONS[id] ? WEAPONS[id].type : 'nade';
    this.vmBase = inst.id === 'knife' ? new THREE.Vector3(0.12, -0.1, -0.38) : t === 'pistol' ? new THREE.Vector3(0.13, -0.13, -0.36) : t === 'knife' || t === 'nade' || !WEAPONS[id] ? new THREE.Vector3(0.15, -0.14, -0.32) : new THREE.Vector3(0.14, -0.15, -0.34);
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
    if (a === this.player && this.aimMode) { this.aimStats.shots++; if (!this.aimStats.t0) this.aimStats.t0 = this.time; inst.reserve = WEAPONS[inst.id].reserve; }
    if (this.time - a.lastShot > def.rate * 2.2) a.recoilIdx = Math.max(0, a.recoilIdx - (this.time - a.lastShot) * 10);
    a.lastShot = this.time;
    // разброс
    const sp = this.hspeed(a);
    let spread = def.spread;
    const mv = Math.max(0, Math.min(1, (sp - 1.3) / (def.speed - 1.3)));
    spread += def.move * mv;
    if (!a.onGround) spread += def.move * 1.6 + 0.04;
    if (a.crouchK > 0.5) spread *= 0.75;
    if (def.scope && !a.scope) spread += def.noscope || 0;
    if (def.pellets) spread = Math.max(spread, 0.045);
    spread += def.recoil * 0.25 * Math.min(a.recoilIdx, 10) * (def.type === 'pistol' ? 0.6 : 0.15);
    const pellets = def.pellets || 1;
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
    if (def.scope && a.scope) { a.prevScope = a.scope; a.scope = 0; a.rescope = def.rate * 0.95; }
    // звук и вспышка
    const snd = soundFor(inst.id);
    this.ev({ e: 'fire', a: a.id, w: inst.id });
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
    this.ev({ e: 'rl', a: a.id });
    if (this.isView(a)) play('reload'); else { const [d, pan] = this.listen(a.pos); play('reload', d, pan); }
  }
  // точки попаданий по актёру
  hitTest(o, d, maxT, shooter) {
    let best = null;
    for (const v of this.actors) {
      if (!v.alive || v === shooter) continue;
      if (!this.isEnemy(v, shooter) && !this.practice) continue;
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
    const tr = Math.random() < (a === this.player ? 0.35 : 0.6);
    if (tr) this.tracer(from, end);
    this.ev({ e: 'shot', a: a.id, f: tr ? [+from.x.toFixed(2), +from.y.toFixed(2), +from.z.toFixed(2)] : 0, p: [+end.x.toFixed(2), +end.y.toFixed(2), +end.z.toFixed(2)], h: h ? 1 : hit.t < maxD ? 2 : 0, n: [hit.n.x, hit.n.y, hit.n.z] });
    if (h) {
      this.damage(h.v, a, def.dmg * Math.pow(def.falloff || 0.985, h.t / 5), h.zone, h.mult, def, dir);
      this.puff(end, '#a01010', 0.35);
    } else if (hit.t < maxD) {
      this.decal(end, hit.n);
      this.puff(end, '#9a9184', 0.25);
    }
  }
  knife(a) {
    const o = this.eyePos(a), dir = this.aimDir(a);
    this.ev({ e: 'fire', a: a.id, w: 'knife' });
    if (this.isView(a)) { this.vmKick = 1; play('knife'); } else { const [d, pan] = this.listen(a.pos); play('knife', d, pan); }
    for (const v of this.actors) {
      if (!v.alive || v === a || (!this.isEnemy(v, a) && !this.practice)) continue;
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
    if (!v.alive || this.isClient) return;
    if (v === this.player && this.admin.god) return;
    if (a === this.player && v !== a && this.admin.oneshot) raw *= 20;
    let dmg = raw * mult;
    const pen = def.pen || 1;
    if (v.armor > 0 && zone !== 'legs' && (zone !== 'head' || v.helmet)) { const ad = dmg * (1 - pen) * 0.5; v.armor = Math.max(0, v.armor - ad); dmg *= pen; }
    dmg = Math.round(dmg);
    v.hp -= dmg; v.lastHurt = this.time; v.lastAttacker = a;
    if (v.brain) v.brain.onHurt(a, dir);
    if (a && a.remote) this.net.send(a.nid, { t: 'ev', e: 'hit', hs: zone === 'head' ? 1 : 0 });
    if (v.remote) this.net.send(v.nid, { t: 'ev', e: 'hurt', d: dir ? [dir.x, dir.z] : null });
    if (a === this.player) { play(zone === 'head' ? 'head' : 'hit'); this.ui.hitmark(zone === 'head'); if (this.aimMode && def.type !== 'knife') this.aimStats.hits++; }
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
      if (this.isEnemy(a, v)) { a.kills++; a.roundKills++; if (hs) a.hs = (a.hs || 0) + 1; a.money = Math.min(16000, a.money + (def.kill || 300)); }
      if (a === this.player && this.ui.onKill) this.ui.onKill(hs);
      if (a === this.player && this.aimMode) { this.aimStats.kills++; if (hs) this.aimStats.hs++; }
    }
    // бомба выпадает
    if (v.hasBomb) { v.hasBomb = false; this.dropBomb(v.pos); }
    const wid = def ? (def === WEAPONS.knife && a && a.cur && a.cur.model ? a.cur.model : Object.keys(WEAPONS).find(k => WEAPONS[k] === def) || def.icon) : 'skull';
    this.ui.feed(a, v, wid, hs, this.player);
    this.ev({ e: 'kill', v: v.id, a: a ? a.id : -1, w: wid, hs: hs ? 1 : 0, fd: v.model.fallDir });
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
    const nid = this.nadeSeq = (this.nadeSeq || 0) + 1;
    this.nades.push({ id: nid, type, pos: o.clone(), vel: vel.clone(), t: 0, owner: a, mesh, landed: false });
    this.ev({ e: 'nade', id: nid, ty: type, p: [o.x, o.y, o.z], v: [vel.x, vel.y, vel.z] });
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
    if (this.isHost) this.ev({ e: 'pop', id: n.id, ty: n.type, p: [n.pos.x, n.pos.y, n.pos.z] });
    if (this.isClient) return;
    const [d, pan] = this.listen(n.pos), p = n.pos.clone();
    if (p.y < -40) return;
    if (n.type === 'he') {
      play('he', d, pan); this.bigExplosion(p.clone(), 0.35);
      for (const v of this.actors) {
        if (!v.alive) continue;
        const e = this.eyePos(v), dist = e.distanceTo(p); if (dist > 8) continue;
        if (!this.world.los(p.clone().setY(p.y + 0.3), new THREE.Vector3(v.pos.x, v.pos.y + 1, v.pos.z))) continue;
        let dmg = 98 * Math.max(0, 1 - dist / 8); if (v.armor > 0) { dmg *= 0.55; v.armor = Math.max(0, v.armor - dmg * 0.3); }
        if (!this.isEnemy(v, n.owner) && v !== n.owner && !this.practice) continue;
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
    const parts = [], texs = cloudTextures();
    const nP = this.quality >= 1 ? 46 : 30;
    for (let i = 0; i < nP; i++) {
      // нижние клубы темнее, верхние светлее — как объёмный дым
      const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 0.7) * 3.0, y = 0.3 + Math.random() * 3.2;
      const shade = 0.5 + (y / 3.5) * 0.22 + Math.random() * 0.06;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texs[i % texs.length], color: new THREE.Color(shade, shade * 1.01, shade * 1.03), transparent: true, opacity: 0, depthWrite: false, fog: true }));
      s.material.rotation = Math.random() * Math.PI * 2;
      s.userData = { o: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), sz: 3.2 + Math.random() * 2.6, rs: (Math.random() - 0.5) * 0.15, delay: Math.random() * 0.35, dr: new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.04 + Math.random() * 0.05, (Math.random() - 0.5) * 0.08) };
      s.position.set(0, 0.3, 0); s.scale.setScalar(0.3);
      grp.add(s); parts.push(s);
    }
    this.scene.add(grp);
    // дым тушит огонь
    for (const f of this.fires) if (f.c.distanceTo(p) < 4) f.t = Math.min(f.t, 0.3);
    this.smokes.push({ c: p.clone().setY(p.y + 1.5), r: 0, R: 3.6, t: 0, life: 18, grp, parts });
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
  // взрыв: огненный шар, дым, ударная волна, искры, вспышка света, тряска камеры
  bigExplosion(p, k = 1) {
    const grp = new THREE.Group(); grp.position.copy(p); this.scene.add(grp);
    const parts = [], tex = softSprite();
    const N = Math.round((this.quality >= 1 ? 46 : 30) * Math.max(0.5, k));
    for (let i = 0; i < N; i++) {
      const fire = i < N * 0.55;
      const m = new THREE.SpriteMaterial({ map: tex, color: fire ? (i % 3 ? '#ff7a1a' : '#ffd36a') : '#2a2622', blending: fire ? THREE.AdditiveBlending : THREE.NormalBlending, transparent: true, depthWrite: false, opacity: fire ? 1 : 0 });
      const s = new THREE.Sprite(m);
      const a = Math.random() * Math.PI * 2, up = Math.random();
      const sp = (fire ? 9 : 4) * k * (0.4 + Math.random());
      s.userData = { v: new THREE.Vector3(Math.cos(a) * sp * (1 - up * 0.5), (fire ? 6 : 5) * k * up + 1, Math.sin(a) * sp * (1 - up * 0.5)), fire, life: fire ? 0.9 + Math.random() * 0.5 : 4 + Math.random() * 3, sz: (fire ? 3 : 4) * k * (0.6 + Math.random()), t: 0, delay: fire ? 0 : 0.15 + Math.random() * 0.3 };
      s.position.set(0, 0.6, 0); s.scale.setScalar(0.1); grp.add(s); parts.push(s);
    }
    // искры
    const sparks = [];
    for (let i = 0; i < 40 * k; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#ffe08a', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      const a = Math.random() * Math.PI * 2, sp = (8 + Math.random() * 16) * k;
      s.userData = { v: new THREE.Vector3(Math.cos(a) * sp, (4 + Math.random() * 12) * k, Math.sin(a) * sp), t: 0, life: 0.8 + Math.random() * 0.8 };
      s.position.set(0, 0.6, 0); s.scale.setScalar(0.25); grp.add(s); sparks.push(s);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.4, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd8a0', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    ring.position.y = 0.08; grp.add(ring);
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(4 * k + 0.8, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.6, depthWrite: false }));
    scorch.position.y = 0.03; grp.add(scorch);
    const light = new THREE.PointLight('#ffa040', 80 * k, 60 * k, 1.6); light.position.y = 2; grp.add(light);
    // тряска и вспышка
    const dist = this.camera.position.distanceTo(p);
    this.shake = Math.max(this.shake || 0, Math.min(1.2, (k * 30) / (dist + 6)));
    if (dist < 30 * k && this.world.los(p.clone().setY(1.5), this.camera.position)) this.ui.flashed && this.ui.flashed(0.25 * k + 0.1, true);
    let t = 0;
    this.fx.push({ obj: grp, upd: dt => {
      t += dt;
      for (const s of parts) {
        const u = s.userData; if (t < u.delay) continue; u.t += dt;
        const f = u.t / u.life; if (f >= 1) { s.visible = false; continue; }
        s.position.addScaledVector(u.v, dt); u.v.multiplyScalar(u.fire ? 1 - dt * 3 : 1 - dt * 1.2);
        if (!u.fire) u.v.y += dt * 1.6;
        s.scale.setScalar(u.sz * (u.fire ? 0.4 + f * 1.1 : 0.5 + f * 1.4));
        s.material.opacity = u.fire ? (1 - f) * (1 - f) : Math.min(0.75, u.t * 2) * (1 - f);
        if (u.fire) s.material.color.setRGB(1, 0.75 - f * 0.5, 0.35 - f * 0.3);
      }
      for (const s of sparks) {
        const u = s.userData; u.t += dt; const f = u.t / u.life; if (f >= 1) { s.visible = false; continue; }
        u.v.y -= GRAV * dt; s.position.addScaledVector(u.v, dt); if (s.position.y < 0.05) { s.position.y = 0.05; u.v.y *= -0.3; u.v.x *= 0.6; u.v.z *= 0.6; }
        s.material.opacity = 1 - f;
      }
      const rf = Math.min(1, t / 0.55); ring.scale.setScalar(1 + rf * 16 * k); ring.material.opacity = 0.8 * (1 - rf);
      light.intensity = 80 * k * Math.max(0, 1 - t / 0.7);
      scorch.material.opacity = t > 6 ? Math.max(0, 0.6 - (t - 6) * 0.3) : 0.6;
      if (t > 8) { grp.traverse(o => { o.material && o.material.dispose(); }); return false; }
      return true;
    } });
  }
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
  // прижать точку попадания к поверхности стены/пола (луч шагает дискретно)
  snapHit(p, n) {
    if (n.x) p.x = Math.round(p.x / CELL) * CELL;
    else if (n.z) p.z = Math.round(p.z / CELL) * CELL;
    else p.y = Math.max(0, this.world.hAtPos(p.x - n.x * 0.01, p.z - n.z * 0.01));
    return p;
  }
  decal(p, n) {
    this.snapHit(p, n);
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
    this.bomb = { planted: true, pos: a.pos.clone(), timer: BOMB_TIME, site, beep: 0, planter: a };
    this.ui.announce && this.ui.announce('Bomb has been planted');
    this._c4Mesh(this.bomb.pos);
    this.state = 'planted';
    a.money += 300;
    this.gmsg(`Бомба заложена на ${site}!`, 2.5, '#ff6a4a'); this.ev({ e: 'plant' });
    play('plant');
    this.selectSlot(a, a.weapons[1] ? 1 : 2);
    for (const b of this.actors) if (b.brain) b.brain.onPlanted(this.bomb);
  }
  _updBomb(dt) {
    const B = this.bomb;
    if (!B) return;
    if (B.dropped) {
      for (const a of this.actors) if (a.alive && a.team === 'T' && !(a === (B.noPickBy || this.player) && this.time < (B.noPick || 0)) && Math.hypot(a.pos.x - B.pos.x, a.pos.z - B.pos.z) < 0.9) {
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
      B.done = true; const [d, pan] = this.listen(B.pos); play('boom', d * 0.3, pan); this.bigExplosion(B.pos.clone());
      this.ev({ e: 'boom', p: [B.pos.x, B.pos.y, B.pos.z] });
      for (const v of this.actors) if (v.alive) { const dist = v.pos.distanceTo(B.pos); if (dist < 20) { const dmg = 500 * (1 - dist / 20); this.damage(v, null, dmg, 'chest', 1, { pen: 1 }, null); } }
      if (this.state !== 'end') this.endRound('T', 'bomb');
    }
  }

  // ---------- режимы ----------
  isEnemy(a, b) { return this.dm ? a !== b : a.team !== b.team; }
  // где можно заложить бомбу (в «Напарниках» — только одна точка)
  plantSite(x, z) { const s = this.world.siteAt(x, z); if (!s) return 0; if (this.oneSite && s !== (this.oneSite === 'A' ? 1 : 2)) return 0; return s; }
  dmSpawnPos(a) {
    const w = this.world;
    if (!this._dmCells) { this._dmCells = []; for (let j = 0; j < w.h; j++) for (let i = 0; i < w.w; i++) if (w.walk(i, j) && w.walk(i + 1, j) && w.walk(i - 1, j) && w.walk(i, j + 1) && w.walk(i, j - 1)) this._dmCells.push([i, j]); }
    let best = null, bs = -1;
    for (let k = 0; k < 24; k++) {
      const [i, j] = this._dmCells[Math.floor(Math.random() * this._dmCells.length)], c = w.cellCenter(i, j);
      let near = 1e9, seen = false;
      for (const o of this.actors) { if (o === a || !o.alive) continue; const d = o.pos.distanceTo(c); near = Math.min(near, d); if (d < 35 && w.los(c.clone().setY(c.y + 1.6), this.eyePos(o))) seen = true; }
      const sc = Math.min(near, 40) - (seen ? 30 : 0);
      if (sc > bs) { bs = sc; best = c; }
    }
    return best || this.spawnPos(a.team, 0);
  }
  dmLoadout(a) {
    a.armor = 100; a.helmet = true; a.nades = [];
    if (!a.weapons[3]) this.give(a, 'knife');
    if (a.bot) {
      const L = ['ak47', 'm4a4', 'ak47', 'm4a1s', 'awp', 'galil', 'famas', 'mp9', 'mac10', 'sg553', 'aug', 'ump45', 'mp7', 'p90', 'xm1014', 'nova', 'negev', 'ssg08', 'scar20'];
      const pri = L[Math.floor(Math.random() * L.length)];
      this.give(a, pri); this.give(a, ['deagle', 'p250', 'tec9', 'fiveseven', 'glock', 'usp'][Math.floor(Math.random() * 6)]);
    } else {
      if (!a.weapons[1]) this.give(a, a.team === 'T' ? 'ak47' : 'm4a4');
      if (!a.weapons[2]) this.give(a, a.team === 'T' ? 'glock' : 'usp');
      for (const sl of [1, 2]) { const w = a.weapons[sl]; if (w) { w.mag = WEAPONS[w.id].mag; w.reserve = WEAPONS[w.id].reserve; } }
    }
  }
  dmRespawn(a) {
    a.respT = 0; a.alive = true; a.hp = 100; a.blind = 0; a.vel.set(0, 0, 0); a.crouchK = 0; a.scope = 0; a.reloadT = 0;
    a.pos.copy(this.dmSpawnPos(a)); a.model.revive(); a.model.root.visible = a !== this.player;
    this.dmLoadout(a); this.selectSlot(a, a.weapons[1] ? 1 : 2, true);
    if (a === this.player) { this.vm.visible = true; this.spect = null; }
    if (a.brain) a.brain.onRoundStart();
  }

  // ---------- граффити ----------
  spray(a, gid) {
    if (!a.alive) return;
    if (this.time < (a.sprayCd || 0)) { if (a === this.player) this.centerMsg(`Граффити через ${Math.ceil(a.sprayCd - this.time)} с`, 1); return; }
    const o = this.eyePos(a), d = this.aimDir(a);
    const hit = this.world.rayHit(o.x, o.y, o.z, d.x, d.y, d.z, 4);
    if (hit.t >= 4) { if (a === this.player) this.centerMsg('Подойдите ближе к стене', 1); return; }
    const p0 = this.snapHit(new THREE.Vector3().copy(o).addScaledVector(d, hit.t), hit.n).addScaledVector(hit.n, 0.02);
    gid = gid || (a === this.player ? this.o.graffiti : a.graffiti) || 'cfs';
    this._placeSpray(a, p0, hit.n, gid);
    a.sprayCd = this.time + 8;
    this.ev({ e: 'spray', a: a.id, p: [p0.x, p0.y, p0.z], n: [hit.n.x, hit.n.y, hit.n.z], g: gid });
  }
  _placeSpray(a, p, n, gid) {
    const g0 = GRAFFITI.find(x => x.id === gid) || GRAFFITI[0];
    this._sprayTex = this._sprayTex || {};
    if (!this._sprayTex[g0.id]) { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const t = new THREE.CanvasTexture(drawGraffiti(cv, g0)); t.colorSpace = THREE.SRGBColorSpace; this._sprayTex[g0.id] = t; }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshLambertMaterial({ map: this._sprayTex[g0.id], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, opacity: 0.95 }));
    m.position.copy(p);
    if (Math.abs(n.y) > 0.9) { m.rotation.x = -Math.PI / 2; m.rotation.z = a.yaw; } else m.lookAt(p.clone().add(n));
    if (a.sprayMesh) this.scene.remove(a.sprayMesh);
    a.sprayMesh = m; this.scene.add(m);
    const [dd, pan] = this.listen(p); play('spray', this.isView(a) ? 0 : dd, pan);
  }

  // ---------- тренировка аима ----------
  aimRespawn(a) {
    const w = this.world, p = this.player, e = new THREE.Vector3();
    for (let tries = 0; tries < 60; tries++) {
      const i = 3 + Math.floor(Math.random() * (w.w - 6)), j = 3 + Math.floor(Math.random() * (w.h - 12));
      if (!w.walk(i, j)) continue;
      const c = w.cellCenter(i, j), d = c.distanceTo(p.pos);
      if (d < 9 || d > 70) continue;
      if (this.actors.some(o => o !== a && o.alive && o.target && o.pos.distanceTo(c) < 4)) continue;
      if (tries < 40 && !w.los(this.eyePos(p, e), c.clone().setY(1.4))) continue;
      a.pos.copy(c); break;
    }
    a.alive = true; a.hp = 100; a.armor = 0; a.vel.set(0, 0, 0); a.model.revive(); a.model.root.visible = true;
    a.strafeT = 0; a.respT = 0;
  }
  _aimTargets(dt) {
    const p = this.player;
    for (const a of this.actors) {
      if (!a.target) continue;
      if (!a.alive) { a.respT = (a.respT || 0) + dt; if (a.respT > 0.6) this.aimRespawn(a); continue; }
      const dx = p.pos.x - a.pos.x, dz = p.pos.z - a.pos.z, d = Math.hypot(dx, dz) || 1;
      a.yaw = Math.atan2(-dx, -dz); a.pitch = 0;
      a.strafeT -= dt;
      if (a.strafeT <= 0) { a.strafeT = 0.35 + Math.random() * 1.1; const r = Math.random(); a.sdir = r < 0.25 ? 0 : r < 0.62 ? 1 : -1; a.in.crouch = Math.random() < 0.15; a.in.walk = Math.random() < 0.2; a.in.jump = Math.random() < 0.06; }
      else a.in.jump = false;
      a.in.mx = (-dz / d) * a.sdir; a.in.mz = (dx / d) * a.sdir;
      // не уходить в стену
      const nx = a.pos.x + a.in.mx * 1.2, nz = a.pos.z + a.in.mz * 1.2;
      if (!this.world.walk(Math.floor(nx / CELL), Math.floor(nz / CELL))) { a.sdir = -a.sdir; a.in.mx = -a.in.mx; a.in.mz = -a.in.mz; }
      a.in.fire = false;
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
    if (c.edge('reload')) this.act(p, 'reload');
    for (const s of [1, 2, 3, 4, 5]) if (c.edge('slot' + s)) this.act(p, 'slot', s);
    if (c.edge('last')) this.act(p, 'slot', p.last);
    if (c.edge('next') || c.edge('swap')) this.act(p, 'cycle', 1);
    if (c.edge('prev')) this.act(p, 'cycle', -1);
    if (c.edge('nade')) { if (p.nades.length) this.act(p, 'slot', 4); else this.centerMsg('Нет гранат', 1); }
    if (c.edge('aim')) this.act(p, 'aim');
    if (c.edge('inspect') && !p.scope && p.reloadT <= 0) this.inspectT = 3.2;
    if (p.in.fire || p.reloadT > 0) this.inspectT = 0;
    if (c.edge('spray')) this.act(p, 'spray', this.o.graffiti);
    if (c.edge('bomb')) this.act(p, 'slot', 5);
    if (c.edge('drop')) this.act(p, 'drop');
    c.edge('fireP');
  }
  // действие игрока: локально, у хоста для удалённых игроков, у клиента — отправка хосту
  act(a, c, v) {
    if (this.isClient && a === this.player) {
      this.net.toHost({ t: 'cmd', c, v });
      if (c === 'slot') { this.selectSlot(a, v); a.localSw = this.time; }
      else if (c === 'cycle') { this.cycle(a, v); a.localSw = this.time; }
      else if (c === 'aim') { const def = a.cur && WEAPONS[a.cur.id]; if (def && def.scope && a.reloadT <= 0) { a.scope = (a.scope + 1) % (def.zoom ? def.zoom.length + 1 : 3); a.localScope = this.time; } }
      return;
    }
    switch (c) {
      case 'reload': this.reload(a); break;
      case 'slot': this.selectSlot(a, v); break;
      case 'cycle': this.cycle(a, v); break;
      case 'aim': { const def = a.cur && WEAPONS[a.cur.id]; if (def && def.scope && a.switchT <= 0 && a.reloadT <= 0) a.scope = (a.scope + 1) % (def.zoom ? def.zoom.length + 1 : 3); break; }
      case 'spray': this.spray(a, v); break;
      case 'buy': this.buy(a, v); break;
      case 'drop':
        if (!a.hasBomb) break;
        a.hasBomb = false; { const d = this.aimDir(a); this.dropBomb(new THREE.Vector3(a.pos.x + d.x * 1.5, 0, a.pos.z + d.z * 1.5)); }
        this.bomb.noPick = this.time + 1.5; this.bomb.noPickBy = a; if (a.slot === 5) this.selectSlot(a, a.weapons[1] ? 1 : 2);
        break;
    }
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
    if (a.rescope > 0) { a.rescope -= dt; if (a.rescope <= 0 && a.cur && WEAPONS[a.cur.id] && WEAPONS[a.cur.id].scope && a.reloadT <= 0 && (a.cur.mag > 0)) a.scope = a.prevScope || 1; }
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
    if (T && a.hasBomb && a.in.use && a.onGround && this.plantSite(a.pos.x, a.pos.z) && (this.state === 'live')) {
      if (a.cur && !a.cur.c4) this.selectSlot(a, 5, true);
      a.plantT += dt; if (a.plantT >= PLANT_TIME) { a.plantT = 0; this.plant(a); }
    } else a.plantT = 0;
    const B = this.bomb;
    if (!T && B && B.planted && !B.done && a.in.use && a.pos.distanceTo(B.pos) < 1.6) {
      if (a.defuseT === 0) { const [d, pan] = this.listen(a.pos); play('defuse', d, pan); }
      a.defuseT += dt;
      if (a.defuseT >= (a.kit ? 5 : 10)) { this.defuser = a; B.done = true; a.defuseT = 0; a.money += 300; this.endRound('CT', 'defuse'); }
    } else a.defuseT = 0;
  }

  // ---------- главный цикл ----------
  update(dt) {
    this.time += dt;
    // состояние раунда
    if (!this.practice) {
      this.stateT -= dt;
      if (this.state === 'freeze' && this.stateT <= 0) { this.state = 'live'; this.gmsg('Вперёд!', 1); play('round'); this.ev({ e: 'snd', s: 'round' }); }
      else if (this.state === 'live') { this.roundTime -= dt; if (this.roundTime <= 0) this.endRound('CT', 'time'); }
      else if (this.state === 'end' && this.stateT <= 0) {
        const max = (this.o.winTo - 1) * 2;
        if (this.score.T >= this.o.winTo || this.score.CT >= this.o.winTo || this.round >= max) { this.over = true; this.ui.matchOver(this); return; }
        this.startRound(false);
      }
    }
    if (this.dm && !this.over) {
      this.dmTime -= dt;
      const lead = this.actors.reduce((m, a) => a.kills > m.kills ? a : m, this.actors[0]);
      if (this.dmTime <= 0 || lead.kills >= this.dmLimit) { this.over = true; this.ui.matchOver(this); return; }
      for (const a of this.actors) if (!a.alive) { a.respT = (a.respT || 0) + dt; if (a.respT > 2.2) this.dmRespawn(a); }
      for (const a of this.actors) a.money = 16000;
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
    if (this.aimMode) this._aimTargets(dt);
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
    this._effects(dt);
    this.checkWin();
    this._visuals(dt);
  }
  _effects(dt) {
    // дым
    for (let k = this.smokes.length - 1; k >= 0; k--) {
      const s = this.smokes[k]; s.t += dt;
      s.r = Math.min(s.R, s.R * s.t / 1.2);
      const fade = s.t > s.life - 2 ? Math.max(0, (s.life - s.t) / 2) : 1;
      for (const p of s.parts) {
        const u = p.userData, tt = Math.max(0, s.t - u.delay), g = 1 - Math.pow(1 - Math.min(1, tt / 1.6), 3);
        p.position.set(u.o.x * g + u.dr.x * s.t, 0.3 + (u.o.y - 0.3) * g + u.dr.y * s.t * (1 - fade * 0.5), u.o.z * g + u.dr.z * s.t);
        p.scale.setScalar(u.sz * (0.25 + 0.75 * g) * (1 + (1 - fade) * 0.4));
        p.material.rotation += u.rs * dt;
        p.material.opacity = Math.min(1, tt * 3) * 0.9 * fade;
      }
      if (s.t > s.life) { this.scene.remove(s.grp); this.smokes.splice(k, 1); }
    }
    for (let k = this.fires.length - 1; k >= 0; k--) {
      const f = this.fires[k]; f.t -= dt;
      for (const p of f.parts) { const ph = this.time * 9 + p.userData.ph; p.position.set(p.userData.o.x, 0.3 + Math.abs(Math.sin(ph)) * 0.5, p.userData.o.z); p.scale.setScalar(0.8 + Math.abs(Math.sin(ph * 0.7)) * 0.9); p.material.opacity = Math.min(1, f.t); }
      if (f.t <= 0) { this.scene.remove(f.grp); this.fires.splice(k, 1); }
    }
    for (let k = this.fx.length - 1; k >= 0; k--) {
      const e = this.fx[k];
      if (e.upd) { if (!e.upd(dt)) { this.scene.remove(e.obj); this.fx.splice(k, 1); } continue; }
      e.t -= dt;
      if (e.grow) e.obj.scale.addScalar(e.grow * dt);
      if (e.obj.material) e.obj.material.opacity = Math.max(0, Math.min(1, e.t * 5));
      if (e.t <= 0) { this.scene.remove(e.obj); e.obj.material && e.obj.material.dispose(); this.fx.splice(k, 1); }
    }
    for (const t of this.tracers) if (t.l.visible) { t.t -= dt; if (t.t <= 0) t.l.visible = false; }
  }
  _visuals(dt) {
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
    for (const a of this.actors) if (a !== p) {
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
    if (this.eyeY == null || Math.abs(e.y - this.eyeY) > 1.6 || view !== this.lastView) this.eyeY = e.y;
    else this.eyeY += (e.y - this.eyeY) * Math.min(1, dt * 16);
    this.lastView = view; e.y = this.eyeY;
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
    this.shake = Math.max(0, (this.shake || 0) - dt * 1.4);
    const sh = this.shake * this.shake * 0.06;
    const vp = pitch + view.punch.p * 0.5 + (Math.random() - 0.5) * sh, vy = yaw + view.punch.y * 0.5 + (Math.random() - 0.5) * sh;
    this.camera.rotation.order = 'YXZ'; this.camera.rotation.set(vp, vy, 0);
    const zd = view.cur && WEAPONS[view.cur.id], zl = zd && zd.zoom;
    const fov = !view.scope ? this.baseFov : zl ? (zl[view.scope - 1] || this.baseFov) : view.scope === 1 ? 40 : 15;
    if (this.camera.fov !== fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    // вьюмодель
    if (view.cur) {
      const inst = view.cur, id = inst.nade || inst.c4 ? inst.id : (inst.model || inst.id);
      if (this.vmKey !== view.id + '|' + view.agent.id + '|' + id + '|' + inst.skin + '|' + (view.skins.gloves || '')) this._buildViewmodel(view);
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
      const isKnife = view.cur && view.cur.id === 'knife' && this.vmSpin, km = isKnife ? (view.cur.model || 'knife') : null;
      const ks = this.vmSpin, kn = this.vmKnife;
      if (ks) ks.rotation.set(0, 0, 0);
      if (kn) kn.children.forEach(h => { if (h.userData.handle) h.rotation.x = 0; });
      // нож: прокрутка при доставании (крутится только нож)
      if (isKnife && this.vmDraw > 0) { const d = this.vmDraw; ks.rotation.x -= d * d * Math.PI * 2 * (km === 'butterfly' ? 2 : 1); }
      // осмотр: поворачиваем оружие к себе, крутим и возвращаем
      if (this.inspectT > 0 && view === p) {
        this.inspectT = Math.max(0, this.inspectT - dt);
        const u = 1 - this.inspectT / 3.2, e = Math.sin(Math.min(1, u * 4) * Math.PI / 2) * Math.sin(Math.min(1, (1 - u) * 4) * Math.PI / 2);
        const su = Math.max(0, Math.min(1, (u - 0.18) / 0.62)), spin = su * su * (3 - 2 * su);
        if (isKnife) {
          // рука слегка поворачивает нож к себе, сам нож крутится в пальцах
          this.vmGun.rotation.y += e * 0.35; this.vmGun.position.x -= e * 0.03; this.vmGun.position.y += e * 0.02;
          if (km === 'karambit' || km === 'talon') ks.rotation.x -= spin * Math.PI * 4;
          else if (km === 'butterfly') {
            ks.rotation.z += spin * Math.PI * 4;
            kn.children.forEach(h => { if (h.userData.handle) h.rotation.x = Math.abs(Math.sin(spin * Math.PI * 3)) * Math.PI * 0.95 * h.userData.handle; });
          } else { ks.rotation.y += spin * Math.PI * 2; ks.rotation.x += Math.sin(spin * Math.PI) * 0.5; }
        } else {
          const ph = u < 0.5 ? 0 : (u - 0.5) * 2;
          this.vmGun.rotation.y += e * (0.9 + Math.sin(ph * Math.PI) * 0.7);
          this.vmGun.rotation.z += e * (0.5 - Math.sin(ph * Math.PI) * 1.1);
          this.vmGun.rotation.x += e * 0.15;
          this.vmGun.position.x -= e * 0.07; this.vmGun.position.y += e * 0.04; this.vmGun.position.z += e * 0.03;
        }
      }
      this.vmGun.updateMatrixWorld();
      if (this.flashT > 0) { this.flashT -= dt; const m = this.vmMuzzle.clone().applyMatrix4(this.vmGun.matrixWorld); this.flash.position.copy(m); } else this.flash.visible = false;
    }
  }
  render() {
    const r = this.r;
    if (this.dome) this.dome.position.copy(this.camera.position);
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
