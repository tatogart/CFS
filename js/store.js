// Сохранение: монеты, инвентарь, экипировка, настройки
import { SKINS, CASES, RARITY, skinById, GLOVES } from './data.js?v=1793196962';

const KEY = 'cfs_save_v1';
const defaults = () => ({
  coins: 2000,
  inv: [],              // [{uid, skin}]
  equip: {},            // weaponId -> uid ('knife' -> uid ножа)
  agent: { T: 't_phoenix', CT: 'ct_sas' },
  graffiti: 'cfs',
  settings: { sens: 1, touchSens: 1, fov: 78, quality: 'auto', volume: 0.7, music: 0.5, fps: false, crosshair: '#4dff6a', autoFire: false, invertY: false,
    hand: 'right', vmfov: 62, chLen: 8, chThick: 2, chGap: 4, chDot: true, chOutline: true, chDynamic: true, touchAlpha: 1, touchLayout: null },
  musicKit: 'cfs', customKitName: 'Мой кит',
  last: { map: 'dust2', diff: 'medium', side: 'auto', size: 5, winTo: 8 },
  stats: { kills: 0, deaths: 0, wins: 0, matches: 0, opened: 0 },
  nextUid: 1,
});
let save;
export function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw), def = defaults(); save = { ...def, ...d, settings: { ...def.settings, ...d.settings }, last: { ...def.last, ...d.last }, stats: { ...def.stats, ...d.stats }, agent: { ...def.agent, ...d.agent } }; } }
  catch (e) { /* приватный режим */ }
  if (!save) save = defaults();
  save.inv = save.inv.filter(it => skinById[it.skin]);
  for (const it of save.inv) if (it.wear == null) { it.wear = +(((it.uid * 2654435761) % 1000) / 1000 * 0.6).toFixed(4); it.st = false; }
  return save;
}
export function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* нет хранилища */ } }
export const S = () => save;

// износ как в CS: от «Прямо с завода» до «Закалённого в боях»
export const WEARS = [[0.07, 'Прямо с завода', 'FN'], [0.15, 'Немного поношенное', 'MW'], [0.38, 'После полевых испытаний', 'FT'], [0.45, 'Поношенное', 'WW'], [1, 'Закалённое в боях', 'BS']];
export const wearOf = f => WEARS.find(w => f <= w[0]) || WEARS[4];
function rollWear() { const r = Math.random(); return r < 0.15 ? Math.random() * 0.07 : r < 0.4 ? 0.07 + Math.random() * 0.08 : r < 0.8 ? 0.15 + Math.random() * 0.23 : r < 0.9 ? 0.38 + Math.random() * 0.07 : 0.45 + Math.random() * 0.55; }
export function addItem(skinId, st) {
  const it = { uid: save.nextUid++, skin: skinId, t: Date.now(), wear: +rollWear().toFixed(4), st: st == null ? Math.random() < 0.1 : !!st };
  if (it.st) it.kills = 0;
  save.inv.push(it); persist(); return it;
}
// StatTrak: засчитать убийство надетым оружием
export function statTrak(slot) { const uid = save.equip[slot]; const it = uid && save.inv.find(x => x.uid === uid); if (it && it.st) { it.kills = (it.kills || 0) + 1; return it; } return null; }
export function sellItem(uid) {
  const i = save.inv.findIndex(x => x.uid === uid); if (i < 0) return 0;
  const sk = skinById[save.inv[i].skin], val = RARITY[sk.rarity].sell;
  for (const k in save.equip) if (save.equip[k] === uid) delete save.equip[k];
  save.inv.splice(i, 1); save.coins += val; persist(); return val;
}
const slotOf = sk => (GLOVES[sk.weapon] ? 'gloves' : sk.rarity === 'gold' ? 'knife' : sk.weapon);
export function equipItem(uid) {
  const it = save.inv.find(x => x.uid === uid); if (!it) return;
  const slot = slotOf(skinById[it.skin]);
  if (save.equip[slot] === uid) delete save.equip[slot]; else save.equip[slot] = uid;
  persist();
}
export function isEquipped(uid) { return Object.values(save.equip).includes(uid); }
// какие скины надеты: weaponId -> skinId; knife -> {model, skin}
export function loadout() {
  const out = {};
  for (const [slot, uid] of Object.entries(save.equip)) {
    const it = save.inv.find(x => x.uid === uid); if (!it) continue;
    const sk = skinById[it.skin];
    if (slot === 'knife') out.knife = { model: sk.weapon, skin: sk.id }; else if (slot === 'gloves') out.gloves = sk.id; else out[slot] = sk.id;
  }
  return out;
}
// Ролл кейса по весам редкости
export function rollCase(caseId) {
  const cs = typeof caseId === 'object' ? caseId : CASES.find(c => c.id === caseId);
  const byR = {}; for (const id of cs.items) { const r = skinById[id].rarity; (byR[r] = byR[r] || []).push(id); }
  const rs = Object.keys(byR), total = rs.reduce((s, r) => s + RARITY[r].w, 0);
  let x = Math.random() * total;
  for (const r of rs) { x -= RARITY[r].w; if (x <= 0) { const l = byR[r]; return l[Math.floor(Math.random() * l.length)]; } }
  return cs.items[0];
}
export function randomFromCase(caseId) { return rollCase(caseId); }
export { SKINS };
