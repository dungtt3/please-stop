import { createRng } from '../../src/sim/rng';

test('cùng seed cho cùng dãy', () => {
  const a = createRng(42), b = createRng(42);
  expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
});
test('int nằm trong khoảng, bao gồm 2 đầu', () => {
  const r = createRng(1); const seen = new Set<number>();
  for (let i = 0; i < 1000; i++) seen.add(r.int(1, 3));
  expect([...seen].sort()).toEqual([1, 2, 3]);
});
