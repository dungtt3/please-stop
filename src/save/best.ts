import type { KeyValueStore } from '../settings/configStore';

/** Kỷ lục cá nhân lưu ở máy (spec mục 7, 12.5). Mọi đọc/ghi bọc try/catch; hỏng → coi như chưa có. */
export const BEST_KEY = 'ps.best';

export interface Best {
  wave: number;
  kills: number;
  won: boolean;
}

/** Cùng giới hạn với `recordRun` (ps_runs). */
const MAX_WAVE = 100;
const MAX_KILLS = 1_000_000;

const isCount = (v: unknown, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;

function parseBest(v: unknown): Best | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (!isCount(o.wave, MAX_WAVE) || !isCount(o.kills, MAX_KILLS) || typeof o.won !== 'boolean') return null;
  return { wave: o.wave, kills: o.kills, won: o.won };
}

export function readBest(store: KeyValueStore | null): Best | null {
  if (!store) return null;
  try {
    const raw = store.getItem(BEST_KEY);
    return raw === null ? null : parseBest(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Thắng hơn thua → wave cao hơn → nhiều quái hơn. Bằng nhau thì không "tốt hơn". */
export function isBetter(a: Best, b: Best | null): boolean {
  if (!b) return true;
  if (a.won !== b.won) return a.won;
  if (a.wave !== b.wave) return a.wave > b.wave;
  return a.kills > b.kills;
}

/** Đọc kỷ lục cũ trước, ghi sau, chỉ ghi khi tốt hơn. Không bao giờ ném. */
export function recordBest(store: KeyValueStore | null, run: Best): { previous: Best | null; isNew: boolean } {
  const previous = readBest(store);
  const clean = parseBest({ wave: Math.round(run.wave), kills: Math.round(run.kills), won: run.won });
  if (!clean || !isBetter(clean, previous)) return { previous, isNew: false };
  if (store) {
    try {
      store.setItem(BEST_KEY, JSON.stringify(clean));
    } catch {
      /* bỏ qua: kỷ lục là tiện ích, không được làm hỏng ván */
    }
  }
  return { previous, isNew: true };
}
