import Phaser from 'phaser';
import { sellUnit } from '../sim/commands';
import { modifierOf } from '../sim/enemies';
import { activeCooldown } from '../sim/skills';
import { computeStats } from '../sim/units';
import type { CommandResult, GameState, Unit } from '../sim/types';
import { Button, BTN_H } from './BottomBar';
import { COLORS, GAME_W, RARITY_COLOR, textStyle } from './theme';
import {
  PANEL_BAR_GAP, PANEL_BAR_H, PANEL_BODY_TOP, PANEL_CD_GAP, PANEL_CD_LABEL_H, PANEL_FONT, PANEL_LINE_SPACING, PANEL_PAD, PANEL_W,
  PANEL_Y, unitPanelText,
} from './unitPanelText';

const W = PANEL_W;
const X = GAME_W - W - 8;
const Y = PANEL_Y;
const PAD = PANEL_PAD;

/** Bảng chi tiết ở lề phải bản đồ (bản đồ dịch sang trái ở MAP_LEFT nên không che ô nào). */
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
    this.title = scene.add.text(X + PAD, Y + PAD, '', textStyle({ size: 22, bold: true, color: COLORS.text })).setDepth(121);
    this.body = scene.add
      .text(X + PAD, Y + PANEL_BODY_TOP, '', textStyle({ size: PANEL_FONT, color: COLORS.text, wrap: W - 2 * PAD, extra: { lineSpacing: PANEL_LINE_SPACING } }))
      .setDepth(121);
    this.cdLabel = scene.add.text(X + PAD, 0, '', textStyle({ size: 18, color: COLORS.muted })).setDepth(121);
    this.cdBack = scene.add.rectangle(X + PAD, 0, W - 2 * PAD, PANEL_BAR_H, 0x000000, 0.6).setOrigin(0).setDepth(121);
    this.cdFill = scene.add.rectangle(X + PAD, 0, 0, PANEL_BAR_H, 0x42a5f5).setOrigin(0).setDepth(122);
    this.sellBtn = new Button(scene, X + PAD, 0, W - 2 * PAD, BTN_H, '', () => {
      const s = this.getState();
      const sel = this.selectedUnit(s);
      if (!sel) return;
      act(sellUnit(s, sel.slot));
      this.deselect();
    }, { depth: 121, fill: 0x7a4a1e, fontSize: 22 });
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
    const st = computeStats(cfg, u, modifierOf(s).rangeMult);
    const text = unitPanelText(cfg, u, st);
    this.title.setText(text.title).setColor('#' + RARITY_COLOR[u.rarity].toString(16).padStart(6, '0'));
    this.body.setText(text.body);
    const cd = activeCooldown(cfg, u.classId, u.level);
    const frac = cd > 0 ? Math.max(0, Math.min(1, 1 - u.skillCooldown / cd)) : 1;
    let y = this.body.y + this.body.height + PANEL_CD_GAP;
    this.cdLabel.setPosition(X + PAD, y).setText(u.skillCooldown > 0 ? `Hồi chiêu: ${u.skillCooldown.toFixed(1)}s` : 'Kỹ năng sẵn sàng');
    y += PANEL_CD_LABEL_H;
    this.cdBack.setPosition(X + PAD, y);
    this.cdFill.setPosition(X + PAD, y).setSize((W - 2 * PAD) * frac, PANEL_BAR_H);
    y += PANEL_BAR_H + PANEL_BAR_GAP;
    this.sellBtn.bg.setPosition(X + PAD, y);
    this.sellBtn.label.setPosition(X + W / 2, y + BTN_H / 2);
    this.sellBtn.setText(`Bán (+${Math.floor(u.goldInvested / 2)} vàng)`);
    this.height = y + BTN_H + PAD - Y;
    this.bg.setSize(W, this.height);
    this.sellBtn.setDim(s.phase === 'won' || s.phase === 'lost');
  }
}
