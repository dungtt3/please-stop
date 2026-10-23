import { createGame } from '../../src/sim/state';
import { drawCard, summon } from '../../src/sim/commands';
import { startWave, tick } from '../../src/sim/game';
import { startQuiz } from '../../src/sim/quiz';
import type { GameState } from '../../src/sim/types';
import {
  MIN_RESUME_PREP, parseRunSave, restoreGame, runStatsOf, saveFingerprint, snapshotRun,
} from '../../src/sim/save';
import { configHash } from '../../src/settings/configHash';

const meta = { runId: 'r1', deviceId: 'd1', runSeconds: 12.5, now: 1000 };

/** Ván đã có vài unit + thẻ, chạy hết wave 1 về giai đoạn chuẩn bị wave 2. */
function playedToWave2(): GameState {
  const s = createGame(1);
  s.gold = 500;
  for (let i = 0; i < 3; i++) summon(s);
  drawCard(s);
  drawCard(s);
  startWave(s);
  for (let i = 0; i < 4000 && s.phase === 'wave'; i++) tick(s, 0.05);
  expect(s.phase).toBe('prep');
  return s;
}
const roundTrip = (s: GameState) => parseRunSave(JSON.parse(JSON.stringify(snapshotRun(s, meta))))!;

test('lưu → JSON → khôi phục ra ván tương đương', () => {
  const s = playedToWave2();
  expect(s.units.size).toBeGreaterThan(0);
  expect(s.hand.length).toBeGreaterThan(0);
  const back = restoreGame(roundTrip(s));
  expect(back.phase).toBe('prep');
  expect(back.wave).toBe(2);
  expect(back.gold).toBe(s.gold);
  expect(back.hp).toBe(s.hp);
  expect(back.slots).toEqual(s.slots);
  expect([...back.units.values()]).toEqual([...s.units.values()].map((u) => ({ ...u, attackCooldown: 0 })));
  expect(back.hand).toEqual(s.hand);
  expect(back.modifier).toBe(s.modifier);
  expect(back.nextId).toBe(s.nextId);
  expect(back.summonCount).toBe(s.summonCount);
  expect(back.drawCount).toBe(s.drawCount);
  expect(back.luckLevel).toBe(s.luckLevel);
  expect(back.kills).toBe(s.kills);
  expect(back.config).toEqual(s.config);
  expect(back.pathLen).toBe(s.pathLen);
  expect(back.map).toBe(back.config.map);
  expect(back.enemies).toEqual([]);
  expect(back.minions).toEqual([]);
  expect(back.spawnQueue).toEqual([]);
  expect(back.events).toEqual([]);
  expect(back.waveTime).toBe(0);
  expect(back.rng.next()).toBe(s.rng.next());
});

test('đồng hồ chuẩn bị tối thiểu 10 giây', () => {
  const s = playedToWave2();
  s.prepTimer = 3;
  expect(restoreGame(roundTrip(s)).prepTimer).toBe(MIN_RESUME_PREP);
  s.prepTimer = 14;
  expect(restoreGame(roundTrip(s)).prepTimer).toBe(14);
});

test('quiz đang mở → mất lượt quiz', () => {
  const s = playedToWave2();
  expect(startQuiz(s).ok).toBe(true);
  s.quizUsedThisPrep = false;
  const back = restoreGame(roundTrip(s));
  expect(back.quiz).toBeNull();
  expect(back.quizUsedThisPrep).toBe(true);
});

test('inWave khi lưu lúc wave đang chạy', () => {
  const s = playedToWave2();
  expect(snapshotRun(s, meta).inWave).toBe(false);
  startWave(s);
  expect(snapshotRun(s, meta).inWave).toBe(true);
});

test('snapshot là bản sao sâu', () => {
  const s = playedToWave2();
  const save = snapshotRun(s, meta);
  const u = [...s.units.values()][0];
  u.level = 99;
  s.hand[0].stat = 'crit';
  s.config.economy.totalWaves = 1;
  expect(save.game.units[0].level).not.toBe(99);
  expect(save.game.config.economy.totalWaves).not.toBe(1);
  expect(save).toMatchObject({ runId: 'r1', deviceId: 'd1', runSeconds: 12.5, savedAt: 1000, version: 1 });
});

test.each([
  ['sai version', (r: any) => { r.version = 2; }],
  ['slot trỏ unit không có', (r: any) => { r.game.slots[0] = 9999; }],
  ['vàng NaN', (r: any) => { r.game.gold = NaN; }],
  ['config hỏng', (r: any) => { r.game.config.economy.totalWaves = 0; }],
  ['tay bài quá giới hạn', (r: any) => { r.game.hand = Array.from({ length: 6 }, (_, i) => ({ id: 1000 + i, stat: 'damage', rarity: 'common' })); }],
  ['runId rỗng', (r: any) => { r.runId = ''; }],
  ['deviceId không phải chuỗi', (r: any) => { r.deviceId = 5; }],
  ['wave ngoài khoảng', (r: any) => { r.game.wave = r.game.config.economy.totalWaves + 1; }],
  ['wave 0', (r: any) => { r.game.wave = 0; }],
  ['sai số slot', (r: any) => { r.game.slots.pop(); }],
  ['unit.slot lệch', (r: any) => { r.game.units[0].slot += 1; }],
  ['thừa unit', (r: any) => { r.game.units.push({ ...r.game.units[0], id: 5000 }); }],
  ['classId lạ', (r: any) => { r.game.units[0].classId = 'ninja'; }],
  ['rarity lạ', (r: any) => { r.game.units[0].rarity = 'legendary'; }],
  ['rarity thẻ lạ', (r: any) => { r.game.hand[0].rarity = 'legendary'; }],
  ['nextId nhỏ hơn id unit', (r: any) => { r.game.nextId = 1; }],
  ['rngState NaN', (r: any) => { r.game.rngState = NaN; }],
  ['runSeconds âm vô cực', (r: any) => { r.runSeconds = Infinity; }],
  ['inWave không phải boolean', (r: any) => { r.inWave = 'yes'; }],
  ['unit thiếu trường', (r: any) => { delete r.game.units[0].cards; }],
  ['modifier lạ', (r: any) => { r.game.modifier = 'chaos'; }],
])('bản lưu hỏng (%s) → null', (_, mutate) => {
  const r = structuredClone(snapshotRun(playedToWave2(), meta));
  mutate(r);
  expect(parseRunSave(r)).toBeNull();
});

test('parseRunSave(null / chuỗi / {}) → null', () => {
  for (const v of [null, undefined, 'x', 5, [], {}, { version: 1 }]) expect(parseRunSave(v)).toBeNull();
});

test('parseRunSave chuẩn hóa config và bỏ trường thừa', () => {
  const r: any = structuredClone(snapshotRun(playedToWave2(), meta));
  r.extra = 1;
  r.game.extra = 2;
  const p = parseRunSave(r)!;
  expect(p).not.toBeNull();
  expect(p).not.toHaveProperty('extra');
  expect(p.game).not.toHaveProperty('extra');
  expect(p.game.config).toEqual(r.game.config);
});

test('runStatsOf', () => {
  const s = playedToWave2();
  s.kills = 7;
  const save = roundTrip(s);
  expect(runStatsOf(save)).toEqual({
    waveReached: 2, won: false, kills: 7, durationS: 12.5, configHash: configHash(s.config),
  });
});

test('fingerprint bỏ qua đồng hồ chuẩn bị, bắt được đổi vàng', () => {
  const s = playedToWave2();
  const base = saveFingerprint(snapshotRun(s, meta));
  expect(saveFingerprint(roundTrip(s))).toBe(base);
  s.prepTimer -= 3;
  expect(saveFingerprint(snapshotRun(s, { ...meta, runSeconds: 99, now: 5 }))).toBe(base);
  s.gold += 1;
  expect(saveFingerprint(snapshotRun(s, meta))).not.toBe(base);
  s.gold -= 1;
  startWave(s);
  expect(saveFingerprint(snapshotRun(s, meta))).not.toBe(base);
});
