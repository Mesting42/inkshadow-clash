import { ENEMIES, LEVELS, WEAPONS } from './data';
import { getPose, joint, type Point } from './animation';
import { clamp, lerp } from './math';
import { drawSkillEffects } from './skill-vfx';
import type { Entity, Settings, WeaponId, World } from './types';

const PALETTES = [
  { sky: '#c17b62', horizon: '#f0bd83', far: '#826d70', middle: '#56535e', front: '#29343f', ground: '#202b33', glow: '#edc08d', line: '#8b8177' },
  { sky: '#1e3549', horizon: '#607b88', far: '#344c5e', middle: '#2a414e', front: '#172a35', ground: '#15262e', glow: '#f1c482', line: '#68848a' },
  { sky: '#424760', horizon: '#a1adb9', far: '#596375', middle: '#3b4b60', front: '#243543', ground: '#1d2c3b', glow: '#e1c6ac', line: '#8b9aa6' },
];
/** 渲染只读取世界。镜头、装饰随机数不会改变战斗与奖励结果。 */
export class Renderer {
  ctx: CanvasRenderingContext2D; camera = 0; cameraY = 0; shake = 0;
  width = 1280; height = 720; private dpr = 1; private menuTime = 0;
  constructor(public canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; this.resize(); window.addEventListener('resize', () => this.resize()); }
  resize() {
    const bounds = this.canvas.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(bounds.width * this.dpr); this.canvas.height = Math.round(bounds.height * this.dpr);
  }
  private reset() {
    // 统一缩放并居中留边，平板/宽屏/高窗口都不能拉长角色或改变骨骼比例。
    const c = this.ctx, scale = Math.min(this.canvas.width / 1280, this.canvas.height / 720);
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#14222e'; c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(scale, 0, 0, scale, (this.canvas.width - 1280 * scale) / 2, (this.canvas.height - 720 * scale) / 2);
  }
  render(w: World, player: Entity, settings: Settings, dt: number, menu = false) {
    this.menuTime += dt; this.reset();
    const c = this.ctx, time = menu ? this.menuTime : w.time;
    c.save(); c.beginPath(); c.rect(0, 0, 1280, 720); c.clip();
    const target = menu ? 180 : clamp(player.x - 530 + player.facing * 65, 0, Math.max(0, w.width - 1280));
    this.camera = lerp(this.camera, target, 1 - Math.exp(-dt * (w.activeGate ? 4 : 6)));
    this.shake = Math.max(0, this.shake - dt * 3);
    this.drawBackground(w.region, this.camera, time);
    c.save();
    if (!menu && settings.shake > 0 && this.shake > 0) c.translate(Math.sin(time * 90) * this.shake * 6 * settings.shake, Math.cos(time * 103) * this.shake * 3 * settings.shake);
    c.translate(-this.camera, 0);
    this.drawPlatforms(w, time);
    this.drawHazards(w, time);
    this.drawCrates(w, !menu);
    for (const drop of w.drops) {
      c.save(); c.translate(drop.x, drop.y - 17 + Math.sin(time * 2 + drop.id) * 3); c.rotate(-.3); this.weapon(drop.weapon, 0, 0, 1); c.restore();
      c.fillStyle = WEAPONS[drop.weapon].color; c.globalAlpha = .4 + Math.sin(time * 3) * .15; c.fillRect(drop.x - 13, drop.y - 5, 26, 2); c.globalAlpha = 1;
      if (!menu && Math.abs(drop.x - player.x) < 80 && Math.abs(drop.y - player.y) < 80) this.label(drop.x, drop.y - 90, `E  ${WEAPONS[drop.weapon].name}`, '#eee2c7');
    }
    for (const g of w.gates) if (g.triggered && !g.cleared) {
      for (const x of [g.left, g.right]) {
        c.fillStyle = '#e8906c22'; c.fillRect(x - 6, 390, 12, 230);
        c.strokeStyle = '#dc9d76'; c.lineWidth = 2; c.setLineDash([8, 9]); c.beginPath(); c.moveTo(x, 390); c.lineTo(x, 620); c.stroke(); c.setLineDash([]);
        c.fillStyle = '#e4b48c'; c.beginPath(); c.moveTo(x - 7, 390); c.lineTo(x, 380); c.lineTo(x + 7, 390); c.fill();
      }
    }
    if (w.exitOpen && w.mode === 'campaign') {
      const x = w.width - 200;
      c.fillStyle = '#9dd0c026'; c.fillRect(x - 24, 405, 52, 215); c.strokeStyle = '#b5d9c4'; c.lineWidth = 3; c.strokeRect(x - 24, 405, 52, 215);
      this.label(x, 385, '下一站  →', '#d4e4cc');
    }
    const actors = [...w.enemies, player].sort((a, b) => (a.team === 'player' ? 1 : 0) - (b.team === 'player' ? 1 : 0));
    for (const e of actors) {
      if (e.state === 'dead' && e.deadTime > 1.5) continue;
      if (menu && e.team === 'player') continue;
      this.drawActor(e, time, settings);
    }
    for (const p of w.projectiles) { c.save(); c.translate(p.x, p.y); c.rotate(time * 18 * Math.sign(p.vx)); this.weapon(p.weapon === 'fist' ? 'discs' : p.weapon, 0, 0, .85); c.restore(); }
    drawSkillEffects(c, w, settings);
    this.drawParticles(w, settings);
    if (w.mode === 'training') { this.label(820, 350, '练习木人 · 命中显示真实伤害', '#d5c6ac'); this.label(1190, 350, '陪练 · 可开启攻防', '#d5c6ac'); }
    c.restore();
    if (menu) {
      c.save(); c.translate(930, 601); c.scale(2.65, 2.65);
      const hero = { ...player, x: 0, y: 0, facing: -1, state: 'idle' as const, weapon: 'staff' as const, grounded: true };
      this.drawActor(hero, time, settings, true); c.restore();
      const shade = c.createLinearGradient(0, 0, 980, 0); shade.addColorStop(0, '#141e2af2'); shade.addColorStop(.48, '#17222bc7'); shade.addColorStop(1, '#15212c00'); c.fillStyle = shade; c.fillRect(0, 0, 1280, 720);
      c.fillStyle = '#101a2555'; c.fillRect(0, 660, 1280, 60);
    }
    // 边缘暗角保护 UI 对比，不覆盖战斗区域中心。
    const v = c.createLinearGradient(0, 0, 0, 720); v.addColorStop(0, '#10202a44'); v.addColorStop(.23, '#10202a00'); v.addColorStop(.8, '#10202a00'); v.addColorStop(1, '#0b152666'); c.fillStyle = v; c.fillRect(0, 0, 1280, 720); c.restore();
  }
  drawBackground(region: number, camera: number, time: number) {
    const c = this.ctx, p = PALETTES[region];
    const sky = c.createLinearGradient(0, 0, 0, 650); sky.addColorStop(0, p.sky); sky.addColorStop(1, p.horizon); c.fillStyle = sky; c.fillRect(0, 0, 1280, 720);
    // 太阳/月轮是场景构图的一部分，所有建筑分层滚动。
    c.fillStyle = region === 0 ? '#f7d6a2' : '#c3d0cf'; c.globalAlpha = region === 0 ? .85 : .35;
    c.beginPath(); c.arc(970 - camera * .04, region === 0 ? 220 : 145, region === 0 ? 85 : 48, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    for (let layer = 0; layer < 3; layer++) {
      const speed = [.1, .25, .46][layer], spacing = [155, 210, 285][layer];
      const offset = camera * speed; c.fillStyle = [p.far, p.middle, p.front][layer];
      for (let i = Math.floor(offset / spacing) - 1; i < Math.floor(offset / spacing) + 11; i++) {
        const hash = Math.abs(Math.sin(i * 117.31 + layer * 78.19));
        const x = i * spacing - offset, h = 100 + hash * (layer === 2 ? 220 : 290), width = spacing * (.65 + hash * .3), base = 530 + layer * 35;
        c.fillStyle = [p.far, p.middle, p.front][layer];
        if (region === 0) {
          c.fillRect(x, base - h, width, h + 200);
          c.beginPath(); c.moveTo(x - 8, base - h + 2); c.lineTo(x + width * .35, base - h - 15); c.lineTo(x + width + 8, base - h - 4); c.lineTo(x + width, base - h + 8); c.closePath(); c.fill();
          if (layer > 0) {
            c.fillRect(x + width * .7, base - h - 45, 12, 45); c.fillRect(x + width * .7 - 9, base - h - 48, 30, 4);
            c.strokeStyle = layer === 2 ? '#75807a44' : '#c8b9a733'; c.lineWidth = 2;
            for (let row = 0; row < Math.floor(h / 47) - 1; row++) for (let col = 0; col < 3; col++) {
              const wx = x + 14 + col * (width - 30) / 3, wy = base - h + 22 + row * 47;
              c.fillStyle = (i + row + col) % 4 === 0 ? '#e4b88066' : '#b1b1a027'; c.fillRect(wx, wy, 16, 22);
              if (layer === 2) { c.strokeRect(wx - 4, wy + 17, 28, 12); c.beginPath(); c.moveTo(wx - 4, wy + 29); c.lineTo(wx - 4, wy + 35); c.stroke(); }
            }
          }
          if (layer === 2 && i % 2 === 0) { c.fillStyle = '#a16b55'; c.fillRect(x + width - 28, base - h + 35, 32, 103); c.fillStyle = '#e4c298'; c.font = 'bold 18px serif'; ['旧', '城', '茶'].forEach((t, n) => c.fillText(t, x + width - 21, base - h + 60 + n * 25)); }
        } else if (region === 1) {
          c.fillRect(x, base - h * .68, width, h * .68 + 180);
          c.beginPath(); c.moveTo(x, base - h * .68); c.lineTo(x + width * .45, base - h * .68 - 38); c.lineTo(x + width * .45, base - h * .68); c.closePath(); c.fill();
          c.fillRect(x + 25, base - h - 55, 24, h + 55); c.fillRect(x + 21, base - h - 55, 32, 9);
          if (layer > 0) {
            c.strokeStyle = '#8fa2a432'; c.lineWidth = 5; c.beginPath(); c.moveTo(x + 60, base - h * .7); c.lineTo(x + 60, base - h * .9); c.lineTo(x + 125, base - h * .9); c.stroke();
            for (let row = 0; row < 3; row++) { c.fillStyle = '#d9b57433'; c.fillRect(x + 20, base - 150 + row * 37, width - 35, 13); }
            if (i % 2 === 0) { c.fillStyle = '#dfa565'; c.fillRect(x + 80, base - h * .68 + 6, 8, 5); const g = c.createRadialGradient(x + 84, base - h * .68 + 10, 0, x + 84, base - h * .68 + 10, 90); g.addColorStop(0, '#e6b57222'); g.addColorStop(1, '#e6b57200'); c.fillStyle = g; c.fillRect(x, base - h * .68, 170, 100); }
          }
        } else {
          const top = base - h * 1.4;
          c.beginPath(); c.moveTo(x, base + 200); c.lineTo(x + width * .12, top + 40); c.lineTo(x + width * .5, top - 35); c.lineTo(x + width * .88, top + 40); c.lineTo(x + width, base + 200); c.fill();
          c.fillStyle = '#a9b8bd18'; for (let j = 0; j < 5; j++) c.fillRect(x + 18 + j * width / 6, top + 80, 5, h * 1.4);
          if (layer === 2) { c.strokeStyle = '#8495a84a'; c.lineWidth = 3; c.strokeRect(x - 10, top + 130, width + 30, 19); c.beginPath(); c.moveTo(x + width / 2, top + 25); c.lineTo(x + width / 2, top - 55); c.stroke(); }
        }
      }
    }
    if (region === 0) {
      // 跨街电缆、屋顶天线与飞鸟建立旧街的纵深。
      c.strokeStyle = '#1f2f3b88'; c.lineWidth = 2;
      for (let j = 0; j < 3; j++) { const shift = camera * .5 % 900; c.beginPath(); c.moveTo(-150 - shift, 200 + j * 17); c.quadraticCurveTo(500 - shift, 350 + j * 15, 1400 - shift, 180 + j * 20); c.stroke(); }
      c.strokeStyle = '#4a4c57'; c.lineWidth = 1.5; for (let i = 0; i < 8; i++) { const x = (i * 171 + time * 8 - camera * .03) % 1400; const y = 130 + Math.sin(i * 7.1) * 50; c.beginPath(); c.moveTo(x - 5, y - 2); c.quadraticCurveTo(x, y - 5 - Math.sin(time * 3 + i) * 2, x, y); c.quadraticCurveTo(x + 3, y - 4, x + 7, y - 1); c.stroke(); }
    }
    if (region === 1) {
      c.strokeStyle = '#c1d9dd2e'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 95; i++) { const x = (i * 127 + time * 95) % 1400 - 80, y = (i * 73 + time * 520) % 740; c.moveTo(x, y); c.lineTo(x - 8, y + 20); } c.stroke();
    }
    if (region === 2) {
      c.fillStyle = '#c8d5dc13'; for (let i = 0; i < 5; i++) { const x = (i * 390 + time * 13 - camera * .06) % 1700 - 250; c.beginPath(); c.ellipse(x, 220 + i * 75, 250, 18, -.04, 0, Math.PI * 2); c.fill(); }
    }
  }
  private drawPlatforms(w: World, time: number) {
    const c = this.ctx, p = PALETTES[w.region];
    for (const platform of w.platforms) {
      if (platform.x > this.camera + 1350 || platform.x + platform.w < this.camera - 80) continue;
      c.fillStyle = p.ground; c.fillRect(platform.x, platform.y, platform.w, platform.h);
      c.fillStyle = w.region === 0 ? '#a28f7c' : w.region === 1 ? '#768f96' : '#9aa5ab'; c.fillRect(platform.x, platform.y, platform.w, 4);
      c.fillStyle = '#0d1b2480'; c.fillRect(platform.x, platform.y + 4, platform.w, 8);
      if (platform.oneWay) {
        if (w.region === 0) { c.strokeStyle = '#202f39'; c.lineWidth = 5; c.beginPath(); c.moveTo(platform.x + 20, platform.y + 17); c.lineTo(platform.x + 60, platform.y + 63); c.moveTo(platform.x + platform.w - 20, platform.y + 17); c.lineTo(platform.x + platform.w - 60, platform.y + 63); c.stroke(); }
        else { c.strokeStyle = '#82969b66'; c.lineWidth = 2; c.beginPath(); c.moveTo(platform.x + 10, platform.y + 15); c.lineTo(platform.x + platform.w - 10, platform.y + 15); c.stroke(); for (let j = 25; j < platform.w; j += 45) { c.beginPath(); c.moveTo(platform.x + j, platform.y + 18); c.lineTo(platform.x + j + 15, platform.y + 42); c.lineTo(platform.x + j + 30, platform.y + 18); c.stroke(); } }
        if (platform.conveyor) { c.fillStyle = '#c2b68f'; for (let x = 10; x < platform.w; x += 35) c.fillRect(platform.x + (x + time * 65) % platform.w, platform.y + 7, 10, 2); }
      } else {
        c.strokeStyle = '#66747729'; c.lineWidth = 1; for (let x = Math.max(platform.x, Math.floor(this.camera / 100) * 100); x < Math.min(platform.x + platform.w, this.camera + 1360); x += 100) { c.beginPath(); c.moveTo(x, platform.y + 18); c.lineTo(x + 90, platform.y + 18); c.moveTo(x + 50, platform.y + 18); c.lineTo(x + 50, platform.y + 42); c.stroke(); }
        if (w.region === 1) { c.fillStyle = '#b4c7c515'; for (let x = platform.x + 30; x < platform.x + platform.w; x += 170) { c.beginPath(); c.ellipse(x, platform.y + 10, 45, 2, 0, 0, Math.PI * 2); c.fill(); } }
      }
    }
    // 前景街灯与塔梁固定于世界，不参与碰撞。
    for (let x = 630; x < w.width; x += 1570) {
      if (x < this.camera - 100 || x > this.camera + 1400) continue;
      c.fillStyle = '#23313b'; c.fillRect(x, 360, 7, 260); c.strokeStyle = '#23313b'; c.lineWidth = 7; c.beginPath(); c.moveTo(x + 3, 360); c.quadraticCurveTo(x + 4, 330, x + 40, 340); c.stroke(); c.fillStyle = p.glow; c.fillRect(x + 28, 340, 26, 5);
    }
  }
  private drawCrates(w: World, labels = true) {
    const c = this.ctx;
    for (const box of w.crates) {
      if (box.opened || box.x < this.camera - 60 || box.x > this.camera + 1340) continue;
      c.save(); c.translate(box.x, box.y); c.fillStyle = box.reward ? '#7e684b' : '#65584c'; c.fillRect(-22, -44, 44, 44); c.fillStyle = box.reward ? '#d2b57e' : '#a28c6c'; c.fillRect(-24, -44, 48, 5); c.fillRect(-24, -6, 48, 6);
      c.strokeStyle = '#292e30'; c.lineWidth = 3; c.strokeRect(-22, -41, 44, 40); c.beginPath(); c.moveTo(-18, -36); c.lineTo(18, -8); c.moveTo(18, -36); c.lineTo(-18, -8); c.stroke();
      if (box.reward) { c.fillStyle = '#ead2a5'; c.fillRect(-6, -29, 12, 12); if (labels) this.label(0, -62, '支路补给', '#e4c691'); }
      c.restore();
    }
  }
  private drawHazards(w: World, time: number) {
    const c = this.ctx;
    for (const h of w.hazards) {
      const t = (time + h.phase) % h.period, warning = t > h.period - 1.5 && t < h.period - .55, active = t >= h.period - .55;
      if (h.kind === 'wind') { c.strokeStyle = '#c5dedb55'; c.lineWidth = 2; for (let i = 0; i < 4; i++) { const y = h.y - (time * 85 + i * 43) % 190; c.beginPath(); c.moveTo(h.x + 40 + i * 65, y); c.quadraticCurveTo(h.x + 50 + i * 65, y - 30, h.x + 35 + i * 65, y - 55); c.stroke(); } continue; }
      c.fillStyle = '#343e43'; c.fillRect(h.x, h.y - 5, h.w, 9); c.fillStyle = active ? '#e78669' : warning ? '#e2b16d' : '#8f9c96';
      for (let i = 0; i < h.w; i += 18) c.fillRect(h.x + i, h.y - 8, 10, 4);
      if (warning) { c.fillStyle = '#e4ae6a22'; c.fillRect(h.x, h.y - 100, h.w, 100); this.label(h.x + h.w / 2, h.y - 115, '机关预警', '#f1c38a'); }
      if (active) {
        c.fillStyle = '#e6b37655'; c.fillRect(h.x + 5, h.y - 120, h.w - 10, 120);
        c.strokeStyle = '#f2d2a3'; c.lineWidth = 2; c.beginPath(); c.moveTo(h.x + h.w / 2, h.y - 125); for (let i = 0; i < 6; i++) c.lineTo(h.x + h.w / 2 + Math.sin(time * 80 + i * 7) * 35, h.y - 120 + i * 24); c.stroke();
      }
    }
  }
  drawActor(e: Entity, time: number, settings: Settings, decorative = false) {
    const c = this.ctx, p = getPose(e, time);
    const scale = e.boss ? (e.type === 'gatekeeper' ? 1.42 : 1.23) : e.type === 'brute' ? 1.2 : 1;
    const color = e.team === 'player' ? '#eb705a' : ENEMIES[e.type].color;
    const armor = e.type === 'brute' || e.type === 'gatekeeper';
    c.save(); c.translate(e.x, e.y);
    if (!decorative) { c.fillStyle = '#101c2855'; c.beginPath(); c.ellipse(0, 2, 25 * scale, 5, 0, 0, Math.PI * 2); c.fill(); }
    c.scale(e.facing * scale, scale);
    if (e.invuln > 0 && e.state !== 'dodge' && Math.sin(time * 30) > .4) c.globalAlpha = .57;
    if (e.state === 'dead') c.globalAlpha = clamp(1 - e.deadTime / 1.6, 0, 1);
    if (e.state === 'dodge') {
      c.save(); c.globalAlpha = .14 * settings.effects; for (let i = 1; i <= 3; i++) { c.fillStyle = color; c.beginPath(); c.ellipse(-i * 20 + 12, -45, 15, 35, .8, 0, Math.PI * 2); c.fill(); } c.restore();
    }
    if (e.state === 'down' || e.state === 'dead') { c.translate(0, -14); c.rotate(p.rotation); c.translate(0, 40); } else c.rotate(p.rotation);
    const outline = e.flash > 0 && settings.flash > .05 ? '#d9d7c9' : '#3d484b';
    const body = e.flash > 0 && settings.flash > .05 ? '#f4e9d1' : '#1d2527';
    const strokeBone = (points: Point[], thickness: number, fill = body) => {
      c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = outline; c.lineWidth = thickness + 1.5; c.stroke(); c.strokeStyle = fill; c.lineWidth = thickness; c.stroke();
    };
    const leg = (foot: Point, back: boolean) => { const knee = joint(p.hip, foot, 30, 31, back ? 1 : -1); strokeBone([p.hip, knee, foot], armor ? 12 : 8, back ? '#232c2e' : body); c.fillStyle = body; c.save(); c.translate(foot[0], foot[1]); c.beginPath(); c.ellipse(3, 0, 10, 4, 0, 0, Math.PI * 2); c.fill(); c.restore(); };
    const twoHanded = e.weapon === 'staff' || e.weapon === 'hammer';
    const arm = (hand: Point, back: boolean) => {
      const shoulder: Point = [p.shoulder[0] + (back ? -3 : 3), p.shoulder[1]];
      const elbow = joint(shoulder, hand, 22, 23, 1);
      strokeBone([shoulder, elbow, hand], armor ? 11 : 7, back ? '#202c36' : body);
      c.save(); c.translate(hand[0], hand[1]); c.rotate(Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]));
      c.fillStyle = color; c.fillRect(-10, -4.5, 6, 9);
      // 持械时先画前臂，手指在武器之后绘制，形成真实包握遮挡。
      if (e.weapon === 'fist' || back && !twoHanded && e.weapon !== 'blades') { c.fillStyle = body; c.beginPath(); c.ellipse(1, 0, armor ? 8 : 5, armor ? 7 : 5, 0, 0, Math.PI * 2); c.fill(); }
      c.restore();
    };
    const grip = (hand: Point, angle: number) => {
      c.save(); c.translate(hand[0], hand[1]); c.rotate(angle);
      c.fillStyle = '#25302f'; c.strokeStyle = '#69716a'; c.lineWidth = .9;
      c.beginPath(); c.roundRect(-4.5, -6.2, 9, 12.4, 3); c.fill(); c.stroke();
      // 三道弯指压住握柄，拇指横向扣住，杆身从拳头两端连续伸出。
      c.strokeStyle = '#b9b7a3'; c.lineWidth = .85;
      for (const finger of [-2.5, 0, 2.5]) { c.beginPath(); c.moveTo(finger, -4.5); c.quadraticCurveTo(finger + 1, -1, finger, 2.5); c.stroke(); }
      c.strokeStyle = '#788174'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-3, 4); c.lineTo(3.5, 1.5); c.stroke(); c.restore();
    };
    // 披风根部绑定肩颈，尾部受移动与出招影响。它始终在身体后层绘制。
    if (e.team === 'player') {
      const speed = Math.abs(e.vx), flutter = Math.sin(time * (6 + speed * .012) + e.id) * 7;
      const wind = Math.min(26, speed * .06), root = p.neck;
      c.fillStyle = '#b63f37'; c.beginPath(); c.moveTo(root[0] - 7, root[1] - 2); c.lineTo(root[0] + 5, root[1] + 4);
      c.quadraticCurveTo(root[0] - 14, root[1] + 25, root[0] - 16 - wind, root[1] + 52 + flutter * .3);
      c.lineTo(root[0] - 29 - wind, root[1] + 46 + flutter); c.lineTo(root[0] - 40 - wind, root[1] + 51 + flutter * .5);
      c.quadraticCurveTo(root[0] - 31 - wind * .7, root[1] + 18 + flutter, root[0] - 7, root[1] - 2); c.fill();
      c.fillStyle = '#e96450'; c.beginPath(); c.moveTo(root[0] - 7, root[1]); c.quadraticCurveTo(root[0] - 27, root[1] + 20, root[0] - 29 - wind, root[1] + 46 + flutter); c.quadraticCurveTo(root[0] - 14, root[1] + 23, root[0] + 5, root[1] + 4); c.fill();
      c.strokeStyle = '#f38a6b'; c.lineWidth = 1; c.beginPath(); c.moveTo(root[0] - 7, root[1] + 4); c.quadraticCurveTo(root[0] - 18, root[1] + 20, root[0] - 22 - wind * .7, root[1] + 36 + flutter * .5); c.stroke();
    }
    leg(p.backFoot, true); arm(p.backHand, true);
    strokeBone([p.hip, [p.hip[0] + 1, p.hip[1] - 13], p.neck], armor ? 19 : 12);
    if (armor) { c.fillStyle = '#47515a'; c.beginPath(); c.moveTo(p.shoulder[0] - 16, p.shoulder[1] - 6); c.lineTo(p.shoulder[0] + 15, p.shoulder[1] - 4); c.lineTo(p.hip[0] + 13, p.hip[1] - 7); c.lineTo(p.hip[0] - 11, p.hip[1] - 7); c.closePath(); c.fill(); c.strokeStyle = color; c.lineWidth = 2; c.beginPath(); c.moveTo(p.shoulder[0] - 10, p.shoulder[1]); c.lineTo(p.hip[0] + 8, p.hip[1] - 8); c.stroke(); }
    c.fillStyle = color; c.fillRect(p.hip[0] - 8, p.hip[1] - 3, 16, 4);
    leg(p.frontFoot, false);
    // 围巾拥有固定根节点和随速度摆动的尾部，不影响判定。
    if (e.boss || e.type === 'assassin') {
      const root = p.neck, tail = Math.sin(time * 5 + e.id) * 7 + (Math.abs(e.vx) > 80 ? -9 : 0);
      c.fillStyle = color; c.beginPath(); c.moveTo(root[0] + 7, root[1] - 1); c.lineTo(root[0] - 9, root[1] - 3); c.quadraticCurveTo(root[0] - 25, root[1] - 4 + tail, root[0] - 50, root[1] + 3 + tail); c.lineTo(root[0] - 36, root[1] + 10 + tail); c.quadraticCurveTo(root[0] - 20, root[1] + 5, root[0] - 5, root[1] + 6); c.lineTo(root[0] + 7, root[1] + 4); c.fill();
    }
    // 浅色椭圆脸、黑色轮廓与表情来自用户造型参考，不使用头带。
    const face = e.flash > 0 && settings.flash > .05 ? '#fff7df' : e.team === 'player' ? '#eee9d8' : e.type === 'dummy' ? '#bda882' : '#d6d4c4';
    c.fillStyle = face; c.strokeStyle = '#222b2a'; c.lineWidth = 3.5; c.beginPath(); c.ellipse(p.head[0], p.head[1], 16.5, 20.5, -.08, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#252e2c';
    const eyeY = p.head[1] - 3, eyeX = p.head[0] + 5;
    c.beginPath(); c.ellipse(eyeX, eyeY, 1.8, e.state === 'hurt' || e.state === 'dead' ? 1 : 3, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(eyeX + 8, eyeY - 1, 1.6, 2.8, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#252e2c'; c.lineWidth = 1.8; c.lineCap = 'round'; c.beginPath(); c.moveTo(eyeX - 4, eyeY - 7); c.lineTo(eyeX + 3, eyeY - 5); c.moveTo(eyeX + 7, eyeY - 6); c.lineTo(eyeX + 13, eyeY - 10); c.stroke();
    c.lineWidth = 1.5; c.beginPath(); c.moveTo(eyeX, p.head[1] + 9); c.lineTo(eyeX + 6, p.head[1] + 11); c.lineTo(eyeX + 12, p.head[1] + (e.state === 'attack' ? 5 : 7)); c.stroke();
    if (e.type === 'commander' || e.type === 'shadowlord') { c.fillStyle = color; c.beginPath(); c.moveTo(p.head[0] - 13, p.head[1] - 9); c.lineTo(p.head[0] + 4, p.head[1] - 18); c.lineTo(p.head[0] + 15, p.head[1] - 5); c.lineTo(p.head[0] - 13, p.head[1] - 4); c.fill(); }
    if (e.type === 'support') { c.strokeStyle = color; c.lineWidth = 2; c.strokeRect(p.hip[0] - 16, p.hip[1] - 25, 9, 18); c.fillStyle = '#bddfc1'; c.fillRect(p.hip[0] - 14, p.hip[1] - 21, 5, 5); }
    if (e.type === 'shield') { c.fillStyle = '#526572'; c.strokeStyle = color; c.lineWidth = 2; c.beginPath(); c.moveTo(16, -75); c.lineTo(39, -67); c.lineTo(36, -32); c.lineTo(25, -23); c.lineTo(15, -36); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = '#d0b88c'; c.beginPath(); c.moveTo(26, -63); c.lineTo(26, -34); c.stroke(); }
    if (e.attack && e.attack.time >= e.attack.def.startup && e.attack.time < e.attack.def.startup + e.attack.def.active && settings.effects > .05) {
      const d = e.attack.def, r = Math.min(d.reach, 210); c.save(); c.globalAlpha = .7 * settings.effects; c.strokeStyle = e.team === 'player' ? '#f3d6aa' : '#e0a58a'; c.lineWidth = e.weapon === 'hammer' ? 10 : 5;
      c.beginPath(); if (d.radial) c.ellipse(0, -15, r, 15, 0, 0, Math.PI * 2); else c.arc(8, -48, r * .85, -.9, .6); c.stroke(); c.lineWidth = 1; c.strokeStyle = '#fff1d5'; c.stroke(); c.restore();
    }
    arm(p.frontHand, false);
    if (e.weapon !== 'fist') {
      c.save(); c.translate(p.frontHand[0], p.frontHand[1]); c.rotate(p.weaponAngle); this.weapon(e.weapon, 0, 0, 1); c.restore();
      if (e.weapon === 'blades') { c.save(); c.translate(p.backHand[0], p.backHand[1]); c.rotate(-2.5); this.weapon('blades', 0, 0, .9); c.restore(); grip(p.backHand, -2.5); }
      if (twoHanded) grip(p.backHand, p.weaponAngle);
      grip(p.frontHand, p.weaponAngle);
    }
    c.restore();
    if (decorative || e.hp <= 0) return;
    if (e.team === 'enemy' && !e.boss && e.type !== 'dummy') {
      const bar = e.elite ? 66 : 44; c.fillStyle = '#14212b'; c.fillRect(e.x - bar / 2, e.y - 120 * scale, bar, 4); c.fillStyle = e.elite ? '#e8ba7a' : color; c.fillRect(e.x - bar / 2, e.y - 120 * scale, bar * e.hp / e.maxHp, 4);
      if (e.elite) this.label(e.x, e.y - 134 * scale, '精英 · 强韧', '#edc590');
    }
    if (e.team === 'enemy' && e.attack && e.attack.time < e.attack.def.startup) {
      const d = e.attack.def, t = e.attack.time / d.startup;
      c.strokeStyle = d.unblockable ? '#f28b82' : '#f0c184'; c.lineWidth = 2.5; c.beginPath(); c.arc(e.x, e.y - 120 * scale, 8, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2); c.stroke();
      c.fillStyle = d.unblockable ? '#f28b82' : '#f0c184';
      if (d.unblockable) { c.beginPath(); c.moveTo(e.x, e.y - 155 * scale); c.lineTo(e.x + 8, e.y - 141 * scale); c.lineTo(e.x - 8, e.y - 141 * scale); c.fill(); }
      else { c.fillRect(e.x - 1.5, e.y - 150 * scale, 3, 9); c.fillRect(e.x - 1.5, e.y - 138 * scale, 3, 3); }
    }
    if (e.state === 'block') { c.strokeStyle = e.blockTime < .16 ? '#c1eee1' : '#a5b9c1'; c.lineWidth = 2; c.beginPath(); c.ellipse(e.x + e.facing * 30, e.y - 55, 8, 30, .15 * e.facing, 0, Math.PI * 2); c.stroke(); }
  }
  weapon(id: WeaponId, x: number, y: number, scale = 1) {
    const c = this.ctx; c.save(); c.translate(x, y); c.scale(scale, scale); c.lineCap = 'round';
    const butt = id === 'staff' ? -31 : id === 'hammer' ? -24 : -9;
    c.strokeStyle = '#24303a'; c.lineWidth = id === 'staff' ? 6 : 8; c.beginPath(); c.moveTo(butt, 0); c.lineTo(id === 'staff' ? 85 : id === 'hammer' ? 47 : 45, 0); c.stroke();
    c.strokeStyle = WEAPONS[id].color; c.lineWidth = id === 'staff' ? 3 : 5; c.beginPath(); c.moveTo(butt, 0); c.lineTo(id === 'staff' ? 85 : id === 'hammer' ? 47 : 45, 0); c.stroke();
    if (id === 'hammer') { c.fillStyle = '#76838a'; c.fillRect(35, -17, 24, 34); c.fillStyle = '#b3b8af'; c.fillRect(35, -17, 24, 4); c.fillStyle = '#d3a975'; c.fillRect(44, -13, 5, 26); }
    if (id === 'blades') { c.fillStyle = '#ced9dc'; c.beginPath(); c.moveTo(8, -4); c.lineTo(51, -6); c.lineTo(42, 2); c.lineTo(8, 4); c.closePath(); c.fill(); c.fillStyle = '#677b8c'; c.fillRect(6, -8, 4, 16); }
    if (id === 'discs') { c.fillStyle = '#263744'; c.strokeStyle = '#d9c68b'; c.lineWidth = 4; c.beginPath(); c.arc(15, 0, 13, 0, Math.PI * 2); c.fill(); c.stroke(); c.strokeStyle = '#f1dfb4'; c.lineWidth = 1; c.beginPath(); c.arc(15, 0, 8, 0, Math.PI * 2); c.stroke(); }
    if (id === 'staff') { c.fillStyle = '#d4d6b8'; c.fillRect(76, -4, 12, 8); c.fillRect(-33, -4, 9, 8); }
    c.strokeStyle = '#273642'; c.lineWidth = 1.5; for (let i = -5; i < 8; i += 3) { c.beginPath(); c.moveTo(i, -3); c.lineTo(i + 3, 3); c.stroke(); }
    c.restore();
  }
  private drawParticles(w: World, settings: Settings) {
    const c = this.ctx;
    for (const p of w.particles) {
      c.globalAlpha = clamp(p.life / p.max, 0, 1); c.fillStyle = p.color; c.strokeStyle = p.color;
      if (p.kind === 'text') { c.font = 'bold 15px "Microsoft YaHei", sans-serif'; c.textAlign = 'center'; c.fillText(p.text || '', p.x, p.y); }
      else if (settings.effects > .05 && p.kind === 'spark') { c.lineWidth = p.size; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * .025, p.y - p.vy * .025); c.stroke(); }
      else if (settings.effects > .05 && p.kind === 'ring') { c.lineWidth = 2; c.beginPath(); c.ellipse(p.x, p.y, (1 - p.life / p.max) * p.size, 7, 0, 0, Math.PI * 2); c.stroke(); }
      else if (settings.effects > .05) { c.beginPath(); c.arc(p.x, p.y, p.size * p.life / p.max, 0, Math.PI * 2); c.fill(); }
    }
    c.globalAlpha = 1;
  }
  label(x: number, y: number, text: string, color = '#e5d5b5') {
    const c = this.ctx; c.save(); c.font = '13px "Microsoft YaHei", sans-serif'; c.textAlign = 'center'; const width = c.measureText(text).width; c.fillStyle = '#182733d9'; c.fillRect(x - width / 2 - 9, y - 17, width + 18, 25); c.fillStyle = color; c.fillText(text, x, y); c.restore();
  }
}
