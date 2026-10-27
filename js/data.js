export const RARITY = {
  milspec: { name: 'Армейское', color: '#4b69ff', w: 7992, sell: 15 },
  restricted: { name: 'Запрещённое', color: '#8847ff', w: 1598, sell: 60 },
  classified: { name: 'Засекреченное', color: '#d32ce6', w: 320, sell: 250 },
  covert: { name: 'Тайное', color: '#eb4b4b', w: 64, sell: 900 },
  gold: { name: '★ Редкий особый', color: '#e4ae39', w: 26, sell: 2500 },
};
export const RARITY_ORDER = ['milspec', 'restricted', 'classified', 'covert', 'gold'];

// spread — базовый разброс (рад), move — штраф за бег, recoil — отдача за выстрел
export const WEAPONS = {
  knife: { name: 'Нож', slot: 3, type: 'knife', dmg: 40, rate: 0.5, speed: 6.4, price: 0, kill: 1500 },
  glock: { name: 'Glock-18', slot: 2, type: 'pistol', team: 'T', dmg: 30, rate: 0.13, mag: 20, reserve: 120, reload: 2.1, spread: 0.010, move: 0.045, recoil: 0.010, pen: 0.47, price: 200, speed: 6.1, kill: 300 },
  usp: { name: 'USP-S', slot: 2, type: 'pistol', team: 'CT', dmg: 35, rate: 0.16, mag: 12, reserve: 24, reload: 2.2, spread: 0.007, move: 0.04, recoil: 0.012, pen: 0.5, price: 200, speed: 6.1, kill: 300, silenced: true },
  deagle: { name: 'Desert Eagle', slot: 2, type: 'pistol', dmg: 63, rate: 0.28, mag: 7, reserve: 35, reload: 2.2, spread: 0.006, move: 0.09, recoil: 0.055, pen: 0.93, price: 700, speed: 5.9, kill: 300 },
  p250: { name: 'P250', slot: 2, type: 'pistol', dmg: 38, rate: 0.15, mag: 13, reserve: 26, reload: 2.2, spread: 0.009, move: 0.05, recoil: 0.02, pen: 0.64, price: 300, speed: 6.1, kill: 300 },
  tec9: { name: 'Tec-9', slot: 2, type: 'pistol', team: 'T', dmg: 33, rate: 0.12, mag: 18, reserve: 90, reload: 2.5, spread: 0.011, move: 0.035, recoil: 0.016, pen: 0.9, price: 500, speed: 6.1, kill: 300 },
  fiveseven: { name: 'Five-SeveN', slot: 2, type: 'pistol', team: 'CT', dmg: 32, rate: 0.12, mag: 20, reserve: 100, reload: 2.2, spread: 0.009, move: 0.04, recoil: 0.015, pen: 0.91, price: 500, speed: 6.1, kill: 300 },
  ump45: { name: 'UMP-45', slot: 1, type: 'smg', dmg: 35, rate: 0.09, mag: 25, reserve: 100, reload: 3.5, spread: 0.014, move: 0.025, recoil: 0.012, pen: 0.65, price: 1200, speed: 5.9, kill: 600, auto: true },
  mp7: { name: 'MP7', slot: 1, type: 'smg', dmg: 29, rate: 0.08, mag: 30, reserve: 120, reload: 3.1, spread: 0.012, move: 0.022, recoil: 0.01, pen: 0.62, price: 1500, speed: 6.0, kill: 600, auto: true },
  p90: { name: 'P90', slot: 1, type: 'smg', dmg: 26, rate: 0.07, mag: 50, reserve: 100, reload: 3.3, spread: 0.015, move: 0.02, recoil: 0.008, pen: 0.69, price: 2350, speed: 5.9, kill: 300, auto: true },
  nova: { name: 'Nova', slot: 1, type: 'shotgun', dmg: 26, pellets: 9, rate: 0.88, mag: 8, reserve: 32, reload: 3.5, spread: 0.06, move: 0.02, recoil: 0.06, pen: 0.5, price: 1050, speed: 5.8, kill: 900, falloff: 0.88 },
  xm1014: { name: 'XM1014', slot: 1, type: 'shotgun', dmg: 20, pellets: 6, rate: 0.35, mag: 7, reserve: 32, reload: 3.5, spread: 0.055, move: 0.02, recoil: 0.05, pen: 0.8, price: 2000, speed: 5.7, kill: 900, auto: true, falloff: 0.9 },
  negev: { name: 'Negev', slot: 1, type: 'mg', dmg: 35, rate: 0.065, mag: 150, reserve: 200, reload: 5.7, spread: 0.02, move: 0.12, recoil: 0.008, pen: 0.71, price: 1700, speed: 5.0, kill: 300, auto: true },
  mac10: { name: 'MAC-10', slot: 1, type: 'smg', team: 'T', dmg: 29, rate: 0.075, mag: 30, reserve: 100, reload: 2.6, spread: 0.016, move: 0.02, recoil: 0.009, pen: 0.57, price: 1050, speed: 6.0, kill: 600, auto: true },
  mp9: { name: 'MP9', slot: 1, type: 'smg', team: 'CT', dmg: 26, rate: 0.07, mag: 30, reserve: 120, reload: 2.1, spread: 0.014, move: 0.02, recoil: 0.009, pen: 0.6, price: 1250, speed: 6.0, kill: 600, auto: true },
  galil: { name: 'Galil AR', slot: 1, type: 'rifle', team: 'T', dmg: 30, rate: 0.09, mag: 35, reserve: 90, reload: 2.9, spread: 0.006, move: 0.08, recoil: 0.011, pen: 0.77, price: 1800, speed: 5.7, kill: 300, auto: true },
  famas: { name: 'FAMAS', slot: 1, type: 'rifle', team: 'CT', dmg: 30, rate: 0.09, mag: 25, reserve: 90, reload: 3.1, spread: 0.006, move: 0.08, recoil: 0.011, pen: 0.7, price: 2050, speed: 5.7, kill: 300, auto: true },
  sg553: { name: 'SG 553', slot: 1, type: 'rifle', team: 'T', dmg: 30, rate: 0.09, mag: 30, reserve: 90, reload: 2.8, spread: 0.004, move: 0.1, recoil: 0.012, pen: 1.0, price: 3000, speed: 5.4, kill: 300, auto: true, scope: true, zoom: [45] },
  aug: { name: 'AUG', slot: 1, type: 'rifle', team: 'CT', dmg: 28, rate: 0.09, mag: 30, reserve: 90, reload: 3.8, spread: 0.004, move: 0.1, recoil: 0.011, pen: 0.9, price: 3300, speed: 5.5, kill: 300, auto: true, scope: true, zoom: [45] },
  m4a1s: { name: 'M4A1-S', slot: 1, type: 'rifle', team: 'CT', dmg: 38, rate: 0.1, mag: 20, reserve: 80, reload: 3.1, spread: 0.0035, move: 0.09, recoil: 0.011, pen: 0.7, price: 2900, speed: 5.6, kill: 300, auto: true, silenced: true },
  ssg08: { name: 'SSG 08', slot: 1, type: 'sniper', dmg: 88, rate: 1.25, mag: 10, reserve: 90, reload: 3.7, spread: 0.002, move: 0.08, recoil: 0.04, pen: 0.85, price: 1700, speed: 5.9, kill: 300, scope: true, noscope: 0.05 },
  g3sg1: { name: 'G3SG1', slot: 1, type: 'sniper', team: 'T', dmg: 80, rate: 0.25, mag: 20, reserve: 90, reload: 4.7, spread: 0.0025, move: 0.15, recoil: 0.03, pen: 0.82, price: 5000, speed: 5.0, kill: 300, scope: true, noscope: 0.07, auto: true },
  scar20: { name: 'SCAR-20', slot: 1, type: 'sniper', team: 'CT', dmg: 80, rate: 0.25, mag: 20, reserve: 90, reload: 3.1, spread: 0.0025, move: 0.15, recoil: 0.03, pen: 0.82, price: 5000, speed: 5.0, kill: 300, scope: true, noscope: 0.07, auto: true },
  ak47: { name: 'AK-47', slot: 1, type: 'rifle', team: 'T', dmg: 36, rate: 0.1, mag: 30, reserve: 90, reload: 2.5, spread: 0.004, move: 0.1, recoil: 0.014, pen: 0.775, price: 2700, speed: 5.5, kill: 300, auto: true },
  m4a4: { name: 'M4A4', slot: 1, type: 'rifle', team: 'CT', dmg: 33, rate: 0.09, mag: 30, reserve: 90, reload: 3.1, spread: 0.004, move: 0.09, recoil: 0.012, pen: 0.7, price: 3100, speed: 5.6, kill: 300, auto: true },
  awp: { name: 'AWP', slot: 1, type: 'sniper', dmg: 115, rate: 1.45, mag: 5, reserve: 30, reload: 3.6, spread: 0.0015, move: 0.2, recoil: 0.05, pen: 0.97, price: 4750, speed: 5.0, kill: 100, scope: true, noscope: 0.07 },
};
export const BUY_GROUPS = [
  { name: 'Пистолеты', items: ['glock', 'usp', 'p250', 'tec9', 'fiveseven', 'deagle'] },
  { name: 'ПП', items: ['mac10', 'mp9', 'mp7', 'ump45', 'p90'] },
  { name: 'Тяжёлое', items: ['nova', 'xm1014', 'negev'] },
  { name: 'Винтовки', items: ['galil', 'famas', 'ak47', 'm4a4', 'm4a1s', 'sg553', 'aug'] },
  { name: 'Снайперские', items: ['ssg08', 'awp', 'g3sg1', 'scar20'] },
  { name: 'Гранаты', items: ['he', 'flash', 'smoke', 'molotov'] },
  { name: 'Снаряжение', items: ['vest', 'vesthelm', 'kit'] },
];
export const NADES = {
  he: { name: 'Осколочная', price: 300, max: 1 },
  flash: { name: 'Световая', price: 200, max: 2 },
  smoke: { name: 'Дымовая', price: 300, max: 1 },
  molotov: { name: 'Молотов', ctName: 'Зажигательная', price: 400, ctPrice: 500, max: 1 },
};
export const GEAR = {
  vest: { name: 'Бронежилет', price: 650 },
  vesthelm: { name: 'Броня + шлем', price: 1000 },
  kit: { name: 'Набор сапёра', price: 400, team: 'CT' },
};

// Узоры скинов: t — тип, c — цвета
const S = (id, weapon, name, rarity, t, c) => ({ id, weapon, name, rarity, pat: { t, c } });
export const SKINS = [
  // Пустынный шторм
  S('ak_sand', 'ak47', 'Песчаная буря', 'restricted', 'camo', ['#c2a46b', '#8a6d3b', '#e1cd98', '#5e4a2b']),
  S('ak_redline', 'ak47', 'Красная линия', 'classified', 'carbon', ['#1b1b1d', '#c3202a', '#2a2a2e']),
  S('m4_desert', 'm4a4', 'Пустынный стрелок', 'restricted', 'digital', ['#c9b180', '#9f845a', '#e3d3a6', '#6f5a3b']),
  S('awp_dune', 'awp', 'Дюна', 'milspec', 'stripes', ['#d6b77c', '#a7834e']),
  S('glock_sand', 'glock', 'Песчаная дюна', 'milspec', 'camo', ['#cdb487', '#a48a5e', '#e6d6ad', '#7d6844']),
  S('deagle_blaze', 'deagle', 'Пламя', 'covert', 'fire', ['#170b05', '#ff5a00', '#ffd23a']),
  S('mp9_scorched', 'mp9', 'Опалённый', 'milspec', 'splat', ['#4b3a2a', '#1e1712', '#8a6a4a']),
  S('galil_sandstorm', 'galil', 'Самум', 'restricted', 'tiger', ['#d4a35a', '#6b4119']),
  S('usp_guardian', 'usp', 'Страж', 'classified', 'hex', ['#c9b98f', '#303030', '#e9dcb4']),
  S('famas_dune', 'famas', 'Барханы', 'milspec', 'fade', ['#e2c287', '#8f6b3a']),
  // Неон
  S('ak_neon', 'ak47', 'Неоновая революция', 'covert', 'neon', ['#13061f', '#ff2bd6', '#2bf3ff', '#ffe600']),
  S('m4_cyber', 'm4a4', 'Киберсеть', 'classified', 'neon', ['#0a1424', '#22e6ff', '#7a3cff', '#ffffff']),
  S('awp_neonoir', 'awp', 'Неонуар', 'covert', 'splat', ['#16081f', '#ff2fa3', '#3cf0ff', '#8e2bff']),
  S('glock_vapor', 'glock', 'Вейпорвейв', 'restricted', 'fade', ['#ff71ce', '#01cdfe']),
  S('usp_neon', 'usp', 'Ночной город', 'restricted', 'stripes', ['#1b0f2e', '#ff3fb4']),
  S('mac_neon', 'mac10', 'Неонрайдер', 'classified', 'neon', ['#0d0d1a', '#ff9d00', '#ff2bd6', '#00ffd5']),
  S('mp9_hyper', 'mp9', 'Гипербит', 'milspec', 'digital', ['#2a1a4a', '#5d2ca8', '#14ffec', '#1a1030']),
  S('famas_pulse', 'famas', 'Пульс', 'milspec', 'hex', ['#101820', '#00e5ff', '#1f2c3a']),
  S('deagle_glow', 'deagle', 'Свечение', 'restricted', 'fade', ['#ff00c8', '#00f0ff']),
  // Хищник
  S('ak_jungle', 'ak47', 'Тигр джунглей', 'restricted', 'tiger', ['#e48a1c', '#151515']),
  S('m4_howl', 'm4a4', 'Вой', 'covert', 'fire', ['#2a0505', '#e01818', '#ff8a3a']),
  S('awp_asiimov', 'awp', 'Азимов', 'covert', 'asiimov', ['#f2f2f2', '#ff6a00', '#1a1a1a']),
  S('galil_viper', 'galil', 'Гадюка', 'classified', 'hex', ['#1d3b16', '#9be22d', '#0f1f0b']),
  S('glock_fade', 'glock', 'Градиент', 'classified', 'fade', ['#ffd000', '#d62bd6', '#2b6bff']),
  S('mac_croc', 'mac10', 'Крокодил', 'milspec', 'hex', ['#3a4a22', '#1d2511', '#56682f']),
  S('usp_kill', 'usp', 'Подтверждённое', 'covert', 'asiimov', ['#20232a', '#e8b52a', '#c22b2b']),
  S('deagle_predator', 'deagle', 'Хищник', 'milspec', 'tiger', ['#b9a37a', '#2d2416']),
  S('mp9_viper', 'mp9', 'Змеиная кожа', 'restricted', 'hex', ['#4a6b2a', '#1a2a10', '#7a9b4a']),
  // Ледяной
  S('ak_ice', 'ak47', 'Лёд', 'classified', 'marble', ['#e8f6ff', '#7cc6ff', '#3a6fb0']),
  S('m4_frost', 'm4a4', 'Иней', 'restricted', 'camo', ['#dfeaf2', '#9fb8c9', '#ffffff', '#6f8798']),
  S('awp_lightning', 'awp', 'Удар молнии', 'covert', 'lightning', ['#0b1033', '#7ae0ff', '#ffffff']),
  S('glock_arctic', 'glock', 'Арктика', 'milspec', 'digital', ['#e9eef2', '#a9b8c4', '#ffffff', '#7a8a96']),
  S('usp_frozen', 'usp', 'Мерзлота', 'milspec', 'marble', ['#cfe6f5', '#5a8fb8', '#2a4a6a']),
  S('famas_ice', 'famas', 'Айсберг', 'classified', 'fade', ['#ffffff', '#2a7fff']),
  S('deagle_cobalt', 'deagle', 'Кобальт', 'restricted', 'carbon', ['#0d1b3a', '#2a6bff', '#142852']),
  S('mac_blizzard', 'mac10', 'Метель', 'milspec', 'splat', ['#dfe8ee', '#7a96aa', '#ffffff']),
  S('galil_glacier', 'galil', 'Ледник', 'milspec', 'stripes', ['#a8d4f0', '#ffffff']),
  // Ножи
  S('kn_kar_fade', 'karambit', 'Градиент', 'gold', 'fade', ['#ffd000', '#ff3cc8', '#3c64ff']),
  S('kn_kar_doppler', 'karambit', 'Доплер', 'gold', 'marble', ['#1a0a2a', '#d23cff', '#2a8aff']),
  S('kn_bfly_tiger', 'butterfly', 'Зуб тигра', 'gold', 'tiger', ['#ffb000', '#2a1600']),
  S('kn_bfly_ice', 'butterfly', 'Морозный', 'gold', 'marble', ['#ffffff', '#6ac8ff', '#1a4a8a']),
  S('kn_bay_crimson', 'bayonet', 'Кровавая паутина', 'gold', 'web', ['#9a0f12', '#1a0303']),
  S('kn_bay_neon', 'bayonet', 'Неон', 'gold', 'neon', ['#0b0618', '#ff2bd6', '#2bf3ff', '#fff']),
  S('kn_kar_jungle', 'karambit', 'Джунгли', 'gold', 'camo', ['#4b5e2c', '#26301a', '#7b8d4a', '#141a0d']),
  // новые ножи
  S('kn_kar_case', 'karambit', 'Закалка', 'gold', 'case', ['#3a5f9e', '#c9a13b', '#6f7a86']),
  S('kn_kar_gamma', 'karambit', 'Гамма-доплер', 'gold', 'marble', ['#062a12', '#1fd36a', '#0a6a3a']),
  S('kn_bay_slaughter', 'bayonet', 'Бойня', 'gold', 'slaughter', ['#d8d0cc', '#a3131c', '#5e0a0f']),
  S('kn_bfly_damascus', 'butterfly', 'Дамасская сталь', 'gold', 'damascus', ['#8f969d', '#c9ced3', '#5b6168']),
  S('kn_flip_fade', 'flip', 'Градиент', 'gold', 'fade', ['#ffd000', '#ff3cc8', '#3c64ff']),
  S('kn_flip_night', 'flip', 'Ночь', 'gold', 'carbon', ['#16181c', '#30343a', '#22252a']),
  S('kn_flip_doppler', 'flip', 'Доплер', 'gold', 'marble', ['#1a0a2a', '#ff3ca0', '#3a1aff']),
  S('kn_gut_tiger', 'gut', 'Зуб тигра', 'gold', 'tiger', ['#ffb000', '#2a1600']),
  S('kn_gut_case', 'gut', 'Закалка', 'gold', 'case', ['#3a5f9e', '#c9a13b', '#6f7a86']),
  S('kn_hunt_web', 'huntsman', 'Кровавая паутина', 'gold', 'web', ['#9a0f12', '#1a0303']),
  S('kn_hunt_slaughter', 'huntsman', 'Бойня', 'gold', 'slaughter', ['#d8d0cc', '#a3131c', '#5e0a0f']),
  S('kn_falc_marble', 'falchion', 'Мраморный градиент', 'gold', 'fade', ['#ffe600', '#ff1f1f', '#2a3cff']),
  S('kn_falc_uv', 'falchion', 'Ультрафиолет', 'gold', 'fade', ['#2a0f3f', '#5a2a7a', '#1a0a26']),
  S('kn_talon_doppler', 'talon', 'Доплер', 'gold', 'marble', ['#1a0a2a', '#d23cff', '#2a8aff']),
  S('kn_talon_case', 'talon', 'Закалка', 'gold', 'case', ['#3a5f9e', '#c9a13b', '#6f7a86']),
  // скины новых стволов
  S('m4s_printstream', 'm4a1s', 'Принтстрим', 'covert', 'asiimov', ['#f4f4f4', '#d8d8d8', '#111111']),
  S('m4s_hyper', 'm4a1s', 'Гиперзверь', 'covert', 'neon', ['#14081f', '#ff3fb4', '#3cf06a', '#ffe600']),
  S('m4s_guardian', 'm4a1s', 'Страж', 'restricted', 'hex', ['#1d2c3a', '#4aa3ff', '#0f1720']),
  S('ssg_blood', 'ssg08', 'Кровь в воде', 'covert', 'web', ['#2a7aff', '#d01818']),
  S('ssg_dragon', 'ssg08', 'Дракон', 'classified', 'fire', ['#0a1430', '#2a7aff', '#bfe0ff']),
  S('aug_akihabara', 'aug', 'Акихабара', 'covert', 'splat', ['#f2f2f2', '#ff3fb4', '#2bd6ff']),
  S('sg_integrale', 'sg553', 'Интеграл', 'classified', 'stripes', ['#f2c230', '#1b1b1d']),
  S('p90_asiimov', 'p90', 'Азимов', 'classified', 'asiimov', ['#f2f2f2', '#ff6a00', '#1a1a1a']),
  S('ump_primal', 'ump45', 'Хищник', 'restricted', 'tiger', ['#3a6a2a', '#0f1a0a']),
  S('mp7_bloodsport', 'mp7', 'Кровавый спорт', 'classified', 'carbon', ['#16181c', '#e01818', '#22252a']),
  S('nova_hyper', 'nova', 'Гиперзверь', 'restricted', 'neon', ['#14081f', '#ff3fb4', '#3cf06a', '#ffe600']),
  S('xm_tranquil', 'xm1014', 'Спокойствие', 'milspec', 'marble', ['#e8f6ff', '#7cc6ff', '#3a6fb0']),
  S('negev_power', 'negev', 'Энергия', 'milspec', 'digital', ['#2a2a2a', '#ffd23a', '#e8e8e8', '#1a1a1a']),
  S('p250_seeker', 'p250', 'Ищейка', 'restricted', 'hex', ['#1a2a3a', '#2bf3ff', '#0f1720']),
  S('tec9_fuel', 'tec9', 'Топливо', 'milspec', 'stripes', ['#2a2a2a', '#ff6a1a']),
  S('five_hyper', 'fiveseven', 'Гиперзверь', 'restricted', 'neon', ['#14081f', '#ff3fb4', '#3cf06a', '#ffe600']),
  S('scar_cardiac', 'scar20', 'Кардиограмма', 'milspec', 'lightning', ['#1a0505', '#ff3a3a', '#ffffff']),
  S('g3_flux', 'g3sg1', 'Поток', 'milspec', 'fade', ['#2a7aff', '#ff3fb4']),
  // перчатки
  S('gl_sport_vice', 'sport', 'Порок', 'gold', 'stripes', ['#ff3fb4', '#2bd6ff']),
  S('gl_sport_pandora', 'sport', 'Шкатулка Пандоры', 'gold', 'digital', ['#5a2a8a', '#2a0f4a', '#c86aff', '#1a0a2a']),
  S('gl_sport_hedge', 'sport', 'Лабиринт', 'gold', 'hex', ['#2f5a2a', '#c9e05a', '#1a3a14']),
  S('gl_driver_king', 'driver', 'Королевская змея', 'gold', 'hex', ['#c9a13b', '#3a2a0a', '#e8d27a']),
  S('gl_driver_crimson', 'driver', 'Багровое плетение', 'gold', 'web', ['#7a0f12', '#1a0303']),
  S('gl_wraps_slaughter', 'wraps', 'Бойня', 'gold', 'slaughter', ['#d8d0cc', '#a3131c', '#5e0a0f']),
  S('gl_wraps_leather', 'wraps', 'Кожа', 'gold', 'camo', ['#8a6a44', '#5e4428', '#a8865a', '#3a2a18']),
  S('gl_moto_spearmint', 'moto', 'Мята', 'gold', 'stripes', ['#e8f2ee', '#3ac8a0']),
  S('gl_moto_boom', 'moto', 'Бум!', 'gold', 'splat', ['#1a1a1a', '#ffd23a', '#ff3a3a']),
  S('gl_spec_fade', 'specialist', 'Градиент', 'gold', 'fade', ['#ffd000', '#ff3cc8', '#3c64ff']),
  S('gl_spec_crimson', 'specialist', 'Кимоно', 'gold', 'tiger', ['#c21f2a', '#1a0505']),
  // новые скины оружия
  S('ak_vulcan', 'ak47', 'Вулкан', 'covert', 'asiimov', ['#f2f2f2', '#2a7aff', '#111111']),
  S('ak_fire_serp', 'ak47', 'Огненный змей', 'covert', 'fire', ['#14200e', '#ff7a1a', '#ffe14a']),
  S('ak_case', 'ak47', 'Закалка', 'classified', 'case', ['#3a5f9e', '#c9a13b', '#6f7a86']),
  S('m4_poseidon', 'm4a4', 'Посейдон', 'covert', 'marble', ['#0a2a4a', '#2bd6ff', '#e8f6ff']),
  S('m4_desolate', 'm4a4', 'Запустение', 'classified', 'splat', ['#2a2a2a', '#ff6a1a', '#d8d0cc']),
  S('awp_dragon', 'awp', 'Драконья история', 'covert', 'fire', ['#2a0a05', '#e01818', '#ffd23a']),
  S('awp_hyper', 'awp', 'Гипербист', 'classified', 'neon', ['#1a0a26', '#ff3fb4', '#3cf06a', '#ffe600']),
  S('deagle_blaze2', 'deagle', 'Кобальтовое пламя', 'classified', 'fire', ['#06142a', '#2a7aff', '#bfe0ff']),
  S('deagle_printstream', 'deagle', 'Принтстрим', 'covert', 'asiimov', ['#f4f4f4', '#d8d8d8', '#111111']),
  S('usp_orion', 'usp', 'Орион', 'classified', 'lightning', ['#0b1033', '#7ae0ff', '#ffffff']),
  S('glock_water', 'glock', 'Стихия воды', 'restricted', 'marble', ['#0a3a6a', '#2bd6ff', '#ffffff']),
  S('mp9_hydra', 'mp9', 'Гидра', 'classified', 'hex', ['#1d3b16', '#9be22d', '#0f1f0b']),
  S('mac_neon2', 'mac10', 'Неоновый гонщик', 'covert', 'neon', ['#0d0d1a', '#ff2bd6', '#2bf3ff', '#ffe600']),
  S('famas_roll', 'famas', 'Роллкейдж', 'restricted', 'carbon', ['#16181c', '#ff6a1a', '#22252a']),
  S('galil_cerb', 'galil', 'Цербер', 'classified', 'damascus', ['#5a1f12', '#e8b04a', '#2a0a05']),
];
export const KNIVES = {
  karambit: { name: '★ Керамбит' },
  butterfly: { name: '★ Нож-бабочка' },
  bayonet: { name: '★ Штык-нож M9' },
  flip: { name: '★ Складной нож' },
  gut: { name: '★ Нож с лезвием-крюком' },
  huntsman: { name: '★ Охотничий нож' },
  falchion: { name: '★ Фальшион' },
  talon: { name: '★ Нож «Коготь»' },
};
export const GLOVES = {
  sport: { name: '★ Спортивные перчатки' },
  driver: { name: '★ Водительские перчатки' },
  wraps: { name: '★ Обмотки рук' },
  moto: { name: '★ Мотоперчатки' },
  specialist: { name: '★ Перчатки специалиста' },
};
export const skinById = Object.fromEntries(SKINS.map(s => [s.id, s]));
export const weaponName = w => (WEAPONS[w] && WEAPONS[w].name) || (KNIVES[w] && KNIVES[w].name) || (GLOVES[w] && GLOVES[w].name) || w;

export const CASES = [
  { id: 'dust', name: 'Кейс «Пустынный шторм»', price: 250, col: ['#c9893a', '#6b3f12'], emblem: 'sun',
    items: ['ak_sand', 'ak_redline', 'm4_desert', 'awp_dune', 'glock_sand', 'deagle_blaze', 'mp9_scorched', 'galil_sandstorm', 'usp_guardian', 'famas_dune', 'kn_bfly_tiger', 'kn_kar_jungle'] },
  { id: 'neon', name: 'Кейс «Неон»', price: 400, col: ['#c222c8', '#1e0b3a'], emblem: 'bolt',
    items: ['ak_neon', 'm4_cyber', 'awp_neonoir', 'glock_vapor', 'usp_neon', 'mac_neon', 'mp9_hyper', 'famas_pulse', 'deagle_glow', 'kn_bay_neon', 'kn_kar_fade'] },
  { id: 'predator', name: 'Кейс «Хищник»', price: 350, col: ['#3f7a1e', '#0f1f08'], emblem: 'claw',
    items: ['ak_jungle', 'm4_howl', 'awp_asiimov', 'galil_viper', 'glock_fade', 'mac_croc', 'usp_kill', 'deagle_predator', 'mp9_viper', 'kn_bay_crimson', 'kn_bfly_tiger'] },
  { id: 'ice', name: 'Кейс «Ледяной»', price: 300, col: ['#3b8fd9', '#0b2244'], emblem: 'flake',
    items: ['ak_ice', 'm4_frost', 'awp_lightning', 'glock_arctic', 'usp_frozen', 'famas_ice', 'deagle_cobalt', 'mac_blizzard', 'galil_glacier', 'kn_bfly_ice', 'kn_kar_doppler'] },
  { id: 'gloves', name: 'Кейс «Перчатки»', price: 600, col: ['#7a7f87', '#1d2128'], emblem: 'glove',
    items: ['glock_water', 'famas_roll', 'mp9_hydra', 'usp_orion', 'm4_desolate', 'ak_case', 'deagle_printstream', 'gl_sport_vice', 'gl_sport_pandora', 'gl_sport_hedge', 'gl_driver_king', 'gl_driver_crimson', 'gl_wraps_slaughter', 'gl_wraps_leather', 'gl_moto_spearmint', 'gl_moto_boom', 'gl_spec_fade', 'gl_spec_crimson'] },
  { id: 'blades', name: 'Кейс «Клинки»', price: 500, col: ['#b02a2a', '#2a0a0a'], emblem: 'blade',
    items: ['famas_roll', 'glock_water', 'galil_cerb', 'deagle_blaze2', 'awp_hyper', 'mac_neon2', 'ak_vulcan', 'awp_dragon', 'kn_flip_fade', 'kn_flip_night', 'kn_flip_doppler', 'kn_gut_tiger', 'kn_gut_case', 'kn_hunt_web', 'kn_hunt_slaughter', 'kn_falc_marble', 'kn_falc_uv', 'kn_talon_doppler', 'kn_talon_case', 'kn_kar_case', 'kn_kar_gamma', 'kn_bay_slaughter', 'kn_bfly_damascus'] },
  { id: 'arsenal', name: 'Кейс «Арсенал»', price: 400, col: ['#5a6470', '#151a20'], emblem: 'bolt',
    items: ['xm_tranquil', 'negev_power', 'tec9_fuel', 'scar_cardiac', 'g3_flux', 'm4s_guardian', 'ump_primal', 'p250_seeker', 'five_hyper', 'nova_hyper', 'sg_integrale', 'p90_asiimov', 'mp7_bloodsport', 'ssg_dragon', 'm4s_printstream', 'm4s_hyper', 'ssg_blood', 'aug_akihabara', 'kn_flip_fade', 'kn_talon_case', 'gl_moto_spearmint'] },
  { id: 'serpent', name: 'Кейс «Змей»', price: 450, col: ['#2a8a3a', '#0a2a10'], emblem: 'claw',
    items: ['glock_water', 'famas_roll', 'mp9_hydra', 'usp_orion', 'galil_cerb', 'm4_desolate', 'ak_case', 'awp_hyper', 'ak_fire_serp', 'm4_poseidon', 'deagle_printstream', 'kn_kar_gamma', 'kn_flip_doppler', 'kn_gut_tiger', 'gl_driver_king', 'gl_sport_hedge'] },
];

// Агенты: head — головной убор
export const AGENTS = [
  { id: 't_phoenix', team: 'T', name: 'Феникс | Боец', c: { shirt: '#6a5638', pants: '#3f3a31', vest: '#2a2a28', skin: '#c69a72', glove: '#1e1e1e', head: '#1a1a1a', accent: '#8a1f1f', boots: '#2a2018' }, head: 'balaclava' },
  { id: 't_elite', team: 'T', name: 'Элитный отряд | Медик', c: { shirt: '#3d5a3a', pants: '#2f3b2a', vest: '#5a4b33', skin: '#b98a62', glove: '#3a2c1c', head: '#7a2222', accent: '#d9b44a', boots: '#241c13' }, head: 'bandana' },
  { id: 't_pirate', team: 'T', name: 'Пират | Капитан', c: { shirt: '#7a2e2e', pants: '#2b2b3b', vest: '#3b2a1a', skin: '#d0a07a', glove: '#2a1a0a', head: '#222222', accent: '#e0c060', boots: '#1a1410' }, head: 'cap' },
  { id: 't_balkan', team: 'T', name: 'Балканец | Драган', c: { shirt: '#4a4f57', pants: '#2c2f35', vest: '#1f2a1f', skin: '#d6a985', glove: '#151515', head: '#3a3f2f', accent: '#b0b0b0', boots: '#151515' }, head: 'beanie' },
  { id: 't_guerilla', team: 'T', name: 'Партизан | Ловкач', c: { shirt: '#56603a', pants: '#3e4630', vest: '#2a301f', skin: '#8d5f3e', glove: '#1a1a12', head: '#2e331f', accent: '#c47a2c', boots: '#20180f' }, head: 'gasmask' },
  { id: 'ct_sas', team: 'CT', name: 'SAS | Штурмовик', c: { shirt: '#2e3236', pants: '#25292d', vest: '#1a1d20', skin: '#d8ad8a', glove: '#111111', head: '#15181b', accent: '#5a6a7a', boots: '#101112' }, head: 'gasmask' },
  { id: 'ct_fbi', team: 'CT', name: 'ФБР | Спецагент', c: { shirt: '#2a3a55', pants: '#2a2e38', vest: '#1c2433', skin: '#c9966d', glove: '#141414', head: '#1c2433', accent: '#e8d24a', boots: '#121212' }, head: 'helmet' },
  { id: 'ct_gign', team: 'CT', name: 'GIGN | Жандарм', c: { shirt: '#30394a', pants: '#283040', vest: '#222a38', skin: '#e0b896', glove: '#1a1a1a', head: '#2a3346', accent: '#8fb0d0', boots: '#151820' }, head: 'visor' },
  { id: 'ct_seal', team: 'CT', name: 'SEAL | Ветеран', c: { shirt: '#5a5f45', pants: '#4a4e3a', vest: '#6b6447', skin: '#b48460', glove: '#3a3424', head: '#4e533a', accent: '#2a2a2a', boots: '#2a2418' }, head: 'goggles' },
  { id: 'ct_swat', team: 'CT', name: 'SWAT | Командир', c: { shirt: '#1f2328', pants: '#1c1f24', vest: '#2b3138', skin: '#d1a37f', glove: '#0f0f0f', head: '#222830', accent: '#4a90d9', boots: '#0d0e10' }, head: 'helmet' },
];
export const agentById = Object.fromEntries(AGENTS.map(a => [a.id, a]));

// Боты: 0 — без ботов (тренировка)
export const DIFFICULTIES = [
  { id: 'none', name: 'Без ботов', short: 'Без', desc: 'Свободная тренировка: карта, раскидка, стрельба', reward: 0 },
  { id: 'harmless', name: 'Безобидные', short: 'Безоб.', desc: 'Почти не стреляют', reward: 0.3,
    react: 1.3, aim: 0.13, turn: 2.2, fire: 0.35, head: 0.0, nades: 0, strafe: 0, burst: 2, comp: 0, spot: 0.5 },
  { id: 'easy', name: 'Лёгкие', short: 'Лёгк.', desc: 'Медленная реакция, мажут', reward: 0.6,
    react: 0.75, aim: 0.075, turn: 3.5, fire: 0.8, head: 0.1, nades: 0.1, strafe: 0, burst: 4, comp: 0.2, spot: 0.7 },
  { id: 'medium', name: 'Средние', short: 'Средн.', desc: 'Нормальные противники, иногда кидают гранаты', reward: 1,
    react: 0.45, aim: 0.045, turn: 5.5, fire: 1, head: 0.25, nades: 0.45, strafe: 0.3, burst: 6, comp: 0.45, spot: 0.85 },
  { id: 'hard', name: 'Сложные', short: 'Сложн.', desc: 'Быстрые, знают раскидку', reward: 1.5,
    react: 0.28, aim: 0.025, turn: 8, fire: 1, head: 0.5, nades: 0.85, strafe: 0.7, burst: 8, comp: 0.7, spot: 1 },
  { id: 'esports', name: 'Киберспорт', short: 'Кибер', desc: 'Идеальная раскидка, префаеры, хедшоты', reward: 2.2,
    react: 0.16, aim: 0.012, turn: 12, fire: 1, head: 0.8, nades: 1, strafe: 1, burst: 10, comp: 0.92, spot: 1.15 },
];

// Граффити (спреи): рисуются процедурно в art.js
export const GRAFFITI = [
  { id: 'cfs', name: 'CFS', col: '#ff8a1a' },
  { id: 'gg', name: 'GG', col: '#3cf06a' },
  { id: 'ez', name: 'EZ', col: '#ff3fb4' },
  { id: 'skull', name: 'Череп', col: '#f2f2f2' },
  { id: 'heart', name: 'Сердце', col: '#ff3048' },
  { id: 'crown', name: 'Корона', col: '#ffd23a' },
  { id: 'smile', name: 'Смайл', col: '#ffe14a' },
  { id: 'fire', name: 'Огонь', col: '#ff6a1a' },
  { id: 'hs', name: 'Хедшот', col: '#ff2a2a' },
  { id: 'nice', name: 'NICE', col: '#3cc8ff' },
];

// «Гонка вооружений»: за каждое убийство — следующее оружие, последний уровень — нож
export const AR_LADDER = ['m4a1s', 'ak47', 'aug', 'sg553', 'famas', 'galil', 'p90', 'mp7', 'ump45', 'mac10', 'xm1014', 'nova', 'negev', 'awp', 'ssg08', 'deagle', 'fiveseven', 'tec9', 'p250', 'glock', 'knife'];
