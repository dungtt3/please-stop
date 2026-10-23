// Tải manifest + ảnh sprite một lần (cache cấp module) và tạo texture/hoạt ảnh Phaser.
// Lỗi ở một khóa chỉ làm khóa đó rơi về hình khối (một console.warn), không ảnh hưởng khóa khác.
// File này không import Phaser lúc chạy (chỉ kiểu) để phần lõi `createVisuals` test được.
import type Phaser from 'phaser';
import { parseManifest, type ManifestEntry, type VisualKey } from './manifest';

export const ASSET_LOAD_TIMEOUT_MS = 8000;

export interface VisualRegistry {
  has(key: VisualKey): boolean;
  textureKey(key: VisualKey): string;
  animKey(key: VisualKey): string;
  entry(key: VisualKey): ManifestEntry | undefined;
}

interface Loaded {
  entry: ManifestEntry;
  texKey: string;
  animKey: string;
}

class Registry implements VisualRegistry {
  constructor(private readonly map: ReadonlyMap<VisualKey, Loaded>) {}
  has(key: VisualKey): boolean {
    return this.map.has(key);
  }
  textureKey(key: VisualKey): string {
    return this.map.get(key)?.texKey ?? '';
  }
  animKey(key: VisualKey): string {
    return this.map.get(key)?.animKey ?? '';
  }
  entry(key: VisualKey): ManifestEntry | undefined {
    return this.map.get(key)?.entry;
  }
}

const EMPTY: VisualRegistry = new Registry(new Map());

export type TextureSource =
  | { type: 'sheet'; image: HTMLImageElement; frameWidth: number; frameHeight: number }
  | { type: 'atlas'; image: HTMLImageElement; data: object };

/** Phần phụ thuộc trình duyệt/Phaser, thay được trong test. */
export interface VisualIO {
  fetchJson(url: string): Promise<unknown>;
  loadImage(url: string): Promise<HTMLImageElement>;
  /** Tạo texture, trả về tên các khung (không gồm khung gốc). Ném lỗi nếu không tạo được. */
  addTexture(texKey: string, src: TextureSource): string[];
  /** Tạo hoạt ảnh; false nếu không tạo được. */
  createAnim(animKey: string, texKey: string, frames: (string | number)[], fps: number, loop: boolean): boolean;
  warn(msg: string): void;
}

/** Khung của spritesheet: 0..n−1 với n = `frames` (bỏ trống = tất cả), không vượt số khung có trong ảnh. */
export function sheetFrames(available: number, frames?: number): number[] {
  const n = Math.max(0, Math.min(available, frames ?? available));
  return Array.from({ length: n }, (_, i) => i);
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Khung của atlas: tên bắt đầu bằng `prefix` (bỏ trống = tất cả), sắp tự nhiên (frame_2 trước frame_10). */
export function atlasFrames(names: readonly string[], prefix?: string): string[] {
  const picked = prefix ? names.filter((n) => n.startsWith(prefix)) : names.slice();
  return picked.sort((a, b) => collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0));
}

const isAtlasJson = (v: unknown): v is object => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (typeof o.frames === 'object' && o.frames !== null) || Array.isArray(o.textures);
};

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const PREFIX = '[sprites]';

/**
 * Đọc manifest ở `baseUrl + 'manifest.json'` rồi tải từng khóa. Không bao giờ ném lỗi.
 * Quá `timeoutMs`: trả về các khóa đã xong; khóa chưa xong bị bỏ (một cảnh báo), kể cả khi tải xong sau đó.
 */
export async function createVisuals(io: VisualIO, baseUrl: string, timeoutMs: number): Promise<VisualRegistry> {
  const loaded = new Map<VisualKey, Loaded>();
  const pending = new Set<VisualKey>();
  let sealed = false;
  let manifestRead = false;

  const work = async (): Promise<void> => {
    let raw: unknown;
    try {
      raw = await io.fetchJson(baseUrl + 'manifest.json');
    } catch (e) {
      if (!sealed) io.warn(`${PREFIX} không đọc được manifest.json (${errMsg(e)}); dùng hình khối`);
      return;
    } finally {
      manifestRead = true;
    }
    if (sealed) return;
    const { entries, warnings } = parseManifest(raw);
    for (const w of warnings) io.warn(`${PREFIX} manifest: ${w}`);

    // Nhiều khóa có thể dùng chung một ảnh (atlas + prefix): tải và tạo texture một lần.
    const textures = new Map<string, Promise<{ texKey: string; names: string[] }>>();
    const texture = (entry: ManifestEntry): Promise<{ texKey: string; names: string[] }> => {
      const id = entry.type === 'sheet' ? `sheet|${entry.file}|${entry.frameWidth}|${entry.frameHeight}` : `atlas|${entry.file}|${entry.data}`;
      let p = textures.get(id);
      if (!p) {
        const texKey = `ps-vis-tex-${textures.size}`;
        p = (async () => {
          if (entry.type === 'sheet') {
            const image = await io.loadImage(baseUrl + entry.file);
            if (image.width < entry.frameWidth || image.height < entry.frameHeight) {
              throw new Error(`ảnh "${entry.file}" (${image.width}×${image.height}) nhỏ hơn một khung ${entry.frameWidth}×${entry.frameHeight}`);
            }
            return { texKey, names: io.addTexture(texKey, { type: 'sheet', image, frameWidth: entry.frameWidth, frameHeight: entry.frameHeight }) };
          }
          const [image, data] = await Promise.all([io.loadImage(baseUrl + entry.file), io.fetchJson(baseUrl + entry.data)]);
          if (!isAtlasJson(data)) throw new Error(`"${entry.data}" không phải atlas JSON (thiếu "frames")`);
          return { texKey, names: io.addTexture(texKey, { type: 'atlas', image, data }) };
        })();
        textures.set(id, p);
      }
      return p;
    };

    const keys = Object.keys(entries) as VisualKey[];
    for (const k of keys) pending.add(k);
    await Promise.all(
      keys.map(async (key) => {
        const entry = entries[key]!;
        try {
          const { texKey, names } = await texture(entry);
          if (sealed) return;
          let frames: (string | number)[];
          if (entry.type === 'sheet') {
            frames = sheetFrames(names.length, entry.frames);
            if (entry.frames !== undefined && entry.frames > names.length) {
              io.warn(`${PREFIX} "${key}": ảnh chỉ có ${names.length} khung, dùng ${names.length} thay vì ${entry.frames}`);
            }
          } else {
            frames = atlasFrames(names, entry.prefix);
          }
          if (frames.length === 0) {
            throw new Error(entry.type === 'atlas' && entry.prefix ? `không có khung nào bắt đầu bằng "${entry.prefix}"` : 'không có khung nào');
          }
          const animKey = `ps-vis:${key}`;
          if (!io.createAnim(animKey, texKey, frames, entry.fps, entry.loop)) throw new Error('không tạo được hoạt ảnh');
          loaded.set(key, { entry, texKey, animKey });
        } catch (e) {
          if (!sealed) io.warn(`${PREFIX} "${key}": ${errMsg(e)}; dùng hình khối`);
        } finally {
          pending.delete(key);
        }
      }),
    );
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });
  const done = work().then(
    () => 'done' as const,
    (e) => {
      io.warn(`${PREFIX} lỗi khi tải asset (${errMsg(e)}); dùng hình khối`);
      return 'done' as const;
    },
  );
  const r = await Promise.race([done, timedOut]);
  clearTimeout(timer);
  if (r === 'timeout') {
    sealed = true;
    const what = manifestRead ? [...pending].join(', ') : 'manifest.json';
    io.warn(`${PREFIX} tải asset quá ${timeoutMs / 1000}s; dùng hình khối cho: ${what || '(không còn gì)'}`);
  }
  return new Registry(new Map(loaded));
}

/** Thư mục sprites/ theo base của Vite. */
const spritesUrl = (): string => `${import.meta.env.BASE_URL ?? '/'}sprites/`;

function phaserIO(scene: Phaser.Scene): VisualIO {
  // Trình quản lý texture/hoạt ảnh là của cả game: vẫn dùng được sau khi scene tải đã đóng.
  const tm = scene.textures;
  const am = scene.anims;
  return {
    async fetchJson(url) {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status} khi tải ${url}`);
      return res.json();
    },
    loadImage(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`không tải được ảnh ${url}`));
        img.src = url;
      });
    },
    addTexture(texKey, src) {
      if (tm.exists(texKey)) tm.remove(texKey);
      const t =
        src.type === 'sheet'
          ? tm.addSpriteSheet(texKey, src.image, { frameWidth: src.frameWidth, frameHeight: src.frameHeight })
          : tm.addAtlas(texKey, src.image, src.data);
      if (!t) throw new Error('Phaser không tạo được texture');
      return t.getFrameNames();
    },
    createAnim(animKey, texKey, frames, fps, loop) {
      if (am.exists(animKey)) am.remove(animKey);
      const a = am.create({ key: animKey, frames: frames.map((frame) => ({ key: texKey, frame })), frameRate: fps, repeat: loop ? -1 : 0 });
      return a !== false;
    },
    warn: (msg) => console.warn(msg),
  };
}

let cache: Promise<VisualRegistry> | null = null;
let current: VisualRegistry = EMPTY;

/** Tải một lần cho cả trang; gọi lại trả về cùng kết quả. Không bao giờ ném lỗi, xong trong `ASSET_LOAD_TIMEOUT_MS`. */
export function loadVisuals(scene: Phaser.Scene): Promise<VisualRegistry> {
  if (!cache) {
    let p: Promise<VisualRegistry>;
    try {
      p = createVisuals(phaserIO(scene), spritesUrl(), ASSET_LOAD_TIMEOUT_MS);
    } catch (e) {
      p = Promise.reject(e);
    }
    cache = p
      .catch((e: unknown) => {
        console.warn(`${PREFIX} không tải được asset (${errMsg(e)}); dùng hình khối`);
        return EMPTY;
      })
      .then((r) => (current = r));
  }
  return cache;
}

/** Kết quả đã tải; chưa tải (hoặc đang tải) → registry rỗng. */
export function getVisuals(): VisualRegistry {
  return current;
}
