import { DEFAULT_CONFIG, type GameConfig } from '../config';
import { mergeConfig } from '../settings/configStore';

/** Logic thuần của "bộ cấu hình" đã đặt tên (không DOM, không Phaser, không mạng). */

export const MAX_PRESETS = 50;
export const MAX_NAME_LEN = 40;

export interface PresetRow {
  name: string;
  /** Cấu hình thô như đã lưu; phải qua applyPreset trước khi dùng. */
  config: unknown;
  /** ISO time lưu. */
  savedAt: string;
}

export type PresetError = 'code' | 'network' | 'full';

/** Cắt hai đầu và gom mọi khoảng trắng liên tiếp thành một dấu cách. */
export const normalizeName = (raw: string): string => raw.trim().replace(/\s+/g, ' ');

export function validateName(raw: string): { ok: true; name: string } | { ok: false } {
  const name = normalizeName(raw);
  const len = Array.from(name).length;
  return len >= 1 && len <= MAX_NAME_LEN ? { ok: true, name } : { ok: false };
}

const key = (name: string): string => normalizeName(name).toLowerCase();

const time = (iso: string): number => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? -Infinity : t;
};

/** Mới nhất trước; ngày hỏng xuống cuối. Không đổi mảng gốc. */
export const sortPresets = (list: readonly PresetRow[]): PresetRow[] => [...list].sort((a, b) => time(b.savedAt) - time(a.savedAt));

export const findPreset = (list: readonly PresetRow[], name: string): PresetRow | undefined => {
  const k = key(name);
  return list.find((p) => key(p.name) === k);
};

/** Lưu tên này sẽ: tạo mới, ghi đè bộ trùng tên, hay bị chặn vì đã đủ MAX_PRESETS bộ. */
export function planSave(list: readonly PresetRow[], name: string): 'new' | 'overwrite' | 'full' {
  if (findPreset(list, name)) return 'overwrite';
  return list.length >= MAX_PRESETS ? 'full' : 'new';
}

export function upsertPreset(list: readonly PresetRow[], row: PresetRow): PresetRow[] {
  const k = key(row.name);
  return sortPresets([...list.filter((p) => key(p.name) !== k), row]);
}

export const removePreset = (list: readonly PresetRow[], name: string): PresetRow[] => {
  const k = key(name);
  return list.filter((p) => key(p.name) !== k);
};

/** Bản nháp có khác mốc (lần nạp/lưu gần nhất) không. */
export const isDraftDirty = (draft: GameConfig, baseline: GameConfig): boolean => JSON.stringify(draft) !== JSON.stringify(baseline);

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** dd/MM HH:mm theo giờ máy; ngày hỏng → rỗng. */
export function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function presetErrorMessage(e: PresetError): string {
  if (e === 'code') return 'Sai mã quản trị';
  if (e === 'full') return `Đã đủ ${MAX_PRESETS} bộ — xóa bớt trước khi lưu bộ mới`;
  return 'Không kết nối được';
}

/** Gộp bộ đã lưu lên giá trị mặc định (trường thiếu/sai lấy mặc định). */
export function applyPreset(raw: unknown): { config: GameConfig; errors: string[] } {
  return mergeConfig(DEFAULT_CONFIG, raw);
}

/** Dòng trả về của rpc ps_list_presets → PresetRow[] (mới nhất trước); bỏ dòng hỏng. null nếu không phải mảng. */
export function parsePresetRows(data: unknown): PresetRow[] | null {
  if (!Array.isArray(data)) return null;
  const rows: PresetRow[] = [];
  for (const r of data) {
    if (typeof r !== 'object' || r === null) continue;
    const o = r as Record<string, unknown>;
    if (typeof o.name !== 'string') continue;
    rows.push({ name: o.name, config: o.config, savedAt: typeof o.saved_at === 'string' ? o.saved_at : '' });
  }
  return sortPresets(rows);
}
