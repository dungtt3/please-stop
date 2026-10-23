import { AUTOSAVE_MS, RunSaver, type RunSaverHooks } from '../../src/scenes/RunSaver';
import type { SaveResult } from '../../src/save/SaveManager';
import type { RunSave } from '../../src/sim/save';
import { summon } from '../../src/sim/commands';
import { startWave } from '../../src/sim/game';
import { createGame } from '../../src/sim/state';

function setup(result: SaveResult = 'ok') {
  const saves: RunSave[] = [];
  const ends: string[] = [];
  const hooks = { conflicts: 0, unsaved: 0 };
  const manager = {
    deviceId: 'dev',
    save: async (s: RunSave): Promise<SaveResult> => {
      saves.push(s);
      return result;
    },
    end: async (id: string): Promise<void> => {
      ends.push(id);
    },
  };
  const h: RunSaverHooks = { onConflict: () => hooks.conflicts++, onUnsaved: () => hooks.unsaved++ };
  let n = 0;
  const saver = new RunSaver(manager, h, () => 1000, () => `run-${++n}`);
  const state = createGame(1);
  state.gold = 500;
  return { saver, state, saves, ends, hooks };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

test('ván mới: runId mới và lưu ngay', () => {
  const { saver, state, saves } = setup();
  saver.beginNew(state);
  expect(saver.runId).toBe('run-1');
  expect(saves).toHaveLength(1);
  expect(saves[0].runId).toBe('run-1');
  expect(saves[0].deviceId).toBe('dev');
});

test('tự lưu: chỉ khi đã qua AUTOSAVE_MS và ván đã đổi', () => {
  const { saver, state, saves } = setup();
  saver.beginNew(state);
  saver.tick(state, AUTOSAVE_MS - 1, false);
  summon(state);
  saver.tick(state, 1, false);
  expect(saves).toHaveLength(2);
  // Không đổi gì → không lưu thêm.
  saver.tick(state, AUTOSAVE_MS, false);
  saver.tick(state, AUTOSAVE_MS, false);
  expect(saves).toHaveLength(2);
});

test('đồng hồ chuẩn bị trôi không gây lưu lại', () => {
  const { saver, state, saves } = setup();
  saver.beginNew(state);
  state.prepTimer -= 5;
  saver.tick(state, AUTOSAVE_MS, false);
  expect(saves).toHaveLength(1);
});

test('không tự lưu khi menu mở hoặc không phải giai đoạn chuẩn bị', () => {
  const { saver, state, saves } = setup();
  saver.beginNew(state);
  summon(state);
  saver.tick(state, AUTOSAVE_MS * 3, true);
  expect(saves).toHaveLength(1);
  startWave(state);
  saver.tick(state, AUTOSAVE_MS * 3, false);
  expect(saves).toHaveLength(1);
});

test('waveStart ghi bản inWave, waveEnd ghi đè bản chuẩn bị', () => {
  const { saver, state, saves } = setup();
  saver.beginNew(state);
  saver.waveEnded(state); // đang prep → lưu
  startWave(state);
  saver.waveStarted(state);
  expect(saves[saves.length - 1].inWave).toBe(true);
  state.phase = 'prep';
  saver.waveEnded(state);
  expect(saves[saves.length - 1].inWave).toBe(false);
});

test('ẩn tab chỉ lưu khi đang chuẩn bị', () => {
  const { saver, state, saves } = setup();
  saver.beginNew(state);
  saver.flushPrep(state);
  expect(saves).toHaveLength(2);
  startWave(state);
  saver.flushPrep(state);
  expect(saves).toHaveLength(2);
});

test('end: gọi manager.end một lần và không lưu thêm', () => {
  const { saver, state, saves, ends } = setup();
  saver.beginNew(state);
  saver.end();
  saver.end();
  expect(ends).toEqual(['run-1']);
  summon(state);
  saver.tick(state, AUTOSAVE_MS, false);
  saver.flushPrep(state);
  saver.waveEnded(state);
  expect(saves).toHaveLength(1);
});

test('restart: runId mới, lưu ngay, lưu lại được sau end', () => {
  const { saver, state, saves, ends } = setup();
  saver.beginNew(state);
  saver.addSeconds(30);
  saver.end();
  saver.beginNew(createGame(2));
  expect(saver.runId).toBe('run-2');
  expect(saver.runSeconds).toBe(0);
  expect(saves.map((s) => s.runId)).toEqual(['run-1', 'run-2']);
  expect(ends).toEqual(['run-1']);
});

test('ván thua vào từ StartInfo: không lưu, không end, giữ runSeconds', () => {
  const { saver, state, saves, ends } = setup();
  saver.beginNew(state);
  const lost = { ...saves[0], runId: 'old', runSeconds: 77 };
  saver.markLost(lost);
  expect(saver.runId).toBe('old');
  expect(saver.runSeconds).toBe(77);
  saver.end();
  saver.flushPrep(state);
  expect(ends).toEqual([]);
  expect(saves).toHaveLength(1);
});

test('tiếp tục ván: lấy runId/runSeconds, không lưu lại khi chưa đổi gì', () => {
  const first = setup();
  first.saver.beginNew(first.state);
  const save = { ...first.saves[0], runId: 'saved', runSeconds: 42 };
  const { saver, state, saves } = setup();
  Object.assign(state, first.state);
  saver.resume(save);
  expect(saver.runId).toBe('saved');
  expect(saver.runSeconds).toBe(42);
  saver.tick(state, AUTOSAVE_MS, false);
  expect(saves).toHaveLength(0);
  summon(state);
  saver.tick(state, AUTOSAVE_MS, false);
  expect(saves).toHaveLength(1);
});

test('xung đột: dừng lưu, gọi onConflict một lần, end không còn tác dụng', async () => {
  const { saver, state, saves, ends, hooks } = setup('conflict');
  saver.beginNew(state);
  await flush();
  expect(hooks.conflicts).toBe(1);
  expect(saver.live).toBe(false);
  summon(state);
  saver.tick(state, AUTOSAVE_MS, false);
  saver.end();
  expect(saves).toHaveLength(1);
  expect(ends).toEqual([]);
});

test('unsaved: báo một lần mỗi ván, ván mới báo lại', async () => {
  const { saver, state, hooks } = setup('unsaved');
  saver.beginNew(state);
  saver.flushPrep(state);
  await flush();
  expect(hooks.unsaved).toBe(1);
  saver.beginNew(createGame(2));
  await flush();
  expect(hooks.unsaved).toBe(2);
});

test('kết quả trễ của ván cũ không ảnh hưởng ván mới', async () => {
  const { saver, state, hooks } = setup('conflict');
  saver.beginNew(state);
  saver.end(); // đã end trước khi kết quả về
  await flush();
  expect(hooks.conflicts).toBe(0);
});

test('stop: không lưu thêm và không end', () => {
  const { saver, state, saves, ends } = setup();
  saver.beginNew(state);
  saver.stop();
  saver.flushPrep(state);
  saver.end();
  expect(saves).toHaveLength(1);
  expect(ends).toEqual([]);
});

test('live (dùng cho runActive/bỏ ván): đúng khi đang chơi, sai sau end/xung đột/stop/ván thua từ StartInfo', async () => {
  const a = setup();
  expect(a.saver.live).toBe(false); // chưa bắt đầu ván nào
  a.saver.beginNew(a.state);
  expect(a.saver.live).toBe(true);
  a.saver.end();
  expect(a.saver.live).toBe(false);

  const b = setup('conflict');
  b.saver.beginNew(b.state);
  expect(b.saver.live).toBe(true); // kết quả xung đột chưa về
  await flush();
  expect(b.saver.live).toBe(false); // menu cấu hình không được tính thua / ghi ván này nữa
  b.saver.end();
  expect(b.ends).toEqual([]);

  const c = setup();
  c.saver.beginNew(c.state);
  c.saver.stop();
  expect(c.saver.live).toBe(false);

  const d = setup();
  d.saver.markLost({ ...a.saves[0], runId: 'old' });
  expect(d.saver.live).toBe(false);
});

test('xung đột đến khi menu đang mở (flushPrep): ván ngừng live ngay khi kết quả về', async () => {
  const { saver, state, hooks } = setup('conflict');
  saver.beginNew(state);
  await flush();
  expect(hooks.conflicts).toBe(1);
  saver.flushPrep(state); // tab ẩn khi menu mở: không lưu thêm, không báo thêm
  await flush();
  expect(hooks.conflicts).toBe(1);
  expect(saver.live).toBe(false);
});

describe('saveAndWait', () => {
  function hung() {
    const saves: RunSave[] = [];
    let release: (r: SaveResult) => void = () => undefined;
    const manager = {
      deviceId: 'dev',
      save: (s: RunSave): Promise<SaveResult> => {
        saves.push(s);
        return new Promise<SaveResult>((res) => {
          release = res;
        });
      },
      end: async (): Promise<void> => undefined,
    };
    const saver = new RunSaver(manager, { onConflict: () => undefined, onUnsaved: () => undefined }, () => 1000, () => 'run-x');
    return { saver, saves, release: (r: SaveResult = 'ok') => release(r) };
  }

  afterEach(() => vi.useRealTimers());

  test('save treo: resolve sau timeoutMs', async () => {
    vi.useFakeTimers();
    const { saver, saves } = hung();
    const state = createGame(1);
    saver.beginNew(state); // save #1 (treo)
    let done = false;
    const p = saver.saveAndWait(state, 4000).then(() => {
      done = true;
    });
    expect(saves).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(3999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
  });

  test('save xong nhanh: resolve ngay, không chờ hết giờ', async () => {
    vi.useFakeTimers();
    const { saver, state, saves } = setup();
    saver.beginNew(state);
    await saver.saveAndWait(state, 4000);
    expect(saves).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('save bị từ chối: vẫn resolve, không ném', async () => {
    const state = createGame(1);
    const manager = {
      deviceId: 'dev',
      save: (): Promise<SaveResult> => Promise.reject(new Error('mạng')),
      end: async (): Promise<void> => undefined,
    };
    const saver = new RunSaver(manager, { onConflict: () => undefined, onUnsaved: () => undefined }, () => 1000, () => 'r');
    saver.beginNew(state);
    await expect(saver.saveAndWait(state, 50)).resolves.toBeUndefined();
  });

  test('đang wave: không gọi save, resolve ngay', async () => {
    const { saver, state, saves } = setup();
    saver.beginNew(state);
    startWave(state);
    await saver.saveAndWait(state, 4000);
    expect(saves).toHaveLength(1);
  });

  test('sau end() hoặc stop(): không gọi save', async () => {
    const a = setup();
    a.saver.beginNew(a.state);
    a.saver.end();
    await a.saver.saveAndWait(a.state, 4000);
    expect(a.saves).toHaveLength(1);
    const b = setup();
    b.saver.beginNew(b.state);
    b.saver.stop();
    await b.saver.saveAndWait(b.state, 4000);
    expect(b.saves).toHaveLength(1);
  });

  test('kết quả conflict trong lúc chờ vẫn gọi onConflict', async () => {
    const { saver, state, hooks } = setup('conflict');
    saver.beginNew(state);
    await saver.saveAndWait(state, 4000);
    expect(hooks.conflicts).toBe(1);
  });
});
