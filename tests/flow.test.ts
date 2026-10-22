import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game';
import { Input } from '../src/input';
import { DEFAULT_BINDINGS } from '../src/data';
import { createEntity } from '../src/entities';
import { createWorld } from '../src/world';
import { damage } from '../src/combat';
import { LIGHTS } from '../src/data';
const noop = () => {};
const storage = new Map<string, string>();
const windowListeners = new Map<string, (e: any) => void>();
Object.defineProperty(globalThis, 'window', { value: { addEventListener: (name: string, cb: (e: any) => void) => windowListeners.set(name, cb), matchMedia: () => ({ matches: false }), devicePixelRatio: 1, innerHeight: 720, innerWidth: 1280 }, configurable: true });
Object.defineProperty(globalThis, 'document', { value: { addEventListener: noop, querySelectorAll: () => [], hidden: false }, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) }, configurable: true });
function newGame() {
  const canvas = { getContext: () => ({}), getBoundingClientRect: () => ({ width: 1280, height: 720 }) } as unknown as HTMLCanvasElement;
  const g = new Game(canvas); g.audio.unlock = noop; g.save.tutorial = true; g.start('campaign'); return g;
}
test('暂停冻结所有实体、攻击、技能、机关、投掷物和波次时间', () => {
  const g = newGame(); g.player.skillCooldown = 5;
  g.world.projectiles.push({ id: 9999, owner: 1, team: 'enemy', x: 450, y: 500, vx: 500, vy: 0, damage: 10, life: 2, weapon: 'discs', hit: new Set() });
  g.setScreen('pause'); const before = JSON.stringify({ player: g.player, world: g.world });
  for (let i = 0; i < 300; i++) g.step(1 / 60);
  assert.equal(JSON.stringify({ player: g.player, world: g.world }), before);
});
test('重试创建安全实体，清理旧攻击、投掷物、敌人和掉落', () => {
  const g = newGame(), id = g.player.id; g.player.hp = 3; g.world.enemies.push(createEntity('brute', 500));
  g.world.projectiles.push({ id: 9999, owner: 1, team: 'enemy', x: 450, y: 500, vx: 500, vy: 0, damage: 10, life: 2, weapon: 'discs', hit: new Set() });
  g.retry(); assert.notEqual(g.player.id, id); assert.equal(g.player.hp, 160); assert.equal(g.player.attack, null); assert.equal(g.world.projectiles.length, 0); assert.equal(g.world.enemies.length, 0); assert.equal(g.player.x, 190);
});
test('强化选择和商店购买不会重复结算', () => {
  const g = newGame(); g.screen = 'reward'; g.rewardList = [{ id: 'heart', name: '', desc: '', max: 3, color: '', icon: '' }];
  g.selectPerk('heart'); g.selectPerk('heart'); assert.equal(g.player.perks.heart, 1);
  g.coins = 100; g.player.hp = 10; g.openShop(); g.buy('heal'); const hp = g.player.hp, coins = g.coins;
  g.buy('heal'); assert.equal(g.player.hp, hp); assert.equal(g.coins, coins);
});
test('投掷离手与训练换武器不会残留旧攻击', () => {
  const g = newGame(); g.player.weapon = 'staff'; g.player.durability = 30; g.throwWeapon();
  assert.equal(g.player.weapon, 'fist'); assert.equal(g.world.projectiles[0].weapon, 'staff'); assert.equal(g.world.projectiles[0].durability, 30);
  g.start('training'); g.equipTraining('hammer'); assert.equal(g.player.weapon, 'hammer'); assert.equal(g.player.attack, null);
});
test('键盘与多点触控动作合并，释放一个手指不释放另一个', () => {
  const input = new Input(DEFAULT_BINDINGS), listeners = new Map<string, (e: any) => void>();
  const container = { addEventListener: (key: string, cb: (e: any) => void) => listeners.set(key, cb), querySelectorAll: () => [] } as unknown as HTMLElement;
  input.attachTouch(container);
  const pointer = (id: number, action: string) => ({ pointerId: id, preventDefault: noop, target: { closest: (selector: string) => selector === '[data-touch]' ? ({ dataset: { touch: action }, setPointerCapture: noop, classList: { add: noop } }) : null } });
  listeners.get('pointerdown')!(pointer(1, 'right')); listeners.get('pointerdown')!(pointer(2, 'jump')); listeners.get('pointerdown')!(pointer(3, 'light'));
  assert.ok(input.down('right') && input.down('jump') && input.down('light'));
  listeners.get('pointerup')!({ pointerId: 2 }); assert.ok(input.down('right') && input.down('light')); assert.equal(input.down('jump'), false);
  windowListeners.get('keydown')!({ code: 'KeyI', target: { matches: () => false }, preventDefault: noop, repeat: false }); assert.ok(input.down('block'));
  listeners.get('pointercancel')!({ pointerId: 1 }); assert.equal(input.down('right'), false); assert.ok(input.down('block'));
});
test('摇杆支持模拟量、斜向组合、独立多指与松手回中', () => {
  const input = new Input(DEFAULT_BINDINGS), listeners = new Map<string, (e: any) => void>();
  const thumb = { style: { transform: '' } };
  const stick = { setPointerCapture: noop, classList: { add: noop, remove: noop }, getBoundingClientRect: () => ({ x: 0, y: 0, width: 132, height: 132 }), querySelector: () => thumb };
  const container = { addEventListener: (key: string, cb: (e: any) => void) => listeners.set(key, cb), querySelectorAll: () => [] } as unknown as HTMLElement;
  input.attachTouch(container);
  listeners.get('pointerdown')!({ pointerId: 1, clientX: 88, clientY: 66, preventDefault: noop, target: { closest: () => stick } });
  assert.ok(input.horizontal() > .3 && input.horizontal() < .5);
  listeners.get('pointermove')!({ pointerId: 1, clientX: 100, clientY: 25, preventDefault: noop });
  assert.ok(input.down('right') && input.down('up'));
  listeners.get('pointerdown')!({ pointerId: 2, preventDefault: noop, target: { closest: (selector: string) => selector === '[data-touch]' ? { dataset: { touch: 'heavy' }, setPointerCapture: noop, classList: { add: noop } } : null } });
  assert.ok(input.down('up') && input.down('heavy'));
  listeners.get('pointerup')!({ pointerId: 1 });
  assert.equal(input.horizontal(), 0); assert.equal(input.down('up'), false); assert.equal(thumb.style.transform, 'translate(0px, 0px)'); assert.ok(input.down('heavy'));
});
test('各区域有独立地形元素而非仅背景换色', () => {
  const street = createWorld('campaign', 0, 100), factory = createWorld('campaign', 2, 100), tower = createWorld('campaign', 4, 100);
  assert.equal(street.hazards.length, 0); assert.ok(factory.platforms.some(p => p.conveyor)); assert.ok(tower.hazards.some(h => h.kind === 'wind')); assert.ok(factory.hazards.some(h => h.kind === 'press'));
});
test('下方向加跳跃不能从实体地基穿地', () => {
  const g = newGame(); g.input.held = new Set(['down', 'jump']); g.input.pressed = new Set(['jump']);
  g.step(1 / 60); assert.ok(g.player.y < 620); assert.equal(g.player.dropTime, 0);
});
test('最终首领被真实攻击击败的当帧清除召唤物、机关和投掷威胁', () => {
  const g = newGame(); g.world = createWorld('campaign', 5, 100); const boss = createEntity('shadowlord', 490), minion = createEntity('assassin', 510); boss.hp = 1; g.world.enemies = [boss, minion];
  g.world.projectiles.push({ id: 666, owner: minion.id, team: 'enemy', x: 200, y: 500, vx: 300, vy: 0, damage: 10, life: 1, weapon: 'discs', hit: new Set() });
  damage(g.player, boss, LIGHTS[0], g.events);
  assert.equal(minion.hp, 0); assert.equal(g.world.projectiles.length, 0); assert.equal(g.world.hazards.length, 0); assert.equal(g.player.state, 'victory'); assert.ok(g.player.invuln >= 10);
  for (let i = 0; i < 150; i++) g.step(1 / 60);
  assert.equal(g.screen, 'result'); assert.equal(g.resultWin, true);
});
