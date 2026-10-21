import type { GameConfig } from '../config';
import type { Rng } from './rng';
import { activeCooldown } from './skills';
import { RARITY_ORDER } from './types';
import type { Card, CardStat, ClassId, Rarity, Unit, UnitStats } from './types';

export function summonCost(cfg: GameConfig, n: number): number {
  const c = cfg.economy.summonCost;
  return c.base + c.step * n;
}
export function drawCost(cfg: GameConfig, n: number): number {
  const c = cfg.economy.drawCost;
  return c.base + c.step * n;
}
export function luckCost(cfg: GameConfig, level: number): number {
  const c = cfg.economy.luckCost;
  return Math.round(c.base * Math.pow(c.mult, level));
}

export function rarityWeights(cfg: GameConfig, luckLevel: number): [number, number, number] {
  const b = cfg.economy.baseRarityWeights;
  const s = cfg.economy.luckStep;
  return [b[0] + s[0] * luckLevel, b[1] + s[1] * luckLevel, b[2] + s[2] * luckLevel];
}

export function rollRarity(cfg: GameConfig, rng: Rng, luckLevel: number, minRarity: Rarity = 'common'): Rarity {
  const w = rarityWeights(cfg, luckLevel);
  const start = RARITY_ORDER.indexOf(minRarity);
  let total = 0;
  for (let i = start; i < 3; i++) total += Math.max(0, w[i]);
  if (total <= 0) return minRarity;
  let roll = rng.next() * total;
  for (let i = start; i < 3; i++) {
    roll -= Math.max(0, w[i]);
    if (roll < 0) return RARITY_ORDER[i];
  }
  return RARITY_ORDER[2];
}

export function rollRandomBonus(cfg: GameConfig, rng: Rng, rarity: Rarity): { damage: number; attackSpeed: number } {
  const [lo, hi] = cfg.economy.rarityBonus[rarity];
  return { damage: rng.float(lo, hi), attackSpeed: rng.float(lo, hi) };
}

export function createUnit(
  cfg: GameConfig, id: number, classId: ClassId, slot: number, rarity: Rarity,
  bonus: { damage: number; attackSpeed: number }, goldInvested: number,
): Unit {
  return {
    id, classId, level: 1, rarity, slot,
    bonus: { ...bonus },
    cards: { damage: 0, attackSpeed: 0, range: 0, crit: 0 },
    goldInvested,
    attackCooldown: 0, skillCooldown: activeCooldown(cfg, classId, 1), passiveTimer: 0, attackCount: 0,
  };
}

export function computeStats(cfg: GameConfig, unit: Unit, rangeMult = 1): UnitStats {
  const base = cfg.classes[unit.classId].base;
  const lvl = unit.level;
  return {
    damage: base.damage * cfg.levelDamage[lvl - 1] * (1 + unit.cards.damage) * (1 + unit.bonus.damage),
    attackSpeed: base.attackSpeed * (1 + cfg.economy.attackSpeedPerLevel * (lvl - 1))
      * (1 + unit.cards.attackSpeed) * (1 + unit.bonus.attackSpeed),
    range: (base.range + unit.cards.range) * rangeMult,
    critChance: Math.min(1, Math.max(0, base.critChance + unit.cards.crit)),
    critMultiplier: base.critMultiplier,
  };
}

export function canMerge(cfg: GameConfig, a: Unit, b: Unit): boolean {
  return a.classId === b.classId && a.level === b.level && a.level < cfg.economy.maxLevel;
}

export function mergeUnits(cfg: GameConfig, a: Unit, b: Unit, newId: number): Unit {
  const cap = cfg.economy.rangeCardCap;
  const rarity = RARITY_ORDER[Math.max(RARITY_ORDER.indexOf(a.rarity), RARITY_ORDER.indexOf(b.rarity))];
  const u = createUnit(cfg, newId, a.classId, b.slot, rarity, {
    damage: Math.max(a.bonus.damage, b.bonus.damage),
    attackSpeed: Math.max(a.bonus.attackSpeed, b.bonus.attackSpeed),
  }, a.goldInvested + b.goldInvested);
  u.level = a.level + 1;
  u.skillCooldown = activeCooldown(cfg, u.classId, u.level);
  for (const k of Object.keys(u.cards) as CardStat[]) u.cards[k] = a.cards[k] + b.cards[k];
  u.cards.range = Math.min(cap, u.cards.range);
  return u;
}

export function applyCardToUnit(cfg: GameConfig, unit: Unit, card: Card): boolean {
  const cap = cfg.economy.rangeCardCap;
  const v = cfg.cards.values[card.stat][card.rarity];
  if (card.stat === 'range') {
    if (unit.cards.range >= cap) return false;
    unit.cards.range = Math.min(cap, unit.cards.range + v);
    return true;
  }
  unit.cards[card.stat] += v;
  return true;
}
