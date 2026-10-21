import type { GameConfig } from '../config';

/** FNV-1a 32-bit của JSON config, dạng hex 8 ký tự. */
export function configHash(cfg: GameConfig): string {
  const s = JSON.stringify(cfg);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
