// Định dạng bản khai báo sprite/hoạt ảnh (public/sprites/manifest.json). Thuần TypeScript, không dùng Phaser.
// Xem docs/assets.md để biết cách chuẩn bị asset.
import type { ClassId, EnemyKind } from '../sim/types';

export const CLASS_IDS = ['swordsman', 'archer', 'mage', 'summoner'] as const;
export const ENEMY_KINDS = ['normal', 'fast', 'tank', 'boss'] as const;

export type VisualKey =
  | `unit.${ClassId}.${'idle' | 'attack' | 'skill'}` | `minion.${'idle' | 'attack'}`
  | `enemy.${EnemyKind}.${'walk' | 'die'}` | `projectile.${ClassId | 'minion'}` | `impact.${ClassId | 'minion' | 'crit'}`
  | `skill.${ClassId}` | 'skill.mage.meteor' | 'skill.archer.arrow';

const buildKeys = (): VisualKey[] => {
  const keys: VisualKey[] = [];
  for (const c of CLASS_IDS) for (const a of ['idle', 'attack', 'skill'] as const) keys.push(`unit.${c}.${a}`);
  keys.push('minion.idle', 'minion.attack');
  for (const k of ENEMY_KINDS) for (const a of ['walk', 'die'] as const) keys.push(`enemy.${k}.${a}`);
  for (const c of [...CLASS_IDS, 'minion'] as const) keys.push(`projectile.${c}`);
  for (const c of [...CLASS_IDS, 'minion', 'crit'] as const) keys.push(`impact.${c}`);
  for (const c of CLASS_IDS) keys.push(`skill.${c}`);
  keys.push('skill.mage.meteor', 'skill.archer.arrow');
  return keys;
};

export const VISUAL_KEYS: readonly VisualKey[] = buildKeys();

interface Common {
  fps: number;
  loop: boolean;
  scale?: number;
  originX?: number;
  originY?: number;
  tint?: number;
  rotateToTarget?: boolean;
}

export type ManifestEntry =
  | ({ type: 'sheet'; file: string; frameWidth: number; frameHeight: number; frames?: number } & Common)
  | ({ type: 'atlas'; file: string; data: string; prefix?: string } & Common);

export const DEFAULT_FPS = 10;

const KEY_SET: ReadonlySet<string> = new Set(VISUAL_KEYS);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isPosInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;
const isPosNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Đường dẫn tương đối trong `sprites/`: không rỗng, không tuyệt đối, không `..`, không `://`. */
const isSafePath = (v: unknown): v is string => {
  if (typeof v !== 'string' || v.trim() === '') return false;
  if (v.includes('://')) return false;
  if (/^[\\/]/.test(v) || /^[a-zA-Z]:/.test(v)) return false;
  return !v.split(/[\\/]/).includes('..');
};

/** idle/walk lặp mặc định; mọi thứ còn lại chạy một lần. */
const defaultLoop = (key: string): boolean => key.endsWith('.idle') || key.endsWith('.walk');

/** Trả về mục hợp lệ, hoặc chuỗi mô tả lỗi. */
const parseEntry = (key: string, v: unknown): ManifestEntry | string => {
  if (!isRecord(v)) return 'mục phải là object';
  if (!isSafePath(v.file)) return '`file` phải là đường dẫn tương đối không rỗng trong sprites/ (không có "..", "://")';

  const fps = v.fps === undefined ? DEFAULT_FPS : v.fps;
  if (!isPosNum(fps)) return '`fps` phải là số > 0';
  const loop = v.loop === undefined ? defaultLoop(key) : v.loop;
  if (typeof loop !== 'boolean') return '`loop` phải là true/false';

  if (v.scale !== undefined && !isPosNum(v.scale)) return '`scale` phải là số > 0';
  if (v.originX !== undefined && !isNum(v.originX)) return '`originX` phải là số';
  if (v.originY !== undefined && !isNum(v.originY)) return '`originY` phải là số';
  if (v.tint !== undefined && !(isNum(v.tint) && Number.isInteger(v.tint) && v.tint >= 0)) return '`tint` phải là số nguyên >= 0 (vd 0xff0000)';
  if (v.rotateToTarget !== undefined && typeof v.rotateToTarget !== 'boolean') return '`rotateToTarget` phải là true/false';

  const common: Common = { fps, loop };
  if (v.scale !== undefined) common.scale = v.scale as number;
  if (v.originX !== undefined) common.originX = v.originX as number;
  if (v.originY !== undefined) common.originY = v.originY as number;
  if (v.tint !== undefined) common.tint = v.tint as number;
  if (v.rotateToTarget !== undefined) common.rotateToTarget = v.rotateToTarget as boolean;

  if (v.type === 'sheet') {
    if (!isPosInt(v.frameWidth)) return '`frameWidth` phải là số nguyên > 0';
    if (!isPosInt(v.frameHeight)) return '`frameHeight` phải là số nguyên > 0';
    if (v.frames !== undefined && !isPosInt(v.frames)) return '`frames` phải là số nguyên > 0';
    const entry: ManifestEntry = { type: 'sheet', file: v.file, frameWidth: v.frameWidth, frameHeight: v.frameHeight, ...common };
    if (v.frames !== undefined) entry.frames = v.frames as number;
    return entry;
  }
  if (v.type === 'atlas') {
    if (!isSafePath(v.data)) return '`data` phải là đường dẫn tương đối không rỗng tới file JSON trong sprites/';
    if (v.prefix !== undefined && typeof v.prefix !== 'string') return '`prefix` phải là chuỗi';
    const entry: ManifestEntry = { type: 'atlas', file: v.file, data: v.data, ...common };
    if (v.prefix !== undefined) entry.prefix = v.prefix as string;
    return entry;
  }
  return '`type` phải là "sheet" hoặc "atlas"';
};

/** Không bao giờ ném lỗi. Mục sai bị bỏ kèm cảnh báo; game rơi về hình khối cho khóa đó. */
export function parseManifest(raw: unknown): { entries: Partial<Record<VisualKey, ManifestEntry>>; warnings: string[] } {
  const entries: Partial<Record<VisualKey, ManifestEntry>> = {};
  const warnings: string[] = [];
  try {
    if (!isRecord(raw)) {
      warnings.push('manifest phải là một object JSON; bỏ qua toàn bộ');
      return { entries, warnings };
    }
    for (const key of Object.keys(raw)) {
      try {
        if (!KEY_SET.has(key)) {
          warnings.push(`khóa "${key}" không hợp lệ, bỏ qua`);
          continue;
        }
        const res = parseEntry(key, raw[key]);
        if (typeof res === 'string') warnings.push(`"${key}": ${res}; bỏ qua`);
        else entries[key as VisualKey] = res;
      } catch (e) {
        warnings.push(`"${key}": không đọc được (${e instanceof Error ? e.message : String(e)}); bỏ qua`);
      }
    }
  } catch (e) {
    warnings.push(`manifest không đọc được (${e instanceof Error ? e.message : String(e)})`);
  }
  return { entries, warnings };
}
