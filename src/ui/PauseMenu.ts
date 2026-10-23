import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { Button } from './BottomBar';
import { COLORS, GAME_H, GAME_W, textStyle } from './theme';

const DEPTH = 450; // trên mọi thứ trừ màn kết quả (500)
const PANEL_W = 560;
const PANEL_H = 470;
const ON_FILL = 0x2e7d32;
const OFF_FILL = 0x5a3030;
const DANGER_FILL = 0xc62828;
const KNOB_R = 16;

export interface PauseMenuHooks {
  /** Popup mở/đóng: GameScene dừng/chạy lại ván và âm thanh. */
  onToggle(open: boolean): void;
  /** Pha hiện tại của ván. */
  phase(): string;
  /** Lúc chuẩn bị: lưu, chờ xong rồi về màn hình chính. */
  saveAndLeave(): Promise<void>;
  /** Lúc wave: đã xác nhận thoát — ghi thua và về màn hình chính. */
  quitAsLoss(): void;
}

/** Popup tạm dừng: Tiếp tục / Âm thanh / Màn hình chính. Mọi đối tượng được tạo lúc mở và hủy lúc đóng. */
export class PauseMenu {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private buttons: Button[] = [];
  private confirmObjs: Phaser.GameObjects.GameObject[] = [];
  private confirmButtons: Button[] = [];
  private isOpen = false;
  private busy = false;
  private dragging = false;
  private soundBtn: Button | null = null;
  private fill: Phaser.GameObjects.Rectangle | null = null;
  private knob: Phaser.GameObjects.Arc | null = null;
  private pct: Phaser.GameObjects.Text | null = null;
  private status: Phaser.GameObjects.Text | null = null;
  private trackX = 0;
  private trackW = 0;

  private readonly onMove = (p: Phaser.Input.Pointer): void => {
    if (this.dragging) this.setFromX(p.x);
  };
  private readonly onUp = (): void => {
    this.endDrag();
  };

  constructor(private scene: Phaser.Scene, private hooks: PauseMenuHooks) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
  }

  get open(): boolean {
    return this.isOpen;
  }

  show(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.busy = false;
    this.hooks.onToggle(true);
    this.build();
    this.scene.input.on('pointermove', this.onMove);
    this.scene.input.on('pointerup', this.onUp);
    this.scene.input.on('pointerupoutside', this.onUp);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.teardown();
    this.hooks.onToggle(false);
  }

  /** Scene tắt/restart: hủy mọi thứ, không gọi hook (scene đã tự dọn). */
  private dispose(): void {
    this.isOpen = false;
    this.teardown();
  }

  private teardown(): void {
    this.scene.input.off('pointermove', this.onMove);
    this.scene.input.off('pointerup', this.onUp);
    this.scene.input.off('pointerupoutside', this.onUp);
    this.endDrag();
    this.destroyConfirm();
    for (const b of this.buttons) {
      b.bg.destroy();
      b.label.destroy();
    }
    for (const o of this.objs) o.destroy();
    this.buttons = [];
    this.objs = [];
    this.soundBtn = null;
    this.fill = null;
    this.knob = null;
    this.pct = null;
    this.status = null;
  }

  private build(): void {
    const s = this.scene;
    const cx = GAME_W / 2;
    const left = cx - PANEL_W / 2;
    const top = (GAME_H - PANEL_H) / 2;
    this.objs.push(s.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.75).setOrigin(0).setDepth(DEPTH).setInteractive());
    this.objs.push(s.add.rectangle(left, top, PANEL_W, PANEL_H, COLORS.bar).setOrigin(0).setDepth(DEPTH + 1).setStrokeStyle(2, 0x5b6585));
    this.objs.push(
      s.add.text(cx, top + 46, 'Tạm dừng', textStyle({ size: 36, bold: true, color: '#ffffff' }))
        .setOrigin(0.5).setDepth(DEPTH + 2),
    );
    const btnOpts = (fill?: number) => ({ depth: DEPTH + 2, fontSize: 26, fill });
    this.buttons.push(new Button(s, left + 40, top + 92, PANEL_W - 80, 64, 'Tiếp tục', () => this.onContinue(), btnOpts(ON_FILL)));

    // Hàng âm thanh
    this.objs.push(
      s.add.text(left + 40, top + 196, 'Âm thanh', textStyle({ size: 26, color: COLORS.text }))
        .setOrigin(0, 0.5).setDepth(DEPTH + 2),
    );
    this.soundBtn = new Button(s, left + PANEL_W - 40 - 140, top + 168, 140, 56, '', () => this.toggleSound(), { depth: DEPTH + 2, fontSize: 24 });
    this.buttons.push(this.soundBtn);

    // Thanh âm lượng: vùng chạm cao 56px quanh thanh để dễ kéo bằng ngón tay.
    this.trackX = left + 40;
    this.trackW = PANEL_W - 80 - 90;
    const ty = top + 268;
    this.objs.push(s.add.rectangle(this.trackX, ty - 5, this.trackW, 10, 0x0d0f16).setOrigin(0).setDepth(DEPTH + 2).setStrokeStyle(1, 0x5b6585));
    this.fill = s.add.rectangle(this.trackX, ty - 5, 0, 10, 0x66bb6a).setOrigin(0).setDepth(DEPTH + 3);
    this.knob = s.add.circle(this.trackX, ty, KNOB_R, 0xffffff).setDepth(DEPTH + 4).setStrokeStyle(2, 0x5b6585);
    const hit = s.add.rectangle(this.trackX - KNOB_R, ty - 28, this.trackW + 2 * KNOB_R, 56, 0xffffff, 0.001)
      .setOrigin(0).setDepth(DEPTH + 5).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.setFromX(p.x);
    });
    this.pct = s.add.text(left + PANEL_W - 40, ty, '', textStyle({ size: 24, color: COLORS.text }))
      .setOrigin(1, 0.5).setDepth(DEPTH + 2);
    this.objs.push(this.fill, this.knob, hit, this.pct);

    this.buttons.push(new Button(s, left + 40, top + 326, PANEL_W - 80, 64, 'Màn hình chính', () => this.onHome(), btnOpts()));
    this.status = s.add.text(cx, top + 424, '', textStyle({ size: 22, color: COLORS.muted }))
      .setOrigin(0.5).setDepth(DEPTH + 2);
    this.objs.push(this.status);
    this.refreshSound();
  }

  private refreshSound(): void {
    const { on, volume } = sfx.settings;
    this.soundBtn?.setText(on ? 'Bật' : 'Tắt');
    this.soundBtn?.bg.setFillStyle(on ? ON_FILL : OFF_FILL);
    const pct = Math.round(volume * 100);
    this.pct?.setText(`${pct}%`);
    const w = this.trackW * volume;
    this.fill?.setSize(w, 10);
    this.knob?.setPosition(this.trackX + w, this.knob.y);
    const a = on ? 1 : 0.45;
    this.fill?.setAlpha(a);
    this.knob?.setAlpha(a);
  }

  private setFromX(x: number): void {
    if (!this.isOpen || this.busy) return;
    const v = Math.min(1, Math.max(0, (x - this.trackX) / this.trackW));
    // Kéo: đổi âm lượng ngay nhưng chưa ghi localStorage; ghi một lần khi thả (endDrag).
    sfx.set({ volume: Math.round(v * 100) / 100 }, { persist: false });
    this.refreshSound();
  }

  private endDrag(): void {
    if (!this.dragging) return;
    this.dragging = false;
    sfx.persist();
  }

  private toggleSound(): void {
    if (this.busy) return;
    const on = !sfx.settings.on;
    sfx.set({ on });
    // Bật sau khi đã mở trang: tạo AudioContext ngay trong lần bấm này (đang tạm dừng nên chưa phát).
    if (on) sfx.unlock();
    this.refreshSound();
  }

  private onContinue(): void {
    if (this.busy) return;
    this.close();
  }

  private onHome(): void {
    if (this.busy) return;
    if (this.hooks.phase() === 'wave') {
      this.showConfirm();
      return;
    }
    void this.leaveWithSave();
  }

  private async leaveWithSave(): Promise<void> {
    this.busy = true;
    this.status?.setText('Đang lưu…');
    for (const b of this.buttons) b.setEnabled(false);
    try {
      await this.hooks.saveAndLeave();
    } catch {
      /* không chặn người chơi về màn hình chính */
    }
  }

  private showConfirm(): void {
    if (this.confirmObjs.length) return;
    const s = this.scene;
    const cx = GAME_W / 2;
    const w = 520;
    const h = 250;
    const top = (GAME_H - h) / 2;
    const d = DEPTH + 20;
    this.confirmObjs.push(s.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0).setDepth(d).setInteractive());
    this.confirmObjs.push(s.add.rectangle(cx - w / 2, top, w, h, COLORS.bar).setOrigin(0).setDepth(d + 1).setStrokeStyle(2, 0x5b6585));
    this.confirmObjs.push(
      s.add.text(cx, top + 70, 'Thoát bây giờ sẽ bị tính thua. Thoát?', textStyle({
        size: 28, bold: true, color: '#ffffff', align: 'center', wrap: w - 60,
      })).setOrigin(0.5).setDepth(d + 2),
    );
    const bw = (w - 60 - 16) / 2;
    this.confirmButtons.push(
      new Button(s, cx - w / 2 + 30, top + h - 100, bw, 64, 'Có', () => this.onQuit(), { depth: d + 2, fontSize: 26, fill: DANGER_FILL }),
      new Button(s, cx - w / 2 + 30 + bw + 16, top + h - 100, bw, 64, 'Không', () => this.destroyConfirm(), { depth: d + 2, fontSize: 26 }),
    );
  }

  private destroyConfirm(): void {
    for (const b of this.confirmButtons) {
      b.bg.destroy();
      b.label.destroy();
    }
    for (const o of this.confirmObjs) o.destroy();
    this.confirmButtons = [];
    this.confirmObjs = [];
  }

  private onQuit(): void {
    if (this.busy) return;
    this.busy = true;
    this.hooks.quitAsLoss();
  }
}
