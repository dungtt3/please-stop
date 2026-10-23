import { describe, expect, test } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config';
import {
  MAX_PRESETS,
  applyPreset,
  formatSavedAt,
  isDraftDirty,
  normalizeName,
  parsePresetRows,
  planSave,
  presetErrorMessage,
  removePreset,
  sortPresets,
  upsertPreset,
  validateName,
  type PresetRow,
} from '../../src/admin/presets';

const row = (name: string, savedAt: string): PresetRow => ({ name, config: {}, savedAt });

describe('normalizeName / validateName', () => {
  test('cắt hai đầu và gom khoảng trắng bên trong', () => {
    expect(normalizeName('  Dễ   hơn \t một\nchút  ')).toBe('Dễ hơn một chút');
  });
  test('rỗng hoặc chỉ khoảng trắng → không hợp lệ', () => {
    expect(validateName('')).toEqual({ ok: false });
    expect(validateName('   \t ')).toEqual({ ok: false });
  });
  test('1 và 40 ký tự hợp lệ, 41 thì không (sau khi chuẩn hóa)', () => {
    expect(validateName('a')).toEqual({ ok: true, name: 'a' });
    expect(validateName('x'.repeat(40))).toEqual({ ok: true, name: 'x'.repeat(40) });
    expect(validateName('x'.repeat(41))).toEqual({ ok: false });
    // 40 ký tự + khoảng trắng thừa vẫn hợp lệ; độ dài tính sau khi gom khoảng trắng
    expect(validateName(`  ${'x'.repeat(20)}   ${'y'.repeat(19)}  `)).toEqual({ ok: true, name: `${'x'.repeat(20)} ${'y'.repeat(19)}` });
  });
  test('đếm theo ký tự (không phải đơn vị UTF-16)', () => {
    expect(validateName('😀'.repeat(40)).ok).toBe(true);
    expect(validateName('😀'.repeat(41)).ok).toBe(false);
  });
});

describe('sortPresets', () => {
  test('mới nhất trước, không đổi mảng gốc', () => {
    const l = [row('a', '2026-10-01T00:00:00Z'), row('b', '2026-10-03T00:00:00Z'), row('c', '2026-10-02T00:00:00Z')];
    expect(sortPresets(l).map((p) => p.name)).toEqual(['b', 'c', 'a']);
    expect(l.map((p) => p.name)).toEqual(['a', 'b', 'c']);
  });
  test('ngày hỏng xuống cuối', () => {
    const l = [row('bad', 'zzz'), row('ok', '2026-10-01T00:00:00Z')];
    expect(sortPresets(l).map((p) => p.name)).toEqual(['ok', 'bad']);
  });
});

describe('planSave', () => {
  const list = [row('Khó', '2026-10-01T00:00:00Z')];
  test('tên mới → new', () => expect(planSave(list, 'Dễ')).toBe('new'));
  test('trùng tên không phân biệt hoa thường → overwrite', () => expect(planSave(list, 'KHÓ')).toBe('overwrite'));
  test('đủ 50 bộ: tên mới → full, tên trùng vẫn được ghi đè', () => {
    const full = Array.from({ length: MAX_PRESETS }, (_, i) => row(`p${i}`, '2026-10-01T00:00:00Z'));
    expect(planSave(full, 'mới')).toBe('full');
    expect(planSave(full, 'P7')).toBe('overwrite');
    expect(planSave(full.slice(1), 'mới')).toBe('new');
  });
});

describe('upsertPreset / removePreset', () => {
  test('ghi đè thay bản cũ (đổi cả kiểu chữ của tên) và sắp lại mới nhất trước', () => {
    const l = [row('a', '2026-10-01T00:00:00Z'), row('Khó', '2026-10-02T00:00:00Z')];
    const out = upsertPreset(l, row('KHÓ', '2026-10-05T00:00:00Z'));
    expect(out.map((p) => p.name)).toEqual(['KHÓ', 'a']);
    expect(l[1].name).toBe('Khó');
  });
  test('thêm mới', () => {
    expect(upsertPreset([row('a', '2026-10-01T00:00:00Z')], row('b', '2026-10-02T00:00:00Z')).map((p) => p.name)).toEqual(['b', 'a']);
  });
  test('xóa theo tên không phân biệt hoa thường', () => {
    expect(removePreset([row('Khó', '2026-10-01T00:00:00Z'), row('a', '2026-10-01T00:00:00Z')], 'khó').map((p) => p.name)).toEqual(['a']);
  });
});

describe('isDraftDirty', () => {
  test('giống nhau → false, đổi một trường → true (không phụ thuộc thứ tự tham chiếu)', () => {
    const a = structuredClone(DEFAULT_CONFIG);
    expect(isDraftDirty(a, structuredClone(DEFAULT_CONFIG))).toBe(false);
    a.economy.startGold += 1;
    expect(isDraftDirty(a, DEFAULT_CONFIG)).toBe(true);
  });
});

describe('formatSavedAt', () => {
  test('dd/MM HH:mm theo giờ máy', () => {
    const d = new Date(2026, 9, 5, 7, 3);
    expect(formatSavedAt(d.toISOString())).toBe('05/10 07:03');
  });
  test('ngày hỏng → chuỗi rỗng', () => expect(formatSavedAt('zzz')).toBe(''));
});

describe('presetErrorMessage', () => {
  test('chuỗi đúng theo yêu cầu', () => {
    expect(presetErrorMessage('network')).toBe('Không kết nối được');
    expect(presetErrorMessage('code')).toBe('Sai mã quản trị');
    expect(presetErrorMessage('full')).toBe('Đã đủ 50 bộ — xóa bớt trước khi lưu bộ mới');
  });
});

describe('applyPreset', () => {
  test('bộ hợp lệ → cấu hình gộp, không lỗi', () => {
    const c = structuredClone(DEFAULT_CONFIG);
    c.economy.startGold = 777;
    const r = applyPreset(c);
    expect(r.config.economy.startGold).toBe(777);
    expect(r.errors).toEqual([]);
  });
  test('thiếu trường → lấy mặc định; trường sai → mặc định và có lỗi', () => {
    const r = applyPreset({ economy: { startGold: 'abc', startHp: 33 } });
    expect(r.config.economy.startHp).toBe(33);
    expect(r.config.economy.startGold).toBe(DEFAULT_CONFIG.economy.startGold);
    expect(r.errors.length).toBe(1);
    expect(r.config.waves).toEqual(DEFAULT_CONFIG.waves);
  });
  test('không phải object → toàn bộ mặc định + lỗi', () => {
    const r = applyPreset(42);
    expect(r.config).toEqual(DEFAULT_CONFIG);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe('parsePresetRows', () => {
  test('dòng rpc → PresetRow, bỏ dòng hỏng', () => {
    const out = parsePresetRows([
      { name: 'a', config: { x: 1 }, saved_at: '2026-10-01T00:00:00Z' },
      { name: 5, config: {}, saved_at: 'x' },
      null,
      { name: 'b', config: {}, saved_at: '2026-10-02T00:00:00Z' },
    ]);
    expect(out).toEqual([
      { name: 'b', config: {}, savedAt: '2026-10-02T00:00:00Z' },
      { name: 'a', config: { x: 1 }, savedAt: '2026-10-01T00:00:00Z' },
    ]);
  });
  test('không phải mảng → null', () => {
    expect(parsePresetRows(null)).toBeNull();
    expect(parsePresetRows({})).toBeNull();
  });
});
