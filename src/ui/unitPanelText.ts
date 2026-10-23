import type { GameConfig } from '../config';
import type { CardStat, ClassId, Unit, UnitStats } from '../sim/types';
import { BOTTOM_H, BTN_H, CARD_STAT_NAME, fmtCardValue, GAME_H, RARITY_NAME, TOP_BAR_H } from './theme';

/** Hình học của bảng chi tiết nhân vật (khung game). Thuần để test được. */
export const PANEL_W = 400;
export const PANEL_PAD = 8;
export const PANEL_Y = TOP_BAR_H + 8;
export const PANEL_BODY_TOP = 36;
export const PANEL_FONT = 18;
export const PANEL_LINE_SPACING = 2;
/** Chiều cao một dòng thân bảng (ước lượng thận trọng: ~1.3 × cỡ chữ + giãn dòng). */
export const PANEL_LINE_PX = 26;
/** Số ký tự ước lượng trên một dòng (ước lượng thận trọng: ~10 px mỗi ký tự ở cỡ 18). */
export const PANEL_CHARS_PER_LINE = Math.floor((PANEL_W - 2 * PANEL_PAD) / 10);
/** Khoảng cách dọc sau thân: nhãn hồi chiêu, thanh, nút bán. */
export const PANEL_CD_GAP = 6;
export const PANEL_CD_LABEL_H = 22;
export const PANEL_BAR_H = 10;
export const PANEL_BAR_GAP = 10;
/** Đáy tối đa của bảng: ngay trên thanh dưới. */
export const PANEL_MAX_BOTTOM = GAME_H - BOTTOM_H;

/** Chiều cao bảng khi thân có `bodyHeight` px. */
export function panelHeightForBody(bodyHeight: number): number {
  return PANEL_BODY_TOP + bodyHeight + PANEL_CD_GAP + PANEL_CD_LABEL_H + PANEL_BAR_H + PANEL_BAR_GAP + BTN_H + PANEL_PAD;
}

/** Ước lượng số dòng sau khi xuống dòng theo từ (mỗi dòng ≤ `perLine` ký tự). */
export function estimateLines(text: string, perLine = PANEL_CHARS_PER_LINE): number {
  let total = 0;
  for (const para of text.split('\n')) {
    let cur = 0;
    let n = 1;
    for (const word of para.split(' ')) {
      const w = word.length;
      if (cur === 0) cur = w;
      else if (cur + 1 + w <= perLine) cur += 1 + w;
      else {
        n++;
        cur = w;
      }
      while (cur > perLine) {
        n++;
        cur -= perLine;
      }
    }
    total += n;
  }
  return total;
}

/** Số liệu kỹ năng lấy trực tiếp từ config (không ghi cứng trong mô tả). */
export function skillNumbers(cfg: GameConfig, id: ClassId): string {
  const k = cfg.skills;
  const pct = (m: number) => `${Math.round(m * 100)}%`;
  switch (id) {
    case 'swordsman': return `(Đòn thứ ${k.swordsman.comboEvery} ×${k.swordsman.comboMult}; chém xoáy ${pct(k.swordsman.whirlMult)} ST)`;
    case 'archer': return `(${k.archer.rainArrows} mũi, mỗi mũi ${pct(k.archer.rainMult)} ST)`;
    case 'mage': return `(Thiên thạch ${pct(k.mage.meteorMult)} ST; cháy ${k.mage.burnDuration}s)`;
    default: return `(Cứ ${k.summoner.passiveEvery}s gọi 1 lính; kỹ năng gọi ${k.summoner.waveCount} lính)`;
  }
}

/** Tiêu đề (độ hiếm nằm trong tiêu đề, không chỉ bằng màu) và các dòng thân của bảng. */
export function unitPanelText(cfg: GameConfig, u: Unit, st: UnitStats): { title: string; body: string } {
  const def = cfg.classes[u.classId];
  const cards = (Object.keys(u.cards) as CardStat[])
    .filter((k) => u.cards[k] > 0)
    .map((k) => `${fmtCardValue(k, u.cards[k])} ${CARD_STAT_NAME[k]}`);
  const lines = [
    `Sát thương: ${st.damage.toFixed(1)} · Tốc đánh: ${st.attackSpeed.toFixed(2)}/s`,
    `Tầm đánh: ${st.range.toFixed(1)} ô · Chí mạng: ${Math.round(st.critChance * 100)}%`,
    `Ngẫu nhiên: +${Math.round(u.bonus.damage * 100)}% ST, +${Math.round(u.bonus.attackSpeed * 100)}% TĐ`,
    `Thẻ: ${cards.length ? cards.join(', ') : 'chưa có'}`,
    `Nội tại: ${def.passive}`,
    `Kỹ năng: ${def.active}`,
    skillNumbers(cfg, u.classId),
  ];
  return { title: `${def.name} ★${u.level} · ${RARITY_NAME[u.rarity]}`, body: lines.join('\n') };
}
