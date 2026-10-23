// Cài đặt "Giảm chuyển động". Thuần: không import Phaser, an toàn khi không có window/localStorage.
import { browserStore, type KeyValueStore } from './configStore';

export const MOTION_KEY = 'ps.motion';
/** Tổng thời lượng tối đa của một hiệu ứng skill/trúng đích khi giảm chuyển động (ms). */
export const REDUCED_FX_MAX_MS = 200;
/** Khoảng cách tối thiểu giữa hai lần rung màn hình (ms). */
export const SHAKE_MIN_GAP_MS = 300;

/** Thời lượng hiệu ứng: giữ nguyên khi không giảm; khi giảm thì cắt ở `cap` (mặc định 200 ms). */
export function fxDuration(baseMs: number, reduced: boolean, cap: number = REDUCED_FX_MAX_MS): number {
  if (!reduced) return baseMs;
  return Math.max(1, Math.min(baseMs, cap));
}

function readChoice(store: KeyValueStore | null): boolean | null {
  try {
    const raw = store?.getItem(MOTION_KEY);
    if (!raw) return null;
    const j: unknown = JSON.parse(raw);
    if (typeof j !== 'object' || j === null) return null;
    const r = (j as { reduced?: unknown }).reduced;
    return typeof r === 'boolean' ? r : null;
  } catch {
    return null;
  }
}

export class MotionSettings {
  private choice: boolean | null;

  constructor(
    private readonly store: KeyValueStore | null,
    private readonly mediaReduced: () => boolean,
  ) {
    this.choice = readChoice(store);
  }

  /** Chưa có lựa chọn của người chơi → theo `prefers-reduced-motion` của máy (đọc mỗi lần). */
  get reduced(): boolean {
    if (this.choice !== null) return this.choice;
    try {
      return this.mediaReduced();
    } catch {
      return false;
    }
  }

  set(reduced: boolean): void {
    this.choice = reduced;
    try {
      this.store?.setItem(MOTION_KEY, JSON.stringify({ reduced }));
    } catch {
      // Không ghi được (chế độ riêng tư/đầy bộ nhớ): giữ lựa chọn trong phiên.
    }
  }
}

function systemPrefersReduced(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export const motion = new MotionSettings(browserStore(), systemPrefersReduced);

/** Cho rung khi cách lần rung trước ≥ 300 ms (đồng hồ lùi → coi là lần đầu). */
export class ShakeGate {
  private last: number | null = null;

  constructor(private readonly now: () => number) {}

  allow(): boolean {
    const t = this.now();
    if (this.last !== null && t >= this.last && t - this.last < SHAKE_MIN_GAP_MS) return false;
    this.last = t;
    return true;
  }
}
