export type QuizOp = '+' | '-' | '*' | '/';

export interface QuizBand {
  fromWave: number;
  ops: QuizOp[];
  /** toán hạng 0..addMax cho + và − */
  addMax: number;
  /** thừa số 2..mulMax cho × và ÷ */
  mulMax: number;
}

export interface QuizConfig {
  timeLimit: number;
  fastTime: number;
  fastGoldMult: number;
  baseGold: number;
  goldPerWave: number;
  bands: QuizBand[];
}

export const QUIZ: QuizConfig = {
  timeLimit: 8,
  fastTime: 3,
  fastGoldMult: 2,
  baseGold: 10,
  goldPerWave: 3,
  bands: [
    { fromWave: 1, ops: ['+', '-'], addMax: 20, mulMax: 0 },
    { fromWave: 6, ops: ['+', '-', '*', '/'], addMax: 20, mulMax: 9 },
    { fromWave: 11, ops: ['+', '-', '*', '/'], addMax: 100, mulMax: 12 },
  ],
};
