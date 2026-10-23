import { describe, expect, test } from 'vitest';
import { bossLabel, cooldownFraction, formatNum, hpFraction, hpValue, leadBoss } from '../../src/visuals/viewMath';
import type { Enemy, EnemyKind } from '../../src/sim/types';

const enemy = (id: number, kind: EnemyKind, distance: number, over: Partial<Enemy> = {}): Enemy => ({
  id, kind, hp: 100, maxHp: 100, speed: 1, distance, armor: 0, leakDamage: 1, goldDrop: 1, minionDps: 0,
  blockedBy: null, burn: null, dead: false, ...over,
});

describe('cooldownFraction', () => {
  test('1 − còn lại / tổng, kẹp trong [0, 1]', () => {
    expect(cooldownFraction(10, 10)).toBe(0);
    expect(cooldownFraction(2.5, 10)).toBe(0.75);
    expect(cooldownFraction(0, 10)).toBe(1);
    expect(cooldownFraction(-1, 10)).toBe(1);
    expect(cooldownFraction(12, 10)).toBe(0);
  });
  test('tổng ≤ 0 → đầy', () => {
    expect(cooldownFraction(1, 0)).toBe(1);
    expect(cooldownFraction(0, -1)).toBe(1);
  });
});

describe('hpFraction / hpValue', () => {
  test('kẹp tỉ lệ máu', () => {
    expect(hpFraction(50, 100)).toBe(0.5);
    expect(hpFraction(-5, 100)).toBe(0);
    expect(hpFraction(150, 100)).toBe(1);
    expect(hpFraction(5, 0)).toBe(0);
  });
  test('máu hiển thị làm tròn lên, không âm', () => {
    expect(hpValue(12.01)).toBe(13);
    expect(hpValue(12)).toBe(12);
    expect(hpValue(0.2)).toBe(1);
    expect(hpValue(-3)).toBe(0);
  });
});

describe('formatNum / bossLabel', () => {
  test('tách nhóm nghìn bằng khoảng trắng', () => {
    expect(formatNum(0)).toBe('0');
    expect(formatNum(999)).toBe('999');
    expect(formatNum(1234)).toBe('1 234');
    expect(formatNum(1234567)).toBe('1 234 567');
  });
  test('nhãn boss', () => {
    expect(bossLabel('Trùm', 1233.2, 2500)).toBe('Trùm  1 234 / 2 500');
    expect(bossLabel('Trùm', -4, 3375.0000001)).toBe('Trùm  0 / 3 376');
  });
});

describe('leadBoss', () => {
  test('không có boss sống → null', () => {
    expect(leadBoss([])).toBeNull();
    expect(leadBoss([enemy(1, 'normal', 5), enemy(2, 'boss', 3, { dead: true }), enemy(3, 'boss', 4, { hp: 0 })])).toBeNull();
  });
  test('nhiều boss → boss sống đi xa nhất', () => {
    const a = enemy(1, 'boss', 2);
    const b = enemy(2, 'boss', 7);
    const c = enemy(3, 'boss', 9, { dead: true });
    const d = enemy(4, 'tank', 20);
    expect(leadBoss([a, b, c, d])).toBe(b);
  });
});
