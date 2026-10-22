import { ENEMIES, WEAPONS } from './data';
import type { EnemyId, Entity } from './types';
let serial = 1;
export const nextId = () => serial++;
/** 初始化集中于工厂；重开关卡产生全新实体，绝不复用旧攻击命中集合。 */
export function createEntity(type: EnemyId, x: number, y = 620, player = false, elite = false): Entity {
  const d = ENEMIES[type];
  const boss = ['gatekeeper', 'commander', 'shadowlord'].includes(type);
  const hp = player ? 160 : d.hp * (elite ? 1.7 : 1);
  return {
    id: nextId(), team: player ? 'player' : 'enemy', type, x, y, prevX: x, prevY: y,
    vx: 0, vy: 0, facing: player ? 1 : -1, grounded: true,
    hp, maxHp: hp, energy: 100, maxEnergy: 100, shield: 0,
    state: 'idle', stateTime: 0, attack: null, combo: 0, comboUntil: 0,
    weapon: player ? 'fist' : d.weapon, durability: WEAPONS[d.weapon].durability,
    skill: 'palm', perks: {}, invuln: 0, cooldown: 0, dodgeCooldown: 0, skillCooldown: 0,
    blockTime: 10, coyote: .1, jumpBuffer: 0, dropTime: 0, airJumps: 0, airHits: 0, aerialCharge: 0,
    juggle: 0, control: 0, controlReset: 0, aiTimer: .7, intent: 0, attackIndex: 0, phase: 1,
    boss, elite, deadTime: 0, flash: 0, buff: 0, parryPower: 0, revive: 0,
  };
}
export function setState(e: Entity, state: Entity['state']) { e.state = state; e.stateTime = 0; }
export function maxHealth(e: Entity) { return 160 + (e.perks.heart || 0) * 20; }
