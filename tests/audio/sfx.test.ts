import { describe, expect, test, vi } from 'vitest';
import {
  Sfx, SFX_MAX_VOICES, SFX_THROTTLE_MS, SOUND_KEY, UNLOCK_EVENTS, installAudioUnlock, loadSoundSettings, saveSoundSettings, sfx,
  type AudioContextLike, type SfxName,
} from '../../src/audio/sfx';
import type { KeyValueStore } from '../../src/settings/configStore';

const mem = (init: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } => {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { delete data[k]; },
  };
};

const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });

function fakeContext() {
  const oscillators: { started: boolean; onended: ((e?: unknown) => void) | null }[] = [];
  const ctx = {
    currentTime: 0,
    state: 'running' as string,
    destination: {},
    oscillators,
    suspend: vi.fn(() => Promise.resolve()),
    resume: vi.fn(() => Promise.resolve()),
    createGain: () => ({ gain: param(), connect: vi.fn() }),
    createOscillator: () => {
      const o = {
        type: 'sine', frequency: param(), onended: null as ((e?: unknown) => void) | null, started: false,
        connect: vi.fn(), start: vi.fn(() => { o.started = true; }), stop: vi.fn(),
      };
      oscillators.push(o);
      return o;
    },
    endAll() { for (const o of oscillators) o.onended?.(); },
  };
  return ctx;
}

const NAMES: SfxName[] = ['click', 'summon', 'merge', 'hit', 'crit', 'kill', 'bossKill', 'leak', 'waveStart', 'waveEnd',
  'quizRight', 'quizWrong', 'skill.swordsman', 'skill.archer', 'skill.mage', 'skill.summoner', 'win', 'lose'];

function setup(opts: { store?: KeyValueStore | null; t?: { v: number } } = {}) {
  const ctx = fakeContext();
  const t = opts.t ?? { v: 1000 };
  const createContext = vi.fn(() => ctx as unknown as AudioContextLike);
  const s = new Sfx({ createContext, now: () => t.v, store: opts.store ?? null });
  return { ctx, t, createContext, s };
}

describe('loadSoundSettings / saveSoundSettings', () => {
  test('mặc định khi thiếu, hỏng hoặc không có store', () => {
    expect(loadSoundSettings(null)).toEqual({ on: true, volume: 0.6 });
    expect(loadSoundSettings(mem())).toEqual({ on: true, volume: 0.6 });
    expect(loadSoundSettings(mem({ [SOUND_KEY]: '{not json' }))).toEqual({ on: true, volume: 0.6 });
    expect(loadSoundSettings(mem({ [SOUND_KEY]: '42' }))).toEqual({ on: true, volume: 0.6 });
  });
  test('đọc giá trị hợp lệ và kẹp volume 0..1', () => {
    expect(loadSoundSettings(mem({ [SOUND_KEY]: '{"on":false,"volume":0.25}' }))).toEqual({ on: false, volume: 0.25 });
    expect(loadSoundSettings(mem({ [SOUND_KEY]: '{"on":true,"volume":3}' })).volume).toBe(1);
    expect(loadSoundSettings(mem({ [SOUND_KEY]: '{"on":true,"volume":-2}' })).volume).toBe(0);
    expect(loadSoundSettings(mem({ [SOUND_KEY]: '{"on":"yes","volume":"loud"}' }))).toEqual({ on: true, volume: 0.6 });
  });
  test('store ném lỗi → mặc định, không ném', () => {
    const bad: KeyValueStore = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => {} };
    expect(loadSoundSettings(bad)).toEqual({ on: true, volume: 0.6 });
    expect(() => saveSoundSettings(bad, { on: true, volume: 1 })).not.toThrow();
    expect(() => saveSoundSettings(null, { on: true, volume: 1 })).not.toThrow();
  });
  test('save rồi load', () => {
    const st = mem();
    saveSoundSettings(st, { on: false, volume: 0.3 });
    expect(JSON.parse(st.data[SOUND_KEY])).toEqual({ on: false, volume: 0.3 });
    expect(loadSoundSettings(st)).toEqual({ on: false, volume: 0.3 });
  });
});

describe('Sfx settings', () => {
  test('set lưu ngay vào store', () => {
    const st = mem();
    const { s } = setup({ store: st });
    s.set({ volume: 0.2 });
    expect(JSON.parse(st.data[SOUND_KEY])).toEqual({ on: true, volume: 0.2 });
    s.set({ on: false });
    expect(JSON.parse(st.data[SOUND_KEY])).toEqual({ on: false, volume: 0.2 });
    expect(s.settings).toEqual({ on: false, volume: 0.2 });
  });
  test('set với persist:false đổi âm lượng nhưng không ghi store; persist() ghi một lần', () => {
    const st = mem();
    const setItem = vi.spyOn(st, 'setItem');
    const { s } = setup({ store: st });
    s.set({ volume: 0.1 }, { persist: false });
    s.set({ volume: 0.2 }, { persist: false });
    s.set({ volume: 0.3 }, { persist: false });
    expect(s.settings.volume).toBe(0.3);
    expect(setItem).not.toHaveBeenCalled();
    s.persist();
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(st.data[SOUND_KEY])).toEqual({ on: true, volume: 0.3 });
  });
  test('persist không ném khi store ném', () => {
    const bad: KeyValueStore = { getItem: () => null, setItem: () => { throw new Error('x'); }, removeItem: () => {} };
    const s = new Sfx({ createContext: () => null, store: bad });
    expect(() => { s.set({ volume: 0.4 }, { persist: false }); s.persist(); }).not.toThrow();
  });
  test('set kẹp volume', () => {
    const { s } = setup();
    s.set({ volume: 5 });
    expect(s.settings.volume).toBe(1);
    s.set({ volume: Number.NaN });
    expect(s.settings.volume).toBe(1);
  });
  test('đọc cài đặt đã lưu khi khởi tạo', () => {
    const { s } = setup({ store: mem({ [SOUND_KEY]: '{"on":false,"volume":0.9}' }) });
    expect(s.settings).toEqual({ on: false, volume: 0.9 });
  });
});

describe('Sfx.play', () => {
  test('tắt âm thanh: không tạo oscillator và không gọi createContext', () => {
    const { s, ctx, createContext } = setup({ store: mem({ [SOUND_KEY]: '{"on":false,"volume":0.6}' }) });
    s.unlock();
    s.play('click');
    expect(createContext).not.toHaveBeenCalled();
    expect(ctx.oscillators).toHaveLength(0);
  });
  test('chưa unlock: không phát, không tạo context', () => {
    const { s, ctx, createContext } = setup();
    s.play('click');
    expect(createContext).not.toHaveBeenCalled();
    expect(ctx.oscillators).toHaveLength(0);
  });
  test('unlock xong thì phát; mọi tiếng đều phát được và đều có start', () => {
    const { s, ctx, t } = setup();
    s.unlock();
    for (const n of NAMES) {
      const before = ctx.oscillators.length;
      s.play(n);
      expect(ctx.oscillators.length, n).toBeGreaterThan(before);
      ctx.endAll();
      t.v += 1000;
    }
    expect(ctx.oscillators.every((o) => o.started)).toBe(true);
  });
  test('tắt sau khi unlock → không phát; volume 0 → không phát', () => {
    const { s, ctx } = setup();
    s.unlock();
    s.set({ on: false });
    s.play('click');
    s.set({ on: true, volume: 0 });
    s.play('click');
    expect(ctx.oscillators).toHaveLength(0);
  });
  test('throttle: cùng tên trong 60 ms phát 1 lần, sau 60 ms phát lại', () => {
    const { s, ctx, t } = setup();
    s.unlock();
    s.play('hit');
    const n1 = ctx.oscillators.length;
    expect(n1).toBeGreaterThan(0);
    t.v += SFX_THROTTLE_MS - 1;
    s.play('hit');
    expect(ctx.oscillators.length).toBe(n1);
    t.v += 1;
    s.play('hit');
    expect(ctx.oscillators.length).toBeGreaterThan(n1);
  });
  test('throttle theo từng tên: tên khác vẫn phát', () => {
    const { s, ctx } = setup();
    s.unlock();
    s.play('hit');
    const n1 = ctx.oscillators.length;
    s.play('kill');
    expect(ctx.oscillators.length).toBeGreaterThan(n1);
  });
  test('tối đa 8 voices, giải phóng khi onended', () => {
    const { s, ctx } = setup();
    s.unlock();
    expect(SFX_MAX_VOICES).toBe(8);
    const counts: number[] = [];
    for (const n of NAMES.slice(0, 9)) { s.play(n); counts.push(ctx.oscillators.length); }
    for (let i = 1; i < 8; i++) expect(counts[i], `voice ${i}`).toBeGreaterThan(counts[i - 1]);
    expect(counts[8]).toBe(counts[7]);
    ctx.endAll();
    s.play(NAMES[8]);
    expect(ctx.oscillators.length).toBeGreaterThan(counts[7]);
  });
  test('voice kẹt (onended không bao giờ gọi) được dọn sau khi quá hạn', () => {
    const { s, ctx, t } = setup();
    s.unlock();
    for (const n of NAMES.slice(0, 8)) s.play(n);
    const full = ctx.oscillators.length;
    s.play(NAMES[8]);
    expect(ctx.oscillators.length).toBe(full);
    t.v += 5000;
    s.play(NAMES[8]);
    expect(ctx.oscillators.length).toBeGreaterThan(full);
  });
  test('đang suspended (popup/tab ẩn) thì không phát', () => {
    const { s, ctx } = setup();
    s.unlock();
    s.setSuspended(true);
    s.play('click');
    expect(ctx.oscillators).toHaveLength(0);
    s.setSuspended(false);
    s.play('click');
    expect(ctx.oscillators.length).toBeGreaterThan(0);
  });
});

describe('Sfx trạng thái context', () => {
  test('context chưa chạy (suspended): play không làm gì, chạy rồi thì phát', () => {
    const { s, ctx } = setup();
    ctx.state = 'suspended';
    s.unlock();
    s.play('click');
    expect(ctx.oscillators).toHaveLength(0);
    ctx.state = 'running';
    s.play('click');
    expect(ctx.oscillators.length).toBeGreaterThan(0);
  });
  test('unlock thử resume lại mỗi lần cho đến khi context chạy', () => {
    const { s, ctx } = setup();
    ctx.state = 'suspended';
    s.unlock();
    s.unlock();
    s.unlock();
    expect(ctx.resume).toHaveBeenCalledTimes(3);
    ctx.state = 'running';
    s.unlock();
    expect(ctx.resume).toHaveBeenCalledTimes(3);
  });
  test('đóng popup rồi unlock ở lần chạm sau vẫn resume nếu context chưa chạy', () => {
    const { s, ctx } = setup();
    s.unlock();
    s.setSuspended(true);
    ctx.state = 'suspended';
    s.setSuspended(false);
    ctx.resume.mockClear();
    s.unlock();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });
});

describe('installAudioUnlock', () => {
  const fakeTarget = () => {
    const handlers = new Map<string, () => void>();
    const opts = new Map<string, unknown>();
    return {
      handlers, opts,
      addEventListener: vi.fn((type: string, fn: () => void, o?: unknown) => { handlers.set(type, fn); opts.set(type, o); }),
    };
  };
  test('gắn đúng các sự kiện kích hoạt người dùng, capture + passive, và gọi unlock', () => {
    const target = fakeTarget();
    const { s, ctx, createContext } = setup();
    installAudioUnlock(target, s);
    expect([...target.handlers.keys()].sort()).toEqual([...UNLOCK_EVENTS].sort());
    expect(UNLOCK_EVENTS).toEqual(['pointerup', 'touchend', 'click', 'keydown']);
    for (const o of target.opts.values()) expect(o).toEqual({ capture: true, passive: true });
    expect(createContext).not.toHaveBeenCalled();
    target.handlers.get('touchend')!();
    expect(createContext).toHaveBeenCalledTimes(1);
    s.play('click');
    expect(ctx.oscillators.length).toBeGreaterThan(0);
  });
  test('chỉ cài một lần cho cùng một target', () => {
    const target = fakeTarget();
    const { s } = setup();
    installAudioUnlock(target, s);
    installAudioUnlock(target, s);
    expect(target.addEventListener).toHaveBeenCalledTimes(UNLOCK_EVENTS.length);
  });
  test('target hỏng / thiếu document → không ném', () => {
    expect(() => installAudioUnlock({ addEventListener: () => { throw new Error('x'); } })).not.toThrow();
    expect(() => installAudioUnlock(null)).not.toThrow();
  });
});

describe('Sfx robustness', () => {
  test('createContext trả null → không ném', () => {
    const s = new Sfx({ createContext: () => null, store: null });
    expect(() => { s.unlock(); s.play('click'); s.setSuspended(true); s.setSuspended(false); }).not.toThrow();
  });
  test('createContext ném → không ném', () => {
    const s = new Sfx({ createContext: () => { throw new Error('no audio'); }, store: null });
    expect(() => { s.unlock(); s.play('click'); }).not.toThrow();
  });
  test('createOscillator ném → play không ném', () => {
    const ctx = { ...fakeContext(), createOscillator: () => { throw new Error('boom'); } };
    const s = new Sfx({ createContext: () => ctx as unknown as AudioContextLike, store: null });
    s.unlock();
    expect(() => s.play('click')).not.toThrow();
  });
  test('store ném khi set → không ném', () => {
    const bad: KeyValueStore = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => {} };
    const s = new Sfx({ createContext: () => null, store: bad });
    expect(() => s.set({ volume: 0.1 })).not.toThrow();
    expect(s.settings.volume).toBe(0.1);
  });
  test('resume/suspend trả promise bị từ chối hoặc ném → không ném', () => {
    const ctx = fakeContext();
    ctx.state = 'suspended';
    ctx.resume = vi.fn(() => Promise.reject(new Error('blocked')));
    ctx.suspend = vi.fn(() => { throw new Error('x'); });
    const s = new Sfx({ createContext: () => ctx as unknown as AudioContextLike, store: null });
    expect(() => { s.unlock(); s.setSuspended(true); s.setSuspended(false); }).not.toThrow();
  });
});

describe('Sfx context lifecycle', () => {
  test('unlock tạo context đúng một lần và resume nếu đang suspended', () => {
    const { s, ctx, createContext } = setup();
    ctx.state = 'suspended';
    s.unlock();
    s.unlock();
    expect(createContext).toHaveBeenCalledTimes(1);
    expect(ctx.resume).toHaveBeenCalled();
  });
  test('setSuspended(true) gọi suspend; false gọi resume', () => {
    const { s, ctx } = setup();
    s.unlock();
    s.setSuspended(true);
    expect(ctx.suspend).toHaveBeenCalledTimes(1);
    s.setSuspended(false);
    expect(ctx.resume).toHaveBeenCalled();
  });
  test('unlock khi đang suspended thì không resume', () => {
    const { s, ctx } = setup();
    s.setSuspended(true);
    ctx.state = 'suspended';
    s.unlock();
    expect(ctx.resume).not.toHaveBeenCalled();
  });
  test('instance dùng chung không tạo AudioContext lúc import và play không ném', () => {
    expect(sfx).toBeInstanceOf(Sfx);
    expect(() => sfx.play('click')).not.toThrow();
  });
});
