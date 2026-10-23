import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { StartScene } from './scenes/StartScene';
import { refreshCloudCache } from './net/cloudCache';

async function boot(): Promise<void> {
  try {
    await refreshCloudCache();
  } catch {
    /* offline: chơi bằng cấu hình mặc định/cục bộ */
  }
  new Phaser.Game({
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game',
    backgroundColor: '#12141c',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [StartScene, GameScene],
  });
}

void boot();
