import type { CardStat, Rarity } from '../sim/types';

export interface CardsConfig {
  values: Record<CardStat, Record<Rarity, number>>;
  goldValue: Record<Rarity, number>;
}

export const CARDS: CardsConfig = {
  values: {
    damage: { common: 0.1, rare: 0.2, epic: 0.4 },
    attackSpeed: { common: 0.06, rare: 0.12, epic: 0.24 },
    range: { common: 0.25, rare: 0.5, epic: 1 },
    crit: { common: 0.03, rare: 0.06, epic: 0.12 },
  },
  goldValue: { common: 10, rare: 25, epic: 60 },
};
