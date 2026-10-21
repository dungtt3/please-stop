import { DEFAULT_CONFIG } from '../../src/config';
import { createGame } from '../../src/sim/state';
import { startWave, tick } from '../../src/sim/game';
import { spawnEnemy } from '../../src/sim/enemies';
import { damageEnemy } from '../../src/sim/combat';
import { createUnit } from '../../src/sim/units';
import { runBot } from '../../scripts/bot';

test('hết 15 giây chuẩn bị thì wave 1 bắt đầu', () => {
  const s = createGame(1);
  tick(s, 15.01);
  expect(s.phase).toBe('wave');
});

test('startWave bắt đầu ngay', () => {
  const s = createGame(1);
  startWave(s);
  expect(s.phase).toBe('wave');
  expect(s.waveTime).toBe(0);
  expect(s.spawnQueue.length).toBe(DEFAULT_CONFIG.waves[0].groups[0].count);
  expect(s.events.some((e) => e.type === 'waveStart' && e.wave === 1)).toBe(true);
  // gọi lại khi đang 'wave' không làm gì
  s.spawnQueue = [];
  startWave(s);
  expect(s.spawnQueue.length).toBe(0);
});

test('wave kết thúc: thưởng 20 + 5 × wave, sang chuẩn bị wave kế', () => {
  const s = createGame(1);
  startWave(s);
  s.spawnQueue = [{ kind: 'normal', at: 0 }];
  const gold0 = s.gold;
  tick(s, 0.05);
  expect(s.enemies.length).toBe(1);
  expect(s.phase).toBe('wave');
  damageEnemy(s, s.enemies[0], 1e9, false);
  tick(s, 0.05);
  expect(s.gold).toBe(gold0 + 3 + 25);
  expect(s.wave).toBe(2);
  expect(s.phase).toBe('prep');
  expect(s.prepTimer).toBe(15);
  expect(s.quizUsedThisPrep).toBe(false);
  expect(s.events.some((e) => e.type === 'waveEnd' && e.wave === 1 && e.reward === 25)).toBe(true);
});

test('qua wave 15 thì thắng', () => {
  const s = createGame(1);
  s.wave = 15;
  s.config.waves[14] = { groups: [] };
  startWave(s);
  tick(s, 0.05);
  expect(s.phase).toBe('won');
});

test('dt lớn được chia nhỏ: quái không vượt qua lính', () => {
  const s = createGame(1);
  s.phase = 'wave';
  s.spawnQueue = [];
  s.minions.push({
    id: 900, ownerId: 999, pos: { x: 0, y: 0 }, pathDistance: 3,
    hp: 1e9, maxHp: 1e9, damage: 0, attackCooldown: 0, lifetime: 1e9,
  });
  const e = spawnEnemy(s, 'normal');
  tick(s, 10);
  expect(e.blockedBy).toBe(900);
  expect(e.distance).toBe(3);
});

test('đổi wave: xóa lính và đặt lại hồi đánh', () => {
  const s = createGame(1);
  const u = createUnit(DEFAULT_CONFIG, 50, 'archer', 0, 'common', { damage: 0, attackSpeed: 0 }, 20);
  u.attackCooldown = 5;
  s.units.set(u.id, u); s.slots[0] = u.id;
  startWave(s);
  s.spawnQueue = [];
  s.minions.push({
    id: 901, ownerId: 50, pos: { x: 0, y: 0 }, pathDistance: 3,
    hp: 10, maxHp: 10, damage: 0, attackCooldown: 0, lifetime: 100,
  });
  tick(s, 0.05);
  expect(s.phase).toBe('prep');
  expect(s.minions.length).toBe(0);
  expect(u.attackCooldown).toBe(0);
});

test('ván tự chơi với bot kết thúc thắng hoặc thua, không có NaN', () => {
  const s = runBot(1);
  expect(['won', 'lost']).toContain(s.phase);
  expect(Number.isFinite(s.gold)).toBe(true);
  expect(Number.isFinite(s.hp)).toBe(true);
  expect(s.wave).toBeGreaterThanOrEqual(3);
});
