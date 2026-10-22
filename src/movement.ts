import { approach, clamp } from './math';
import { setState } from './entities';
import type { Entity, Platform, World } from './types';

/** 单向平台只在脚底从上向下穿越顶面时接地，绝不侧向推出角色。 */
export function integrate(e: Entity, platforms: Platform[], dt: number, width: number) {
  e.prevX = e.x; e.prevY = e.y;
  const wasGrounded = e.grounded;
  e.x += e.vx * dt;
  e.vy += 1850 * dt;
  e.y += e.vy * dt;
  e.grounded = false;
  for (const p of platforms) {
    if (e.x + 13 <= p.x || e.x - 13 >= p.x + p.w) continue;
    if (p.oneWay && e.dropTime > 0) continue;
    if (e.vy >= 0 && e.prevY <= p.y + 3 && e.y >= p.y) {
      e.y = p.y; e.vy = 0; e.grounded = true;
      if (p.conveyor && e.state !== 'dead') e.x += p.conveyor * dt;
      break;
    }
    // 实体地基的侧壁使用上一帧位置判断，避免撞墙角后悬空。
    if (!p.oneWay && e.y > p.y + 8 && e.y - 80 < p.y + p.h) {
      if (e.prevX + 13 <= p.x + 2 && e.x + 13 > p.x) { e.x = p.x - 13; e.vx = 0; }
      else if (e.prevX - 13 >= p.x + p.w - 2 && e.x - 13 < p.x + p.w) { e.x = p.x + p.w + 13; e.vx = 0; }
    }
  }
  e.x = clamp(e.x, 30, width - 30);
  if (e.grounded) {
    e.coyote = .11; e.airJumps = 0; e.airHits = 0; e.aerialCharge = 0;
    if (wasGrounded) e.juggle = Math.max(0, e.juggle - dt * 2);
  } else e.coyote = Math.max(0, e.coyote - dt);
  return !wasGrounded && e.grounded;
}

/** 受击惯性与正常移动互斥；硬直状态由战斗状态机解除。 */
export function movePlayer(e: Entity, horizontal: number, crouch: boolean, dt: number) {
  const locked = ['hurt', 'down', 'rise', 'dead', 'pickup', 'victory'].includes(e.state);
  if (locked) { e.vx = approach(e.vx, 0, (e.grounded ? 1100 : 180) * dt); return; }
  if (e.state === 'dodge') return;
  if (e.state === 'attack' && e.attack?.def.dash) return;
  const speed = 315 * (e.weapon === 'fist' && e.perks.bare ? 1.18 : 1);
  const factor = e.state === 'attack' ? (e.grounded ? .16 : .7) : e.state === 'block' || crouch ? .32 : 1;
  e.vx = approach(e.vx, horizontal * speed * factor, (e.grounded ? 3200 : 1550) * dt);
  if (horizontal && e.state !== 'attack' && e.state !== 'block') e.facing = Math.sign(horizontal);
  if (!['attack', 'block'].includes(e.state)) {
    const state = e.grounded ? (crouch ? 'crouch' : Math.abs(e.vx) > 25 ? 'run' : 'idle') : 'jump';
    if (state !== e.state) setState(e, state);
  }
}

export function tryJump(e: Entity, down: boolean) {
  if (['hurt', 'down', 'rise', 'dead', 'pickup'].includes(e.state)) return false;
  if (e.state === 'attack' && e.attack && e.attack.time < e.attack.def.startup + e.attack.def.active) {
    // 上挑真实命中后开放追跳窗口，不能在命中前用跳跃取消起手。
    const launchConnected = e.attack.def.kind === 'launch' && e.attack.hit.size > 0;
    if (!launchConnected) return false;
  }
  if (down && e.grounded) { e.dropTime = .22; e.y += 5; e.grounded = false; return false; }
  const extra = !e.grounded && e.coyote <= 0 && e.perks.doublejump && e.airJumps < 1;
  if (e.grounded || e.coyote > 0 || extra) {
    if (extra) { e.airJumps++; e.airHits = 0; }
    e.vy = -690; e.grounded = false; e.coyote = 0; e.jumpBuffer = 0;
    e.attack = null; setState(e, 'jump'); return true;
  }
  return false;
}

export function floorAt(world: World, x: number, y: number): Platform | undefined {
  return world.platforms.filter(p => x >= p.x - 5 && x <= p.x + p.w + 5 && p.y >= y - 5).sort((a, b) => a.y - b.y)[0];
}
