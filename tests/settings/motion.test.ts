import { describe, expect, test } from 'vitest';
import type { KeyValueStore } from '../../src/settings/configStore';
import { fxDuration, MOTION_KEY, MotionSettings, ShakeGate } from '../../src/settings/motion';

const mem = (init: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } => {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { delete data[k]; },
  };
};

describe('MotionSettings', () => {
  test('chưa có lựa chọn: theo media, đọc mỗi lần', () => {
    let media = false;
    const m = new MotionSettings(mem(), () => media);
    expect(m.reduced).toBe(false);
    media = true;
    expect(m.reduced).toBe(true);
  });

  test('set ghi store và ghi đè media', () => {
    const store = mem();
    const m = new MotionSettings(store, () => true);
    m.set(false);
    expect(m.reduced).toBe(false);
    expect(JSON.parse(store.data[MOTION_KEY])).toEqual({ reduced: false });
    expect(new MotionSettings(store, () => true).reduced).toBe(false);
    m.set(true);
    expect(new MotionSettings(store, () => false).reduced).toBe(true);
  });

  test.each(['{oops', 'null', '"x"', '{}', '{"reduced":"yes"}', ''])('store hỏng %j → theo media', (raw) => {
    expect(new MotionSettings(mem({ [MOTION_KEY]: raw }), () => true).reduced).toBe(true);
    expect(new MotionSettings(mem({ [MOTION_KEY]: raw }), () => false).reduced).toBe(false);
  });

  test('store ném hoặc null: không ném, vẫn giữ lựa chọn trong phiên', () => {
    const bad: KeyValueStore = {
      getItem: () => { throw new Error('x'); },
      setItem: () => { throw new Error('x'); },
      removeItem: () => undefined,
    };
    const m = new MotionSettings(bad, () => false);
    expect(m.reduced).toBe(false);
    m.set(true);
    expect(m.reduced).toBe(true);
    expect(new MotionSettings(null, () => true).reduced).toBe(true);
  });

  test('media ném → false', () => {
    expect(new MotionSettings(null, () => { throw new Error('x'); }).reduced).toBe(false);
  });
});

describe('ShakeGate', () => {
  test('lần đầu cho phép; 299 ms chặn; 300 ms cho phép', () => {
    let t = 1000;
    const g = new ShakeGate(() => t);
    expect(g.allow()).toBe(true);
    t = 1299;
    expect(g.allow()).toBe(false);
    t = 1300;
    expect(g.allow()).toBe(true);
    t = 1599;
    expect(g.allow()).toBe(false);
  });

  test('đồng hồ lùi (cảnh khởi động lại) → cho phép', () => {
    let t = 5000;
    const g = new ShakeGate(() => t);
    g.allow();
    t = 10;
    expect(g.allow()).toBe(true);
  });
});

describe('fxDuration', () => {
  test('không giảm: giữ nguyên', () => {
    expect(fxDuration(450, false)).toBe(450);
  });
  test('giảm: cắt ở 200 ms, không kéo dài hiệu ứng ngắn', () => {
    expect(fxDuration(450, true)).toBe(200);
    expect(fxDuration(120, true)).toBe(120);
    expect(fxDuration(450, true, 120)).toBe(120);
    expect(fxDuration(0, true)).toBe(1);
  });
});
