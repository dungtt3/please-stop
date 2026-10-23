import type Phaser from 'phaser';
import type { GameState } from '../sim/types';
import { bossLabel, hpFraction, hpValue, leadBoss } from '../visuals/viewMath';
import { GAME_W, TOP_BAR_H, textStyle } from './theme';

const W = 440;
const H = 30;
const Y = TOP_BAR_H + 6;
const DEPTH = 95;

/** Thanh máu lớn của boss ngay dưới thanh trên cùng: boss còn sống đi xa nhất, "Trùm  1 234 / 2 500". */
export class BossBar {
  private back: Phaser.GameObjects.Rectangle;
  private fill: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private visible = true;
  private hp = -1;
  private maxHp = -1;
  private frac = -1;

  constructor(scene: Phaser.Scene) {
    const x = GAME_W / 2 - W / 2;
    this.back = scene.add.rectangle(x, Y, W, H, 0x000000, 0.7).setOrigin(0).setDepth(DEPTH).setStrokeStyle(2, 0x5b6585);
    this.fill = scene.add.rectangle(x, Y, W, H, 0xd32f2f).setOrigin(0).setDepth(DEPTH + 1);
    this.label = scene.add
      .text(GAME_W / 2, Y + H / 2, '', textStyle({ size: 22, bold: true, color: '#ffffff', stroke: { color: '#000000', width: 3 } }))
      .setOrigin(0.5)
      .setDepth(DEPTH + 2);
    this.setVisible(false);
  }

  private setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    this.back.setVisible(v);
    this.fill.setVisible(v);
    this.label.setVisible(v);
  }

  update(state: GameState): void {
    const b = leadBoss(state.enemies);
    if (!b) {
      this.setVisible(false);
      return;
    }
    this.setVisible(true);
    const hp = hpValue(b.hp);
    const max = Math.ceil(b.maxHp);
    if (hp !== this.hp || max !== this.maxHp) {
      this.hp = hp;
      this.maxHp = max;
      this.label.setText(bossLabel(state.config.enemies.boss.name, b.hp, b.maxHp));
    }
    const frac = hpFraction(b.hp, b.maxHp);
    if (frac !== this.frac) {
      this.frac = frac;
      this.fill.scaleX = frac;
    }
  }
}
