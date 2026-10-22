import { SKILLS } from './data';
import { SKILL_GLYPHS } from './icons';
import { clamp } from './math';
import type { Entity, Settings, World } from './types';

/** 只在技能有效帧首帧生成一次；判定模块和粒子模块均不能从视觉反推伤害。 */
export function spawnSkillEffect(w: World, e: Entity) {
  w.skillEffects.push({ skill: e.skill, x: e.x, y: e.y, facing: e.facing, age: 0, duration: e.skill === 'quake' ? .72 : e.skill === 'shadow' ? .48 : .44, radius: e.attack?.def.reach || 170 });
  w.skillEffects = w.skillEffects.slice(-12);
}
export function updateSkillEffects(w: World, dt: number) {
  for (const effect of w.skillEffects) effect.age += dt;
  w.skillEffects = w.skillEffects.filter(effect => effect.age < effect.duration);
}

const paths = new Map<string, Path2D>();
function glyph(c: CanvasRenderingContext2D, skill: string, x: number, y: number, scale: number, fill: string, alpha: number) {
  if (!paths.has(skill)) paths.set(skill, new Path2D(SKILL_GLYPHS[skill]));
  c.save(); c.translate(x, y); c.scale(scale, scale); c.translate(-36, -36);
  c.globalAlpha = alpha; c.fillStyle = fill; c.fill(paths.get(skill)!); c.restore();
}

/** 帧内统一绘制。形状来源与 UI 共用，特效强度为零时仍保留淡色轮廓。 */
export function drawSkillEffects(c: CanvasRenderingContext2D, w: World, settings: Settings) {
  const strength = .35 + settings.effects * .65;
  for (const e of w.skillEffects) {
    const t = clamp(e.age / e.duration, 0, 1), fade = (1 - t) ** .7 * strength, color = SKILLS[e.skill].color;
    c.save(); c.translate(e.x, e.y); c.scale(e.facing, 1); c.strokeStyle = color; c.lineJoin = 'round'; c.lineCap = 'round';
    if (e.skill === 'palm') {
      const travel = 35 + t * 105;
      // 放大的掌印向前推出，三层轮廓表示冲击传播而非额外命中。
      for (let i = 2; i >= 0; i--) glyph(c, 'palm', travel - i * 23, -65, 1.1 + t * .45 - i * .08, color, fade * (i === 0 ? .68 : .12));
      c.globalAlpha = fade * .7; c.lineWidth = 2.5;
      c.beginPath(); c.ellipse(travel + 18, -62, 14 + t * 10, 40 + t * 16, -.12, -.9, .9); c.stroke();
      c.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) { const y = -100 + i * 18; c.beginPath(); c.moveTo(travel - 55, y); c.lineTo(travel - 18, y - 3); c.stroke(); }
    } else if (e.skill === 'shadow') {
      const head = t * 230;
      // 疾影图标分解为连续刃形，沿突进轴留下短促、方向明确的残像。
      for (let i = 0; i < 4; i++) glyph(c, 'shadow', head - i * 48 - 25, -62, 1.2 - i * .12, color, fade * (.55 - i * .1));
      c.globalAlpha = fade * .8; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-45, -30); c.quadraticCurveTo(head * .6, -50, head + 105, -112); c.stroke();
      c.lineWidth = 1.5; c.beginPath(); c.moveTo(-35, -110); c.quadraticCurveTo(head * .5, -75, head + 105, -28); c.stroke();
      c.globalAlpha = fade * .16; c.fillStyle = color;
      for (let i = 1; i < 4; i++) { const x = head - i * 60; c.beginPath(); c.ellipse(x, -100, 12, 15, .1, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(x, -83); c.lineTo(x - 10, -51); c.lineTo(x + 19, -10); c.lineTo(x + 9, -49); c.lineTo(x + 16, -78); c.closePath(); c.fill(); }
    } else {
      const radius = e.radius * Math.sin(Math.min(1, t * 1.5) * Math.PI / 2);
      glyph(c, 'quake', 0, -28, .85 + t * .7, color, fade * .55);
      c.globalAlpha = fade * .8; c.lineWidth = 3; c.beginPath(); c.ellipse(0, -3, radius, 12 + t * 12, 0, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = fade * .35; c.lineWidth = 1.4; c.beginPath(); c.ellipse(0, -2, radius * .72, 9 + t * 9, 0, 0, Math.PI * 2); c.stroke();
      // 裂纹受固定散列约束，每次形态稳定，随年龄退场，不永久添加场景对象。
      c.globalAlpha = fade * .75;
      for (let side = -1; side <= 1; side += 2) for (let i = 0; i < 4; i++) {
        const start = 17 + i * 28, height = Math.sin(i * 7.1 + 1) * 7;
        c.beginPath(); c.moveTo(side * start, 1); c.lineTo(side * (start + 19) * (1 + t * .3), 5 + height); c.lineTo(side * (start + 37) * (1 + t * .4), 0); c.stroke();
        const rockX = side * (35 + i * 33) * (.6 + t), rockY = -Math.sin(t * Math.PI) * (28 + i * 9);
        c.fillStyle = i % 2 === 0 ? '#a39c8c' : '#d5b48a'; c.save(); c.translate(rockX, rockY); c.rotate(t * (i + 1) * side); c.fillRect(-3, -3, 5 + i, 5); c.restore();
      }
    }
    c.restore();
  }
}
