// Phép tính thuần cho phần vẽ (không dùng Phaser) để test được.
import type { Enemy } from '../sim/types';

/** Tỉ lệ đầy của thanh hồi skill: 1 − còn lại / tổng, kẹp trong [0, 1]; tổng ≤ 0 → 1 (giống bảng chi tiết). */
export function cooldownFraction(remaining: number, total: number): number {
  if (!(total > 0)) return 1;
  const f = 1 - remaining / total;
  return f <= 0 ? 0 : f >= 1 ? 1 : f;
}

/** Tỉ lệ máu kẹp trong [0, 1]. */
export function hpFraction(hp: number, maxHp: number): number {
  if (!(maxHp > 0)) return 0;
  const f = hp / maxHp;
  return f <= 0 ? 0 : f >= 1 ? 1 : f;
}

/** Số nguyên tách nhóm nghìn bằng khoảng trắng: 1234 → "1 234". */
export function formatNum(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Máu còn lại hiển thị: làm tròn lên, không âm. */
export function hpValue(hp: number): number {
  return Math.max(0, Math.ceil(hp));
}

/** "Trùm  1 234 / 2 500" */
export function bossLabel(name: string, hp: number, maxHp: number): string {
  return `${name}  ${formatNum(hpValue(hp))} / ${formatNum(Math.ceil(maxHp))}`;
}

/** Boss còn sống đi xa nhất trên đường, hoặc null. */
export function leadBoss(enemies: readonly Enemy[]): Enemy | null {
  let best: Enemy | null = null;
  for (const e of enemies) {
    if (e.kind !== 'boss' || e.dead || e.hp <= 0) continue;
    if (!best || e.distance > best.distance) best = e;
  }
  return best;
}
