import type { EnemyKind } from '../sim/types';

export interface WaveGroup {
  kind: EnemyKind;
  count: number;
  /** Giây giữa hai con liên tiếp. */
  interval: number;
  /** Giây từ đầu wave tới con đầu tiên. */
  delay: number;
}

export interface WaveDef {
  groups: WaveGroup[];
}

const g = (kind: EnemyKind, count: number, interval: number, delay = 0): WaveGroup => ({ kind, count, interval, delay });

export const WAVES: WaveDef[] = [
  { groups: [g('normal', 8, 1.2)] },
  { groups: [g('normal', 10, 1.1)] },
  { groups: [g('normal', 10, 1.1), g('fast', 4, 0.8, 12)] },
  { groups: [g('normal', 12, 1.0), g('fast', 6, 0.8, 13)] },
  { groups: [g('normal', 12, 1.0), g('tank', 3, 2.0, 6)] },
  { groups: [g('normal', 14, 0.9), g('fast', 8, 0.7, 10), g('tank', 3, 2.0, 18)] },
  { groups: [g('normal', 14, 0.9), g('tank', 5, 1.8, 8), g('fast', 8, 0.7, 20)] },
  { groups: [g('fast', 14, 0.6), g('tank', 6, 1.6, 6), g('normal', 14, 0.8, 16)] },
  { groups: [g('normal', 16, 0.8), g('tank', 8, 1.5, 6), g('fast', 12, 0.6, 18)] },
  { groups: [g('normal', 16, 0.8), g('tank', 6, 1.5, 6), g('boss', 1, 1, 20)] },
  { groups: [g('normal', 18, 0.7), g('tank', 9, 1.4, 6), g('fast', 14, 0.6, 18)] },
  { groups: [g('fast', 18, 0.5), g('tank', 10, 1.3, 6), g('normal', 18, 0.7, 15)] },
  { groups: [g('normal', 20, 0.7), g('tank', 12, 1.2, 6), g('fast', 18, 0.5, 18)] },
  { groups: [g('normal', 22, 0.6), g('tank', 14, 1.1, 6), g('fast', 20, 0.5, 18)] },
  { groups: [g('normal', 22, 0.6), g('tank', 14, 1.1, 6), g('fast', 20, 0.5, 14), g('boss', 1, 1, 28)] },
];
