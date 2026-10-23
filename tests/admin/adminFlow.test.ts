import { describe, expect, test, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config';
import { reloadAdmin, unlockAdmin } from '../../src/admin/adminFlow';
import type { CloudConfigFetch } from '../../src/net/cloud';

const mk = (check: 'ok' | 'wrong' | 'offline', f: CloudConfigFetch) => ({
  check: vi.fn(async () => check),
  fetch: vi.fn(async () => f),
});
const withGold = (n: number) => {
  const c = structuredClone(DEFAULT_CONFIG);
  c.economy.startGold = n;
  return c;
};

describe('unlockAdmin', () => {
  test('sai mã → cổng báo wrong, không tải cấu hình', async () => {
    const d = mk('wrong', { kind: 'empty' });
    expect(await unlockAdmin('x', d)).toEqual({ kind: 'gate', error: 'wrong' });
    expect(d.fetch).not.toHaveBeenCalled();
  });
  test('offline → cổng báo offline', async () => {
    const d = mk('offline', { kind: 'empty' });
    expect(await unlockAdmin('x', d)).toEqual({ kind: 'gate', error: 'offline' });
    expect(d.fetch).not.toHaveBeenCalled();
  });
  test('đúng mã + tải lỗi → loadError, fetch gọi đúng 1 lần', async () => {
    const d = mk('ok', { kind: 'error' });
    expect(await unlockAdmin('x', d)).toEqual({ kind: 'loadError' });
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });
  test('đúng mã + cloud trống → menu từ mặc định + ghi chú', async () => {
    const v = await unlockAdmin('x', mk('ok', { kind: 'empty' }));
    expect(v).toEqual({
      kind: 'menu',
      config: DEFAULT_CONFIG,
      cloudConfig: null,
      updatedAt: null,
      note: 'Cloud chưa có cấu hình — đang hiện giá trị mặc định',
    });
  });
  test('đúng mã + cloud có cấu hình → menu với cấu hình cloud', async () => {
    const v = await unlockAdmin('x', mk('ok', { kind: 'ok', config: withGold(321), updatedAt: '2026-10-23T10:00:00Z' }));
    expect(v.kind).toBe('menu');
    if (v.kind !== 'menu') return;
    expect(v.config.economy.startGold).toBe(321);
    expect(v.cloudConfig).toEqual(v.config);
    expect(v.updatedAt).toBe('2026-10-23T10:00:00Z');
    expect(v.note).toBeNull();
  });
  test('cloud có trường lỗi → gộp với mặc định, note nêu số lỗi', async () => {
    const bad = structuredClone(DEFAULT_CONFIG) as unknown as { economy: { startGold: unknown; startHp: number } };
    bad.economy.startGold = 'abc';
    bad.economy.startHp = 33;
    const v = await unlockAdmin('x', mk('ok', { kind: 'ok', config: bad, updatedAt: 't' }));
    expect(v.kind).toBe('menu');
    if (v.kind !== 'menu') return;
    expect(v.config.economy.startGold).toBe(DEFAULT_CONFIG.economy.startGold);
    expect(v.config.economy.startHp).toBe(33);
    expect(v.note).toMatch(/\d+ trường/);
  });
});

describe('reloadAdmin', () => {
  test('lỗi → loadError', async () => {
    expect(await reloadAdmin({ fetch: async () => ({ kind: 'error' }) })).toEqual({ kind: 'loadError' });
  });
  test('thành công → menu', async () => {
    const v = await reloadAdmin({ fetch: async () => ({ kind: 'empty' }) });
    expect(v.kind).toBe('menu');
  });
});
