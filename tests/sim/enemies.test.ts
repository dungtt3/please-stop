import { DEFAULT_CONFIG } from '../../src/config';
import { createGame } from '../../src/sim/state';
import { createRng } from '../../src/sim/rng';
import { modifierOf, rollModifier, buildSpawnQueue, spawnEnemy, updateEnemies, enemyPos } from '../../src/sim/enemies';

const WAVES = DEFAULT_CONFIG.waves;

test('15 wave, boss đúng ở wave 10 và 15', () => {
  expect(WAVES).toHaveLength(15);
  WAVES.forEach((w, i) => {
    expect(w.groups.some((g) => g.kind === 'boss')).toBe(i === 9 || i === 14);
    if (i === 9 || i === 14) expect(w.groups.filter((g) => g.kind === 'boss').reduce((n, g) => n + g.count, 0)).toBe(1);
  });
});
test('số quái tăng dần theo wave', () => {
  const total = (i: number) => WAVES[i].groups.reduce((n, g) => n + g.count, 0);
  expect(total(14)).toBeGreaterThan(total(0));
  expect(total(9)).toBeGreaterThan(total(0));
});
test('máu quái tăng hpGrowth mỗi wave, swarm ×0.7', () => {
  const g = DEFAULT_CONFIG.enemyScaling.hpGrowth;
  const s = createGame(1); s.wave = 3; expect(spawnEnemy(s, 'normal').hp).toBeCloseTo(60 * g ** 2);
  s.modifier = 'swarm'; expect(spawnEnemy(s, 'normal').hp).toBeCloseTo(60 * g ** 2 * 0.7);
});
test('goldDrop theo modifier', () => {
  const s = createGame(1); s.modifier = 'goldRain';
  expect(spawnEnemy(s, 'tank').goldDrop).toBe(12);
});
test('modifierOf trả bộ toàn 1 khi null', () => {
  const s = createGame(1);
  expect(modifierOf(s)).toMatchObject({ speedMult: 1, goldDropMult: 1, countMult: 1, hpMult: 1, damageTakenMult: 1, waveRewardMult: 1, rangeMult: 1 });
  s.modifier = 'darkness'; expect(modifierOf(s).rangeMult).toBe(0.8);
});
test('swarm tăng số quái nhưng không tăng boss', () => {
  const q = buildSpawnQueue({ groups: [{ kind: 'normal', count: 3, interval: 1, delay: 0 }, { kind: 'boss', count: 1, interval: 1, delay: 0 }] }, 1.5);
  expect(q.filter((e) => e.kind === 'normal')).toHaveLength(5);
  expect(q.filter((e) => e.kind === 'boss')).toHaveLength(1);
});
test('buildSpawnQueue sắp theo at', () => {
  const q = buildSpawnQueue({ groups: [{ kind: 'normal', count: 2, interval: 2, delay: 5 }, { kind: 'fast', count: 3, interval: 1, delay: 0 }] }, 1);
  expect(q.map((e) => e.at)).toEqual([0, 1, 2, 5, 7]);
});
test('rollModifier không bao giờ ra ở wave 1', () => {
  const r = createRng(1); for (let i = 0; i < 50; i++) expect(rollModifier(DEFAULT_CONFIG, r, 1)).toBeNull();
});
test('rollModifier từ wave 2 ra cả null lẫn mọi modifier', () => {
  const r = createRng(7); const seen = new Set<string | null>();
  for (let i = 0; i < 300; i++) seen.add(rollModifier(DEFAULT_CONFIG, r, 5));
  expect(seen.has(null)).toBe(true);
  expect(seen.size).toBe(6);
});
test('quái tới End trừ HP theo leak và bị xóa; HP về 0 thì thua', () => {
  const s = createGame(1); s.phase = 'wave'; const e = spawnEnemy(s, 'tank'); e.distance = s.pathLen - 0.01;
  updateEnemies(s, 0.1); expect(s.hp).toBe(18); expect(s.enemies).toHaveLength(0);
  expect(s.events).toContainEqual({ type: 'leak', amount: 2 });
  s.hp = 1; spawnEnemy(s, 'normal').distance = s.pathLen; updateEnemies(s, 0.01); expect(s.phase).toBe('lost');
});
test('quái bị chặn không di chuyển', () => {
  const s = createGame(1); s.phase = 'wave'; const e = spawnEnemy(s, 'normal'); e.blockedBy = 1;
  updateEnemies(s, 1); expect(e.distance).toBe(0);
});
test('frenzy tăng tốc 30%', () => {
  const s = createGame(1); s.phase = 'wave'; s.modifier = 'frenzy'; const e = spawnEnemy(s, 'normal');
  updateEnemies(s, 1); expect(e.distance).toBeCloseTo(1.3);
});
test('spawnQueue được xử lý theo waveTime', () => {
  const s = createGame(1); s.phase = 'wave';
  s.spawnQueue = [{ kind: 'normal', at: 0 }, { kind: 'fast', at: 1 }];
  updateEnemies(s, 0.5); expect(s.enemies).toHaveLength(1);
  expect(s.waveTime).toBeCloseTo(0.5);
  updateEnemies(s, 0.6); expect(s.enemies).toHaveLength(2); expect(s.spawnQueue).toHaveLength(0);
});
test('enemyPos nằm ở tâm ô đầu khi distance 0', () => {
  const s = createGame(1); const e = spawnEnemy(s, 'normal');
  const p = s.map.path[0];
  expect(enemyPos(s, e)).toEqual({ x: p.x + 0.5, y: p.y + 0.5 });
});
