import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import type { GameState } from '../sim/types';
import { formatNum } from '../visuals/viewMath';
import { COLORS, GAME_W, TOP_BAR_H, textStyle } from './theme';

export class TopBar {
  private hp: Phaser.GameObjects.Text;
  private gold: Phaser.GameObjects.Text;
  private wave: Phaser.GameObjects.Text;
  private mod: Phaser.GameObjects.Text;
  private timer: Phaser.GameObjects.Text;
  private speedBtn: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, toggleSpeed: () => void, openMenu: () => void) {
    scene.add.rectangle(0, 0, GAME_W, TOP_BAR_H, COLORS.bar).setOrigin(0).setDepth(100);
    const mk = (x: number, size: number, color: string) =>
      scene.add.text(x, TOP_BAR_H / 2, '', textStyle({ size, color })).setOrigin(0, 0.5).setDepth(101);
    this.hp = mk(16, 24, COLORS.hp);
    this.gold = mk(116, 24, COLORS.gold);
    this.wave = mk(270, 24, COLORS.text);
    this.mod = mk(420, 22, COLORS.text);
    this.mod.setWordWrapWidth(430);
    this.mod.setLineSpacing(-4);
    this.timer = mk(860, 22, COLORS.text);
    this.speedBtn = scene.add
      .text(GAME_W - 16, TOP_BAR_H / 2, '', textStyle({
        size: 22, color: COLORS.text, extra: { backgroundColor: '#2f3650', padding: { x: 12, y: 16 } },
      }))
      .setOrigin(1, 0.5).setDepth(101).setInteractive({ useHandCursor: true });
    this.speedBtn.on('pointerdown', () => {
      sfx.unlock();
      sfx.play('click');
      toggleSpeed();
    });
    this.speedBtn.setText('Tốc độ ×1');
    const gear = scene.add
      .text(this.speedBtn.x - this.speedBtn.width - 12, TOP_BAR_H / 2, '⚙', textStyle({
        size: 28, color: COLORS.text, extra: { backgroundColor: '#2f3650', padding: { x: 12, y: 12 } },
      }))
      .setOrigin(1, 0.5).setDepth(101).setInteractive({ useHandCursor: true });
    gear.on('pointerdown', () => {
      sfx.unlock();
      sfx.play('click');
      openMenu();
    });
  }

  update(s: GameState, speed: 1 | 2): void {
    this.hp.setText(`❤ ${Math.max(0, Math.ceil(s.hp))}`);
    this.gold.setText(`💰 ${formatNum(Math.floor(s.gold))}`);
    this.wave.setText(`Wave ${s.wave}/${s.config.economy.totalWaves}`);
    if (s.modifier) {
      const m = s.config.modifiers[s.modifier];
      this.mod.setText(`${m.name}: ${m.desc}`);
    } else {
      this.mod.setText('');
    }
    if (s.phase === 'prep') this.timer.setText(`Chuẩn bị: ${Math.ceil(s.prepTimer)}s`);
    else if (s.phase === 'wave') this.timer.setText('Đang đánh!');
    else this.timer.setText(s.phase === 'won' ? 'Thắng!' : 'Thua!');
    this.speedBtn.setText(`Tốc độ ×${speed}`);
  }
}
