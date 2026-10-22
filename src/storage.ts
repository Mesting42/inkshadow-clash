import { DEFAULT_BINDINGS } from './data';
import type { SaveData, Settings } from './types';
const KEY = 'inkshadow.clash.save.v1';
export const defaultSettings = (): Settings => ({ music: .35, sfx: .65, shake: .65, flash: .55, effects: .85, touchSize: 1, touchOpacity: .7, showTouch: false, bindings: { ...DEFAULT_BINDINGS } });
export function freshSave(): SaveData { return { version: 1, checkpoint: null, completed: [], bestWave: 0, bestScore: 0, tutorial: false, settings: defaultSettings() }; }
/** 只信任白名单字段。坏档丢弃检查点、保留可验证设置，不在攻击帧恢复。 */
export function readSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return freshSave();
    const v = JSON.parse(raw); if (v.version !== 1 || !v.settings) return freshSave();
    const safe = freshSave();
    for (const key of ['music', 'sfx', 'shake', 'flash', 'effects', 'touchSize', 'touchOpacity'] as const) if (Number.isFinite(v.settings[key])) safe.settings[key] = Math.max(key === 'touchSize' ? .75 : 0, Math.min(key === 'touchSize' ? 1.3 : 1, v.settings[key]));
    safe.settings.showTouch = v.settings.showTouch === true;
    if (v.settings.bindings) for (const key of Object.keys(DEFAULT_BINDINGS)) if (typeof v.settings.bindings[key] === 'string') safe.settings.bindings[key] = v.settings.bindings[key];
    safe.bestWave = Number.isFinite(v.bestWave) ? Math.max(0, Math.floor(v.bestWave)) : 0;
    safe.bestScore = Number.isFinite(v.bestScore) ? Math.max(0, Math.floor(v.bestScore)) : 0;
    safe.tutorial = !!v.tutorial; safe.completed = Array.isArray(v.completed) ? v.completed.filter((x: unknown) => Number.isInteger(x) && Number(x) >= 0 && Number(x) < 6) : [];
    const c = v.checkpoint;
    if (c && Number.isInteger(c.level) && c.level >= 0 && c.level < 6 && Number.isFinite(c.hp) && c.hp > 0 && Number.isFinite(c.seed) && ['fist', 'baton', 'staff', 'hammer', 'blades', 'discs'].includes(c.weapon) && ['palm', 'shadow', 'quake'].includes(c.skill)) {
      const perks: Record<string, number> = {};
      if (c.perks && typeof c.perks === 'object') for (const [id, n] of Object.entries(c.perks)) if (/^[a-z]+$/.test(id) && typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= 3) perks[id] = n;
      safe.checkpoint = { level: c.level, seed: c.seed, hp: Math.min(220, c.hp), energy: 100, coins: Math.max(0, Math.min(99999, Number(c.coins) || 0)), weapon: c.weapon, durability: Math.max(0, Math.min(100, Number(c.durability) || 0)), skill: c.skill, perks, revive: c.revive === 1 ? 1 : 0, time: Math.max(0, Number(c.time) || 0), kills: Math.max(0, Number(c.kills) || 0) };
    }
    return safe;
  } catch { return freshSave(); }
}
export function writeSave(save: SaveData) { try { localStorage.setItem(KEY, JSON.stringify(save)); return true; } catch { return false; } }
