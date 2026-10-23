import Phaser from 'phaser';
import type { GameState } from '../sim/types';
import { Button } from './BottomBar';
import { formatNum } from '../visuals/viewMath';
import { LAYOUT } from './layout';
import { COLORS, GAME_H, GAME_W, textStyle } from './theme';
import { fetchTopScores, submitScore, type ScoreRow } from '../net/cloud';
import { MAX_NAME, sanitizeName } from '../settings/sanitizeName';

const NAME_KEY = 'ps.playerName';
const COL_ROWS = 10;
const R = LAYOUT.result;
/** Ô nhập tên DOM: chiều cao và cỡ chữ tối thiểu theo CSS px (chạm được, iOS không tự phóng to). */
const FORM_MIN_CSS_H = 44;
const FORM_MIN_CSS_FONT = 16;

function readName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
function writeName(n: string): void {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* bỏ qua */
  }
}

export class ResultScreen {
  private shade: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private info: Phaser.GameObjects.Text;
  private status: Phaser.GameObjects.Text;
  private boardTitle: Phaser.GameObjects.Text;
  private cols: Phaser.GameObjects.Text[];
  private btn: Button;
  private homeBtn: Button;
  private visible = false;
  private form: { wrap: HTMLDivElement; input: HTMLInputElement; send: HTMLButtonElement } | null = null;
  private submitted = false;
  private sending = false;
  /** Tăng mỗi lần mở/đóng để bỏ kết quả mạng cũ. */
  private epoch = 0;
  private score = { waveReached: 0, kills: 0, won: false };

  constructor(
    private scene: Phaser.Scene,
    restart: () => void,
    home: () => void,
    private defaultName: () => string,
  ) {
    this.shade = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.8).setOrigin(0).setDepth(500).setInteractive();
    this.title = scene.add
      .text(GAME_W / 2, R.titleY, '', textStyle({ size: 52, bold: true, color: '#ffffff' }))
      .setOrigin(0.5).setDepth(501);
    this.info = scene.add
      .text(GAME_W / 2, R.infoY, '', textStyle({ size: 24, color: COLORS.text, align: 'center' }))
      .setOrigin(0.5).setDepth(501);
    this.status = scene.add
      .text(GAME_W / 2, R.statusY, '', textStyle({ size: 22, color: COLORS.muted }))
      .setOrigin(0.5).setDepth(501);
    this.boardTitle = scene.add
      .text(GAME_W / 2, R.boardTitleY, 'Bảng xếp hạng', textStyle({ size: 24, bold: true, color: COLORS.gold }))
      .setOrigin(0.5).setDepth(501);
    this.cols = [0, 1].map((i) =>
      scene.add
        .text(R.colX[i], R.colsY, '', textStyle({ size: 22, mono: true, color: COLORS.text, extra: { lineSpacing: 2 } }))
        .setOrigin(0, 0).setDepth(501),
    );
    this.btn = Button.at(scene, R.replay, 'Chơi lại', restart, { depth: 501, fontSize: 28, fill: 0x2e7d32 });
    this.homeBtn = Button.at(scene, R.home, 'Màn hình chính', home, { depth: 501, fontSize: 28 });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeForm());
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
    this.status.setVisible(v);
    this.boardTitle.setVisible(v);
    for (const c of this.cols) c.setVisible(v);
    this.btn.setVisible(v);
    this.homeBtn.setVisible(v);
  }

  private makeForm(): void {
    this.removeForm();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;z-index:900;display:flex;align-items:stretch;font-family:system-ui,"Segoe UI",Roboto,Arial,sans-serif';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = MAX_NAME;
    input.placeholder = 'Tên của bạn (tối đa 20 ký tự)';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Tên của bạn');
    input.value = sanitizeName(readName() || this.defaultName());
    // Ô nhập phải chọn/sửa chữ được: không bao giờ user-select:none (kể cả khi trang chặn chọn chữ quanh canvas).
    input.style.cssText = 'flex:1;min-width:0;padding:0 10px;border:1px solid #5b6585;border-radius:6px;background:#0d0f16;color:#e8ebf5;font:inherit;font-size:1em;-webkit-user-select:text;user-select:text';
    const send = document.createElement('button');
    send.type = 'button';
    send.textContent = 'Gửi điểm';
    send.style.cssText = 'flex:0 0 auto;box-sizing:border-box;white-space:nowrap;padding:0 8px;border:0;border-radius:6px;background:#2e7d32;color:#fff;font:inherit;font-weight:600;cursor:pointer';
    wrap.append(input, send);
    document.body.appendChild(wrap);
    const syncSend = (): void => {
      const empty = sanitizeName(input.value) === '';
      send.disabled = this.submitted || this.sending || empty;
      send.style.opacity = send.disabled ? '0.45' : '1';
      send.style.cursor = send.disabled ? 'not-allowed' : 'pointer';
    };
    input.addEventListener('input', syncSend);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') send.click();
    });
    send.addEventListener('click', () => void this.send(input, syncSend));
    this.form = { wrap, input, send };
    syncSend();
  }

  private removeForm(): void {
    this.form?.wrap.remove();
    this.form = null;
  }

  private async send(input: HTMLInputElement, syncSend: () => void): Promise<void> {
    const name = sanitizeName(input.value);
    if (!name || this.submitted || this.sending) return;
    const epoch = this.epoch;
    this.sending = true;
    syncSend();
    this.setStatus('Đang gửi...', COLORS.muted);
    writeName(name);
    const r = await submitScore({ name, ...this.score });
    if (epoch !== this.epoch) return;
    this.sending = false;
    if (r.ok) {
      this.submitted = true;
      this.setStatus('Đã gửi!', '#81c784');
      void this.loadBoard(epoch);
    } else {
      this.setStatus('Không gửi được, thử lại', '#ff8a80');
    }
    syncSend();
  }

  private setStatus(t: string, color: string): void {
    this.status.setText(t).setColor(color);
  }

  private async loadBoard(epoch: number): Promise<void> {
    const rows = await fetchTopScores(20);
    if (epoch !== this.epoch) return;
    this.renderBoard(rows);
  }

  private renderBoard(rows: ScoreRow[] | null): void {
    if (rows === null) {
      this.cols[0].setText('Không tải được bảng xếp hạng');
      this.cols[1].setText('');
      return;
    }
    if (rows.length === 0) {
      this.cols[0].setText('Chưa có ai trên bảng.');
      this.cols[1].setText('');
      return;
    }
    const line = (r: ScoreRow, i: number): string =>
      `${String(i + 1).padStart(2)}. ${r.name.padEnd(MAX_NAME)} W${String(r.wave_reached).padStart(2)} ${formatNum(r.kills).padStart(9)}${r.won ? ' ✓' : ''}`;
    const lines = rows.map((r, i) => line({ ...r, name: sanitizeName(String(r.name)) }, i));
    this.cols[0].setText(lines.slice(0, COL_ROWS).join('\n'));
    this.cols[1].setText(lines.slice(COL_ROWS, COL_ROWS * 2).join('\n'));
  }

  /** Đặt ô nhập DOM lên đúng vị trí trên canvas đã co giãn. */
  private placeForm(): void {
    const f = this.form;
    if (!f) return;
    const rect = this.scene.game.canvas.getBoundingClientRect();
    const k = rect.width / GAME_W;
    const form = R.form;
    f.wrap.style.left = `${rect.left + form.x * k}px`;
    f.wrap.style.top = `${rect.top + form.y * k}px`;
    f.wrap.style.width = `${form.w * k}px`;
    // Cao ≥ 44 CSS px và chữ ≥ 16 CSS px dù canvas co nhỏ (82 khung game ≈ 44 CSS px ở 844×390).
    f.wrap.style.height = `${Math.max(FORM_MIN_CSS_H, form.h * k)}px`;
    f.wrap.style.fontSize = `${Math.max(FORM_MIN_CSS_FONT, 22 * k)}px`;
    f.wrap.style.gap = `${(R.send.rect.x - (R.name.rect.x + R.name.rect.w)) * k}px`;
    f.send.style.minWidth = `${R.send.rect.w * k}px`;
  }

  update(s: GameState): void {
    const over = s.phase === 'won' || s.phase === 'lost';
    if (!over) {
      if (this.visible) {
        this.setVisible(false);
        this.epoch++;
        this.removeForm();
      }
      return;
    }
    if (!this.visible) {
      this.setVisible(true);
      this.epoch++;
      this.submitted = false;
      this.sending = false;
      this.score = {
        waveReached: Math.max(0, Math.min(100, s.wave)),
        kills: Math.max(0, Math.min(1_000_000, s.kills)),
        won: s.phase === 'won',
      };
      this.title.setText(s.phase === 'won' ? 'Chiến thắng!' : 'Thất bại').setColor(s.phase === 'won' ? '#ffd54f' : '#ef5350');
      this.info.setText(`Wave đạt được: ${s.wave}/${s.config.economy.totalWaves}   ·   Quái đã giết: ${formatNum(s.kills)}`);
      this.setStatus('Nhập tên để lên bảng xếp hạng', COLORS.muted);
      this.cols[0].setText('Đang tải...');
      this.cols[1].setText('');
      this.makeForm();
      void this.loadBoard(this.epoch);
    }
    this.placeForm();
  }
}
