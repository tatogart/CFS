// Сохранение: монеты, инвентарь, экипировка, настройки
import { SKINS, CASES, RARITY, skinById } from './data.js?v=1793106875';

const KEY = 'cfs_save_v1';
const defaults = () => ({
  coins: 2000,
  inv: [],              // [{uid, skin}]
  equip: {},            // weaponId -> uid ('knife' -> uid ножа)
  agent: { T: 't_phoenix', CT: 'ct_sas' },
  settings: { sens: 1, touchSens: 1, fov: 78, quality: 'auto', volume: 0.7, fps: false, crosshair: '#4dff6a', autoFire: false, invertY: false },
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
  return save;
}
export function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* нет хранилища */ } }
export const S = () => save;

export function addItem(skinId) { const it = { uid: save.nextUid++, skin: skinId, t: Date.now() }; save.inv.push(it); persist(); return it; }
export function sellItem(uid) {
  const i = save.inv.findIndex(x => x.uid === uid); if (i < 0) return 0;
  const sk = skinById[save.inv[i].skin], val = RARITY[sk.rarity].sell;
  for (const k in save.equip) if (save.equip[k] === uid) delete save.equip[k];
  save.inv.splice(i, 1); save.coins += val; persist(); return val;
}
const slotOf = sk => (sk.rarity === 'gold' ? 'knife' : sk.weapon);
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
    if (slot === 'knife') out.knife = { model: sk.weapon, skin: sk.id }; else out[slot] = sk.id;
  }
  return out;
}
// Ролл кейса по весам редкости
export function rollCase(caseId) {
  const cs = CASES.find(c => c.id === caseId);
  const byR = {}; for (const id of cs.items) { const r = skinById[id].rarity; (byR[r] = byR[r] || []).push(id); }
  const rs = Object.keys(byR), total = rs.reduce((s, r) => s + RARITY[r].w, 0);
  let x = Math.random() * total;
  for (const r of rs) { x -= RARITY[r].w; if (x <= 0) { const l = byR[r]; return l[Math.floor(Math.random() * l.length)]; } }
  return cs.items[0];
}
export function randomFromCase(caseId) { return rollCase(caseId); }
export { SKINS };
