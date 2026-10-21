import {
  applyCardToUnit, canMerge, createUnit, drawCost, luckCost, mergeUnits,
  rollRandomBonus, rollRarity, summonCost,
} from './units';
import { newId } from './state';
import type { Card, CardStat, ClassId, CommandResult, GameState, Rarity } from './types';

const OK: CommandResult = { ok: true };
const fail = (reason: Extract<CommandResult, { ok: false }>['reason']): CommandResult => ({ ok: false, reason });
const over = (s: GameState): boolean => s.phase === 'won' || s.phase === 'lost';
const validSlot = (s: GameState, i: number): boolean => Number.isInteger(i) && i >= 0 && i < s.slots.length;

export function summon(s: GameState): CommandResult {
  if (over(s)) return fail('gameOver');
  const cost = summonCost(s.config, s.summonCount);
  if (s.gold < cost) return fail('gold');
  const empty: number[] = [];
  s.slots.forEach((v, i) => { if (v === null) empty.push(i); });
  if (empty.length === 0) return fail('noSlot');
  s.gold -= cost;
  const classId = s.rng.pick(Object.keys(s.config.classes) as ClassId[]);
  const rarity = rollRarity(s.config, s.rng, s.luckLevel);
  const bonus = rollRandomBonus(s.config, s.rng, rarity);
  const slot = s.rng.pick(empty);
  const unit = createUnit(s.config, newId(s), classId, slot, rarity, bonus, cost);
  s.units.set(unit.id, unit);
  s.slots[slot] = unit.id;
  s.summonCount++;
  return OK;
}

export function dragUnit(s: GameState, from: number, to: number): CommandResult {
  if (over(s)) return fail('gameOver');
  if (!validSlot(s, from) || !validSlot(s, to) || from === to) return fail('invalid');
  const fromId = s.slots[from];
  if (fromId === null) return fail('invalid');
  const toId = s.slots[to];
  const a = s.units.get(fromId)!;
  if (toId === null) {
    s.slots[to] = fromId;
    s.slots[from] = null;
    a.slot = to;
    return OK;
  }
  const b = s.units.get(toId)!;
  if (canMerge(s.config, a, b)) {
    const merged = mergeUnits(s.config, a, b, newId(s));
    s.units.delete(a.id);
    s.units.delete(b.id);
    s.minions = s.minions.filter((m) => m.ownerId !== a.id && m.ownerId !== b.id);
    s.units.set(merged.id, merged);
    s.slots[to] = merged.id;
    s.slots[from] = null;
    return OK;
  }
  s.slots[from] = toId;
  s.slots[to] = fromId;
  a.slot = to;
  b.slot = from;
  return OK;
}

export function sellUnit(s: GameState, slot: number): CommandResult {
  if (over(s)) return fail('gameOver');
  if (!validSlot(s, slot)) return fail('invalid');
  const id = s.slots[slot];
  if (id === null) return fail('invalid');
  s.gold += Math.floor(s.units.get(id)!.goldInvested / 2);
  s.units.delete(id);
  s.slots[slot] = null;
  s.minions = s.minions.filter((m) => m.ownerId !== id);
  return OK;
}

const CARD_STATS: CardStat[] = ['damage', 'attackSpeed', 'range', 'crit'];

function rollCard(s: GameState, minRarity: Rarity = 'common'): Card {
  const stat = s.rng.pick(CARD_STATS);
  const rarity = rollRarity(s.config, s.rng, s.luckLevel, minRarity);
  return { id: newId(s), stat, rarity };
}

export function drawCard(s: GameState): CommandResult {
  if (over(s)) return fail('gameOver');
  if (s.hand.length >= s.config.economy.handLimit) return fail('handFull');
  const cost = drawCost(s.config, s.drawCount);
  if (s.gold < cost) return fail('gold');
  s.gold -= cost;
  s.drawCount++;
  s.hand.push(rollCard(s));
  return OK;
}

export function applyCard(s: GameState, cardId: number, slot: number): CommandResult {
  if (over(s)) return fail('gameOver');
  const idx = s.hand.findIndex((c) => c.id === cardId);
  if (idx < 0 || !validSlot(s, slot)) return fail('invalid');
  const uid = s.slots[slot];
  if (uid === null) return fail('invalid');
  if (!applyCardToUnit(s.config, s.units.get(uid)!, s.hand[idx])) return fail('rangeCap');
  s.hand.splice(idx, 1);
  return OK;
}

export function discardCard(s: GameState, cardId: number): CommandResult {
  if (over(s)) return fail('gameOver');
  const idx = s.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return fail('invalid');
  s.hand.splice(idx, 1);
  return OK;
}

export function buyLuck(s: GameState): CommandResult {
  if (over(s)) return fail('gameOver');
  if (s.luckLevel >= s.config.economy.maxLuck) return fail('maxLuck');
  const cost = luckCost(s.config, s.luckLevel);
  if (s.gold < cost) return fail('gold');
  s.gold -= cost;
  s.luckLevel++;
  return OK;
}

/** Dùng bởi boss/quiz. */
export function grantCard(s: GameState, minRarity: Rarity = 'common'): void {
  const card = rollCard(s, minRarity);
  if (s.hand.length >= s.config.economy.handLimit) {
    const gold = s.config.cards.goldValue[card.rarity];
    s.gold += gold;
    s.events.push({ type: 'cardConverted', gold });
  } else {
    s.hand.push(card);
    s.events.push({ type: 'cardGranted', card });
  }
}
