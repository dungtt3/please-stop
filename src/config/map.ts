import type { MapDef } from '../sim/path';

/** Đường vào từ mép trái, ra mép phải, 4 khúc cua. */
export const DEFAULT_MAP: MapDef = {
  cols: 16,
  rows: 9,
  path: [
    { x: 0, y: 1 },
    { x: 13, y: 1 },
    { x: 13, y: 4 },
    { x: 2, y: 4 },
    { x: 2, y: 7 },
    { x: 15, y: 7 },
  ],
  slots: [
    { x: 3, y: 2 }, { x: 6, y: 2 }, { x: 9, y: 2 }, { x: 12, y: 2 },
    { x: 5, y: 3 }, { x: 8, y: 3 }, { x: 11, y: 3 },
    { x: 1, y: 5 }, { x: 4, y: 5 }, { x: 7, y: 5 }, { x: 10, y: 5 }, { x: 13, y: 5 },
    { x: 5, y: 6 }, { x: 9, y: 6 }, { x: 12, y: 6 },
  ],
};
