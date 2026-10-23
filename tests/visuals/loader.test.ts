import { afterEach, describe, expect, test, vi } from 'vitest';
import { MANIFEST_TIMEOUT_MS, atlasFrames, createVisuals, sheetFrames, type TextureSource, type VisualIO } from '../../src/visuals/loader';

describe('sheetFrames', () => {
  test('bỏ trống frames → mọi khung', () => {
    expect(sheetFrames(4)).toEqual([0, 1, 2, 3]);
  });
  test('frames chọn n khung đầu, không vượt số khung có', () => {
    expect(sheetFrames(6, 3)).toEqual([0, 1, 2]);
    expect(sheetFrames(2, 5)).toEqual([0, 1]);
    expect(sheetFrames(0)).toEqual([]);
  });
});

describe('atlasFrames', () => {
  const names = ['walk_10', 'die_2', 'walk_2', 'walk_1', 'die_10', 'die_1'];
  test('lọc theo prefix, sắp tự nhiên', () => {
    expect(atlasFrames(names, 'walk_')).toEqual(['walk_1', 'walk_2', 'walk_10']);
    expect(atlasFrames(names, 'die_')).toEqual(['die_1', 'die_2', 'die_10']);
  });
  test('không prefix → mọi khung, sắp tự nhiên; không đổi mảng gốc', () => {
    const copy = names.slice();
    expect(atlasFrames(names)).toEqual(['die_1', 'die_2', 'die_10', 'walk_1', 'walk_2', 'walk_10']);
    expect(names).toEqual(copy);
  });
  test('prefix không khớp → rỗng', () => {
    expect(atlasFrames(names, 'idle_')).toEqual([]);
  });
});

type Img = HTMLImageElement;
const img = (width: number, height: number): Img => ({ width, height }) as Img;

interface Fake extends VisualIO {
  warnings: string[];
  anims: { animKey: string; texKey: string; frames: (string | number)[]; fps: number; loop: boolean }[];
  textures: { texKey: string; src: TextureSource }[];
}

/** files: url → nội dung JSON hoặc ảnh; thiếu → lỗi. `hang` → không bao giờ xong. */
function fakeIO(files: Record<string, unknown>, opts: { hang?: string[] } = {}): Fake {
  const io: Fake = {
    warnings: [],
    anims: [],
    textures: [],
    async fetchJson(url) {
      if (opts.hang?.includes(url)) return new Promise(() => undefined);
      if (!(url in files)) throw new Error(`HTTP 404 ${url}`);
      return files[url];
    },
    async loadImage(url) {
      if (opts.hang?.includes(url)) return new Promise<Img>(() => undefined);
      if (!(url in files)) throw new Error(`không tải được ảnh ${url}`);
      return files[url] as Img;
    },
    addTexture(texKey, src) {
      io.textures.push({ texKey, src });
      if (src.type === 'sheet') {
        const n = Math.floor(src.image.width / src.frameWidth) * Math.floor(src.image.height / src.frameHeight);
        return Array.from({ length: n }, (_, i) => String(i));
      }
      return Object.keys((src.data as { frames: object }).frames);
    },
    createAnim(animKey, texKey, frames, fps, loop) {
      io.anims.push({ animKey, texKey, frames, fps, loop });
      return true;
    },
    warn(msg) {
      io.warnings.push(msg);
    },
  };
  return io;
}

const B = '/sprites/';

describe('createVisuals', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('manifest rỗng → registry rỗng, không cảnh báo', async () => {
    const io = fakeIO({ [B + 'manifest.json']: {} });
    const r = await createVisuals(io, B, 1000);
    expect(r.has('unit.archer.idle')).toBe(false);
    expect(r.entry('unit.archer.idle')).toBeUndefined();
    expect(io.warnings).toEqual([]);
  });

  test('không đọc được manifest → registry rỗng, một cảnh báo', async () => {
    const io = fakeIO({});
    const r = await createVisuals(io, B, 1000);
    expect(r.has('unit.archer.idle')).toBe(false);
    expect(io.warnings).toHaveLength(1);
  });

  test('sheet: mặc định dùng mọi khung, áp fps/loop của manifest', async () => {
    const io = fakeIO({
      [B + 'manifest.json']: { 'unit.archer.idle': { type: 'sheet', file: 'a.png', frameWidth: 64, frameHeight: 64 } },
      [B + 'a.png']: img(256, 64),
    });
    const r = await createVisuals(io, B, 1000);
    expect(r.has('unit.archer.idle')).toBe(true);
    expect(r.textureKey('unit.archer.idle')).not.toBe('');
    expect(r.animKey('unit.archer.idle')).not.toBe('');
    expect(r.entry('unit.archer.idle')).toMatchObject({ type: 'sheet', fps: 10, loop: true });
    expect(io.anims).toEqual([
      { animKey: r.animKey('unit.archer.idle'), texKey: r.textureKey('unit.archer.idle'), frames: [0, 1, 2, 3], fps: 10, loop: true },
    ]);
    expect(io.warnings).toEqual([]);
  });

  test('file hỏng ở một khóa → khóa đó thiếu, đúng một cảnh báo, khóa khác vẫn có', async () => {
    const io = fakeIO({
      [B + 'manifest.json']: {
        'unit.archer.idle': { type: 'sheet', file: 'missing.png', frameWidth: 64, frameHeight: 64 },
        'unit.mage.idle': { type: 'sheet', file: 'm.png', frameWidth: 32, frameHeight: 32, frames: 2 },
      },
      [B + 'm.png']: img(128, 32),
    });
    const r = await createVisuals(io, B, 1000);
    expect(r.has('unit.archer.idle')).toBe(false);
    expect(r.has('unit.mage.idle')).toBe(true);
    expect(io.anims.map((a) => a.frames)).toEqual([[0, 1]]);
    expect(io.warnings).toHaveLength(1);
    expect(io.warnings[0]).toContain('unit.archer.idle');
  });

  test('ảnh nhỏ hơn một khung → khóa bị bỏ, một cảnh báo', async () => {
    const io = fakeIO({
      [B + 'manifest.json']: { 'minion.idle': { type: 'sheet', file: 's.png', frameWidth: 64, frameHeight: 64 } },
      [B + 's.png']: img(32, 32),
    });
    const r = await createVisuals(io, B, 1000);
    expect(r.has('minion.idle')).toBe(false);
    expect(io.warnings).toHaveLength(1);
    expect(io.textures).toHaveLength(0);
  });

  test('atlas dùng chung ảnh cho nhiều khóa theo prefix: texture tạo một lần', async () => {
    const frames = { walk_2: {}, walk_10: {}, walk_1: {}, die_1: {}, die_0: {} };
    const io = fakeIO({
      [B + 'manifest.json']: {
        'enemy.boss.walk': { type: 'atlas', file: 'b.png', data: 'b.json', prefix: 'walk_' },
        'enemy.boss.die': { type: 'atlas', file: 'b.png', data: 'b.json', prefix: 'die_', fps: 8 },
        'enemy.tank.walk': { type: 'atlas', file: 'b.png', data: 'b.json', prefix: 'nope_' },
      },
      [B + 'b.png']: img(512, 512),
      [B + 'b.json']: { frames },
    });
    const r = await createVisuals(io, B, 1000);
    expect(io.textures).toHaveLength(1);
    expect(r.textureKey('enemy.boss.walk')).toBe(r.textureKey('enemy.boss.die'));
    const byKey = Object.fromEntries(io.anims.map((a) => [a.animKey, a]));
    expect(byKey[r.animKey('enemy.boss.walk')].frames).toEqual(['walk_1', 'walk_2', 'walk_10']);
    expect(byKey[r.animKey('enemy.boss.die')]).toMatchObject({ frames: ['die_0', 'die_1'], fps: 8, loop: false });
    expect(r.has('enemy.tank.walk')).toBe(false);
    expect(io.warnings).toHaveLength(1);
    expect(io.warnings[0]).toContain('enemy.tank.walk');
  });

  test('atlas JSON sai → khóa bị bỏ, một cảnh báo', async () => {
    const io = fakeIO({
      [B + 'manifest.json']: { 'minion.idle': { type: 'atlas', file: 'x.png', data: 'x.json' } },
      [B + 'x.png']: img(64, 64),
      [B + 'x.json']: { notFrames: true },
    });
    const r = await createVisuals(io, B, 1000);
    expect(r.has('minion.idle')).toBe(false);
    expect(io.warnings).toHaveLength(1);
    expect(io.textures).toHaveLength(0);
  });

  test('mục manifest sai → cảnh báo từ parseManifest, mục khác vẫn tải', async () => {
    const io = fakeIO({
      [B + 'manifest.json']: {
        'unit.archer.idle': { type: 'sheet', file: 'a.png', frameWidth: 64, frameHeight: 64, fps: 0 },
        'bad.key': {},
        'minion.idle': { type: 'sheet', file: 'a.png', frameWidth: 64, frameHeight: 64 },
      },
      [B + 'a.png']: img(64, 64),
    });
    const r = await createVisuals(io, B, 1000);
    expect(r.has('unit.archer.idle')).toBe(false);
    expect(r.has('minion.idle')).toBe(true);
    expect(io.warnings).toHaveLength(2);
  });

  test('quá thời gian → trả về khóa đã xong, khóa chậm bị bỏ (kể cả xong sau), một cảnh báo', async () => {
    vi.useFakeTimers();
    let release: (v: Img) => void = () => undefined;
    const io = fakeIO({
      [B + 'manifest.json']: {
        'unit.archer.idle': { type: 'sheet', file: 'fast.png', frameWidth: 64, frameHeight: 64 },
        'unit.mage.idle': { type: 'sheet', file: 'slow.png', frameWidth: 64, frameHeight: 64 },
      },
      [B + 'fast.png']: img(64, 64),
    });
    const base = io.loadImage.bind(io);
    io.loadImage = (url) =>
      url.endsWith('slow.png')
        ? new Promise<Img>((res) => {
            release = res;
          })
        : base(url);
    const p = createVisuals(io, B, 8000);
    await vi.advanceTimersByTimeAsync(8000);
    const r = await p;
    expect(r.has('unit.archer.idle')).toBe(true);
    expect(r.has('unit.mage.idle')).toBe(false);
    expect(io.warnings).toHaveLength(1);
    expect(io.warnings[0]).toContain('unit.mage.idle');
    release(img(64, 64));
    await vi.advanceTimersByTimeAsync(0);
    expect(r.has('unit.mage.idle')).toBe(false);
    expect(io.anims).toHaveLength(1);
    expect(io.warnings).toHaveLength(1);
  });

  test('manifest treo → hết giờ trả registry rỗng', async () => {
    vi.useFakeTimers();
    const io = fakeIO({}, { hang: [B + 'manifest.json'] });
    const p = createVisuals(io, B, 8000);
    await vi.advanceTimersByTimeAsync(8000);
    const r = await p;
    expect(r.has('minion.idle')).toBe(false);
    expect(io.warnings).toHaveLength(1);
    expect(io.warnings[0]).toContain('manifest.json');
  });

  test('manifest treo → registry rỗng sau MANIFEST_TIMEOUT_MS (2 s), không đợi hết 8 s', async () => {
    vi.useFakeTimers();
    expect(MANIFEST_TIMEOUT_MS).toBe(2000);
    const io = fakeIO({}, { hang: [B + 'manifest.json'] });
    let settled = false;
    const p = createVisuals(io, B, 8000).then((r) => {
      settled = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(MANIFEST_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const r = await p;
    expect(settled).toBe(true);
    expect(r.has('minion.idle')).toBe(false);
    expect(io.warnings).toHaveLength(1);
    expect(io.warnings[0]).toContain('manifest.json');
  });

  test('manifest xong trước 2 s nhưng ảnh chậm: vẫn được chờ tới hạn chung, không bị cắt ở 2 s', async () => {
    vi.useFakeTimers();
    const io = fakeIO({
      [B + 'manifest.json']: { 'minion.idle': { type: 'sheet', file: 'a.png', frameWidth: 64, frameHeight: 64 } },
    }, { hang: [B + 'a.png'] });
    let settled = false;
    const p = createVisuals(io, B, 8000).then((r) => {
      settled = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(MANIFEST_TIMEOUT_MS + 1000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(8000);
    await p;
    expect(settled).toBe(true);
  });

  test('IO ném lỗi bất ngờ → không ném ra ngoài', async () => {
    const io = fakeIO({
      [B + 'manifest.json']: { 'minion.idle': { type: 'sheet', file: 'a.png', frameWidth: 64, frameHeight: 64 } },
      [B + 'a.png']: img(64, 64),
    });
    io.createAnim = () => {
      throw new Error('boom');
    };
    const r = await createVisuals(io, B, 1000);
    expect(r.has('minion.idle')).toBe(false);
    expect(io.warnings).toHaveLength(1);
  });
});
