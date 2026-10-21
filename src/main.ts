import Phaser from 'phaser';

class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: 'game',
  backgroundColor: '#12141c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene],
});
