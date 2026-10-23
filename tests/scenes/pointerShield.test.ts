import { PointerShield } from '../../src/scenes/PointerShield';

test('chạm đã đổi trạng thái UI bị bỏ qua đúng một lần', () => {
  const s = new PointerShield();
  expect(s.consume()).toBe(false);
  s.arm();
  expect(s.consume()).toBe(true);
  expect(s.consume()).toBe(false);
});

test('reset hạ cờ nếu không có pointerdown của scene theo sau', () => {
  const s = new PointerShield();
  s.arm();
  s.reset();
  expect(s.consume()).toBe(false);
});
