import type { CardStat, Rarity } from '../sim/types';

export const GAME_W = 1280;
export const GAME_H = 720;
export const TOP_BAR_H = 64;
export const BOTTOM_H = 176;
export const MAX_TILE = 64;
/** Lề trái của bản đồ; phần còn lại bên phải dành cho bảng chi tiết nhân vật. */
export const MAP_LEFT = 16;
/** Chiều cao nút chữ nhật dùng chung. */
export const BTN_H = 56;

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

export const MONO_FONT = 'Consolas, "Courier New", monospace';

export interface TextStyleOpts {
  size: number;
  color?: string;
  bold?: boolean;
  align?: string;
  /** Độ rộng xuống dòng (px khung game). */
  wrap?: number;
  stroke?: { color: string; width: number };
  mono?: boolean;
  /** Các trường style Phaser khác (lineSpacing, backgroundColor, padding...). */
  extra?: Phaser.Types.GameObjects.Text.TextStyle;
}

/** Độ phân giải chữ: min(devicePixelRatio, 2), an toàn khi không có window. */
export function textResolution(): number {
  const dpr = typeof window !== 'undefined' && window ? window.devicePixelRatio : 1;
  return Math.min(Math.max(dpr || 1, 1), 2);
}

/** Style chữ chung cho mọi Text của game. */
export function textStyle(o: TextStyleOpts): Phaser.Types.GameObjects.Text.TextStyle {
  const s: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: o.mono ? MONO_FONT : FONT,
    fontSize: `${o.size}px`,
    resolution: textResolution(),
  };
  if (o.color !== undefined) s.color = o.color;
  if (o.bold) s.fontStyle = 'bold';
  if (o.align !== undefined) s.align = o.align;
  if (o.wrap !== undefined) s.wordWrap = { width: o.wrap };
  if (o.stroke) {
    s.stroke = o.stroke.color;
    s.strokeThickness = o.stroke.width;
  }
  return o.extra ? { ...s, ...o.extra } : s;
}
