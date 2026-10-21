import Phaser from 'phaser';
import { buyLuck, drawCard, summon } from '../sim/commands';
import { startWave } from '../sim/game';
import { startQuiz } from '../sim/quiz';
import { drawCost, luckCost, summonCost } from '../sim/units';
import type { CommandResult, GameState } from '../sim/types';
import { COLORS, FONT, GAME_H, GAME_W } from './theme';

export const BTN_H = 56;

export interface ButtonOpts {
  depth?: number;
  fill?: number;
  fontSize?: number;
}

/** Nút chữ nhật cao >= 56px dùng chung cho các bảng UI. */
export class Button {
  readonly bg: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
  private enabled = true;

  constructor(
    scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string,
    onClick: () => void, opts: ButtonOpts = {},
  ) {
    const depth = opts.depth ?? 110;
    this.bg = scene.add.rectangle(x, y, w, h, opts.fill ?? 0x2f3650).setOrigin(0).setDepth(depth)
      .setStrokeStyle(2, 0x5b6585).setInteractive({ useHandCursor: true });
    this.label = scene.add
      .text(x + w / 2, y + h / 2, text, {
        fontFamily: FONT, fontSize: `${opts.fontSize ?? 20}px`, color: COLORS.text, align: 'center', wordWrap: { width: w - 12 },
      })
      .setOrigin(0.5).setDepth(depth + 1);
    this.bg.on('pointerdown', () => {
      if (this.bg.visible && this.enabled) onClick();
    });
  }

  setText(t: string): void {
    this.label.setText(t);
  }
  setDim(dim: boolean): void {
    const a = dim ? 0.4 : 1;
    this.bg.setAlpha(a);
    this.label.setAlpha(a);
  }
  /** Tắt hẳn: mờ và bỏ qua chạm. */
  setEnabled(e: boolean): void {
    this.enabled = e;
    this.setDim(!e);
  }
  setVisible(v: boolean): void {
    this.bg.setVisible(v);
    this.label.setVisible(v);
  }
}

export class BottomBar {
  private summonBtn: Button;
  private drawBtn: Button;
  private luckBtn: Button;
  private quizBtn: Button;
  private startBtn: Button;

  constructor(scene: Phaser.Scene, getState: () => GameState, act: (r: CommandResult) => void) {
    const y = GAME_H - 176 + 2;
    const w = 240;
    const gap = 8;
    const x0 = (GAME_W - (5 * w + 4 * gap)) / 2;
    const mk = (i: number, fn: () => CommandResult | void) =>
      new Button(scene, x0 + i * (w + gap), y, w, BTN_H, '', () => {
        const r = fn();
        if (r) act(r);
      });
    this.summonBtn = mk(0, () => summon(getState()));
    this.drawBtn = mk(1, () => drawCard(getState()));
    this.luckBtn = mk(2, () => buyLuck(getState()));
    this.quizBtn = mk(3, () => startQuiz(getState()));
    this.startBtn = mk(4, () => {
      startWave(getState());
    });
  }

  update(s: GameState): void {
    const cfg = s.config;
    const over = s.phase === 'won' || s.phase === 'lost';
    const sc = summonCost(cfg, s.summonCount);
    const hasSlot = s.slots.some((v) => v === null);
    this.summonBtn.setText(`Triệu hồi (${sc})`);
    this.summonBtn.setDim(over || s.gold < sc || !hasSlot);

    const dc = drawCost(cfg, s.drawCount);
    this.drawBtn.setText(`Rút thẻ (${dc})`);
    this.drawBtn.setDim(over || s.gold < dc || s.hand.length >= cfg.economy.handLimit);

    const max = s.luckLevel >= cfg.economy.maxLuck;
    const lc = luckCost(cfg, s.luckLevel);
    this.luckBtn.setText(max ? `Luck Lv ${s.luckLevel} (Tối đa)` : `Luck Lv ${s.luckLevel} (${lc})`);
    this.luckBtn.setDim(over || max || s.gold < lc);

    const quizOk = s.phase === 'prep' && !s.quizUsedThisPrep && s.quiz === null;
    this.quizBtn.setText('Thử thách toán');
    this.quizBtn.setEnabled(quizOk);

    this.startBtn.setText('Bắt đầu ngay');
    this.startBtn.setEnabled(s.phase === 'prep');
  }
}
