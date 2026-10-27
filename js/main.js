// Интерфейс: меню, кейсы, инвентарь, агенты, HUD
import * as THREE from '../vendor/three.module.min.js';
import { MAPS, CELL } from './maps.js?v=1793119717';
import { WEAPONS, NADES, GEAR, BUY_GROUPS, CASES, RARITY, RARITY_ORDER, AGENTS, DIFFICULTIES, SKINS, GRAFFITI, KNIVES, skinById, weaponName, agentById } from './data.js?v=1793119717';
import { load, persist, S, addItem, sellItem, equipItem, isEquipped, loadout, rollCase } from './store.js?v=1793119717';
import { weaponIconURL, caseIconURL, mapThumbURL, graffitiURL } from './art.js?v=1793119717';
import { AgentModel } from './models.js?v=1793119717';
import { Controls, isTouch } from './controls.js?v=1793119717';
import { initAudio, play, setVolume } from './sfx.js?v=1793119717';
import { Net } from './net.js?v=1793119717';
import { Game } from './game.js?v=1793119717';

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
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
function quality() { const q = save.settings.quality; return q === 'auto' ? (touch ? 1 : 2) : +q; }
function applyQuality() {
  const q = quality();
  renderer.setPixelRatio(Math.min(devicePixelRatio, q === 0 ? 1 : q === 1 ? 1.25 : 1.75));
  renderer.shadowMap.enabled = q >= 1; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(innerWidth, innerHeight, false);
}
applyQuality();
const controls = new Controls(canvas, $('touch'));
let game = null;

// ---------- меню ----------
let curTab = 'home', homeReady = false;
function showTab(tab) {
  curTab = tab;
  document.querySelectorAll('#menu [data-tab]').forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
  document.querySelectorAll('#menu .page').forEach(p => p.classList.toggle('on', p.id === 'tab-' + tab));
  if (tab === 'inv') renderInv();
  if (tab === 'agents') renderAgentLists();
  if (tab === 'settings') renderSettings();
  if (tab === 'home') renderHome();
  play('tick');
}
$('menu').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { initAudio(); showTab(b.dataset.tab); } });
function coins() { $('coins').textContent = save.coins.toLocaleString('ru'); $('coins2').textContent = save.coins.toLocaleString('ru'); if (curTab === 'home' && homeReady) renderHome(); }
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
const casePrice = () => (save.admin && save.admin.freeCases ? 0 : curCase.price);
function updOpenBtn() { const b = $('openBtn'); b.textContent = `Открыть · ◈ ${casePrice()}`; b.disabled = save.coins < casePrice() || rolling; coins(); }
function resetStrip() { const s = $('strip'); s.style.transition = 'none'; s.style.transform = 'translateX(0)'; s.innerHTML = ''; for (let i = 0; i < 12; i++) s.appendChild(itemCard(curCase.items[i % curCase.items.length])); }
$('caseBack').onclick = () => { if (rolling) return; $('caseScreen').classList.add('hidden'); $('menu').classList.remove('hidden'); coins(); };
$('openBtn').onclick = () => {
  if (rolling || save.coins < casePrice()) return;
  initAudio();
  save.coins -= casePrice(); save.stats.opened++; persist(); rolling = true; updOpenBtn();
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
function renderGraffiti() {
  const box = $('grafList'); box.innerHTML = '';
  for (const g0 of GRAFFITI) {
    const b = el('button', save.graffiti === g0.id ? 'on' : '', `<img src="${graffitiURL(g0)}" alt="">${esc(g0.name)}`);
    b.onclick = () => { save.graffiti = g0.id; persist(); renderGraffiti(); play('spray'); };
    box.appendChild(b);
  }
}
function renderInv() {
  renderGraffiti();
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
    c.querySelector('.e').onclick = () => { equipItem(it.uid); M.id = null; setMenuAgent(save.agent[M.side]); renderInv(); play('buy'); };
    c.querySelector('.s').onclick = () => { if (confirm(`Продать ${weaponName(sk.weapon)} | ${sk.name}?`)) { sellItem(it.uid); coins(); renderInv(); } };
    box.appendChild(c);
  }
}

// ---------- 3D-сцена меню (агент на главной, как в CS2) ----------
const M = (() => {
  const scene = new THREE.Scene();
  const bg = document.createElement('canvas'); bg.width = 512; bg.height = 512; const g = bg.getContext('2d');
  const gr = g.createRadialGradient(200, 230, 20, 256, 256, 420); gr.addColorStop(0, '#3a4f69'); gr.addColorStop(0.45, '#1b2636'); gr.addColorStop(1, '#070a0f');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  const bt = new THREE.CanvasTexture(bg); bt.colorSpace = THREE.SRGBColorSpace; scene.background = bt;
  scene.add(new THREE.HemisphereLight('#c8d8ff', '#1a2028', 0.9));
  const key = new THREE.DirectionalLight('#ffe2c0', 2.2); key.position.set(2.5, 4, 3.5); scene.add(key);
  const rim = new THREE.DirectionalLight('#6aa8ff', 1.6); rim.position.set(-3, 2.5, -2.5); scene.add(rim);
  const rim2 = new THREE.DirectionalLight('#ffb060', 0.7); rim2.position.set(3, 1.5, -3); scene.add(rim2);
  // пол с пятном света
  const fc = document.createElement('canvas'); fc.width = fc.height = 256; const f = fc.getContext('2d');
  const fg = f.createRadialGradient(128, 128, 4, 128, 128, 128); fg.addColorStop(0, 'rgba(120,150,190,0.55)'); fg.addColorStop(0.5, 'rgba(60,80,110,0.25)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
  f.fillStyle = fg; f.fillRect(0, 0, 256, 256);
  const ft = new THREE.CanvasTexture(fc);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false }));
  scene.add(floor);
  // ящики на заднем плане для глубины
  const crate = new THREE.MeshLambertMaterial({ color: '#2a3442' });
  for (const [x, z, sx, sy] of [[-2.6, -3, 1.2, 1.2], [-1.6, -3.6, 1, 2.2], [2.8, -3.2, 1.4, 1.4], [3.4, -2.2, 0.9, 0.9], [2.3, -4.2, 1.2, 2.6]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sx), crate); m.position.set(x, sy / 2, z); m.rotation.y = x * 0.3; scene.add(m);
  }
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  return { scene, cam, model: null, id: null, rot: Math.PI - 0.4, drag: null, side: save.menuSide || 'T' };
})();
function setMenuAgent(id) {
  if (M.id === id && M.model) return;
  if (M.model) M.scene.remove(M.model.root);
  const ag = agentById[id], lo = loadout(), gun = ag.team === 'T' ? 'ak47' : 'm4a4';
  M.model = new AgentModel(ag, gun, lo[gun] || null); M.id = id; if (lo.gloves) M.model.setGloves(lo.gloves);
  M.scene.add(M.model.root);
}
for (const st of ['stage', 'stage2']) {
  const el2 = $(st);
  el2.addEventListener('pointerdown', e => { M.drag = e.clientX; M.vel = 0; el2.setPointerCapture(e.pointerId); });
  el2.addEventListener('pointermove', e => { if (M.drag != null) { const d = (e.clientX - M.drag) * 0.012; M.rot += d; M.vel = d; M.drag = e.clientX; } });
  const up = () => { M.drag = null; }; el2.addEventListener('pointerup', up); el2.addEventListener('pointercancel', up);
}
function renderMenu3d(dt) {
  if (!M.model) setMenuAgent(save.agent[M.side]);
  const W = innerWidth, H = innerHeight, asp = W / H, portrait = asp < 1;
  // область экрана, где должен стоять агент (в пикселях), и доля ширины по X
  const top = (document.querySelector('#menu .topbar')?.offsetHeight || 60) + 8;
  let bottom = H - 8, fx = 0.38;
  if (curTab === 'agents') { if (portrait) { fx = 0.5; bottom = H * 0.47; } else fx = 0.27; }
  else if (curTab === 'home') { if (portrait) { fx = 0.5; bottom = H - 150; } }
  else fx = 0.5;
  const R = Math.max(80, bottom - top), tan = Math.tan(15 * Math.PI / 180);
  const D = 1.95 * H / (2 * tan * R * 0.92), pxpm = H / (2 * D * tan);
  const ty = 0.95 - (H / 2 - (top + bottom) / 2) / pxpm;
  const halfW = D * tan * asp, shift = -(fx - 0.5) * 2 * halfW;
  M.cam.aspect = asp; M.cam.updateProjectionMatrix();
  M.cam.position.set(shift, ty + 0.15, D); M.cam.lookAt(shift, ty, 0);
  if (M.drag == null) { M.vel = (M.vel || 0) * 0.92; M.rot += M.vel; if (Math.abs(M.vel) < 0.001) M.rot += (Math.PI - 0.4 + Math.sin(performance.now() / 4000) * 0.25 - M.rot) * Math.min(1, dt * 0.8); }
  M.model.root.rotation.y = M.rot;
  M.model.update({ dt, speed: 0, crouch: false, pitch: -0.32 + Math.sin(performance.now() / 1300) * 0.02 });
  M.model.torso.position.y = 0.08 + Math.sin(performance.now() / 900) * 0.006;
  renderer.render(M.scene, M.cam);
}
function renderAgentLists() {
  for (const team of ['T', 'CT']) {
    const box = $('agents' + team); box.innerHTML = '';
    for (const ag of AGENTS.filter(a => a.team === team)) {
      const b = el('button', (save.agent[team] === ag.id ? 'on' : ''));
      b.innerHTML = `<i style="background:linear-gradient(135deg, ${ag.c.vest}, ${ag.c.shirt} 60%, ${ag.c.accent})"></i>${esc(ag.name)}`;
      b.onclick = () => { save.agent[team] = ag.id; M.side = save.menuSide = team; persist(); setMenuAgent(ag.id); renderAgentLists(); play('buy'); };
      box.appendChild(b);
    }
  }
}
// ---------- главная ----------
function renderHome() {
  if (!homeReady) return;
  const ag = agentById[save.agent[M.side]];
  $('homeAgent').textContent = ag.name; $('homeSide').textContent = M.side === 'T' ? 'Террористы' : 'Спецназ';
  document.querySelectorAll('#sideSw button').forEach(b => b.classList.toggle('on', b.dataset.side === M.side));
  const map = MAPS.find(m => m.id === save.last.map) || MAPS[0], diff = DIFFICULTIES.find(d => d.id === save.last.diff);
  $('homePlayInfo').textContent = `${map.name} · ${diff ? diff.name : ''}`;
  const cs = CASES[(save.stats.opened + 1) % CASES.length];
  const pr = $('promo'); pr.className = 'hcard promo';
  pr.innerHTML = `<img src="${caseIconURL(cs)}" alt=""><div><h4>Магазин</h4><b>${esc(cs.name)}</b><span>◈ ${cs.price}</span></div>`;
  pr.onclick = () => { showTab('cases'); openCaseScreen(cs); };
  const st = save.stats, lm = save.lastMatch;
  $('lastBox').innerHTML = `<h4>Ваша статистика</h4><div class="hstats"><div><b>${st.kills}</b>убийств</div><div><b>${(st.kills / Math.max(1, st.deaths)).toFixed(2)}</b>K/D</div><div><b>${st.wins}/${st.matches}</b>побед</div></div>` +
    (lm ? `<h4 style="margin-top:10px">Последний матч</h4><div style="font-size:14px">${esc(lm.map)} · <b style="color:${lm.won ? '#6fd36a' : '#ff6a5a'}">${lm.score}</b> · ${lm.k}/${lm.d}</div>` : '');
}
$('sideSw').onclick = e => { const b = e.target.closest('button'); if (!b) return; M.side = save.menuSide = b.dataset.side; persist(); setMenuAgent(save.agent[M.side]); renderHome(); play('tick'); };
$('homePlay').onclick = () => { initAudio(); showTab('play'); };
homeReady = true; renderHome();

// ---------- админка: 4 нажатия по логотипу ----------
let logoTaps = [], adminOk = false;
$('logo').addEventListener('click', () => {
  const now = performance.now(); logoTaps = logoTaps.filter(t => now - t < 3000); logoTaps.push(now);
  if (logoTaps.length >= 4) { logoTaps = []; if (adminOk) openAdmin(); else { $('adminPass').classList.remove('hidden'); $('passIn').value = ''; $('passErr').textContent = ''; setTimeout(() => $('passIn').focus(), 50); } }
});
const tryPass = () => {
  if ($('passIn').value === '6767') { adminOk = true; $('adminPass').classList.add('hidden'); openAdmin(); play('rare'); }
  else { $('passErr').textContent = 'Неверный пароль'; $('passIn').value = ''; play('lose'); }
};
$('passOk').onclick = tryPass;
$('passIn').addEventListener('keydown', e => { if (e.key === 'Enter') tryPass(); });
$('passCancel').onclick = () => $('adminPass').classList.add('hidden');
$('adminClose').onclick = () => { $('admin').classList.add('hidden'); coins(); renderInv(); };
function openAdmin() { $('admin').classList.remove('hidden'); renderAdmin(); }
function renderAdmin() {
  save.admin = save.admin || {};
  const A = save.admin, body = $('adminBody'); body.innerHTML = '';
  const group = (title) => { const g = el('div', 'agroup', `<h4>${title}</h4>`), r = el('div', 'abtns'); g.appendChild(r); body.appendChild(g); return r; };
  const btn = (row, label, fn, lit) => { const b = el('button', lit ? 'lit' : '', label); b.onclick = () => { fn(); persist(); coins(); renderAdmin(); play('buy'); }; row.appendChild(b); return b; };
  let r = group(`Монеты: ◈ ${save.coins.toLocaleString('ru')}`);
  btn(r, '+1 000', () => save.coins += 1000); btn(r, '+10 000', () => save.coins += 10000); btn(r, '+100 000', () => save.coins += 100000); btn(r, 'Обнулить', () => save.coins = 0);
  const inp = el('input'); inp.type = 'number'; inp.placeholder = 'Сумма'; r.appendChild(inp);
  btn(r, 'Установить', () => { const v = parseInt(inp.value, 10); if (v >= 0) save.coins = v; });
  r = group(`Инвентарь: ${save.inv.length} предм.`);
  btn(r, 'Выдать все скины', () => { for (const sk of SKINS) addItem(sk.id); });
  btn(r, 'Выдать все ножи и перчатки', () => { for (const sk of SKINS) if (sk.rarity === 'gold') addItem(sk.id); });
  btn(r, 'Очистить', () => { if (confirm('Удалить весь инвентарь?')) { save.inv = []; save.equip = {}; } });
  const sel = el('select'); for (const sk of SKINS) { const o = el('option', '', `${weaponName(sk.weapon)} | ${sk.name}`); o.value = sk.id; sel.appendChild(o); }
  r.appendChild(sel); btn(r, 'Выдать', () => addItem(sel.value));
  r = group('Читы в матче');
  const tog = (key, label) => btn(r, (A[key] ? '✔ ' : '') + label, () => { A[key] = !A[key]; }, A[key]);
  tog('god', 'Бессмертие'); tog('ammo', 'Бесконечные патроны'); tog('money', '$16 000 всегда'); tog('oneshot', 'Убийство с одного выстрела'); tog('radar', 'Враги на радаре'); tog('speed', 'Быстрый бег');
  r = group('Прочее');
  tog2(r, 'freeCases', 'Кейсы бесплатно');
  btn(r, 'Сбросить статистику', () => { save.stats = { kills: 0, deaths: 0, wins: 0, matches: 0, opened: 0 }; save.lastMatch = null; });
  btn(r, 'Выйти из админки', () => { adminOk = false; $('admin').classList.add('hidden'); });
  function tog2(row, key, label) { btn(row, (A[key] ? '✔ ' : '') + label, () => { A[key] = !A[key]; }, A[key]); }
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
const CT_ICON = '<svg viewBox="0 0 64 64"><path d="M32 4 56 12v18c0 15-10 25-24 30C18 55 8 45 8 30V12z" fill="#2f5d9a" stroke="#9cc4ff" stroke-width="3"/><path d="M20 30l8 8 16-16" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const T_ICON = '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="#7a5418" stroke="#ffd27a" stroke-width="3"/><path d="M32 12l5 13h14l-11 8 4 14-12-8-12 8 4-14-11-8h14z" fill="#ffd27a"/></svg>';
const hud = {
  centerT: 0,
  center(t, dur, color) { const c = $('center'); c.textContent = t; c.style.color = color || '#fff'; c.style.opacity = 1; this.centerT = dur; },
  hitmark(hs) { const h = $('hitm'); h.className = hs ? 'hs' : ''; h.style.opacity = 1; this.hitT = 0.25; },
  hurt() { $('hurtOv').style.opacity = 1; this.hurtT = 0.3; },
  flashed(d) { this.flashT = Math.max(this.flashT || 0, d); this.flashMax = Math.max(this.flashT, 0.5); if (d > 1) play('ring', 0, 0, Math.min(1, d / 3)); },
  feed(a, v, wid, hs, player) {
    const f = $('feed');
    const icon = (WEAPONS[wid] || NADES[wid] || KNIVES[wid]) ? `<img src="${weaponIconURL(wid, null, 96, 36)}" alt="">` : (wid === 'fall' ? '⬇' : '☠');
    const nm = x => x ? `<span class="${x.team === 'T' ? 't' : 'ct'}">${esc(x.name)}</span>` : '';
    const d = el('div', (a === player || v === player) ? 'me' : '', `${a && a !== v ? nm(a) : ''}${icon}${hs ? '<span class="hs">◉</span>' : ''}${nm(v)}`);
    f.prepend(d); while (f.children.length > 5) f.lastChild.remove();
    setTimeout(() => d.remove(), 6000);
  },
  roundStart(g) { closeBuy(); $('board').classList.add('hidden'); $('banner').className = 'hidden'; hud.bannerAt = 0; },
  // баннер конца раунда как в CS + голос диктора
  roundBanner(winner, why, mvp, g) {
    const b = $('banner'), ct = winner === 'CT';
    b.className = ct ? 'ct' : 't';
    b.innerHTML = `<div class="bIcon">${ct ? CT_ICON : T_ICON}</div><div class="bText"><b>${ct ? 'COUNTER-TERRORISTS WIN' : 'TERRORISTS WIN'}</b><span>${esc(why)}</span>${mvp ? `<em>★ MVP раунда: ${esc(mvp.name)}${mvp.roundKills ? ` — ${mvp.roundKills} ${mvp.roundKills === 1 ? 'убийство' : mvp.roundKills < 5 ? 'убийства' : 'убийств'}` : ''}</em>` : ''}</div>`;
    this.bannerAt = performance.now(); this.centerT = 0; $('center').style.opacity = 0;
    this.announce(ct ? 'Counter-Terrorists win' : 'Terrorists win');
  },
  announce(text) {
    try {
      if (!window.speechSynthesis || save.settings.volume <= 0) return;
      const u = new SpeechSynthesisUtterance(text);
      const v = speechSynthesis.getVoices().find(x => /^en(-|_)(US|GB)/i.test(x.lang) && /male|david|daniel|alex|fred|google uk english male/i.test(x.name)) || speechSynthesis.getVoices().find(x => /^en/i.test(x.lang));
      if (v) u.voice = v; u.lang = 'en-US'; u.rate = 0.92; u.pitch = 0.7; u.volume = Math.min(1, save.settings.volume + 0.2);
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { /* нет синтеза речи */ }
  },
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
  if (g.aimMode) { const A = g.aimStats, mins = Math.max(1 / 60, (g.time - (A.t0 || g.time)) / 60); set('timer', `🎯 ${A.kills} · HS ${A.kills ? Math.round(A.hs / A.kills * 100) : 0}% · точн. ${A.shots ? Math.round(A.hits / A.shots * 100) : 0}% · ${A.t0 ? Math.round(A.kills / mins) : 0}/мин`); }
  else if (g.practice) set('timer', 'ТРЕНИРОВКА');
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
  cr.style.display = scoped || (view !== p && g.spectTP) || (def && def.scope && !view.scope) ? 'none' : '';
  // эффекты
  hud.flashT = Math.max(0, (hud.flashT || 0) - dt);
  $('flashOv').style.opacity = hud.flashT > 0 ? Math.min(1, hud.flashT / 1.2).toFixed(3) : 0;
  $('smokeOv').style.opacity = (g.camInSmoke() * 0.92).toFixed(2);
  if (hud.hurtT > 0) { hud.hurtT -= dt; if (hud.hurtT <= 0) $('hurtOv').style.opacity = 0; }
  // анимация баннера (раскрытие, держится ~4 с, затем гаснет)
  if (hud.bannerAt) {
    const t = (performance.now() - hud.bannerAt) / 1000, b = $('banner');
    const k = t < 0.3 ? 1 - Math.pow(1 - t / 0.3, 3) : 1, o = t > 4 ? Math.max(0, 1 - (t - 4) / 0.4) : Math.min(1, t / 0.15);
    b.style.transform = `scaleY(${k.toFixed(3)})`; b.style.opacity = o.toFixed(3);
    if (t > 4.5) { hud.bannerAt = 0; b.className = 'hidden'; }
  }
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
  if (!p.alive && !g.practice) { sp.classList.remove('hidden'); set('spect', view !== p ? `Наблюдение: ${view.name} · ${touch ? '✸' : 'ЛКМ'} — следующий, ${touch ? '⤒' : 'пробел'} — вид ${g.spectTP ? 'от 1-го' : 'от 3-го'} лица` : 'Вы погибли'); }
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
    else if (g.admin.radar || g.time - (a.lastFired || -9) < 1.5 || (g.intel && g.intel[p.team] && g.intel[p.team].pos === a.pos)) dot(a, '#ff3a3a');
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
  save.lastMatch = { map: g.o.map.name, score: `${g.score[p.team]}:${g.score[p.team === 'T' ? 'CT' : 'T']}`, won, k: p.kills, d: p.deaths };
  save.coins += reward; save.stats.matches++; if (won) save.stats.wins++; save.stats.kills += p.kills; save.stats.deaths += p.deaths; persist();
  $('overTitle').textContent = draw ? 'Ничья' : won ? 'Победа!' : 'Поражение';
  const rows = g.actors.slice().sort((a, b) => b.kills - a.kills).map(a => `<tr style="color:${a.team === 'T' ? '#e8b04a' : '#6aa8ff'}${a === p ? ';font-weight:800' : ''}"><td>${esc(a.name)}</td><td>${a.kills}</td><td>${a.deaths}</td></tr>`).join('');
  $('overBody').innerHTML = `<p class="center" style="font-size:22px">T ${g.score.T} : ${g.score.CT} CT</p><table><tr><th>Игрок</th><th>Убийства</th><th>Смерти</th></tr>${rows}</table><div class="reward">+ ◈ ${reward} монет</div>`;
  $('over').classList.remove('hidden');
  play(won ? 'win' : 'lose');
}

// ---------- запуск матча ----------
// mp: { role:'host' } или { role:'client', start } — сетевой матч
function startGame(mp) {
  initAudio();
  let map = MAPS.find(m => m.id === save.last.map) || MAPS[0];
  let diff = DIFFICULTIES.find(d => d.id === save.last.diff) || DIFFICULTIES[3];
  let side = save.last.side === 'auto' ? (Math.random() < 0.5 ? 'T' : 'CT') : save.last.side;
  let size = +save.last.size, winTo = +save.last.winTo;
  if (mp && mp.role === 'host') { if (map.aim) map = MAPS[0]; side = lobby.players[0].team; net.roster = lobby.players.filter(x => x.nid !== 0); net.myName = myName(); }
  if (mp && mp.role === 'client') {
    const st = mp.start; map = MAPS.find(m => m.id === st.map) || MAPS[0]; diff = DIFFICULTIES.find(d => d.id === st.diff) || DIFFICULTIES[3];
    size = st.size; winTo = st.winTo; net.actors = st.actors; net.myNid = st.you; net.firstSnap = st.snap;
    side = (st.actors.find(a => a.nid === st.you) || {}).team || 'T';
  }
  $('loading').classList.remove('hidden');
  setTimeout(() => {
    try {
      game = new Game(renderer, { map, diff, side, size, winTo, settings: save.settings, quality: quality(), controls, loadout: loadout(), agents: save.agent, graffiti: save.graffiti || 'cfs', admin: mp ? {} : { ...(save.admin || {}) }, net: mp ? net : null }, hud);
    } catch (e) { $('loading').classList.add('hidden'); alert('Ошибка запуска: ' + e.message); console.error(e); return; }
    if (mp && mp.role === 'host') {
      const actors = game.actors.map(a => ({ id: a.id, name: a.name, team: a.team, ag: a.agent.id, bot: a.bot, nid: a.nid, skins: a.skins }));
      const snap = game._snap();
      for (const pl of net.roster) net.send(pl.nid, { t: 'start', map: map.id, diff: diff.id, size, winTo, actors, snap, you: pl.nid });
    }
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

// ---------- мультиплеер: лобби ----------
let net = null, lobby = null;
const myName = () => (($('mpName').value || save.name || 'Игрок').trim() || 'Игрок').slice(0, 16);
$('mpName').value = save.name || '';
$('mpName').oninput = () => { save.name = $('mpName').value.trim().slice(0, 16); persist(); };
const mpStatus = t => { $('mpStatus').textContent = t || ''; };
function renderLobby() {
  $('mpStart').classList.toggle('hidden', !!net);
  $('mpLobby').classList.toggle('hidden', !net || !lobby);
  if (!net || !lobby) return;
  $('mpCodeShow').textContent = net.code || lobby.code || '';
  const S = lobby.s || {}, mp = MAPS.find(m => m.id === S.map), df = DIFFICULTIES.find(d => d.id === S.diff);
  $('mpInfo').textContent = `Карта: ${mp ? mp.name : '?'} · боты: ${df ? df.name : '?'} · команды до ${S.size}×${S.size} (свободные места займут боты) · матч до ${S.winTo}`;
  for (const t of ['T', 'CT']) $('mp' + t).innerHTML = lobby.players.filter(x => x.team === t).map(x => `<div class="mpP${x.nid === (net.myNid ?? -1) ? ' me' : ''}">${x.nid === 0 ? '👑 ' : ''}${esc(x.name)}</div>`).join('') || '<div class="mpP empty">— боты —</div>';
  $('mpGo').classList.toggle('hidden', net.role !== 'host');
  $('mpWait').classList.toggle('hidden', net.role === 'host');
}
function pushLobby() {
  lobby.s = { map: save.last.map === 'aim' ? 'dust2' : save.last.map, diff: save.last.diff, size: +save.last.size, winTo: +save.last.winTo };
  net.broadcast({ t: 'lobby', players: lobby.players.map(x => ({ nid: x.nid, name: x.name, team: x.team })), s: lobby.s, code: net.code });
  renderLobby();
}
function leaveLobby() { if (net) net.close(); net = null; lobby = null; renderLobby(); }
$('mpHost').onclick = async () => {
  initAudio(); mpStatus('Создаём комнату…');
  try {
    net = new Net();
    await net.host();
    lobby = { players: [{ nid: 0, name: myName(), team: save.last.side === 'CT' ? 'CT' : 'T' }] };
    net.on('msg', (nid, m) => {
      if (game && game.net === net) return game.onNet(nid, m);
      if (m.t === 'hello') {
        const nT = lobby.players.filter(x => x.team === 'T').length, nCT = lobby.players.length - nT;
        lobby.players.push({ nid, name: String(m.name || 'Игрок').slice(0, 16), team: nT <= nCT ? 'T' : 'CT', agents: m.agents, skins: m.skins || {} });
        net.send(nid, { t: 'welcome', nid }); pushLobby(); play('buy');
      } else if (m.t === 'team') { const pl = lobby.players.find(x => x.nid === nid); if (pl && (m.team === 'T' || m.team === 'CT')) { pl.team = m.team; pushLobby(); } }
      else if (m.t === 'gr') { const pl = lobby.players.find(x => x.nid === nid); if (pl) pl.gr = m.g; }
    });
    net.on('leave', nid => { if (game && game.net === net) game.netLeave(nid); lobby.players = lobby.players.filter(x => x.nid !== nid); if (!game) pushLobby(); });
    mpStatus(''); pushLobby();
  } catch (e) { mpStatus('Ошибка: ' + (e.message || e.type || e)); leaveLobby(); }
};
$('mpJoinBtn').onclick = async () => {
  initAudio();
  const code = $('mpCode').value.trim().toUpperCase(); if (code.length < 4) { mpStatus('Введите код комнаты'); return; }
  mpStatus('Подключаемся…');
  try {
    net = new Net();
    net.on('msg', (nid, m) => {
      if (m.t === 'welcome') { net.myNid = m.nid; return; }
      if (m.t === 'lobby') { lobby = m; renderLobby(); return; }
      if (m.t === 'start') { net.myNid = m.you; startGame({ role: 'client', start: m }); return; }
      if (game && game.net === net) game.onNet(0, m);
    });
    net.on('closed', () => { if (!net) return; const inGame = !!game; leaveLobby(); if (inGame) { quitGame(); } mpStatus('Соединение с хостом потеряно'); });
    await net.join(code);
    net.toHost({ t: 'hello', name: myName(), agents: save.agent, skins: loadout() });
    net.toHost({ t: 'gr', g: save.graffiti || 'cfs' });
    mpStatus('');
  } catch (e) { mpStatus('Ошибка: ' + (e.message || e)); leaveLobby(); }
};
$('mpCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('mpJoinBtn').click(); });
$('mpLobby').addEventListener('click', e => {
  const b = e.target.closest('[data-team]'); if (!b || !net) return;
  if (net.role === 'host') { lobby.players[0].team = b.dataset.team; pushLobby(); }
  else net.toHost({ t: 'team', team: b.dataset.team });
});
$('mpGo').onclick = () => { if (net && net.role === 'host') startGame({ role: 'host' }); };
$('mpLeave').onclick = () => { leaveLobby(); mpStatus(''); };
$('mpCopy').onclick = () => { try { navigator.clipboard.writeText(net.code); mpStatus('Код скопирован'); } catch (e) { /* нет буфера */ } };
renderLobby();
function quitGame() {
  if (game) { game.dispose(); game = null; }
  if (net) { leaveLobby(); }
  controls.enabled = false; controls.unlock(); controls.reset();
  $('hud').classList.add('hidden'); $('menu').classList.remove('hidden'); $('rotate').classList.add('hidden');
  closeBuy();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  coins(); renderInv(); renderHome();
}
function checkRotate() { $('rotate').classList.toggle('hidden', !(game && touch && innerHeight > innerWidth)); }
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); if (game) game.resize(); checkRotate(); });

// ---------- цикл ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  if (window.__stop) return;
  if (!game) { if (!$('menu').classList.contains('hidden')) renderMenu3d(dt); return; }
  const paused = !$('pause').classList.contains('hidden') || !$('over').classList.contains('hidden');
  if (!paused || game.net) game.update(dt);
  if (!game) return;
  game.render();
  updateHud(game, dt);
}
requestAnimationFrame(frame);
window.__cfs = { get game() { return game; }, startGame, save, setNet: n => { net = n; }, hud };
