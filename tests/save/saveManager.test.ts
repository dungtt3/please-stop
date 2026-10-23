import { createGame } from '../../src/sim/state';
import { snapshotRun, type RunSave } from '../../src/sim/save';
import { DEVICE_KEY, GUEST_KEY, accountKey, readEnded, readLocal, writeLocal } from '../../src/save/localSaves';
import { ELSEWHERE_MS, SaveManager } from '../../src/save/SaveManager';
import type { CloudRow, CloudSaves, PutResult } from '../../src/net/saves';

const mem = (init: Record<string, string> = {}) => {
  const m = new Map<string, string>(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const bad = {
  getItem: (): string | null => { throw new Error('blocked'); },
  setItem: (): void => { throw new Error('blocked'); },
  removeItem: (): void => { throw new Error('blocked'); },
};
const device = (id: string) => mem({ [DEVICE_KEY]: id });

/** Đồng hồ của server giả (khác hẳn đồng hồ máy: tuổi dòng phải tính trên server). */
let t = 0;
beforeEach(() => {
  t = 1_000_000_000;
});

const BASE = JSON.parse(JSON.stringify(snapshotRun(createGame(1), { runId: 'r1', deviceId: 'dev-A', runSeconds: 5, now: 1000 }))) as RunSave;
function mk(o: { runId?: string; deviceId?: string; inWave?: boolean; gold?: number } = {}): RunSave {
  const s = structuredClone(BASE);
  s.runId = o.runId ?? 'r1';
  s.deviceId = o.deviceId ?? 'dev-A';
  s.inWave = o.inWave ?? false;
  if (o.gold !== undefined) s.game.gold = o.gold;
  return s;
}

/** Dòng trong bảng giả: như CloudRow nhưng giữ updated_at (theo đồng hồ server `t`) thay cho tuổi. */
type FakeRow = Omit<CloudRow, 'ageMs'> & { updatedAt: number };

/** Giả lập bảng ps_saves: một dòng cho một người dùng, luật như ps_get_save / ps_put_save / ps_end_save. */
function fakeCloud(opts: { hang?: boolean } = {}) {
  const f = {
    row: null as FakeRow | null,
    offline: false,
    endFails: false,
    hang: opts.hang ?? false,
    gate: null as Promise<void> | null,
    endGate: null as Promise<void> | null,
    baseRevs: [] as number[],
    endCalls: [] as string[],
    /** Giữ mọi lệnh put cho đến khi gọi hàm trả về. */
    hold(): () => void {
      let release!: () => void;
      f.gate = new Promise<void>((r) => (release = r));
      return () => {
        f.gate = null;
        release();
      };
    },
    /** Giữ mọi lệnh end (server chưa xử lý) cho đến khi gọi hàm trả về. */
    holdEnd(): () => void {
      let release!: () => void;
      f.endGate = new Promise<void>((r) => (release = r));
      return () => {
        f.endGate = null;
        release();
      };
    },
    async fetch(): Promise<CloudRow | null | 'error'> {
      if (f.offline) return 'error';
      if (!f.row) return null;
      const { updatedAt, ...rest } = structuredClone(f.row);
      return { ...rest, ageMs: t - updatedAt };
    },
    async put(runId: string, baseRev: number, save: RunSave): Promise<PutResult> {
      f.baseRevs.push(baseRev);
      if (f.hang) return new Promise<PutResult>(() => {});
      if (f.gate) await f.gate;
      if (f.offline) return { ok: false, error: 'network' };
      const data = { save: JSON.parse(JSON.stringify(save)) as unknown, inWave: save.inWave, deviceId: save.deviceId, updatedAt: t };
      if (baseRev === 0) {
        if (f.row) return { ok: false, error: 'conflict' };
        f.row = { runId, rev: 1, ...data };
        return { ok: true, rev: 1 };
      }
      if (!f.row || f.row.runId !== runId || f.row.rev !== baseRev) return { ok: false, error: 'conflict' };
      f.row = { runId, rev: f.row.rev + 1, ...data };
      return { ok: true, rev: f.row.rev };
    },
    async end(runId: string, deviceId: string, knownRev: number): Promise<boolean | 'error'> {
      f.endCalls.push(runId);
      if (f.endGate) await f.endGate;
      if (f.offline || f.endFails) return 'error';
      // Như ps_end_save: run_id khớp và (máy gọi là máy ghi dòng, hoặc chưa ai ghi tiếp sau knownRev).
      if (!f.row || f.row.runId !== runId || (f.row.deviceId !== deviceId && f.row.rev > knownRev)) return false;
      f.row = null;
      return true;
    },
  };
  return f satisfies CloudSaves;
}
const KEY = accountKey('u');
const acct = (store: ReturnType<typeof mem> | typeof bad | null, cloud: CloudSaves) => new SaveManager({ store, cloud, userId: 'u' });

describe('khách', () => {
  test('khách: lưu → load → resume', async () => {
    const store = device('dev-A');
    const m = new SaveManager({ store, cloud: null, userId: null });
    expect(m.signedIn).toBe(false);
    expect(m.deviceId).toBe('dev-A');
    expect(await m.save(mk({ gold: 77 }))).toBe('ok');
    expect(readLocal(store, GUEST_KEY)).toMatchObject({ baseRev: 0, dirty: false });
    const info = await new SaveManager({ store, cloud: null, userId: null }).load();
    expect(info).toMatchObject({ kind: 'resume', save: { runId: 'r1', game: { gold: 77 } } });
    expect(m.offline).toBe(false);
  });

  test('khách: inWave → lost, record true, bản lưu bị xóa', async () => {
    const store = device('dev-A');
    const m = new SaveManager({ store, cloud: null, userId: null });
    await m.save(mk({ inWave: true }));
    expect(await m.load()).toMatchObject({ kind: 'lost', record: true, save: { runId: 'r1', inWave: true } });
    expect(store.getItem(GUEST_KEY)).toBeNull();
    expect(await m.load()).toEqual({ kind: 'none' });
  });

  test('khách: bản hỏng → invalid', async () => {
    const store = mem({ [GUEST_KEY]: '{oops' });
    const m = new SaveManager({ store, cloud: null, userId: null });
    expect(await m.load()).toEqual({ kind: 'invalid' });
    expect(await m.load()).toEqual({ kind: 'none' });
  });

  test('khách: store bị chặn → save trả unsaved, load trả none', async () => {
    for (const store of [bad, null]) {
      const m = new SaveManager({ store, cloud: null, userId: null });
      expect(typeof m.deviceId).toBe('string');
      expect(await m.save(mk())).toBe('unsaved');
      expect(await m.load()).toEqual({ kind: 'none' });
      await expect(m.end('r1')).resolves.toBeUndefined();
    }
  });

  test('khách: end xóa đúng ván', async () => {
    const store = device('dev-A');
    const m = new SaveManager({ store, cloud: null, userId: null });
    await m.save(mk({ runId: 'r1' }));
    await m.end('other');
    expect(readLocal(store, GUEST_KEY)).not.toBeNull();
    await m.end('r1');
    expect(store.getItem(GUEST_KEY)).toBeNull();
  });

  test('userId có nhưng không có cloud → chạy như khách', async () => {
    const m = new SaveManager({ store: device('dev-A'), cloud: null, userId: 'u' });
    expect(m.signedIn).toBe(false);
    expect(await m.save(mk())).toBe('ok');
    expect(await m.load()).toMatchObject({ kind: 'resume' });
  });
});

describe('tài khoản', () => {
  test('tài khoản: máy B thấy ván máy A lưu', async () => {
    const cloud = fakeCloud();
    const a = acct(device('dev-A'), cloud);
    expect(a.signedIn).toBe(true);
    expect(await a.load()).toEqual({ kind: 'none' });
    expect(await a.save(mk({ gold: 11 }))).toBe('ok');
    const storeB = device('dev-B');
    const b = acct(storeB, cloud);
    expect(await b.load()).toMatchObject({ kind: 'resume', save: { runId: 'r1', game: { gold: 11 } } });
    expect(b.offline).toBe(false);
    expect(readLocal(storeB, KEY)).toMatchObject({ baseRev: 1, dirty: false });
    expect(await b.save(mk({ deviceId: 'dev-B', gold: 22 }))).toBe('ok');
    expect(cloud.baseRevs).toEqual([0, 1]);
    expect(cloud.row).toMatchObject({ rev: 2, deviceId: 'dev-B' });
  });

  test('tài khoản: local ghi trước khi put trả về', async () => {
    const store = device('dev-A');
    const cloud = fakeCloud({ hang: true });
    const m = new SaveManager({ store, cloud, userId: 'u' });
    void m.save(mk({ inWave: true }));
    expect(readLocal(store, accountKey('u'))).toMatchObject({ save: { inWave: true }, dirty: true });
  });

  test('tài khoản: hai lần lưu chồng nhau → không gửi trùng baseRev, bản cuối thắng', async () => {
    const store = device('dev-A');
    const cloud = fakeCloud();
    const m = acct(store, cloud);
    const release = cloud.hold();
    const pa = m.save(mk({ gold: 1 }));
    const pb = m.save(mk({ gold: 2 }));
    const pc = m.save(mk({ gold: 3 }));
    expect(readLocal(store, KEY)).toMatchObject({ save: { game: { gold: 3 } }, baseRev: 0, dirty: true });
    release();
    expect(await Promise.all([pa, pb, pc])).toEqual(['ok', 'ok', 'ok']);
    expect(cloud.baseRevs).toEqual([0, 1]);
    expect(cloud.row).toMatchObject({ rev: 2, save: { game: { gold: 3 } } });
    expect(readLocal(store, KEY)).toMatchObject({ save: { game: { gold: 3 } }, baseRev: 2, dirty: false });
    expect(await m.save(mk({ gold: 4 }))).toBe('ok');
    expect(cloud.baseRevs).toEqual([0, 1, 2]);
  });

  test('tài khoản: offline → pending; có mạng lại thì load đẩy bản dirty lên', async () => {
    const store = device('dev-A');
    const cloud = fakeCloud();
    cloud.offline = true;
    const m = acct(store, cloud);
    expect(await m.save(mk({ gold: 5 }))).toBe('pending');
    expect(readLocal(store, KEY)).toMatchObject({ baseRev: 0, dirty: true });
    cloud.offline = false;
    expect(await acct(store, cloud).load()).toMatchObject({ kind: 'resume', save: { game: { gold: 5 } } });
    expect(cloud.row).toMatchObject({ runId: 'r1', rev: 1, save: { game: { gold: 5 } } });
    expect(readLocal(store, KEY)).toMatchObject({ baseRev: 1, dirty: false });
  });

  test('tài khoản: offline giữa ván cùng runId → load đẩy bản dirty lên với baseRev cũ', async () => {
    const store = device('dev-A');
    const cloud = fakeCloud();
    const m = acct(store, cloud);
    expect(await m.save(mk({ gold: 5 }))).toBe('ok');
    cloud.offline = true;
    expect(await m.save(mk({ gold: 6 }))).toBe('pending');
    expect(readLocal(store, KEY)).toMatchObject({ baseRev: 1, dirty: true });
    cloud.offline = false;
    expect(await acct(store, cloud).load()).toMatchObject({ kind: 'resume', save: { game: { gold: 6 } } });
    expect(cloud.row).toMatchObject({ rev: 2, save: { game: { gold: 6 } } });
    expect(readLocal(store, KEY)).toMatchObject({ baseRev: 2, dirty: false });
  });

  test('tài khoản: fetch lỗi → resume bản cục bộ và offline === true', async () => {
    const store = device('dev-A');
    const cloud = fakeCloud();
    await acct(store, cloud).save(mk({ gold: 9 }));
    cloud.offline = true;
    const m = acct(store, cloud);
    expect(await m.load()).toMatchObject({ kind: 'resume', save: { game: { gold: 9 } } });
    expect(m.offline).toBe(true);
    expect(await m.save(mk({ gold: 10 }))).toBe('pending');
    expect(readLocal(store, KEY)).toMatchObject({ baseRev: 1, dirty: true });
  });

  test('tài khoản: fetch lỗi và không có bản cục bộ → none', async () => {
    const cloud = fakeCloud();
    cloud.offline = true;
    const m = acct(device('dev-A'), cloud);
    expect(await m.load()).toEqual({ kind: 'none' });
    expect(m.offline).toBe(true);
  });

  test('tài khoản: máy khác đã chơi tiếp (rev cloud mới hơn) → cloud thắng, bỏ local', async () => {
    const storeA = device('dev-A');
    const cloud = fakeCloud();
    const a = acct(storeA, cloud);
    await a.save(mk({ gold: 1 }));
    const b = acct(device('dev-B'), cloud);
    await b.load();
    expect(await b.save(mk({ deviceId: 'dev-B', gold: 2 }))).toBe('ok');
    cloud.offline = true;
    expect(await a.save(mk({ gold: 3 }))).toBe('pending');
    cloud.offline = false;
    expect(await acct(storeA, cloud).load()).toMatchObject({ kind: 'resume', save: { game: { gold: 2 } } });
    expect(readLocal(storeA, KEY)).toMatchObject({ save: { game: { gold: 2 } }, baseRev: 2, dirty: false });
    expect(cloud.row).toMatchObject({ rev: 2 });
  });

  test('tài khoản: ván đã kết thúc ở máy khác → bỏ local, none', async () => {
    const storeA = device('dev-A');
    const cloud = fakeCloud();
    await acct(storeA, cloud).save(mk());
    const b = acct(device('dev-B'), cloud);
    await b.load();
    await b.end('r1');
    expect(cloud.row).toBeNull();
    expect(await acct(storeA, cloud).load()).toEqual({ kind: 'none' });
    expect(storeA.getItem(KEY)).toBeNull();
  });

  test('tài khoản: local khác runId với cloud → dùng cloud', async () => {
    const storeA = device('dev-A');
    const cloud = fakeCloud();
    cloud.offline = true;
    await acct(storeA, cloud).save(mk({ runId: 'mine' }));
    cloud.offline = false;
    await acct(device('dev-B'), cloud).save(mk({ runId: 'theirs', deviceId: 'dev-B' }));
    expect(await acct(storeA, cloud).load()).toMatchObject({ kind: 'resume', save: { runId: 'theirs' } });
    expect(readLocal(storeA, KEY)).toMatchObject({ save: { runId: 'theirs' }, baseRev: 1, dirty: false });
  });

  test('tài khoản: conflict → save sau trả conflict, không gọi mạng', async () => {
    const storeA = device('dev-A');
    const cloud = fakeCloud();
    const a = acct(storeA, cloud);
    await a.save(mk({ gold: 1 }));
    const b = acct(device('dev-B'), cloud);
    await b.load();
    await b.save(mk({ deviceId: 'dev-B', gold: 2 }));
    expect(await a.save(mk({ gold: 3 }))).toBe('conflict');
    expect(storeA.getItem(KEY)).toBeNull();
    const calls = cloud.baseRevs.length;
    expect(await a.save(mk({ gold: 4 }))).toBe('conflict');
    expect(cloud.baseRevs.length).toBe(calls);
    expect(storeA.getItem(KEY)).toBeNull();
    expect(cloud.row).toMatchObject({ rev: 2, save: { game: { gold: 2 } } });
  });

  test('tài khoản: inWave của máy khác, mới 2 phút → elsewhere', async () => {
    const cloud = fakeCloud();
    await acct(device('dev-A'), cloud).save(mk({ inWave: true }));
    t += 2 * 60_000;
    const b = acct(device('dev-B'), cloud);
    expect(await b.load()).toMatchObject({ kind: 'elsewhere', save: { runId: 'r1', inWave: true } });
    expect(cloud.row).toMatchObject({ runId: 'r1', rev: 1 });
    expect(cloud.endCalls).toEqual([]);
  });

  test('tài khoản: inWave của máy khác, 11 phút → lost, record true, cloud trống', async () => {
    const cloud = fakeCloud();
    await acct(device('dev-A'), cloud).save(mk({ inWave: true }));
    t += 11 * 60_000;
    expect(11 * 60_000).toBeGreaterThan(ELSEWHERE_MS);
    const storeB = device('dev-B');
    expect(await acct(storeB, cloud).load()).toMatchObject({ kind: 'lost', record: true, save: { runId: 'r1' } });
    expect(cloud.row).toBeNull();
    expect(storeB.getItem(KEY)).toBeNull();
  });

  test('tài khoản: inWave cùng máy → lost ngay', async () => {
    const store = device('dev-A');
    const cloud = fakeCloud();
    await acct(store, cloud).save(mk({ inWave: true }));
    t += 1000;
    expect(await acct(store, cloud).load()).toMatchObject({ kind: 'lost', record: true });
    expect(cloud.row).toBeNull();
    expect(store.getItem(KEY)).toBeNull();
  });

  test('tài khoản: lost mà end lỗi → record false, nhớ vào ended', async () => {
    const store = device('dev-B');
    const cloud = fakeCloud();
    await acct(device('dev-A'), cloud).save(mk({ inWave: true }));
    t += 11 * 60_000;
    cloud.endFails = true;
    expect(await acct(store, cloud).load()).toMatchObject({ kind: 'lost', record: false });
    expect(readEnded(store, 'u')).toEqual([{ runId: 'r1', rev: 1 }]);
    expect(store.getItem(KEY)).toBeNull();
  });

  test('tài khoản: end lúc offline → ended; load sau gửi lại end và không trả ván cũ', async () => {
    const store = device('dev-A');
    const cloud = fakeCloud();
    const m = acct(store, cloud);
    await m.save(mk());
    cloud.offline = true;
    await m.end('r1');
    expect(store.getItem(KEY)).toBeNull();
    expect(readEnded(store, 'u')).toEqual([{ runId: 'r1', rev: 1 }]);
    cloud.offline = false;
    expect(await acct(store, cloud).load()).toEqual({ kind: 'none' });
    expect(cloud.endCalls).toEqual(['r1', 'r1']);
    expect(cloud.row).toBeNull();
    expect(readEnded(store, 'u')).toEqual([]);
  });

  test('tài khoản: end vẫn lỗi nhưng fetch được → dòng của ván đã kết thúc coi như không có', async () => {
    const store = device('dev-A');
    const cloud = fakeCloud();
    const m = acct(store, cloud);
    await m.save(mk());
    cloud.endFails = true;
    await m.end('r1');
    expect(await acct(store, cloud).load()).toEqual({ kind: 'none' });
    expect(readEnded(store, 'u')).toEqual([{ runId: 'r1', rev: 1 }]);
    expect(cloud.row).toMatchObject({ runId: 'r1' });
  });

  test('tài khoản: máy A end lúc offline, máy B đã chơi tiếp cùng ván → end gửi lại không xóa tiến độ của B', async () => {
    const storeA = device('dev-A');
    const cloud = fakeCloud();
    const a = acct(storeA, cloud);
    expect(await a.save(mk({ gold: 1 }))).toBe('ok');
    cloud.offline = true;
    await a.end('r1');
    expect(readEnded(storeA, 'u')).toEqual([{ runId: 'r1', rev: 1 }]);
    cloud.offline = false;
    const b = acct(device('dev-B'), cloud);
    expect(await b.load()).toMatchObject({ kind: 'resume', save: { runId: 'r1' } });
    expect(await b.save(mk({ deviceId: 'dev-B', gold: 2 }))).toBe('ok');
    expect(await acct(storeA, cloud).load()).toMatchObject({ kind: 'resume', save: { runId: 'r1', game: { gold: 2 } } });
    expect(cloud.endCalls).toEqual(['r1', 'r1']);
    expect(cloud.row).toMatchObject({ runId: 'r1', rev: 2, deviceId: 'dev-B' });
    expect(readEnded(storeA, 'u')).toEqual([]);
  });

  test('tài khoản: end vẫn lỗi nhưng máy khác đã ghi tiếp dòng đó → không coi như đã kết thúc', async () => {
    const storeA = device('dev-A');
    const cloud = fakeCloud();
    const a = acct(storeA, cloud);
    await a.save(mk({ gold: 1 }));
    cloud.endFails = true;
    await a.end('r1');
    const b = acct(device('dev-B'), cloud);
    await b.load();
    expect(await b.save(mk({ deviceId: 'dev-B', gold: 2 }))).toBe('ok');
    expect(await acct(storeA, cloud).load()).toMatchObject({ kind: 'resume', save: { game: { gold: 2 } } });
    expect(cloud.row).toMatchObject({ rev: 2 });
  });

  test('tài khoản: tiếp tục ván máy khác ghi rồi bỏ ván ngay → xóa được dòng của máy kia', async () => {
    const cloud = fakeCloud();
    await acct(device('dev-A'), cloud).save(mk({ gold: 1 }));
    const b = acct(device('dev-B'), cloud);
    expect(await b.load()).toMatchObject({ kind: 'resume' });
    await b.end('r1');
    expect(cloud.row).toBeNull();
  });

  test('tài khoản: Ván mới khi ván đang chơi ở máy khác (elsewhere) → xóa được dòng inWave của máy kia', async () => {
    const cloud = fakeCloud();
    await acct(device('dev-A'), cloud).save(mk({ inWave: true }));
    t += 60_000;
    const b = acct(device('dev-B'), cloud);
    expect(await b.load()).toMatchObject({ kind: 'elsewhere' });
    await b.end('r1');
    expect(cloud.row).toBeNull();
  });

  test('tài khoản: inWave chỉ có ở local lúc offline → lost, record true; lần sau không tính lại', async () => {
    const store = device('dev-A');
    const cloud = fakeCloud();
    await acct(store, cloud).save(mk());
    cloud.offline = true;
    expect(await acct(store, cloud).save(mk({ inWave: true }))).toBe('pending');
    expect(await acct(store, cloud).load()).toMatchObject({ kind: 'lost', record: true, save: { inWave: true } });
    expect(store.getItem(KEY)).toBeNull();
    expect(readEnded(store, 'u')).toEqual([{ runId: 'r1', rev: 0 }]);
    cloud.offline = false;
    expect(await acct(store, cloud).load()).toEqual({ kind: 'none' });
    expect(cloud.row).toBeNull();
    expect(readEnded(store, 'u')).toEqual([]);
  });

  test('tài khoản: inWave của máy khác chỉ có ở local lúc offline → record false', async () => {
    const store = device('dev-A');
    writeLocal(store, KEY, { save: mk({ deviceId: 'dev-X', inWave: true }), baseRev: 3, dirty: false });
    const cloud = fakeCloud();
    cloud.offline = true;
    expect(await acct(store, cloud).load()).toMatchObject({ kind: 'lost', record: false });
  });

  test('tài khoản: dòng cloud hỏng → end, xóa local, invalid', async () => {
    const store = device('dev-A');
    const cloud = fakeCloud();
    await acct(store, cloud).save(mk());
    cloud.row = { ...cloud.row!, save: { version: 99 } };
    expect(await acct(store, cloud).load()).toEqual({ kind: 'invalid' });
    expect(cloud.endCalls).toEqual(['r1']);
    expect(cloud.row).toBeNull();
    expect(store.getItem(KEY)).toBeNull();
  });

  test('tài khoản: ván mới sau khi end → put với baseRev 0', async () => {
    const store = device('dev-A');
    const cloud = fakeCloud();
    const m = acct(store, cloud);
    await m.save(mk({ runId: 'r1' }));
    await m.save(mk({ runId: 'r1', gold: 3 }));
    await m.end('r1');
    expect(await m.save(mk({ runId: 'r2' }))).toBe('ok');
    expect(cloud.baseRevs).toEqual([0, 1, 0]);
    expect(cloud.row).toMatchObject({ runId: 'r2', rev: 1 });
  });

  test('tài khoản: ván mới sau khi end bị lỗi → gửi lại end trước khi put, không conflict', async () => {
    const store = device('dev-A');
    const cloud = fakeCloud();
    const m = acct(store, cloud);
    await m.save(mk({ runId: 'r1' }));
    cloud.endFails = true;
    await m.end('r1');
    expect(readEnded(store, 'u')).toEqual([{ runId: 'r1', rev: 1 }]);
    cloud.endFails = false;
    expect(await m.save(mk({ runId: 'r2' }))).toBe('ok');
    expect(cloud.row).toMatchObject({ runId: 'r2', rev: 1 });
    expect(readEnded(store, 'u')).toEqual([]);
  });

  test('tài khoản: end chờ lệnh put đang chạy xong rồi mới xóa trên cloud', async () => {
    const cloud = fakeCloud();
    const m = acct(device('dev-A'), cloud);
    const release = cloud.hold();
    const p = m.save(mk());
    const e = m.end('r1');
    release();
    await Promise.all([p, e]);
    expect(cloud.row).toBeNull();
  });

  test('tài khoản: end khi put đang chạy rồi ván mới → put ván mới đi sau end, không conflict', async () => {
    const cloud = fakeCloud();
    const m = acct(device('dev-A'), cloud);
    const release = cloud.hold();
    const pa = m.save(mk({ runId: 'r1' }));
    const e = m.end('r1');
    const pb = m.save(mk({ runId: 'r2' }));
    release();
    expect(await Promise.all([pa, e, pb])).toEqual(['ok', undefined, 'ok']);
    expect(cloud.row).toMatchObject({ runId: 'r2', rev: 1 });
    expect(await m.save(mk({ runId: 'r2', gold: 1 }))).toBe('ok');
  });

  test('tài khoản: end chưa xong (không await, server chậm) → put đầu của ván mới chờ end', async () => {
    const cloud = fakeCloud();
    const m = acct(device('dev-A'), cloud);
    expect(await m.save(mk({ runId: 'r1' }))).toBe('ok');
    const releaseEnd = cloud.holdEnd();
    void m.end('r1');
    const pb = m.save(mk({ runId: 'r2' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(cloud.baseRevs).toEqual([0]);
    releaseEnd();
    expect(await pb).toBe('ok');
    expect(cloud.baseRevs).toEqual([0, 0]);
    expect(cloud.row).toMatchObject({ runId: 'r2', rev: 1 });
  });

  test('tài khoản: store bị chặn vẫn lưu lên cloud', async () => {
    const cloud = fakeCloud();
    const m = acct(bad, cloud);
    expect(await m.save(mk({ gold: 8 }))).toBe('ok');
    expect(await acct(bad, cloud).load()).toMatchObject({ kind: 'resume', save: { game: { gold: 8 } } });
    cloud.offline = true;
    expect(await m.save(mk({ gold: 9 }))).toBe('unsaved');
  });

  test('tài khoản: cloud ném lỗi → không ném ra ngoài', async () => {
    const boom = (): never => { throw new Error('boom'); };
    const cloud: CloudSaves = { fetch: async () => boom(), put: async () => boom(), end: async () => boom() };
    const store = device('dev-A');
    const m = acct(store, cloud);
    expect(await m.save(mk())).toBe('pending');
    expect(await acct(store, cloud).load()).toMatchObject({ kind: 'resume' });
    await expect(m.end('r1')).resolves.toBeUndefined();
    expect(readEnded(store, 'u')).toEqual([{ runId: 'r1', rev: 0 }]);
  });
});

describe('ván khách khi đăng nhập', () => {
  test('checkGuest: guest inWave → lostGuest và bị xóa', async () => {
    const store = device('dev-A');
    await new SaveManager({ store, cloud: null, userId: null }).save(mk({ runId: 'g', inWave: true }));
    const m = acct(store, fakeCloud());
    expect(m.checkGuest()).toMatchObject({ lostGuest: { runId: 'g' }, guest: null });
    expect(store.getItem(GUEST_KEY)).toBeNull();
    expect(m.checkGuest()).toEqual({ lostGuest: null, guest: null });
  });

  test('checkGuest: guest chuẩn bị → guest', async () => {
    const store = device('dev-A');
    await new SaveManager({ store, cloud: null, userId: null }).save(mk({ runId: 'g' }));
    expect(acct(store, fakeCloud()).checkGuest()).toMatchObject({ lostGuest: null, guest: { runId: 'g' } });
    expect(store.getItem(GUEST_KEY)).not.toBeNull();
  });

  test('adoptGuest: tài khoản trống → ván khách lên cloud, GUEST_KEY bị xóa', async () => {
    const store = device('dev-A');
    await new SaveManager({ store, cloud: null, userId: null }).save(mk({ runId: 'g', gold: 42 }));
    const cloud = fakeCloud();
    const m = acct(store, cloud);
    expect(await m.load()).toEqual({ kind: 'none' });
    expect(m.checkGuest().guest).toMatchObject({ runId: 'g' });
    expect(await m.adoptGuest()).toBe('ok');
    expect(store.getItem(GUEST_KEY)).toBeNull();
    expect(cloud.row).toMatchObject({ runId: 'g', rev: 1 });
    expect(readLocal(store, KEY)).toMatchObject({ save: { runId: 'g' }, baseRev: 1, dirty: false });
    expect(await m.save(mk({ runId: 'g', gold: 43 }))).toBe('ok');
    expect(cloud.baseRevs).toEqual([0, 1]);
  });

  test('adoptGuest: tài khoản đã có dòng → conflict, giữ ván khách, không chặn lưu', async () => {
    const store = device('dev-A');
    await new SaveManager({ store, cloud: null, userId: null }).save(mk({ runId: 'g' }));
    const cloud = fakeCloud();
    await acct(device('dev-B'), cloud).save(mk({ runId: 'acc', deviceId: 'dev-B', inWave: true }));
    t += 11 * 60_000;
    cloud.endFails = true;
    const m = acct(store, cloud);
    expect(await m.load()).toMatchObject({ kind: 'lost', record: false });
    expect(await m.adoptGuest()).toBe('conflict');
    expect(readLocal(store, GUEST_KEY)).toMatchObject({ save: { runId: 'g' } });
    expect(store.getItem(KEY)).toBeNull();
    cloud.endFails = false;
    await m.end('acc');
    expect(await m.save(mk({ runId: 'new' }))).toBe('ok');
    expect(cloud.row).toMatchObject({ runId: 'new' });
  });

  test('adoptGuest: offline → pending, load sau đẩy lên', async () => {
    const store = device('dev-A');
    await new SaveManager({ store, cloud: null, userId: null }).save(mk({ runId: 'g' }));
    const cloud = fakeCloud();
    const m = acct(store, cloud);
    await m.load();
    cloud.offline = true;
    expect(await m.adoptGuest()).toBe('pending');
    expect(store.getItem(GUEST_KEY)).toBeNull();
    expect(readLocal(store, KEY)).toMatchObject({ save: { runId: 'g' }, baseRev: 0, dirty: true });
    cloud.offline = false;
    expect(await acct(store, cloud).load()).toMatchObject({ kind: 'resume', save: { runId: 'g' } });
    expect(cloud.row).toMatchObject({ runId: 'g', rev: 1 });
  });

  test('dropGuest: xóa GUEST_KEY', async () => {
    const store = device('dev-A');
    await new SaveManager({ store, cloud: null, userId: null }).save(mk({ runId: 'g' }));
    acct(store, fakeCloud()).dropGuest();
    expect(store.getItem(GUEST_KEY)).toBeNull();
  });
});
