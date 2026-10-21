import { DEFAULT_CONFIG } from '../../src/config';
import { createGame } from '../../src/sim/state';
import { createRng } from '../../src/sim/rng';
import { spawnEnemy } from '../../src/sim/enemies';
import { createUnit, computeStats } from '../../src/sim/units';
import {
  damageEnemy, enemiesInRange, findTarget, removeDead, rollHit, unitPos, updateUnits,
} from '../../src/sim/combat';

test('chọn quái đi xa nhất trong tầm', () => {
  const s = createGame(1);
  const a = spawnEnemy(s, 'normal'); a.distance = 3;
  const b = spawnEnemy(s, 'normal'); b.distance = 5;
  const far = spawnEnemy(s, 'normal'); far.distance = 30;
  const pos = { x: 4.5, y: 2.5 };
  expect(enemiesInRange(s, pos, 2.5).map((e) => e.id).sort()).toEqual([a.id, b.id].sort());
  expect(findTarget(s, pos, 2.5)).toBe(b);
  b.dead = true;
  expect(findTarget(s, pos, 2.5)).toBe(a);
  a.dead = true;
  expect(findTarget(s, pos, 2.5)).toBeNull();
});
test('giáp của Trâu giảm 30%, ironArmor thêm ×0.8', () => {
  const s = createGame(1); s.modifier = 'ironArmor'; const e = spawnEnemy(s, 'tank');
  damageEnemy(s, e, 100, false); expect(e.maxHp - e.hp).toBeCloseTo(100 * 0.7 * 0.8);
});
test('hai đòn cùng giết một quái chỉ cho vàng một lần', () => {
  const s = createGame(1); const e = spawnEnemy(s, 'normal'); const g = s.gold;
  damageEnemy(s, e, 1000, false); damageEnemy(s, e, 1000, false);
  expect(s.gold).toBe(g + 3); expect(s.kills).toBe(1);
  expect(s.events.filter((ev) => ev.type === 'kill')).toHaveLength(1);
});
test('goldRain nhân đôi vàng rơi', () => {
  const s = createGame(1); s.modifier = 'goldRain'; const e = spawnEnemy(s, 'normal'); const g = s.gold;
  damageEnemy(s, e, 1000, false);
  expect(s.gold).toBe(g + 6);
});
test('giết boss cho một thẻ Hiếm trở lên', () => {
  const s = createGame(1); const e = spawnEnemy(s, 'boss');
  damageEnemy(s, e, 1e9, false);
  expect(s.hand).toHaveLength(1);
  expect(s.hand[0].rarity).not.toBe('common');
});
test('chí mạng nhân critMultiplier', () => {
  const stats = { damage: 20, attackSpeed: 1, range: 1.5, critChance: 1, critMultiplier: 2 };
  expect(rollHit(createRng(1), stats, 1)).toEqual({ amount: 40, crit: true });
  expect(rollHit(createRng(1), { ...stats, critChance: 0 }, 1.5)).toEqual({ amount: 30, crit: false });
});
test('nhân vật đánh theo tốc đánh', () => {
  const s = createGame(1);
  const u = createUnit(s.config, 100, 'swordsman', 0, 'common', { damage: 0, attackSpeed: 0 }, 20);
  u.cards.crit = -1; // computeStats kẹp crit ≥ 0 → không chí mạng
  s.units.set(u.id, u); s.slots[0] = u.id;
  expect(unitPos(s, u)).toEqual({ x: 3.5, y: 2.5 });
  const e = spawnEnemy(s, 'normal'); e.distance = 3; e.blockedBy = 999;
  const dmg = computeStats(DEFAULT_CONFIG, u).damage;
  for (let i = 0; i < 15; i++) updateUnits(s, 0.1);
  expect(e.maxHp - e.hp).toBeCloseTo(dmg * 2);
});
test('không có mục tiêu thì cooldown giữ sẵn sàng; removeDead lọc quái chết', () => {
  const s = createGame(1);
  const u = createUnit(s.config, 100, 'swordsman', 0, 'common', { damage: 0, attackSpeed: 0 }, 20);
  s.units.set(u.id, u); s.slots[0] = u.id;
  for (let i = 0; i < 50; i++) updateUnits(s, 0.1);
  expect(u.attackCooldown).toBe(0);
  const e = spawnEnemy(s, 'normal'); spawnEnemy(s, 'normal'); e.dead = true;
  removeDead(s);
  expect(s.enemies).toHaveLength(1);
});
