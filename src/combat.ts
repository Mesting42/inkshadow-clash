import { ENEMIES, WEAPONS } from './data';
import { nextId, setState } from './entities';
import { clamp, segmentCircle } from './math';
import { spawnSkillEffect } from './skill-vfx';
import type { AttackDef, Entity, GameEvents, World } from './types';

/** 朝向判定取攻击来源位置；无敌免伤，霸体仍受伤但不被普通击打打断。 */
export function damage(source: Entity | null, target: Entity, d: AttackDef, events: GameEvents, sourceX?: number) {
  if (target.hp <= 0 || target.state === 'down' || target.state === 'rise') return false;
  if (target.invuln > 0) {
    if (target.state === 'dodge' && target.perks.evade && source) target.buff = 3;
    return false;
  }
  const sx = sourceX ?? source?.x ?? target.x - target.facing;
  const direction = Math.sign(target.x - sx) || source?.facing || 1;
  const front = (sx - target.x) * target.facing >= -4;
  const guarding = front && (target.state === 'block' || (target.type === 'shield' && target.state !== 'hurt' && target.state !== 'attack'));
  if (guarding && !d.unblockable) {
    if (target.state === 'block' && target.blockTime <= .16 && target.energy >= 4) {
      target.energy = Math.min(100, target.energy + 18); target.invuln = .22;
      target.parryPower = 12 + (target.perks.parry || 0) * 24;
      if (source) { source.attack = null; source.intent = source.boss ? .45 : .8; setState(source, 'hurt'); }
      events.sound('parry'); events.effect(target.x, target.y - 48, '#b5e7df', 18); events.text(target.x, target.y - 110, '精准防御', '#afe6d9'); events.impact(.25);
      return false;
    }
    const cost = d.damage * 1.3;
    if (!d.guardBreak && target.energy > cost) {
      target.energy -= cost; target.hp = Math.max(1, target.hp - d.damage * .12); target.vx = direction * 80;
      events.sound('block'); events.effect(target.x + target.facing * 20, target.y - 45, '#c8d9dd', 5); return false;
    }
    target.energy = Math.max(0, target.energy - cost);
    events.text(target.x, target.y - 110, '破防', '#f6c288'); events.sound('break');
    if (source?.perks.breakflow && d.kind === 'heavy' && source.attack && !source.attack.procs.has('breakflow')) {
      source.energy = Math.min(100, source.energy + 12 * source.perks.breakflow); source.attack.procs.add('breakflow');
    }
  }
  let amount = d.damage;
  if (source?.team === 'player') {
    if (source.buff > 0) amount *= 1.2;
    if (source.perks.edge && source.weapon !== 'fist' && source.durability < WEAPONS[source.weapon].durability / 3) amount *= 1.25;
    amount += source.parryPower; source.parryPower = 0;
  }
  if (target.type === 'brute' && target.state === 'attack' && !d.guardBreak) amount *= .65;
  const absorbed = Math.min(target.shield, amount); target.shield -= absorbed; amount -= absorbed;
  target.hp = Math.max(0, target.hp - amount); target.flash = .12;
  const armor = target.boss && target.state === 'attack' || target.type === 'brute' && target.state === 'attack' && !d.guardBreak;
  if (!armor) {
    target.attack = null;
    target.vx = direction * d.knock * (target.boss ? .2 : 1);
    // 重复浮空衰减至 25%；Boss 有硬性浮空抗性，避免无限空连。
    const reduction = Math.max(.25, 1 - target.juggle * .23);
    if (d.lift && !target.boss) { target.vy = d.lift * reduction; target.grounded = false; target.juggle++; }
    target.intent = d.stun * (target.boss ? .42 : 1); setState(target, d.knock > 390 && !target.boss && !d.lift ? 'down' : 'hurt');
    if (target.team === 'player') {
      target.control++; target.controlReset = 1.4;
      // 连续承受两次控制后提供保护；清除过期输入由主循环在受击时执行。
      target.invuln = target.control >= 2 ? .9 : .22;
    }
  }
  events.effect(target.x - direction * 12, target.y - 48, source?.team === 'player' ? '#f5d3a0' : '#eb8172', d.damage > 25 ? 13 : 7);
  events.sound(d.guardBreak ? 'impactHeavy' : 'hit', clamp(d.damage / 25, .3, 1.5));
  events.impact(target.team === 'player' ? .55 : .22);
  if (source) events.hit(source, target, Math.round(amount));
  if (target.hp <= 0) {
    target.attack = null; target.invuln = 0; setState(target, 'dead'); target.vx = direction * Math.min(430, d.knock); target.vy = -220; target.grounded = false;
    events.kill(target, source || undefined);
  }
  return true;
}

export function inAttackRange(source: Entity, target: Entity, d: AttackDef) {
  const dx = target.x - source.x;
  const dy = Math.abs((target.y - 43) - (source.y - 43));
  return dy < d.height && (d.radial ? Math.abs(dx) < d.reach + 18 : dx * source.facing > -8 && dx * source.facing < d.reach + 18);
}

export function combatStep(world: World, player: Entity, events: GameEvents) {
  const all = [player, ...world.enemies];
  for (const e of all) {
    const a = e.attack;
    if (!a || e.hp <= 0 || a.time < a.def.startup || a.time >= a.def.startup + a.def.active) continue;
    const d = a.def;
    if (d.kind === 'skill' && e.team === 'player' && !a.procs.has('skill-vfx')) {
      a.procs.add('skill-vfx'); spawnSkillEffect(world, e); events.sound(`skill-${e.skill}`);
    }
    if (d.projectile && !a.fired) {
      a.fired = true;
      world.projectiles.push({ id: nextId(), owner: e.id, team: e.team, x: e.x + e.facing * 25, y: e.y - 52, vx: e.facing * 590, vy: -70, damage: d.damage, life: 2.2, weapon: e.weapon, hit: new Set() });
      if (e.team === 'player' && e.weapon !== 'fist') useDurability(e, events);
    }
    if (d.projectile) continue;
    let connected = false;
    for (const target of all) {
      if (target.team === e.team || target.hp <= 0 || a.hit.has(target.id) || !inAttackRange(e, target, d)) continue;
      a.hit.add(target.id);
      if (damage(e, target, d, events)) connected = true;
    }
    for (const c of world.crates) {
      if (c.opened || a.hit.has(c.id)) continue;
      if (Math.abs(c.y - e.y) > 95 || (!d.radial && (c.x - e.x) * e.facing < -10) || Math.abs(c.x - e.x) > d.reach + 25) continue;
      a.hit.add(c.id); c.hp -= d.damage; connected = true;
      events.effect(c.x, c.y - 25, '#c4a17c', 9); events.sound('crate');
    }
    if (connected && e.team === 'player' && !a.fired) {
      a.fired = true; if (e.weapon !== 'fist' && d.kind !== 'skill') useDurability(e, events);
    }
  }
}

export function useDurability(e: Entity, events: GameEvents) {
  e.durability--;
  if (e.durability <= 0) { events.text(e.x, e.y - 112, '武器耗尽 · 回归拳脚'); events.sound('break'); events.effect(e.x, e.y - 45, WEAPONS[e.weapon].color, 16); e.weapon = 'fist'; e.durability = 0; }
}

export function updateProjectiles(world: World, player: Entity, dt: number, events: GameEvents) {
  const all = [player, ...world.enemies];
  for (const p of world.projectiles) {
    const x = p.x, y = p.y;
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt;
    const source = all.find(e => e.id === p.owner) || null;
    for (const t of all) {
      if (t.team === p.team || t.hp <= 0 || p.hit.has(t.id)) continue;
      if (!segmentCircle(x, y, p.x, p.y, t.x, t.y - 42, 36)) continue;
      p.hit.add(t.id);
      const d: AttackDef = { name: '飞掷', kind: 'enemy', startup: 0, active: .1, recovery: .1, damage: p.damage, reach: 10, height: 70, knock: 240, lift: -110, stun: .3, cost: 0 };
      damage(source, t, d, events, x);
      if (source?.perks.throwflow) source.skillCooldown = Math.max(0, source.skillCooldown - 1.5 * source.perks.throwflow);
      p.life = 0; break;
    }
    for (const platform of world.platforms) if (p.x > platform.x && p.x < platform.x + platform.w && y < platform.y && p.y >= platform.y) { p.life = 0; break; }
    if (p.life <= 0 && p.weapon !== 'discs' && p.team === 'player') world.drops.push({ id: nextId(), x: p.x, y: Math.min(p.y, 590), vy: 0, weapon: p.weapon, durability: Math.max(1, (p.durability ?? 13) - 1), lock: .5 });
  }
  world.projectiles = world.projectiles.filter(p => p.life > 0 && p.x > 0 && p.x < world.width && p.y < 900).slice(-50);
}
