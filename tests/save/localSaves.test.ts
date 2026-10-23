import { createGame } from '../../src/sim/state';
import { drawCard, summon } from '../../src/sim/commands';
import { startWave, tick } from '../../src/sim/game';
import { snapshotRun } from '../../src/sim/save';
import {
  DEVICE_KEY, GUEST_KEY, accountKey, addEnded, endedKey, getDeviceId, readEnded, readLocal, removeEnded,
  removeLocal, uuid, uuidFromBytes, writeLocal, type LocalSave,
} from '../../src/save/localSaves';

const mem = (init: Record<string, string> = {}) => {
  const m = new Map<string, string>(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const bad = {
  getItem: (): string | null => { throw new Error('blocked'); },
  setItem: (): void => { throw new Error('blocked'); },
  removeItem: (): void => { throw new Error('blocked'); },
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Bản lưu hợp lệ từ ván đã chơi hết wave 1. */
function makeSave() {
  const s = createGame(1);
  s.gold = 500;
  for (let i = 0; i < 3; i++) summon(s);
  drawCard(s);
  startWave(s);
  for (let i = 0; i < 4000 && s.phase === 'wave'; i++) tick(s, 0.05);
  return JSON.parse(JSON.stringify(snapshotRun(s, { runId: 'r1', deviceId: 'd1', runSeconds: 12.5, now: 1000 })));
}
const local: LocalSave = { save: makeSave(), baseRev: 3, dirty: true };

test('khóa lưu trữ', () => {
  expect(DEVICE_KEY).toBe('ps.deviceId');
  expect(GUEST_KEY).toBe('ps.save.guest');
  expect(accountKey('u1')).toBe('ps.save.u1');
  expect(endedKey('u1')).toBe('ps.ended.u1');
});

test('deviceId ổn định trong cùng store', () => {
  const m = mem();
  expect(getDeviceId(m, () => 'abc')).toBe('abc');
  expect(getDeviceId(m, () => 'zzz')).toBe('abc');
  expect(m.getItem(DEVICE_KEY)).toBe('abc');
  expect(getDeviceId(m)).toBe(getDeviceId(m));
});

test('ghi rồi đọc lại', () => {
  const m = mem();
  expect(writeLocal(m, GUEST_KEY, local)).toBe(true);
  expect(readLocal(m, GUEST_KEY)).toEqual(local);
});

test('chưa có → null; removeLocal xóa', () => {
  const m = mem();
  expect(readLocal(m, GUEST_KEY)).toBeNull();
  expect(readLocal(null, GUEST_KEY)).toBeNull();
  writeLocal(m, GUEST_KEY, local);
  removeLocal(m, GUEST_KEY);
  expect(readLocal(m, GUEST_KEY)).toBeNull();
});

test('bản hỏng → invalid và bị xóa', () => {
  const m = mem();
  m.setItem(GUEST_KEY, '{oops');
  expect(readLocal(m, GUEST_KEY)).toBe('invalid');
  expect(m.getItem(GUEST_KEY)).toBeNull();
  expect(readLocal(m, GUEST_KEY)).toBeNull();
});

test('JSON đúng nhưng save sai hoặc thiếu trường → invalid', () => {
  for (const v of [{ save: { version: 1 }, baseRev: 0, dirty: false }, { save: local.save, baseRev: 'x', dirty: false }, { save: local.save, baseRev: 1.5, dirty: false }, { save: local.save, baseRev: 0 }, [], 5]) {
    const m = mem({ [GUEST_KEY]: JSON.stringify(v) });
    expect(readLocal(m, GUEST_KEY)).toBe('invalid');
    expect(m.getItem(GUEST_KEY)).toBeNull();
  }
});

test('store ném lỗi → không ném', () => {
  expect(readLocal(bad, GUEST_KEY)).toBeNull();
  expect(writeLocal(bad, GUEST_KEY, local)).toBe(false);
  expect(writeLocal(null, GUEST_KEY, local)).toBe(false);
  expect(() => removeLocal(bad, GUEST_KEY)).not.toThrow();
  expect(typeof getDeviceId(bad)).toBe('string');
  expect(readEnded(bad, 'u1')).toEqual([]);
  expect(() => addEnded(bad, 'u1', 'r')).not.toThrow();
  expect(() => removeEnded(bad, 'u1', 'r')).not.toThrow();
});

test('store null hoặc lỗi → deviceId vẫn ổn định trong phiên', () => {
  expect(getDeviceId(null)).toBe(getDeviceId(null));
  expect(getDeviceId(bad)).toBe(getDeviceId(bad));
});

test('ended thêm/bớt không trùng', () => {
  const m = mem();
  expect(readEnded(m, 'u1')).toEqual([]);
  addEnded(m, 'u1', 'a');
  addEnded(m, 'u1', 'a');
  addEnded(m, 'u1', 'b');
  expect(readEnded(m, 'u1')).toEqual(['a', 'b']);
  expect(readEnded(m, 'u2')).toEqual([]);
  removeEnded(m, 'u1', 'a');
  expect(readEnded(m, 'u1')).toEqual(['b']);
  removeEnded(m, 'u1', 'b');
  expect(readEnded(m, 'u1')).toEqual([]);
});

test('ended hỏng → rỗng', () => {
  expect(readEnded(mem({ [endedKey('u1')]: '{oops' }), 'u1')).toEqual([]);
  expect(readEnded(mem({ [endedKey('u1')]: '{"a":1}' }), 'u1')).toEqual([]);
  expect(readEnded(mem({ [endedKey('u1')]: '["a",5,"b"]' }), 'u1')).toEqual(['a', 'b']);
});

describe('uuid', () => {
  test('đúng dạng v4', () => {
    expect(uuid()).toMatch(UUID_RE);
    expect(uuid()).not.toBe(uuid());
  });

  test('uuidFromBytes đặt version 4 và variant', () => {
    expect(uuidFromBytes(new Uint8Array(16).fill(0xff))).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(uuidFromBytes(new Uint8Array(16))).toBe('00000000-0000-4000-8000-000000000000');
  });

  test('dùng được khi không có crypto.randomUUID', () => {
    const own = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
    const proto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(crypto), 'randomUUID');
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true, writable: true });
    try {
      expect(uuid()).toMatch(UUID_RE);
    } finally {
      if (own) Object.defineProperty(crypto, 'randomUUID', own);
      else delete (crypto as { randomUUID?: unknown }).randomUUID;
    }
    expect(Object.getOwnPropertyDescriptor(crypto, 'randomUUID')).toEqual(own);
    expect(Object.getOwnPropertyDescriptor(Object.getPrototypeOf(crypto), 'randomUUID')).toEqual(proto);
    expect(typeof crypto.randomUUID).toBe('function');
  });
});
