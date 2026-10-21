import { createRng } from '../../src/sim/rng';
import { DEFAULT_CONFIG as C } from '../../src/config';
import {
  rarityWeights, rollRarity, rollRandomBonus, createUnit, computeStats,
  canMerge, mergeUnits, applyCardToUnit, summonCost, drawCost, luckCost,
} from '../../src/sim/units';

const B0 = { damage: 0, attackSpeed: 0 };

test('trọng số độ hiếm theo Luck', () => {
  expect(rarityWeights(C, 0)).toEqual([70, 25, 5]);
  expect(rarityWeights(C, 5)).toEqual([50, 40, 10]);
});
test('minRarity rare không bao giờ ra common', () => {
  const r = createRng(3);
  for (let i = 0; i < 500; i++) expect(rollRarity(C, r, 0, 'rare')).not.toBe('common');
});
test('cộng ngẫu nhiên epic nằm trong [0.25, 0.5]', () => {
  const r = createRng(7);
  for (let i = 0; i < 200; i++) {
    const b = rollRandomBonus(C, r, 'epic');
    expect(b.damage).toBeGreaterThanOrEqual(0.25);
    expect(b.damage).toBeLessThanOrEqual(0.5);
    expect(b.attackSpeed).toBeGreaterThanOrEqual(0.25);
    expect(b.attackSpeed).toBeLessThanOrEqual(0.5);
  }
});
test('computeStats: Kiếm sĩ cấp 3, thẻ +20% sát thương, cộng ngẫu nhiên 10%', () => {
  const u = { ...createUnit(C, 1, 'swordsman', 0, 'common', { damage: 0.1, attackSpeed: 0 }, 20), level: 3 };
  u.cards.damage = 0.2;
  const s = computeStats(C, u);
  expect(s.damage).toBeCloseTo(20 * 4.8 * 1.2 * 1.1);
  expect(s.attackSpeed).toBeCloseTo(1.0 * 1.2);
  expect(s.range).toBe(1.5);
});
test('Cung thủ có 20% chí mạng gốc, thẻ chí mạng cộng thẳng, kẹp 100%', () => {
  const u = createUnit(C, 1, 'archer', 0, 'common', B0, 20);
  expect(computeStats(C, u).critChance).toBeCloseTo(0.2);
  u.cards.crit = 5;
  expect(computeStats(C, u).critChance).toBe(1);
  u.cards.crit = -5;
  expect(computeStats(C, u).critChance).toBe(0);
});
test('rangeMult áp lên tầm cuối', () => {
  const u = createUnit(C, 1, 'archer', 0, 'common', B0, 20);
  u.cards.range = 1;
  expect(computeStats(C, u, 0.8).range).toBeCloseTo(4);
});
test('canMerge: cùng lớp + cùng cấp + dưới cấp 5', () => {
  const a = createUnit(C, 1, 'mage', 0, 'common', B0, 20);
  const b = createUnit(C, 2, 'mage', 1, 'common', B0, 25);
  expect(canMerge(C, a, b)).toBe(true);
  expect(canMerge(C, a, { ...b, level: 2 })).toBe(false);
  expect(canMerge(C, a, { ...b, classId: 'archer' })).toBe(false);
  expect(canMerge(C, { ...a, level: 5 }, { ...b, level: 5 })).toBe(false);
});
test('mergeUnits giữ max cộng ngẫu nhiên, độ hiếm cao hơn, cộng thẻ và vàng', () => {
  const a = createUnit(C, 1, 'mage', 0, 'rare', { damage: 0.2, attackSpeed: 0.1 }, 20);
  const b = createUnit(C, 2, 'mage', 4, 'common', { damage: 0.05, attackSpeed: 0.3 }, 25);
  a.cards.range = 1.5; b.cards.range = 1; a.cards.damage = 0.1; b.cards.damage = 0.2;
  const m = mergeUnits(C, a, b, 3);
  expect(m).toMatchObject({ id: 3, slot: 4, level: 2, rarity: 'rare', goldInvested: 45,
    bonus: { damage: 0.2, attackSpeed: 0.3 } });
  expect(m.cards.range).toBe(2);
  expect(m.cards.damage).toBeCloseTo(0.3);
});
test('áp thẻ tầm bị từ chối khi đã chạm trần, kẹp khi gần trần', () => {
  const u = createUnit(C, 1, 'archer', 0, 'common', B0, 20);
  u.cards.range = 1.5;
  expect(applyCardToUnit(C, u, { id: 1, stat: 'range', rarity: 'epic' })).toBe(true);
  expect(u.cards.range).toBe(2);
  expect(applyCardToUnit(C, u, { id: 2, stat: 'range', rarity: 'common' })).toBe(false);
  expect(u.cards.range).toBe(2);
});
test('giá', () => {
  expect(summonCost(C, 0)).toBe(20); expect(summonCost(C, 3)).toBe(35);
  expect(drawCost(C, 2)).toBe(35); expect(luckCost(C, 0)).toBe(40); expect(luckCost(C, 2)).toBe(90);
});
test('GameConfig serialize được JSON', () => {
  expect(JSON.parse(JSON.stringify(C))).toEqual(C);
});
