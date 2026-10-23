import { describe, expect, test } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config';
import { configHash } from '../../src/settings/configHash';
import { resolveConfig } from '../../src/settings/resolveConfig';
import { sanitizeName } from '../../src/settings/sanitizeName';

const withGold = (n: number) => { const c = structuredClone(DEFAULT_CONFIG); c.economy.startGold = n; return c; };

describe('configHash', () => {
  test('ổn định và phân biệt', () => {
    expect(configHash(DEFAULT_CONFIG)).toBe(configHash(structuredClone(DEFAULT_CONFIG)));
    expect(configHash(withGold(1))).not.toBe(configHash(DEFAULT_CONFIG));
    expect(configHash(DEFAULT_CONFIG)).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('resolveConfig', () => {
  test('cloud null → mặc định', () => {
    const r = resolveConfig({ cloud: null });
    expect(r.source).toBe('default');
    expect(r.config).toEqual(DEFAULT_CONFIG);
    expect(r.errors).toEqual([]);
  });
  test('cloud', () => {
    const r = resolveConfig({ cloud: withGold(321) });
    expect(r.source).toBe('cloud');
    expect(r.config.economy.startGold).toBe(321);
  });
  test('trường cloud sai → lỗi + mặc định cho trường đó', () => {
    const bad = structuredClone(DEFAULT_CONFIG) as unknown as { economy: { startGold: unknown; startHp: number } };
    bad.economy.startGold = 'abc';
    bad.economy.startHp = 33;
    const r = resolveConfig({ cloud: bad });
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

describe('resolveConfig với cloud rác', () => {
  test.each([[[]], [{ economy: null }], [{ waves: [null] }], ['str'], [42]])('không ném lỗi: %j', (junk) => {
    const r = resolveConfig({ cloud: junk });
    expect(r.config.economy.startGold).toBe(DEFAULT_CONFIG.economy.startGold);
    expect(r.config.waves.length).toBeGreaterThan(0);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(['cloud', 'default']).toContain(r.source);
  });
});
