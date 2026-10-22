import './style.css';
import { Game } from './game';
import { UI } from './ui';

const game = new Game(document.querySelector<HTMLCanvasElement>('#stage')!);
new UI(game);
let last = performance.now(), accumulator = 0;
/** 固定 60Hz 逻辑，渲染遵循屏幕刷新率；切后台不补算旧时间。 */
function frame(now: number) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (game.screen === 'playing') {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= 1 / 60 && steps++ < 6) { game.step(1 / 60); accumulator -= 1 / 60; }
  } else accumulator = 0;
  game.renderer.render(game.world, game.player, game.save.settings, dt, game.screen === 'menu' || game.screen === 'chapters');
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 只读诊断快照供性能/适配验收使用，不暴露修改生命值或跳过关卡的调试入口。
Object.defineProperty(window, '__INKSHADOW__', { value: Object.freeze({ snapshot: () => ({
  screen: game.screen, mode: game.world.mode, level: game.world.level, time: game.world.time,
  player: { x: game.player.x, y: game.player.y, hp: game.player.hp, state: game.player.state, weapon: game.player.weapon },
  enemies: game.world.enemies.filter(e => e.hp > 0).map(e => ({ type: e.type, hp: e.hp, x: e.x, y: e.y, state: e.state })),
  gates: game.world.gates.map(g => ({ triggered: g.triggered, cleared: g.cleared })),
  counts: { particles: game.world.particles.length, drops: game.world.drops.length, projectiles: game.world.projectiles.length },
  score: game.score, kills: game.kills, combo: game.combo, wave: game.world.wave,
}) }) });
