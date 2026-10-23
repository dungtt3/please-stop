// Hình khối để phân biệt nhân vật / quái / độ hiếm không chỉ bằng màu. Thuần tính toán, không dùng Phaser.
import type { ClassId, EnemyKind, Rarity } from '../sim/types';

export type ShapeKind = 'square' | 'triangle' | 'diamond' | 'hexagon' | 'circle' | 'roundedSquare' | 'octagon';

export interface Pt {
  x: number;
  y: number;
}

export const CLASS_SHAPE: Record<ClassId, ShapeKind> = {
  swordsman: 'square',
  archer: 'triangle',
  mage: 'diamond',
  summoner: 'hexagon',
};

export const ENEMY_SHAPE: Record<EnemyKind, ShapeKind> = {
  normal: 'circle',
  fast: 'triangle',
  tank: 'roundedSquare',
  boss: 'octagon',
};

/** Số chấm độ hiếm vẽ ở góc ô. */
export const RARITY_PIPS: Record<Rarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
};

/** Độ bo góc của hình vuông bo (tỉ lệ so với nửa cạnh). */
const ROUND_Q = 0.35;
const ROUND_STEPS = 4;

/**
 * Các đỉnh của hình, đều nằm trong bán kính `r` quanh (cx, cy). `angle` (rad, hệ màn hình, y hướng xuống)
 * là hướng của đỉnh đầu tiên: tam giác chĩa về hướng `angle`; hình vuông / vuông bo mặc định có cạnh song song trục.
 * Hình tròn trả mảng rỗng (vẽ bằng `fillCircle`).
 */
export function shapePoints(kind: ShapeKind, cx: number, cy: number, r: number, angle = 0): Pt[] {
  const at = (a: number, d: number, ox = 0, oy = 0): Pt => ({ x: cx + ox + Math.cos(a) * d, y: cy + oy + Math.sin(a) * d });
  const regular = (n: number, start: number): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i < n; i++) out.push(at(start + (i * 2 * Math.PI) / n, r));
    return out;
  };
  switch (kind) {
    case 'circle':
      return [];
    case 'triangle':
      return regular(3, angle);
    case 'diamond':
      return regular(4, angle);
    case 'square':
      return regular(4, angle + Math.PI / 4);
    case 'hexagon':
      return regular(6, angle);
    case 'octagon':
      return regular(8, angle + Math.PI / 8);
    case 'roundedSquare': {
      const h = r / ((1 - ROUND_Q) * Math.SQRT2 + ROUND_Q);
      const k = h * ROUND_Q;
      const out: Pt[] = [];
      for (let corner = 0; corner < 4; corner++) {
        const mid = angle + Math.PI / 4 + (corner * Math.PI) / 2;
        const ox = Math.cos(mid) * (h - k) * Math.SQRT2;
        const oy = Math.sin(mid) * (h - k) * Math.SQRT2;
        for (let s = 0; s <= ROUND_STEPS - 1; s++) {
          const a = mid - Math.PI / 4 + ((Math.PI / 2) * s) / (ROUND_STEPS - 1);
          out.push(at(a, k, ox, oy));
        }
      }
      return out;
    }
  }
}
