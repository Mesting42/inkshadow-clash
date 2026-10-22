import { ATTACKS, LIGHTS, SKILLS, WEAPONS } from './data';
import { nextId, setState } from './entities';
import type { AttackDef, AttackKind, Entity, GameEvents } from './types';

/** 取消只在有效帧结束后的收招窗口开放；重击保留至少 60% 收招。 */
export function canAct(e: Entity, dodge = false) {
  if (['dead', 'hurt', 'down', 'rise', 'pickup', 'victory'].includes(e.state)) return false;
  if (e.state === 'dodge') return false;
  if (!e.attack) return true;
  const a = e.attack;
  return a.time >= a.def.startup + a.def.active + a.def.recovery * (dodge ? .28 : .6);
}
export function startAttack(e: Entity, source: AttackDef, events?: GameEvents) {
  if (e.energy < source.cost) return false;
  e.energy -= source.cost;
  e.attack = { def: { ...source }, time: 0, hit: new Set(), procs: new Set(), serial: nextId(), fired: false };
  setState(e, 'attack');
  events?.sound(source.kind === 'heavy' || source.slam ? 'heavy' : e.weapon === 'fist' ? 'swing' : e.weapon);
  return true;
}
export function attackPlayer(e: Entity, kind: AttackKind, time: number, events: GameEvents) {
  if (!canAct(e)) return false;
  if (!e.grounded && kind === 'light') kind = 'air';
  if (kind === 'air' && e.airHits >= (e.weapon === 'blades' ? 4 : 3)) return false;
  let d: AttackDef;
  if (kind === 'light') {
    e.combo = time < e.comboUntil ? (e.combo + 1) % 4 : 0;
    e.comboUntil = time + .78; d = { ...LIGHTS[e.combo] };
    if (e.combo === 3 && e.perks.finisher) { d.reach += 45 * e.perks.finisher; d.knock *= 1 + .35 * e.perks.finisher; }
  } else if (kind === 'skill') {
    if (e.skillCooldown > 0) return false;
    if (e.skill === 'quake' && !e.grounded) return false;
    d = { ...SKILLS[e.skill].attack };
  } else d = { ...ATTACKS[kind as keyof typeof ATTACKS] };
  if (!d) return false;
  if (kind !== 'skill') {
    const w = WEAPONS[e.weapon]; d.startup *= w.speed; d.recovery *= w.speed;
    d.reach += w.reach; d.damage *= w.power;
    if (e.weapon === 'hammer') { d.knock *= 1.35; d.guardBreak = true; }
    if (e.weapon === 'discs' && kind !== 'slam' && kind !== 'launch') { d.projectile = true; d.reach = 75; }
    if (e.weapon === 'staff') d.startup += .035;
  }
  if (kind === 'slam' && e.grounded) return false;
  if (kind === 'slam' && e.perks.aerial) d.damage += Math.min(25, e.aerialCharge * 5) * e.perks.aerial;
  if (!startAttack(e, d, events)) return false;
  if (kind === 'air') { e.airHits++; e.vy = Math.min(e.vy, -105); }
  if (kind === 'slam') { e.vy = 850; e.vx *= .3; e.aerialCharge = 0; }
  if (kind === 'skill') e.skillCooldown = SKILLS[e.skill].cooldown;
  return true;
}
export function dodge(e: Entity, events: GameEvents) {
  if (!canAct(e, true) || e.dodgeCooldown > 0 || e.energy < 20) return false;
  e.energy -= 20; e.attack = null; e.dodgeCooldown = e.perks.bare && e.weapon === 'fist' ? .52 : .72;
  e.invuln = .24; e.vx = e.facing * 750; setState(e, 'dodge'); events.sound('dodge'); return true;
}
export function tickEntity(e: Entity, dt: number) {
  e.stateTime += dt;
  for (const field of ['invuln', 'cooldown', 'dodgeCooldown', 'skillCooldown', 'jumpBuffer', 'dropTime', 'flash', 'buff', 'controlReset'] as const) e[field] = Math.max(0, e[field] - dt);
  if (e.controlReset === 0) e.control = 0;
  if (!['attack', 'block', 'dodge', 'dead'].includes(e.state)) e.energy = Math.min(e.maxEnergy, e.energy + 23 * dt);
  if (e.state === 'block') e.blockTime += dt;
  if (e.state === 'attack' && e.attack) {
    const a = e.attack;
    // 下砸在落地之前停留于预备末尾，地面冲击不会在空中凭空生效。
    if (a.def.slam && !e.grounded) a.time = Math.min(a.def.startup - .001, a.time + dt);
    else a.time += dt;
    if (a.def.dash && a.time >= a.def.startup && a.time < a.def.startup + a.def.active) {
      e.vx = e.facing * a.def.dash;
      if (e.team === 'player') e.invuln = Math.max(e.invuln, .04);
    }
    if (a.def.dash && a.time >= a.def.startup + a.def.active) e.vx *= Math.max(0, 1 - dt * 16);
    if (a.time >= a.def.startup + a.def.active + a.def.recovery) { e.attack = null; setState(e, e.grounded ? 'idle' : 'jump'); }
  }
  if (e.state === 'dodge' && e.stateTime > .29) { e.vx *= .35; setState(e, e.grounded ? 'idle' : 'jump'); }
  if (e.state === 'hurt' && e.stateTime > e.intent) { setState(e, e.grounded ? 'idle' : 'jump'); }
  if (e.state === 'down' && e.grounded && e.stateTime > .65) { e.invuln = .65 + (e.perks.rise ? .7 : 0); setState(e, 'rise'); }
  if (e.state === 'rise' && e.stateTime > .34) { if (e.perks.rise) e.hp = Math.min(e.maxHp, e.hp + 8); setState(e, 'idle'); }
  if (e.state === 'pickup' && e.stateTime > .23) setState(e, 'idle');
  if (e.state === 'dead') e.deadTime += dt;
}
