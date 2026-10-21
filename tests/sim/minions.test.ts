import { DEFAULT_CONFIG } from '../../src/config';
import { createGame } from '../../src/sim/state';
import { spawnEnemy, updateEnemies } from '../../src/sim/enemies';
import { createUnit, computeStats } from '../../src/sim/units';
import { updateActive } from '../../src/sim/skills';
import { dragUnit, sellUnit } from '../../src/sim/commands';
import { spawnMinion, removeMinionsOf, updateMinions } from '../../src/sim/minions';
import { distanceOfTile } from '../../src/sim/path';
import type { Enemy, GameState, Unit } from '../../src/sim/types';

const cfg = DEFAULT_CONFIG;

function setup(slot = 0, id = 100): { s: GameState; u: Unit } {
  const s = createGame(1);
  const u = createUnit(cfg, id, 'summoner', slot, 'common', { damage: 0, attackSpeed: 0 }, 20);
  s.units.set(u.id, u); s.slots[slot] = u.id;
  return { s, u };
}

test('lính sinh ra ở ô đường gần nhất trong tầm', () => {
  const { s, u } = setup();
  const stats = computeStats(cfg, u);
  expect(spawnMinion(s, u, stats)).toBe(true);
  const m = s.minions[0];
  // slot 0 tâm (3.5, 2.5): ô đường gần nhất là (3,1) tâm (3.5,1.5)
  expect(m.pos).toEqual({ x: 3.5, y: 1.5 });
  expect(m.pathDistance).toBe(distanceOfTile(s.map.path, { x: 3, y: 1 }));
  expect(m.ownerId).toBe(u.id);
  expect(m.hp).toBe(40); expect(m.maxHp).toBe(40);
  expect(m.damage).toBeCloseTo(stats.damage * 0.5);
  expect(m.lifetime).toBe(10);
});

test('quái thường dừng tại lính, đánh lính theo minionDps', () => {
  const { s, u } = setup();
  spawnMinion(s, u, computeStats(cfg, u));
  const m = s.minions[0];
  const e: Enemy = spawnEnemy(s, 'normal');
  e.distance = m.pathDistance - 0.5;
  updateEnemies(s, 1);
  expect(e.distance).toBe(m.pathDistance);
  expect(e.blockedBy).toBe(m.id);
  updateMinions(s, 1);
  expect(m.hp).toBeCloseTo(30);
  expect(e.hp).toBeLessThan(e.maxHp);
  updateEnemies(s, 1);
  expect(e.distance).toBe(m.pathDistance);
});

test('boss đi xuyên và giẫm chết lính', () => {
  const { s, u } = setup();
  spawnMinion(s, u, computeStats(cfg, u));
  const m = s.minions[0];
  const boss = spawnEnemy(s, 'boss');
  boss.distance = m.pathDistance - 0.1;
  const normal = spawnEnemy(s, 'normal');
  normal.blockedBy = m.id; normal.distance = m.pathDistance;
  updateEnemies(s, 1);
  expect(s.minions).toHaveLength(0);
  expect(boss.blockedBy).toBeNull();
  expect(boss.distance).toBeCloseTo(m.pathDistance - 0.1 + 0.5);
  expect(normal.blockedBy).toBeNull();
});

test('tối đa 4 lính mỗi Triệu hồi sư', () => {
  const { s, u } = setup();
  const stats = computeStats(cfg, u);
  for (let i = 0; i < 4; i++) expect(spawnMinion(s, u, stats)).toBe(true);
  expect(spawnMinion(s, u, stats)).toBe(false);
  expect(s.minions).toHaveLength(4);
});

test('lính biến mất sau 10s và quái đi tiếp', () => {
  const { s, u } = setup();
  spawnMinion(s, u, computeStats(cfg, u));
  const m = s.minions[0];
  const e = spawnEnemy(s, 'tank'); // minionDps 15 → lính (40hp) sống > 2.6s; dùng quái yếu hơn bằng cách giảm dps
  e.minionDps = 0;
  e.distance = m.pathDistance - 0.1;
  updateEnemies(s, 1);
  expect(e.blockedBy).toBe(m.id);
  for (let i = 0; i < 9; i++) updateMinions(s, 1);
  expect(s.minions).toHaveLength(1);
  updateMinions(s, 1.5);
  expect(s.minions).toHaveLength(0);
  expect(e.blockedBy).toBeNull();
  const d = e.distance;
  updateEnemies(s, 1);
  expect(e.distance).toBeGreaterThan(d);
});

test('lính chết khi hết máu và giải phóng quái', () => {
  const { s, u } = setup();
  spawnMinion(s, u, computeStats(cfg, u));
  const m = s.minions[0];
  const e = spawnEnemy(s, 'normal');
  e.hp = e.maxHp = 1e9;
  e.distance = m.pathDistance - 0.1;
  updateEnemies(s, 1);
  updateMinions(s, 4);
  expect(s.minions).toHaveLength(0);
  expect(e.blockedBy).toBeNull();
});

test('bán Triệu hồi sư xóa lính và giải phóng quái đang bị chặn', () => {
  const { s, u } = setup();
  spawnMinion(s, u, computeStats(cfg, u));
  const m = s.minions[0];
  const e = spawnEnemy(s, 'normal');
  e.distance = m.pathDistance - 0.1;
  updateEnemies(s, 1);
  expect(e.blockedBy).toBe(m.id);
  sellUnit(s, 0);
  expect(s.minions).toEqual([]);
  expect(e.blockedBy).toBeNull();
  const d = e.distance;
  updateEnemies(s, 1);
  expect(e.distance).toBeGreaterThan(d);
});

test('gộp hai Triệu hồi sư xóa lính của cả hai', () => {
  const s = createGame(1);
  const a = createUnit(cfg, 100, 'summoner', 0, 'common', { damage: 0, attackSpeed: 0 }, 20);
  const b = createUnit(cfg, 101, 'summoner', 1, 'common', { damage: 0, attackSpeed: 0 }, 20);
  s.units.set(a.id, a); s.slots[0] = a.id;
  s.units.set(b.id, b); s.slots[1] = b.id;
  spawnMinion(s, a, computeStats(cfg, a));
  spawnMinion(s, b, computeStats(cfg, b));
  expect(s.minions).toHaveLength(2);
  expect(dragUnit(s, 0, 1)).toEqual({ ok: true });
  expect(s.minions).toHaveLength(0);
});

test('removeMinionsOf chỉ xóa lính của chủ đó', () => {
  const { s, u } = setup();
  spawnMinion(s, u, computeStats(cfg, u));
  removeMinionsOf(s, 12345);
  expect(s.minions).toHaveLength(1);
});

test('bị động: 6s gọi 1 lính, chỉ trong phase wave', () => {
  const { s, u } = setup();
  const stats = computeStats(cfg, u);
  s.phase = 'prep';
  for (let i = 0; i < 8; i++) updateActive(s, u, stats, 1);
  expect(s.minions).toHaveLength(0);
  s.phase = 'wave';
  u.skillCooldown = 100; u.passiveTimer = 0;
  for (let i = 0; i < 5; i++) updateActive(s, u, stats, 1);
  expect(s.minions).toHaveLength(0);
  updateActive(s, u, stats, 1);
  expect(s.minions).toHaveLength(1);
  expect(u.passiveTimer).toBe(0);
});

test('chủ động: gọi 3 lính, hồi chiêu và event skill', () => {
  const { s, u } = setup();
  const stats = computeStats(cfg, u);
  u.skillCooldown = 0;
  updateActive(s, u, stats, 0.1);
  expect(s.minions).toHaveLength(3);
  expect(s.events.some((e) => e.type === 'skill')).toBe(true);
  expect(u.skillCooldown).toBeCloseTo(14);
});

test('chủ động: không tạo được lính thì chờ ở 0', () => {
  const { s, u } = setup();
  const stats = computeStats(cfg, u);
  for (let i = 0; i < 4; i++) spawnMinion(s, u, stats);
  u.skillCooldown = 0;
  updateActive(s, u, stats, 0.1);
  expect(s.minions).toHaveLength(4);
  expect(u.skillCooldown).toBe(0);
  expect(s.events.some((e) => e.type === 'skill')).toBe(false);
});
