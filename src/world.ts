import { LEVELS, WEAPONS } from './data';
import { createEntity, nextId } from './entities';
import { random } from './math';
import type { EnemyId, Entity, Mode, WeaponId, World } from './types';

const weaponList: WeaponId[] = ['baton', 'staff', 'hammer', 'blades', 'discs'];
/** 每关固定地形配合受约束随机内容。所有战斗生成点均落在主线地基内。 */
export function createWorld(mode: Mode, level = 0, seed = Date.now() >>> 0): World {
  const def = LEVELS[level], rng = random(seed + level * 821);
  const w: World = { mode, level, width: mode === 'campaign' ? def.width : 1640, region: mode === 'campaign' ? def.region : mode === 'arena' ? 1 : 0, time: 0, platforms: [], enemies: [], drops: [], projectiles: [], crates: [], hazards: [], gates: [], particles: [], skillEffects: [], activeGate: null, exitOpen: false, wave: mode === 'arena' ? 1 : 0, seed };
  if (mode !== 'campaign') {
    w.platforms = [ { x: 0, y: 620, w: 1640, h: 250, oneWay: false }, { x: 150, y: 475, w: 280, h: 18, oneWay: true }, { x: 660, y: 450, w: 320, h: 18, oneWay: true }, { x: 1220, y: 475, w: 260, h: 18, oneWay: true } ];
    if (mode === 'training') { w.enemies.push(createEntity('dummy', 820), createEntity('fighter', 1190)); w.enemies[1].aiTimer = 4; }
    else spawnArena(w);
    addDrop(w, 470, 620, 'baton'); addDrop(w, 1070, 620, 'staff');
    w.crates.push({ id: nextId(), x: 590, y: 620, hp: 30, reward: false, opened: false });
    return w;
  }
  // 两个可跨越的主线缺口；额外平台给出明显的上行奖励支路。
  const gaps = level < 2 ? [[1720, 1850], [3320, 3480]] : [[1690, 1850], [3280, 3460]];
  let start = 0;
  for (const [a, b] of gaps) { w.platforms.push({ x: start, y: 620, w: a - start, h: 300, oneWay: false }); start = b; }
  w.platforms.push({ x: start, y: 620, w: w.width - start, h: 300, oneWay: false });
  const platforms = [ [410, 505, 240], [710, 405, 245], [1260, 495, 250], [1600, 470, 340], [2070, 510, 260], [2360, 405, 260], [2900, 500, 240], [3190, 460, 360], [3680, 505, 270], [3970, 405, 240], [4590, 495, 270] ];
  for (const [x, y, width] of platforms) w.platforms.push({ x, y: y + (def.region === 2 ? -20 : 0), w: width, h: def.region === 1 ? 24 : 18, oneWay: true, conveyor: def.region === 1 && x === 2070 ? 65 : 0 });
  // 第三关以后加入电弧/冲压；预警期、有效期和休眠期各自明确。
  if (level >= 2) for (const x of [2030, 3610]) w.hazards.push({ x, y: 620, w: 100, phase: rng() * 3, period: 4.8, kind: def.region === 1 ? 'press' : 'electric' });
  if (def.region === 2) w.hazards.push({ x: 3190, y: 460, w: 360, phase: 0, period: 6, kind: 'wind' });
  const gates = [1120, 2690, w.width - 650];
  gates.forEach((x, i) => w.gates.push({ x, left: x - 420, right: x + 460, triggered: false, cleared: false, enemies: [], wave: i, round: 0, rounds: i === 2 && def.boss ? 1 : 3 }));
  for (const x of [340, 1510, 2210, 3040, 3770, 4470]) w.crates.push({ id: nextId(), x, y: 620, hp: 30, reward: false, opened: false });
  for (const [x, y] of [[825, 405], [2475, 405], [4080, 405]]) w.crates.push({ id: nextId(), x, y: y + (def.region === 2 ? -20 : 0), hp: 20, reward: true, opened: false });
  addDrop(w, 525, 505, weaponList[Math.floor(rng() * 5)]);
  addDrop(w, 1540, 620, weaponList[(level + 1) % 5]);
  addDrop(w, 2960, 500, weaponList[Math.floor(rng() * 5)]);
  return w;
}

export function addDrop(w: World, x: number, y: number, weapon: WeaponId, durability = WEAPONS[weapon].durability) {
  w.drops.push({ id: nextId(), x, y, vy: 0, weapon, durability, lock: .3 });
}
export function spawnGate(w: World, index: number, reinforcement = false) {
  const g = w.gates[index]; if (!g || g.triggered && !reinforcement) return;
  g.triggered = true; g.round++; w.activeGate = g;
  const def = LEVELS[w.level];
  if (index === 2 && def.boss) {
    const boss = createEntity(def.boss, g.x + 240); w.enemies.push(boss); g.enemies.push(boss.id); return;
  }
  const rng = random(w.seed + w.level * 471 + index * 782 + g.round * 131);
  const pool: EnemyId[] = w.level === 0 ? ['fighter', 'fighter', 'assassin', 'thrower'] : w.level < 3 ? ['fighter', 'assassin', 'brute', 'lancer', 'thrower', 'shield'] : ['fighter', 'assassin', 'brute', 'lancer', 'thrower', 'shield', 'support'];
  const count = 4 + Math.floor(w.level / 2) + (index === 1 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const type = pool[Math.floor(rng() * pool.length)];
    const elite = index === 2 && i === 0;
    const x = reinforcement ? (i % 2 === 0 ? g.left + 55 + i * 20 : g.right - 55 - i * 20) : g.x - 240 + i * 105;
    const e = createEntity(type, x, 620, false, elite);
    e.aiTimer = (reinforcement ? 1.4 : .6) + i * .28; e.hp *= 1 + w.level * .06; e.maxHp = e.hp;
    w.enemies.push(e); g.enemies.push(e.id);
  }
}
export function spawnArena(w: World) {
  const rng = random(w.seed + w.wave * 413);
  const pool: EnemyId[] = ['fighter', 'assassin', 'thrower', 'lancer', 'shield', 'brute', 'support'];
  const count = Math.min(11, 3 + Math.floor(w.wave * .75));
  for (let i = 0; i < count; i++) {
    const type = w.wave % 5 === 0 && i === 0 ? (w.wave % 10 === 0 ? 'commander' : 'gatekeeper') : pool[Math.floor(rng() * Math.min(pool.length, 2 + w.wave))];
    const e = createEntity(type, i % 2 === 0 ? 100 + i * 35 : 1490 - i * 35, 620, false, i === 1 && w.wave > 3);
    e.hp *= 1 + w.wave * .06; e.maxHp = e.hp; e.aiTimer = 1 + i * .25; w.enemies.push(e);
  }
}

export function recoverFallen(w: World, e: Entity) {
  const platform = w.platforms.filter(p => !p.oneWay && e.x >= p.x - 240 && e.x <= p.x + p.w + 240).sort((a, b) => Math.abs(e.x - (a.x + a.w / 2)) - Math.abs(e.x - (b.x + b.w / 2)))[0];
  if (platform) e.x = Math.max(platform.x + 45, Math.min(platform.x + platform.w - 45, e.prevX));
  else e.x = 180;
  e.y = 540; e.vx = 0; e.vy = 0; e.invuln = 1.5; e.attack = null; e.state = 'jump';
}
