import Phaser from 'phaser';
import { sellUnit } from '../sim/commands';
import { modifierOf } from '../sim/enemies';
import { activeCooldown } from '../sim/skills';
import { computeStats } from '../sim/units';
import type { CardStat, CommandResult, GameState, Unit } from '../sim/types';
import { Button, BTN_H } from './BottomBar';
import { CARD_STAT_NAME, COLORS, FONT, fmtCardValue, GAME_W, RARITY_COLOR, RARITY_NAME, TOP_BAR_H } from './theme';

const W = 208;
const X = GAME_W - W - 4;
const Y = TOP_BAR_H + 8;
const PAD = 8;

/** Bảng chi tiết ở lề phải bản đồ (không che ô nào). */
export class UnitPanel {
  private bg: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Text;
  private cdLabel: Phaser.GameObjects.Text;
  private cdBack: Phaser.GameObjects.Rectangle;
  private cdFill: Phaser.GameObjects.Rectangle;
  private sellBtn: Button;
  private visible = false;
  private height = 0;
  private unitId: number | null = null;

  constructor(scene: Phaser.Scene, private getState: () => GameState, act: (r: CommandResult) => void, private deselect: () => void) {
    this.bg = scene.add.rectangle(X, Y, W, 100, COLORS.bar, 0.96).setOrigin(0).setDepth(120).setStrokeStyle(3, 0x5b6585);
    this.title = scene.add.text(X + PAD, Y + PAD, '', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: COLORS.text }).setDepth(121);
    this.body = scene.add
      .text(X + PAD, Y + 40, '', { fontFamily: FONT, fontSize: '14px', color: COLORS.text, lineSpacing: 4, wordWrap: { width: W - 2 * PAD } })
      .setDepth(121);
    this.cdLabel = scene.add.text(X + PAD, 0, '', { fontFamily: FONT, fontSize: '13px', color: COLORS.muted }).setDepth(121);
    this.cdBack = scene.add.rectangle(X + PAD, 0, W - 2 * PAD, 10, 0x000000, 0.6).setOrigin(0).setDepth(121);
    this.cdFill = scene.add.rectangle(X + PAD, 0, 0, 10, 0x42a5f5).setOrigin(0).setDepth(122);
    this.sellBtn = new Button(scene, X + PAD, 0, W - 2 * PAD, BTN_H, '', () => {
      const s = this.getState();
      const sel = this.selectedUnit(s);
      if (!sel) return;
      act(sellUnit(s, sel.slot));
      this.deselect();
    }, { depth: 121, fill: 0x7a4a1e, fontSize: 18 });
    this.setVisible(false);
  }

  private selectedUnit(s: GameState): Unit | undefined {
    return this.unitId === null ? undefined : s.units.get(this.unitId);
  }

  /** Điểm (x, y) màn hình có nằm trong bảng không. */
  contains(x: number, y: number): boolean {
    return this.visible && x >= X && x <= X + W && y >= Y && y <= Y + this.height;
  }

  private setVisible(v: boolean): void {
    this.visible = v;
    for (const o of [this.bg, this.title, this.body, this.cdLabel, this.cdBack, this.cdFill]) o.setVisible(v);
    this.sellBtn.setVisible(v);
  }

  update(s: GameState, unitId: number | null): void {
    this.unitId = unitId;
    const u = unitId !== null ? s.units.get(unitId) : undefined;
    if (!u) {
      if (this.visible) this.setVisible(false);
      return;
    }
    if (!this.visible) this.setVisible(true);
    const cfg = s.config;
    const def = cfg.classes[u.classId];
    const st = computeStats(cfg, u, modifierOf(s).rangeMult);
    this.title.setText(`${def.name} ★${u.level}`).setColor('#' + RARITY_COLOR[u.rarity].toString(16).padStart(6, '0'));
    const cards = (Object.keys(u.cards) as CardStat[])
      .filter((k) => u.cards[k] > 0)
      .map((k) => `${fmtCardValue(k, u.cards[k])} ${CARD_STAT_NAME[k]}`);
    const lines = [
      `Độ hiếm: ${RARITY_NAME[u.rarity]}`,
      `Sát thương: ${st.damage.toFixed(1)}`,
      `Tốc đánh: ${st.attackSpeed.toFixed(2)}/s`,
      `Tầm đánh: ${st.range.toFixed(1)} ô`,
      `Chí mạng: ${Math.round(st.critChance * 100)}%`,
      `Ngẫu nhiên: +${Math.round(u.bonus.damage * 100)}% ST, +${Math.round(u.bonus.attackSpeed * 100)}% TĐ`,
      `Thẻ: ${cards.length ? cards.join(', ') : 'chưa có'}`,
      `Nội tại: ${def.passive}`,
      `Kỹ năng: ${def.active}`,
    ];
    this.body.setText(lines.join('\n'));
    const cd = activeCooldown(cfg, u.classId, u.level);
    const frac = cd > 0 ? Math.max(0, Math.min(1, 1 - u.skillCooldown / cd)) : 1;
    let y = this.body.y + this.body.height + 8;
    this.cdLabel.setPosition(X + PAD, y).setText(u.skillCooldown > 0 ? `Hồi chiêu: ${u.skillCooldown.toFixed(1)}s` : 'Kỹ năng sẵn sàng');
    y += 18;
    this.cdBack.setPosition(X + PAD, y);
    this.cdFill.setPosition(X + PAD, y).setSize((W - 2 * PAD) * frac, 10);
    y += 18;
    this.sellBtn.bg.setPosition(X + PAD, y);
    this.sellBtn.label.setPosition(X + W / 2, y + BTN_H / 2);
    this.sellBtn.setText(`Bán (+${Math.floor(u.goldInvested / 2)} vàng)`);
    this.height = y + BTN_H + PAD - Y;
    this.bg.setSize(W, this.height);
    this.sellBtn.setDim(s.phase === 'won' || s.phase === 'lost');
  }
}
