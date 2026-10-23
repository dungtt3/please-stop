import Phaser from 'phaser';
import { authAvailable, currentAccount, PROVIDER_LABEL, PROVIDERS, signIn, signOut, type Account } from '../net/auth';
import { recordRun } from '../net/cloud';
import { supabaseSaves } from '../net/saves';
import { SaveManager, type StartInfo } from '../save/SaveManager';
import { browserStore } from '../settings/configStore';
import { runStatsOf, type RunSave } from '../sim/save';
import { Button } from '../ui/BottomBar';
import { Toast } from '../ui/Toast';
import { COLORS, FONT, GAME_H, GAME_W } from '../ui/theme';
import type { GameSceneData, GameStart } from './GameScene';

const MAIN_FILL = 0x2e7d32;
const DANGER_FILL = 0xc62828;
const MODAL_DEPTH = 600;

interface Choice {
  label: string;
  fill?: number;
}

/** Màn hình bắt đầu: chọn ván nào để vào, đăng nhập / đăng xuất (spec mục 4, 5, 6.3). */
export class StartScene extends Phaser.Scene {
  /** Tăng mỗi lần vào và mỗi lần thoát scene; kết quả async của lần vào cũ so khác `gen` thì bỏ. */
  private gen = 0;
  /** Đang tải hoặc đang chạy một hành động async: mọi nút không làm gì. */
  private busy = true;
  /** Số đối tượng trong scene lúc `draw` bắt đầu (để bỏ phần đã vẽ nếu `draw` ném giữa chừng). */
  private drawMark: number | null = null;
  private toast!: Toast;

  constructor() {
    super('Start');
  }

  create(): void {
    // Scene được vào lại nhiều lần (Màn hình chính, xung đột, đăng xuất): xóa hết trạng thái của lần trước.
    this.gen++;
    this.busy = true;
    this.drawMark = null;
    // Trang được khôi phục từ bfcache (vd bấm Back ở trang đăng nhập): scene có thể đang giữ `busy`
    // sau khi bắt đầu đăng nhập → vào lại từ đầu.
    const onPageShow = (e: PageTransitionEvent): void => {
      if (e.persisted) this.scene.restart();
    };
    window.addEventListener('pageshow', onPageShow);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.gen++;
      window.removeEventListener('pageshow', onPageShow);
    });
    this.add
      .text(GAME_W / 2, 130, 'Merge Defense', { fontFamily: FONT, fontSize: '64px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);
    const loading = this.add
      .text(GAME_W / 2, 340, 'Đang tải…', { fontFamily: FONT, fontSize: '28px', color: COLORS.muted })
      .setOrigin(0.5);
    this.toast = new Toast(this);
    const g = this.gen;
    void this.boot(loading)
      .catch(async (e) => {
        // Không để lỗi bất ngờ khóa người chơi ngoài ván: về chế độ khách, vẫn đọc ván khách trên máy.
        console.error('StartScene: không tải được màn hình bắt đầu', e);
        if (g !== this.gen) return;
        const fallback = new SaveManager({ store: browserStore(), cloud: null, userId: null });
        const info = await fallback.load().catch((): StartInfo => ({ kind: 'none' }));
        if (g !== this.gen) return;
        if (info.kind === 'lost') {
          this.enter(fallback, null, { kind: 'lost', save: info.save, record: info.record });
          return;
        }
        loading.destroy();
        // `draw` có thể đã ném giữa chừng: bỏ phần nó đã vẽ để không vẽ chồng hai lần.
        if (this.drawMark !== null) for (const o of this.children.list.slice(this.drawMark)) o.destroy();
        this.draw(fallback, null, info, info.kind === 'invalid');
        this.busy = false;
      })
      .catch((e) => console.error('StartScene: không vẽ được màn hình dự phòng', e));
  }

  private async boot(loading: Phaser.GameObjects.Text): Promise<void> {
    const g = this.gen;
    const dead = (): boolean => g !== this.gen;

    const account = authAvailable() ? await currentAccount() : null;
    if (dead()) return;
    const manager = new SaveManager({
      store: browserStore(),
      cloud: account ? supabaseSaves() : null,
      userId: account?.userId ?? null,
    });

    let guest: RunSave | null = null;
    if (account) {
      const c = manager.checkGuest();
      guest = c.guest;
      if (c.lostGuest) void recordRun(runStatsOf(c.lostGuest));
    }
    let info = await manager.load();
    if (dead()) return;
    // Nhớ để vẫn báo "Không đọc được ván đã lưu" khi ván khách được nhận thay chỗ.
    const unreadable = info.kind === 'invalid';

    // Chỉ gộp khi tài khoản chưa có ván dở ('none' / 'invalid'), hoặc hỏi khi cả hai có ván ('resume').
    // Không gộp lần này (ván khách ở yên trên máy, lần vào sau có mạng sẽ gộp hoặc hỏi) khi:
    // - offline: không biết tài khoản có ván hay không;
    // - 'lost': để "Chơi lại" không đụng dòng vừa gộp;
    // - 'elsewhere': ván tài khoản có thể đang được chơi ở máy khác.
    if (account && guest && !manager.offline) {
      const guestRun = guest.runId;
      // Lần gộp trước hết giờ nhưng server đã ghi: ván khách đã nằm trên tài khoản, chỉ bỏ bản khách.
      const alreadyAdopted = (i: StartInfo): boolean => i.kind === 'resume' && i.save.runId === guestRun;
      if (alreadyAdopted(info)) {
        manager.dropGuest();
      } else if (info.kind === 'none' || info.kind === 'invalid') {
        // 'conflict' / 'pending': ván khách giữ nguyên trên máy này, hiện trạng thái tài khoản như chưa gộp (R2).
        const r = await manager.adoptGuest();
        if (dead()) return;
        if (r === 'ok') info = { kind: 'resume', save: guest };
        else if (r === 'pending') {
          // Lỗi mạng có thể là hết giờ mà server đã ghi: đọc lại để không mở "Chơi" đè lên ván vừa gộp.
          info = await manager.load();
          if (dead()) return;
          if (alreadyAdopted(info)) manager.dropGuest();
        }
      } else if (info.kind === 'resume') {
        const keepDevice =
          (await this.ask('Giữ ván nào?', [
            { label: `Giữ ván trên máy này (wave ${guest.game.wave})` },
            { label: `Giữ ván của tài khoản (wave ${info.save.game.wave})` },
          ])) === 0;
        if (dead()) return;
        if (keepDevice) {
          void recordRun(runStatsOf(info.save));
          void manager.end(info.save.runId);
          const r = await manager.adoptGuest();
          if (dead()) return;
          // Không gộp được: ván khách vẫn trên máy, còn ván tài khoản đã bị kết thúc ở trên → đọc lại cho đúng.
          info = r === 'ok' ? { kind: 'resume', save: guest } : await manager.load();
          if (dead()) return;
          if (r !== 'ok' && alreadyAdopted(info)) manager.dropGuest();
        } else {
          void recordRun(runStatsOf(guest));
          manager.dropGuest();
        }
      }
    }

    if (info.kind === 'lost') {
      this.enter(manager, account, { kind: 'lost', save: info.save, record: info.record });
      return;
    }

    loading.destroy();
    this.draw(manager, account, info, unreadable);
    this.busy = false;
  }

  private draw(manager: SaveManager, account: Account | null, info: StartInfo, unreadable: boolean): void {
    this.drawMark = this.children.list.length;
    const cx = GAME_W / 2;
    const g = this.gen;
    const stale = (): boolean => g !== this.gen;
    const notes: string[] = [];
    if (manager.offline) notes.push('Không kết nối được, đang dùng bản lưu trên máy này');
    if (unreadable) notes.push('Không đọc được ván đã lưu');
    notes.forEach((n, i) => {
      if (i === 0) this.toast.show(n);
      else this.time.delayedCall(i * 1700, () => this.toast.show(n));
    });

    const mainBtn = (y: number, text: string, onClick: () => void): void => {
      new Button(this, cx - 210, y, 420, 72, text, onClick, { fontSize: 30, fill: MAIN_FILL });
    };
    const newGameBtn = (y: number, primary: boolean, save: RunSave): void => {
      const onClick = this.guarded(async () => {
        const yes = (await this.ask('Bỏ ván đang chơi dở?', [{ label: 'Có', fill: DANGER_FILL }, { label: 'Không' }])) === 0;
        if (!yes || stale()) return;
        void recordRun(runStatsOf(save));
        void manager.end(save.runId);
        this.enter(manager, account, { kind: 'new' });
        return true;
      });
      if (primary) mainBtn(y, 'Ván mới', onClick);
      else new Button(this, cx - 210, y, 420, 66, 'Ván mới', onClick, { fontSize: 28 });
    };

    if (info.kind === 'resume') {
      mainBtn(260, `Chơi tiếp — Wave ${info.save.game.wave}`, this.guarded(async () => {
        this.enter(manager, account, { kind: 'resume', save: info.save });
        return true;
      }));
      newGameBtn(352, false, info.save);
    } else if (info.kind === 'elsewhere') {
      this.add
        .text(cx, 262, `Ván đang được chơi ở thiết bị khác (wave ${info.save.game.wave})`, {
          fontFamily: FONT, fontSize: '24px', color: COLORS.gold, align: 'center', wordWrap: { width: GAME_W - 200 },
        })
        .setOrigin(0.5);
      newGameBtn(310, true, info.save);
    } else {
      mainBtn(280, 'Chơi', this.guarded(async () => {
        this.enter(manager, account, { kind: 'new' });
        return true;
      }));
    }

    if (!authAvailable()) return;
    if (account) {
      this.add
        .text(cx, 520, `Đã đăng nhập: ${account.name}`, { fontFamily: FONT, fontSize: '22px', color: COLORS.text })
        .setOrigin(0.5);
      new Button(this, cx - 130, 556, 260, 56, 'Đăng xuất', this.guarded(async () => {
        await signOut();
        if (stale()) return;
        this.scene.restart();
        return true;
      }), { fontSize: 22 });
    } else {
      this.add
        .text(cx, 506, 'Đăng nhập để chơi tiếp trên thiết bị khác', { fontFamily: FONT, fontSize: '18px', color: COLORS.muted })
        .setOrigin(0.5);
      PROVIDERS.forEach((p, i) => {
        new Button(this, cx - 180, 534 + i * 64, 360, 56, PROVIDER_LABEL[p], this.guarded(async () => {
          const started = await signIn(p);
          if (stale()) return;
          if (started) return true; // trình duyệt đang chuyển trang
          this.toast.show('Không mở được đăng nhập');
        }), { fontSize: 22 });
      });
    }
  }

  /** Bọc một hành động nút: bỏ qua khi đang bận, bật `busy` suốt lúc chạy. `true` = giữ bận (sắp rời scene). */
  private guarded(fn: () => Promise<boolean | void>): () => void {
    return () => {
      if (this.busy) return;
      this.busy = true;
      const g = this.gen;
      void (async () => {
        let keep = false;
        try {
          keep = (await fn()) === true;
        } catch (e) {
          console.error('StartScene: hành động thất bại', e);
        }
        if (g === this.gen && !keep) this.busy = false;
      })();
    };
  }

  private enter(manager: SaveManager, account: Account | null, start: GameStart): void {
    const data = { manager, start, accountName: account?.name ?? null } satisfies GameSceneData;
    this.scene.start('Game', data);
  }

  /** Hộp chọn vẽ trong scene (chặn mọi thứ phía sau); trả về chỉ số lựa chọn. */
  private ask(title: string, choices: Choice[]): Promise<number> {
    return new Promise((resolve) => {
      const cx = GAME_W / 2;
      const w = 560;
      const h = 150 + choices.length * 76;
      const top = (GAME_H - h) / 2;
      const objs: Phaser.GameObjects.GameObject[] = [];
      objs.push(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.75).setOrigin(0).setDepth(MODAL_DEPTH).setInteractive());
      objs.push(
        this.add.rectangle(cx - w / 2, top, w, h, COLORS.bar).setOrigin(0).setDepth(MODAL_DEPTH + 1).setStrokeStyle(2, 0x5b6585),
      );
      objs.push(
        this.add
          .text(cx, top + 50, title, { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#ffffff', align: 'center' })
          .setOrigin(0.5).setDepth(MODAL_DEPTH + 2),
      );
      let done = false;
      const buttons = choices.map(
        (c, i) =>
          new Button(this, cx - (w - 60) / 2, top + 100 + i * 76, w - 60, 64, c.label, () => {
            if (done) return;
            done = true;
            for (const o of objs) o.destroy();
            for (const b of buttons) {
              b.bg.destroy();
              b.label.destroy();
            }
            resolve(i);
          }, { depth: MODAL_DEPTH + 2, fontSize: 24, fill: c.fill }),
      );
    });
  }
}
