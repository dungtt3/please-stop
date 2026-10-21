import Phaser from 'phaser';
import type { GameState } from '../sim/types';
import { Button } from './BottomBar';
import { COLORS, FONT, GAME_H, GAME_W } from './theme';

export class ResultScreen {
  private shade: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private info: Phaser.GameObjects.Text;
  private btn: Button;
  private visible = false;

  constructor(scene: Phaser.Scene, restart: () => void) {
    this.shade = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.7).setOrigin(0).setDepth(500).setInteractive();
    this.title = scene.add
      .text(GAME_W / 2, 220, '', { fontFamily: FONT, fontSize: '72px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5).setDepth(501);
    this.info = scene.add
      .text(GAME_W / 2, 340, '', { fontFamily: FONT, fontSize: '30px', color: COLORS.text, align: 'center', lineSpacing: 10 })
      .setOrigin(0.5).setDepth(501);
    this.btn = new Button(scene, GAME_W / 2 - 130, 440, 260, 70, 'Chơi lại', restart, { depth: 501, fontSize: 30, fill: 0x2e7d32 });
    this.setVisible(false);
  }

  get open(): boolean {
    return this.visible;
  }

  private setVisible(v: boolean): void {
    this.visible = v;
    this.shade.setVisible(v);
    this.title.setVisible(v);
    this.info.setVisible(v);
    this.btn.setVisible(v);
  }

  update(s: GameState): void {
    const over = s.phase === 'won' || s.phase === 'lost';
    if (!over) {
      if (this.visible) this.setVisible(false);
      return;
    }
    if (!this.visible) {
      this.setVisible(true);
      this.title.setText(s.phase === 'won' ? 'Chiến thắng!' : 'Thất bại').setColor(s.phase === 'won' ? '#ffd54f' : '#ef5350');
      this.info.setText(`Wave đạt được: ${s.wave}/${s.config.economy.totalWaves}\nQuái đã giết: ${s.kills}`);
    }
  }
}
