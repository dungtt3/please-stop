import { DEFAULT_CONFIG } from '../../src/config';
import { createRng } from '../../src/sim/rng';
import { createGame } from '../../src/sim/state';
import { tick, startWave } from '../../src/sim/game';
import { generateQuestion, startQuiz, answerQuiz, quizReward, updateQuiz, closeQuiz } from '../../src/sim/quiz';

const cfg = DEFAULT_CONFIG;

test('wave 3 chỉ có + và −, kết quả 0..40 và ≥ 0', () => {
  const rng = createRng(1);
  for (let i = 0; i < 200; i++) {
    const q = generateQuestion(cfg, rng, 3);
    expect(q.text).toMatch(/^\d+ [+−] \d+ = \?$/);
    expect(q.answer).toBeGreaterThanOrEqual(0);
    expect(q.answer).toBeLessThanOrEqual(40);
  }
});

test('wave 8 chia luôn chia hết', () => {
  const rng = createRng(2);
  let seenDiv = 0;
  let seenMul = 0;
  for (let i = 0; i < 400; i++) {
    const q = generateQuestion(cfg, rng, 8);
    const m = q.text.match(/^(\d+) ÷ (\d+) = \?$/);
    if (m) {
      seenDiv++;
      expect(Number.isInteger(q.answer)).toBe(true);
      expect(Number(m[1]) / Number(m[2])).toBe(q.answer);
      expect(q.answer).toBeGreaterThanOrEqual(2);
    }
    if (q.text.includes('×')) seenMul++;
  }
  expect(seenDiv).toBeGreaterThan(0);
  expect(seenMul).toBeGreaterThan(0);
});

test('4 đáp án khác nhau, có đáp án đúng, không âm', () => {
  const rng = createRng(3);
  for (let wave = 1; wave <= 15; wave++) {
    for (let i = 0; i < 100; i++) {
      const q = generateQuestion(cfg, rng, wave);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
      for (const o of q.options) expect(o).toBeGreaterThanOrEqual(0);
    }
  }
});

test('quizReward', () => {
  expect(quizReward(cfg, 5, 2)).toEqual({ gold: 50, minRarity: 'rare' });
  expect(quizReward(cfg, 5, 5.5)).toEqual({ gold: 38 });
});

test('chỉ một quiz mỗi giai đoạn chuẩn bị, không quiz khi đang wave', () => {
  const s = createGame(1);
  expect(startQuiz(s)).toEqual({ ok: true });
  expect(s.quizUsedThisPrep).toBe(true);
  expect(startQuiz(s)).toEqual({ ok: false, reason: 'invalid' });
  closeQuiz(s);
  expect(s.quiz).toBeNull();
  expect(startQuiz(s)).toEqual({ ok: false, reason: 'invalid' });
  const w = createGame(2);
  startWave(w);
  expect(startQuiz(w)).toEqual({ ok: false, reason: 'invalid' });
  w.phase = 'lost';
  expect(startQuiz(w)).toEqual({ ok: false, reason: 'gameOver' });
});

test('trả lời đúng cộng vàng và thẻ; sai thì không thưởng; không trả lời lại', () => {
  const s = createGame(5);
  startQuiz(s);
  const q = s.quiz!.question;
  const wrongIdx = q.options.findIndex((o) => o !== q.answer);
  const rightIdx = q.options.indexOf(q.answer);
  expect(answerQuiz(s, 9)).toEqual({ ok: false, reason: 'invalid' });
  const gold0 = s.gold;
  tick(s, 1);
  expect(answerQuiz(s, rightIdx)).toEqual({ ok: true });
  expect(s.quiz!.result).toBe('correct');
  expect(s.gold).toBe(gold0 + quizReward(cfg, 1, s.quiz!.elapsed).gold);
  expect(s.hand).toHaveLength(1);
  expect(s.hand[0].rarity).not.toBe('common');
  expect(answerQuiz(s, wrongIdx)).toEqual({ ok: false, reason: 'invalid' });

  const w = createGame(6);
  startQuiz(w);
  const q2 = w.quiz!.question;
  const g = w.gold;
  expect(answerQuiz(w, q2.options.findIndex((o) => o !== q2.answer))).toEqual({ ok: true });
  expect(w.quiz!.result).toBe('wrong');
  expect(w.gold).toBe(g);
  expect(w.hand).toHaveLength(0);
});

test('hết 8 giây thì timeout và không thưởng', () => {
  const s = createGame(7);
  startQuiz(s);
  const g = s.gold;
  updateQuiz(s, 7.9);
  expect(s.quiz!.result).toBeNull();
  updateQuiz(s, 0.1);
  expect(s.quiz!.result).toBe('timeout');
  expect(answerQuiz(s, 0)).toEqual({ ok: false, reason: 'invalid' });
  expect(s.gold).toBe(g);
  expect(s.hand).toHaveLength(0);
});

test('quiz chạy tiếp khi giai đoạn chuẩn bị hết', () => {
  const s = createGame(8);
  s.prepTimer = 1;
  startQuiz(s);
  tick(s, 2);
  expect(s.phase).toBe('wave');
  expect(s.quiz!.elapsed).toBeCloseTo(2, 5);
  tick(s, 7);
  expect(s.quiz!.result).toBe('timeout');
});

test('trả lời đúng khi tay đầy thì thẻ đổi ra vàng', () => {
  const s = createGame(9);
  const limit = cfg.economy.handLimit;
  s.hand = Array.from({ length: limit }, (_, i) => ({ id: 900 + i, stat: 'damage' as const, rarity: 'common' as const }));
  startQuiz(s);
  const q = s.quiz!.question;
  const g = s.gold;
  s.events = [];
  answerQuiz(s, q.options.indexOf(q.answer));
  expect(s.hand).toHaveLength(limit);
  const conv = s.events.find((e) => e.type === 'cardConverted');
  expect(conv).toBeDefined();
  expect(s.gold).toBe(g + quizReward(cfg, 1, 0).gold + (conv as { gold: number }).gold);
});
