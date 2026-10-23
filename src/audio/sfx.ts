// Âm thanh tổng hợp bằng Web Audio (oscillator + envelope), không dùng file. Không import Phaser.
// Mọi hàm công khai không bao giờ ném: thiếu AudioContext, bị chặn, constructor ném, store ném đều bị nuốt.
import { browserStore, type KeyValueStore } from '../settings/configStore';

export type SfxName = 'click' | 'summon' | 'merge' | 'hit' | 'crit' | 'kill' | 'bossKill' | 'leak' | 'waveStart' | 'waveEnd'
  | 'quizRight' | 'quizWrong' | 'skill.swordsman' | 'skill.archer' | 'skill.mage' | 'skill.summoner' | 'win' | 'lose';

export const SFX_THROTTLE_MS = 60;
export const SFX_MAX_VOICES = 8;
export const SOUND_KEY = 'ps.sound';

export interface SoundSettings { on: boolean; volume: number }

const DEFAULT_SETTINGS: SoundSettings = { on: true, volume: 0.6 };
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Interface tối thiểu của AudioContext để test bằng bản giả. */
export interface AudioParamLike {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
  exponentialRampToValueAtTime(v: number, t: number): unknown;
}
export interface OscillatorLike {
  type: string;
  frequency: AudioParamLike;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onended: ((ev: any) => void) | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connect(dest: any): unknown;
  start(when?: number): void;
  stop(when?: number): void;
}
export interface GainLike {
  gain: AudioParamLike;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connect(dest: any): unknown;
}
export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: unknown;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  resume(): Promise<void> | void;
  suspend(): Promise<void> | void;
}

export function loadSoundSettings(store: KeyValueStore | null): SoundSettings {
  try {
    const raw = store?.getItem(SOUND_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const j: unknown = JSON.parse(raw);
    if (typeof j !== 'object' || j === null) return { ...DEFAULT_SETTINGS };
    const o = j as { on?: unknown; volume?: unknown };
    return {
      on: typeof o.on === 'boolean' ? o.on : DEFAULT_SETTINGS.on,
      volume: typeof o.volume === 'number' && Number.isFinite(o.volume) ? clamp01(o.volume) : DEFAULT_SETTINGS.volume,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSoundSettings(store: KeyValueStore | null, s: SoundSettings): void {
  try {
    store?.setItem(SOUND_KEY, JSON.stringify({ on: s.on, volume: s.volume }));
  } catch {
    /* bị chặn lưu trữ: bỏ qua */
  }
}

/** Một nốt: bắt đầu sau `at` giây, dài `dur` giây, tần số f0 -> f1 (nếu có), đỉnh âm lượng `g`. at + dur <= 0.5. */
interface Tone { at: number; dur: number; type: OscillatorType; f0: number; f1?: number; g: number }
const T = (at: number, dur: number, type: OscillatorType, f0: number, f1: number | undefined, g: number): Tone => ({ at, dur, type, f0, f1, g });

const SOUNDS: Record<SfxName, Tone[]> = {
  click: [T(0, 0.05, 'triangle', 700, 500, 0.12)],
  summon: [T(0, 0.14, 'sine', 330, 660, 0.2), T(0.08, 0.16, 'triangle', 495, 880, 0.12)],
  merge: [T(0, 0.1, 'triangle', 440, undefined, 0.18), T(0.09, 0.1, 'triangle', 587, undefined, 0.18), T(0.18, 0.2, 'sine', 880, undefined, 0.2)],
  hit: [T(0, 0.04, 'square', 220, 160, 0.03)],
  crit: [T(0, 0.08, 'square', 600, 900, 0.1), T(0.05, 0.12, 'triangle', 900, 1200, 0.12)],
  kill: [T(0, 0.12, 'triangle', 500, 160, 0.16)],
  bossKill: [T(0, 0.3, 'sawtooth', 220, 55, 0.14), T(0.1, 0.35, 'sine', 330, 110, 0.18), T(0.25, 0.2, 'triangle', 660, 990, 0.12)],
  leak: [T(0, 0.2, 'sawtooth', 200, 90, 0.12), T(0.12, 0.2, 'square', 140, 70, 0.08)],
  waveStart: [T(0, 0.12, 'triangle', 392, undefined, 0.16), T(0.14, 0.2, 'triangle', 523, undefined, 0.18)],
  waveEnd: [T(0, 0.1, 'triangle', 523, undefined, 0.16), T(0.1, 0.1, 'triangle', 659, undefined, 0.16), T(0.2, 0.22, 'sine', 784, undefined, 0.18)],
  quizRight: [T(0, 0.09, 'sine', 660, undefined, 0.18), T(0.09, 0.16, 'sine', 990, undefined, 0.18)],
  quizWrong: [T(0, 0.12, 'square', 220, undefined, 0.1), T(0.12, 0.22, 'square', 165, undefined, 0.1)],
  'skill.swordsman': [T(0, 0.18, 'sawtooth', 900, 300, 0.1), T(0.02, 0.1, 'square', 1400, 700, 0.05)],
  'skill.archer': [T(0, 0.2, 'triangle', 1200, 400, 0.12), T(0.04, 0.1, 'sine', 1800, 900, 0.06)],
  'skill.mage': [T(0, 0.28, 'sine', 300, 900, 0.18), T(0.1, 0.25, 'triangle', 600, 1500, 0.1)],
  'skill.summoner': [T(0, 0.25, 'sine', 220, 440, 0.18), T(0.1, 0.25, 'triangle', 330, 660, 0.12), T(0.2, 0.2, 'sine', 880, undefined, 0.08)],
  win: [T(0, 0.12, 'triangle', 523, undefined, 0.18), T(0.12, 0.12, 'triangle', 659, undefined, 0.18), T(0.24, 0.12, 'triangle', 784, undefined, 0.18), T(0.36, 0.14, 'sine', 1047, undefined, 0.2)],
  lose: [T(0, 0.15, 'triangle', 392, undefined, 0.16), T(0.15, 0.15, 'triangle', 311, undefined, 0.16), T(0.3, 0.2, 'triangle', 233, undefined, 0.16)],
};

const ATTACK = 0.005;
const MIN_GAIN = 0.0001;
/** Dư thêm (ms) trước khi coi một voice không báo `onended` là đã chết. */
const VOICE_GRACE_MS = 300;

interface Voice { endsAt: number; pending: number }

export class Sfx {
  private readonly createContext: () => AudioContextLike | null;
  private readonly now: () => number;
  private readonly store: KeyValueStore | null;
  private cfg: SoundSettings;
  private ctx: AudioContextLike | null = null;
  private unlocked = false;
  private suspended = false;
  private readonly last = new Map<SfxName, number>();
  private readonly voices = new Set<Voice>();

  constructor(opts: { createContext?: () => AudioContextLike | null; now?: () => number; store?: KeyValueStore | null } = {}) {
    this.createContext = opts.createContext ?? (() => null);
    this.now = opts.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    this.store = opts.store ?? null;
    this.cfg = loadSoundSettings(this.store);
  }

  get settings(): SoundSettings { return { ...this.cfg }; }

  set(s: Partial<SoundSettings>): void {
    const next = { ...this.cfg };
    if (typeof s.on === 'boolean') next.on = s.on;
    if (typeof s.volume === 'number') next.volume = Number.isNaN(s.volume) ? next.volume : clamp01(s.volume);
    this.cfg = next;
    saveSoundSettings(this.store, next);
  }

  /** Gọi ở lần bấm đầu tiên: tạo/resume context nếu âm thanh đang bật. */
  unlock(): void {
    try {
      if (!this.cfg.on) return;
      if (!this.ctx) this.ctx = this.createContext();
      if (!this.ctx) return;
      this.unlocked = true;
      if (!this.suspended && this.ctx.state !== 'running') this.resumeCtx();
    } catch {
      /* không có âm thanh thì thôi */
    }
  }

  /** Popup mở / tab ẩn -> true; đóng -> false. */
  setSuspended(s: boolean): void {
    this.suspended = s;
    if (!this.ctx || !this.unlocked) return;
    if (s) {
      try {
        void Promise.resolve(this.ctx.suspend()).catch(() => {});
      } catch {
        /* bỏ qua */
      }
    } else {
      this.resumeCtx();
    }
  }

  play(name: SfxName): void {
    try {
      const ctx = this.ctx;
      if (!ctx || !this.unlocked || this.suspended || !this.cfg.on || this.cfg.volume <= 0) return;
      const tones = SOUNDS[name];
      if (!tones) return;
      const t = this.now();
      const prev = this.last.get(name);
      if (prev !== undefined && t - prev < SFX_THROTTLE_MS) return;
      for (const v of this.voices) if (t > v.endsAt) this.voices.delete(v);
      if (this.voices.size >= SFX_MAX_VOICES) return;

      const voice: Voice = { endsAt: t, pending: 0 };
      this.voices.add(voice);
      this.last.set(name, t);
      try {
        const t0 = ctx.currentTime;
        for (const tone of tones) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = t0 + tone.at;
          const end = start + tone.dur;
          osc.type = tone.type;
          osc.frequency.setValueAtTime(tone.f0, start);
          if (tone.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(tone.f1, end);
          const peak = Math.max(MIN_GAIN * 2, tone.g * this.cfg.volume);
          gain.gain.setValueAtTime(MIN_GAIN, start);
          gain.gain.linearRampToValueAtTime(peak, start + Math.min(ATTACK, tone.dur / 2));
          gain.gain.exponentialRampToValueAtTime(MIN_GAIN, end);
          osc.connect(gain);
          gain.connect(ctx.destination);
          voice.pending++;
          osc.onended = () => {
            if (--voice.pending <= 0) this.voices.delete(voice);
          };
          osc.start(start);
          osc.stop(end + 0.02);
          voice.endsAt = Math.max(voice.endsAt, t + (tone.at + tone.dur) * 1000 + VOICE_GRACE_MS);
        }
      } catch {
        // dựng nốt dở dang bị lỗi: không để voice kẹt
        if (voice.pending <= 0) this.voices.delete(voice);
        else voice.endsAt = t + VOICE_GRACE_MS;
      }
    } catch {
      /* không bao giờ ném */
    }
  }

  private resumeCtx(): void {
    try {
      void Promise.resolve(this.ctx?.resume()).catch(() => {});
    } catch {
      /* bỏ qua */
    }
  }
}

export const sfx = new Sfx({
  createContext: () => {
    try {
      if (typeof AudioContext === 'undefined') return null;
      return new AudioContext() as unknown as AudioContextLike;
    } catch {
      return null;
    }
  },
  store: browserStore(),
});
