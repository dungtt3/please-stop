import { uuid } from '../save/localSaves';
import type { SaveManager, SaveResult } from '../save/SaveManager';
import { saveFingerprint, snapshotRun, type RunSave } from '../sim/save';
import type { GameState } from '../sim/types';

/** Khoảng tối thiểu giữa hai lần tự lưu (ms, thời gian thật). */
export const AUTOSAVE_MS = 1000;

export interface RunSaverHooks {
  /** Ván này đã được chơi ở máy khác: dừng lưu. Gọi tối đa một lần mỗi ván. */
  onConflict(): void;
  /** Không ghi được vào trình duyệt. Gọi tối đa một lần mỗi ván. */
  onUnsaved(): void;
}

type Manager = Pick<SaveManager, 'deviceId' | 'save' | 'end'>;

/** Giữ runId/runSeconds của ván đang chơi và quyết định khi nào lưu (không phụ thuộc Phaser). */
export class RunSaver {
  runId = '';
  runSeconds = 0;
  private active = false;
  private lastFp: string | null = null;
  private sinceSave = 0;
  private warnedUnsaved = false;

  constructor(
    private manager: Manager,
    private hooks: RunSaverHooks,
    private now: () => number = Date.now,
    private newId: () => string = uuid,
  ) {}

  /** Ván đang được theo dõi để lưu (chưa kết thúc, chưa bị bỏ, chưa xung đột). */
  get live(): boolean {
    return this.active;
  }

  private reset(runId: string, runSeconds: number, active: boolean, fp: string | null): void {
    this.runId = runId;
    this.runSeconds = runSeconds;
    this.active = active;
    this.lastFp = fp;
    this.sinceSave = 0;
    this.warnedUnsaved = false;
  }

  /** Ván mới: runId mới và lưu ngay. */
  beginNew(state: GameState): void {
    this.reset(this.newId(), 0, true, null);
    void this.saveNow(state);
  }

  /** Tiếp tục ván đã lưu: bản đó đã nằm trong kho, chỉ lưu lại khi có gì đổi. */
  resume(save: RunSave): void {
    this.reset(save.runId, save.runSeconds, true, saveFingerprint(save));
  }

  /** Ván thua vào từ StartInfo: đã kết thúc trong `load`, không lưu, không `end`. */
  markLost(save: RunSave): void {
    this.reset(save.runId, save.runSeconds, false, null);
  }

  addSeconds(dt: number): void {
    this.runSeconds += dt;
  }

  /** Gọi mỗi khung hình. Chỉ lưu lúc chuẩn bị, menu đóng, mỗi AUTOSAVE_MS và khi ván đã đổi. */
  tick(state: GameState, deltaMs: number, menuOpen: boolean): void {
    if (!this.active || menuOpen || state.phase !== 'prep') return;
    this.sinceSave += deltaMs;
    if (this.sinceSave < AUTOSAVE_MS) return;
    this.sinceSave = 0;
    // Dấu vân tay chỉ so sánh được khi đang prep (gồm hồi chiêu và RNG).
    if (this.lastFp === null || saveFingerprint(this.snapshot(state)) !== this.lastFp) void this.saveNow(state);
  }

  /** Sự kiện waveStart: ghi bản `inWave`. */
  waveStarted(state: GameState): void {
    if (state.phase === 'wave') void this.saveNow(state);
  }

  /** Sự kiện waveEnd: ghi đè bản `inWave` bằng bản chuẩn bị mới. */
  waveEnded(state: GameState): void {
    if (state.phase === 'prep') void this.saveNow(state);
  }

  /** Tab bị ẩn lúc đang chuẩn bị. */
  flushPrep(state: GameState): void {
    if (state.phase === 'prep') void this.saveNow(state);
  }

  /** Ván kết thúc (thắng/thua) hoặc bị bỏ: xóa bản lưu, không chặn giao diện, và không lưu thêm. */
  end(): void {
    if (!this.active) return;
    this.active = false;
    void this.manager.end(this.runId).catch(() => undefined);
  }

  /** Lúc chuẩn bị: lưu ngay và chờ xong (tối đa timeoutMs). Trả về khi xong/hết giờ; không ném. */
  async saveAndWait(state: GameState, timeoutMs: number): Promise<void> {
    if (!this.active || state.phase !== 'prep') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const saved = this.saveNow(state);
      const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      });
      await Promise.race([saved, timeout]);
    } catch {
      /* không ném: về màn hình chính dù lưu lỗi */
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  /** Rời scene: dừng lưu mà không xóa bản lưu. */
  stop(): void {
    this.active = false;
  }

  private snapshot(state: GameState): RunSave {
    return snapshotRun(state, { runId: this.runId, deviceId: this.manager.deviceId, runSeconds: this.runSeconds, now: this.now() });
  }

  private saveNow(state: GameState): Promise<void> {
    if (!this.active || state.phase === 'won' || state.phase === 'lost') return Promise.resolve();
    const snap = this.snapshot(state);
    this.lastFp = saveFingerprint(snap);
    this.sinceSave = 0;
    const id = this.runId;
    return this.manager.save(snap).then(
      (r) => this.onResult(id, r),
      () => undefined,
    );
  }

  private onResult(id: string, r: SaveResult): void {
    if (!this.active || id !== this.runId) return;
    if (r === 'conflict') {
      this.active = false;
      this.hooks.onConflict();
    } else if (r === 'unsaved' && !this.warnedUnsaved) {
      this.warnedUnsaved = true;
      this.hooks.onUnsaved();
    }
  }
}
