import { ENEMIES } from './data';
import { createEntity, setState } from './entities';
import { startAttack } from './actions';
import { approach, clamp } from './math';
import { floorAt } from './movement';
import type { AttackDef, Entity, GameEvents, World } from './types';

function bossAttack(e: Entity, p: Entity, events: GameEvents): AttackDef {
  const data = ENEMIES[e.type];
  // 招式序号与受击硬直时长分离，精准防御不能把轮转序号改成小数。
  const style = e.attackIndex++ % (e.phase > 1 ? 4 : 3);
  const d: AttackDef = { name: '重拳', kind: 'enemy', startup: data.delay, active: .18, recovery: .85, damage: data.damage, reach: data.reach, height: 95, knock: 400, lift: -170, stun: .4, cost: 0, guardBreak: true };
  if (e.type === 'gatekeeper') {
    if (style === 1) Object.assign(d, { name: '铁肩冲锋', startup: .85, active: .45, recovery: 1.1, dash: 580, damage: 26, reach: 105, unblockable: true });
    if (style >= 2) Object.assign(d, { name: '裂地震荡', startup: 1.05, active: .23, recovery: 1.2, radial: true, reach: 255, height: 45, damage: 28, unblockable: true, lift: -390 });
  } else if (e.type === 'commander') {
    if (style === 0) Object.assign(d, { name: '长锋突刺', startup: .7, reach: 245, dash: 180 });
    if (style === 1) Object.assign(d, { name: '回身扫阵', startup: .9, active: .36, radial: true, reach: 185, height: 95, knock: 520 });
    if (style >= 2) { Object.assign(d, { name: '跃空落枪', startup: .9, active: .28, recovery: 1.05, reach: 155, height: 150, radial: true, unblockable: true, lift: -350 }); if (e.grounded) { e.vy = -470; e.grounded = false; e.vx = clamp(p.x - e.x, -300, 300); } }
  } else {
    if (style === 0) Object.assign(d, { name: '残影连斩', startup: .55, active: .38, recovery: .66, dash: 330, reach: 125, damage: 25 });
    if (style === 1) Object.assign(d, { name: '穿影突袭', startup: .8, active: .28, recovery: .9, dash: 850, reach: 120, unblockable: true, damage: 30 });
    if (style >= 2) { Object.assign(d, { name: '空坠刃环', startup: .95, active: .3, recovery: .95, radial: true, reach: 200, height: 150, damage: 27 }); if (e.grounded) { e.vy = -520; e.grounded = false; e.vx = clamp(p.x - e.x, -260, 260); } }
  }
  if (e.phase >= 2) { d.startup *= .85; d.recovery *= .88; }
  events.text(e.x, e.y - 145, d.name, d.unblockable ? '#ef8c82' : '#e8c38e');
  return d;
}

/** 普通敌人只允许两个同时准备/发起近战攻击，其他敌人保持包围间距。 */
export function updateAI(w: World, player: Entity, dt: number, events: GameEvents) {
  let attackers = w.enemies.filter(e => e.state === 'attack' && e.type !== 'thrower').length;
  for (const e of w.enemies) {
    if (e.type === 'dummy' || e.hp <= 0) continue;
    if (e.state === 'dodge') continue;
    if (['hurt', 'down', 'rise', 'dead', 'pickup'].includes(e.state)) { e.vx = approach(e.vx, 0, 800 * dt); continue; }
    if (e.state === 'attack') {
      if (!e.attack?.def.dash) e.vx = approach(e.vx, 0, 850 * dt);
      continue;
    }
    if (player.hp <= 0 || ['down', 'rise', 'victory'].includes(player.state)) { e.vx = approach(e.vx, 0, 1600 * dt); continue; }
    const data = ENEMIES[e.type], dx = player.x - e.x, dy = player.y - e.y, distance = Math.abs(dx);
    e.aiTimer -= dt;
    e.facing = Math.sign(dx) || e.facing;
    if (e.boss) {
      const phase = e.hp < e.maxHp * .32 && e.type === 'shadowlord' ? 3 : e.hp < e.maxHp * .58 ? 2 : 1;
      if (phase > e.phase) {
        e.phase = phase; e.invuln = .75; e.aiTimer = .9;
        events.sound('phase'); events.text(e.x, e.y - 160, phase === 3 ? '终式 · 影尽' : '第二阶段', data.color); events.effect(e.x, e.y - 40, data.color, 28);
        if (e.type === 'shadowlord') for (const offset of [-210, 210]) { const minion = createEntity('assassin', clamp(e.x + offset, 50, w.width - 50)); minion.aiTimer = 1.8; w.enemies.push(minion); if (w.activeGate) w.activeGate.enemies.push(minion.id); }
      }
    }
    if (e.type === 'support' && e.aiTimer <= 0) {
      const other = w.enemies.find(t => t !== e && t.hp > 0 && t.hp < t.maxHp && Math.abs(t.x - e.x) < 450);
      if (other) { other.hp = Math.min(other.maxHp, other.hp + 10); other.shield = Math.min(20, other.shield + 4); events.effect(other.x, other.y - 45, '#a8d6b1', 8); events.text(e.x, e.y - 100, '支援脉冲', '#a8d6b1'); e.aiTimer = 3.2; }
    }
    const range = e.boss ? (e.type === 'gatekeeper' ? 280 : 320) : data.reach - 12;
    const sameHeight = Math.abs(dy) < (e.boss ? 115 : 70);
    const visible = distance < 620;
    if (sameHeight && distance < range && e.aiTimer <= 0 && visible && (attackers < 2 || e.boss || e.type === 'thrower')) {
      const d: AttackDef = e.boss ? bossAttack(e, player, events) : { name: '袭击', kind: 'enemy', startup: data.delay, active: .16, recovery: e.type === 'assassin' ? .5 : .7, damage: data.damage * (e.elite ? 1.25 : 1), reach: data.reach, height: 68, knock: e.type === 'brute' ? 430 : 180, lift: 0, stun: .3, cost: 0, guardBreak: e.type === 'brute', projectile: e.type === 'thrower' };
      startAttack(e, d, events); e.aiTimer = e.boss ? .35 : 1 + (e.id % 4) * .15; attackers++; continue;
    }
    let move = 0;
    const desired = e.type === 'thrower' ? 340 : range * .8 + (attackers >= 2 && !e.boss ? 80 + (e.id % 3) * 40 : 0);
    if (distance > desired) move = e.facing;
    else if (distance < desired - 90) move = -e.facing;
    if (e.type === 'assassin' && player.state === 'attack' && distance < 140 && e.aiTimer < .3 && e.dodgeCooldown <= 0) {
      // 刺客有明确闪避动作与冷却，不能在玩家攻击时逐帧刷新无敌。
      e.invuln = .18; e.dodgeCooldown = 2.2; e.vx = -e.facing * 360; setState(e, 'dodge'); continue;
    }
    const current = floorAt(w, e.x, e.y - 5);
    const next = floorAt(w, e.x + move * 48, e.y - 5);
    if (e.grounded && move && (!next || next.y > e.y + 120)) {
      const landing = floorAt(w, e.x + move * 210, e.y - 5);
      if (landing && landing.y <= e.y + 70 && distance > 160) { e.vy = -650; e.grounded = false; e.coyote = 0; }
      else move = 0;
    }
    // 有高度差时只向真实可达的平台跳跃，不反复对着远处高台起跳。
    if (e.grounded && dy < -70 && dy > -235 && e.aiTimer < .25) {
      const step = w.platforms.find(p => p.oneWay && p.y < e.y - 65 && p.y >= e.y - 230 && Math.abs(p.x + p.w / 2 - e.x) < 260 && Math.abs(p.x + p.w / 2 - player.x) < 480);
      if (step) { e.vy = -690; e.grounded = false; e.aiTimer = 1.2; move = Math.sign(step.x + step.w / 2 - e.x); }
    }
    if (e.grounded && dy > 90 && current?.oneWay && distance < 300) { e.dropTime = .24; e.y += 5; }
    const speed = data.speed * (e.elite ? 1.12 : 1) * (e.phase > 1 ? 1.12 : 1);
    e.vx = approach(e.vx, move * speed, 1400 * dt);
    if (w.activeGate) e.x = clamp(e.x, w.activeGate.left + 20, w.activeGate.right - 20);
    setStateIfChanged(e, e.grounded ? (Math.abs(e.vx) > 20 ? 'run' : 'idle') : 'jump');
  }
}
function setStateIfChanged(e: Entity, state: Entity['state']) { if (e.state !== state) setState(e, state); }
