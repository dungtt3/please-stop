import type { CardStat, Rarity } from '../sim/types';

export const GAME_W = 1280;
export const GAME_H = 720;
export const TOP_BAR_H = 64;
export const BOTTOM_H = 176;
export const MAX_TILE = 64;

export const FONT = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif';

export const COLORS = {
  bg: 0x12141c,
  bar: 0x1b1f2b,
  ground: 0x232838,
  path: 0x8d6e4a,
  slot: 0x3a4157,
  slotLine: 0x5b6585,
  text: '#e8ebf5',
  muted: '#9aa3bd',
  gold: '#ffd54f',
  hp: '#ff6b6b',
  crit: '#ffeb3b',
  burn: 0xff9800,
  highlight: 0xfff59d,
  minion: 0xffcc80,
};

export const RARITY_COLOR: Record<Rarity, number> = {
  common: 0x9e9e9e,
  rare: 0x42a5f5,
  epic: 0xab47bc,
};

export const RARITY_NAME: Record<Rarity, string> = {
  common: 'Thường',
  rare: 'Hiếm',
  epic: 'Sử thi',
};

export const CARD_STAT_NAME: Record<CardStat, string> = {
  damage: 'Sát thương',
  attackSpeed: 'Tốc đánh',
  range: 'Tầm đánh',
  crit: 'Chí mạng',
};

/** "+20%" cho damage/attackSpeed/crit, "+0.5" cho range. */
export function fmtCardValue(stat: CardStat, v: number): string {
  return stat === 'range' ? `+${Math.round(v * 100) / 100}` : `+${Math.round(v * 100)}%`;
}

export function cardLabel(stat: CardStat, v: number): string {
  return `${fmtCardValue(stat, v)} ${CARD_STAT_NAME[stat]}`;
}
