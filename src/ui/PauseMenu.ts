import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { motion } from '../settings/motion';
import { Button } from './BottomBar';
import { LAYOUT } from './layout';
import { COLORS, GAME_H, GAME_W, textStyle } from './theme';

const DEPTH = 450; // trên mọi thứ trừ màn kết quả (500)
const P = LAYOUT.popup;
const ON_FILL = 0x2e7d32;
const OFF_FILL = 0x5a3030;
const DANGER_FILL = 0xc62828;
const KNOB_R = P.slider.knobR;

export interface PauseMenuHooks {
  /** Popup mở/đóng: GameScene dừng/chạy lại ván và âm thanh. */
  onToggle(open: boolean): void;
  /** Pha hiện tại của ván. */
  phase(): string;
  /** Lúc chuẩn bị: lưu, chờ xong rồi về màn hình chính. */
  saveAndLeave(): Promise<void>;
  /** Lúc wave: đã xác nhận thoát — ghi thua và về màn hình chính. */
  quitAsLoss(): void;
  /** Chơi lại đã xác nhận: ghi thua một lần và bắt đầu ván mới (hook tự đóng popup). */
  restart(): void;
}

type Fadable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Alpha;
interface Fade {
  o: Fadable;
  a: number;
}

/** Popup tạm dừng: Tiếp tục / Chơi lại / Âm thanh / Giảm chuyển động / Màn hình chính. Mọi đối tượng được tạo lúc mở và hủy lúc đóng. */
export class PauseMenu {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private buttons: Button[] = [];
  private confirmObjs: Phaser.GameObjects.GameObject[] = [];
  private confirmButtons: Button[] = [];
  private isOpen = false;
  private busy = false;
  private dragging = false;
  private soundBtn: Button | null = null;
  private motionBtn: Button | null = null;
  private fadeTween: Phaser.Tweens.Tween | null = null;
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

  /** Hộp xác nhận (Thoát / Chơi lại) đang mở. */
  get confirming(): boolean {
    return this.confirmObjs.length > 0;
  }

  show(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.busy = false;
    this.hooks.onToggle(true);
    this.build();
    this.fadeInAll();
    this.scene.input.on('pointermove', this.onMove);
    this.scene.input.on('pointerup', this.onUp);
    this.scene.input.on('pointerupoutside', this.onUp);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.teardown(true);
    this.hooks.onToggle(false);
  }

  /** Phím tắt Tiếp tục (như bấm nút): bỏ qua khi đang lưu/đang rời. */
  requestClose(): void {
    this.onContinue();
  }

  /** Phím Esc trong hộp xác nhận = Không. */
  cancelConfirm(): void {
    if (this.busy) return;
    this.destroyConfirm();
  }

  /** Scene tắt/restart: hủy mọi thứ, không gọi hook (scene đã tự dọn). */
  private dispose(): void {
    this.isOpen = false;
    this.teardown(false);
  }

  private items(): Phaser.GameObjects.GameObject[] {
    const items: Phaser.GameObjects.GameObject[] = [...this.objs];
    for (const b of this.buttons) items.push(b.bg, b.label);
    return items;
  }

  private teardown(fade: boolean): void {
    this.scene.input.off('pointermove', this.onMove);
    this.scene.input.off('pointerup', this.onUp);
    this.scene.input.off('pointerupoutside', this.onUp);
    this.endDrag();
    this.destroyConfirm();
    this.fadeTween?.stop();
    this.fadeTween = null;
    const items = this.items();
    this.buttons = [];
    this.objs = [];
    this.soundBtn = null;
    this.motionBtn = null;
    this.fill = null;
    this.knob = null;
    this.pct = null;
    this.status = null;
    this.retire(items, fade && !motion.reduced);
  }

  /** Hủy các đối tượng; khi `fade` thì chặn chạm ngay rồi mờ dần (≤ 200 ms) mới hủy. */
  private retire(items: Phaser.GameObjects.GameObject[], fade: boolean): void {
    if (!fade || items.length === 0) {
      for (const o of items) o.destroy();
      return;
    }
    const list = this.fades(items);
    for (const o of items) o.disableInteractive();
    this.scene.tweens.addCounter({
      from: 1,
      to: 0,
      duration: P.fadeMs,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        for (const f of list) f.o.setAlpha(f.a * k);
      },
      onComplete: () => {
        for (const o of items) o.destroy();
      },
    });
  }

  private fades(items: Phaser.GameObjects.GameObject[]): Fade[] {
    return items
      .filter((o): o is Fadable => typeof (o as Partial<Fadable>).alpha === 'number')
      .map((o) => ({ o, a: o.alpha }));
  }

  /** Mờ vào (≤ 200 ms); giảm chuyển động thì hiện ngay. */
  private fadeInAll(): void {
    if (motion.reduced) return;
    const list = this.fades(this.items());
    for (const f of list) f.o.setAlpha(0);
    this.fadeTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: P.fadeMs,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 1;
        for (const f of list) f.o.setAlpha(f.a * k);
      },
      onComplete: () => {
        this.fadeTween = null;
      },
    });
  }

  private build(): void {
    const s = this.scene;
    const cx = GAME_W / 2;
    const box = P.box;
    this.objs.push(s.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.75).setOrigin(0).setDepth(DEPTH).setInteractive());
    this.objs.push(s.add.rectangle(box.x, box.y, box.w, box.h, COLORS.bar).setOrigin(0).setDepth(DEPTH + 1).setStrokeStyle(2, 0x5b6585));
    this.objs.push(
      s.add.text(cx, P.titleY, 'Tạm dừng', textStyle({ size: 36, bold: true, color: '#ffffff' }))
        .setOrigin(0.5).setDepth(DEPTH + 2),
    );
    const btnOpts = (fill?: number) => ({ depth: DEPTH + 2, fontSize: 26, fill });
    this.buttons.push(Button.at(s, P.continue, 'Tiếp tục', () => this.onContinue(), btnOpts(ON_FILL)));
    this.buttons.push(Button.at(s, P.restart, 'Chơi lại', () => this.onRestart(), btnOpts()));

    // Hàng âm thanh
    this.objs.push(
      s.add.text(P.slider.x, P.soundLabelY, 'Âm thanh', textStyle({ size: 26, color: COLORS.text }))
        .setOrigin(0, 0.5).setDepth(DEPTH + 2),
    );
    this.soundBtn = Button.at(s, P.sound, '', () => this.toggleSound(), { depth: DEPTH + 2, fontSize: 24 });
    this.buttons.push(this.soundBtn);

    // Thanh âm lượng: vùng chạm cao 82px quanh thanh để dễ kéo bằng ngón tay.
    this.trackX = P.slider.x;
    this.trackW = P.slider.w;
    const ty = P.slider.y;
    this.objs.push(s.add.rectangle(this.trackX, ty - 5, this.trackW, 10, 0x0d0f16).setOrigin(0).setDepth(DEPTH + 2).setStrokeStyle(1, 0x5b6585));
    this.fill = s.add.rectangle(this.trackX, ty - 5, 0, 10, 0x66bb6a).setOrigin(0).setDepth(DEPTH + 3);
    this.knob = s.add.circle(this.trackX, ty, KNOB_R, 0xffffff).setDepth(DEPTH + 4).setStrokeStyle(2, 0x5b6585);
    const sh = P.slider.hit;
    const hit = s.add.rectangle(sh.x, sh.y, sh.w, sh.h, 0xffffff, 0.001)
      .setOrigin(0).setDepth(DEPTH + 5).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.setFromX(p.x);
    });
    this.pct = s.add.text(box.x + box.w - 40, ty, '', textStyle({ size: 24, color: COLORS.text }))
      .setOrigin(1, 0.5).setDepth(DEPTH + 2);
    this.objs.push(this.fill, this.knob, hit, this.pct);

    // Hàng giảm chuyển động
    this.objs.push(
      s.add.text(P.slider.x, P.motionLabelY, 'Giảm chuyển động', textStyle({ size: 26, color: COLORS.text }))
        .setOrigin(0, 0.5).setDepth(DEPTH + 2),
    );
    this.motionBtn = Button.at(s, P.motion, '', () => this.toggleMotion(), { depth: DEPTH + 2, fontSize: 24 });
    this.buttons.push(this.motionBtn);

    this.buttons.push(Button.at(s, P.home, 'Màn hình chính', () => this.onHome(), btnOpts()));
    this.status = s.add.text(cx, P.statusY, '', textStyle({ size: 22, color: COLORS.muted }))
      .setOrigin(0.5).setDepth(DEPTH + 2);
    this.objs.push(this.status);
    this.refreshSound();
    this.refreshMotion();
  }

  private refreshMotion(): void {
    const on = motion.reduced;
    this.motionBtn?.setText(on ? 'Bật' : 'Tắt');
    this.motionBtn?.bg.setFillStyle(on ? ON_FILL : OFF_FILL);
  }

  private toggleMotion(): void {
    if (this.busy) return;
    // Các hiệu ứng đọc `motion.reduced` lúc bắt đầu nên có hiệu lực ngay.
    motion.set(!motion.reduced);
    this.refreshMotion();
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
      this.showConfirm('Thoát bây giờ sẽ bị tính thua. Thoát?', () => this.onQuit());
      return;
    }
    void this.leaveWithSave();
  }

  private onRestart(): void {
    if (this.busy) return;
    this.showConfirm('Chơi lại từ đầu? Ván này sẽ bị tính thua.', () => this.onRestartYes());
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

  private showConfirm(message: string, onYes: () => void): void {
    if (this.confirmObjs.length) return;
    const s = this.scene;
    const cx = GAME_W / 2;
    const c = P.confirm;
    const d = DEPTH + 20;
    this.confirmObjs.push(s.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0).setDepth(d).setInteractive());
    this.confirmObjs.push(s.add.rectangle(c.box.x, c.box.y, c.box.w, c.box.h, COLORS.bar).setOrigin(0).setDepth(d + 1).setStrokeStyle(2, 0x5b6585));
    this.confirmObjs.push(
      s.add.text(cx, c.textY, message, textStyle({
        size: 28, bold: true, color: '#ffffff', align: 'center', wrap: c.box.w - 60,
      })).setOrigin(0.5).setDepth(d + 2),
    );
    this.confirmButtons.push(
      Button.at(s, c.yes, 'Có', onYes, { depth: d + 2, fontSize: 26, fill: DANGER_FILL }),
      Button.at(s, c.no, 'Không', () => this.destroyConfirm(), { depth: d + 2, fontSize: 26 }),
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

  private onRestartYes(): void {
    if (this.busy) return;
    this.busy = true;
    this.hooks.restart();
  }
}
