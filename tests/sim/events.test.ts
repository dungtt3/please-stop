import { DEFAULT_CONFIG } from '../../src/config';
import { createGame } from '../../src/sim/state';
import { startWave, tick } from '../../src/sim/game';
import { summon, dragUnit } from '../../src/sim/commands';
import { spawnEnemy, enemyPos } from '../../src/sim/enemies';
import { createUnit, computeStats } from '../../src/sim/units';
import { unitPos, updateUnits, damageEnemy } from '../../src/sim/combat';
import { updateActive } from '../../src/sim/skills';
import { updateMinions } from '../../src/sim/minions';
import { startQuiz, answerQuiz, updateQuiz } from '../../src/sim/quiz';
import type { ClassId, Enemy, GameEvent, GameState, Unit } from '../../src/sim/types';

const cfg = DEFAULT_CONFIG;

/** Unit ở slot 0, không chí mạng. */
function setup(classId: ClassId): { s: GameState; u: Unit } {
  const s = createGame(1);
  const u = createUnit(cfg, 100, classId, 0, 'common', { damage: 0, attackSpeed: 0 }, 20);
  u.cards.crit = -1;
  s.units.set(u.id, u); s.slots[0] = u.id;
  return { s, u };
}
function enemyAt(s: GameState, d: number): Enemy {
  const e = spawnEnemy(s, 'normal'); e.distance = d; e.blockedBy = 999; return e;
}
const of = <T extends GameEvent['type']>(s: GameState, t: T): Extract<GameEvent, { type: T }>[] =>
  s.events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === t);

test('summon thành công phát event summon đúng id, thất bại không phát', () => {
  const s = createGame(1);
  s.gold = 1000;
  expect(summon(s).ok).toBe(true);
  const id = [...s.units.keys()][0];
  expect(of(s, 'summon')).toEqual([{ type: 'summon', unitId: id }]);
  s.events.length = 0;
  s.gold = 0;
  expect(summon(s).ok).toBe(false);
  expect(of(s, 'summon')).toHaveLength(0);
});

test('dragUnit di chuyển và đổi chỗ không phát merge', () => {
  const s = createGame(1);
  const a = createUnit(cfg, 100, 'archer', 0, 'common', { damage: 0, attackSpeed: 0 }, 20);
  const b = createUnit(cfg, 101, 'archer', 1, 'common', { damage: 0, attackSpeed: 0 }, 20);
  const c = createUnit(cfg, 102, 'mage', 2, 'common', { damage: 0, attackSpeed: 0 }, 20);
  for (const u of [a, b, c]) { s.units.set(u.id, u); s.slots[u.slot] = u.id; }
  s.nextId = 200;
  expect(dragUnit(s, 0, 5).ok).toBe(true); // di chuyển
  expect(dragUnit(s, 5, 2).ok).toBe(true); // đổi chỗ (archer <-> mage)
  expect(of(s, 'merge')).toHaveLength(0);
});

test('dragUnit gộp hai unit cùng lớp phát merge', () => {
  const s = createGame(1);
  const a = createUnit(cfg, 100, 'archer', 0, 'common', { damage: 0, attackSpeed: 0 }, 20);
  const b = createUnit(cfg, 101, 'archer', 1, 'common', { damage: 0, attackSpeed: 0 }, 20);
  for (const u of [a, b]) { s.units.set(u.id, u); s.slots[u.slot] = u.id; }
  s.nextId = 200;
  expect(dragUnit(s, 0, 1).ok).toBe(true);
  const ev = of(s, 'merge');
  expect(ev).toHaveLength(1);
  expect(s.units.has(ev[0].unitId)).toBe(true);
  expect(s.units.get(ev[0].unitId)!.level).toBe(2);
});

test('đòn thường của cung thủ phát đúng một attack', () => {
  const { s, u } = setup('archer');
  const e = enemyAt(s, 3);
  s.events.length = 0;
  updateUnits(s, 0.05);
  const ev = of(s, 'attack');
  expect(ev).toHaveLength(1);
  expect(ev[0]).toEqual({
    type: 'attack', source: 'unit', id: u.id, classId: 'archer',
    from: unitPos(s, u), to: { x: 3.5, y: 1.5 }, crit: false,
  });
  expect(e.hp).toBeLessThan(e.maxHp);
});

test('attack mang crit của rollHit', () => {
  const { s, u } = setup('swordsman');
  u.cards.crit = 1000;
  enemyAt(s, 3);
  s.events.length = 0;
  updateUnits(s, 0.05);
  expect(of(s, 'attack')[0].crit).toBe(true);
});

test('mỗi lớp phát một attack cho đòn thường', () => {
  for (const c of ['swordsman', 'archer', 'mage', 'summoner'] as ClassId[]) {
    const { s } = setup(c);
    enemyAt(s, 3);
    s.events.length = 0;
    updateUnits(s, 0.05);
    const ev = of(s, 'attack');
    expect(ev).toHaveLength(1);
    expect(ev[0].classId).toBe(c);
  }
});

test('lính đánh phát attack source minion', () => {
  const { s, u } = setup('summoner');
  updateActive(s, u, computeStats(cfg, u), 100); // skill triệu hồi
  const m = s.minions[0];
  const e = enemyAt(s, m.pathDistance - 0.5);
  e.blockedBy = m.id;
  s.events.length = 0;
  updateMinions(s, 0.05);
  const ev = of(s, 'attack');
  expect(ev).toHaveLength(1);
  expect(ev[0]).toEqual({
    type: 'attack', source: 'minion', id: m.id, classId: 'minion',
    from: m.pos, to: enemyPos(s, e), crit: false,
  });
});

test('skill kiếm sĩ có range', () => {
  const { s, u } = setup('swordsman');
  enemyAt(s, 3);
  const stats = computeStats(cfg, u);
  s.events.length = 0;
  updateActive(s, u, stats, 100);
  const ev = of(s, 'skill');
  expect(ev).toHaveLength(1);
  expect(ev[0].pos).toEqual(unitPos(s, u));
  expect(ev[0].range).toBe(stats.range);
});

test('skill cung thủ có hits theo số quái trúng', () => {
  const { s, u } = setup('archer');
  enemyAt(s, 3); enemyAt(s, 3.5);
  s.events.length = 0;
  updateActive(s, u, computeStats(cfg, u), 100);
  const ev = of(s, 'skill');
  expect(ev).toHaveLength(1);
  expect(ev[0].hits).toHaveLength(2);
  expect(ev[0].pos).toEqual(unitPos(s, u));
});

test('skill pháp sư có center, radius và pos là vị trí nhân vật', () => {
  const { s, u } = setup('mage');
  enemyAt(s, 3); enemyAt(s, 3.5);
  s.events.length = 0;
  updateActive(s, u, computeStats(cfg, u), 100);
  const ev = of(s, 'skill');
  expect(ev).toHaveLength(1);
  expect(ev[0].radius).toBe(cfg.skills.mage.meteorRadius);
  expect(ev[0].pos).toEqual(unitPos(s, u));
  expect(ev[0].center).toBeDefined();
  expect(ev[0].center).not.toEqual(ev[0].pos);
});

test('skill triệu hồi sư có spawns theo số lính sinh ra', () => {
  const { s, u } = setup('summoner');
  s.events.length = 0;
  updateActive(s, u, computeStats(cfg, u), 100);
  const ev = of(s, 'skill');
  expect(ev).toHaveLength(1);
  expect(s.minions.length).toBeGreaterThan(0);
  expect(ev[0].spawns).toHaveLength(s.minions.length);
  expect(ev[0].spawns).toEqual(s.minions.map((m) => m.pos));
});

test('trả lời quiz đúng/sai/hết giờ phát event quiz', () => {
  const run = (act: (s: GameState) => void): string[] => {
    const s = createGame(1);
    startQuiz(s);
    s.events.length = 0;
    act(s);
    return of(s, 'quiz').map((e) => e.result);
  };
  const correct = (s: GameState): number => s.quiz!.question.options.indexOf(s.quiz!.question.answer);
  expect(run((s) => answerQuiz(s, correct(s)))).toEqual(['correct']);
  expect(run((s) => answerQuiz(s, (correct(s) + 1) % 4))).toEqual(['wrong']);
  expect(run((s) => updateQuiz(s, cfg.quiz.timeLimit + 1))).toEqual(['timeout']);
  expect(run((s) => { updateQuiz(s, cfg.quiz.timeLimit + 1); updateQuiz(s, 1); })).toEqual(['timeout']);
});

test('giết quái phát kill có enemyId và kind', () => {
  const { s } = setup('archer');
  const e = enemyAt(s, 3);
  s.events.length = 0;
  damageEnemy(s, e, 1e9, false);
  const ev = of(s, 'kill');
  expect(ev).toHaveLength(1);
  expect(ev[0].enemyId).toBe(e.id);
  expect(ev[0].kind).toBe('normal');
});

test('cân bằng không đổi: seed cố định, 3 wave cho cùng gold/kills/hp', () => {
  const s = createGame(12345);
  s.gold = 100000;
  for (let i = 0; i < 6; i++) summon(s);
  for (let w = 0; w < 3; w++) {
    startWave(s);
    for (let i = 0; i < 20 * 120 && s.phase === 'wave'; i++) tick(s, 0.05);
    s.events.length = 0;
  }
  // giá trị ghi từ commit gốc trước khi thêm event
  expect({ gold: s.gold, kills: s.kills, hp: s.hp }).toEqual({ gold: 100006, kills: 37, hp: 20 });
});
