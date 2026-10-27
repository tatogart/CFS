// Интерфейс: меню, кейсы, инвентарь, агенты, HUD
import * as THREE from '../vendor/three.module.min.js';
import { MAPS, CELL } from './maps.js';
import { WEAPONS, NADES, GEAR, BUY_GROUPS, CASES, RARITY, RARITY_ORDER, AGENTS, DIFFICULTIES, skinById, weaponName, agentById } from './data.js';
import { load, persist, S, addItem, sellItem, equipItem, isEquipped, loadout, rollCase } from './store.js';
import { weaponIconURL, caseIconURL, mapThumbURL } from './art.js';
import { AgentModel } from './models.js';
import { Controls, isTouch } from './controls.js';
import { initAudio, play, setVolume } from './sfx.js';
import { Game } from './game.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

load();
const save = S();
const touch = isTouch();
if (touch) document.body.classList.add('touch');
setVolume(save.settings.volume);

// ---------- рендер ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !touch, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
function quality() { const q = save.settings.quality; return q === 'auto' ? (touch ? 0 : 2) : +q; }
function applyQuality() {
  const q = quality();
  renderer.setPixelRatio(Math.min(devicePixelRatio, q === 0 ? 1 : q === 1 ? 1.25 : 1.75));
  renderer.shadowMap.enabled = q >= 2; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(innerWidth, innerHeight, false);
}
applyQuality();
const controls = new Controls(canvas, $('touch'));
let game = null;

// ---------- меню ----------
const tabs = $('tabs');
tabs.onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  tabs.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id === 'tab-' + b.dataset.tab));
  if (b.dataset.tab === 'inv') renderInv();
  if (b.dataset.tab === 'agents') startAgentView(); else stopAgentView();
  if (b.dataset.tab === 'settings') renderSettings();
  play('tick');
};
function coins() { $('coins').textContent = save.coins.toLocaleString('ru'); $('coins2').textContent = save.coins.toLocaleString('ru'); }
coins();

function pills(box, items, cur, onPick) {
  box.innerHTML = '';
  for (const [v, label] of items) {
    const b = el('button', v === cur ? 'on' : '', esc(label));
    b.onclick = () => { box.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); onPick(v); persist(); play('tick'); };
    box.appendChild(b);
  }
}
function renderPlay() {
  const mb = $('maps'); mb.innerHTML = '';
  for (const m of MAPS) {
    const b = el('button', 'map' + (save.last.map === m.id ? ' on' : ''));
    b.innerHTML = `<img src="${mapThumbURL(m)}" alt=""><div class="mn"><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></div>`;
    b.onclick = () => { save.last.map = m.id; mb.querySelectorAll('.map').forEach(x => x.classList.remove('on')); b.classList.add('on'); persist(); play('tick'); };
    mb.appendChild(b);
  }
  const showDesc = id => { const d = DIFFICULTIES.find(x => x.id === id); $('diffDesc').textContent = d.desc + (d.reward ? ` · награда ×${d.reward}` : ' · без награды'); };
  pills($('diffs'), DIFFICULTIES.map(d => [d.id, d.name]), save.last.diff, v => { save.last.diff = v; showDesc(v); });
  showDesc(save.last.diff);
  pills($('sides'), [['auto', 'Случайно'], ['T', 'Террористы'], ['CT', 'Спецназ']], save.last.side, v => save.last.side = v);
  pills($('sizes'), [[1, '1×1'], [2, '2×2'], [3, '3×3'], [5, '5×5']], save.last.size, v => save.last.size = v);
  pills($('lengths'), [[5, 'До 5'], [8, 'До 8'], [13, 'До 13']], save.last.winTo, v => save.last.winTo = v);
}
renderPlay();
$('start').onclick = () => startGame();

// ---------- кейсы ----------
function itemCard(skinId, extra = '') {
  const sk = skinById[skinId], r = RARITY[sk.rarity];
  const d = el('div', 'item');
  d.style.setProperty('--rc', r.color);
  d.innerHTML = `<img src="${weaponIconURL(sk.weapon, sk.id)}" alt=""><div class="wn">${esc(weaponName(sk.weapon))}</div><div class="sn">${esc(sk.name)}</div>${extra}`;
  return d;
}
function renderCases() {
  const box = $('caseList'); box.innerHTML = '';
  for (const cs of CASES) {
    const b = el('button', 'caseCard');
    b.innerHTML = `<img src="${caseIconURL(cs)}" alt=""><b>${esc(cs.name)}</b><div class="price">◈ ${cs.price}</div>`;
    b.onclick = () => openCaseScreen(cs);
    box.appendChild(b);
  }
}
renderCases();
let curCase = null, rolling = false;
function openCaseScreen(cs) {
  curCase = cs; $('menu').classList.add('hidden'); $('caseScreen').classList.remove('hidden');
  $('caseTitle').textContent = cs.name; $('caseImg').src = caseIconURL(cs);
  const box = $('caseItems'); box.innerHTML = '';
  const sorted = cs.items.slice().sort((a, b) => RARITY_ORDER.indexOf(skinById[a].rarity) - RARITY_ORDER.indexOf(skinById[b].rarity));
  for (const id of sorted) {
    const sk = skinById[id];
    if (sk.rarity === 'gold') continue;
    box.appendChild(itemCard(id));
  }
  // редкий особый предмет показываем как «★»
  const gold = el('div', 'item'); gold.style.setProperty('--rc', RARITY.gold.color);
  gold.innerHTML = `<img src="${weaponIconURL('karambit', 'kn_kar_fade')}" alt="" style="filter:brightness(0) drop-shadow(0 0 6px #e4ae39)"><div class="wn">★ Редкий особый предмет</div><div class="sn">Нож</div>`;
  box.appendChild(gold);
  resetStrip(); updOpenBtn(); play('tick');
}
function updOpenBtn() { const b = $('openBtn'); b.textContent = `Открыть · ◈ ${curCase.price}`; b.disabled = save.coins < curCase.price || rolling; coins(); }
function resetStrip() { const s = $('strip'); s.style.transition = 'none'; s.style.transform = 'translateX(0)'; s.innerHTML = ''; for (let i = 0; i < 12; i++) s.appendChild(itemCard(curCase.items[i % curCase.items.length])); }
$('caseBack').onclick = () => { if (rolling) return; $('caseScreen').classList.add('hidden'); $('menu').classList.remove('hidden'); coins(); };
$('openBtn').onclick = () => {
  if (rolling || save.coins < curCase.price) return;
  initAudio();
  save.coins -= curCase.price; save.stats.opened++; persist(); rolling = true; updOpenBtn();
  const win = rollCase(curCase.id);
  const strip = $('strip'); strip.style.transition = 'none'; strip.style.transform = 'translateX(0)'; strip.innerHTML = '';
  const N = 56, WI = 47;
  for (let i = 0; i < N; i++) {
    const id = i === WI ? win : rollCase(curCase.id);
    const c = itemCard(id);
    if (i !== WI && skinById[id].rarity === 'gold') { c.querySelector('img').style.filter = 'brightness(0) drop-shadow(0 0 6px #e4ae39)'; }
    strip.appendChild(c);
  }
  const itemW = 156, view = strip.parentElement.clientWidth;
  const off = WI * itemW + itemW / 2 - view / 2 + (Math.random() - 0.5) * (itemW * 0.7);
  strip.getBoundingClientRect();
  requestAnimationFrame(() => {
    strip.style.transition = 'transform 6s cubic-bezier(0.08, 0.6, 0.12, 1)';
    strip.style.transform = `translateX(${-off}px)`;
  });
  // щелчки рулетки
  const t0 = performance.now(); let lastIdx = 0;
  const tick = () => {
    if (!rolling) return;
    const m = new DOMMatrix(getComputedStyle(strip).transform), x = -m.m41, idx = Math.floor((x + view / 2) / itemW);
    if (idx !== lastIdx) { lastIdx = idx; play('tick'); }
    if (performance.now() - t0 < 6100) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setTimeout(() => { rolling = false; showDrop(win); updOpenBtn(); }, 6200);
};
function showDrop(skinId) {
  const sk = skinById[skinId], r = RARITY[sk.rarity];
  const item = addItem(skinId);
  $('drop').classList.remove('hidden');
  const card = $('dropCard'); card.style.setProperty('--rc', r.color);
  card.style.animation = 'none'; card.offsetHeight; card.style.animation = '';
  $('dropRar').textContent = r.name; $('dropImg').src = weaponIconURL(sk.weapon, sk.id, 512, 192);
  $('dropName').textContent = `${weaponName(sk.weapon)} | ${sk.name}`;
  $('dropSell').textContent = `Продать · ◈ ${r.sell}`;
  $('dropKeep').onclick = () => { $('drop').classList.add('hidden'); };
  $('dropSell').onclick = () => { sellItem(item.uid); $('drop').classList.add('hidden'); updOpenBtn(); coins(); };
  play(RARITY_ORDER.indexOf(sk.rarity) >= 2 ? 'rare' : 'buy');
}

// ---------- инвентарь ----------
$('invSort').onchange = () => renderInv();
function renderInv() {
  const box = $('invList'); box.innerHTML = '';
  const sort = $('invSort').value;
  const list = save.inv.slice();
  if (sort === 'new') list.reverse();
  if (sort === 'rar') list.sort((a, b) => RARITY_ORDER.indexOf(skinById[b.skin].rarity) - RARITY_ORDER.indexOf(skinById[a.skin].rarity));
  if (sort === 'w') list.sort((a, b) => skinById[a.skin].weapon.localeCompare(skinById[b.skin].weapon));
  $('invCount').textContent = `Предметов: ${list.length}`;
  if (!list.length) { box.appendChild(el('div', 'empty', 'Инвентарь пуст. Открой кейс во вкладке «Кейсы»!')); return; }
  for (const it of list) {
    const sk = skinById[it.skin], eq = isEquipped(it.uid);
    const c = itemCard(it.skin, `${eq ? '<span class="eq">НАДЕТО</span>' : ''}<div class="acts"><button class="e">${eq ? 'Снять' : 'Надеть'}</button><button class="s">◈ ${RARITY[sk.rarity].sell}</button></div>`);
    c.querySelector('.e').onclick = () => { equipItem(it.uid); renderInv(); play('buy'); };
    c.querySelector('.s').onclick = () => { if (confirm(`Продать ${weaponName(sk.weapon)} | ${sk.name}?`)) { sellItem(it.uid); coins(); renderInv(); } };
    box.appendChild(c);
  }
}

// ---------- агенты (3D-превью) ----------
let av = null;
function startAgentView() {
  renderAgentLists();
  if (av) return;
  const cv = $('agentView');
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  r.outputColorSpace = THREE.SRGBColorSpace; r.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#334455', 1.4));
  const dl = new THREE.DirectionalLight('#ffffff', 1.6); dl.position.set(2, 4, 3); scene.add(dl);
  const rim = new THREE.DirectionalLight('#88aaff', 0.8); rim.position.set(-3, 2, -3); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#1f2a38' })); scene.add(floor);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50); cam.position.set(0, 1.25, 4.6); cam.lookAt(0, 0.95, 0);
  av = { r, scene, cam, rot: Math.PI - 0.5, model: null, id: null, drag: null };
  cv.onpointerdown = e => { av.drag = e.clientX; cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => { if (av && av.drag != null) { av.rot += (e.clientX - av.drag) * 0.01; av.drag = e.clientX; } };
  cv.onpointerup = () => { if (av) av.drag = null; };
  setAgentPreview(save.agent.T);
  const loop = () => {
    if (!av) return;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (r.domElement.width !== Math.floor(w * r.getPixelRatio())) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if (av.drag == null) av.rot += 0.006;
    if (av.model) { av.model.root.rotation.y = av.rot; av.model.update({ dt: 0.016, speed: 0, crouch: false, pitch: 0 }); }
    r.render(scene, cam); av.raf = requestAnimationFrame(loop);
  };
  loop();
}
function setAgentPreview(id) {
  if (!av) return;
  if (av.model) av.scene.remove(av.model.root);
  const ag = agentById[id];
  const lo = loadout();
  const gun = ag.team === 'T' ? 'ak47' : 'm4a4';
  av.model = new AgentModel(ag, gun, lo[gun] || null); av.id = id;
  av.scene.add(av.model.root);
  renderAgentLists();
}
function stopAgentView() { if (!av) return; cancelAnimationFrame(av.raf); av.r.dispose(); av = null; }
function renderAgentLists() {
  for (const team of ['T', 'CT']) {
    const box = $('agents' + team); box.innerHTML = '';
    for (const ag of AGENTS.filter(a => a.team === team)) {
      const b = el('button', (save.agent[team] === ag.id ? 'on' : '') + (av && av.id === ag.id ? ' sel' : ''));
      b.innerHTML = `<i style="background:linear-gradient(135deg, ${ag.c.vest}, ${ag.c.shirt} 60%, ${ag.c.accent})"></i>${esc(ag.name)}`;
      b.onclick = () => { save.agent[team] = ag.id; persist(); setAgentPreview(ag.id); play('buy'); };
      box.appendChild(b);
    }
  }
}

// ---------- настройки ----------
function renderSettings() {
  const s = save.settings, box = $('settingsBox'); box.innerHTML = '';
  const range = (key, label, min, max, step, fmt = v => v) => {
    const l = el('label', '', `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}"><span class="val">${fmt(s[key])}</span>`);
    const inp = l.querySelector('input'); inp.oninput = () => { s[key] = +inp.value; l.querySelector('.val').textContent = fmt(s[key]); if (key === 'volume') setVolume(s[key]); persist(); };
    box.appendChild(l);
  };
  const check = (key, label) => { const l = el('label', '', `<span>${label}</span><input type="checkbox" ${s[key] ? 'checked' : ''}>`); l.querySelector('input').onchange = e => { s[key] = e.target.checked; persist(); }; box.appendChild(l); };
  range('sens', 'Чувствительность мыши', 0.2, 3, 0.05, v => (+v).toFixed(2));
  range('touchSens', 'Чувствительность экрана', 0.2, 3, 0.05, v => (+v).toFixed(2));
  range('fov', 'Поле зрения', 60, 100, 1);
  range('volume', 'Громкость', 0, 1, 0.05, v => Math.round(v * 100) + '%');
  const ql = el('label', '', `<span>Графика</span><select><option value="auto">Авто</option><option value="0">Низкая</option><option value="1">Средняя</option><option value="2">Высокая (тени)</option></select>`);
  const sel = ql.querySelector('select'); sel.value = s.quality; sel.onchange = () => { s.quality = sel.value; persist(); applyQuality(); }; box.appendChild(ql);
  const cl = el('label', '', `<span>Цвет прицела</span><input type="color" value="${s.crosshair}">`); cl.querySelector('input').oninput = e => { s.crosshair = e.target.value; persist(); }; box.appendChild(cl);
  check('invertY', 'Инверсия по вертикали');
  check('fps', 'Показывать FPS');
  const reset = el('button', 'big', 'Сбросить прогресс'); reset.onclick = () => { if (confirm('Удалить все монеты, предметы и статистику?')) { localStorage.removeItem('cfs_save_v1'); location.reload(); } }; box.appendChild(reset);
  const st = save.stats;
  $('statsBox').innerHTML = `<div>Убийств<b>${st.kills}</b></div><div>Смертей<b>${st.deaths}</b></div><div>K/D<b>${(st.kills / Math.max(1, st.deaths)).toFixed(2)}</b></div><div>Матчей<b>${st.matches}</b></div><div>Побед<b>${st.wins}</b></div><div>Кейсов открыто<b>${st.opened}</b></div>`;
}

// ---------- HUD ----------
const hud = {
  centerT: 0,
  center(t, dur, color) { const c = $('center'); c.textContent = t; c.style.color = color || '#fff'; c.style.opacity = 1; this.centerT = dur; },
  hitmark(hs) { const h = $('hitm'); h.className = hs ? 'hs' : ''; h.style.opacity = 1; this.hitT = 0.25; },
  hurt() { $('hurtOv').style.opacity = 1; this.hurtT = 0.3; },
  flashed(d) { this.flashT = Math.max(this.flashT || 0, d); this.flashMax = Math.max(this.flashT, 0.5); },
  feed(a, v, wid, hs, player) {
    const f = $('feed');
    const icon = (WEAPONS[wid] || NADES[wid] || ['karambit', 'butterfly', 'bayonet'].includes(wid)) ? `<img src="${weaponIconURL(wid, null, 96, 36)}" alt="">` : (wid === 'fall' ? '⬇' : '☠');
    const nm = x => x ? `<span class="${x.team === 'T' ? 't' : 'ct'}">${esc(x.name)}</span>` : '';
    const d = el('div', (a === player || v === player) ? 'me' : '', `${a && a !== v ? nm(a) : ''}${icon}${hs ? '<span class="hs">◉</span>' : ''}${nm(v)}`);
    f.prepend(d); while (f.children.length > 5) f.lastChild.remove();
    setTimeout(() => d.remove(), 6000);
  },
  roundStart(g) { closeBuy(); $('board').classList.add('hidden'); },
  onRoundEnd() {},
  onKill() {},
  matchOver(g) { endMatch(g); },
  menuOpen() { return !$('buy').classList.contains('hidden') || !$('pause').classList.contains('hidden') || !$('over').classList.contains('hidden'); },
  pause() { openPause(); },
  openBuy() { openBuy(); },
};
function buildSlots(g) {
  const p = g.player, box = $('slots');
  const key = [p.slot, p.weapons[1] && p.weapons[1].id, p.weapons[2] && p.weapons[2].id, p.weapons[3] && p.weapons[3].model, p.nades.join(','), p.hasBomb, p.cur && p.cur.id].join('|');
  if (key === hud.slotKey) return; hud.slotKey = key;
  box.innerHTML = '';
  const add = (slot, wid, skin, label) => {
    const d = el('div', p.slot === slot ? 'on' : '', `${slot} <img src="${weaponIconURL(wid, skin, 96, 36)}" alt="">${label ? esc(label) : ''}`);
    d.onclick = d.ontouchstart = e => { e.preventDefault(); e.stopPropagation(); g.selectSlot(p, slot); };
    box.appendChild(d);
  };
  if (p.weapons[1]) add(1, p.weapons[1].id, p.weapons[1].skin);
  if (p.weapons[2]) add(2, p.weapons[2].id, p.weapons[2].skin);
  if (p.weapons[3]) add(3, p.weapons[3].model || 'knife', p.weapons[3].skin);
  if (p.nades.length) add(4, p.slot === 4 && p.cur ? p.cur.id : p.nades[0], null, p.nades.length > 1 ? '×' + p.nades.length : '');
  if (p.hasBomb) { const d = el('div', p.slot === 5 ? 'on' : '', '5 💣 C4'); d.onclick = d.ontouchstart = e => { e.preventDefault(); e.stopPropagation(); g.selectSlot(p, 5); }; box.appendChild(d); }
}
let fpsAcc = 0, fpsN = 0, fpsT = 0;
function updateHud(g, dt) {
  const p = g.player, view = g.viewing || p;
  const set = (id, v) => { const e = $(id); if (e._v !== v) { e._v = v; e.textContent = v; } };
  set('hpV', Math.max(0, Math.ceil(view.hp))); $('hpV').classList.toggle('low', view.hp < 30);
  set('arV', Math.ceil(view.armor) + (view.helmet ? '+' : ''));
  set('money', '$' + p.money);
  const cur = view.cur, def = cur && WEAPONS[cur.id];
  if (def && def.mag) { set('mag', p.reloadT > 0 && view === p ? '…' : cur.mag); set('res', '/' + cur.reserve); }
  else { set('mag', cur && cur.nade ? (NADES[cur.id] ? '' : '') : ''); set('res', cur ? (cur.nade ? NADES[cur.id].name : cur.c4 ? 'C4' : '') : ''); }
  const wi = cur ? (cur.nade || cur.c4 ? cur.id : (cur.model || cur.id)) : null;
  if (wi && hud.wiKey !== wi + cur.skin) { hud.wiKey = wi + cur.skin; $('wIcon').src = cur.c4 ? '' : weaponIconURL(wi, cur.skin, 96, 36); }
  buildSlots(g);
  // таймер/счёт
  set('scT', g.score.T); set('scCT', g.score.CT);
  const B = g.bomb;
  let tt = g.state === 'freeze' ? g.stateT : g.state === 'end' ? g.stateT : g.roundTime;
  if (B && B.planted && !B.done) tt = B.timer;
  if (g.practice) set('timer', 'ТРЕНИРОВКА');
  else set('timer', `${Math.floor(Math.max(0, tt) / 60)}:${String(Math.floor(Math.max(0, tt) % 60)).padStart(2, '0')}`);
  $('timer').classList.toggle('bomb', !!(B && B.planted && !B.done));
  if (!g.practice) {
    const aT = g.actors.filter(a => a.team === 'T'), aC = g.actors.filter(a => a.team === 'CT');
    const dots = (l, c) => l.map(a => `<span class="${c}">${a.alive ? '●' : '○'}</span>`).join('');
    const ak = aT.map(a => a.alive ? 1 : 0).join('') + aC.map(a => a.alive ? 1 : 0).join('');
    if (hud.aliveKey !== ak) { hud.aliveKey = ak; $('alive').innerHTML = dots(aT, 't') + ' ' + dots(aC, 'ct'); }
  }
  // прицел
  const cr = $('cross');
  if (def && def.type !== 'knife') {
    const sp = g.hspeed(p), mv = Math.max(0, Math.min(1, (sp - 1.3) / (def.speed - 1.3)));
    const gap = 4 + (def.spread + def.move * mv + (!p.onGround ? 0.06 : 0) + Math.min(p.recoilIdx, 8) * def.recoil * 0.2) * 300;
    cr.style.setProperty('--g', Math.min(40, gap).toFixed(1) + 'px');
  } else cr.style.setProperty('--g', '5px');
  cr.style.setProperty('--c', g.settings.crosshair);
  const scoped = p.alive && p.scope > 0;
  $('scope').classList.toggle('hidden', !scoped);
  cr.style.display = scoped || view !== p || (def && def.scope && !p.scope) ? 'none' : '';
  // эффекты
  hud.flashT = Math.max(0, (hud.flashT || 0) - dt);
  $('flashOv').style.opacity = hud.flashT > 0 ? Math.min(1, hud.flashT / 1.2).toFixed(3) : 0;
  $('smokeOv').style.opacity = (g.camInSmoke() * 0.92).toFixed(2);
  if (hud.hurtT > 0) { hud.hurtT -= dt; if (hud.hurtT <= 0) $('hurtOv').style.opacity = 0; }
  if (hud.hitT > 0) { hud.hitT -= dt; if (hud.hitT <= 0) $('hitm').style.opacity = 0; }
  if (hud.centerT > 0) { hud.centerT -= dt; if (hud.centerT <= 0) $('center').style.opacity = 0; }
  // подсказки и прогресс
  let hint = '', prog = 0, progT = '';
  const inSite = g.world.siteAt(p.pos.x, p.pos.z);
  if (p.alive && p.hasBomb && inSite && g.state === 'live') hint = touch ? 'Удерживайте E — заложить бомбу' : 'Удерживайте E — заложить бомбу';
  if (p.alive && p.team === 'CT' && B && B.planted && !B.done && p.pos.distanceTo(B.pos) < 1.6) hint = 'Удерживайте E — разминировать' + (p.kit ? ' (набор сапёра)' : '');
  if (p.plantT > 0) { prog = p.plantT / 3.2; progT = 'Закладка…'; }
  if (p.defuseT > 0) { prog = p.defuseT / (p.kit ? 5 : 10); progT = 'Разминирование…'; }
  if (g.state === 'freeze' && g.canBuy(p)) hint = touch ? 'Нажмите $ — закупка' : 'B — закупка';
  if (!touch && !controls.locked) hint = 'Кликните по экрану, чтобы управлять мышью';
  set('hint', hint);
  $('prog').classList.toggle('hidden', !prog); if (prog) { $('progBar').style.width = (prog * 100).toFixed(1) + '%'; set('progTxt', progT); }
  // наблюдение
  const sp = $('spect');
  if (!p.alive && !g.practice) { sp.classList.remove('hidden'); set('spect', view !== p ? `Наблюдение: ${view.name} · нажмите огонь, чтобы переключить` : 'Вы погибли'); }
  else sp.classList.add('hidden');
  // таблица
  const showBoard = controls.s.score || g.state === 'end' && false;
  $('board').classList.toggle('hidden', !showBoard);
  if (showBoard) renderBoard(g);
  drawMini(g);
  if (g.settings.fps) { fpsAcc += dt; fpsN++; fpsT += dt; if (fpsT > 0.5) { set('fps', Math.round(fpsN / fpsAcc) + ' FPS'); fpsAcc = fpsN = fpsT = 0; } }
}
function renderBoard(g) {
  const rows = team => g.actors.filter(a => a.team === team).sort((a, b) => b.kills - a.kills).map(a => `<tr class="${team === 'T' ? 't' : 'ct'} ${a.alive ? '' : 'dead'} ${a === g.player ? 'me' : ''}"><td>${esc(a.name)}</td><td>${a.kills}</td><td>${a.deaths}</td><td>$${a.money}</td></tr>`).join('');
  $('board').innerHTML = `<h4>${esc(g.o.map.name)} · раунд ${g.round}</h4><table><tr><th>Террористы — ${g.score.T}</th><th>У</th><th>С</th><th>$</th></tr>${rows('T')}<tr><th>Спецназ — ${g.score.CT}</th><th></th><th></th><th></th></tr>${rows('CT')}</table>`;
}
function drawMini(g) {
  const cv = $('mini'), c = cv.getContext('2d'), W = cv.width, w = g.world, sc = W / (w.w * CELL);
  c.clearRect(0, 0, W, W);
  if (g.minimapBg.complete) { c.globalAlpha = 0.85; c.drawImage(g.minimapBg, 0, 0, W, W); c.globalAlpha = 1; }
  const p = g.player;
  const dot = (a, col, r = 3) => { c.fillStyle = col; c.beginPath(); c.arc(a.pos.x * sc, a.pos.z * sc, r, 0, 7); c.fill(); };
  for (const a of g.actors) {
    if (a === p) continue;
    if (!a.alive) { if (a.team === p.team) { c.fillStyle = '#888'; c.fillText('×', a.pos.x * sc - 3, a.pos.z * sc + 3); } continue; }
    if (a.team === p.team) dot(a, a.team === 'T' ? '#e8b04a' : '#6aa8ff');
    else if (g.time - (a.lastFired || -9) < 1.5 || (g.intel && g.intel[p.team] && g.intel[p.team].pos === a.pos)) dot(a, '#ff3a3a');
  }
  for (const s of g.smokes) { c.fillStyle = 'rgba(220,220,220,0.6)'; c.beginPath(); c.arc(s.c.x * sc, s.c.z * sc, s.r * sc, 0, 7); c.fill(); }
  for (const f of g.fires) { c.fillStyle = 'rgba(255,120,20,0.6)'; c.beginPath(); c.arc(f.c.x * sc, f.c.z * sc, f.r * sc, 0, 7); c.fill(); }
  if (g.bomb && (p.team === 'T' || g.bomb.planted)) { c.fillStyle = g.bomb.planted ? '#ff3020' : '#ffaa00'; c.fillRect(g.bomb.pos.x * sc - 3, g.bomb.pos.z * sc - 3, 6, 6); }
  const carrier = g.actors.find(a => a.hasBomb && a.alive && a.team === p.team); if (carrier) { c.strokeStyle = '#ffaa00'; c.lineWidth = 2; c.beginPath(); c.arc(carrier.pos.x * sc, carrier.pos.z * sc, 5, 0, 7); c.stroke(); }
  // игрок — стрелка
  if (p.alive) {
    c.save(); c.translate(p.pos.x * sc, p.pos.z * sc); c.rotate(-p.yaw);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -6); c.lineTo(4, 4); c.lineTo(0, 2); c.lineTo(-4, 4); c.closePath(); c.fill(); c.restore();
  }
}

// ---------- закупка ----------
function openBuy() {
  if (!game) return;
  controls.suppressPause = true; $('buy').classList.remove('hidden'); controls.unlock(); renderBuy();
}
function closeBuy() { if ($('buy').classList.contains('hidden')) return; $('buy').classList.add('hidden'); controls.suppressPause = false; if (game && !touch) controls.lock(); }
$('buyClose').onclick = closeBuy;
addEventListener('keydown', e => { if (!$('buy').classList.contains('hidden') && (e.code === 'KeyB' || e.code === 'Escape')) { e.preventDefault(); closeBuy(); setTimeout(() => { controls.edges.delete('buy'); controls.edges.delete('pause'); }, 0); } });
$('buy').onclick = e => { if (e.target.id === 'buy') closeBuy(); };
function renderBuy() {
  const g = game, p = g.player, body = $('buyBody'); body.innerHTML = '';
  $('buyMoney').textContent = g.practice ? '∞' : '$' + p.money;
  for (const grp of BUY_GROUPS) {
    const sec = el('div', 'bgroup', `<h4>${esc(grp.name)}</h4>`), grid = el('div', 'bgrid');
    for (const id of grp.items) {
      if (!g.canTeam(p, id)) continue;
      const price = g.priceOf(p, id);
      const name = WEAPONS[id] ? WEAPONS[id].name : NADES[id] ? (id === 'molotov' && p.team === 'CT' ? NADES[id].ctName : NADES[id].name) : GEAR[id].name;
      const own = (WEAPONS[id] && p.weapons[WEAPONS[id].slot] && p.weapons[WEAPONS[id].slot].id === id) || (id === 'kit' && p.kit) || (id === 'vesthelm' && p.helmet) || (id === 'vest' && p.armor >= 100);
      const skin = WEAPONS[id] ? (p.skins[id] || null) : null;
      const b = el('button', 'bitem' + (own ? ' own' : ''), `<img src="${weaponIconURL(id, skin, 192, 72)}" alt=""><div>${esc(name)}</div><div class="pr">$${price}</div>`);
      b.disabled = !g.practice && p.money < price;
      b.onclick = () => { if (g.buy(p, id)) renderBuy(); };
      grid.appendChild(b);
    }
    sec.appendChild(grid); body.appendChild(sec);
  }
}

// ---------- пауза / выход ----------
function openPause() { $('pause').classList.remove('hidden'); $('pSens').value = touch ? save.settings.touchSens : save.settings.sens; controls.unlock(); }
$('pSens').oninput = e => { if (touch) { save.settings.touchSens = +e.target.value; controls.touchSens = +e.target.value; } else save.settings.sens = +e.target.value; persist(); };
$('resume').onclick = () => { $('pause').classList.add('hidden'); if (!touch) controls.lock(); };
$('quit').onclick = () => { $('pause').classList.add('hidden'); quitGame(); };
$('overOk').onclick = () => { $('over').classList.add('hidden'); quitGame(); };

function endMatch(g) {
  controls.unlock();
  const p = g.player, won = g.score[p.team] > g.score[p.team === 'T' ? 'CT' : 'T'], draw = g.score.T === g.score.CT;
  const reward = Math.round((p.kills * 15 + g.score[p.team] * 30 + (won ? 250 : 50)) * g.diff.reward);
  save.coins += reward; save.stats.matches++; if (won) save.stats.wins++; save.stats.kills += p.kills; save.stats.deaths += p.deaths; persist();
  $('overTitle').textContent = draw ? 'Ничья' : won ? 'Победа!' : 'Поражение';
  const rows = g.actors.slice().sort((a, b) => b.kills - a.kills).map(a => `<tr style="color:${a.team === 'T' ? '#e8b04a' : '#6aa8ff'}${a === p ? ';font-weight:800' : ''}"><td>${esc(a.name)}</td><td>${a.kills}</td><td>${a.deaths}</td></tr>`).join('');
  $('overBody').innerHTML = `<p class="center" style="font-size:22px">T ${g.score.T} : ${g.score.CT} CT</p><table><tr><th>Игрок</th><th>Убийства</th><th>Смерти</th></tr>${rows}</table><div class="reward">+ ◈ ${reward} монет</div>`;
  $('over').classList.remove('hidden');
  play(won ? 'win' : 'lose');
}

// ---------- запуск матча ----------
function startGame() {
  initAudio();
  const map = MAPS.find(m => m.id === save.last.map) || MAPS[0];
  const diff = DIFFICULTIES.find(d => d.id === save.last.diff) || DIFFICULTIES[3];
  const side = save.last.side === 'auto' ? (Math.random() < 0.5 ? 'T' : 'CT') : save.last.side;
  $('loading').classList.remove('hidden');
  stopAgentView();
  setTimeout(() => {
    try {
      game = new Game(renderer, { map, diff, side, size: +save.last.size, winTo: +save.last.winTo, settings: save.settings, quality: quality(), controls, loadout: loadout(), agents: save.agent }, hud);
    } catch (e) { $('loading').classList.add('hidden'); alert('Ошибка запуска: ' + e.message); console.error(e); return; }
    $('menu').classList.add('hidden'); $('hud').classList.remove('hidden'); $('loading').classList.add('hidden');
    $('touch').classList.toggle('hidden', !touch);
    $('fps').classList.toggle('hidden', !save.settings.fps);
    $('feed').innerHTML = '';
    controls.reset(); controls.enabled = true; controls.touchSens = save.settings.touchSens;
    if (!touch) controls.lock();
    if (touch) { try { const d = document.documentElement; (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d); screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* нет полноэкранного режима */ } }
    checkRotate();
    last = performance.now();
  }, 30);
}
function quitGame() {
  if (game) { game.dispose(); game = null; }
  controls.enabled = false; controls.unlock(); controls.reset();
  $('hud').classList.add('hidden'); $('menu').classList.remove('hidden'); $('rotate').classList.add('hidden');
  closeBuy();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  coins(); renderInv();
}
function checkRotate() { $('rotate').classList.toggle('hidden', !(game && touch && innerHeight > innerWidth)); }
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); if (game) game.resize(); checkRotate(); });

// ---------- цикл ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  if (!game || window.__stop) return;
  const paused = !$('pause').classList.contains('hidden') || !$('over').classList.contains('hidden');
  if (!paused) game.update(dt);
  if (!game) return;
  game.render();
  updateHud(game, dt);
}
requestAnimationFrame(frame);
window.__cfs = { get game() { return game; }, startGame, save };
