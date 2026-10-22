import { clamp, lerp } from './math';
import type { Entity } from './types';
export type Point = [number, number];
export interface Pose { hip: Point; neck: Point; head: Point; shoulder: Point; frontHand: Point; backHand: Point; frontFoot: Point; backFoot: Point; weaponAngle: number; squash: number; rotation: number; }
/** 两段骨骼逆运动学：关节长度固定，目标超出臂展时钳制，避免拉伸与脱节。 */
export function joint(root: Point, end: Point, upper: number, lower: number, bend: number): Point {
  const dx = end[0] - root[0], dy = end[1] - root[1];
  const distance = clamp(Math.hypot(dx, dy), 1, upper + lower - .01);
  const a = Math.atan2(dy, dx), cosine = clamp((upper * upper + distance * distance - lower * lower) / (2 * upper * distance), -1, 1);
  return [root[0] + Math.cos(a + Math.acos(cosine) * bend) * upper, root[1] + Math.sin(a + Math.acos(cosine) * bend) * upper];
}
/** 姿态从世界状态求解；起手压缩、有效帧伸展、收招回弹均随攻击时间推进。 */
export function getPose(e: Entity, time: number): Pose {
  const walking = e.state === 'run', airborne = !e.grounded;
  const cycle = time * (Math.abs(e.vx) > 200 ? 14 : 10) + e.id * .4;
  const stride = walking ? Math.sin(cycle) : 0;
  const bob = walking ? Math.abs(Math.cos(cycle)) * 3 : Math.sin(time * 2.8) * 1.4;
  const p: Pose = { hip: [0, -37 + bob], neck: [3, -73 + bob], shoulder: [3, -65 + bob], head: [5, -88 + bob], frontHand: [19, -43], backHand: [-12, -45], frontFoot: [14 + stride * 17, -Math.max(0, -Math.cos(cycle)) * (walking ? 15 : 0)], backFoot: [-13 - stride * 17, -Math.max(0, Math.cos(cycle)) * (walking ? 15 : 0)], weaponAngle: -.8, squash: 1, rotation: 0 };
  if (walking) { p.neck[0] += 8; p.head[0] += 8; p.shoulder[0] += 8; p.frontHand = [13 - stride * 22, -47]; p.backHand = [-8 + stride * 22, -49]; p.weaponAngle = -.7 + stride * .25; }
  if (airborne) { p.frontFoot = [23, -16]; p.backFoot = [-16, -25]; p.frontHand = [24, -67]; p.backHand = [-20, -61]; p.hip[1] -= 3; }
  if (e.state === 'crouch') { p.hip = [-5, -23]; p.neck = [11, -49]; p.head = [16, -62]; p.shoulder = [10, -43]; p.frontHand = [28, -31]; p.backHand = [-7, -35]; p.frontFoot = [26, 0]; p.backFoot = [-23, 0]; }
  if (e.state === 'block') { p.hip = [-4, -33]; p.neck = [0, -66]; p.head = [0, -82]; p.shoulder = [0, -60]; p.frontHand = [29, -76]; p.backHand = [19, -58]; p.frontFoot = [23, 0]; p.backFoot = [-22, 0]; p.weaponAngle = -1.55; }
  if (e.state === 'dodge') { p.hip = [-9, -25]; p.neck = [14, -44]; p.head = [25, -51]; p.shoulder = [10, -41]; p.frontHand = [29, -26]; p.backHand = [-18, -40]; p.frontFoot = [30, -1]; p.backFoot = [-26, -10]; p.weaponAngle = -.15; }
  if (e.state === 'pickup') { p.hip = [-4, -28]; p.neck = [19, -48]; p.head = [25, -58]; p.shoulder = [16, -43]; p.frontHand = [35, -15]; }
  if (e.state === 'hurt') { p.hip[0] = -8; p.neck[0] = -13; p.head[0] = -18; p.shoulder[0] = -12; p.frontHand = [14, -61]; p.backHand = [-31, -43]; p.rotation = -.08; }
  if (e.state === 'down' || e.state === 'dead') { p.rotation = -1.35; p.hip[1] += 18; p.frontFoot = [15, 0]; p.backFoot = [-8, -4]; p.frontHand = [25, -45]; p.backHand = [-14, -56]; }
  if (e.state === 'rise') { p.hip = [-10, -22]; p.neck = [4, -50]; p.head = [11, -65]; p.shoulder = [1, -44]; p.frontHand = [30, -15]; p.frontFoot = [25, 0]; p.backFoot = [-21, -2]; }
  if (e.state === 'victory') { p.frontHand = [21, -105]; p.backHand = [-15, -44]; p.weaponAngle = -1.6; }
  if (e.weapon === 'staff' && !['attack', 'hurt', 'down', 'dead', 'block', 'dodge'].includes(e.state)) {
    // 长杆在身体前方斜向上持握，握点留出尾杆给另一只手，不能从手背伸出。
    p.frontHand = [29, -58]; p.weaponAngle = -1.12 + (walking ? Math.sin(cycle) * .08 : 0);
  }
  if (e.weapon === 'hammer' && !['attack', 'hurt', 'down', 'dead'].includes(e.state)) { p.frontHand = [27, -52]; p.weaponAngle = -1.05; }
  if (e.weapon === 'baton' && e.state !== 'attack') { p.frontHand = [27, -49]; p.weaponAngle = -.5; }
  if (e.state === 'attack' && e.attack) {
    const a = e.attack, d = a.def;
    const wind = clamp(a.time / d.startup, 0, 1);
    const active = a.time >= d.startup;
    const recovery = clamp((a.time - d.startup - d.active) / d.recovery, 0, 1);
    const punch = active ? 1 - recovery ** .65 : -Math.sin(wind * Math.PI / 2) * .42;
    const heavy = d.kind === 'heavy' || e.weapon === 'hammer';
    p.hip = [punch * 7, -35 + (heavy ? 5 : 2) * (1 - Math.max(0, punch))];
    p.neck = [4 + punch * 16, -70 + (heavy ? 5 : 0)]; p.head = [8 + punch * 17, -84 + (heavy ? 4 : 0)]; p.shoulder = [3 + punch * 16, -63 + (heavy ? 5 : 0)];
    p.frontFoot = [24 + punch * 5, airborne ? -14 : 0]; p.backFoot = [-22, airborne ? -22 : 0];
    p.frontHand = [16 + punch * 44, -56 - punch * 8]; p.backHand = [-5 + punch * 7, -50]; p.weaponAngle = lerp(-2.1, .2, Math.max(0, punch));
    if (d.kind === 'light' && e.combo === 1) { p.frontHand = [22 + punch * 31, -49 - punch * 20]; p.backHand = [4, -60]; }
    if (d.kind === 'light' && e.combo >= 2 && e.weapon === 'fist') { p.frontFoot = [18 + punch * 56, -Math.max(0, punch) * 58]; p.hip = [-3 + punch * 6, -39]; p.frontHand = [15, -67]; p.backHand = [-19, -54]; }
    if (heavy) { p.frontHand = [12 + punch * 38, -86 + punch * 47]; p.backHand = [3 + punch * 28, -73 + punch * 30]; p.weaponAngle = lerp(-2.3, .45, Math.max(0, punch)); }
    if (d.kind === 'launch') { p.hip[1] = -30 - Math.max(0, punch) * 10; p.frontHand = [22 + punch * 9, -44 - punch * 60]; p.weaponAngle = -1.5; p.neck[0] = 4; }
    if (d.kind === 'air') { p.frontHand = [32 + punch * 23, -55]; p.frontFoot = [30, -20]; p.backFoot = [-24, -13]; p.rotation = .1; p.weaponAngle = -.25 + punch * 1.1; }
    if (d.slam) { p.frontHand = [25, -45]; p.backHand = [20, -61]; p.weaponAngle = 1.1; p.frontFoot = [19, -5]; p.backFoot = [-12, -28]; }
    if (d.kind === 'skill') { p.frontHand = [27 + punch * 34, -58]; p.backHand = [-18, -47]; p.frontFoot = [30, 0]; }
    if (e.team === 'enemy' && d.radial) { p.frontHand = [20 + punch * 15, -100 + punch * 58]; p.backHand = [-12, -83 + punch * 30]; p.weaponAngle = lerp(-1.8, 1, Math.max(0, punch)); }
  }
  // 放长腿部、上移躯干，接近参考图的大头长肢比例，仍保持每段骨骼恒定。
  for (const point of [p.hip, p.neck, p.head, p.shoulder, p.frontHand, p.backHand]) point[1] -= 17;
  // 关键姿态也必须遵守臂展/腿长；夸张动作来自躯干与关节，不能拉长肢体。
  const limit = (root: Point, target: Point, length: number): Point => { const dx = target[0] - root[0], dy = target[1] - root[1], d = Math.hypot(dx, dy); return d > length ? [root[0] + dx / d * length, root[1] + dy / d * length] : target; };
  p.frontFoot = limit(p.hip, p.frontFoot, 60.8); p.backFoot = limit(p.hip, p.backFoot, 60.8);
  p.frontHand = limit([p.shoulder[0] + 3, p.shoulder[1]], p.frontHand, 44.8);
  p.backHand = limit([p.shoulder[0] - 3, p.shoulder[1]], p.backHand, 44.8);
  if (e.weapon === 'staff' || e.weapon === 'hammer') {
    // 两只手在同一刚性武器坐标系内解算；双手距离固定，手臂约束反向修正握点。
    const spacing = e.weapon === 'staff' ? 18 : 14;
    const vector: Point = [Math.cos(p.weaponAngle) * spacing, Math.sin(p.weaponAngle) * spacing];
    for (let i = 0; i < 6; i++) {
      p.frontHand = limit([p.shoulder[0] + 3, p.shoulder[1]], p.frontHand, 44.8);
      const wanted: Point = [p.frontHand[0] - vector[0], p.frontHand[1] - vector[1]];
      const actual = limit([p.shoulder[0] - 3, p.shoulder[1]], wanted, 44.8);
      p.frontHand[0] += actual[0] - wanted[0]; p.frontHand[1] += actual[1] - wanted[1];
    }
    p.backHand = [p.frontHand[0] - vector[0], p.frontHand[1] - vector[1]];
  }
  return p;
}
