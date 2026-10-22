/** 无渲染验收：机器人只提交正常输入/界面选择，不能改耐久、位置或触发胜利。
 * 与浏览器实际操作互补；完整复用 Game.step、碰撞、AI、伤害和关卡流程。
 */
import fs from 'node:fs';
const memory = new Map<string, string>();
const noop = () => {};
Object.defineProperty(globalThis, 'window', { value: { addEventListener: noop, matchMedia: () => ({ matches: false }), devicePixelRatio: 1, innerHeight: 720, innerWidth: 1280 }, configurable: true });
Object.defineProperty(globalThis, 'document', { value: { addEventListener: noop, querySelectorAll: () => [], hidden: false }, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => memory.get(key), setItem: (key: string, value: string) => memory.set(key, value) }, configurable: true });
const { Game } = await import('../src/game');
const { WEAPONS } = await import('../src/data');
const canvas = { width: 1280, height: 720, getContext: () => ({}), getBoundingClientRect: () => ({ width: 1280, height: 720 }) } as unknown as HTMLCanvasElement;
const game = new Game(canvas); game.audio.unlock = noop;
const mode = process.argv.includes('--arena') ? 'arena' : 'campaign';
const endurance = process.argv.includes('--endurance');
game.save.tutorial = true;
const originalNow = Date.now; Date.now = () => Number(process.env.INK_TEST_SEED || 20261023); game.start(mode); Date.now = originalNow;
let frame = 0;
const report: unknown[] = []; let lastLevel = -1, lastWave = 0; let purchases = 0; let dodgeAt = -99; let restarts = 0;
const maxima = { enemies: 0, particles: 0, drops: 0, projectiles: 0, skillEffects: 0 }; const heaps: number[] = [];
const bossPhases: Record<string, number> = {}, defeatedBosses: string[] = [];
const originalKill = game.events.kill;
game.events.kill = (entity, source) => { if (entity.boss) defeatedBosses.push(entity.type); originalKill(entity, source); };
const begin = performance.now();
while (frame < (mode === 'arena' ? 60 * 60 * 45 : 60 * 60 * 40)) {
  const w = game.world, p = game.player;
  for (const enemy of w.enemies) if (enemy.boss) bossPhases[enemy.type] = Math.max(bossPhases[enemy.type] || 0, enemy.phase);
  if (w.level !== lastLevel || w.wave !== lastWave) { lastLevel = w.level; lastWave = w.wave; report.push({ level: w.level + 1, wave: w.wave, at: Math.round(game.totalTime), hp: Math.round(p.hp), perks: { ...p.perks } }); }
  if (game.screen === 'result') {
    if (!endurance) break;
    restarts++; game.start('arena'); dodgeAt = -99; lastWave = 0; continue;
  }
  if (game.screen === 'reward') {
    const priority = ['heart', 'combo', 'parry', 'finisher', 'elite', 'breakflow', 'aerial', 'doublejump', 'bare'];
    const choice = [...game.rewardList].sort((a, b) => (priority.indexOf(a.id) < 0 ? 99 : priority.indexOf(a.id)) - (priority.indexOf(b.id) < 0 ? 99 : priority.indexOf(b.id)))[0];
    if (choice) game.selectPerk(choice.id); else game.afterReward();
    continue;
  }
  if (game.screen === 'shop') {
    game.buy('heal'); if (!p.revive) game.buy('revive');
    if (p.weapon !== 'fist') game.buy('repair');
    if (p.weapon === 'fist') { const weapon = game.shopStock.find(x => x === 'staff' || x === 'blades') || game.shopStock[0]; game.buy(`weapon:${weapon}`); }
    purchases++; game.leaveShop(); continue;
  }
  const held = new Set<string>(), pressed = new Set<string>();
  const tap = (key: string) => { held.add(key); pressed.add(key); };
  const targets = w.enemies.filter(e => e.hp > 0 && e.state !== 'dead').sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) - Math.abs(b.x - p.x) - Math.abs(b.y - p.y));
  const t = targets[0];
  if (t) {
    const dx = t.x - p.x, range = 55 + WEAPONS[p.weapon].reach;
    if (Math.abs(dx) > range) held.add(dx > 0 ? 'right' : 'left');
    else if (dx * p.facing < 0) held.add(dx > 0 ? 'right' : 'left');
    // 提前读取预备动作模拟熟练玩家：定向格挡、躲避不可格挡、跳过地震。
    const threats = targets.filter(e => e.attack && Math.abs(e.x - p.x) < e.attack.def.reach + (e.attack.def.dash ? 420 : 95));
    const danger = threats.find(e => e.attack!.time > e.attack!.def.startup - .12 && e.attack!.time < e.attack!.def.startup + e.attack!.def.active);
    if (danger && p.grounded) {
      if (danger.attack!.def.unblockable) {
        if (danger.attack!.def.radial) tap('jump');
        else if (game.totalTime - dodgeAt > .8) { held.delete('left'); held.delete('right'); held.add(p.x < danger.x ? 'right' : 'left'); tap('dodge'); dodgeAt = game.totalTime; }
      } else { held.delete('left'); held.delete('right'); held.add(p.x < danger.x ? 'right' : 'left'); held.add('block'); }
    }
    const bossWinding = t.boss && t.attack && t.attack.time < t.attack.def.startup + t.attack.def.active;
    if (!held.has('block') && !pressed.has('dodge') && !bossWinding) {
      if (Math.abs(dx) < range + 24 && frame % 14 === 0) tap('light');
      if (Math.abs(dx) < 155 && p.skillCooldown <= 0 && p.energy > 45 && frame % 45 === 0) tap('skill');
      if ((t.type === 'shield' || t.type === 'brute') && Math.abs(dx) < 125 && frame % 53 === 0) tap('heavy');
    }
    if (t.y < p.y - 65 && p.grounded && frame % 25 === 0) tap('jump');
    if (t.y > p.y + 80 && p.grounded && frame % 25 === 0) { held.add('down'); tap('jump'); }
  } else {
    held.add('right');
    const floor = w.platforms.find(platform => !platform.oneWay && p.x >= platform.x && p.x <= platform.x + platform.w);
    if (p.grounded && floor && floor.x + floor.w - p.x < 42 && floor.x + floor.w < w.width) tap('jump');
    if (p.grounded && w.platforms.some(platform => platform.oneWay && Math.abs(platform.y - p.y) < 3) && frame % 40 === 0) { held.add('down'); tap('jump'); }
    if (frame % 20 === 0 && w.crates.some(c => !c.opened && Math.abs(c.x - p.x) < 90 && Math.abs(c.y - p.y) < 70)) tap('light');
  }
  if (p.weapon === 'fist' && w.drops.some(d => Math.abs(d.x - p.x) < 75 && Math.abs(d.y - p.y) < 70)) tap('interact');
  game.input.held = held; game.input.pressed = pressed; game.step(1 / 60); frame++;
  if (frame % 300 === 0) {
    for (const key of Object.keys(maxima) as (keyof typeof maxima)[]) maxima[key] = Math.max(maxima[key], game.world[key].length);
    if (frame % 3600 === 0) { globalThis.gc?.(); heaps.push(Math.round(process.memoryUsage().heapUsed / 1024)); }
  }
  if (!endurance && mode === 'arena' && game.world.wave > 25) break;
}
const result = { mode, success: game.resultWin, screen: game.screen, level: game.world.level + 1, wave: game.world.wave, simulatedSeconds: Math.round(game.totalTime), frames: frame, hp: Math.round(game.player.hp), kills: game.kills, score: game.score, bestCombo: game.bestCombo, purchases, counts: { enemies: game.world.enemies.length, particles: game.world.particles.length, drops: game.world.drops.length, projectiles: game.world.projectiles.length }, elapsedMs: Math.round(performance.now() - begin), checkpoints: report, finalPlayer: { x: game.player.x, y: game.player.y }, finalEnemies: game.world.enemies.filter(e => e.hp > 0).map(e => ({ type: e.type, hp: e.hp, x: Math.round(e.x), y: Math.round(e.y) })) };
const output = { ...result, endurance, restarts, maxima, bossPhases, defeatedBosses, heapSamplesKB: heaps, controlledFramesSeconds: Math.round(frame / 60) };
fs.mkdirSync('artifacts', { recursive: true }); fs.writeFileSync(`artifacts/${mode}${endurance ? '-endurance' : ''}-simulation.json`, JSON.stringify(output, null, 2)); console.log(JSON.stringify(output, null, 2));
if (mode === 'campaign' && !game.resultWin) process.exitCode = 1;
