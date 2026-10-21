import type { Rarity } from '../sim/types';

export interface EconomyConfig {
  startHp: number;
  startGold: number;
  prepSeconds: number;
  totalWaves: number;
  maxLevel: number;
  handLimit: number;
  rangeCardCap: number;
  /** Trọng số Thường/Hiếm/Sử thi. */
  baseRarityWeights: [number, number, number];
  /** Thay đổi trọng số mỗi bậc Luck. */
  luckStep: [number, number, number];
  maxLuck: number;
  /** Giá = base + step * số lần đã mua. */
  summonCost: { base: number; step: number };
  drawCost: { base: number; step: number };
  /** Giá = round(base * mult ^ bậc hiện tại). */
  luckCost: { base: number; mult: number };
  /** Khoảng cộng ngẫu nhiên [min, max] theo độ hiếm. */
  rarityBonus: Record<Rarity, [number, number]>;
  /** Tốc đánh nhân thêm (1 + factor * (cấp - 1)). */
  attackSpeedPerLevel: number;
  /** Thưởng cuối wave = round((base + perWave * wave) * waveRewardMult). */
  waveReward: { base: number; perWave: number };
}

export const ECONOMY: EconomyConfig = {
  startHp: 20,
  startGold: 100,
  prepSeconds: 15,
  totalWaves: 15,
  maxLevel: 5,
  handLimit: 5,
  rangeCardCap: 2,
  baseRarityWeights: [70, 25, 5],
  luckStep: [-4, 3, 1],
  maxLuck: 5,
  summonCost: { base: 20, step: 5 },
  drawCost: { base: 25, step: 5 },
  luckCost: { base: 40, mult: 1.5 },
  rarityBonus: { common: [0, 0.1], rare: [0.1, 0.25], epic: [0.25, 0.5] },
  attackSpeedPerLevel: 0.1,
  waveReward: { base: 20, perWave: 5 },
};
