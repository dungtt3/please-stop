import { describe, expect, test } from 'vitest';
import type { KeyValueStore } from '../../src/settings/configStore';
import { createMediaReduced, fxDuration, LEAK_CUE_MIN_GAP_MS, MOTION_KEY, MotionSettings, ShakeGate } from '../../src/settings/motion';

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

describe('ShakeGate với khoảng cách riêng (báo quái lọt)', () => {
  test('333 ms chặn; 334 ms cho phép → dưới 3 lần/giây', () => {
    expect(LEAK_CUE_MIN_GAP_MS).toBe(334);
    let t = 0;
    const g = new ShakeGate(() => t, LEAK_CUE_MIN_GAP_MS);
    expect(g.allow()).toBe(true);
    t = 333;
    expect(g.allow()).toBe(false);
    t = 334;
    expect(g.allow()).toBe(true);
    let n = 0;
    const burst = new ShakeGate(() => t, LEAK_CUE_MIN_GAP_MS);
    for (t = 0; t < 1000; t += 10) if (burst.allow()) n++;
    expect(n).toBeLessThanOrEqual(3);
  });
});

describe('createMediaReduced', () => {
  test('tạo MediaQueryList một lần, đọc .matches mỗi lần (đổi cài đặt OS giữa phiên vẫn thấy)', () => {
    const mql = { matches: false };
    let calls = 0;
    const read = createMediaReduced(() => ({ matchMedia: () => { calls++; return mql; } }));
    expect(read()).toBe(false);
    mql.matches = true;
    expect(read()).toBe(true);
    mql.matches = false;
    expect(read()).toBe(false);
    expect(calls).toBe(1);
  });
  test('không có window / matchMedia / matchMedia ném → false, không ném', () => {
    expect(createMediaReduced(() => undefined)()).toBe(false);
    expect(createMediaReduced(() => ({}))()).toBe(false);
    expect(createMediaReduced(() => ({ matchMedia: () => { throw new Error('x'); } }))()).toBe(false);
  });
  test('kết hợp với MotionSettings', () => {
    const mql = { matches: false };
    const m = new MotionSettings(null, createMediaReduced(() => ({ matchMedia: () => mql })));
    expect(m.reduced).toBe(false);
    mql.matches = true;
    expect(m.reduced).toBe(true);
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
