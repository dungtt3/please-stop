import type { EnemyKind } from '../sim/types';

export interface EnemyDef {
  name: string;
  hp: number;
  speed: number;
  leak: number;
  gold: number;
  armor: number;
  minionDps: number;
  color: number;
}

export interface EnemyScaling {
  /** Máu quái nhân hpGrowth^(wave-1). */
  hpGrowth: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  normal: { name: 'Quái thường', hp: 60, speed: 1.0, leak: 1, gold: 3, armor: 0, minionDps: 10, color: 0x8bc34a },
  fast: { name: 'Quái nhanh', hp: 35, speed: 1.8, leak: 1, gold: 3, armor: 0, minionDps: 6, color: 0xffc107 },
  tank: { name: 'Quái giáp', hp: 160, speed: 0.6, leak: 2, gold: 6, armor: 0.3, minionDps: 15, color: 0x607d8b },
  boss: { name: 'Trùm', hp: 2500, speed: 0.5, leak: 10, gold: 50, armor: 0, minionDps: 0, color: 0xd32f2f },
};

export const ENEMY_SCALING: EnemyScaling = { hpGrowth: 1.35 };
