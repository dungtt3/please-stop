import Phaser from 'phaser';
import type { CommandResult } from '../sim/types';
import { COLORS, FONT, GAME_H, GAME_W, BOTTOM_H } from './theme';

const REASON_TEXT: Record<string, string> = {
  gold: 'Không đủ vàng',
  noSlot: 'Hết ô trống',
  handFull: 'Tay bài đã đầy',
  maxLuck: 'Luck đã tối đa',
  rangeCap: 'Tầm đánh đã tối đa',
};

export class Toast {
  private text: Phaser.GameObjects.Text;
  private tween: Phaser.Tweens.Tween | null = null;

  constructor(private scene: Phaser.Scene) {
    this.text = scene.add
      .text(GAME_W / 2, GAME_H - BOTTOM_H - 18, '', {
        fontFamily: FONT, fontSize: '22px', color: COLORS.text, backgroundColor: '#000000cc', padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5, 1).setDepth(300).setAlpha(0);
  }

  show(msg: string): void {
    this.tween?.stop();
    this.text.setText(msg).setAlpha(1);
    this.tween = this.scene.tweens.add({ targets: this.text, alpha: 0, delay: 1100, duration: 400 });
  }

  /** Hiện lý do nếu lệnh thất bại; trả về ok. */
  result(r: CommandResult): boolean {
    if (!r.ok) {
      const t = REASON_TEXT[r.reason];
      if (t) this.show(t);
    }
    return r.ok;
  }
}

/** Biển thông báo giữa màn hình (wave bắt đầu / kết thúc). */
export class Banner {
  private text: Phaser.GameObjects.Text;
  private tween: Phaser.Tweens.Tween | null = null;

  constructor(private scene: Phaser.Scene) {
    this.text = scene.add
      .text(GAME_W / 2, 250, '', {
        fontFamily: FONT, fontSize: '54px', color: '#ffffff', fontStyle: 'bold', align: 'center',
        stroke: '#000000', strokeThickness: 6,
      })
      .setOrigin(0.5).setDepth(350).setAlpha(0);
  }

  show(msg: string, color = '#ffffff'): void {
    this.tween?.stop();
    this.text.setText(msg).setColor(color).setAlpha(1);
    this.tween = this.scene.tweens.add({ targets: this.text, alpha: 0, delay: 1000, duration: 500 });
  }
}
