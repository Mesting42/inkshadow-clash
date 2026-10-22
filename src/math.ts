export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const approach = (a: number, b: number, amount: number) => a < b ? Math.min(b, a + amount) : Math.max(b, a - amount);
/** 每局固定种子只用于内容组合；平台拓扑不随机，保证主线始终可达。 */
export function random(seed: number) { let n = seed >>> 0; return () => { n = (n + 0x6d2b79f5) | 0; let t = Math.imul(n ^ n >>> 15, 1 | n); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function segmentCircle(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = clamp(((cx - x1) * dx + (cy - y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return (x1 + t * dx - cx) ** 2 + (y1 + t * dy - cy) ** 2 <= r * r;
}
