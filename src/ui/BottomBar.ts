import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { buyLuck, drawCard, summon } from '../sim/commands';
import { startWave } from '../sim/game';
import { startQuiz } from '../sim/quiz';
import { drawCost, luckCost, summonCost } from '../sim/units';
import type { CommandResult, GameState } from '../sim/types';
import { type Btn, LAYOUT, padOf } from './layout';
import { BTN_H, COLORS, textStyle } from './theme';

export { BTN_H };

export interface ButtonOpts {
  depth?: number;
  fill?: number;
  fontSize?: number;
  /** Mở rộng vùng chạm quanh hình (px khung game) mà không đổi hình vẽ. */
  hit?: { padX?: number; padY?: number; left?: number; right?: number; top?: number; bottom?: number };
}

/** Nút chữ nhật dùng chung cho các bảng UI; vùng chạm có thể lớn hơn hình (xem `layout.ts`). */
export class Button {
  /** Dựng nút từ một mục của `LAYOUT` (hình + vùng chạm). */
  static at(scene: Phaser.Scene, b: Btn, text: string, onClick: () => void, opts: ButtonOpts = {}): Button {
    const r = b.rect;
    return new Button(scene, r.x, r.y, r.w, r.h, text, onClick, { ...opts, hit: padOf(b) });
  }

  readonly bg: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
  private enabled = true;

  constructor(
    scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string,
    onClick: () => void, opts: ButtonOpts = {},
  ) {
    const depth = opts.depth ?? 110;
    this.bg = scene.add.rectangle(x, y, w, h, opts.fill ?? 0x2f3650).setOrigin(0).setDepth(depth)
      .setStrokeStyle(2, 0x5b6585);
    const p = opts.hit;
    if (p) {
      const left = p.left ?? p.padX ?? 0;
      const right = p.right ?? p.padX ?? 0;
      const top = p.top ?? p.padY ?? 0;
      const bottom = p.bottom ?? p.padY ?? 0;
      // Hit area tương đối với góc trên-trái của hình; đi theo nút khi nút đổi vị trí.
      this.bg.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-left, -top, w + left + right, h + top + bottom),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
    } else {
      this.bg.setInteractive({ useHandCursor: true });
    }
    this.label = scene.add
      .text(x + w / 2, y + h / 2, text, textStyle({
        size: opts.fontSize ?? 22, color: COLORS.text, align: 'center', wrap: w - 12,
      }))
      .setOrigin(0.5).setDepth(depth + 1);
    this.bg.on('pointerdown', () => {
      if (!this.bg.visible || !this.enabled) return;
      // Mỗi lần bấm đều thử mở khóa âm thanh (bật âm thanh sau này vẫn hoạt động); idempotent.
      sfx.unlock();
      sfx.play('click');
      onClick();
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
    const mk = (i: number, fn: () => CommandResult | void) =>
      Button.at(scene, LAYOUT.bottom.buttons[i], '', () => {
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
