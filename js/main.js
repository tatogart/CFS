// Интерфейс: меню, кейсы, инвентарь, агенты, HUD
import * as THREE from '../vendor/three.module.min.js';
import { MAPS, CELL } from './maps.js?v=1793197213';
import { ARMORY, AR_LADDER, WEAPONS, NADES, GEAR, BUY_GROUPS, CASES, RARITY, RARITY_ORDER, AGENTS, DIFFICULTIES, SKINS, GRAFFITI, KNIVES, skinById, weaponName, agentById } from './data.js?v=1793197213';
import { load, persist, S, addItem, sellItem, equipItem, isEquipped, loadout, rollCase, wearOf, statTrak } from './store.js?v=1793197213';
import { weaponIconURL, caseIconURL, mapThumbURL, graffitiURL, RANKS, rankURL } from './art.js?v=1793197213';
import { AgentModel } from './models.js?v=1793197213';
import { Controls, isTouch, DEFAULT_BINDS, BIND_NAMES } from './controls.js?v=1793197213';
import { initAudio, play, setVolume, startAmbience, stopAmbience } from './sfx.js?v=1793197213';
import { KITS, playMusic, stopMusic, setKit, setMusicVolume, saveTrack, loadTrack, deleteTrack, musicMode, onMusicEnd, setHidden } from './music.js?v=1793197213';
import { styleOf } from './decor.js?v=1793197213';
import { Game } from './game.js?v=1793197213';

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

load();
const save = S();
const touch = isTouch();
if (touch) document.body.classList.add('touch');
setVolume(save.settings.volume);
setMusicVolume(save.settings.music ?? 0.5); setKit(save.musicKit || 'cfs');

// ---------- рендер ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
function quality() { const q = save.settings.quality; return q === 'auto' ? (touch ? 1 : 2) : +q; }
// динамическое разрешение: при просадке FPS в матче рендер мельчает, при запасе — возвращается
let resScale = 1, arAcc = 0, arN = 0;
function basePR() { const q = quality(); return Math.min(devicePixelRatio, q === 0 ? 1 : q === 1 ? 1.4 : 1.75); }
function adaptRes(dt) {
  arAcc += dt; arN++;
  if (arAcc < 1.2) return;
  const fps = arN / arAcc; arAcc = 0; arN = 0;
  const prev = resScale;
  if (fps < 50) resScale = Math.max(0.5, resScale - (fps < 35 ? 0.2 : 0.1));
  else if (fps > 58 && resScale < 1) resScale = Math.min(1, resScale + 0.05);
  if (prev !== resScale) { renderer.setPixelRatio(basePR() * resScale); renderer.setSize(innerWidth, innerHeight, false); }
}
function applyQuality() {
  const q = quality();
  renderer.setPixelRatio(basePR() * resScale);
  renderer.shadowMap.enabled = q >= 1; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(innerWidth, innerHeight, false);
}
applyQuality();
const controls = new Controls(canvas, $('touch'));
controls.binds = { ...DEFAULT_BINDS, ...(save.binds || {}) };
let game = null;

// ---------- меню ----------
let curTab = 'home', homeReady = false;
function showTab(tab) {
  curTab = tab;
  document.querySelectorAll('#menu [data-tab]').forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
  document.querySelectorAll('#menu .page').forEach(p => p.classList.toggle('on', p.id === 'tab-' + tab));
  if (tab === 'inv') renderInv();
  if (tab === 'agents') renderAgentLists();
  if (tab === 'armory') renderArmory();
  if (tab === 'settings') renderSettings();
  if (tab === 'home') renderHome();
  play('tick');
}
onMusicEnd(() => { if (!game && !ytActive()) playMusic('menu'); });
const ytActive = () => save.musicKit === 'custom' && !!save.ytMenu && navigator.onLine && $('ytBox').dataset.id !== 'closed';
$('menu').addEventListener('click', e => { initAudio(); if (!game && ytActive()) updYt(); else if (!game && !musicMode()) playMusic('menu'); const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });
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
const MODES = [
  ['casual', 'Обычный', 'До 8 побед (15 раундов), смена сторон после 7. Бронежилет, шлем и набор сапёра бесплатно, старт $1000, раунд 2:15. Команду выбираете в матче.'],
  ['premier', 'Premier', 'Рейтинговый режим CS2: числовой CS Rating, вето карт перед матчем (баны по очереди), MR12 с овертаймом. Рейтинг открывается после 10 побед.'],
  ['comp', 'Соревновательный', '5×5, MR12: до 13 побед, смена сторон после 12 раундов. При 12:12 — овертайм MR3 по $10 000. Команду назначает игра. Даёт звание.'],
  ['wing', 'Напарники', '2×2 на одной точке (B), до 9 побед, смена сторон после 8 раундов, при 8:8 — ничья. Раунд 1:30. Команду назначает игра. Своё звание.'],
  ['dm', 'Бой насмерть', 'Каждый сам за себя, 10 игроков, мгновенное возрождение, любое оружие бесплатно. 10 минут или 50 убийств.'],
  ['ar', 'Гонка вооружений', '5×5 с возрождением. Каждое убийство — следующее оружие, 21 уровень. Побеждает команда того, кто первым убьёт золотым ножом.'],
];
// у каждого режима свой набор карт
const DEFUSE = MAPS.filter(m => !m.modes && !m.aim).map(m => m.id);
const POOLS = {
  casual: [...DEFUSE, 'aim'],
  comp: DEFUSE,
  premier: ['ancient', 'anubis', 'dust2', 'inferno', 'mirage', 'nuke', 'train'],
  wing: MAPS.filter(m => m.modes && m.modes.includes('wing')).map(m => m.id),
  dm: [...MAPS.filter(m => m.modes && m.modes.includes('dm')).map(m => m.id), ...DEFUSE],
  ar: MAPS.filter(m => m.modes && m.modes.includes('ar')).map(m => m.id),
};
const poolOf = md => POOLS[md] || POOLS.casual;
function modeMap(md) {
  save.lastMaps = save.lastMaps || {};
  const pool = poolOf(md), id = save.lastMaps[md] || (pool.includes(save.last.map) ? save.last.map : pool[0]);
  return MAPS.find(m => m.id === (pool.includes(id) ? id : pool[0]));
}
// ---------- звания ----------
const BOT_ELO = { harmless: 300, easy: 700, medium: 1200, hard: 1700, esports: 2300, none: 0 };
const rankOf = r => (r && r.wins >= 2) ? Math.max(0, Math.min(17, Math.floor((r.elo - 250) / 125))) : -1;
// ---------- Premier: CS Rating ----------
const PREM_WINS = 10;
const BOT_RATING = { harmless: 2500, easy: 6500, medium: 11000, hard: 17000, esports: 24000, none: 0 };
function prem() { return save.premier || (save.premier = { rating: 6000, wins: 0, losses: 0, games: 0, best: 0, season: 2 }); }
const premTier = r => r >= 30000 ? ['#ffd700', 'Золото'] : r >= 25000 ? ['#eb4b4b', 'Красный'] : r >= 20000 ? ['#e04aff', 'Розовый'] : r >= 15000 ? ['#8a5aff', 'Фиолетовый'] : r >= 10000 ? ['#4b69ff', 'Синий'] : r >= 5000 ? ['#5ab4ff', 'Голубой'] : ['#b0c3d9', 'Серый'];
function premBadge(rating, big, hidden) {
  if (hidden) return `<span class="prBadge none${big ? ' big' : ''}"><b>– – –</b></span>`;
  const [c] = premTier(rating), str = String(Math.round(rating)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `<span class="prBadge${big ? ' big' : ''}" style="--pc:${c}"><i></i><b>${str}</b></span>`;
}
const premShown = () => prem().wins >= PREM_WINS;
function premWorld(r) { return Math.max(1, Math.round(1800000 * Math.exp(-r / 4200))); }
function premLeaders() {
  const P = prem(), names = ['s1mple', 'ZywOo', 'm0NESY', 'donk', 'NiKo', 'ropz', 'sh1ro', 'Ax1Le', 'jL', 'b1t', 'electroNic', 'Boombl4', 'Perfecto', 'Jame', 'iM'];
  const list = names.map((n, i) => ({ n, r: 33500 - i * 640 - (i * 137) % 300 }));
  return { list, me: { n: nick(), r: P.rating, place: premWorld(P.rating) } };
}
function rankData(m) { save.ranks = save.ranks || {}; return save.ranks[m] || (save.ranks[m] = { elo: 600, wins: 0, losses: 0, games: 0 }); }
function renderPremBox() {
  const P = prem(), L = premLeaders(), shown = premShown(), [col, tname] = premTier(P.rating);
  $('premBox').innerHTML = `<div class="prCard" style="--pc:${shown ? col : '#6a7686'}"><div><small>PREMIER · СЕЗОН ${P.season}</small>${premBadge(P.rating, true, !shown)}<span>${shown ? `${tname} уровень · лучший ${String(P.best).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} · ~#${premWorld(P.rating).toLocaleString('ru')} в мире` : `Калибровка: побед до рейтинга ${Math.max(0, PREM_WINS - P.wins)} из ${PREM_WINS}`}</span><span>Побед ${P.wins} · поражений ${P.losses} · матчей ${P.games}</span></div>
    <div class="prPool"><small>Пул карт (вето перед матчем)</small><div>${POOLS.premier.map(id => `<img src="${mapThumbURL(MAPS.find(x => x.id === id), 2)}" title="${id}" alt="">`).join('')}</div></div></div>
    <div class="prLead"><h3>Таблица лидеров · мир</h3>${L.list.slice(0, 8).map((x, i) => `<div class="prRow"><i>${i + 1}</i><span>${esc(x.n)}</span>${premBadge(x.r)}</div>`).join('')}<div class="prRow me"><i>${shown ? L.me.place.toLocaleString('ru') : '—'}</i><span>${esc(L.me.n)}</span>${premBadge(L.me.r, false, !shown)}</div></div>`;
}
function renderPlay() {
  pills($('modes'), MODES.map(m => [m[0], m[1]]), save.last.mode || 'casual', v => { save.last.mode = v; renderPlay(); });
  const md = save.last.mode || 'casual';
  $('modeDesc').textContent = MODES.find(m => m[0] === md)[2];
  $('rowSide').classList.add('hidden');   // команда выбирается уже в матче
  $('rowSize').classList.toggle('hidden', md !== 'casual');
  $("rowLen").classList.add('hidden');   // длина матча задана правилами режима
  const isPrem = md === 'premier';
  $('maps').classList.toggle('hidden', isPrem); $('mapsH').classList.toggle('hidden', isPrem); $('premBox').classList.toggle('hidden', !isPrem);
  if (isPrem) renderPremBox();
  const mb = $('maps'); mb.innerHTML = '';
  const curMap = modeMap(md); save.last.map = curMap.id;
  for (const id of poolOf(md)) {
    const m = MAPS.find(x => x.id === id);
    const b = el('button', 'map' + (curMap.id === m.id ? ' on' : ''));
    b.innerHTML = `<img src="${mapThumbURL(m)}" alt=""><div class="mn"><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></div>`;
    b.onclick = () => { save.last.map = m.id; save.lastMaps[md] = m.id; mb.querySelectorAll('.map').forEach(x => x.classList.remove('on')); b.classList.add('on'); persist(); play('tick'); renderHome(); };
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
function itemCard(skinId, extra = '', it = null) {
  const sk = skinById[skinId], r = RARITY[sk.rarity];
  const d = el('div', 'item' + (it && it.st ? ' st' : ''));
  d.style.setProperty('--rc', r.color);
  const meta = it ? `<div class="wear">${it.st ? `<b class="stt">StatTrak™ ${it.kills || 0}</b> · ` : ''}${wearOf(it.wear)[2]} ${it.wear.toFixed(3)}</div>` : '';
  d.innerHTML = `<img src="${weaponIconURL(sk.weapon, sk.id)}" alt=""><div class="wn">${it && it.st ? '<span class="stt">ST™</span> ' : ''}${esc(weaponName(sk.weapon))}</div><div class="sn">${esc(sk.name)}</div>${meta}${extra}`;
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
const casePrice = () => (save.admin && save.admin.freeCases ? 0 : curCase.stars ? curCase.stars : curCase.price);
const canPay = () => curCase.stars ? (pass().stars >= casePrice()) : save.coins >= casePrice();
function updOpenBtn() { if (!curCase) { coins(); return; } const b = $('openBtn'); b.textContent = curCase.stars ? `Открыть · ${casePrice()} ★ (есть ${pass().stars})` : `Открыть · ◈ ${casePrice()}`; b.disabled = !canPay() || rolling; coins(); }
function resetStrip() { const s = $('strip'); s.style.transition = 'none'; s.style.transform = 'translateX(0)'; s.innerHTML = ''; for (let i = 0; i < 12; i++) s.appendChild(itemCard(curCase.items[i % curCase.items.length])); }
$('caseBack').onclick = () => { if (rolling) return; $('caseScreen').classList.add('hidden'); $('menu').classList.remove('hidden'); coins(); if (curTab === 'armory') renderArmory(); };
$('openBtn').onclick = () => {
  if (rolling || !canPay()) return;
  initAudio();
  if (curCase.stars) pass().stars -= casePrice(); else save.coins -= casePrice();
  save.stats.opened++; persist(); rolling = true; updOpenBtn();
  const win = rollCase(curCase);
  const strip = $('strip'); strip.style.transition = 'none'; strip.style.transform = 'translateX(0)'; strip.innerHTML = '';
  const N = 56, WI = 47;
  for (let i = 0; i < N; i++) {
    const id = i === WI ? win : rollCase(curCase);
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
  $('dropName').innerHTML = `${item.st ? '<span class="stt">StatTrak™</span> ' : ''}${esc(weaponName(sk.weapon))} | ${esc(sk.name)}<small class="dWear">${wearOf(item.wear)[1]} · ${item.wear.toFixed(4)}</small>`;
  $('dropSell').textContent = `Продать · ◈ ${r.sell}`;
  $('dropKeep').onclick = () => { $('drop').classList.add('hidden'); };
  $('dropSell').onclick = () => { sellItem(item.uid); $('drop').classList.add('hidden'); updOpenBtn(); coins(); };
  play(RARITY_ORDER.indexOf(sk.rarity) >= 2 ? 'rare' : 'buy');
}

// ---------- инвентарь ----------
$('invSort').onchange = () => renderInv();
// ---------- music kit ----------
// YouTube-плеер в меню (официальный встраиваемый плеер, видимый; только с интернетом)
function ytId(u) {
  u = String(u || '').trim(); if (!u) return '';
  const m = u.match(/(?:youtu\.be\/|v=|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/) || u.match(/^([A-Za-z0-9_-]{11})$/);
  return m ? m[1] : '';
}
function updYt() {
  const box = $('ytBox'), want = !game && save.musicKit === 'custom' && save.ytMenu && navigator.onLine;
  if (!want) { if (box.dataset.id) { box.innerHTML = ''; box.dataset.id = ''; } box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  if (box.dataset.id === save.ytMenu) return;
  box.dataset.id = save.ytMenu;
  box.innerHTML = `<div class="ytHead">♫ ${esc(save.customKitName || 'Мой кит')}<button id="ytClose">✕</button></div><iframe src="https://www.youtube-nocookie.com/embed/${save.ytMenu}?autoplay=1&loop=1&playlist=${save.ytMenu}&playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="YouTube"></iframe>`;
  $('ytClose').onclick = () => { box.innerHTML = ''; box.dataset.id = 'closed'; box.classList.add('hidden'); };
  stopMusic(0.5);
}
async function renderKits() {
  const box = $('kitList'); if (!box) return; box.innerHTML = '';
  const cur = save.musicKit || 'cfs';
  for (const k of KITS) {
    const c = el('div', 'kit' + (cur === k.id ? ' on' : ''), `<div class="kArt" style="--kc:${k.col}"><span>♫</span></div><div class="kName">${esc(k.name)}</div><div class="kAuth">${esc(k.author)} · ${k.bpm} BPM</div><div class="kBtns"><button class="pv">▶ Слушать</button><button class="eq">${cur === k.id ? '✔ Надет' : 'Надеть'}</button></div>`);
    c.querySelector('.pv').onclick = () => { initAudio(); playMusic('mvp', k.id); };
    c.querySelector('.eq').onclick = () => { save.musicKit = k.id; setKit(k.id); persist(); renderKits(); updYt(); playMusic('menu'); };
    box.appendChild(c);
  }
  // свой кит: треки игрока
  const slots = [['menu', 'Меню (по кругу)'], ['start', 'Начало раунда'], ['mvp', 'MVP раунда']];
  const recs = await Promise.all(slots.map(([s]) => loadTrack(s)));
  const c = el('div', 'kit custom' + (cur === 'custom' ? ' on' : ''), `<div class="kArt" style="--kc:#3cf06a"><span>★</span></div>
    <input class="kTitle" maxlength="24" value="${esc(save.customKitName || 'Мой кит')}" title="Название кита">
    <div class="kAuth">Свои треки (mp3, m4a, ogg) — хранятся только на этом устройстве</div>
    <label class="kSlot"><span>YouTube в меню</span><input class="kYt" placeholder="ссылка на трек с YouTube" value="${esc(save.ytMenu ? 'https://youtu.be/' + save.ytMenu : '')}"></label>
    ${slots.map(([s, lb], i) => `<label class="kSlot"><span>${lb}</span><em>${recs[i] ? esc(recs[i].name) : 'нет файла'}</em><input type="file" accept="audio/*" data-slot="${s}">${recs[i] ? `<button data-del="${s}">✕</button>` : ''}</label>`).join('')}
    <div class="kBtns"><button class="pv">▶ Слушать</button><button class="eq">${cur === 'custom' ? '✔ Надет' : 'Надеть'}</button></div>`);
  c.querySelector('.kTitle').oninput = e => { save.customKitName = e.target.value.trim() || 'Мой кит'; persist(); };
  c.querySelector('.kYt').onchange = e => { save.ytMenu = ytId(e.target.value); persist(); if (e.target.value && !save.ytMenu) alert('Не получилось распознать ссылку YouTube'); renderKits(); updYt(); };
  c.querySelectorAll('input[type=file]').forEach(inp => inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { await saveTrack(inp.dataset.slot, f); } catch (e) { alert('Не удалось сохранить файл: ' + e.message); } renderKits(); });
  c.querySelectorAll('[data-del]').forEach(b => b.onclick = async e => { e.preventDefault(); await deleteTrack(b.dataset.del); renderKits(); });
  c.querySelector('.pv').onclick = () => { initAudio(); playMusic('mvp', 'custom'); };
  c.querySelector('.eq').onclick = () => { if (!recs[0] && !recs[1] && !recs[2] && !save.ytMenu) { alert('Сначала добавьте трек или ссылку YouTube'); return; } save.musicKit = 'custom'; setKit('custom'); persist(); renderKits(); $('ytBox').dataset.id = ''; if (save.ytMenu) updYt(); else playMusic('menu'); };
  box.appendChild(c);
}
function renderGraffiti() {
  const box = $('grafList'); box.innerHTML = '';
  for (const g0 of GRAFFITI) {
    const b = el('button', save.graffiti === g0.id ? 'on' : '', `<img src="${graffitiURL(g0)}" alt="">${esc(g0.name)}`);
    b.onclick = () => { save.graffiti = g0.id; persist(); renderGraffiti(); play('spray'); };
    box.appendChild(b);
  }
}
// ---------- Armory Pass: звёзды за опыт, коллекционный кейс и предметы за звёзды ----------
const ARMORY_CASE = { id: 'armory', name: 'Коллекционный кейс «Арсенал CFS»', stars: 1, col: ['#e0a820', '#2a1a05'], emblem: 'star', items: ARMORY.caseItems };
function pass() { return save.pass || (save.pass = { active: false, stars: 0, earned: 0, xpAcc: 0, bought: 0 }); }
// начислить звёзды за опыт матча; вернуть сколько звёзд получено
function armoryXP(xp) {
  const P = pass(); if (!P.active || P.earned >= ARMORY.stars) return 0;
  P.xpAcc += xp; let got = 0;
  while (P.xpAcc >= ARMORY.xpPerStar && P.earned < ARMORY.stars) { P.xpAcc -= ARMORY.xpPerStar; P.earned++; P.stars++; got++; }
  return got;
}
function renderArmory() {
  const P = pass(), box = $('armoryBox'), done = P.earned >= ARMORY.stars;
  const canBuy = !P.active || done;
  box.innerHTML = `<div class="armHead"><div class="armTitle"><small>ARMORY PASS · сезон</small><b>«Арсенал CFS»</b><span>Новые скины и 5 новых ножей: Кукри, Боуи, Скелет, Стилет, Урсус</span></div>
    <div class="armStars"><b>★ ${P.stars}</b><small>${P.active ? `заработано ${P.earned}/${ARMORY.stars}` : 'пасс не куплен'}</small>
    ${P.active && !done ? `<div class="eBar"><i style="width:${P.xpAcc / ARMORY.xpPerStar * 100}%"></i></div><small>следующая звезда через ${ARMORY.xpPerStar - P.xpAcc} XP</small>` : ''}</div>
    ${canBuy ? `<button class="playBig inline armBuy" id="armBuy"><span>КУПИТЬ ПАСС</span><small>◈ ${ARMORY.price} · сразу ${ARMORY.start} ★ и ещё ${ARMORY.stars - ARMORY.start} за опыт</small></button>` : ''}</div>
    <div class="armCase"><img src="${caseIconURL(ARMORY_CASE)}" alt=""><div><b>${ARMORY_CASE.name}</b><span>Любой предмет коллекции, шанс на новый нож</span><button class="big go" id="armOpen" ${P.stars < 1 ? 'disabled' : ''}>Открыть · 1 ★</button></div></div>
    <h3>Предметы коллекции за звёзды</h3><div class="grid items" id="armItems"></div>`;
  const ab = $('armBuy'); if (ab) ab.onclick = () => {
    if (save.coins < ARMORY.price) { alert('Не хватает монет'); return; }
    save.coins -= ARMORY.price; P.active = true; P.earned = ARMORY.start; P.stars += ARMORY.start; P.xpAcc = 0; P.bought++; persist(); coins(); play('rare'); renderArmory();
  };
  $('armOpen').onclick = () => { if (P.stars >= 1) openCaseScreen(ARMORY_CASE); };
  const grid = $('armItems');
  const sorted = ARMORY.caseItems.slice().sort((a, b) => RARITY_ORDER.indexOf(skinById[b].rarity) - RARITY_ORDER.indexOf(skinById[a].rarity));
  for (const id of sorted) {
    const cost = ARMORY.cost[skinById[id].rarity];
    const c = itemCard(id, `<div class="acts"><button class="s armGet" ${P.stars < cost ? 'disabled' : ''}>Получить · ${cost} ★</button></div>`);
    c.querySelector('.armGet').onclick = () => {
      if (P.stars < cost) return;
      if (!confirm(`Получить ${weaponName(skinById[id].weapon)} | ${skinById[id].name} за ${cost} ★?`)) return;
      P.stars -= cost; persist(); showDrop(id); renderArmory();
    };
    grid.appendChild(c);
  }
}

// ---------- лоадаут как в CS2: в закупке только выбранное оружие ----------
const LO_CATS = [['pistols', 'Пистолеты', t => t === 'pistol'], ['mid', 'Средний класс', t => t === 'smg' || t === 'shotgun' || t === 'mg'], ['rifles', 'Винтовки', t => t === 'rifle' || t === 'sniper']];
const loPool = (team, cat) => { const f = LO_CATS.find(c => c[0] === cat)[2]; return Object.keys(WEAPONS).filter(id => f(WEAPONS[id].type) && (!WEAPONS[id].team || WEAPONS[id].team === team)); };
function wLoadout(team) {
  save.wlo = save.wlo || {};
  const cur = save.wlo[team] || {}, out = {};
  for (const [cat] of LO_CATS) {
    const pool = loPool(team, cat), n = Math.min(5, pool.length);
    const DEF = { T: { pistols: ['glock', 'p250', 'tec9', 'deagle'], mid: ['mac10', 'mp7', 'ump45', 'p90', 'nova'], rifles: ['galil', 'ak47', 'sg553', 'ssg08', 'awp'] }, CT: { pistols: ['usp', 'p250', 'fiveseven', 'deagle'], mid: ['mp9', 'mp7', 'ump45', 'p90', 'xm1014'], rifles: ['famas', 'm4a4', 'aug', 'ssg08', 'awp'] } };
    let list = (cur[cat] || DEF[team][cat]).filter(id => pool.includes(id));
    // стартовый пистолет у команды фиксированный (Glock у T, USP-S у CT)
    if (cat === 'pistols') { const st = team === 'T' ? 'glock' : 'usp'; list = [st, ...list.filter(id => id !== st)]; }
    for (const id of pool) { if (list.length >= n) break; if (!list.includes(id)) list.push(id); }
    out[cat] = list.slice(0, n);
  }
  save.wlo[team] = out; return out;
}
const inLoadout = (team, id) => { if (!WEAPONS[id] || WEAPONS[id].type === 'knife') return true; const lo = wLoadout(team); return LO_CATS.some(([c]) => lo[c].includes(id)); };
let wloSide = 'T';
function renderWLoadout() {
  const box = $('wloBox'); if (!box) return;
  const lo = wLoadout(wloSide), lo2 = loadout();
  box.innerHTML = `<div class="pills wloSide"><button data-s="T" class="${wloSide === 'T' ? 'on' : ''}">Террористы</button><button data-s="CT" class="${wloSide === 'CT' ? 'on' : ''}">Спецназ</button></div>`;
  box.querySelectorAll('.wloSide button').forEach(b => b.onclick = () => { wloSide = b.dataset.s; renderWLoadout(); play('tick'); });
  for (const [cat, name] of LO_CATS) {
    const row = el('div', 'wloRow', `<h5>${name}</h5>`), slots = el('div', 'wloSlots');
    lo[cat].forEach((id, i) => {
      const b = el('button', 'wloSlot', `${cat === 'pistols' && i === 0 ? '<i>стартовый</i>' : ''}<img src="${weaponIconURL(id, lo2[id] || null, 192, 72)}" alt=""><span>${esc(WEAPONS[id].name)}</span>`);
      if (cat === 'pistols' && i === 0) { b.classList.add('locked'); b.onclick = () => play('tick'); slots.appendChild(b); return; }
      b.onclick = () => {
        const pool = loPool(wloSide, cat).filter(x => !(cat === 'pistols' && x === lo[cat][0]));
        const pk = el('div', 'wloPick'); pk.innerHTML = pool.map(x => `<button data-id="${x}" class="${x === id ? 'on' : lo[cat].includes(x) ? 'have' : ''}"><img src="${weaponIconURL(x, lo2[x] || null, 192, 72)}" alt=""><span>${esc(WEAPONS[x].name)}</span></button>`).join('');
        pk.onclick = e => { const t = e.target.closest('button'); if (!t) return; const j = lo[cat].indexOf(t.dataset.id); if (j >= 0) lo[cat][j] = lo[cat][i]; lo[cat][i] = t.dataset.id; save.wlo[wloSide] = lo; persist(); play('buy'); renderWLoadout(); };
        box.querySelectorAll('.wloPick').forEach(x => x.remove()); row.appendChild(pk);
      };
      slots.appendChild(b);
    });
    row.appendChild(slots); box.appendChild(row);
  }
}
function renderInv() {
  renderGraffiti(); renderKits(); renderWLoadout();
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
    const c = itemCard(it.skin, `${eq ? '<span class="eq">НАДЕТО</span>' : ''}<div class="acts"><button class="e">${eq ? 'Снять' : 'Надеть'}</button><button class="s">◈ ${RARITY[sk.rarity].sell}</button></div>`, it);
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
// ---------- сворачивание: музыка не должна играть в фоне ----------
function onHide(h) {
  setHidden(h);
  const yb = $('ytBox');
  if (h) { if (yb.querySelector('iframe')) { yb.innerHTML = ''; yb.dataset.id = ''; yb.dataset.wasOn = '1'; } }
  else if (yb.dataset.wasOn) { yb.dataset.wasOn = ''; if (!game) updYt(); }
  if (h && game && !LOADING && $('pause').classList.contains('hidden')) openPause();
}
document.addEventListener('visibilitychange', () => onHide(document.hidden));
addEventListener('pagehide', () => onHide(true));
addEventListener('pageshow', () => { if (!document.hidden) onHide(false); });
addEventListener('freeze', () => onHide(true));

// ---------- профиль ----------
const AV_COLORS = ['#e8a640', '#5aa0ff', '#4cd07a', '#e05555', '#b06cff', '#3fd0d0', '#ff7ac0', '#9aa6b6'];
const XP_PER_LVL = 1000;
const nick = () => (save.nick || 'Игрок');
function avatarHtml(size = 40) {
  const c = AV_COLORS[save.avatar || 0];
  return `<span class="avatar" style="--av:${c};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.5)}px">${esc(nick().trim()[0] || '?').toUpperCase()}</span>`;
}
function weekId(t = Date.now()) { return Math.floor((t / 86400000 + 3) / 7); } // неделя с понедельника
function weekLeft() { const next = (weekId() + 1) * 7 - 3, ms = next * 86400000 - Date.now(); const d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000); return d ? `${d} д ${h} ч` : `${h} ч ${Math.floor(ms % 3600000 / 60000)} мин`; }
function weekly() {
  const w = weekId();
  if (!save.weekly || save.weekly.week !== w) {
    // 4 предложения недели, забрать можно 2 (как в CS2)
    const pool = SKINS.filter(s => s.rarity !== 'gold'), pick = () => {
      const r = Math.random(), rar = r < 0.55 ? 'milspec' : r < 0.85 ? 'restricted' : r < 0.97 ? 'classified' : 'covert';
      const l = pool.filter(s => s.rarity === rar); return l[Math.floor(Math.random() * l.length)].id;
    };
    const offers = [];
    while (offers.length < 3) { const id = pick(); if (!offers.includes(id)) offers.push(id); }
    offers.splice(Math.floor(Math.random() * 4), 0, 'coins:' + (500 + Math.floor(Math.random() * 6) * 250));
    save.weekly = { week: w, offers, taken: [] }; persist();
  }
  return save.weekly;
}
// ---------- миссии недели ----------
const MISSIONS = [
  { id: 'kills', t: n => `Убейте ${n} врагов`, n: [20, 30, 40], st: 'kills' },
  { id: 'hs', t: n => `Убейте ${n} врагов выстрелом в голову`, n: [8, 12, 15], st: 'hs' },
  { id: 'wins', t: n => `Выиграйте ${n} матча в любом режиме`, n: [2, 3], st: 'wins' },
  { id: 'comp', t: n => `Сыграйте ${n} соревновательных матча`, n: [1, 2], st: 'm_comp' },
  { id: 'wing', t: () => 'Выиграйте матч в «Напарниках»', n: [1], st: 'w_wing' },
  { id: 'ar', t: () => 'Победите в «Гонке вооружений»', n: [1], st: 'w_ar' },
  { id: 'sniper', t: n => `Убейте ${n} врагов из снайперской винтовки`, n: [5, 8], st: 'k_sniper' },
  { id: 'pistol', t: n => `Убейте ${n} врагов из пистолетов`, n: [8, 12], st: 'k_pistol' },
  { id: 'knife', t: n => `Убейте ${n} врагов ножом`, n: [1, 2], st: 'k_knife' },
  { id: 'mvp', t: n => `Станьте MVP раунда ${n} раз`, n: [5, 8], st: 'mvps' },
  { id: 'plant', t: n => `Заложите бомбу ${n} раза`, n: [2, 3], st: 'plants' },
  { id: 'smg', t: n => `Убейте ${n} врагов из пистолетов-пулемётов`, n: [10, 15], st: 'k_smg' },
  { id: 'rifle', t: n => `Убейте ${n} врагов из винтовок`, n: [15, 25], st: 'k_rifle' },
];
function missions() {
  const w = weekId();
  if (!save.missions || save.missions.week !== w) {
    let seed = w * 9301 + 49297; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const pool = MISSIONS.slice(), list = [];
    while (list.length < 3) { const m = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; const n = m.n[Math.floor(rnd() * m.n.length)]; list.push({ id: m.id, n, prog: 0, done: false }); }
    save.missions = { week: w, list }; persist();
  }
  return save.missions;
}
const missionDef = id => MISSIONS.find(m => m.id === id);
const MISSION_XP = 400, MISSION_COINS = 350;
// засчитать матч: вернуть выполненные миссии
function missionProgress(stats) {
  const done = [];
  for (const m of missions().list) {
    if (m.done) continue;
    const d = missionDef(m.id); m.prog = Math.min(m.n, m.prog + (stats[d.st] || 0));
    if (m.prog >= m.n) { m.done = true; done.push({ t: d.t(m.n), xp: MISSION_XP, c: MISSION_COINS }); }
  }
  return done;
}
function missionsHtml() {
  return missions().list.map(m => { const d = missionDef(m.id); return `<div class="mis${m.done ? ' done' : ''}"><span>${m.done ? '✔ ' : ''}${esc(d.t(m.n))}</span><small>${m.prog}/${m.n} · +${MISSION_XP} XP · ◈ ${MISSION_COINS}</small><div class="eBar"><i style="width:${m.prog / m.n * 100}%"></i></div></div>`; }).join('');
}
function renderTopProf() {
  const b = $('topProf'); if (!b) return;
  const lv = Math.floor((save.xp || 0) / XP_PER_LVL) + 1, xpk = ((save.xp || 0) % XP_PER_LVL) / XP_PER_LVL, ri = rankOf(rankData('comp'));
  const C = 2 * Math.PI * 15;
  b.innerHTML = `${avatarHtml(34)}<span class="tpTxt"><b>${esc(nick())}</b><small>${premShown() ? premBadge(prem().rating) : `<img src="${rankURL(ri, 60)}" alt="">${ri < 0 ? 'Без звания' : esc(RANKS[ri])}`}</small></span><span class="tpLvl"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="3"/><circle cx="18" cy="18" r="15" fill="none" stroke="#5aa0ff" stroke-width="3" stroke-dasharray="${C * xpk} ${C}" transform="rotate(-90 18 18)"/></svg><i>${lv}</i></span>`;
  b.onclick = () => { play('tick'); openProfile(); };
}
function renderProfileChip() {
  renderTopProf();
  const lv = Math.floor((save.xp || 0) / XP_PER_LVL) + 1, wk = weekly(), ready = wk.taken.length < 2;
  $('profChip').innerHTML = `${avatarHtml(38)}<span class="pcTxt"><b>${esc(nick())}</b><small>Ур. ${lv}</small></span>${ready ? '<i class="pcDot" title="Еженедельный дроп"></i>' : ''}`;
}
function openProfile() {
  const xp = save.xp || 0, lv = Math.floor(xp / XP_PER_LVL) + 1, st = save.stats;
  const rk = m => { const r = rankData(m), i = rankOf(r); return `<div class="pRank"><img src="${rankURL(i, 180)}" alt=""><small>${m === 'comp' ? 'Соревновательный' : 'Напарники'}</small><b>${i < 0 ? 'Без звания' : RANKS[i]}</b><span>Рейтинг ${r.elo} · побед ${r.wins} · пор. ${r.losses}</span></div>`; };
  const wk = weekly();
  const body = $('profBody');
  body.innerHTML = `<div class="pTop">${avatarHtml(72)}<div class="pId"><input id="nickIn" maxlength="16" value="${esc(nick())}" placeholder="Ник" autocomplete="off"><div class="avPick">${AV_COLORS.map((c, i) => `<button data-av="${i}" class="${(save.avatar || 0) === i ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div></div></div>
    <div class="pLvl"><b>Уровень ${lv}</b><div class="eBar"><i style="width:${(xp % XP_PER_LVL) / XP_PER_LVL * 100}%"></i></div><small>${xp % XP_PER_LVL} / ${XP_PER_LVL} XP</small></div>
    <div class="pPrem"><small>PREMIER · CS RATING</small>${premBadge(prem().rating, true, !premShown())}<span>${premShown() ? '~#' + premWorld(prem().rating).toLocaleString('ru') + ' в мире' : 'побед до рейтинга: ' + Math.max(0, PREM_WINS - prem().wins)}</span></div>
    <div class="pRanks">${rk('comp')}${rk('wing')}</div>
    <div class="hstats"><div><b>${st.kills}</b>убийств</div><div><b>${(st.kills / Math.max(1, st.deaths)).toFixed(2)}</b>K/D</div><div><b>${st.wins}/${st.matches}</b>побед</div><div><b>${st.opened}</b>кейсов</div><div><b>${st.bans || 0}</b>читеров забанено</div></div>
    <h3 class="pDropH">История матчей <small>последние ${Math.min(30, (save.history || []).length)} · нажмите на матч</small></h3><div class="hList" id="pHist">${historyHtml()}</div>
    <h3 class="pDropH">Миссии недели <small>обновятся через ${weekLeft()}</small></h3><div class="misList">${missionsHtml()}</div>
    <h3 class="pDropH">Еженедельный дроп <small>${wk.taken.length < 2 ? `выберите ${2 - wk.taken.length} из 4` : 'получено · новый через ' + weekLeft()}</small></h3>
    <div class="grid items small pDrop" id="dropOffers"></div>`;
  bindHistory($('pHist'));
  const box = $('dropOffers');
  wk.offers.forEach((o, i) => {
    let c;
    if (o.startsWith('coins:')) { c = el('div', 'item', `<div class="pCoins">◈</div><div class="wn">Монеты</div><div class="sn">◈ ${o.slice(6)}</div>`); c.style.setProperty('--rc', '#e4ae39'); }
    else { c = itemCard(o); c.querySelector('.wn').insertAdjacentHTML('beforebegin', `<div class="rarT" style="color:${RARITY[skinById[o].rarity].color}">${RARITY[skinById[o].rarity].name}</div>`); }
    const taken = wk.taken.includes(i);
    if (taken) c.classList.add('taken'); else if (wk.taken.length >= 2) c.classList.add('locked');
    c.onclick = () => {
      if (taken || wk.taken.length >= 2) return;
      wk.taken.push(i);
      if (o.startsWith('coins:')) save.coins += +o.slice(6); else addItem(o);
      persist(); play('buy'); coins(); renderInv(); openProfile(); renderProfileChip();
    };
    box.appendChild(c);
  });
  const ni = $('nickIn');
  ni.oninput = () => { save.nick = ni.value.replace(/[<>]/g, '').trim().slice(0, 16); persist(); renderProfileChip(); body.querySelector('.pTop .avatar').outerHTML = avatarHtml(72); };
  body.querySelectorAll('[data-av]').forEach(b => b.onclick = () => { save.avatar = +b.dataset.av; persist(); openProfile(); renderProfileChip(); });
  $('profile').classList.remove('hidden');
}
$('profChip').onclick = () => { play('tick'); openProfile(); };
$('profClose').onclick = () => $('profile').classList.add('hidden');
$('profile').onclick = e => { if (e.target.id === 'profile') $('profile').classList.add('hidden'); };

// ---------- ошибки: показываем, а не молча ломаемся ----------
function showErr(e) {
  let b = document.getElementById('errBox');
  if (!b) { b = document.createElement('div'); b.id = 'errBox'; b.onclick = () => b.remove(); document.body.appendChild(b); }
  b.textContent = 'Ошибка: ' + (e && e.message ? e.message : e) + ' (нажмите, чтобы скрыть)';
}
addEventListener('error', e => showErr(e.error || e.message));
addEventListener('unhandledrejection', e => showErr(e.reason));

// ---------- главная ----------
function renderHome() {
  if (!homeReady) return;
  const ag = agentById[save.agent[M.side]];
  renderProfileChip();
  $('homeAgent').textContent = ag.name; $('homeSide').textContent = M.side === 'T' ? 'Террористы' : 'Спецназ';
  document.querySelectorAll('#sideSw button').forEach(b => b.classList.toggle('on', b.dataset.side === M.side));
  const map = modeMap(save.last.mode || 'casual'), diff = DIFFICULTIES.find(d => d.id === save.last.diff);
  $('homePlayInfo').textContent = `${(MODES.find(m => m[0] === (save.last.mode || 'casual')) || [])[1]} · ${map.name} · ${diff ? diff.name : ''}`;
  const cs = CASES[(save.stats.opened + 1) % CASES.length];
  const pr = $('promo'); pr.className = 'hcard promo';
  pr.innerHTML = `<img src="${caseIconURL(cs)}" alt=""><div><h4>Магазин</h4><b>${esc(cs.name)}</b><span>◈ ${cs.price}</span></div>`;
  pr.onclick = () => { showTab('cases'); openCaseScreen(cs); };
  const st = save.stats, lm = save.lastMatch, rc = rankData('comp'), rw = rankData('wing');
  const ms = missions().list;
  $('lastBox').innerHTML = `<h4>Миссии недели · ${ms.filter(m => m.done).length}/${ms.length}</h4><div class="misList small">${missionsHtml()}</div><h4 style="margin-top:10px">Звания</h4><div class="ranksH"><div><img src="${rankURL(rankOf(rc), 140)}" alt=""><small>Соревновательный</small><b>${rankOf(rc) < 0 ? 'Без звания' : RANKS[rankOf(rc)]}</b></div><div><img src="${rankURL(rankOf(rw), 140)}" alt=""><small>Напарники</small><b>${rankOf(rw) < 0 ? 'Без звания' : RANKS[rankOf(rw)]}</b></div></div><h4 style="margin-top:10px">Ваша статистика</h4><div class="hstats"><div><b>${st.kills}</b>убийств</div><div><b>${(st.kills / Math.max(1, st.deaths)).toFixed(2)}</b>K/D</div><div><b>${st.wins}/${st.matches}</b>побед</div></div>` +
    ((save.history || []).length ? `<h4 style="margin-top:10px">История матчей</h4><div class="hList mini">${historyHtml(3)}</div><button class="hMore" id="hMore">Вся история →</button>` : '') +
    (lm && !(save.history || []).length ? `<h4 style="margin-top:10px">Последний матч</h4><div style="font-size:14px">${esc(lm.map)} · <b style="color:${lm.won ? '#6fd36a' : '#ff6a5a'}">${lm.score}</b> · ${lm.k}/${lm.d}</div>` : '');
  const hm = $('hMore'); if (hm) hm.onclick = () => { play('tick'); openProfile(); setTimeout(() => { const h = $('pHist'); if (h) h.scrollIntoView({ block: 'start' }); }, 50); };
  bindHistory($('lastBox'));
}
$('sideSw').onclick = e => { const b = e.target.closest('button'); if (!b) return; M.side = save.menuSide = b.dataset.side; persist(); setMenuAgent(save.agent[M.side]); renderHome(); play('tick'); };
$('homePlay').onclick = () => { initAudio(); showTab('play'); };
homeReady = true; try { renderHome(); } catch (e) { console.error(e); showErr(e); }

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
  const tog = (key, label) => btn(r, (A[key] ? '✔ ' : '') + label, () => { A[key] = !A[key]; if (game) game.admin[key] = A[key]; }, A[key]);
  tog('god', 'Бессмертие'); tog('ammo', 'Бесконечные патроны'); tog('money', '$16 000 всегда'); tog('oneshot', 'Убийство с одного выстрела'); tog('radar', 'Враги на радаре'); tog('speed', 'Быстрый бег');
  tog('wall', 'ВХ: видно сквозь стены'); tog('norecoil', 'Без отдачи'); tog('nades', 'Бесконечные гранаты'); tog('fastBomb', 'Мгновенная закладка/разминирование'); tog('freeze', 'Заморозить ботов'); tog('peace', 'Боты не стреляют');
  r = group(`Читеры среди ботов: ${{ off: 'выключены', normal: 'обычно (4%)', always: 'всегда' }[A.cheaters || 'normal']}`);
  for (const [v, n] of [['off', 'Выкл'], ['normal', 'Обычно'], ['always', 'В каждом матче']]) btn(r, n, () => { A.cheaters = v; }, (A.cheaters || 'normal') === v);
  r = group(`Скорость игры: ×${A.timeScale || 1}`);
  for (const v of [0.25, 0.5, 1, 1.5, 2]) btn(r, '×' + v, () => { A.timeScale = v === 1 ? 0 : v; if (game) game.admin.timeScale = A.timeScale; }, (A.timeScale || 1) === v);
  if (game && !END) {
    r = group('Действия в текущем матче');
    const act = (label, k, v) => btn(r, label, () => { game.adminAction(k, v); if (k === 'winMatch') $('admin').classList.add('hidden'); });
    act('Убить всех врагов', 'killEnemies'); act('Убить всех', 'killAll'); act('Выиграть раунд', 'winRound'); act('Выиграть матч', 'winMatch');
    act('Вылечить + броня', 'heal'); act('$16 000', 'money'); act('Все гранаты', 'nades'); act('Возродиться', 'respawn');
    const ws = el('select'); for (const id of Object.keys(WEAPONS)) if (id !== 'knife') { const o = el('option', '', WEAPONS[id].name); o.value = id; ws.appendChild(o); }
    r.appendChild(ws); btn(r, 'Выдать оружие', () => game.adminAction('give', ws.value));
  }
  r = group(`Прогресс: уровень ${Math.floor((save.xp || 0) / XP_PER_LVL) + 1} · ${save.xp || 0} XP`);
  btn(r, '+1 000 XP', () => save.xp = (save.xp || 0) + 1000); btn(r, '+10 000 XP', () => save.xp = (save.xp || 0) + 10000); btn(r, 'Сбросить опыт', () => save.xp = 0);
  for (const m of ['comp', 'wing']) {
    const rd = rankData(m), rs = el('select'); rs.appendChild(Object.assign(el('option', '', 'Без звания'), { value: -1 })); RANKS.forEach((n, i) => { const o = el('option', '', n); o.value = i; rs.appendChild(o); }); rs.value = rankOf(rd);
    r.appendChild(el('span', 'alab', m === 'comp' ? 'Соревн.:' : 'Напарники:')); r.appendChild(rs);
    rs.onchange = () => { const i = +rs.value; if (i < 0) { rd.wins = 0; rd.elo = 600; } else { rd.wins = Math.max(2, rd.wins); rd.elo = 250 + i * 125 + 60; } persist(); renderAdmin(); };
  }
  r = group(`Premier: ${prem().rating} · побед ${prem().wins}`);
  const pin = el('input'); pin.type = 'number'; pin.placeholder = 'Рейтинг'; r.appendChild(pin);
  btn(r, 'Установить рейтинг', () => { const v = parseInt(pin.value, 10); if (v >= 0) { prem().rating = v; prem().best = Math.max(prem().best, v); } });
  btn(r, 'Открыть рейтинг (10 побед)', () => { prem().wins = Math.max(prem().wins, PREM_WINS); });
  btn(r, 'Сбросить Premier', () => { save.premier = null; });
  const P = pass();
  r = group(`Armory Pass: ${P.active ? 'активен' : 'не куплен'} · ★ ${P.stars} · заработано ${P.earned}/${ARMORY.stars}`);
  btn(r, 'Активировать бесплатно', () => { P.active = true; if (P.earned >= ARMORY.stars) P.earned = 0; }); btn(r, '+10 ★', () => P.stars += 10); btn(r, '+40 ★', () => P.stars += 40); btn(r, 'Сбросить пасс', () => save.pass = null);
  r = group('Миссии и дроп недели');
  btn(r, 'Выполнить все миссии', () => { for (const m of missions().list) { m.prog = m.n; m.done = true; } });
  btn(r, 'Новые миссии', () => { const pool = MISSIONS.slice(), list = []; while (list.length < 3) { const m = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; list.push({ id: m.id, n: m.n[Math.floor(Math.random() * m.n.length)], prog: 0, done: false }); } save.missions = { week: weekId(), list }; });
  btn(r, 'Новый дроп недели', () => { save.weekly = null; weekly(); });
  r = group('Выдача с параметрами');
  const sel2 = el('select'); for (const sk of SKINS) { const o = el('option', '', `${weaponName(sk.weapon)} | ${sk.name}`); o.value = sk.id; sel2.appendChild(o); }
  const wsel = el('select'); [['0.0001', 'Прямо с завода 0.0001'], ['0.1', 'Немного поношенное'], ['0.25', 'После полевых'], ['0.4', 'Поношенное'], ['0.99', 'Закалённое в боях 0.99']].forEach(([v, n]) => { const o = el('option', '', n); o.value = v; wsel.appendChild(o); });
  const stc = el('label', 'alab', '<input type="checkbox"> StatTrak™');
  r.appendChild(sel2); r.appendChild(wsel); r.appendChild(stc);
  btn(r, 'Выдать', () => { const it = addItem(sel2.value, stc.querySelector('input').checked); it.wear = +wsel.value; });
  r = group('Тест экранов');
  btn(r, 'Окно «Матч найден»', () => { $('admin').classList.add('hidden'); save.last.mode = 'comp'; if (save.last.diff === 'none') save.last.diff = 'medium'; MM = { t: 0, find: 0, mode: 'comp', ranked: true, total: 10, phase: 'search' }; showAccept(); const tk = () => { if (!MM || MM.phase !== 'accept') return; MM.t += 0.1; $('accBar').style.width = Math.max(0, (20 - (MM.t - MM.acceptT)) / 20 * 100) + '%'; if (MM.accepted && MM.bots < MM.total - 1 && MM.t >= MM.nextBot) { MM.bots++; MM.nextBot = MM.t + 0.3; renderAccSlots(); } if (MM.accepted && MM.bots >= MM.total - 1) { setTimeout(() => { $('accept').classList.add('hidden'); MM = null; }, 800); return; } if (MM.t - MM.acceptT > 20) { $('accept').classList.add('hidden'); MM = null; return; } setTimeout(tk, 100); }; tk(); });
  r = group('Прочее');
  tog2(r, 'freeCases', 'Кейсы бесплатно');
  tog2(r, 'fastLoad', 'Быстрая загрузка матча');
  btn(r, 'Сбросить статистику', () => { save.stats = { kills: 0, deaths: 0, wins: 0, matches: 0, opened: 0 }; save.lastMatch = null; });
  btn(r, 'Выйти из админки', () => { adminOk = false; $('admin').classList.add('hidden'); });
  function tog2(row, key, label) { btn(row, (A[key] ? '✔ ' : '') + label, () => { A[key] = !A[key]; }, A[key]); }
}

// ---------- настройки ----------
function renderSettings(box = $('settingsBox'), inGame = false) {
  const s = save.settings; box.innerHTML = '';
  const range = (key, label, min, max, step, fmt = v => v) => {
    const l = el('label', '', `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}"><span class="val">${fmt(s[key])}</span>`);
    const inp = l.querySelector('input'); inp.oninput = () => { s[key] = +inp.value; l.querySelector('.val').textContent = fmt(s[key]); if (key === 'volume') setVolume(s[key]); if (key === 'music') setMusicVolume(s[key]); persist(); };
    box.appendChild(l);
  };
  const check = (key, label) => { const l = el('label', '', `<span>${label}</span><input type="checkbox" ${s[key] ? 'checked' : ''}>`); l.querySelector('input').onchange = e => { s[key] = e.target.checked; persist(); }; box.appendChild(l); };
  range('sens', 'Чувствительность мыши', 0.2, 3, 0.05, v => (+v).toFixed(2));
  range('touchSens', 'Чувствительность экрана', 0.2, 3, 0.05, v => (+v).toFixed(2));
  range('fov', 'Поле зрения', 60, 100, 1);
  range('volume', 'Громкость', 0, 1, 0.05, v => Math.round(v * 100) + '%');
  const ql = el('label', '', `<span>Графика</span><select><option value="auto">Авто</option><option value="0">Низкая</option><option value="1">Средняя</option><option value="2">Высокая (тени)</option></select>`);
  const sel = ql.querySelector('select'); sel.value = s.quality; sel.onchange = () => { s.quality = sel.value; persist(); applyQuality(); }; box.appendChild(ql);
  range('music', 'Громкость музыки', 0, 1, 0.05, v => Math.round(v * 100) + '%');
  const hl = el('label', '', `<span>Оружие в руке</span><select><option value="right">Правой</option><option value="left">Левой</option></select>`);
  const hs = hl.querySelector('select'); hs.value = s.hand || 'right'; hs.onchange = () => { s.hand = hs.value; persist(); }; box.appendChild(hl);
  range('vmfov', 'Обзор оружия (viewmodel FOV)', 54, 72, 1);
  box.appendChild(el('h3', '', 'Прицел'));
  const prev = el('div', 'chPrev', '<div class="cx"><i></i><i></i><i></i><i></i><b></b></div>'); box.appendChild(prev);
  const upd = () => { const c = prev.querySelector('.cx'); c.style.setProperty('--c', s.crosshair); c.style.setProperty('--len', s.chLen + 'px'); c.style.setProperty('--th', s.chThick + 'px'); c.style.setProperty('--g', s.chGap + 'px'); c.style.setProperty('--o', s.chOutline ? '0 0 0 1px rgba(0,0,0,.8)' : 'none'); c.querySelector('b').style.display = s.chDot ? '' : 'none'; };
  const cl = el('label', '', `<span>Цвет прицела</span><input type="color" value="${s.crosshair}">`); cl.querySelector('input').oninput = e => { s.crosshair = e.target.value; persist(); upd(); }; box.appendChild(cl);
  for (const [k, lb, mn, mx] of [['chLen', 'Длина линий', 2, 20], ['chThick', 'Толщина', 1, 6], ['chGap', 'Зазор', 0, 16]]) {
    const l = el('label', '', `<span>${lb}</span><input type="range" min="${mn}" max="${mx}" step="1" value="${s[k]}"><span class="val">${s[k]}</span>`);
    l.querySelector('input').oninput = e => { s[k] = +e.target.value; l.querySelector('.val').textContent = s[k]; persist(); upd(); }; box.appendChild(l);
  }
  for (const [k, lb] of [['chDot', 'Точка в центре'], ['chOutline', 'Обводка'], ['chDynamic', 'Динамический (расходится при беге)']]) {
    const l = el('label', '', `<span>${lb}</span><input type="checkbox" ${s[k] ? 'checked' : ''}>`); l.querySelector('input').onchange = e => { s[k] = e.target.checked; persist(); upd(); }; box.appendChild(l);
  }
  upd();
  // ---- управление ----
  box.appendChild(el('h3', '', 'Управление'));
  if (!touch) {
    const kb = el('div', 'binds'); box.appendChild(kb);
    const keyName = c => !c ? '—' : c.replace(/^Key/, '').replace(/^Digit/, '').replace('Space', 'Пробел').replace('ControlLeft', 'L-Ctrl').replace('ControlRight', 'R-Ctrl').replace('ShiftLeft', 'L-Shift').replace('ShiftRight', 'R-Shift').replace('AltLeft', 'L-Alt').replace('Tab', 'Tab').replace('Arrow', '↑ ').replace('Backquote', '`');
    const draw = () => {
      kb.innerHTML = '';
      for (const a in BIND_NAMES) {
        const r = el('div', 'bind', `<span>${BIND_NAMES[a]}</span><button>${keyName(controls.binds[a])}</button>`);
        r.querySelector('button').onclick = ev => {
          const btn = ev.currentTarget; btn.textContent = 'Нажмите клавишу…'; btn.classList.add('wait');
          const h = e => { e.preventDefault(); removeEventListener('keydown', h, true); if (e.code !== 'Escape') { for (const k in controls.binds) if (controls.binds[k] === e.code && k !== a) controls.binds[k] = ''; controls.binds[a] = e.code; save.binds = { ...controls.binds }; persist(); } draw(); };
          addEventListener('keydown', h, true);
        };
        kb.appendChild(r);
      }
      const rs = el('button', 'big', 'Клавиши по умолчанию'); rs.onclick = () => { controls.binds = { ...DEFAULT_BINDS }; save.binds = null; persist(); draw(); }; kb.appendChild(rs);
    };
    draw();
  }
  if (!inGame) { const te = el('button', 'big go', '📱 Настроить кнопки на экране'); te.onclick = openTouchEditor; box.appendChild(te); }
  range('touchAlpha', 'Прозрачность кнопок', 0.2, 1, 0.05, v => Math.round(v * 100) + '%');
  box.appendChild(el('h3', '', 'Прочее'));
  check('invertY', 'Инверсия по вертикали');
  check('fps', 'Показывать FPS');
  if (inGame) return;
  const ib = el('div', 'hcard installBox'); ib.id = 'installBox'; box.appendChild(ib); renderInstall();
  const reset = el('button', 'big', 'Сбросить прогресс'); reset.onclick = () => { if (confirm('Удалить все монеты, предметы и статистику?')) { localStorage.removeItem('cfs_save_v1'); location.reload(); } }; box.appendChild(reset);
  const st = save.stats;
  $('statsBox').innerHTML = `<div>Убийств<b>${st.kills}</b></div><div>Смертей<b>${st.deaths}</b></div><div>K/D<b>${(st.kills / Math.max(1, st.deaths)).toFixed(2)}</b></div><div>Матчей<b>${st.matches}</b></div><div>Побед<b>${st.wins}</b></div><div>Кейсов открыто<b>${st.opened}</b></div>`;
}

// ---------- история матчей ----------
function recordMatch(g, res, extra = {}) {
  const p = g.player, rounds = Math.max(1, g.round - (g.state === 'end' || g.over ? 0 : 1));
  const row = a => ({ n: a.name, t: a.team, k: a.kills, as: a.assists || 0, d: a.deaths, m: a.mvps || 0, hs: a.kills ? Math.round((a.hs || 0) / a.kills * 100) : 0, adr: Math.round((a.dmgTotal || 0) / rounds), me: a === p ? 1 : 0, ch: a.cheat ? 1 : 0 });
  const h = save.history || (save.history = []);
  h.unshift({ at: Date.now(), mode: g.mode, map: g.o.map.name, mapId: g.o.map.id, diff: g.diff.name, res, side: p.team, score: g.dm && !g.ar ? null : [g.score[p.team], g.score[p.team === 'T' ? 'CT' : 'T']], ...extra, players: g.actors.filter(a => !a.target).map(row) });
  if (h.length > 30) h.length = 30;
  persist();
}
function historyHtml(limit = 30) {
  const RES_TXT = { win: ['ПОБЕДА', 'win'], lose: ['ПОРАЖЕНИЕ', 'lose'], draw: ['НИЧЬЯ', 'draw'], cancel: ['ОТМЕНЁН · CFAC', 'cancel'] };
  const h = (save.history || []).slice(0, limit);
  if (!h.length) return '<div class="empty">Сыграйте матч — он появится здесь.</div>';
  return h.map((m, i) => {
    const me = m.players.find(x => x.me) || {}, md = (MODES.find(x => x[0] === m.mode) || [])[1] || m.mode;
    const [rt, rc] = m.res === 'place' ? [`МЕСТО ${m.place}`, m.place === 1 ? 'win' : m.place <= 3 ? 'draw' : 'lose'] : RES_TXT[m.res] || ['—', 'draw'];
    const d = new Date(m.at), when = `${d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`;
    return `<div class="hRow ${rc}" data-i="${i}"><div class="hRes">${rt}</div><div class="hMap"><b>${esc(m.map)}</b><small>${esc(md)} · ${esc(m.diff || '')} · ${when}</small></div>
      <div class="hScore">${m.score ? `${m.score[0]} : ${m.score[1]}` : ''}</div><div class="hKd"><b>${me.k ?? 0}/${me.as ?? 0}/${me.d ?? 0}</b><small>ADR ${me.adr ?? 0} · ГОЛ ${me.hs ?? 0}%</small></div>
      ${m.rankDelta != null ? `<div class="hElo ${m.rankDelta >= 0 ? 'up' : 'down'}">${m.rankDelta >= 0 ? '+' : ''}${m.rankDelta}</div>` : '<div class="hElo"></div>'}</div>
      <div class="hDet hidden" id="hd${i}"></div>`;
  }).join('');
}
function bindHistory(root) {
  root.querySelectorAll('.hRow').forEach(r => r.onclick = () => {
    const i = +r.dataset.i, m = save.history[i], det = root.querySelector('#hd' + i);
    if (!det.classList.contains('hidden')) { det.classList.add('hidden'); return; }
    const team = t => m.players.filter(x => x.t === t).sort((a, b) => b.k - a.k).map(x => `<tr class="${x.me ? 'me' : ''}"><td class="${x.t === 'T' ? 't' : 'ct'}">${x.ch ? '<span class="banned">CFAC</span> ' : ''}${esc(x.n)}</td><td>${x.k}</td><td>${x.as}</td><td>${x.d}</td><td>${x.m ? '★' + x.m : ''}</td><td>${x.hs}%</td><td>${x.adr}</td></tr>`).join('');
    const head = '<tr><th>Игрок</th><th>У</th><th>П</th><th>С</th><th>★</th><th>ГОЛ</th><th>ADR</th></tr>';
    det.innerHTML = `<table>${head}${m.mode === 'dm' ? team('T') + team('CT') : `<tr><th colspan="7" class="ct">Спецназ</th></tr>${team('CT')}<tr><th colspan="7" class="t">Террористы</th></tr>${team('T')}`}</table>${m.cheater ? `<div class="hBan">Матч отменён: игрок <b>${esc(m.cheater)}</b> заблокирован CFAC</div>` : ''}`;
    det.classList.remove('hidden'); play('tick');
  });
}

// ---------- чат игрока ----------
function closeChat() { $('chatIn').classList.add('hidden'); $('chatTxt').blur(); if (game) { controls.enabled = true; controls.suppressPause = false; if (!touch) controls.lock(); } }
function sendChat(text) {
  text = (text || '').trim().slice(0, 120); const all = $('chatIn').dataset.all === '1'; closeChat();
  if (!text || !game) return;
  const g = game, p = g.player; g.say(p, text, all);
  // боты отвечают
  const low = text.toLowerCase(), pick = a => a[Math.floor(Math.random() * a.length)];
  const pool = g.actors.filter(a => a.bot && !a.cheat && (all || a.team === p.team));
  const cheater = g.actors.find(a => a.cheat);
  let reply = null, who = null;
  if (/чит|cheat|вх|wh|аим|aim|бан|репорт/.test(low)) { who = pick(pool); reply = pick(['+', 'да, точно читер', 'репорт его', 'уже кинул репорт', 'CFAC разберётся']); if (cheater && Math.random() < 0.6) setTimeout(() => g.say(cheater, pick(['нет у меня читов', 'просто скилл', 'сам ты читер', 'докажи'])), 1800); }
  else if (/^(gg|гг|gl|hf|glhf)/.test(low)) { who = pick(pool); reply = pick(['gg', 'gl hf', 'gg wp']); }
  else if (/(^| )(ez|изи)/.test(low)) { who = pick(pool.filter(a => a.team !== p.team)) || pick(pool); reply = pick(['сам изи', 'ну-ну', 'посмотрим', 'рано радуешься']); }
  else if (/привет|ку|hi|hello|здаров/.test(low)) { who = pick(pool); reply = pick(['ку', 'привет', 'здарова']); }
  else if (/помог|help|сзади|где/.test(low)) { who = pick(pool.filter(a => a.team === p.team)); reply = pick(['иду', 'щас', 'держись', 'где ты?']); }
  else if (Math.random() < 0.35) { who = pick(pool); reply = pick(['?', 'ок', 'понял', '+', 'лол']); }
  if (who && reply) setTimeout(() => { if (game === g && !g.over) g.say(who, reply, all || who.team !== p.team); }, 900 + Math.random() * 1500);
}
$('chatTxt').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); sendChat(e.target.value); } if (e.key === 'Escape') { e.preventDefault(); closeChat(); } });
$('chatSend').onclick = () => sendChat($('chatTxt').value);
$('chatQuick').onclick = e => { const b = e.target.closest('button'); if (b) sendChat(b.textContent); };

// ---------- раскладка сенсорных кнопок ----------
const tbKey = b => [...b.classList].find(c => c !== 'tb' && c !== 'mini' && c !== 'on' && c !== 'lit');
function applyTouchLayout(root = $('touch')) {
  const L = save.settings.touchLayout || {}, a = save.settings.touchAlpha == null ? 1 : save.settings.touchAlpha;
  root.querySelectorAll('.tb').forEach(b => {
    const k = tbKey(b), v = L[k];
    b.style.opacity = a;
    if (v) { b.style.left = v.x * 100 + '%'; b.style.top = v.y * 100 + '%'; b.style.right = 'auto'; b.style.bottom = 'auto'; b.style.transform = `translate(-50%, -50%) scale(${v.s || 1})`; }
    else { b.style.left = b.style.top = b.style.right = b.style.bottom = b.style.transform = ''; }
  });
}
function openTouchEditor() {
  const hudEl = $('hud'), tch = $('touch'), wasH = hudEl.classList.contains('hidden'), wasT = tch.classList.contains('hidden');
  hudEl.classList.remove('hidden'); tch.classList.remove('hidden'); $('menu').classList.add('hidden');
  document.body.classList.add('tedit');
  applyTouchLayout();
  const L = save.settings.touchLayout = { ...(save.settings.touchLayout || {}) };
  // зафиксировать текущие позиции всех кнопок
  tch.querySelectorAll('.tb').forEach(b => { const k = tbKey(b); if (!L[k]) { const r = b.getBoundingClientRect(); L[k] = { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight, s: 1 }; } });
  applyTouchLayout();
  let sel = null, drag = null;
  const bar = el('div', 'teBar', `<b>Перетащите кнопки</b><label>Размер <input type="range" min="0.6" max="1.8" step="0.05" value="1" id="teSize"></label><button id="teReset">Сброс</button><button class="go" id="teDone">Готово</button>`);
  document.body.appendChild(bar);
  const size = bar.querySelector('#teSize');
  const pick = b => { tch.querySelectorAll('.tb').forEach(x => x.classList.remove('teSel')); sel = b; b.classList.add('teSel'); size.value = L[tbKey(b)].s || 1; };
  const down = e => { const b = e.target.closest('.tb'); if (!b) return; e.preventDefault(); e.stopPropagation(); pick(b); drag = { b, id: e.pointerId }; };
  const move = e => { if (!drag || e.pointerId !== drag.id) return; const k = tbKey(drag.b); L[k].x = Math.max(0.02, Math.min(0.98, e.clientX / innerWidth)); L[k].y = Math.max(0.03, Math.min(0.97, e.clientY / innerHeight)); applyTouchLayout(); };
  const up = () => { drag = null; };
  tch.addEventListener('pointerdown', down, true); addEventListener('pointermove', move); addEventListener('pointerup', up);
  size.oninput = () => { if (!sel) return; L[tbKey(sel)].s = +size.value; applyTouchLayout(); };
  bar.querySelector('#teReset').onclick = () => { save.settings.touchLayout = null; persist(); close(); openTouchEditor(); };
  const close = () => {
    tch.removeEventListener('pointerdown', down, true); removeEventListener('pointermove', move); removeEventListener('pointerup', up);
    bar.remove(); document.body.classList.remove('tedit'); tch.querySelectorAll('.tb').forEach(x => x.classList.remove('teSel'));
    if (wasH) hudEl.classList.add('hidden'); if (wasT) tch.classList.add('hidden'); $('menu').classList.remove('hidden');
    applyTouchLayout();
  };
  bar.querySelector('#teDone').onclick = () => { persist(); close(); };
}
applyTouchLayout();

// ---------- HUD ----------
const CT_ICON = '<svg viewBox="0 0 64 64"><path d="M32 4 56 12v18c0 15-10 25-24 30C18 55 8 45 8 30V12z" fill="#2f5d9a" stroke="#9cc4ff" stroke-width="3"/><path d="M20 30l8 8 16-16" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const T_ICON = '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="#7a5418" stroke="#ffd27a" stroke-width="3"/><path d="M32 12l5 13h14l-11 8 4 14-12-8-12 8 4-14-11-8h14z" fill="#ffd27a"/></svg>';
const hud = {
  centerT: 0,
  chat(a, text, all) {
    const box = $('chat'), d = el('div', a ? '' : 'sys', a ? `${all ? '<i>(ВСЕ)</i> ' : ''}<b class="${a.team === 'T' ? 't' : 'ct'}">${a.alive ? '' : '*УБИТ* '}${esc(a.name)}</b>: ${esc(text)}` : esc(text));
    box.appendChild(d); while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => d.classList.add('fade'), 7000); setTimeout(() => d.remove(), 8000);
  },
  vacBan(who, g) {
    const comp = 150, xp = 200;
    recordMatch(g, 'cancel', { cheater: who.name });
    save.coins += comp; save.xp = (save.xp || 0) + xp; save.stats.bans = (save.stats.bans || 0) + 1; persist();
    hud.chat(null, `[CFAC] Игрок ${who.name} навсегда заблокирован. Матч отменён.`);
    controls.unlock(); controls.enabled = false;
    const box = $('vac');
    box.innerHTML = `<div class="vacBox"><div class="vacLogo"><svg viewBox="0 0 64 64"><path d="M32 3 57 12v19c0 16-11 26-25 31C18 57 7 47 7 31V12z" fill="#2a0d0d" stroke="#ff4a3a" stroke-width="3"/><text x="32" y="40" font-size="17" font-weight="900" text-anchor="middle" fill="#ff4a3a" font-family="Arial">CFAC</text></svg></div>
      <div class="vacT">МАТЧ ОТМЕНЁН</div>
      <div class="vacP">Система <b>CFS Anti-Cheat (CFAC)</b> обнаружила стороннее ПО у игрока</div>
      <div class="vacN">${esc(who.name)}</div>
      <div class="vacP">Аккаунт заблокирован навсегда. Результаты матча не засчитываются в звание.</div>
      <div class="vacR">Компенсация: ◈ ${comp} · +${xp} XP</div>
      <button class="playBig inline" id="vacOk"><span>В МЕНЮ</span></button></div>`;
    box.classList.remove('hidden'); play('lose');
    $('vacOk').onclick = () => { box.classList.add('hidden'); quitGame(); };
  },
  openChat(all) {
    if (!game) return;
    const box = $('chatIn'), inp = $('chatTxt');
    box.classList.remove('hidden'); box.dataset.all = all ? '1' : ''; $('chatMode').textContent = all ? 'ВСЕМ:' : 'КОМАНДЕ:';
    controls.enabled = false; controls.reset(); controls.suppressPause = true; controls.unlock();
    inp.value = ''; setTimeout(() => inp.focus(), 30);
  },
  damageReport(log, killer, def) {
    const rows = Object.values(log); const box = $('dmgRep');
    const g2 = rows.filter(r => r.mine), t2 = rows.filter(r => !r.mine);
    const line = r => `<div><span class="${r.who.team === 'T' ? 't' : 'ct'}">${esc(r.who.name)}</span><b>${r.dmg}</b><small>${r.hits} попад.</small></div>`;
    box.innerHTML = `<h5>${killer && killer !== game.player ? `Убит игроком <span class="${killer.team === 'T' ? 't' : 'ct'}">${esc(killer.name)}</span>${def && def.name ? ' · ' + esc(def.name) : ''}${killer.alive ? ` · у него ${Math.max(0, Math.round(killer.hp))} HP` : ''}` : 'Вы погибли'}</h5>
      <div class="drCols"><div><h6>Нанесено</h6>${g2.map(line).join('') || '<em>—</em>'}</div><div><h6>Получено</h6>${t2.map(line).join('') || '<em>—</em>'}</div></div>`;
    box.classList.remove('hidden'); clearTimeout(this._drT); this._drT = setTimeout(() => box.classList.add('hidden'), 6000);
  },
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
  roundStart(g) { if (!g.practice) playMusic('start'); closeBuy(); $('board').classList.add('hidden'); $('banner').className = 'hidden'; hud.bannerAt = 0; },
  // баннер конца раунда как в CS + голос диктора
  roundBanner(winner, why, mvp, g) {
    const b = $('banner'), ct = winner === 'CT';
    b.className = ct ? 'ct' : 't';
    b.innerHTML = `<div class="bIcon">${ct ? CT_ICON : T_ICON}</div><div class="bText"><b>${ct ? 'COUNTER-TERRORISTS WIN' : 'TERRORISTS WIN'}</b><span>${esc(why)}</span>${mvp ? `<em>★ MVP раунда: ${esc(mvp.name)}${mvp.roundKills ? ` — ${mvp.roundKills} ${mvp.roundKills === 1 ? 'убийство' : mvp.roundKills < 5 ? 'убийства' : 'убийств'}` : ''}</em>` : ''}</div>`;
    this.bannerAt = performance.now();
    if (mvp && mvp === g.player) playMusic('mvp'); this.centerT = 0; $('center').style.opacity = 0;
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
  onHand(h) { save.settings.hand = h; persist(); },
  onKill() {
    const g = game; if (!g || !g.player.cur) return;
    const cur = g.player.cur, slot = cur.id === 'knife' ? 'knife' : cur.id;
    const it = cur.skin && statTrak(slot); if (it) { hud._stDirty = true; clearTimeout(hud._stT); hud._stT = setTimeout(persist, 1500); }
  },
  matchOver(g) { endMatch(g); },
  menuOpen() { return !$('teamSel').classList.contains('hidden') || !$('buy').classList.contains('hidden') || !$('pause').classList.contains('hidden') || !$('chatIn').classList.contains('hidden') || !$('vac').classList.contains('hidden'); },
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
function inspectHud(g) {
  const box = $('inspInfo'), p = g.player, on = g.inspectT > 0 && p.alive && p.cur && !p.cur.nade && !p.cur.c4;
  const key = on ? p.cur.id + '|' + p.cur.skin : '';
  if (key !== hud.inspKey) {
    hud.inspKey = key;
    if (on) {
      const slot = p.cur.id === 'knife' ? 'knife' : p.cur.id, it = save.inv.find(x => x.uid === save.equip[slot]);
      const sk = p.cur.skin && skinById[p.cur.skin], wn = p.cur.id === 'knife' && p.cur.model ? weaponName(p.cur.model) : weaponName(p.cur.id);
      box.style.setProperty('--rc', sk ? RARITY[sk.rarity].color : '#6a7686');
      box.innerHTML = `<b>${it && it.st && sk ? '<span class="stt">StatTrak™</span> ' : ''}${esc(wn)}${sk ? ' | ' + esc(sk.name) : ''}</b><small>${sk ? RARITY[sk.rarity].name : 'Стандартное'}${it && sk ? ' · ' + wearOf(it.wear)[1] + ' ' + it.wear.toFixed(4) : ''}${it && it.st && sk ? ` · <span class="stt">убийств: ${it.kills || 0}</span>` : ''}</small>`;
    }
  }
  box.style.opacity = on ? 1 : 0;
}
function updateHud(g, dt) {
  inspectHud(g);
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
  const ffa = g.dm && !g.ar;
  set('scT', ffa ? p.kills : g.score.T); set('scCT', ffa ? '' : g.score.CT);
  const B = g.bomb;
  let tt = g.state === 'freeze' ? g.stateT : g.state === 'end' ? g.stateT : g.roundTime;
  if (B && B.planted && !B.done) tt = B.timer;
  if (g.dm) {
    const t = Math.max(0, g.dmTime), order = g.actors.slice().sort((a, b) => b.kills - a.kills), place = order.indexOf(p) + 1;
    set('timer', `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`);
    const k = place + '|' + order[0].kills + '|' + p.kills;
    if (g.ar) {
      const lv = a => a.arLvl || 0, lead = g.actors.reduce((m, a) => lv(a) > lv(m) ? a : m, g.actors[0]), nx = AR_LADDER[Math.min(lv(p) + 1, AR_LADDER.length - 1)];
      const k2 = lv(p) + '|' + lv(lead) + lead.name;
      if (hud.aliveKey !== k2) { hud.aliveKey = k2; $('alive').innerHTML = `<span class="arLv">Ур. ${lv(p) + 1}/${AR_LADDER.length}</span> далее <img class="arNext" src="${weaponIconURL(nx, null, 96, 36)}" alt=""> · лидер: <span class="${lead.team === 'T' ? 't' : 'ct'}">${esc(lead.name)}</span> ${lv(lead) + 1}`; }
    } else if (hud.aliveKey !== k) { hud.aliveKey = k; $('alive').innerHTML = `место ${place}/${order.length} · лидер: ${esc(order[0].name)} ${order[0].kills}/${g.dmLimit}`; }
  } else if (g.aimMode) { const A = g.aimStats, mins = Math.max(1 / 60, (g.time - (A.t0 || g.time)) / 60); set('timer', `🎯 ${A.kills} · HS ${A.kills ? Math.round(A.hs / A.kills * 100) : 0}% · точн. ${A.shots ? Math.round(A.hits / A.shots * 100) : 0}% · ${A.t0 ? Math.round(A.kills / mins) : 0}/мин`); }
  else if (g.practice) set('timer', 'ТРЕНИРОВКА');
  else set('timer', `${Math.floor(Math.max(0, tt) / 60)}:${String(Math.floor(Math.max(0, tt) % 60)).padStart(2, '0')}`);
  $('timer').classList.toggle('bomb', !!(B && B.planted && !B.done));
  if (!g.practice && !g.dm) {
    const aT = g.actors.filter(a => a.team === 'T'), aC = g.actors.filter(a => a.team === 'CT');
    const dots = (l, c) => l.map(a => `<span class="${c}">${a.alive ? '●' : '○'}</span>`).join('');
    const ak = aT.map(a => a.alive ? 1 : 0).join('') + aC.map(a => a.alive ? 1 : 0).join('');
    if (hud.aliveKey !== ak) { hud.aliveKey = ak; $('alive').innerHTML = dots(aT, 't') + ' ' + dots(aC, 'ct'); }
  }
  // прицел
  const cr = $('cross');
  const S = g.settings;
  if (def && def.type !== 'knife' && S.chDynamic !== false) {
    const sp = g.hspeed(p), mv = Math.max(0, Math.min(1, (sp - 1.3) / (def.speed - 1.3)));
    const gap = (S.chGap ?? 4) + (def.spread + def.move * mv + (!p.onGround ? 0.06 : 0) + Math.min(p.recoilIdx, 8) * def.recoil * 0.2) * 300;
    cr.style.setProperty('--g', Math.min(40, gap).toFixed(1) + 'px');
  } else cr.style.setProperty('--g', (S.chGap ?? 4) + 'px');
  cr.style.setProperty('--c', S.crosshair);
  cr.style.setProperty('--len', (S.chLen ?? 8) + 'px'); cr.style.setProperty('--th', (S.chThick ?? 2) + 'px');
  cr.style.setProperty('--o', S.chOutline === false ? 'none' : '0 0 0 1px rgba(0,0,0,.7)');
  cr.querySelector('b').style.display = S.chDot === false ? 'none' : '';
  const sdef = p.cur && WEAPONS[p.cur.id], scoped = p.alive && p.scope > 0 && sdef && sdef.type === 'sniper';
  $('scope').classList.toggle('hidden', !scoped);
  cr.style.display = scoped || (view !== p && g.spectTP) || (def && def.type === 'sniper' && !view.scope) ? 'none' : '';
  // эффекты
  hud.flashT = Math.max(0, (hud.flashT || 0) - dt);
  $('flashOv').style.opacity = hud.flashT > 0 ? Math.min(1, hud.flashT / 1.2).toFixed(3) : 0;
  $('smokeOv').style.opacity = (g.camInSmoke() * 0.92).toFixed(2);
  if (hud.hurtT > 0) { hud.hurtT -= dt; if (hud.hurtT <= 0) $('hurtOv').style.opacity = 0; }
  // музыка последних 10 секунд бомбы
  if (B && B.planted && !B.done && B.timer < 10.4 && hud.bombMusic !== g.round) { hud.bombMusic = g.round; playMusic('bomb'); }
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
  if (!hint && p.alive && g.ground && g.ground.length) { const it = g.lookWeapon(p); if (it) hint = `E — подобрать ${WEAPONS[it.inst.id] ? WEAPONS[it.inst.id].name : ''}`; }
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
  if (g.ar) { const lv = a => a.arLvl || 0; $('board').innerHTML = `<h4>${esc(g.o.map.name)} · гонка вооружений · T ${g.score.T} : ${g.score.CT} CT</h4><table><tr><th>Игрок</th><th>Ур.</th><th>У</th><th>С</th></tr>${g.actors.slice().sort((a, b) => lv(b) - lv(a) || b.kills - a.kills).map(a => `<tr class="${a.alive ? '' : 'dead'} ${a === g.player ? 'me' : ''}" style="color:${a.team === 'T' ? '#e8b04a' : '#6aa8ff'}"><td>${esc(a.name)}</td><td>${lv(a) + 1} <img class="arNext" src="${weaponIconURL(AR_LADDER[Math.min(lv(a), AR_LADDER.length - 1)], null, 96, 36)}" alt=""></td><td>${a.kills}</td><td>${a.deaths}</td></tr>`).join('')}</table>`; return; }
  if (g.dm) { $('board').innerHTML = `<h4>${esc(g.o.map.name)} · бой насмерть</h4><table><tr><th>Игрок</th><th>У</th><th>С</th></tr>${g.actors.slice().sort((a, b) => b.kills - a.kills).map(a => `<tr class="${a.alive ? '' : 'dead'} ${a === g.player ? 'me' : ''}"><td>${esc(a.name)}</td><td>${a.kills}</td><td>${a.deaths}</td></tr>`).join('')}</table>`; return; }
  const rounds = Math.max(1, g.round - (g.state === 'end' ? 0 : 1)), p = g.player;
  const rows = team => g.actors.filter(a => a.team === team).sort((a, b) => b.kills - a.kills || (b.dmgTotal || 0) - (a.dmgTotal || 0)).map(a => `<tr class="${team === 'T' ? 't' : 'ct'} ${a.alive ? '' : 'dead'} ${a === p ? 'me' : ''}"><td>${a.bot ? '<span class="bt">BOT</span> ' : ''}${esc(a.name)}</td><td class="mny">${a.team === p.team ? '$' + a.money : ''}</td><td>${a.kills}</td><td>${a.assists || 0}</td><td>${a.deaths}</td><td>${a.mvps ? '★' + (a.mvps > 1 ? a.mvps : '') : ''}</td><td>${a.kills ? Math.round((a.hs || 0) / a.kills * 100) : 0}%</td><td>${Math.round((a.dmgTotal || 0) / rounds)}</td></tr>`).join('');
  const head = (name, sc, cls) => `<tr class="bh ${cls}"><th>${name} <b>${sc}</b></th><th></th><th>У</th><th>П</th><th>С</th><th>★</th><th>ГОЛ</th><th>ADR</th></tr>`;
  $('board').innerHTML = `<h4>${esc(g.o.map.name)} · ${esc((MODES.find(m => m[0] === g.mode) || [])[1] || '')} · раунд ${g.round}</h4><table>${head('Спецназ', g.score.CT, 'ct')}${rows('CT')}${head('Террористы', g.score.T, 't')}${rows('T')}</table>`;
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
    if (!g.dm && a.team === p.team) dot(a, a.team === 'T' ? '#e8b04a' : '#6aa8ff');
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
      if (!g.dm && !inLoadout(p.team, id)) continue;
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
// ---------- выбор команды в начале матча (как в CS) ----------
let TS = null;
function showTeamSelect() {
  const g = game; if (!g) return;
  const box = $('teamSel'), ag = t => agentById[save.agent[t]] || AGENTS.find(a => a.team === t);
  const cnt = t => g.actors.filter(a => a.team === t).length;
  box.innerHTML = `<div class="tsTitle">ВЫБЕРИТЕ КОМАНДУ</div><div class="tsSub">${esc(g.o.map.name)} · ${esc((MODES.find(m => m[0] === g.mode) || [])[1] || '')}</div>
    <div class="tsCards">
      <button class="tsCard t" data-t="T">${T_ICON}<b>ТЕРРОРИСТЫ</b><small>${esc(ag('T').name)}</small><span>игроков: ${cnt('T')}</span></button>
      <button class="tsCard auto" data-t="auto"><svg viewBox="0 0 24 24"><path d="M4 7h11l-3-3 1.4-1.4L19.8 9l-6.4 6.4L12 14l3-3H4zm16 10H9l3 3-1.4 1.4L4.2 15l6.4-6.4L12 10l-3 3h11z"/></svg><b>АВТОВЫБОР</b><small>игра решит за вас</small><span id="tsTimer">15</span></button>
      <button class="tsCard ct" data-t="CT">${CT_ICON}<b>СПЕЦНАЗ</b><small>${esc(ag('CT').name)}</small><span>игроков: ${cnt('CT')}</span></button>
    </div>`;
  box.classList.remove('hidden'); controls.unlock();
  TS = { t: 15 };
  const pick = v => {
    if (!TS) return; TS = null; clearInterval(iv);
    const team = v === 'auto' ? (Math.random() < 0.5 ? 'T' : 'CT') : v;
    box.classList.add('hidden'); play('buy');
    if (game) { game.chooseTeam(team); game.centerMsg(team === 'T' ? 'Вы за террористов' : 'Вы за спецназ', 2, team === 'T' ? '#e8b04a' : '#6aa8ff'); }
    controls.edges.clear(); if (!touch) controls.lock();
  };
  box.querySelectorAll('[data-t]').forEach(b => b.onclick = () => pick(b.dataset.t));
  const iv = setInterval(() => { if (!TS) { clearInterval(iv); return; } TS.t--; const el2 = $('tsTimer'); if (el2) el2.textContent = TS.t; if (TS.t <= 0) pick('auto'); }, 1000);
}

// ---------- меню паузы в стиле CS2 ----------
let pTab = 'match';
function openPause() { $('pAdmin').classList.toggle('hidden', !adminOk); $('pause').classList.remove('hidden'); controls.unlock(); renderPause(); }
function closePause() {
  $('pause').classList.add('hidden');
  if (game) { game.baseFov = save.settings.fov; controls.touchSens = save.settings.touchSens; game.vmCam.fov = save.settings.vmfov || 62; game.vmCam.updateProjectionMatrix(); game.vm.scale.x = save.settings.hand === 'left' ? -1 : 1; }
  controls.edges.clear();
  if (!touch) controls.lock();
}
$('resume').onclick = closePause;
$('pTabs').onclick = e => { const b = e.target.closest('[data-pt]'); if (!b) return; if (b.dataset.pt === 'admin') { openAdmin(); return; } pTab = b.dataset.pt; play('tick'); renderPause(); };
function renderPause() {
  const g = game; if (!g) return;
  document.querySelectorAll('#pTabs [data-pt]').forEach(b => b.classList.toggle('on', b.dataset.pt === pTab));
  const md = (MODES.find(m => m[0] === g.mode) || [])[1] || '';
  $('pInfo').innerHTML = `<b>${esc(g.o.map.name)}</b><small>${esc(md)} · ${esc(g.diff.name)}</small>`;
  const body = $('pBody'); body.innerHTML = '';
  if (pTab === 'match') {
    const p = g.player, sc = g.dm && !g.ar ? '' : `<div class="pmScore"><b class="${p.team === 'T' ? 't' : 'ct'}">${g.score[p.team]}</b><span>:</span><b class="${p.team === 'T' ? 'ct' : 't'}">${g.score[p.team === 'T' ? 'CT' : 'T']}</b></div>`;
    const head = el('div', 'pmHead', `<img src="${mapThumbURL(g.o.map, 3)}" alt=""><div><small>${esc(md)}</small><b>${esc(g.o.map.name)}</b><span>${g.dm ? 'Бой идёт' : g.practice ? 'Тренировка' : 'Раунд ' + g.round + (g.winTo ? ' · до ' + g.winTo + ' побед' + (g.otN ? ' · овертайм ' + g.otN : '') : '')} · вы за ${p.team === 'T' ? 'террористов' : 'спецназ'}</span></div>${sc}`);
    body.appendChild(head);
    const bd = el('div', 'pmBoard'); body.appendChild(bd);
    renderBoard(g); bd.innerHTML = $('board').innerHTML;
    const tips = el('div', 'pmTips', `<div><b>B</b> закупка</div><div><b>G</b> выбросить</div><div><b>F</b> осмотр</div><div><b>H</b> сменить руку</div><div><b>Y/U</b> чат</div><div><b>Tab</b> счёт</div>`);
    if (!touch) body.appendChild(tips);
  } else if (pTab === 'settings') {
    const box = el('div', 'set pSet'); body.appendChild(box); renderSettings(box, true);
  } else if (pTab === 'vote') {
    const box = el('div', 'pVote'); body.appendChild(box);
    const can = !g.dm && !g.practice;
    const mates = g.actors.filter(a => a.bot && a.team === g.player.team);
    box.innerHTML = `<h3>Голосование команды</h3>
      <div class="vRow"><div><b>Сдаться</b><small>Матч засчитывается как поражение. Нужно согласие всей команды.</small></div><button class="big" data-v="surrender" ${can ? '' : 'disabled'}>Начать</button></div>
      <div class="vRow"><div><b>Тактический тайм-аут</b><small>30 секунд на обсуждение перед следующим раундом.</small></div><button class="big" data-v="timeout" ${can && !g.timeoutUsed ? '' : 'disabled'}>${g.timeoutUsed ? 'Уже взят' : 'Начать'}</button></div>
      <div class="vRow"><div><b>Выгнать игрока</b><small>Тиммейт будет удалён из матча.</small></div><select id="vKick">${mates.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select><button class="big" data-v="kick" ${mates.length ? '' : 'disabled'}>Начать</button></div>
      <div class="vRes" id="vRes"></div>`;
    box.querySelectorAll('[data-v]').forEach(b => b.onclick = () => startVote(b.dataset.v, +($('vKick') || {}).value));
  }
}
function startVote(kind, arg) {
  const g = game; if (!g) return;
  const voters = g.actors.filter(a => a.bot && a.team === g.player.team && !(kind === 'kick' && a.id === arg));
  const res = $('vRes'); let yes = 1, no = 0, i = 0;
  const want = kind === 'surrender' ? (g.score[g.player.team] < g.score[g.player.team === 'T' ? 'CT' : 'T'] ? 0.75 : 0.25) : kind === 'timeout' ? 0.9 : (voters.length ? 0.7 : 0);
  const kickT = kind === 'kick' && g.actors.find(a => a.id === arg); const wantK = kickT && kickT.cheat ? 0.95 : want;
  const label = { surrender: 'Сдаться', timeout: 'Тактический тайм-аут', kick: `Выгнать ${kickT ? kickT.name : ''}` }[kind];
  const draw = () => { res.innerHTML = `<b>${esc(label)}</b> · за: <span class="yes">${yes}</span> · против: <span class="no">${no}</span> · ждём: ${voters.length - i}`; };
  draw(); play('tick');
  const step = () => {
    if (i < voters.length) { if (Math.random() < wantK) yes++; else no++; i++; draw(); setTimeout(step, 450); return; }
    const pass = no === 0 || yes / (yes + no) > (kind === 'surrender' ? 0.99 : 0.5);
    res.innerHTML += pass ? ' — <span class="yes">ПРИНЯТО</span>' : ' — <span class="no">ОТКЛОНЕНО</span>';
    for (const v of voters) if (Math.random() < 0.4) g.say(v, pass ? 'ок' : kind === 'surrender' ? 'не сдаёмся!' : 'нет', false);
    if (!pass) return;
    if (kind === 'surrender') { setTimeout(() => { closePause(); g.surrender(); }, 700); }
    if (kind === 'timeout') { g.timeoutUsed = true; g.timeoutNext = 30; g.say(g.player, 'Тактический тайм-аут', false); }
    if (kind === 'kick' && kickT) { g.kick(kickT); renderPause(); }
  };
  setTimeout(step, 500);
}
$('quit').onclick = () => { if (!confirm('Отключиться от матча? Матч будет засчитан как поражение.')) return; $('pause').classList.add('hidden'); quitGame(); };
$('pAdmin').onclick = () => { if (adminOk) openAdmin(); };
// ---------- конец матча: сцена как в CS2 ----------
const XP_LVL = XP_PER_LVL;
function endMatch(g) {
  controls.unlock();
  const p = g.player, dm = g.dm && !g.ar;
  if (g.ar && g.arWinner) { g.score[g.arWinner.team] = Math.max(g.score[g.arWinner.team], g.score[g.arWinner.team === 'T' ? 'CT' : 'T'] + 1); }
  const my = g.score[p.team], th = g.score[p.team === 'T' ? 'CT' : 'T'];
  const order = g.actors.slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  const place = order.indexOf(p) + 1;
  const won = dm ? place === 1 : my > th, draw = !dm && my === th;
  let reward = dm ? Math.round((p.kills * 8 + Math.max(0, 6 - place) * 40) * g.diff.reward)
    : Math.round((p.kills * 15 + my * 30 + (won ? 250 : 50)) * g.diff.reward);
  let xpGain = Math.round((p.kills * 20 + (p.mvps || 0) * 40 + (dm ? Math.max(0, 6 - place) * 60 : my * 25 + (won ? 200 : draw ? 100 : 60))) * Math.max(0.3, g.diff.reward));
  let rank = null;
  if (g.mode === 'comp' || g.mode === 'wing') {
    // рейтинг Эло против уровня ботов: на слабых ботах высоко не подняться
    const r = rankData(g.mode), before = rankOf(r), opp = BOT_ELO[g.diff.id] || 1000;
    const exp = 1 / (1 + Math.pow(10, (opp - r.elo) / 400)), res = draw ? 0.5 : won ? 1 : 0;
    const margin = 1 + Math.min(0.5, Math.abs(my - th) / 26);
    const kd = Math.max(-6, Math.min(6, (p.kills - p.deaths) * 0.6));
    const delta = Math.round(40 * margin * (res - exp) + kd);
    r.elo = Math.max(0, r.elo + delta); r.games++; if (won) r.wins++; else if (!draw) r.losses++;
    const after = rankOf(r);
    rank = { before, after, delta, elo: r.elo, mode: g.mode === 'comp' ? 'Соревновательный' : 'Напарники', name: after < 0 ? `Без звания · побед до звания: ${Math.max(0, 2 - r.wins)}` : RANKS[after] };
  }
  let premier = null;
  if (g.mode === 'premier') {
    const P = prem(), before = P.rating, opp = BOT_RATING[g.diff.id] || 8000, shownBefore = premShown();
    const exp = 1 / (1 + Math.pow(10, (opp - before) / 6000)), res = draw ? 0.5 : won ? 1 : 0;
    const margin = 1 + Math.min(0.4, Math.abs(my - th) / 30), kd = Math.max(-60, Math.min(60, (p.kills - p.deaths) * 8));
    const delta = Math.round(520 * margin * (res - exp) + kd);
    P.rating = Math.max(0, before + delta); P.games++; if (won) P.wins++; else if (!draw) P.losses++; P.best = Math.max(P.best, premShown() ? P.rating : 0);
    premier = { before, after: P.rating, delta, shownBefore, shown: premShown(), left: Math.max(0, PREM_WINS - P.wins) };
  }
  const kt = p.killTypes || {};
  const mdone = missionProgress({ kills: p.kills, hs: p.hs || 0, mvps: p.mvps || 0, plants: p.plants || 0, wins: won ? 1 : 0, m_comp: g.mode === 'comp' || g.mode === 'premier' ? 1 : 0, w_wing: g.mode === 'wing' && won ? 1 : 0, w_ar: g.ar && won ? 1 : 0,
    k_sniper: kt.sniper || 0, k_pistol: kt.pistol || 0, k_knife: kt.knife || 0, k_smg: kt.smg || 0, k_rifle: kt.rifle || 0 });
  for (const m of mdone) { reward += m.c; xpGain += m.xp; }
  const starsGot = armoryXP(xpGain);
  const xpFrom = save.xp || 0; save.xp = xpFrom + xpGain;
  save.lastMatch = { map: g.o.map.name, score: dm ? `#${place}` : `${my}:${th}`, won, k: p.kills, d: p.deaths };
  recordMatch(g, dm ? 'place' : draw ? 'draw' : won ? 'win' : 'lose', { place, rankDelta: rank ? rank.delta : premier && premier.shown ? premier.delta : null });
  save.coins += reward; save.stats.matches++; if (won) save.stats.wins++; save.stats.kills += p.kills; save.stats.deaths += p.deaths; persist();
  // кто стоит на сцене: своя команда (или топ-5 в бою насмерть), лучший — в центре
  const pool = (dm ? order : order.filter(a => a.team === p.team)).slice(0, 5);
  if (!pool.includes(p)) pool[pool.length - 1] = p;
  const kd = a => a.kills / Math.max(1, a.deaths);
  const top = (f) => { let b = null; for (const a of pool) if (f(a) > 0 && (!b || f(a) > f(b))) b = a; return b; };
  const badges = new Map();
  const give = (a, t) => { if (a && !badges.has(a)) badges.set(a, t); };
  if (g.arWinner && pool.includes(g.arWinner)) give(g.arWinner, 'Золотой нож');
  give(top(a => a.mvps || 0), 'MVP матча'); give(top(a => a.kills), 'Больше всех убийств'); give(top(a => a.hs || 0), 'Мастер хедшотов'); give(top(kd), 'Лучший K/D');
  const players = pool.map(a => {
    const w = a.weapons[1] || a.weapons[2];
    return { name: a.name, team: a.team, agent: a.agent, gun: w ? w.id : (a.team === 'T' ? 'ak47' : 'm4a4'), skin: w ? w.skin : null, gloves: a.skins && a.skins.gloves, k: a.kills, d: a.deaths, mvps: a.mvps || 0, hs: a.hs || 0, me: a === p, place: order.indexOf(a) + 1, badge: badges.get(a) || '' };
  });
  const data = { dm, won, draw, place, total: order.length, my, th, team: p.team, map: g.o.map.name, mode: (MODES.find(m => m[0] === g.mode) || [])[1] || '', players, reward, xpFrom, xpGain, rank, premier, mdone, starsGot };
  game.dispose(); game = null; stopAmbience(2);
  controls.enabled = false; controls.reset(); closeBuy();
  $('hud').classList.add('hidden'); $('pause').classList.add('hidden');
  showEnd(data);
  play(won || (dm && place <= 3) ? 'win' : 'lose');
  if (won) setTimeout(() => { if (END) playMusic('mvp'); }, 900);
}

let END = null;
function showEnd(d) {
  const scene = new THREE.Scene();
  const col = d.draw ? '#8a96a6' : d.won ? (d.dm ? '#e8c050' : d.team === 'T' ? '#e8a640' : '#5aa0ff') : '#d04848';
  const bg = document.createElement('canvas'); bg.width = bg.height = 512; const c = bg.getContext('2d');
  const gr = c.createRadialGradient(256, 300, 10, 256, 256, 400); gr.addColorStop(0, col); gr.addColorStop(0.35, '#1a2230'); gr.addColorStop(1, '#05070a');
  c.fillStyle = gr; c.fillRect(0, 0, 512, 512);
  const bt = new THREE.CanvasTexture(bg); bt.colorSpace = THREE.SRGBColorSpace; scene.background = bt;
  scene.add(new THREE.HemisphereLight('#c8d8ff', '#151a22', 0.8));
  const key = new THREE.DirectionalLight('#fff0dc', 2.0); key.position.set(1.5, 5, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(col, 2.4); rim.position.set(-2, 3, -4); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(col, 1.4); rim2.position.set(3, 2, -3); scene.add(rim2);
  // световые пятна под каждым агентом
  const fc = document.createElement('canvas'); fc.width = fc.height = 128; const f = fc.getContext('2d');
  const fg = f.createRadialGradient(64, 64, 2, 64, 64, 64); fg.addColorStop(0, 'rgba(255,255,255,.55)'); fg.addColorStop(1, 'rgba(255,255,255,0)'); f.fillStyle = fg; f.fillRect(0, 0, 128, 128);
  const spotT = new THREE.CanvasTexture(fc);
  const flc = document.createElement('canvas'); flc.width = flc.height = 256; const fl = flc.getContext('2d');
  const flg = fl.createRadialGradient(128, 128, 10, 128, 128, 128); flg.addColorStop(0, 'rgba(14,18,25,1)'); flg.addColorStop(0.6, 'rgba(10,13,18,.9)'); flg.addColorStop(1, 'rgba(5,7,10,0)'); fl.fillStyle = flg; fl.fillRect(0, 0, 256, 256);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(flc), transparent: true, depthWrite: false })); floor.position.z = -1.5; scene.add(floor);
  const fill = new THREE.DirectionalLight('#dfe8ff', 1.1); fill.position.set(-2, 1.6, 6); scene.add(fill);
  const slots = [0, -1, 1, -2, 2], gap = 1.15;
  const models = d.players.map((pl, i) => {
    const m = new AgentModel(pl.agent, pl.gun, pl.skin || null); if (pl.gloves) m.setGloves(pl.gloves);
    const x = slots[i] * gap, z = -Math.abs(slots[i]) * 0.35;
    m.root.position.set(x, 0, z); m.root.rotation.y = Math.PI - x * 0.12;
    scene.add(m.root);
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: spotT, color: i === 0 ? col : '#9fb0c8', transparent: true, depthWrite: false, opacity: 0 }));
    sp.position.set(x, 0.01, z); scene.add(sp);
    return { m, sp, x, z, pl, ph: Math.random() * 6 };
  });
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const scr = $('endScr');
  const title = d.dm ? (d.place === 1 ? 'ПЕРВОЕ МЕСТО' : `МЕСТО ${d.place}`) : d.draw ? 'НИЧЬЯ' : d.won ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
  const sub = d.dm ? `из ${d.total} · ${esc(d.map)}` : `<b class="${d.team === 'T' ? 't' : 'ct'}">${d.my}</b> : <b class="${d.team === 'T' ? 'ct' : 't'}">${d.th}</b>`;
  $('eTitle').innerHTML = `<div class="eMode">${esc(d.mode)}${d.dm ? '' : ' · ' + esc(d.map)}</div><h1>${title}</h1><div class="eScore">${sub}</div>`;
  $('eTitle').style.setProperty('--ec', col);
  $('eCards').innerHTML = models.map(o => `<div class="eCard${o.pl.me ? ' me' : ''} ${o.pl.team === 'T' ? 't' : 'ct'}">
    ${o.pl.badge ? `<div class="eBadge">★ ${esc(o.pl.badge)}</div>` : '<div class="eBadge none"></div>'}
    <div class="eName">${d.dm ? `<i>#${o.pl.place}</i> ` : ''}${esc(o.pl.name)}</div>
    <div class="eStats"><span><b>${o.pl.k}</b>У</span><span><b>${o.pl.d}</b>С</span><span><b>${o.pl.mvps}</b>★</span><span><b>${o.pl.k ? Math.round(o.pl.hs / o.pl.k * 100) : 0}%</b>ГОЛ</span></div></div>`).join('');
  const lvl = x => Math.floor(x / XP_LVL) + 1;
  $('eRew').innerHTML = `<div class="eRow"><span>Награда</span><b class="eCoins">◈ 0</b></div>
    <div class="eRow"><span>Опыт</span><b>+${d.xpGain} XP</b></div>
    <div class="eLvl"><span class="eL">Ур. ${lvl(d.xpFrom)}</span><div class="eBar"><i></i></div></div>
    ${(d.mdone || []).map(m => `<div class="eMis">✔ ${esc(m.t)}</div>`).join('')}
    ${d.starsGot ? `<div class="eMis eStar">★ +${d.starsGot} Armory Pass</div>` : ''}
    ${d.premier ? `<div class="eRank ePrem"><div class="eRm">Premier · CS Rating</div><div id="ePremB">${premBadge(d.premier.before, true, !d.premier.shownBefore)}</div><div class="eRn" id="ePremT">${d.premier.shown ? '' : `Калибровка: побед до рейтинга ${d.premier.left}`}</div></div>` : ''}
    ${d.rank ? `<div class="eRank"><div class="eRm">${esc(d.rank.mode)} · ${d.rank.elo} <em class="${d.rank.delta >= 0 ? 'up' : 'down'}">${d.rank.delta >= 0 ? '+' : ''}${d.rank.delta}</em></div><img src="${rankURL(d.rank.before, 200)}" alt=""><div class="eRn">${d.rank.before < 0 ? 'Без звания' : esc(RANKS[d.rank.before])}</div></div>` : ''}`;
  scr.className = ''; scr.classList.toggle('lose', !d.won && !d.draw);
  END = { d, scene, cam, models, t: 0, coinsShown: 0, rankDone: false, lvlUp: false };
  renderer.setSize(innerWidth, innerHeight, false);
}
$('eOk').onclick = () => { if (!END) return; if (END.t < 4.5) { END.t = 4.5; return; } closeEnd(); };
function closeEnd() {
  if (!END) return;
  END.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  END = null; $('endScr').className = 'hidden';
  quitGame();
}
function renderEnd(dt) {
  const E = END, d = E.d; E.t += dt; const t = E.t;
  const W = innerWidth, H = innerHeight, asp = W / H;
  const ease = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  // камера: издалека и сверху наезжает на строй
  // строй помещается между краем экрана и панелью наград справа
  const rwW = Math.min(W * 0.3, ($('eRew').offsetWidth || 0) + 20), effW = W - rwW;
  const tan = Math.tan(15 * Math.PI / 180), span = Math.max(2, d.players.length) * 1.15 + 0.5;
  const D = Math.max(2.2 / tan * 0.5 / 0.62, span / 2 / (tan * asp * effW / W));
  const k = ease(t / 3.2);
  const dist = D * (1.9 - 0.9 * k), sway = Math.sin(t * 0.25) * 0.25 * k;
  E.cam.aspect = asp; E.cam.setViewOffset(W, H, rwW / 2 * k, 0, W, H);
  E.cam.position.set(sway + (1 - k) * 1.2, 1.25 + (1 - k) * 2.2, dist);
  E.cam.lookAt(sway * 0.4, 0.62, -0.3);
  for (let i = 0; i < E.models.length; i++) {
    const o = E.models[i], st = 0.35 + i * 0.22, a = ease((t - st) / 0.7);
    o.m.root.position.y = 0;
    o.m.root.visible = t > st;
    o.m.root.position.x = o.x; o.m.root.position.z = o.z + (1 - a) * -1.2;
    o.sp.material.opacity = a * (i === 0 ? 0.8 : 0.45);
    o.m.update({ dt, speed: 0, crouch: false, pitch: -0.25 + Math.sin(t * 0.8 + o.ph) * 0.03 });
    o.m.torso.position.y = 0.08 + Math.sin(t * 1.4 + o.ph) * 0.006;
    o.m.root.rotation.y = Math.PI - o.x * 0.12 + Math.sin(t * 0.5 + o.ph) * 0.04;
  }
  renderer.render(E.scene, E.cam);
  // заголовок: удар по центру, затем уезжает вверх
  const tt = $('eTitle'), up = ease((t - 1.5) / 0.6), slam = ease(t / 0.45);
  tt.style.opacity = Math.min(1, t / 0.25); tt.style.left = (W - rwW * up) / 2 + 'px';
  tt.style.transform = `translate(-50%, ${(1 - up) * (H * 0.36)}px) scale(${(2.2 - 1.2 * slam) * (1 - 0.35 * up)})`;
  tt.style.filter = `blur(${(1 - slam) * 8}px)`;
  // карточки под ногами агентов
  const cards = $('eCards').children, v = new THREE.Vector3();
  v.set(0, 0, 0).project(E.cam); const x0 = v.x, y0 = (-v.y * 0.5 + 0.5) * H;
  v.set(1.15, 0, 0).project(E.cam); const cw = Math.min(170, Math.abs(v.x - x0) * 0.5 * W - 6);
  const cardH = cards[0] ? cards[0].offsetHeight : 80, cy = Math.min(y0 - 6, H - cardH - (H < 460 ? 64 : 80));
  for (let i = 0; i < E.models.length; i++) {
    const o = E.models[i], cd = cards[i]; if (!cd) continue;
    v.set(o.x, 0, 0).project(E.cam);
    const sx = (v.x * 0.5 + 0.5) * W;
    const a = ease((t - 1.6 - i * 0.15) / 0.5);
    cd.style.opacity = a; cd.style.width = cw + 'px';
    cd.style.transform = `translate(${sx}px, ${cy + (i === 0 ? -8 : 0) + (1 - a) * 30}px) translateX(-50%)`;
  }
  // награды: монеты, опыт, звание
  const rw = $('eRew'), ra = ease((t - 2.6) / 0.5);
  rw.style.opacity = ra; rw.style.transform = `translateX(${(1 - ra) * 40}px)`;
  const ck = ease((t - 2.9) / 1.2), cn = Math.round(d.reward * ck);
  if (cn !== E.coinsShown) { E.coinsShown = cn; rw.querySelector('.eCoins').textContent = '◈ ' + cn; }
  const xp = d.xpFrom + d.xpGain * ease((t - 3.2) / 1.4), lv = Math.floor(xp / XP_LVL) + 1;
  rw.querySelector('.eBar i').style.width = ((xp % XP_LVL) / XP_LVL * 100) + '%';
  const lvEl = rw.querySelector('.eL'); const txt = 'Ур. ' + lv;
  if (lvEl.textContent !== txt) { lvEl.textContent = txt; if (lv > Math.floor(d.xpFrom / XP_LVL) + 1) { lvEl.classList.remove('pop'); void lvEl.offsetWidth; lvEl.classList.add('pop'); play('buy'); } }
  if (d.premier && d.premier.shown && t > 4.2) {
    // число рейтинга плавно меняется, цвет — по уровню
    const k = Math.min(1, (t - 4.2) / 1.6), v = d.premier.before + (d.premier.after - d.premier.before) * (1 - Math.pow(1 - k, 3));
    const pb = $('ePremB'); if (pb) pb.innerHTML = premBadge(v, true, false);
    const pt = $('ePremT'); if (pt && !E.premT) { E.premT = true; pt.innerHTML = `<em class="${d.premier.delta >= 0 ? 'up' : 'down'}">${d.premier.delta >= 0 ? '+' : ''}${d.premier.delta}</em>${d.premier.shownBefore ? '' : ' · рейтинг открыт!'}`; play(d.premier.delta >= 0 ? 'win' : 'lose'); }
  }
  if (d.rank && !E.rankDone && t > 4.4) {
    E.rankDone = true;
    const box = rw.querySelector('.eRank'), img = box.querySelector('img');
    img.src = rankURL(d.rank.after, 200); box.querySelector('.eRn').textContent = (d.rank.after > d.rank.before ? '▲ ' : d.rank.after < d.rank.before ? '▼ ' : '') + d.rank.name;
    box.classList.add(d.rank.after > d.rank.before ? 'up' : d.rank.after < d.rank.before ? 'down' : 'same', 'flip');
    if (d.rank.after !== d.rank.before) play(d.rank.after > d.rank.before ? 'win' : 'lose');
  }
  $('eOk').style.opacity = ease((t - 2) / 0.5);
}

// ---------- запуск матча ----------
// ---------- поиск матча → «матч найден» → загрузка (как в CS2) ----------
const TIPS = [
  'Стреляйте короткими очередями: первые пули самые точные.',
  'Остановитесь перед выстрелом — в движении разброс огромный.',
  'Звуки шагов слышны далеко. Shift — тихий шаг.',
  'Флешку кидайте за угол, отвернувшись от неё.',
  'Молотов выгоняет врага с позиции, а дым перекрывает обзор.',
  'Комплект сапёра ускоряет разминирование вдвое.',
  'В «Гонке вооружений» убийство ножом отнимает уровень у жертвы.',
  'Держите прицел на уровне головы — так не придётся его поднимать.',
  'После проигранного раунда команда получает больше денег.',
  'Сэкономьте раунд, если денег не хватает на винтовку и броню.',
  'Броня со шлемом спасает от выстрела в голову из AK-47 только на дальних дистанциях.',
  'AWP убивает с одного попадания в тело. Не выглядывайте под снайпера дважды.',
  'Бомба взрывается через 40 секунд после установки.',
  'Перезаряжайтесь в укрытии, а не посреди перестрелки.',
];
let MM = null, LOADING = null;
function startGame() {
  if (MM || LOADING) return;
  initAudio();
  const mode = save.last.mode || 'casual';
  const diff = DIFFICULTIES.find(d => d.id === save.last.diff) || DIFFICULTIES[3];
  if (mode !== 'casual' && diff.id === 'none') { alert('Для этого режима выберите уровень ботов'); return; }
  // полноэкранный режим можно включить только по нажатию — делаем сразу
  if (touch) { try { const d = document.documentElement; (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d); screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* нет полноэкранного режима */ } }
  if (window.__fast) { beginLoad(); return; }
  const ranked = mode === 'comp' || mode === 'wing' || mode === 'premier';
  const total = mode === 'wing' ? 4 : 10;
  MM = { t: 0, find: 1.6 + Math.random() * (ranked ? 3 : 1.5), mode, ranked, total, phase: 'search' };
  $('mmBar').classList.remove('hidden'); play('tick');
  const tick = () => {
    if (!MM) return;
    MM.t += 0.1;
    if (MM.phase === 'search') {
      $('mmTime').textContent = `${Math.floor(MM.t / 60)}:${String(Math.floor(MM.t % 60)).padStart(2, '0')}`;
      if (MM.t >= MM.find) { if (MM.ranked) showAccept(); else { $('mmBar').classList.add('hidden'); MM = null; beginLoad(); return; } }
    } else if (MM.phase === 'accept') {
      const left = 20 - (MM.t - MM.acceptT);
      $('accBar').style.width = Math.max(0, left / 20 * 100) + '%';
      // боты принимают по одному
      if (MM.accepted && MM.bots < MM.total - 1 && MM.t >= MM.nextBot) { MM.bots++; MM.nextBot = MM.t + 0.15 + Math.random() * 0.7; renderAccSlots(); }
      if (MM.accepted && MM.bots >= MM.total - 1 && !MM.done) { MM.done = true; $('accTitle').textContent = 'ВСЕ ИГРОКИ ПРИНЯЛИ МАТЧ'; setTimeout(() => { $('accept').classList.add('hidden'); const pm = MM && MM.mode === 'premier'; MM = null; if (pm) showVeto(); else beginLoad(); }, 900); }
      if (left <= 0 && !MM.accepted) { $('accept').classList.add('hidden'); MM = null; alert('Вы не приняли матч'); return; }
    }
    setTimeout(tick, 100);
  };
  tick();
}
function showAccept() {
  MM.phase = 'accept'; MM.acceptT = MM.t; MM.bots = 0; MM.accepted = false;
  $('mmBar').classList.add('hidden'); $('accept').classList.remove('hidden');
  $('accTitle').textContent = 'ВАШ МАТЧ ГОТОВ!';
  $('accMode').textContent = `${(MODES.find(m => m[0] === MM.mode) || [])[1]} · ${modeMap(MM.mode).name}`;
  $('accBtn').disabled = false; $('accBtn').querySelector('span').textContent = 'ПРИНЯТЬ';
  renderAccSlots(); play('round');
}
function renderAccSlots() { const n = MM.total, ok = (MM.accepted ? 1 : 0) + MM.bots; $('accSlots').innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < ok ? 'ok' : ''}"></i>`).join(''); $('accCount').textContent = `${ok} / ${n}`; }
$('accBtn').onclick = () => { if (!MM || MM.accepted) return; MM.accepted = true; MM.nextBot = MM.t + 0.3; $('accBtn').disabled = true; $('accBtn').querySelector('span').textContent = 'ПРИНЯТО'; play('buy'); renderAccSlots(); };
$('mmCancel').onclick = () => { MM = null; $('mmBar').classList.add('hidden'); };

// ---------- Premier: вето карт (ты 2 бана, соперник 3, ты 1; сторону выбирает соперник) ----------
function showVeto() {
  const pool = POOLS.premier.slice(), banned = {}, order = ['me', 'me', 'en', 'en', 'en', 'me'];
  const box = $('veto'); let step = 0, timer = 15, iv = null;
  const draw = () => {
    const who = order[step];
    box.innerHTML = `<div class="vtTitle">ВЕТО КАРТ · PREMIER</div><div class="vtSub">${step < order.length ? (who === 'me' ? `<b class="me">Ваша очередь</b>: забаньте карту · ${timer} с` : '<b class="en">Соперник банит карту…</b>') : ''}</div>
      <div class="vtMaps">${pool.map(id => { const m = MAPS.find(x => x.id === id); return `<button class="vtMap ${banned[id] ? 'ban ' + banned[id] : ''}" data-id="${id}" ${banned[id] || who !== 'me' ? 'disabled' : ''}><img src="${mapThumbURL(m, 3)}" alt=""><b>${esc(m.name)}</b>${banned[id] ? `<span>${banned[id] === 'me' ? 'БАН ВАШЕЙ КОМАНДЫ' : 'БАН СОПЕРНИКА'}</span>` : ''}</button>`; }).join('')}</div>
      <div class="vtOrder">${order.map((o, i) => `<i class="${o} ${i < step ? 'done' : i === step ? 'cur' : ''}">${o === 'me' ? 'ВЫ' : 'ОНИ'}</i>`).join('')}<i class="pick ${step >= order.length ? 'cur' : ''}">КАРТА</i></div>`;
    box.querySelectorAll('.vtMap:not(:disabled)').forEach(b => b.onclick = () => ban(b.dataset.id, 'me'));
  };
  const left = () => pool.filter(id => !banned[id]);
  const ban = (id, who) => {
    if (banned[id] || order[step] !== who) return;
    banned[id] = who; step++; timer = 15; play('tick'); draw();
    if (step >= order.length) return finish();
    if (order[step] === 'en') setTimeout(() => { const l = left(); ban(l[Math.floor(Math.random() * l.length)], 'en'); }, 900 + Math.random() * 700);
  };
  const finish = () => {
    clearInterval(iv);
    const id = left()[0], m = MAPS.find(x => x.id === id), side = Math.random() < 0.5 ? 'T' : 'CT';
    save.lastMaps = save.lastMaps || {}; save.lastMaps.premier = id; persist();
    box.querySelector('.vtSub').innerHTML = `Играем на <b class="pick">${esc(m.name)}</b> · соперник выбрал сторону, вы за <b class="${side === 'T' ? 'en' : 'me'}">${side === 'T' ? 'террористов' : 'спецназ'}</b>`;
    window.__vetoSide = side; play('round');
    setTimeout(() => { box.classList.add('hidden'); beginLoad(); }, 2200);
  };
  box.classList.remove('hidden'); draw();
  iv = setInterval(() => { if (step >= order.length) { clearInterval(iv); return; } if (order[step] !== 'me') return; timer--; const sub = box.querySelector('.vtSub b.me'); if (sub) sub.parentElement.innerHTML = `<b class="me">Ваша очередь</b>: забаньте карту · ${timer} с`; if (timer <= 0) { const l = left(); ban(l[Math.floor(Math.random() * l.length)], 'me'); } }, 1000);
}
function beginLoad() {
  document.body.classList.add('ingame');
  const yb = $('ytBox'); yb.innerHTML = ''; yb.dataset.id = ''; yb.classList.add('hidden'); stopMusic(0.5);
  const mode = save.last.mode || 'casual';
  const map = modeMap(mode);
  const diff = DIFFICULTIES.find(d => d.id === save.last.diff) || DIFFICULTIES[3];
  const side = window.__vetoSide || (Math.random() < 0.5 ? 'T' : 'CT'); window.__vetoSide = null;
  let size = +save.last.size, winTo = +save.last.winTo;
  if (mode === 'comp' || mode === 'premier') { size = 5; winTo = 13; }
  if (mode === 'wing') { size = 2; winTo = 9; }
  if (mode === 'ar') { size = 5; }
  const L = $('load'), mname = (MODES.find(m => m[0] === mode) || [])[1];
  $('menu').classList.add('hidden'); L.classList.remove('hidden');
  $('ldMode').textContent = mname; $('ldMap').textContent = map.name; $('ldDesc').textContent = map.desc;
  $('ldTip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  $('ldRoster').innerHTML = ''; $('ldBar').style.width = '0%'; $('ldStage').textContent = 'Подключение к серверу…'; $('ldPct').textContent = '0%';
  $('ldBg').style.backgroundImage = `url(${mapThumbURL(map, 6)})`;
  playMusic('start');
  // даём оверлею отрисоваться, потом строим карту
  setTimeout(() => {
    try {
      game = new Game(renderer, { nick: nick(), map, diff, side, size, winTo, mode, settings: save.settings, quality: quality(), controls, loadout: loadout(), agents: save.agent, graffiti: save.graffiti || 'cfs', admin: { ...(save.admin || {}) } }, hud);
    } catch (e) { L.classList.add('hidden'); $('menu').classList.remove('hidden'); alert('Ошибка запуска: ' + e.message); console.error(e); return; }
    const g = game, cx = g.world.w * CELL / 2, cz = g.world.h * CELL / 2;
    const roster = t => g.actors.filter(a => a.team === t).map(a => `<div class="ldP${a === g.player ? ' me' : ''}"><span class="avatar" style="--av:${a === g.player ? AV_COLORS[save.avatar || 0] : t === 'T' ? '#a8823f' : '#41689c'};width:22px;height:22px;font-size:12px">${esc(a.name[0] || '?')}</span>${esc(a.name)}</div>`).join('');
    $('ldRoster').innerHTML = mode === 'dm' ? `<div class="ldCol"><h5>Участники</h5>${g.actors.map(a => `<div class="ldP${a === g.player ? ' me' : ''}">${esc(a.name)}</div>`).join('')}</div>`
      : `<div class="ldCol t"><h5>Террористы</h5>${roster('T')}</div><div class="ldCol ct"><h5>Спецназ</h5>${roster('CT')}</div>`;
    LOADING = { g, t: 0, t0: 0, dur: window.__fast ? 0.05 : save.admin && save.admin.fastLoad ? 1 : 6.5 + Math.random() * 2, cx, cz, R: Math.max(cx, cz) * 1.1, tipT: 0 };
    renderer.compile && renderer.compile(g.scene, g.camera);
  }, 60);
}
const LD_STAGES = [[0, 'Подключение к серверу…'], [0.12, 'Загрузка карты…'], [0.3, 'Загрузка текстур…'], [0.5, 'Компиляция шейдеров…'], [0.68, 'Загрузка моделей игроков…'], [0.84, 'Синхронизация с сервером…'], [0.95, 'Ожидание игроков…']];
function renderLoading(dt) {
  const Ld = LOADING, g = Ld.g, now = performance.now(); Ld.t += Math.min(0.25, Math.max(0, (now - (Ld.t0 || now)) / 1000)); Ld.t0 = now;
  // прогресс неровный, как настоящая загрузка: рывки и паузы
  const k = Math.min(1, Ld.t / Ld.dur), p = Math.min(1, k + Math.sin(k * 17) * 0.025 * (1 - k));
  const shown = Math.floor(Math.pow(p, 1.3) * 100);
  $('ldBar').style.width = shown + '%'; $('ldPct').textContent = shown + '%';
  let st = LD_STAGES[0][1]; for (const [at, txt] of LD_STAGES) if (k >= at) st = txt; $('ldStage').textContent = st;
  if (Ld.t - Ld.tipT > 4) { Ld.tipT = Ld.t; $('ldTip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)]; }
  // пролёт камеры над картой
  const a = Ld.t * 0.12 + 0.6, cam = g.camera;
  cam.position.set(Ld.cx + Math.cos(a) * Ld.R, 38 - Ld.t * 1.2, Ld.cz + Math.sin(a) * Ld.R);
  cam.lookAt(Ld.cx, 0, Ld.cz);
  if (g.dome) g.dome.position.copy(cam.position);
  renderer.render(g.scene, cam);
  $('ldBg').style.opacity = Math.max(0, 1 - Ld.t / 1.2);
  if (Ld.t >= Ld.dur) finishLoad();
}
function finishLoad() {
  const lg = LOADING && LOADING.g; LOADING = null;
  if (!game || game !== lg) return;
  if ((game.mode === 'casual' || game.ar) && !game.aimMode && !window.__fast) setTimeout(showTeamSelect, 50);
  startAmbience(styleOf(game.o.map));
  $('load').classList.add('hidden'); $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !touch); applyTouchLayout();
  $('fps').classList.toggle('hidden', !save.settings.fps);
  $('feed').innerHTML = ''; $('chat').innerHTML = ''; $('dmgRep').classList.add('hidden');
  controls.reset(); controls.enabled = true; controls.touchSens = save.settings.touchSens;
  if (!touch) { controls.lock(); if (!controls.locked) game.centerMsg('Кликните, чтобы начать', 2.5); }
  checkRotate();
  last = performance.now();
}
function quitGame() {
  stopAmbience();
  if (window.__updateReady) { location.reload(); return; }
  if (game) { game.dispose(); game = null; }
  document.body.classList.remove('ingame');
  controls.enabled = false; controls.unlock(); controls.reset();
  $('hud').classList.add('hidden'); $('menu').classList.remove('hidden'); $('rotate').classList.add('hidden');
  closeBuy();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  coins(); renderInv(); renderHome();
  if (ytActive()) updYt(); else playMusic('menu');
}
function checkRotate() { $('rotate').classList.toggle('hidden', !(game && touch && innerHeight > innerWidth)); }
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); if (game) game.resize(); checkRotate(); });

// ---------- цикл ----------
let last = performance.now(), last0 = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  if (window.__stop) return;
  if (END) { renderEnd(dt); return; }
  if (LOADING) { renderLoading(dt); return; }
  if (!game) { if (!$('menu').classList.contains('hidden')) renderMenu3d(dt); return; }
  const paused = !$('pause').classList.contains('hidden') || !$('teamSel').classList.contains('hidden');
  if (!paused) game.update(dt);
  if (!game) return;
  game.render();
  if (!paused && last0) adaptRes(Math.min(0.25, (now - last0) / 1000)); else { arAcc = 0; arN = 0; }
  last0 = paused ? 0 : now;
  updateHud(game, dt);
}
requestAnimationFrame(frame);
// ---------- установка (PWA) и офлайн ----------
let installEvt = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone;
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // автообновление: при появлении интернета и раз в 15 минут проверяем новую версию;
  // новая версия применяется в меню (перезагрузкой), а не посреди матча
  const hadController = !!navigator.serviceWorker.controller;
  let swReg = null, reloading = false;
  const check = () => { if (swReg && navigator.onLine) swReg.update().catch(() => {}); };
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').then(r => { swReg = r; check(); }).catch(() => {}));
  addEventListener('online', () => { check(); if (!game) updYt(); });
  setInterval(check, 15 * 60 * 1000);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    if (!game) { reloading = true; location.reload(); } else window.__updateReady = true;
  });
}
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; renderInstall(); });
addEventListener('appinstalled', () => { installEvt = null; renderInstall(); });
function renderInstall() {
  const box = $('installBox'); if (!box) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (standalone()) { box.innerHTML = '<b>✔ Игра установлена</b><span>Работает без интернета.</span>'; return; }
  box.innerHTML = `<b>Установить игру</b><span>${installEvt ? 'Игра появится на рабочем столе и будет работать без интернета.' : ios ? 'В Safari нажмите «Поделиться» → «На экран Домой». После этого игра работает без интернета.' : 'В меню браузера выберите «Установить приложение» или «Добавить на главный экран». Игра будет работать без интернета.'}</span>${installEvt ? '<button class="playBig inline" id="installBtn"><span>УСТАНОВИТЬ</span></button>' : ''}`;
  const b = $('installBtn'); if (b) b.onclick = async () => { installEvt.prompt(); try { await installEvt.userChoice; } catch (e) { /* отмена */ } installEvt = null; renderInstall(); };
}
renderInstall();
window.__cfs = { get game() { return game; }, get end() { return END; }, startGame, save, hud, teamSel: () => showTeamSelect() };
