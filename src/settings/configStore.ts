import { DEFAULT_CONFIG, type GameConfig } from '../config';
import { validateMap } from '../sim/path';

export interface KeyValueStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export const STORAGE_KEY = 'merge-defense.config.v1';

const ENEMY_KINDS = ['normal', 'fast', 'tank', 'boss'] as const;
const QUIZ_OPS = ['+', '-', '*', '/'] as const;

/** Bỏ các đoạn là chỉ số mảng: "waves.3.groups.0.kind" -> "waves.groups.kind". */
export const stripIndices = (path: string): string => path.split('.').filter((s) => !/^\d+$/.test(s)).join('.');

/** Các giá trị hợp lệ nếu trường là chuỗi enum, ngược lại undefined. */
export function enumOptions(path: string): readonly string[] | undefined {
  const n = stripIndices(path);
  if (n === 'waves.groups.kind') return ENEMY_KINDS;
  if (n === 'quiz.bands.ops') return QUIZ_OPS;
  return undefined;
}

const FIXED_ARRAYS = [/^levelDamage$/, /^economy\.baseRarityWeights$/, /^economy\.luckStep$/, /^economy\.rarityBonus\.[^.]+$/];

/** Mảng có độ dài cố định (không cho thêm/xóa phần tử). */
export const isFixedArray = (path: string): boolean => FIXED_ARRAYS.some((re) => re.test(stripIndices(path)));

const join = (path: string, key: string | number): string => (path ? `${path}.${key}` : String(key));
const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function mergeNode(base: unknown, input: unknown, path: string, errors: string[]): unknown {
  if (typeof base === 'number') {
    if (typeof input !== 'number' || !Number.isFinite(input)) {
      errors.push(`${path}: phải là số`);
      return base;
    }
    if (input < 0 && stripIndices(path) !== 'economy.luckStep') {
      errors.push(`${path}: không được âm`);
      return base;
    }
    return input;
  }
  if (typeof base === 'string') {
    if (typeof input !== 'string') {
      errors.push(`${path}: phải là chuỗi`);
      return base;
    }
    const opts = enumOptions(path);
    if (opts && !opts.includes(input)) {
      errors.push(`${path}: giá trị không hợp lệ (chỉ nhận ${opts.join(', ')})`);
      return base;
    }
    return input;
  }
  if (Array.isArray(base)) {
    if (!Array.isArray(input)) {
      errors.push(`${path}: phải là mảng`);
      return structuredClone(base);
    }
    if (isFixedArray(path)) {
      if (input.length !== base.length) {
        errors.push(`${path}: phải có đúng ${base.length} phần tử`);
        return structuredClone(base);
      }
      return base.map((b, i) => mergeNode(b, input[i], join(path, i), errors));
    }
    return input.map((el, i) => {
      const tmpl = i < base.length ? base[i] : base[0];
      if (tmpl === undefined) {
        errors.push(`${join(path, i)}: không có mẫu để kiểm tra`);
        return el;
      }
      return mergeNode(tmpl, el, join(path, i), errors);
    });
  }
  if (isPlainObject(base)) {
    if (!isPlainObject(input)) {
      errors.push(`${path || 'config'}: phải là object`);
      return structuredClone(base);
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(base)) {
      out[key] = key in input ? mergeNode(base[key], input[key], join(path, key), errors) : structuredClone(base[key]);
    }
    return out;
  }
  return base;
}

/** Gộp `input` lên `base` theo hình dạng của base; giá trị sai giữ base và báo lỗi theo đường dẫn. */
export function mergeConfig(base: GameConfig, input: unknown): { config: GameConfig; errors: string[] } {
  const errors: string[] = [];
  const cfg = mergeNode(base, input, '', errors) as GameConfig;

  const w = cfg.economy.baseRarityWeights;
  if (!(w[0] + w[1] + w[2] > 0)) {
    errors.push('economy.baseRarityWeights: tổng trọng số phải lớn hơn 0');
    cfg.economy.baseRarityWeights = structuredClone(base.economy.baseRarityWeights);
  }
  if (cfg.waves.length < 1) {
    errors.push('waves: phải có ít nhất 1 wave');
    cfg.waves = structuredClone(base.waves);
  }
  if (cfg.waves.length < cfg.economy.totalWaves || cfg.economy.totalWaves < 1) {
    errors.push(
      `waves: số wave (${cfg.waves.length}) phải ≥ economy.totalWaves (${cfg.economy.totalWaves}) và totalWaves ≥ 1; dùng lại wave và tổng wave mặc định`,
    );
    cfg.waves = structuredClone(base.waves);
    cfg.economy.totalWaves = base.economy.totalWaves;
  }
  const mapErrors = validateMap(cfg.map);
  if (mapErrors.length) {
    for (const e of mapErrors) errors.push(`map: ${e}`);
    cfg.map = structuredClone(base.map);
  }
  return { config: cfg, errors };
}

export function loadConfig(store: KeyValueStore | null | undefined): GameConfig {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_CONFIG);
    return mergeConfig(DEFAULT_CONFIG, JSON.parse(raw)).config;
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

/** Trả false nếu không ghi được (vd. bị chặn lưu trữ). */
export function saveConfig(store: KeyValueStore | null | undefined, cfg: GameConfig): boolean {
  try {
    if (!store) return false;
    store.setItem(STORAGE_KEY, JSON.stringify(cfg));
    return true;
  } catch {
    return false;
  }
}

export function resetConfig(store: KeyValueStore | null | undefined): boolean {
  try {
    if (!store) return false;
    store.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** localStorage của trình duyệt, hoặc null nếu bị chặn. */
export function browserStore(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export const exportConfig = (cfg: GameConfig): string => JSON.stringify(cfg, null, 2);

export function importConfig(text: string): { config: GameConfig; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { config: structuredClone(DEFAULT_CONFIG), errors: ['File không phải JSON hợp lệ'] };
  }
  return mergeConfig(DEFAULT_CONFIG, parsed);
}
