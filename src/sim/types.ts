export interface Vec {
  x: number;
  y: number;
}

export type ClassId = 'swordsman' | 'archer' | 'mage' | 'summoner';
export type Rarity = 'common' | 'rare' | 'epic';
export const RARITY_ORDER: readonly Rarity[] = ['common', 'rare', 'epic'];
export type CardStat = 'damage' | 'attackSpeed' | 'range' | 'crit';

export interface Card {
  id: number;
  stat: CardStat;
  rarity: Rarity;
}

export interface Unit {
  id: number;
  classId: ClassId;
  level: number;
  rarity: Rarity;
  slot: number;
  bonus: { damage: number; attackSpeed: number };
  cards: Record<CardStat, number>;
  goldInvested: number;
  attackCooldown: number;
  skillCooldown: number;
  passiveTimer: number;
  attackCount: number;
}

export interface UnitStats {
  damage: number;
  attackSpeed: number;
  range: number;
  critChance: number;
  critMultiplier: number;
}
