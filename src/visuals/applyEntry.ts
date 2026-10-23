// Áp dụng mục manifest (scale/origin/tint) lên một sprite. Dùng chung cho view và hiệu ứng; không import Phaser lúc chạy.
import type Phaser from 'phaser';
import type { ManifestEntry } from './manifest';

/** Kích thước ô chuẩn của asset (docs/assets.md): sprite scale 1 vừa một ô 64 px. */
export const REF_TILE = 64;

export function applyEntry(s: Phaser.GameObjects.Sprite, e: ManifestEntry | undefined, tile: number): void {
  s.setScale(((e?.scale ?? 1) * tile) / REF_TILE).setOrigin(e?.originX ?? 0.5, e?.originY ?? 0.5);
  if (e?.tint !== undefined) s.setTint(e.tint);
  else s.clearTint();
}
