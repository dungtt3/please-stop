import type { GameConfig } from '../config';
import { grantCard } from './commands';
import type { Rng } from './rng';
import type { CommandResult, GameState, QuizQuestion, Rarity } from './types';

export function generateQuestion(cfg: GameConfig, rng: Rng, wave: number): QuizQuestion {
  let band = cfg.quiz.bands[0];
  for (const b of cfg.quiz.bands) if (b.fromWave <= wave) band = b;
  const op = rng.pick(band.ops);
  let text: string;
  let answer: number;
  if (op === '+') {
    const a = rng.int(0, band.addMax);
    const b = rng.int(0, band.addMax);
    answer = a + b;
    text = `${a} + ${b} = ?`;
  } else if (op === '-') {
    const x = rng.int(0, band.addMax);
    const y = rng.int(0, band.addMax);
    const a = Math.max(x, y);
    const b = Math.min(x, y);
    answer = a - b;
    text = `${a} − ${b} = ?`;
  } else if (op === '*') {
    const a = rng.int(2, band.mulMax);
    const b = rng.int(2, band.mulMax);
    answer = a * b;
    text = `${a} × ${b} = ?`;
  } else {
    const a = rng.int(2, band.mulMax);
    const b = rng.int(2, band.mulMax);
    answer = a;
    text = `${a * b} ÷ ${b} = ?`;
  }
  const candidates: number[] = [];
  for (const d of [1, 2, 3, 4, 5, 10]) {
    for (const v of [answer + d, answer - d]) if (v >= 0 && v !== answer) candidates.push(v);
  }
  const distractors = rng.shuffle(candidates).slice(0, 3);
  const options = rng.shuffle([answer, ...distractors]);
  return { text, answer, options };
}

export function quizReward(cfg: GameConfig, wave: number, elapsed: number): { gold: number; minRarity?: Rarity } {
  const q = cfg.quiz;
  const base = q.baseGold + q.goldPerWave * wave;
  if (elapsed <= q.fastTime) return { gold: q.fastGoldMult * base, minRarity: 'rare' };
  const t = Math.min(1, (elapsed - q.fastTime) / (q.timeLimit - q.fastTime));
  return { gold: Math.round(base * (q.fastGoldMult - t * (q.fastGoldMult - 1))) };
}

export function startQuiz(state: GameState): CommandResult {
  if (state.phase === 'won' || state.phase === 'lost') return { ok: false, reason: 'gameOver' };
  if (state.phase !== 'prep' || state.quizUsedThisPrep || state.quiz !== null) return { ok: false, reason: 'invalid' };
  state.quizUsedThisPrep = true;
  state.quiz = { question: generateQuestion(state.config, state.rng, state.wave), elapsed: 0, result: null };
  return { ok: true };
}

export function answerQuiz(state: GameState, optionIndex: number): CommandResult {
  const quiz = state.quiz;
  if (!quiz || quiz.result !== null) return { ok: false, reason: 'invalid' };
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= quiz.question.options.length) {
    return { ok: false, reason: 'invalid' };
  }
  if (quiz.question.options[optionIndex] === quiz.question.answer) {
    quiz.result = 'correct';
    const reward = quizReward(state.config, state.wave, quiz.elapsed);
    state.gold += reward.gold;
    grantCard(state, reward.minRarity);
  } else {
    quiz.result = 'wrong';
  }
  state.events.push({ type: 'quiz', result: quiz.result });
  return { ok: true };
}

export function updateQuiz(state: GameState, dt: number): void {
  const quiz = state.quiz;
  if (!quiz || quiz.result !== null) return;
  quiz.elapsed += dt;
  if (quiz.elapsed >= state.config.quiz.timeLimit) {
    quiz.result = 'timeout';
    state.events.push({ type: 'quiz', result: 'timeout' });
  }
}

export function closeQuiz(state: GameState): void {
  state.quiz = null;
}
