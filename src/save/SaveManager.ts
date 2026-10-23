import type { CloudRow, CloudSaves, PutResult } from '../net/saves';
import type { KeyValueStore } from '../settings/configStore';
import { parseRunSave, type RunSave } from '../sim/save';
import {
  GUEST_KEY, accountKey, addEnded, getDeviceId, readEnded, readLocal, removeEnded, removeLocal, writeLocal,
  type LocalSave,
} from './localSaves';

/** Bản `inWave` của máy khác mới ghi trong khoảng này (tuổi tính trên server) → có thể đang được chơi thật ở đó. */
export const ELSEWHERE_MS = 600_000;

export type StartInfo =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'resume'; save: RunSave }
  | { kind: 'lost'; save: RunSave; record: boolean }
  | { kind: 'elsewhere'; save: RunSave };
export type SaveResult = 'ok' | 'pending' | 'conflict' | 'unsaved';
export interface GuestCheck {
  lostGuest: RunSave | null;
  guest: RunSave | null;
}

/**
 * Các lệnh `end` chưa xong theo người dùng ('guest' cho khách), dùng chung cho mọi SaveManager:
 * về Màn hình chính tạo manager mới, nhưng `load` và put đầu tiên của ván mới vẫn phải đi sau chúng.
 */
const pendingEnds = new Map<string, Set<Promise<void>>>();

/** Luật lưu ván dở: khách chỉ dùng localStorage; tài khoản dùng cloud kèm bản sao cục bộ (spec 3.1, 6). */
export class SaveManager {
  readonly deviceId: string;
  readonly signedIn: boolean;
  private readonly store: KeyValueStore | null;
  private readonly cloud: CloudSaves | null;
  private readonly userId: string;
  private _offline = false;
  /** Đã gặp xung đột: ván này thuộc về máy khác, không ghi gì nữa. */
  private stopped = false;
  /** Bản đang chơi (giống bản cục bộ, kể cả khi store không ghi được). */
  private cur: LocalSave | null = null;
  private localOk = true;
  /** Lệnh put đang chạy (tuần tự) và những lần `save` đang chờ kết quả lần đẩy kế tiếp. */
  private queue: Promise<void> | null = null;
  private waiting: ((r: SaveResult) => void)[] | null = null;
  /** Lệnh put đang gửi (để `end` chờ đúng lệnh này, không chờ các lần lưu xếp hàng sau nó). */
  private inflight: Promise<unknown> | null = null;
  /** `savedAt` các bản put lỗi mạng của ván này: server có thể đã ghi mà máy không nhận được trả lời (hết giờ). */
  private uncertain: { runId: string; savedAt: number[] } | null = null;

  constructor(opts: { store: KeyValueStore | null; cloud: CloudSaves | null; userId: string | null }) {
    this.store = opts.store;
    this.cloud = opts.cloud;
    this.userId = opts.userId ?? '';
    this.signedIn = opts.userId !== null && opts.cloud !== null;
    this.deviceId = getDeviceId(opts.store);
  }

  get offline(): boolean {
    return this._offline;
  }

  private get key(): string {
    return this.signedIn ? accountKey(this.userId) : GUEST_KEY;
  }

  private get endsKey(): string {
    return this.signedIn ? this.userId : 'guest';
  }

  /** Chờ các lệnh `end` đang có lúc gọi (end mới hơn có thể chờ ngược lại put đang gửi → không chờ chúng). */
  private async awaitEnds(): Promise<void> {
    const set = pendingEnds.get(this.endsKey);
    if (set) await Promise.all([...set]);
  }

  async load(): Promise<StartInfo> {
    await this.awaitEnds();
    return this.signedIn ? this.loadAccount(true) : this.loadGuest();
  }

  async save(s: RunSave): Promise<SaveResult> {
    if (!this.signedIn) return writeLocal(this.store, GUEST_KEY, { save: s, baseRev: 0, dirty: false }) ? 'ok' : 'unsaved';
    if (this.stopped) return 'conflict';
    // Ghi cục bộ ngay (đồng bộ), rồi mới xếp hàng đẩy lên cloud.
    this.setCur({ save: s, baseRev: this.cur?.save.runId === s.runId ? this.cur.baseRev : 0, dirty: true });
    return new Promise<SaveResult>((resolve) => {
      (this.waiting ??= []).push(resolve);
      this.queue ??= this.pump();
    });
  }

  async end(runId: string): Promise<void> {
    const l = readLocal(this.store, this.key);
    const local = l && l !== 'invalid' && l.save.runId === runId ? l : null;
    const curRev = this.cur?.save.runId === runId ? this.cur.baseRev : 0;
    if (this.cur?.save.runId === runId) this.cur = null;
    if (local) removeLocal(this.store, this.key);
    if (!this.signedIn || this.stopped) return;
    // Rev cloud máy này biết của ván: dòng mà máy khác ghi tiếp sau rev này thì end không xóa.
    const known = Math.max(curRev, local?.baseRev ?? 0, ...readEnded(this.store, this.userId).filter((e) => e.runId === runId).map((e) => e.rev));
    // Chỉ chờ put đang gửi (nó có thể ghi lại dòng vừa bị xóa); put xếp hàng sau thì chờ ngược lại end này.
    const prior = this.inflight;
    const p = (async () => {
      await prior;
      if ((await this.cloudEnd(runId, known)) === 'error') addEnded(this.store, this.userId, runId, known);
      else removeEnded(this.store, this.userId, runId);
    })();
    const k = this.endsKey;
    let set = pendingEnds.get(k);
    if (!set) pendingEnds.set(k, (set = new Set()));
    set.add(p);
    try {
      await p;
    } finally {
      set.delete(p);
      if (!set.size && pendingEnds.get(k) === set) pendingEnds.delete(k);
    }
  }

  checkGuest(): GuestCheck {
    const g = readLocal(this.store, GUEST_KEY);
    if (!g || g === 'invalid') return { lostGuest: null, guest: null };
    if (g.save.inWave) {
      removeLocal(this.store, GUEST_KEY);
      return { lostGuest: g.save, guest: null };
    }
    return { lostGuest: null, guest: g.save };
  }

  /** Chuyển ván khách sang tài khoản. `'conflict'` = tài khoản đã có ván: trả ván khách về chỗ cũ, không chặn lưu. */
  async adoptGuest(): Promise<SaveResult> {
    const g = readLocal(this.store, GUEST_KEY);
    if (!this.signedIn || !g || g === 'invalid' || g.save.inWave) return 'ok';
    const save = g.save;
    this.setCur({ save, baseRev: 0, dirty: true });
    removeLocal(this.store, GUEST_KEY);
    const r = await this.cloudPut(save.runId, 0, save);
    if (r.ok) {
      if (this.cur?.save === save) this.setCur({ save, baseRev: r.rev, dirty: false });
      return 'ok';
    }
    if (r.error === 'network') return this.localOk ? 'pending' : 'unsaved';
    writeLocal(this.store, GUEST_KEY, { save, baseRev: 0, dirty: false });
    this.cur = null;
    removeLocal(this.store, this.key);
    return 'conflict';
  }

  dropGuest(): void {
    removeLocal(this.store, GUEST_KEY);
  }

  private loadGuest(): StartInfo {
    const l = readLocal(this.store, GUEST_KEY);
    if (l === 'invalid') return { kind: 'invalid' };
    if (!l) return { kind: 'none' };
    if (l.save.inWave) {
      removeLocal(this.store, GUEST_KEY);
      return { kind: 'lost', save: l.save, record: true };
    }
    return { kind: 'resume', save: l.save };
  }

  /** Thứ tự spec 6.2 "Khi mở game". `retry`: put bị xung đột (cloud vừa đổi) thì tải lại một lần. */
  private async loadAccount(retry: boolean): Promise<StartInfo> {
    // 1. Gửi lại các lệnh end còn treo.
    await this.flushEnded();
    // 2. Dòng cloud; dòng của ván đã kết thúc coi như không có.
    const fetched = await this.cloudFetch();
    this._offline = fetched === 'error';
    // Chỉ bỏ qua dòng mà lệnh end còn treo xóa được (máy này ghi, hoặc chưa ai ghi tiếp sau rev đã biết).
    const endedRow =
      fetched !== null && fetched !== 'error' &&
      readEnded(this.store, this.userId).some((e) => e.runId === fetched.runId && (fetched.deviceId === this.deviceId || fetched.rev <= e.rev));
    const row: CloudRow | null | 'error' = endedRow ? null : fetched;
    const read = readLocal(this.store, this.key);
    const local = read === 'invalid' ? null : read;
    const none: StartInfo = read === 'invalid' ? { kind: 'invalid' } : { kind: 'none' };
    this.cur = null;

    // 3. Chọn bản dùng.
    let cand: RunSave;
    let src: 'local' | 'cloud';
    if (row === 'error') {
      if (!local) return none;
      this.cur = local;
      cand = local.save;
      src = 'local';
    } else if (row) {
      const parsed = parseRunSave(row.save);
      if (!parsed) {
        await this.cloudEnd(row.runId, row.rev);
        removeLocal(this.store, this.key);
        return { kind: 'invalid' };
      }
      src = 'cloud';
      if (local && local.save.runId === row.runId && local.dirty && local.baseRev === row.rev) {
        // Máy này chơi tiếp lúc mất mạng, chưa ai ghi đè → đẩy bản cục bộ lên.
        this.cur = local;
        cand = local.save;
        if (!cand.inWave) {
          const r = await this.cloudPut(cand.runId, row.rev, cand);
          if (r.ok) this.setCur({ save: cand, baseRev: r.rev, dirty: false });
          else if (r.error === 'conflict' && retry) return this.loadAccount(false);
        }
      } else {
        // Cloud thắng (máy khác chơi tiếp, hoặc ván khác).
        cand = parsed;
        this.setCur({ save: parsed, baseRev: row.rev, dirty: false });
      }
    } else if (local && local.dirty && local.baseRev === 0) {
      // Ván mới tạo lúc offline. Bản inWave thì khỏi đẩy, nó sẽ bị tính thua ngay dưới đây.
      this.cur = local;
      cand = local.save;
      src = 'local';
      if (!cand.inWave) {
        const r = await this.cloudPut(cand.runId, 0, cand);
        if (r.ok) this.setCur({ save: cand, baseRev: r.rev, dirty: false });
        else if (r.error === 'conflict' && retry) return this.loadAccount(false);
      }
    } else {
      // Ván đã kết thúc ở nơi khác.
      removeLocal(this.store, this.key);
      return none;
    }

    // 4. Bị bỏ giữa wave.
    if (cand.inWave) {
      if (src === 'cloud' && row && row !== 'error') {
        if (cand.deviceId !== this.deviceId && row.ageMs < ELSEWHERE_MS) return { kind: 'elsewhere', save: cand };
        const r = await this.cloudEnd(cand.runId, row.rev);
        this.dropCur();
        if (r === 'error') addEnded(this.store, this.userId, cand.runId, row.rev);
        return { kind: 'lost', save: cand, record: r === true };
      }
      const known = this.cur?.baseRev ?? 0;
      this.dropCur();
      addEnded(this.store, this.userId, cand.runId, known);
      return { kind: 'lost', save: cand, record: cand.deviceId === this.deviceId };
    }
    // 5.
    return { kind: 'resume', save: cand };
  }

  /** Đẩy tuần tự: mỗi vòng gửi bản mới nhất, các lần save gộp lại nhận chung một kết quả. */
  private async pump(): Promise<void> {
    while (this.waiting) {
      const batch = this.waiting;
      this.waiting = null;
      const r = await this.push();
      for (const done of batch) done(r);
    }
    this.queue = null;
  }

  private async push(): Promise<SaveResult> {
    for (let retried = false; ; retried = true) {
      if (this.stopped) return 'conflict';
      const cur = this.cur;
      if (!cur?.dirty) return 'ok'; // ván đã end, hoặc đã đẩy rồi
      const sent = cur.save;
      const r = await this.cloudPut(sent.runId, cur.baseRev, sent);
      if (r.ok) {
        const now = this.cur;
        // Cùng ván thì nhận rev mới; chỉ hết dirty khi chưa có bản nào mới hơn.
        if (now && now.save.runId === sent.runId) this.setCur({ save: now.save, baseRev: r.rev, dirty: now.save !== sent });
        return 'ok';
      }
      if (r.error === 'network') return this.localOk ? 'pending' : 'unsaved';
      // Xung đột có thể do chính put trước của máy này (hết giờ nhưng server đã ghi): nhận rev đó, gửi lại một lần.
      if (!retried && (await this.committedAnyway(sent.runId))) continue;
      this.stopped = true;
      this.dropCur();
      return 'conflict';
    }
  }

  /** Dòng cloud là một bản put lỗi mạng của chính máy này → lấy rev của nó làm baseRev. */
  private async committedAnyway(runId: string): Promise<boolean> {
    const u = this.uncertain;
    if (u?.runId !== runId) return false;
    const row = await this.cloudFetch();
    if (!row || row === 'error' || row.runId !== runId || row.deviceId !== this.deviceId) return false;
    const saved = parseRunSave(row.save);
    if (!saved || !u.savedAt.includes(saved.savedAt)) return false;
    this.uncertain = null;
    const now = this.cur;
    if (now?.save.runId === runId) this.setCur({ save: now.save, baseRev: row.rev, dirty: true });
    return true;
  }

  private noteUncertain(save: RunSave): void {
    if (this.uncertain?.runId !== save.runId) this.uncertain = { runId: save.runId, savedAt: [] };
    this.uncertain.savedAt.push(save.savedAt);
  }

  private setCur(v: LocalSave): void {
    this.cur = v;
    this.localOk = writeLocal(this.store, this.key, v);
  }

  private dropCur(): void {
    this.cur = null;
    removeLocal(this.store, this.key);
  }

  private async flushEnded(): Promise<void> {
    const list = readEnded(this.store, this.userId);
    const res = await Promise.all(list.map((e) => this.cloudEnd(e.runId, e.rev)));
    list.forEach((e, i) => {
      if (res[i] !== 'error') removeEnded(this.store, this.userId, e.runId);
    });
  }

  // Lỗi mạng không bao giờ ném ra ngoài.
  private async cloudFetch(): Promise<CloudRow | null | 'error'> {
    try {
      return this.cloud ? await this.cloud.fetch() : 'error';
    } catch {
      return 'error';
    }
  }

  private cloudPut(runId: string, baseRev: number, save: RunSave): Promise<PutResult> {
    const p = this.sendPut(runId, baseRev, save);
    this.inflight = p;
    void p.then(() => {
      if (this.inflight === p) this.inflight = null;
    });
    return p;
  }

  /** Ván mới (`baseRev` 0) bị dòng của ván cũ chặn → chờ các end đang gửi và gửi lại các end còn treo trước. */
  private async sendPut(runId: string, baseRev: number, save: RunSave): Promise<PutResult> {
    try {
      if (!this.cloud) return { ok: false, error: 'network' };
      if (baseRev === 0) {
        // Chỉ chờ các end đã có lúc này (end mới hơn lại chờ put này) → không khóa vòng.
        await this.awaitEnds();
        if (readEnded(this.store, this.userId).length) await this.flushEnded();
      }
      const r = await this.cloud.put(runId, baseRev, save);
      if (r.ok) this.uncertain = null;
      else if (r.error === 'network') this.noteUncertain(save);
      return r;
    } catch {
      this.noteUncertain(save);
      return { ok: false, error: 'network' };
    }
  }

  private async cloudEnd(runId: string, knownRev: number): Promise<boolean | 'error'> {
    try {
      return this.cloud ? await this.cloud.end(runId, this.deviceId, knownRev) : 'error';
    } catch {
      return 'error';
    }
  }
}
