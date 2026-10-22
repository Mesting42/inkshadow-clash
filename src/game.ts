import { AudioEngine } from './audio';
import { attackPlayer, canAct, dodge, tickEntity } from './actions';
import { combatStep, damage, updateProjectiles } from './combat';
import { DEFAULT_BINDINGS, ENEMIES, LEVELS, PERKS, SKILLS, WEAPONS } from './data';
import { createEntity, maxHealth, nextId, setState } from './entities';
import { Input } from './input';
import { clamp, random } from './math';
import { integrate, movePlayer, tryJump } from './movement';
import { Renderer } from './renderer';
import { applyPerk, rewardChoices } from './rewards';
import { readSave, writeSave } from './storage';
import { addDrop, createWorld, recoverFallen, spawnArena, spawnGate } from './world';
import { updateAI } from './ai';
import { updateSkillEffects } from './skill-vfx';
import type { AttackKind, Checkpoint, Entity, GameEvents, Mode, SkillId, WeaponId, World } from './types';

export type Screen = 'menu' | 'playing' | 'pause' | 'settings' | 'controls' | 'tutorial' | 'reward' | 'shop' | 'result' | 'chapters' | 'equipment';
/** 应用状态只组织系统；命中、移动、AI、绘制分别由专属模块负责。 */
export class Game {
  save = readSave(); input: Input; audio: AudioEngine; renderer: Renderer;
  player = createEntity('fighter', 200, 620, true); world: World = createWorld('campaign', 0, 1688);
  screen: Screen = 'menu'; previousScreen: Screen = 'menu';
  coins = 0; kills = 0; score = 0; totalTime = 0; combo = 0; comboTime = 0; bestCombo = 0;
  rewardList = PERKS.slice(0, 3); rewardAfter: 'play' | 'shop' | 'wave' = 'play';
  resultWin = false; resultTitle = ''; resultReason = ''; trainingAttack = false;
  trainingDamage = 0; trainingHits = 0; trainingStart = 0;
  shopStock: WeaponId[] = []; shopBought = new Set<string>();
  onChange: () => void = () => {}; onHud: () => void = () => {}; onNotice: (text: string) => void = () => {};
  private buffer: { kind: AttackKind; until: number } | null = null;
  private hitstop = 0; private hudClock = 0; private stepClock = 0; private victoryTimer = 0;
  private hazardCooldown = new Map<number, number>(); private stageStart: Checkpoint | null = null;
  events: GameEvents;
  constructor(canvas: HTMLCanvasElement) {
    this.input = new Input(this.save.settings.bindings); this.audio = new AudioEngine(this.save.settings); this.renderer = new Renderer(canvas);
    this.events = {
      effect: (x, y, color, amount = 8) => this.effect(x, y, color, amount),
      text: (x, y, value, color = '#efcda0') => this.world.particles.push({ x, y, vx: 0, vy: -25, life: .85, max: .85, color, size: 15, kind: 'text', text: value }),
      sound: (name, power) => this.audio.play(name, power),
      impact: power => { this.renderer.shake = Math.max(this.renderer.shake, power); this.hitstop = Math.min(.045, .015 + power * .035); },
      kill: (e, source) => this.onKill(e, source),
      hit: (source, target, amount) => this.onHit(source, target, amount),
    };
    this.input.onPause = () => this.togglePause();
    window.addEventListener('blur', () => this.autoPause());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autoPause(); });
    window.addEventListener('resize', () => { if (this.isPortrait()) this.autoPause(); });
  }
  isPortrait() { return (this.save.settings.showTouch || window.matchMedia('(pointer: coarse)').matches) && window.innerHeight > window.innerWidth; }
  setScreen(screen: Screen) {
    this.screen = screen; this.input.clear(); this.buffer = null;
    if (screen === 'playing') this.audio.resume(); else this.audio.pause();
    this.onChange(); this.onHud();
  }
  start(mode: Mode, resume = false, level = 0) {
    this.audio.unlock(); this.audio.clear();
    this.player = createEntity('fighter', mode === 'campaign' ? 190 : 490, 620, true);
    const saved = resume ? this.save.checkpoint : null;
    this.coins = 0; this.kills = 0; this.score = 0; this.totalTime = 0; this.bestCombo = 0; this.combo = 0; this.comboTime = 0;
    this.victoryTimer = 0; this.hitstop = 0; this.hazardCooldown.clear(); this.trainingAttack = false; this.trainingDamage = 0; this.trainingHits = 0;
    if (saved && mode === 'campaign') {
      level = saved.level; this.restorePlayer(saved); this.coins = saved.coins; this.kills = saved.kills; this.totalTime = saved.time;
    }
    const seed = saved?.seed ?? (Date.now() >>> 0);
    this.world = createWorld(mode, level, seed); this.renderer.camera = 0;
    if (mode === 'training') { this.player.invuln = 100000; this.player.weapon = 'baton'; this.player.durability = 999; }
    if (mode === 'campaign') this.checkpoint();
    this.setScreen(mode === 'campaign' && level === 0 && !this.save.tutorial ? 'tutorial' : 'playing');
    this.onNotice(mode === 'campaign' ? `${LEVELS[level].name} · 沿街向右前进` : mode === 'arena' ? '第一波 · 站稳脚步' : '训练场 · 试试上挑与空中追击');
  }
  private restorePlayer(c: Checkpoint) {
    const p = this.player; p.perks = { ...c.perks }; p.maxHp = maxHealth(p); p.hp = Math.min(p.maxHp, Math.max(60, c.hp));
    p.weapon = c.weapon; p.durability = c.durability; if (p.weapon !== 'fist' && p.durability <= 0) p.weapon = 'fist';
    p.skill = c.skill; p.energy = 100; p.revive = c.revive; p.invuln = 1.5;
  }
  private snapshot(): Checkpoint {
    const p = this.player;
    return { level: this.world.level, seed: this.world.seed, hp: p.hp, energy: 100, coins: this.coins, weapon: p.weapon, durability: p.durability, skill: p.skill, perks: { ...p.perks }, revive: p.revive, time: this.totalTime, kills: this.kills };
  }
  checkpoint() {
    if (this.world.mode !== 'campaign') return;
    this.save.checkpoint = this.snapshot(); this.stageStart = structuredClone(this.save.checkpoint);
    if (!writeSave(this.save)) this.onNotice('浏览器存储不可用，本局仍可正常游玩');
  }
  retry() {
    if (this.world.mode !== 'campaign') { this.start(this.world.mode); return; }
    if (this.stageStart) this.save.checkpoint = structuredClone(this.stageStart);
    this.start('campaign', true);
  }
  menu() { this.audio.clear(); this.world.projectiles = []; this.world.particles = []; this.world.skillEffects = []; this.setScreen('menu'); }
  togglePause() {
    if (this.screen === 'playing') this.setScreen('pause');
    else if (['pause', 'controls', 'equipment'].includes(this.screen)) this.setScreen('playing');
    else if (this.screen === 'settings') this.setScreen(this.previousScreen);
  }
  autoPause() { if (this.screen === 'playing') this.setScreen('pause'); }
  open(screen: Screen) { this.previousScreen = this.screen; this.setScreen(screen); }
  finishTutorial() { this.save.tutorial = true; writeSave(this.save); this.setScreen('playing'); }
  selectPerk(id: string) {
    if (this.screen !== 'reward' || !this.rewardList.some(p => p.id === id)) return;
    if (!applyPerk(this.player, id)) return;
    this.audio.resume(); this.audio.play('reward');
    this.afterReward();
  }
  afterReward() {
    if (this.screen !== 'reward') return;
    if (this.rewardAfter === 'shop') this.openShop();
    else if (this.rewardAfter === 'wave') { this.world.wave++; this.world.enemies = []; spawnArena(this.world); this.player.hp = Math.min(this.player.maxHp, this.player.hp + 15); this.setScreen('playing'); this.onNotice(`第 ${this.world.wave} 波 · 新的对手`); }
    else this.setScreen('playing');
  }
  private reward(after: 'play' | 'shop' | 'wave') {
    this.rewardAfter = after; this.rewardList = rewardChoices(this.player, this.world.seed + this.kills * 237 + this.world.wave * 128);
    this.setScreen('reward');
  }
  openShop() {
    const rng = random(this.world.seed + this.world.level * 191);
    const weapons: WeaponId[] = ['baton', 'staff', 'hammer', 'blades', 'discs'];
    this.shopStock = weapons.map(weapon => ({ weapon, sort: rng() })).sort((a, b) => a.sort - b.sort).slice(0, 3).map(x => x.weapon);
    this.shopBought.clear(); this.setScreen('shop');
  }
  buy(id: string) {
    if (this.screen !== 'shop' || this.shopBought.has(id)) return;
    const p = this.player;
    const price = id === 'heal' ? 35 : id === 'repair' ? 25 : id === 'revive' ? 90 : id.startsWith('skill:') ? 55 : 45;
    if (this.coins < price) { this.onNotice('金币不足，击败敌人和破坏场景物可以获得金币'); return; }
    if (id === 'repair' && p.weapon === 'fist') { this.onNotice('当前徒手，无需修理'); return; }
    if (id === 'heal' && p.hp >= p.maxHp) { this.onNotice('耐久已满'); return; }
    if (id === 'revive' && p.revive) { this.onNotice('已有护身符，每次最多携带一个'); return; }
    if (id.startsWith('skill:') && p.skill === id.slice(6)) { this.onNotice('该主动技能已装备'); return; }
    if (id === 'heal') p.hp = Math.min(p.maxHp, p.hp + 70);
    else if (id === 'repair') p.durability = WEAPONS[p.weapon].durability;
    else if (id === 'revive') p.revive = 1;
    else if (id.startsWith('weapon:')) { p.weapon = id.slice(7) as WeaponId; p.durability = WEAPONS[p.weapon].durability; }
    else if (id.startsWith('skill:')) { p.skill = id.slice(6) as SkillId; p.skillCooldown = 0; }
    else return;
    this.coins -= price; this.shopBought.add(id); this.audio.resume(); this.audio.play('buy'); this.onChange(); this.onHud();
  }
  leaveShop() { if (this.screen !== 'shop') return; this.world.exitOpen = true; this.setScreen('playing'); this.onNotice('整备完成 · 向右进入下一关'); }
  equipTraining(weapon: WeaponId) {
    if (this.world.mode !== 'training') return;
    this.player.weapon = weapon; this.player.durability = 999; this.player.hp = this.player.maxHp; this.player.energy = 100;
    this.player.attack = null; setState(this.player, 'idle'); this.onHud();
  }
  equipTrainingSkill(skill: SkillId) {
    if (this.world.mode !== 'training') return;
    this.player.skill = skill; this.player.skillCooldown = 0; this.player.energy = 100; this.onHud();
  }
  updateSettings() { writeSave(this.save); this.audio.configure(this.save.settings); this.input.setBindings(this.save.settings.bindings); this.onChange(); }
  resetBindings() { this.save.settings.bindings = { ...DEFAULT_BINDINGS }; this.updateSettings(); }
  private onHit(source: Entity, target: Entity, amount: number) {
    if (source.team === 'player') {
      if (source.attack?.def.kind === 'air' && !source.grounded) source.aerialCharge++;
      this.combo = this.comboTime > 0 ? this.combo + 1 : 1; this.comboTime = 2.5; this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.score += Math.round(amount * (1 + Math.min(30, this.combo) * .03));
      if (this.combo % 10 === 0 && source.perks.combo) source.shield = Math.min(30, source.shield + 8 * source.perks.combo);
      this.events.text(target.x + 15, target.y - 95, String(amount), '#eed3ac');
      if (this.world.mode === 'training') { this.trainingDamage += amount; this.trainingHits++; if (!this.trainingStart) this.trainingStart = this.world.time; }
    }
    if (target.team === 'player') { this.buffer = null; this.input.pressed.clear(); }
  }
  private onKill(e: Entity, source?: Entity) {
    if (e.team === 'player') return;
    this.kills++; this.coins += e.boss ? 100 : e.elite ? 35 : 9;
    this.score += e.boss ? 1500 : e.elite ? 400 : 100;
    if ((e.boss || e.elite) && this.player.perks.elite) this.player.shield = Math.min(50, this.player.shield + 25);
    if (!e.boss && e.weapon !== 'fist' && e.id % 3 === 0) addDrop(this.world, e.x, e.y - 15, e.weapon, Math.ceil(WEAPONS[e.weapon].durability * .65));
    if (source?.team === 'player') source.energy = Math.min(100, source.energy + 8);
    if (e.boss) { this.events.sound('phase'); this.onNotice(`${ENEMIES[e.type].name} 已击败`); }
    if (e.type === 'shadowlord' && this.world.mode === 'campaign' && this.world.level === 5) this.beginVictory();
  }
  /** 最终首领死亡当帧终止所有敌方威胁，召唤物不能阻止胜利或补最后一刀。 */
  private beginVictory() {
    if (this.victoryTimer > 0 || this.screen === 'result') return;
    const w = this.world, p = this.player;
    for (const enemy of w.enemies) { enemy.hp = 0; enemy.attack = null; if (enemy.state !== 'dead') setState(enemy, 'dead'); }
    if (w.activeGate) w.activeGate.cleared = true;
    w.activeGate = null; w.projectiles = []; w.hazards = [];
    p.attack = null; p.invuln = 10; p.vx = 0; this.victoryTimer = 2; setState(p, 'victory');
  }
  private effect(x: number, y: number, color: string, amount: number) {
    const count = Math.ceil(amount * this.save.settings.effects);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, v = 100 + Math.random() * 260, life = .17 + Math.random() * .18;
      this.world.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: 1 + Math.random() * 2, kind: 'spark' });
    }
    this.world.particles = this.world.particles.slice(-260);
  }
  /** 外部以固定 1/60 秒调用。所有游戏时间仅在 playing 内推进。 */
  step(dt: number) {
    if (this.screen !== 'playing') return;
    if (this.isPortrait()) { this.autoPause(); return; }
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    const w = this.world, p = this.player;
    w.time += dt; this.totalTime += dt; this.comboTime = Math.max(0, this.comboTime - dt);
    if (this.comboTime === 0) this.combo = 0;
    if (this.victoryTimer > 0) {
      this.victoryTimer -= dt; setState(p, 'victory');
      this.updateEffects(dt);
      if (this.victoryTimer <= 0) this.finish(true);
      this.input.endStep(); return;
    }
    for (const e of [p, ...w.enemies]) tickEntity(e, dt);
    if (p.hp > 0) this.playerInput(dt);
    if (w.mode !== 'training' || this.trainingAttack) updateAI(w, p, dt, this.events);
    else for (const e of w.enemies) e.vx = 0;
    for (const e of [p, ...w.enemies]) {
      const landed = integrate(e, w.platforms, dt, w.width);
      if (landed && e.team === 'player') { this.audio.play('land'); w.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: .3, max: .3, color: '#c2b69d', size: 50, kind: 'ring' }); }
      if (e.y > 900 && e.hp > 0) {
        if (e.team === 'player' || e.boss) { recoverFallen(w, e); if (e.team === 'player' && w.mode !== 'training') { e.hp = Math.max(0, e.hp - 18); this.onNotice('坠落 · 已返回安全地面'); if (e.hp === 0) setState(e, 'dead'); } }
        else { e.hp = 0; setState(e, 'dead'); this.onKill(e, p); }
      }
    }
    if (w.activeGate) {
      p.x = clamp(p.x, w.activeGate.left + 18, w.activeGate.right - 18);
      for (const e of w.enemies) if (e.hp > 0) e.x = clamp(e.x, w.activeGate.left + 18, w.activeGate.right - 18);
    }
    combatStep(w, p, this.events); updateProjectiles(w, p, dt, this.events);
    this.updateDrops(dt); this.updateCrates(); this.updateHazards(dt); this.updateEffects(dt);
    this.audio.update(dt, w.region);
    this.stepClock -= dt;
    if (p.grounded && p.state === 'run' && this.stepClock <= 0) { this.audio.play('step'); this.stepClock = .22; }
    if (w.mode === 'training') {
      p.hp = p.maxHp; p.energy = 100; p.invuln = this.trainingAttack ? 0 : 100000;
      if (p.weapon !== 'fist') p.durability = 999;
      for (const e of w.enemies) if (e.hp < e.maxHp * .6 || e.hp <= 0) { e.hp = e.maxHp; e.attack = null; setState(e, 'idle'); e.y = 620; e.vy = 0; }
    } else if (p.hp <= 0) {
      if (p.revive) { p.revive = 0; p.hp = p.maxHp * .45; p.invuln = 2.5; p.attack = null; p.y = Math.min(p.y, 610); setState(p, 'rise'); this.onNotice('护身符碎裂 · 重新站起'); }
      else if (p.deadTime > 1.3) this.finish(false);
    } else this.progress();
    this.hudClock -= dt; if (this.hudClock <= 0) { this.hudClock = .08; this.onHud(); }
    this.input.endStep();
  }
  private playerInput(dt: number) {
    const p = this.player, i = this.input, time = this.world.time;
    const h = i.horizontal();
    if (i.tap('jump')) p.jumpBuffer = .13;
    const onOneWay = this.world.platforms.some(platform => platform.oneWay && Math.abs(platform.y - p.y) < 3 && p.x > platform.x - 12 && p.x < platform.x + platform.w + 12);
    if (p.jumpBuffer > 0 && tryJump(p, i.down('down') && onOneWay)) this.audio.play('jump');
    if (i.tap('dodge')) { if (h) p.facing = Math.sign(h); dodge(p, this.events); }
    if (i.down('block') && canAct(p) && p.grounded && p.energy > 3) {
      if (p.state !== 'block') { p.attack = null; p.blockTime = 0; setState(p, 'block'); }
      if (h) p.facing = Math.sign(h);
      p.energy = Math.max(0, p.energy - dt * 4);
    } else if (p.state === 'block') setState(p, 'idle');
    if (i.tap('light')) this.buffer = { kind: 'light', until: time + .15 };
    if (i.tap('heavy')) this.buffer = { kind: !p.grounded && i.down('down') ? 'slam' : i.down('up') ? 'launch' : 'heavy', until: time + .15 };
    if (i.tap('skill')) this.buffer = { kind: 'skill', until: time + .15 };
    if (this.buffer) {
      if (time > this.buffer.until) this.buffer = null;
      else if (attackPlayer(p, this.buffer.kind, time, this.events)) this.buffer = null;
    }
    movePlayer(p, h, i.down('down'), dt);
    if (i.tap('interact')) this.interact();
    if (i.tap('throw')) this.throwWeapon();
  }
  interact() {
    const p = this.player, w = this.world; if (!canAct(p)) return;
    const drop = w.drops.filter(d => d.lock <= 0 && Math.abs(d.x - p.x) < 85 && Math.abs(d.y - p.y) < 75).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    if (drop) {
      const old = p.weapon, durability = p.durability; p.weapon = drop.weapon; p.durability = drop.durability;
      w.drops = w.drops.filter(d => d.id !== drop.id);
      if (old !== 'fist') addDrop(w, p.x - p.facing * 35, p.y - 12, old, durability);
      p.attack = null; setState(p, 'pickup'); this.audio.play('menu'); this.onNotice(`已装备 ${WEAPONS[p.weapon].name} · Q 投掷`);
    } else if (w.exitOpen && p.x > w.width - 350) this.nextLevel();
  }
  throwWeapon() {
    const p = this.player; if (p.weapon === 'fist' || !canAct(p)) return;
    this.world.projectiles.push({ id: nextId(), owner: p.id, team: p.team, x: p.x + p.facing * 28, y: p.y - 52, vx: p.facing * 740, vy: -145, damage: WEAPONS[p.weapon].power * 28, life: 2.1, weapon: p.weapon, hit: new Set(), durability: p.durability });
    this.audio.play('swing'); p.weapon = 'fist'; p.durability = 0; setState(p, 'pickup');
  }
  private updateDrops(dt: number) {
    for (const d of this.world.drops) {
      d.lock = Math.max(0, d.lock - dt); const previousY = d.y;
      d.vy += 1850 * dt; d.y += d.vy * dt;
      for (const platform of this.world.platforms) if (d.x >= platform.x && d.x <= platform.x + platform.w && previousY <= platform.y + 2 && d.y >= platform.y) { d.y = platform.y; d.vy = 0; break; }
    }
    this.world.drops = this.world.drops.filter(d => d.y < 850).slice(-32);
  }
  private updateCrates() {
    for (const c of this.world.crates) if (c.hp <= 0 && !c.opened) {
      c.opened = true; const p = this.player;
      this.coins += (c.reward ? 22 : 6) + (p.perks.salvage || 0) * 8;
      p.hp = Math.min(p.maxHp, p.hp + (c.reward ? 15 : 0) + (p.perks.salvage ? 5 : 0));
      this.events.text(c.x, c.y - 80, c.reward ? '补给 +22 · 耐久恢复' : '金币 +6');
      if (c.reward) addDrop(this.world, c.x + 30, c.y - 15, (['baton', 'staff', 'hammer', 'blades', 'discs'] as WeaponId[])[c.id % 5]);
    }
  }
  private updateHazards(dt: number) {
    for (const [id, time] of this.hazardCooldown) { if (time <= dt) this.hazardCooldown.delete(id); else this.hazardCooldown.set(id, time - dt); }
    for (const h of this.world.hazards) {
      const active = (this.world.time + h.phase) % h.period >= h.period - .55;
      for (const e of [this.player, ...this.world.enemies]) {
        if (e.hp <= 0 || e.x < h.x || e.x > h.x + h.w || e.y < h.y - 140 || e.y > h.y + 10) continue;
        if (h.kind === 'wind') { if (!e.grounded) e.vy -= 1100 * dt; continue; }
        if (!active || this.hazardCooldown.has(e.id)) continue;
        this.hazardCooldown.set(e.id, 1.1);
        damage(null, e, { name: '场景机关', kind: 'enemy', startup: 0, active: .1, recovery: 0, damage: 18, reach: 100, height: 130, knock: 230, lift: -290, stun: .4, cost: 0, unblockable: true }, this.events, h.x - 30);
      }
    }
  }
  private updateEffects(dt: number) {
    updateSkillEffects(this.world, dt);
    for (const p of this.world.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind === 'spark') p.vy += 580 * dt; }
    this.world.particles = this.world.particles.filter(p => p.life > 0).slice(-260);
    this.world.enemies = this.world.enemies.filter(e => e.hp > 0 || e.deadTime < 2);
  }
  private progress() {
    const w = this.world, p = this.player;
    if (w.mode === 'arena') {
      if (!w.enemies.some(e => e.hp > 0)) {
        this.save.bestWave = Math.max(this.save.bestWave, w.wave); this.save.bestScore = Math.max(this.save.bestScore, this.score); writeSave(this.save);
        this.reward('wave');
      }
      return;
    }
    if (w.mode !== 'campaign') return;
    for (let index = 0; index < w.gates.length; index++) {
      const g = w.gates[index];
      if (!g.triggered && p.x >= g.left + 90) { spawnGate(w, index); this.onNotice(index === 2 && LEVELS[w.level].boss ? '章节首领 · 留意攻击预警' : '战斗封锁 · 击败区域内的敌人'); }
      if (g.triggered && !g.cleared && !w.enemies.some(e => g.enemies.includes(e.id) && e.hp > 0)) {
        if (g.round < g.rounds) { spawnGate(w, index, true); this.onNotice(`增援抵达 · 第 ${g.round} / ${g.rounds} 批`); return; }
        g.cleared = true; w.activeGate = null; this.coins += 15; p.hp = Math.min(p.maxHp, p.hp + 12); p.energy = 100;
        this.audio.play('reward'); this.onNotice('封锁解除 · 耐久恢复');
        if (index === 2 && w.level === 5) {
          this.beginVictory();
          return;
        }
        this.reward(index === 2 ? 'shop' : 'play'); return;
      }
    }
    if (w.exitOpen && p.x > w.width - 180) this.nextLevel();
  }
  private nextLevel() {
    if (!this.world.exitOpen || this.world.mode !== 'campaign') return;
    const level = this.world.level;
    if (!this.save.completed.includes(level)) this.save.completed.push(level);
    if (level >= 5) { this.finish(true); return; }
    this.player.x = 190; this.player.y = 620; this.player.vx = 0; this.player.vy = 0; this.player.attack = null; this.player.invuln = 1.5; this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30); this.player.energy = 100; this.player.skillCooldown = 0; setState(this.player, 'idle');
    this.audio.clear(); this.world = createWorld('campaign', level + 1, this.world.seed); this.renderer.camera = 0; this.combo = 0; this.buffer = null; this.hazardCooldown.clear();
    this.checkpoint(); this.setScreen('playing'); this.onNotice(`${LEVELS[level + 1].name} · 新的区域，新的对手`);
  }
  private finish(win: boolean) {
    if (this.screen !== 'playing') return;
    this.resultWin = win; this.resultTitle = win ? '破晓，属于你。' : '影未散，再起一战。';
    this.resultReason = win ? '六段旅程，三位首领。城市终于迎来新的黎明。' : this.world.mode === 'arena' ? `挑战止于第 ${this.world.wave} 波，下一次走得更远。` : '从本关安全检查点重试，重新找到进攻节奏。';
    if (win) { this.save.completed = [0, 1, 2, 3, 4, 5]; this.save.checkpoint = null; }
    if (this.world.mode === 'arena') { this.save.bestWave = Math.max(this.save.bestWave, this.world.wave - 1); this.save.bestScore = Math.max(this.save.bestScore, this.score); }
    writeSave(this.save); this.setScreen('result'); this.audio.resume(); this.audio.play(win ? 'win' : 'lose');
  }
  objective() {
    if (this.world.mode === 'training') return '练习上挑、空连与精准防御';
    if (this.world.mode === 'arena') return `第 ${this.world.wave} 波 · 剩余 ${this.world.enemies.filter(e => e.hp > 0).length} 名对手`;
    if (this.world.activeGate) return `解除封锁 · 第 ${this.world.activeGate.round} / ${this.world.activeGate.rounds} 批 · ${this.world.enemies.filter(e => e.hp > 0).length} 名对手`;
    if (this.world.exitOpen) return '向右前进 · 进入下一关';
    return this.world.level === 0 && this.player.x < 750 ? '向右前进 · E 拾取武器 · W＋K 上挑' : '向右探索 · 高处有可选补给';
  }
}
