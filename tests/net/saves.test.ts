import { parseCloudRow } from '../../src/net/saves';

const ROW = { run_id: 'r1', rev: 3, save: { a: 1 }, in_wave: true, device_id: 'dev-A', age_ms: 1500 };

test('parseCloudRow: dòng ps_get_save → CloudRow (age_ms của server)', () => {
  expect(parseCloudRow(ROW)).toEqual({ runId: 'r1', rev: 3, save: { a: 1 }, inWave: true, deviceId: 'dev-A', ageMs: 1500 });
  expect(parseCloudRow({ ...ROW, rev: '4', age_ms: '20' })).toMatchObject({ rev: 4, ageMs: 20 });
});

test('parseCloudRow: rev hoặc age_ms không phải số hữu hạn → error', () => {
  for (const bad of [{ rev: 'x' }, { age_ms: undefined }, { age_ms: 'abc' }, { age_ms: Infinity }]) {
    expect(parseCloudRow({ ...ROW, ...bad })).toBe('error');
  }
});
