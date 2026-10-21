import { pathLength, positionAt, pathTiles, distanceOfTile, validateMap } from '../../src/sim/path';
import { DEFAULT_MAP } from '../../src/config/map';

const L = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }];
test('pathLength cộng các đoạn', () => expect(pathLength(L)).toBe(5));
test('positionAt nội suy theo tâm ô', () => {
  expect(positionAt(L, 0)).toEqual({ x: 0.5, y: 0.5 });
  expect(positionAt(L, 4)).toEqual({ x: 3.5, y: 1.5 });
  expect(positionAt(L, 99)).toEqual({ x: 3.5, y: 2.5 });
});
test('pathTiles liệt kê đủ ô', () => expect(pathTiles(L)).toHaveLength(6));
test('distanceOfTile', () => expect(distanceOfTile(L, { x: 3, y: 1 })).toBe(4));
test('DEFAULT_MAP hợp lệ, 15 slot, mỗi slot kề (8 hướng) ít nhất một ô đường', () => {
  expect(validateMap(DEFAULT_MAP)).toEqual([]);
  expect(DEFAULT_MAP.slots).toHaveLength(15);
});
test('validateMap bắt slot nằm trên đường và đoạn chéo', () => {
  expect(validateMap({ cols: 5, rows: 5, path: [{ x: 0, y: 0 }, { x: 2, y: 2 }], slots: [{ x: 0, y: 0 }] }).length).toBeGreaterThanOrEqual(2);
});
