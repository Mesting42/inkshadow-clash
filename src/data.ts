import type { AttackDef, EnemyId, LevelDef, SkillId, WeaponDef, WeaponId } from './types';

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  fist: { name: '徒手', caption: '拳脚自成兵器 · 灵活衔接', color: '#ead6ac', reach: 0, speed: 1, power: 1, durability: 0 },
  baton: { name: '街巷短棍', caption: '快速连段 · 均衡距离', color: '#e9b36c', reach: 27, speed: .88, power: 1.08, durability: 48 },
  staff: { name: '游龙长杆', caption: '长距控场 · 贴身较弱', color: '#8dc8c0', reach: 66, speed: 1.13, power: 1.14, durability: 42 },
  hammer: { name: '铸铁重锤', caption: '强力破防 · 蓄势收招', color: '#d5a272', reach: 33, speed: 1.43, power: 1.7, durability: 32 },
  blades: { name: '双影短刃', caption: '疾速空连 · 近身制胜', color: '#9ab4e1', reach: 13, speed: .73, power: .93, durability: 58 },
  discs: { name: '回旋飞轮', caption: '远程打断 · 每次消耗数量', color: '#d9c68b', reach: 8, speed: .95, power: .85, durability: 14 },
};

const base: AttackDef = { name: '直拳', kind: 'light', startup: .07, active: .1, recovery: .2, damage: 11, reach: 69, height: 66, knock: 140, lift: 0, stun: .23, cost: 0 };
export const LIGHTS: AttackDef[] = [
  { ...base },
  { ...base, name: '肘击', startup: .065, damage: 12, reach: 73, knock: 100 },
  { ...base, name: '回旋踢', startup: .1, active: .13, damage: 16, reach: 88, knock: 210, height: 76 },
  { ...base, name: '破阵终结', startup: .14, active: .14, recovery: .31, damage: 23, reach: 92, knock: 460, lift: -180, stun: .42, guardBreak: true },
];
export const ATTACKS: Record<'heavy' | 'launch' | 'air' | 'slam', AttackDef> = {
  heavy: { ...base, name: '崩山重击', kind: 'heavy', startup: .26, active: .15, recovery: .35, damage: 30, reach: 95, knock: 430, stun: .5, cost: 13, guardBreak: true },
  launch: { ...base, name: '升龙挑击', kind: 'launch', startup: .13, active: .15, recovery: .28, damage: 18, reach: 78, height: 110, knock: 55, lift: -650, stun: .6, cost: 12, guardBreak: true },
  air: { ...base, name: '凌空追击', kind: 'air', startup: .06, active: .12, recovery: .2, damage: 15, reach: 83, height: 85, knock: 150, lift: -170, stun: .32, cost: 3 },
  slam: { ...base, name: '坠星下砸', kind: 'slam', startup: .12, active: .16, recovery: .48, damage: 31, reach: 118, height: 85, knock: 400, lift: -170, stun: .5, cost: 16, radial: true, slam: true, guardBreak: true },
};
export const SKILLS: Record<SkillId, { name: string; description: string; color: string; cooldown: number; cost: number; attack: AttackDef }> = {
  palm: { name: '冲击掌', description: '近距冲击，破防并推开前方敌人。消耗 24 能量，冷却 7 秒。', color: '#addac6', cooldown: 7, cost: 24, attack: { ...base, name: '冲击掌', kind: 'skill', startup: .1, active: .16, recovery: .24, damage: 38, reach: 170, height: 100, knock: 650, lift: -200, stun: .65, cost: 24, guardBreak: true } },
  shadow: { name: '影步突袭', description: '向前突进斩击，发力阶段短暂无敌。消耗 28 能量，冷却 9 秒。', color: '#b1c4ef', cooldown: 9, cost: 28, attack: { ...base, name: '影步突袭', kind: 'skill', startup: .12, active: .24, recovery: .32, damage: 43, reach: 100, height: 90, knock: 320, stun: .55, cost: 28, dash: 940, guardBreak: true } },
  quake: { name: '震地爆发', description: '立足地面震荡，打断并浮空周围敌人。消耗 40 能量，冷却 12 秒。', color: '#ecc08b', cooldown: 12, cost: 40, attack: { ...base, name: '震地爆发', kind: 'skill', startup: .27, active: .18, recovery: .4, damage: 48, reach: 205, height: 145, knock: 430, lift: -480, stun: .6, cost: 40, radial: true, guardBreak: true } },
};
export const ENEMIES: Record<EnemyId, { name: string; hp: number; speed: number; color: string; weapon: WeaponId; reach: number; damage: number; delay: number }> = {
  fighter: { name: '街头斗士', hp: 65, speed: 145, color: '#e0a66e', weapon: 'fist', reach: 74, damage: 10, delay: .48 },
  assassin: { name: '疾影刺客', hp: 48, speed: 245, color: '#aebed4', weapon: 'blades', reach: 78, damage: 12, delay: .38 },
  brute: { name: '重装打手', hp: 145, speed: 85, color: '#b8876d', weapon: 'hammer', reach: 104, damage: 22, delay: .78 },
  lancer: { name: '长杆守卫', hp: 85, speed: 125, color: '#8ebbb2', weapon: 'staff', reach: 155, damage: 15, delay: .61 },
  thrower: { name: '远程投掷手', hp: 50, speed: 135, color: '#cbba7e', weapon: 'discs', reach: 480, damage: 12, delay: .85 },
  shield: { name: '铁盾卫士', hp: 115, speed: 100, color: '#98a9b2', weapon: 'baton', reach: 82, damage: 14, delay: .64 },
  support: { name: '脉冲支援者', hp: 55, speed: 110, color: '#a6ce9d', weapon: 'fist', reach: 80, damage: 9, delay: .68 },
  gatekeeper: { name: '铁拳守门人', hp: 640, speed: 115, color: '#dba17a', weapon: 'fist', reach: 130, damage: 22, delay: .82 },
  commander: { name: '长兵器统领', hp: 820, speed: 160, color: '#80c3c6', weapon: 'staff', reach: 200, damage: 23, delay: .7 },
  shadowlord: { name: '影刃首领', hp: 1080, speed: 235, color: '#b4b1de', weapon: 'blades', reach: 150, damage: 24, delay: .56 },
  dummy: { name: '训练木人', hp: 9999, speed: 0, color: '#c6af8a', weapon: 'fist', reach: 80, damage: 8, delay: 1 },
};
export const LEVELS: LevelDef[] = [
  { name: '旧街突围', subtitle: '在城市醒来之前，找回自己的节奏。', region: 0, width: 5100 },
  { name: '天桥封锁', subtitle: '越过最后一道街垒，直面铁拳。', region: 0, width: 5400, boss: 'gatekeeper' },
  { name: '雨港货仓', subtitle: '雨声掩不住，钢铁深处的回响。', region: 1, width: 5400 },
  { name: '炉心车间', subtitle: '穿过机器的心脏，折断统领的长锋。', region: 1, width: 5600, boss: 'commander' },
  { name: '断桥攀升', subtitle: '脚下是深渊，前方是答案。', region: 2, width: 5500 },
  { name: '塔顶决战', subtitle: '风停的那一刻，影刃出鞘。', region: 2, width: 5700, boss: 'shadowlord' },
];
export const REGIONS = ['黄昏旧街', '雨夜工厂', '高塔决斗场'];

/** 强化按 id 生效；上限在奖励系统统一校验，文案与实际规则保持一致。 */
export const PERKS = [
  { id: 'finisher', name: '破阵余波', desc: '轻击第四段增加 45 范围，击退增加 35%。', max: 2, color: '#ebad72', icon: 'burst' },
  { id: 'breakflow', name: '破势回流', desc: '重击破防时恢复 12 能量，每次挥击只触发一次。', max: 2, color: '#91c8ba', icon: 'flow' },
  { id: 'parry', name: '镜心反击', desc: '精准防御后的下一击额外造成 24 伤害。', max: 2, color: '#a4c8e5', icon: 'shield' },
  { id: 'aerial', name: '踏云落星', desc: '每次空中命中为下一次下砸增加 5 伤害，上限 25。', max: 2, color: '#b1b1e1', icon: 'wing' },
  { id: 'throwflow', name: '回旋呼吸', desc: '投掷命中缩短技能冷却 1.5 秒，每件投掷物一次。', max: 2, color: '#d8c682', icon: 'disc' },
  { id: 'evade', name: '流影步', desc: '闪避成功穿过敌人攻击后获得 3 秒攻击加成 20%。', max: 1, color: '#91c6d1', icon: 'shadow' },
  { id: 'combo', name: '连势护体', desc: '每累计 10 次连续命中获得 8 护盾，护盾上限 30。', max: 2, color: '#a4c6aa', icon: 'shield' },
  { id: 'edge', name: '残锋意志', desc: '武器耐久低于三分之一时攻击加成 25%。', max: 1, color: '#e4a18a', icon: 'blade' },
  { id: 'elite', name: '不屈之印', desc: '击败精英或 Boss 获得 25 护盾，上限 50。', max: 1, color: '#ddbf7e', icon: 'crest' },
  { id: 'bare', name: '空手入阵', desc: '徒手移速增加 18%，闪避冷却减少 0.2 秒。', max: 1, color: '#e0b99d', icon: 'fist' },
  { id: 'rise', name: '再起之风', desc: '倒地起身后额外获得 0.7 秒保护并恢复 8 耐久。', max: 1, color: '#a8c8ba', icon: 'wing' },
  { id: 'salvage', name: '拾荒巧手', desc: '击破场景箱额外获得 8 金币，并恢复 5 耐久。', max: 2, color: '#d2b58b', icon: 'box' },
  { id: 'doublejump', name: '燕返', desc: '每次离地允许一次空中跳跃，重置空中攻击次数。', max: 1, color: '#accbdf', icon: 'wing' },
  { id: 'heart', name: '坚韧之心', desc: '耐久上限增加 20，并立即恢复 30 耐久。', max: 3, color: '#e7a28e', icon: 'heart' },
];
export const DEFAULT_BINDINGS: Record<string, string> = { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', jump: 'Space', light: 'KeyJ', heavy: 'KeyK', dodge: 'KeyL', block: 'KeyI', interact: 'KeyE', throw: 'KeyQ', skill: 'KeyU', pause: 'Escape' };
