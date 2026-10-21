import { describe, expect, test } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config';
import { STORAGE_KEY, loadSavedConfig } from '../../src/settings/configStore';
import { configHash } from '../../src/settings/configHash';
import { resolveConfig } from '../../src/settings/resolveConfig';
import { sanitizeName } from '../../src/settings/sanitizeName';

const mem = (init: Record<string, string> = {}) => {
  const m = new Map<string, string>(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const withGold = (n: number) => { const c = structuredClone(DEFAULT_CONFIG); c.economy.startGold = n; return c; };

describe('configHash', () => {
  test('ổn định và phân biệt', () => {
    expect(configHash(DEFAULT_CONFIG)).toBe(configHash(structuredClone(DEFAULT_CONFIG)));
    expect(configHash(withGold(1))).not.toBe(configHash(DEFAULT_CONFIG));
    expect(configHash(DEFAULT_CONFIG)).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('loadSavedConfig', () => {
  test('không có / hỏng / null → null', () => {
    expect(loadSavedConfig(mem())).toBeNull();
    expect(loadSavedConfig(null)).toBeNull();
    expect(loadSavedConfig(mem({ [STORAGE_KEY]: '{oops' }))).toBeNull();
  });
  test('có bản lưu → config', () => {
    const c = withGold(777);
    expect(loadSavedConfig(mem({ [STORAGE_KEY]: JSON.stringify(c) }))).toEqual(c);
  });
});

describe('resolveConfig', () => {
  test('mặc định', () => {
    const r = resolveConfig({ local: null, cloud: null });
    expect(r.source).toBe('default');
    expect(r.config).toEqual(DEFAULT_CONFIG);
    expect(r.errors).toEqual([]);
  });
  test('cloud', () => {
    const r = resolveConfig({ local: null, cloud: withGold(321) });
    expect(r.source).toBe('cloud');
    expect(r.config.economy.startGold).toBe(321);
  });
  test('local thắng cloud', () => {
    const r = resolveConfig({ local: withGold(5), cloud: withGold(321) });
    expect(r.source).toBe('local');
    expect(r.config.economy.startGold).toBe(5);
  });
  test('trường cloud sai → lỗi + mặc định cho trường đó', () => {
    const bad = structuredClone(DEFAULT_CONFIG) as unknown as { economy: { startGold: unknown; startHp: number } };
    bad.economy.startGold = 'abc';
    bad.economy.startHp = 33;
    const r = resolveConfig({ local: null, cloud: bad });
    expect(r.source).toBe('cloud');
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.config.economy.startGold).toBe(DEFAULT_CONFIG.economy.startGold);
    expect(r.config.economy.startHp).toBe(33);
  });
});

describe('sanitizeName', () => {
  test('trim, gộp khoảng trắng, tối đa 20', () => {
    expect(sanitizeName('  a   b \n c ')).toBe('a b c');
    expect(sanitizeName('x'.repeat(30))).toHaveLength(20);
    expect(sanitizeName('   ')).toBe('');
  });
});
