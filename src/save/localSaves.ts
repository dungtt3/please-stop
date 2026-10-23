import type { KeyValueStore } from '../settings/configStore';
import { parseRunSave, type RunSave } from '../sim/save';

export const DEVICE_KEY = 'ps.deviceId';
export const GUEST_KEY = 'ps.save.guest';
export const accountKey = (userId: string): string => `ps.save.${userId}`;
export const endedKey = (userId: string): string => `ps.ended.${userId}`;

/** Bản lưu trong máy: `baseRev` là rev đám mây đã biết, `dirty` là chưa đẩy lên đám mây. */
export interface LocalSave {
  save: RunSave;
  baseRev: number;
  dirty: boolean;
}

const HEX: string[] = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

/** Dựng uuid v4 từ 16 byte ngẫu nhiên (đặt bit version và variant). */
export function uuidFromBytes(bytes: Uint8Array): string {
  const b = Uint8Array.from(bytes);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => HEX[x]);
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`;
}

/** `crypto.randomUUID` chỉ có trên ngữ cảnh an toàn (http qua LAN thì không), nên có đường dự phòng. */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return uuidFromBytes(crypto.getRandomValues(new Uint8Array(16)));
}

/** Dùng khi không đọc/ghi được store: id sinh một lần, ổn định trong phiên. */
let memoryDeviceId: string | null = null;

export function getDeviceId(store: KeyValueStore | null, gen: () => string = uuid): string {
  let id: string | null = null;
  try {
    const cur = store?.getItem(DEVICE_KEY);
    if (cur) return cur;
    id = gen();
    store?.setItem(DEVICE_KEY, id);
    if (store) return id;
  } catch {
    /* rơi xuống id trong bộ nhớ */
  }
  memoryDeviceId ??= id ?? gen();
  return memoryDeviceId;
}

/** `null` nếu chưa có (hoặc không đọc được); `'invalid'` nếu hỏng (khóa đã bị xóa). */
export function readLocal(store: KeyValueStore | null, key: string): LocalSave | null | 'invalid' {
  let raw: string | null | undefined;
  try {
    raw = store?.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      const save = parseRunSave(o.save);
      if (save && typeof o.baseRev === 'number' && Number.isInteger(o.baseRev) && o.baseRev >= 0 && typeof o.dirty === 'boolean') {
        return { save, baseRev: o.baseRev, dirty: o.dirty };
      }
    }
  } catch {
    /* JSON hỏng */
  }
  removeLocal(store, key);
  return 'invalid';
}

/** Trả false nếu không ghi được. */
export function writeLocal(store: KeyValueStore | null, key: string, v: LocalSave): boolean {
  try {
    if (!store) return false;
    store.setItem(key, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

export function removeLocal(store: KeyValueStore | null, key: string): void {
  try {
    store?.removeItem(key);
  } catch {
    /* bỏ qua */
  }
}

/** Danh sách runId đã kết thúc nhưng chưa báo được lên đám mây. */
export function readEnded(store: KeyValueStore | null, userId: string): string[] {
  try {
    const raw = store?.getItem(endedKey(userId));
    if (!raw) return [];
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeEnded(store: KeyValueStore | null, userId: string, ids: string[]): void {
  try {
    if (!store) return;
    if (ids.length) store.setItem(endedKey(userId), JSON.stringify(ids));
    else store.removeItem(endedKey(userId));
  } catch {
    /* bỏ qua */
  }
}

export function addEnded(store: KeyValueStore | null, userId: string, runId: string): void {
  const ids = readEnded(store, userId);
  if (!ids.includes(runId)) writeEnded(store, userId, [...ids, runId]);
}

export function removeEnded(store: KeyValueStore | null, userId: string, runId: string): void {
  const ids = readEnded(store, userId);
  if (ids.includes(runId)) writeEnded(store, userId, ids.filter((x) => x !== runId));
}
