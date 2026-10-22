import test from 'node:test';
import assert from 'node:assert/strict';
import { attackPlayer, canAct, startAttack, tickEntity } from '../src/actions';
import { combatStep, damage, inAttackRange, updateProjectiles } from '../src/combat';
import { ATTACKS, LIGHTS, PERKS, WEAPONS } from '../src/data';
import { createEntity } from '../src/entities';
import { getPose, joint } from '../src/animation';
import { integrate, tryJump } from '../src/movement';
import { applyPerk, rewardChoices } from '../src/rewards';
import { createWorld, spawnGate } from '../src/world';
import { freshSave, readSave, writeSave } from '../src/storage';
import { spawnSkillEffect, updateSkillEffects } from '../src/skill-vfx';
import { updateAI } from '../src/ai';
import type { GameEvents } from '../src/types';
const events: GameEvents = { effect() {}, text() {}, sound() {}, impact() {}, kill() {}, hit() {} };

test('普通挥击只在有效期造成伤害，同挥击不重复命中', () => {
  const w = createWorld('training'), p = createEntity('fighter', 400, 620, true), t = createEntity('fighter', 455);
  w.enemies = [t]; startAttack(p, LIGHTS[0]);
  combatStep(w, p, events); assert.equal(t.hp, t.maxHp);
  p.attack!.time = .08; combatStep(w, p, events); const hp = t.hp; assert.ok(hp < t.maxHp);
  combatStep(w, p, events); assert.equal(t.hp, hp);
  p.attack!.time = .2; t.x = 440; combatStep(w, p, events); assert.equal(t.hp, hp);
});
test('前方攻击不命中背后或隔层目标', () => {
  const p = createEntity('fighter', 400, 620, true), t = createEntity('fighter', 360);
  assert.equal(inAttackRange(p, t, LIGHTS[0]), false);
  t.x = 440; t.y = 450; assert.equal(inAttackRange(p, t, LIGHTS[0]), false);
});
test('攻击有效期不可随意取消，重击保留收招', () => {
  const p = createEntity('fighter', 400, 620, true); startAttack(p, ATTACKS.heavy);
  p.attack!.time = .3; assert.equal(canAct(p), false); assert.equal(canAct(p, true), false);
  p.attack!.time = .6; assert.equal(canAct(p), false); assert.equal(canAct(p, true), true);
});
test('上挑浮空与重复控制衰减，Boss 免浮空', () => {
  const p = createEntity('fighter', 400, 620, true), t = createEntity('fighter', 450);
  damage(p, t, ATTACKS.launch, events); const first = t.vy; assert.ok(first < -500);
  t.hp = 100; damage(p, t, ATTACKS.launch, events); assert.ok(t.vy > first);
  const boss = createEntity('gatekeeper', 450); damage(p, boss, ATTACKS.launch, events); assert.equal(boss.vy, 0);
});
test('霸体承受伤害但不丢失当前攻击', () => {
  const p = createEntity('fighter', 400, 620, true), t = createEntity('gatekeeper', 450);
  startAttack(t, ATTACKS.heavy); damage(p, t, LIGHTS[0], events);
  assert.ok(t.hp < t.maxHp); assert.equal(t.state, 'attack'); assert.ok(t.attack);
});
test('正面精准防御反制，背后攻击无法格挡', () => {
  const p = createEntity('fighter', 400, 620, true), e = createEntity('fighter', 450);
  p.state = 'block'; p.blockTime = .1; damage(e, p, LIGHTS[0], events); assert.equal(p.hp, p.maxHp); assert.ok(p.parryPower > 0);
  p.invuln = 0; p.blockTime = 1; e.x = 350; damage(e, p, LIGHTS[0], events); assert.ok(p.hp < p.maxHp);
});
test('不可格挡攻击穿过防御但不能穿过闪避无敌', () => {
  const p = createEntity('fighter', 400, 620, true), e = createEntity('fighter', 450), d = { ...ATTACKS.heavy, unblockable: true };
  p.state = 'block'; p.blockTime = .1; damage(e, p, d, events); assert.ok(p.hp < p.maxHp);
  const hp = p.hp; p.invuln = .2; damage(e, p, d, events); assert.equal(p.hp, hp);
});
test('连遭控制获得保护，起身无敌不会造成永久硬直', () => {
  const p = createEntity('fighter', 400, 620, true), e = createEntity('fighter', 450);
  damage(e, p, LIGHTS[0], events); p.invuln = 0; damage(e, p, LIGHTS[0], events); assert.ok(p.invuln >= .9);
  p.state = 'down'; p.stateTime = .7; p.grounded = true; tickEntity(p, .02); assert.equal(p.state, 'rise'); assert.ok(p.invuln > 0);
});
test('单向平台从下穿越、从上接地、允许主动下落', () => {
  const p = createEntity('fighter', 100, 550, true), platform = { x: 0, y: 500, w: 300, h: 20, oneWay: true };
  p.vy = -690; p.grounded = false; integrate(p, [platform], .1, 1000); assert.ok(p.y < 500); assert.equal(p.grounded, false);
  p.y = 490; p.vy = 200; integrate(p, [platform], .05, 1000); assert.equal(p.y, 500); assert.equal(p.grounded, true);
  tryJump(p, true); integrate(p, [platform], .05, 1000); assert.ok(p.y > 500);
});
test('土狼时间允许跳跃，无强化不能二段跳', () => {
  const p = createEntity('fighter', 100, 500, true); p.grounded = false; p.coyote = .08;
  assert.equal(tryJump(p, false), true); assert.equal(tryJump(p, false), false);
  p.perks.doublejump = 1; assert.equal(tryJump(p, false), true); assert.equal(tryJump(p, false), false);
});
test('下砸落地前不开放有效帧，空中攻击次数有限', () => {
  const p = createEntity('fighter', 100, 400, true); p.grounded = false;
  attackPlayer(p, 'slam', 0, events); for (let i = 0; i < 40; i++) tickEntity(p, 1 / 60);
  assert.ok(p.attack!.time < p.attack!.def.startup);
  p.grounded = true; tickEntity(p, .02); assert.ok(p.attack!.time >= p.attack!.def.startup);
  p.attack = null; p.state = 'jump'; p.grounded = false; p.airHits = 3; assert.equal(attackPlayer(p, 'air', 2, events), false);
});
test('高速投掷物使用扫掠检测，不越过目标', () => {
  const p = createEntity('fighter', 100, 620, true), t = createEntity('fighter', 200), w = createWorld('training'); w.enemies = [t];
  w.projectiles = [{ id: 1000, owner: p.id, team: 'player', x: 110, y: 578, vx: 7000, vy: 0, damage: 20, life: 2, weapon: 'discs', hit: new Set() }];
  updateProjectiles(w, p, .03, events); assert.equal(t.hp, t.maxHp - 20); assert.equal(w.projectiles.length, 0);
});
test('奖励不超过上限，抽选不包含满级强化', () => {
  const p = createEntity('fighter', 100, 620, true);
  for (const perk of PERKS) { for (let i = 0; i < perk.max; i++) assert.equal(applyPerk(p, perk.id), true); assert.equal(applyPerk(p, perk.id), false); }
  assert.equal(rewardChoices(p, 1).length, 0); assert.equal(p.maxHp, 220);
});
test('六关固定地形主线可达，封锁生成点不会越界', () => {
  for (let level = 0; level < 6; level++) {
    const w = createWorld('campaign', level, 321); const ground = w.platforms.filter(p => !p.oneWay);
    for (let i = 1; i < ground.length; i++) assert.ok(ground[i].x - (ground[i - 1].x + ground[i - 1].w) < 200);
    for (let gate = 0; gate < 3; gate++) { spawnGate(w, gate); const g = w.gates[gate]; for (const e of w.enemies.filter(e => g.enemies.includes(e.id))) { assert.ok(e.x > g.left && e.x < g.right); assert.ok(ground.some(p => e.x >= p.x && e.x <= p.x + p.w)); } }
  }
});
test('武器定义、连段姿态与骨骼解算产生有限值', () => {
  const p = createEntity('fighter', 100, 620, true);
  for (const weapon of Object.keys(WEAPONS)) for (let combo = 0; combo < 4; combo++) {
    p.weapon = weapon as typeof p.weapon; p.combo = combo; startAttack(p, LIGHTS[combo]);
    p.attack!.time = .1; const pose = getPose(p, 1); for (const value of Object.values(pose).flat()) assert.ok(Number.isFinite(value));
  }
  const elbow = joint([0, 0], [1000, 0], 22, 23, 1); assert.ok(Math.abs(Math.hypot(...elbow) - 22) < .001);
});
test('存档命名空间独立，坏档和非法检查点安全回退', () => {
  const map = new Map<string, string>(); Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => map.get(k), setItem: (k: string, v: string) => map.set(k, v) }, configurable: true });
  const save = freshSave(); assert.equal(writeSave(save), true); assert.equal(readSave().version, 1);
  map.set('inkshadow.clash.save.v1', '{bad'); assert.equal(readSave().checkpoint, null);
  map.set('inkshadow.clash.save.v1', JSON.stringify({ ...save, checkpoint: { level: 99, hp: 100 } })); assert.equal(readSave().checkpoint, null);
});
test('长杆与重锤双手握点在同一杆轴，动作全过程保持固定间距', () => {
  const e = createEntity('fighter', 200, 620, true);
  for (const weapon of ['staff', 'hammer'] as const) for (const d of [...LIGHTS, ATTACKS.heavy, ATTACKS.launch, ATTACKS.air]) {
    e.weapon = weapon; startAttack(e, d);
    for (const time of [0, d.startup * .5, d.startup + .02, d.startup + d.active, d.startup + d.active + d.recovery * .8]) {
      e.attack!.time = time; const p = getPose(e, 2), dx = p.frontHand[0] - p.backHand[0], dy = p.frontHand[1] - p.backHand[1];
      assert.ok(Math.abs(Math.hypot(dx, dy) - (weapon === 'staff' ? 18 : 14)) < .001);
      assert.ok(Math.abs(dx * Math.sin(p.weaponAngle) - dy * Math.cos(p.weaponAngle)) < .001);
    }
  }
});
test('技能特效仅在发力帧触发一次，且视觉事件不会自行造成伤害', () => {
  const w = createWorld('training'), p = createEntity('fighter', 400, 620, true), t = createEntity('fighter', 500); w.enemies = [t];
  spawnSkillEffect(w, p); const hp = t.hp; combatStep(w, p, events); assert.equal(t.hp, hp);
  w.skillEffects = []; attackPlayer(p, 'skill', 0, events); combatStep(w, p, events); assert.equal(w.skillEffects.length, 0);
  p.attack!.time = .11; combatStep(w, p, events); combatStep(w, p, events); assert.equal(w.skillEffects.length, 1);
  updateSkillEffects(w, 1); assert.equal(w.skillEffects.length, 0);
});
test('上挑只有真实命中后才允许追跳取消有效帧', () => {
  const p = createEntity('fighter', 300, 620, true); startAttack(p, ATTACKS.launch); p.attack!.time = .15;
  assert.equal(tryJump(p, false), false); p.attack!.hit.add(1234); assert.equal(tryJump(p, false), true); assert.equal(p.state, 'jump'); assert.equal(p.attack, null);
});
test('Boss 被精准防御后仍按独立序号使用三种招式', () => {
  const w = createWorld('training'), p = createEntity('fighter', 400, 620, true), boss = createEntity('gatekeeper', 450); w.enemies = [boss];
  const names: string[] = [];
  for (let i = 0; i < 3; i++) { boss.attack = null; boss.state = 'idle'; boss.aiTimer = 0; boss.intent = .45; updateAI(w, p, 1 / 60, events); names.push(boss.attack!.def.name); }
  assert.deepEqual(names, ['重拳', '铁肩冲锋', '裂地震荡']);
});
test('刺客闪避有冷却，不能逐帧刷新无敌', () => {
  const w = createWorld('training'), p = createEntity('fighter', 400, 620, true), e = createEntity('assassin', 500); w.enemies = [e];
  startAttack(p, LIGHTS[0]); e.aiTimer = .2; updateAI(w, p, 1 / 60, events); assert.equal(e.state, 'dodge'); assert.ok(e.dodgeCooldown > 2);
  tickEntity(e, .32); updateAI(w, p, 1 / 60, events); assert.notEqual(e.state, 'dodge'); assert.equal(e.invuln, 0);
});
