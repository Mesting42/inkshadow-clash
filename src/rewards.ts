import { PERKS } from './data';
import { maxHealth } from './entities';
import { random } from './math';
import type { Entity } from './types';
export function rewardChoices(player: Entity, seed: number) {
  const rng = random(seed);
  return PERKS.filter(p => (player.perks[p.id] || 0) < p.max).map(p => ({ p, sort: rng() })).sort((a, b) => a.sort - b.sort).slice(0, 3).map(v => v.p);
}
export function applyPerk(player: Entity, id: string) {
  const perk = PERKS.find(p => p.id === id); if (!perk || (player.perks[id] || 0) >= perk.max) return false;
  player.perks[id] = (player.perks[id] || 0) + 1;
  if (id === 'heart') { player.maxHp = maxHealth(player); player.hp = Math.min(player.maxHp, player.hp + 30); }
  return true;
}
