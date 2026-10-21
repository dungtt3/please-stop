import type { Vec } from './types';

export interface MapDef {
  cols: number;
  rows: number;
  /** Waypoint theo chỉ số ô; các đoạn nối là đoạn thẳng theo trục. */
  path: Vec[];
  /** Ô đặt đơn vị, theo chỉ số ô. */
  slots: Vec[];
}

export function tileCenter(t: Vec): Vec {
  return { x: t.x + 0.5, y: t.y + 0.5 };
}

const segLen = (a: Vec, b: Vec): number => Math.abs(b.x - a.x) + Math.abs(b.y - a.y);

export function pathLength(path: Vec[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += segLen(path[i - 1], path[i]);
  return total;
}

export function positionAt(path: Vec[], distance: number): Vec {
  if (path.length === 0) return { x: 0.5, y: 0.5 };
  let d = Math.min(Math.max(distance, 0), pathLength(path));
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const len = segLen(a, b);
    if (d <= len || i === path.length - 1) {
      const f = len === 0 ? 0 : Math.min(d / len, 1);
      return tileCenter({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
    }
    d -= len;
  }
  return tileCenter(path[0]);
}

/** Mọi ô đường đi theo thứ tự (góc cua không bị lặp). */
export function pathTiles(path: Vec[]): Vec[] {
  if (path.length === 0) return [];
  const tiles: Vec[] = [{ ...path[0] }];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
    const n = segLen(a, b);
    for (let k = 1; k <= n; k++) tiles.push({ x: a.x + dx * k, y: a.y + dy * k });
  }
  return tiles;
}

/** Khoảng cách dọc đường tới tâm ô; -1 nếu ô không nằm trên đường. */
export function distanceOfTile(path: Vec[], tile: Vec): number {
  const tiles = pathTiles(path);
  return tiles.findIndex((t) => t.x === tile.x && t.y === tile.y);
}

export function validateMap(map: MapDef): string[] {
  const errors: string[] = [];
  const inGrid = (t: Vec): boolean =>
    Number.isInteger(t.x) && Number.isInteger(t.y) && t.x >= 0 && t.y >= 0 && t.x < map.cols && t.y < map.rows;

  if (map.path.length < 2) errors.push('đường có ít hơn 2 điểm');
  map.path.forEach((p, i) => {
    if (!inGrid(p)) errors.push(`điểm đường ${i} (${p.x},${p.y}) ngoài lưới`);
  });
  for (let i = 1; i < map.path.length; i++) {
    const a = map.path[i - 1], b = map.path[i];
    if (a.x !== b.x && a.y !== b.y) errors.push(`đoạn ${i - 1}-${i} không thẳng trục`);
  }

  const axisOk = map.path.every((p, i) => i === 0 || p.x === map.path[i - 1].x || p.y === map.path[i - 1].y);
  const onPath = new Set<string>();
  if (axisOk && map.path.every(inGrid)) for (const t of pathTiles(map.path)) onPath.add(`${t.x},${t.y}`);

  const seen = new Set<string>();
  map.slots.forEach((s, i) => {
    const key = `${s.x},${s.y}`;
    if (!inGrid(s)) {
      errors.push(`slot ${i} (${key}) ngoài lưới`);
      return;
    }
    if (seen.has(key)) errors.push(`slot ${i} (${key}) trùng nhau`);
    seen.add(key);
    if (onPath.has(key)) errors.push(`slot ${i} (${key}) nằm trên đường`);
    let adjacent = false;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        if ((dx || dy) && onPath.has(`${s.x + dx},${s.y + dy}`)) adjacent = true;
    if (!adjacent) errors.push(`slot ${i} (${key}) không kề ô đường nào`);
  });
  return errors;
}
