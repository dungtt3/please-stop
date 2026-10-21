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

const seg = '[^.]+';
const rx = (...ps: string[]): RegExp[] => ps.map((p) => new RegExp(`^${p.replace(/\*/g, seg).replace(/\./g, '\.')}$`));

/** Hand UI chỉ có 5 ô thẻ. */
const MAX_HAND_LIMIT = 5;

/** Phải > 0 (chia cho nó, hoặc là nhịp/tốc độ/thời gian làm game đứng nếu bằng 0). */
const POSITIVE = rx(
  'enemies.*.speed', 'enemies.*.hp', 'enemyScaling.hpGrowth', 'classes.*.base.attackSpeed', 'classes.*.base.range',
  'quiz.timeLimit', 'waves.groups.interval', 'skills.summoner.minionAttackRate', 'skills.summoner.passiveEvery',
  'skills.*.cooldown', 'economy.attackSpeedPerLevel', 'economy.luckCost.base',
  'modifiers.*.speedMult', 'modifiers.*.damageTakenMult',
);
/** Số nguyên >= 1. */
const INT_MIN1 = rx(
  'waves.groups.count', 'economy.startHp', 'economy.handLimit', 'economy.maxLevel', 'economy.totalWaves', 'skills.summoner.waveCount',
  'skills.swordsman.comboEvery', 'skills.archer.rainArrows', 'map.cols', 'map.rows',
);
/** Số nguyên >= 0 (0 có nghĩa: tắt). */
const INT_MIN0 = rx('economy.maxLuck', 'skills.summoner.maxMinions', 'economy.rangeCardCap');

function numberRuleError(path: string, n: number): string | null {
  const np = stripIndices(path);
  if (POSITIVE.some((r) => r.test(np)) && !(n > 0)) return `${path}: phải lớn hơn 0`;
  if (INT_MIN1.some((r) => r.test(np)) && !(Number.isInteger(n) && n >= 1)) return `${path}: phải là số nguyên ≥ 1`;
  if (INT_MIN0.some((r) => r.test(np)) && !(Number.isInteger(n) && n >= 0)) return `${path}: phải là số nguyên ≥ 0`;
  if (np === 'economy.handLimit' && n > MAX_HAND_LIMIT) return `${path}: phải là số nguyên từ 1 đến ${MAX_HAND_LIMIT}`;
  if (/^enemies\.[^.]+\.armor$/.test(np) && !(n >= 0 && n < 1)) return `${path}: phải trong khoảng [0, 1)`;
  return null;
}

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
    const rule = numberRuleError(path, input);
    if (rule) {
      errors.push(rule);
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
  if (cfg.economy.maxLevel > cfg.levelDamage.length) {
    errors.push(`economy.maxLevel: không được lớn hơn số phần tử levelDamage (${cfg.levelDamage.length})`);
    cfg.economy.maxLevel = base.economy.maxLevel;
  }
  if (cfg.skillCooldownPerLevel * (cfg.economy.maxLevel - 1) >= 1) {
    errors.push('skillCooldownPerLevel: × (economy.maxLevel − 1) phải nhỏ hơn 1 (hồi chiêu không được về 0)');
    cfg.skillCooldownPerLevel = base.skillCooldownPerLevel;
  }
  const bands = cfg.quiz.bands;
  const bandIssues: string[] = [];
  if (bands.length < 1) bandIssues.push('quiz.bands: phải có ít nhất 1 mốc');
  bands.forEach((b, i) => {
    if (b.ops.length < 1) bandIssues.push(`quiz.bands.${i}.ops: phải có ít nhất 1 phép tính`);
    if ((b.ops.includes('*') || b.ops.includes('/')) && b.mulMax < 2) bandIssues.push(`quiz.bands.${i}.mulMax: phải ≥ 2 khi dùng phép × hoặc ÷`);
  });
  if (bandIssues.length) {
    errors.push(...bandIssues);
    cfg.quiz.bands = structuredClone(base.quiz.bands);
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

export function importConfig(text: string, base: GameConfig = DEFAULT_CONFIG): { config: GameConfig; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { config: structuredClone(base), errors: ['File không phải JSON hợp lệ'] };
  }
  return mergeConfig(base, parsed);
}
