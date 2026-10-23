import { describe, expect, test } from 'vitest';
import { CLASS_SHAPE, ENEMY_SHAPE, PIP_R, RARITY_PIPS, rarityPipCenters, shapePoints } from '../../src/visuals/shapes';
import type { ShapeKind } from '../../src/visuals/shapes';

const COUNTS: Record<ShapeKind, number> = {
  square: 4, triangle: 3, diamond: 4, hexagon: 6, circle: 0, roundedSquare: 16, octagon: 8,
};

describe('shapePoints', () => {
  test('số đỉnh từng hình', () => {
    for (const [kind, n] of Object.entries(COUNTS) as [ShapeKind, number][]) {
      expect(shapePoints(kind, 0, 0, 10)).toHaveLength(n);
    }
  });

  test('mọi điểm nằm trong bán kính r quanh tâm, với mọi góc', () => {
    for (const kind of Object.keys(COUNTS) as ShapeKind[]) {
      for (const angle of [0, 0.7, Math.PI / 2, -2.4]) {
        for (const p of shapePoints(kind, 100, 50, 20, angle)) {
          expect(Math.hypot(p.x - 100, p.y - 50)).toBeLessThanOrEqual(20 + 1e-9);
        }
      }
    }
  });

  test('hình đa giác đều có mọi đỉnh nằm trên bán kính r', () => {
    for (const kind of ['triangle', 'diamond', 'square', 'hexagon', 'octagon'] as ShapeKind[]) {
      for (const p of shapePoints(kind, 0, 0, 20, 0.3)) expect(Math.hypot(p.x, p.y)).toBeCloseTo(20, 9);
    }
  });

  test('tam giác chĩa theo góc đã cho', () => {
    const [tip] = shapePoints('triangle', 5, 5, 10, Math.PI / 2);
    expect(tip.x).toBeCloseTo(5, 9);
    expect(tip.y).toBeCloseTo(15, 9);
  });

  test('hình vuông có cạnh song song trục khi góc = 0', () => {
    const pts = shapePoints('square', 0, 0, 10);
    expect(new Set(pts.map((p) => Math.round(p.x * 1000))).size).toBe(2);
    expect(new Set(pts.map((p) => Math.round(p.y * 1000))).size).toBe(2);
  });
});

describe('bảng hình', () => {
  test('CLASS_SHAPE đủ 4 lớp, mỗi lớp một hình riêng', () => {
    expect(Object.keys(CLASS_SHAPE).sort()).toEqual(['archer', 'mage', 'summoner', 'swordsman']);
    expect(CLASS_SHAPE).toEqual({ swordsman: 'square', archer: 'triangle', mage: 'diamond', summoner: 'hexagon' });
    expect(new Set(Object.values(CLASS_SHAPE)).size).toBe(4);
  });

  test('ENEMY_SHAPE đủ 4 loại, mỗi loại một hình riêng', () => {
    expect(Object.keys(ENEMY_SHAPE).sort()).toEqual(['boss', 'fast', 'normal', 'tank']);
    expect(ENEMY_SHAPE).toEqual({ normal: 'circle', fast: 'triangle', tank: 'roundedSquare', boss: 'octagon' });
    expect(new Set(Object.values(ENEMY_SHAPE)).size).toBe(4);
  });

  test('RARITY_PIPS: common 0, rare 1, epic 2', () => {
    expect(RARITY_PIPS).toEqual({ common: 0, rare: 1, epic: 2 });
  });
});

describe('hình vuông bo (tank) khác hình tròn', () => {
  test('cạnh phẳng rõ: trung điểm cạnh gần tâm hơn góc (≤ 76% bán kính)', () => {
    const pts = shapePoints('roundedSquare', 0, 0, 100);
    const mids = pts.map((p, i) => {
      const q = pts[(i + 1) % pts.length];
      return Math.hypot((p.x + q.x) / 2, (p.y + q.y) / 2);
    });
    expect(Math.max(...pts.map((p) => Math.hypot(p.x, p.y)))).toBeGreaterThan(98);
    expect(Math.min(...mids)).toBeLessThanOrEqual(76);
  });
});

describe('rarityPipCenters', () => {
  const TILE = 52; // boardTile() mặc định
  /** Ước lượng thận trọng bề rộng chữ "★N" cỡ 14 px đậm (★ ≈ 14, chữ số ≈ 8) + lề trái 4 px của nhãn. */
  const STAR_RIGHT = -TILE / 2 + 4 + 22;

  test('số chấm theo độ hiếm', () => {
    expect(rarityPipCenters('common', TILE, 0, 0)).toHaveLength(0);
    expect(rarityPipCenters('rare', TILE, 0, 0)).toHaveLength(1);
    expect(rarityPipCenters('epic', TILE, 0, 0)).toHaveLength(2);
  });

  test('hai chấm sử thi không chạm nhau (kể cả viền 2 px)', () => {
    const [a, b] = rarityPipCenters('epic', TILE, 0, 0);
    expect(Math.abs(a.x - b.x) - 2 * (PIP_R + 1)).toBeGreaterThanOrEqual(2);
  });

  test('chấm nằm trong ô và không chạm nhãn ★N', () => {
    for (const p of rarityPipCenters('epic', TILE, 0, 0)) {
      expect(p.x + PIP_R + 1).toBeLessThanOrEqual(TILE / 2);
      expect(p.x - PIP_R - 1).toBeGreaterThan(STAR_RIGHT);
    }
  });
});

