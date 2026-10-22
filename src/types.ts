/** 世界单位为像素，时间为秒；所有实体的 x 为中心、y 为脚底。 */
export type Mode = 'campaign' | 'arena' | 'training';
export type State = 'idle' | 'run' | 'crouch' | 'jump' | 'attack' | 'dodge' | 'block' | 'hurt' | 'down' | 'rise' | 'dead' | 'pickup' | 'victory';
export type WeaponId = 'fist' | 'baton' | 'staff' | 'hammer' | 'blades' | 'discs';
export type SkillId = 'palm' | 'shadow' | 'quake';
export type EnemyId = 'fighter' | 'assassin' | 'brute' | 'lancer' | 'thrower' | 'shield' | 'support' | 'gatekeeper' | 'commander' | 'shadowlord' | 'dummy';
export type AttackKind = 'light' | 'heavy' | 'launch' | 'air' | 'slam' | 'skill' | 'enemy';
export interface AttackDef {
  name: string; kind: AttackKind; startup: number; active: number; recovery: number;
  damage: number; reach: number; height: number; knock: number; lift: number;
  stun: number; cost: number; guardBreak?: boolean; unblockable?: boolean;
  radial?: boolean; dash?: number; projectile?: boolean; slam?: boolean;
}
/** 每次挥击独立保存命中过的实体 id，视觉特效不参与判定。 */
export interface Attack { def: AttackDef; time: number; hit: Set<number>; procs: Set<string>; serial: number; fired: boolean; }
export interface WeaponDef { name: string; caption: string; color: string; reach: number; speed: number; power: number; durability: number; }
export interface Entity {
  id: number; team: 'player' | 'enemy'; type: EnemyId; x: number; y: number;
  prevX: number; prevY: number; vx: number; vy: number; facing: number; grounded: boolean;
  hp: number; maxHp: number; energy: number; maxEnergy: number; shield: number;
  state: State; stateTime: number; attack: Attack | null; combo: number; comboUntil: number;
  weapon: WeaponId; durability: number; skill: SkillId; perks: Record<string, number>;
  invuln: number; cooldown: number; dodgeCooldown: number; skillCooldown: number;
  blockTime: number; coyote: number; jumpBuffer: number; dropTime: number;
  airJumps: number; airHits: number; aerialCharge: number; juggle: number; control: number; controlReset: number;
  aiTimer: number; intent: number; attackIndex: number; phase: number; boss: boolean; elite: boolean;
  deadTime: number; flash: number; buff: number; parryPower: number; revive: number;
}
export interface Platform { x: number; y: number; w: number; h: number; oneWay: boolean; conveyor?: number; }
export interface Drop { id: number; x: number; y: number; vy: number; weapon: WeaponId; durability: number; lock: number; }
export interface Projectile { id: number; owner: number; team: string; x: number; y: number; vx: number; vy: number; damage: number; life: number; weapon: WeaponId; hit: Set<number>; durability?: number; }
export interface Crate { id: number; x: number; y: number; hp: number; reward: boolean; opened: boolean; }
export interface Hazard { x: number; y: number; w: number; phase: number; period: number; kind: 'press' | 'electric' | 'wind'; }
export interface Gate { x: number; left: number; right: number; triggered: boolean; cleared: boolean; enemies: number[]; wave: number; round: number; rounds: number; }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: 'spark' | 'dust' | 'ring' | 'text' | 'trail'; text?: string; }
/** 技能视觉事件拥有自己的生命周期；它既不移动角色，也不造成伤害。 */
export interface SkillEffect { skill: SkillId; x: number; y: number; facing: number; age: number; duration: number; radius: number; }
export interface LevelDef { name: string; subtitle: string; region: number; width: number; boss?: EnemyId; }
export interface World {
  mode: Mode; level: number; width: number; region: number; time: number;
  platforms: Platform[]; enemies: Entity[]; drops: Drop[]; projectiles: Projectile[];
  crates: Crate[]; hazards: Hazard[]; gates: Gate[]; particles: Particle[]; skillEffects: SkillEffect[];
  activeGate: Gate | null; exitOpen: boolean; wave: number; seed: number;
}
export interface Settings { music: number; sfx: number; shake: number; flash: number; effects: number; touchSize: number; touchOpacity: number; showTouch: boolean; bindings: Record<string, string>; }
export interface Checkpoint { level: number; seed: number; hp: number; energy: number; coins: number; weapon: WeaponId; durability: number; skill: SkillId; perks: Record<string, number>; revive: number; time: number; kills: number; }
export interface SaveData { version: 1; checkpoint: Checkpoint | null; completed: number[]; bestWave: number; bestScore: number; tutorial: boolean; settings: Settings; }
export interface GameEvents {
  effect: (x: number, y: number, color: string, amount?: number) => void;
  text: (x: number, y: number, value: string, color?: string) => void;
  sound: (name: string, power?: number) => void;
  impact: (power: number) => void;
  kill: (target: Entity, source?: Entity) => void;
  hit: (source: Entity, target: Entity, damage: number) => void;
}
