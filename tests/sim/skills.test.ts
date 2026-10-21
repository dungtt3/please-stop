import { DEFAULT_CONFIG } from '../../src/config';
import { createGame } from '../../src/sim/state';
import { spawnEnemy, updateEnemies } from '../../src/sim/enemies';
import { createUnit, computeStats, mergeUnits } from '../../src/sim/units';
import { updateUnits } from '../../src/sim/combat';
import { activeCooldown, basicAttack, updateActive } from '../../src/sim/skills';
import type { ClassId, Enemy, GameState, Unit } from '../../src/sim/types';

const cfg = DEFAULT_CONFIG;

/** Unit ở slot 0 (tâm 3.5, 2.5), không chí mạng. */
function setup(classId: ClassId): { s: GameState; u: Unit } {
  const s = createGame(1);
  const u = createUnit(cfg, 100, classId, 0, 'common', { damage: 0, attackSpeed: 0 }, 20);
  u.cards.crit = -1;
  s.units.set(u.id, u); s.slots[0] = u.id;
  return { s, u };
}
/** Quái đứng yên ở đoạn đầu của đường (y = 1.5, x = d + 0.5). */
function enemyAt(s: GameState, d: number): Enemy {
  const e = spawnEnemy(s, 'normal'); e.distance = d; e.blockedBy = 999; return e;
}
const lost = (e: Enemy): number => e.maxHp - e.hp;

test('activeCooldown giảm 8% mỗi cấp', () => {
  expect(activeCooldown(cfg, 'mage', 3)).toBeCloseTo(12 * 0.84);
  expect(activeCooldown(cfg, 'swordsman', 1)).toBe(8);
});
test('createUnit và mergeUnits đặt skillCooldown theo cấp', () => {
  const { u } = setup('mage');
  expect(u.skillCooldown).toBe(12);
  const b = createUnit(cfg, 101, 'mage', 1, 'common', { damage: 0, attackSpeed: 0 }, 20);
  expect(mergeUnits(cfg, u, b, 102).skillCooldown).toBeCloseTo(12 * 0.92);
});
test('Kiếm sĩ: đòn thứ 3 gấp đôi', () => {
  const { s, u } = setup('swordsman');
  const e = enemyAt(s, 3);
  const stats = computeStats(cfg, u);
  const dmg: number[] = [];
  for (let i = 0; i < 3; i++) {
    const before = e.hp;
    basicAttack(s, u, stats, e);
    dmg.push(before - e.hp);
  }
  expect(dmg[0]).toBeCloseTo(20); expect(dmg[1]).toBeCloseTo(20); expect(dmg[2]).toBeCloseTo(40);
});
test('Pháp sư: nổ lan trong 0.75 ô và gây cháy 3 giây', () => {
  const { s, u } = setup('mage');
  const a = enemyAt(s, 3), b = enemyAt(s, 3.5), far = enemyAt(s, 4);
  const stats = computeStats(cfg, u);
  basicAttack(s, u, stats, a);
  expect(lost(a)).toBeCloseTo(14); expect(lost(b)).toBeCloseTo(14); expect(lost(far)).toBe(0);
  expect(a.burn).toEqual(expect.objectContaining({ dps: 14 * 0.3, remaining: 3 }));
  expect(far.burn).toBeNull();
  for (let i = 0; i < 40; i++) updateEnemies(s, 0.1); // 4s
  expect(lost(a)).toBeCloseTo(14 + 14 * 0.3 * 3);
  expect(lost(far)).toBe(0);
  expect(a.burn === null || a.burn.remaining <= 0).toBe(true);
  // ghi đè, không cộng dồn
  basicAttack(s, u, stats, b);
  expect(b.burn!.dps).toBeCloseTo(14 * 0.3);
});
test('cháy chỉ phát sự kiện damage mỗi 0.5s', () => {
  const { s, u } = setup('mage');
  const a = enemyAt(s, 3);
  basicAttack(s, u, computeStats(cfg, u), a);
  s.events.length = 0;
  for (let i = 0; i < 20; i++) updateEnemies(s, 0.1); // 2s
  const ev = s.events.filter((x) => x.type === 'damage');
  expect(ev).toHaveLength(4);
  const sum = ev.reduce((t, x) => t + (x.type === 'damage' ? x.amount : 0), 0);
  expect(sum).toBeCloseTo(14 * 0.3 * 2);
});
test('Cung thủ mưa tên trúng tối đa 5 quái khác nhau', () => {
  const { s, u } = setup('archer');
  const es = [2, 2.5, 3, 3.5, 4, 4.5, 5].map((d) => enemyAt(s, d));
  u.skillCooldown = 0;
  updateActive(s, u, computeStats(cfg, u), 0.1);
  const hit = es.filter((e) => lost(e) > 0);
  expect(hit).toHaveLength(5);
  for (const e of hit) expect(lost(e)).toBeCloseTo(10 * 1.5);
  expect(u.skillCooldown).toBe(7);
});
test('Kiếm sĩ chém xoáy 300% lên mọi quái trong tầm', () => {
  const { s, u } = setup('swordsman');
  const a = enemyAt(s, 3), b = enemyAt(s, 4), far = enemyAt(s, 9);
  u.skillCooldown = 0;
  updateActive(s, u, computeStats(cfg, u), 0.1);
  expect(lost(a)).toBeCloseTo(60); expect(lost(b)).toBeCloseTo(60); expect(lost(far)).toBe(0);
  expect(s.events.some((x) => x.type === 'skill' && x.unitId === u.id)).toBe(true);
});
test('Thiên thạch nhắm chỗ quái đông nhất', () => {
  const { s, u } = setup('mage');
  const lone = enemyAt(s, 5);          // lẻ, xa hơn
  const c1 = enemyAt(s, 2), c2 = enemyAt(s, 2.5), c3 = enemyAt(s, 3);
  u.skillCooldown = 0;
  updateActive(s, u, computeStats(cfg, u), 0.1);
  for (const e of [c1, c2, c3]) expect(lost(e)).toBeCloseTo(14 * 5);
  expect(lost(lone)).toBe(0);
});
test('Thiên thạch trúng cả quái ngoài tầm unit nhưng trong 1.5 ô quanh tâm', () => {
  const { s, u } = setup('mage'); // tầm 3, tâm (3.5,2.5)
  const inRange = enemyAt(s, 5.5);   // (6,1.5): cách ≈2.69
  const outside = enemyAt(s, 6.5);   // (7,1.5): cách ≈3.64, cách inRange 1
  u.skillCooldown = 0;
  updateActive(s, u, computeStats(cfg, u), 0.1);
  expect(lost(inRange)).toBeCloseTo(70); expect(lost(outside)).toBeCloseTo(70);
});
test('skill chờ khi không có quái và bắn ngay khi quái vào tầm', () => {
  const { s, u } = setup('swordsman');
  u.skillCooldown = 1;
  const stats = computeStats(cfg, u);
  updateActive(s, u, stats, 3);
  expect(u.skillCooldown).toBe(0);
  expect(s.events.some((x) => x.type === 'skill')).toBe(false);
  const e = enemyAt(s, 3);
  updateActive(s, u, stats, 0.1);
  expect(lost(e)).toBeCloseTo(60);
  expect(u.skillCooldown).toBe(8);
});
test('Triệu hồi sư: skill chưa làm gì và không tiêu cooldown; đòn thường một phát', () => {
  const { s, u } = setup('summoner');
  const e = enemyAt(s, 3);
  u.skillCooldown = 0;
  updateActive(s, u, computeStats(cfg, u), 1);
  expect(u.skillCooldown).toBe(0);
  expect(s.events.some((x) => x.type === 'skill')).toBe(false);
  basicAttack(s, u, computeStats(cfg, u), e);
  expect(lost(e)).toBeCloseTo(6);
});
test('updateUnits gọi skill chủ động', () => {
  const { s, u } = setup('swordsman');
  const e = enemyAt(s, 3);
  e.hp = e.maxHp = 1000; // đủ trâu để sống sót qua cả hai đòn
  u.skillCooldown = 0.05;
  updateUnits(s, 0.1);
  expect(lost(e)).toBeCloseTo(20 + 60);
});
