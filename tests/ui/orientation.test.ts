import { describe, expect, it } from 'vitest';
import {
  blurActiveInput,
  getOrientation,
  installOrientationOverlay,
  onOrientation,
  shouldBlock,
  soundSuspended,
  type OrientationCtx,
} from '../../src/ui/orientation';

describe('shouldBlock', () => {
  it('blocks a portrait touch phone', () => {
    expect(shouldBlock({ w: 390, h: 844, coarse: true })).toBe(true);
  });
  it('does not block a landscape phone', () => {
    expect(shouldBlock({ w: 844, h: 390, coarse: true })).toBe(false);
  });
  it('does not block a portrait tablet (768x1024)', () => {
    expect(shouldBlock({ w: 768, h: 1024, coarse: true })).toBe(false);
  });
  it('does not block a narrow desktop window (not coarse)', () => {
    expect(shouldBlock({ w: 400, h: 900, coarse: false })).toBe(false);
  });
  it('edge: min side 599 blocks, 600 does not; square does not', () => {
    expect(shouldBlock({ w: 599, h: 900, coarse: true })).toBe(true);
    expect(shouldBlock({ w: 600, h: 900, coarse: true })).toBe(false);
    expect(shouldBlock({ w: 500, h: 500, coarse: true })).toBe(false);
  });
});

const idle: OrientationCtx = { popupOpen: false, quizOpen: false, resultOpen: false, halted: false };
const ctx = (o: Partial<OrientationCtx> = {}): OrientationCtx => ({ ...idle, ...o });

describe('onOrientation', () => {
  it('blocking freezes the run and cancels in-flight input, in every state', () => {
    for (const o of [{}, { popupOpen: true }, { quizOpen: true }, { resultOpen: true }, { halted: true }]) {
      expect(onOrientation(true, ctx(o))).toEqual({ blocked: true, cancelInput: true, openPopup: false });
    }
  });
  it('rotating back during play opens the pause popup', () => {
    expect(onOrientation(false, idle)).toEqual({ blocked: false, cancelInput: false, openPopup: true });
  });
  it('rotating back with the popup already open, a quiz, the result screen or a halted run only clears the flag', () => {
    for (const o of [{ popupOpen: true }, { quizOpen: true }, { resultOpen: true }, { halted: true }]) {
      expect(onOrientation(false, ctx(o))).toEqual({ blocked: false, cancelInput: false, openPopup: false });
    }
  });
});

describe('soundSuspended', () => {
  const s = (o: Partial<{ popupOpen: boolean; orientationBlocked: boolean; hidden: boolean }> = {}) =>
    soundSuspended({ popupOpen: false, orientationBlocked: false, hidden: false, ...o });
  it('is off only when nothing suspends it', () => {
    expect(s()).toBe(false);
  });
  it('stays suspended while any one reason remains', () => {
    expect(s({ popupOpen: true })).toBe(true);
    expect(s({ orientationBlocked: true })).toBe(true);
    expect(s({ hidden: true })).toBe(true);
    // Xoay lại nhưng popup còn mở / tab còn ẩn: không được bật lại.
    expect(s({ popupOpen: true, orientationBlocked: false })).toBe(true);
    expect(s({ hidden: true, orientationBlocked: false })).toBe(true);
  });
});

describe('without a window', () => {
  it('installer is a safe no-op and the default controller never blocks', () => {
    const c = installOrientationOverlay(undefined);
    expect(c.blocked()).toBe(false);
    expect(getOrientation().blocked()).toBe(false);
    expect(() => c.onChange(() => undefined)()).not.toThrow();
  });
});

describe('blurActiveInput', () => {
  it('blurs an input but leaves other elements and missing docs alone', () => {
    let blurred = 0;
    blurActiveInput({ activeElement: { tagName: 'INPUT', blur: () => { blurred++; } } });
    expect(blurred).toBe(1);
    blurActiveInput({ activeElement: { tagName: 'BUTTON', blur: () => { blurred++; } } });
    blurActiveInput({ activeElement: null });
    blurActiveInput(undefined);
    expect(blurred).toBe(1);
    expect(() => blurActiveInput({ activeElement: { tagName: 'INPUT', blur: () => { throw new Error('x'); } } })).not.toThrow();
  });
});

describe('overlay with a fake window', () => {
  function fakeWin(w: number, h: number, activeTag = 'INPUT') {
    const els: Array<{ id: string; dataset: Record<string, string>; [k: string]: unknown }> = [];
    let blurs = 0;
    const handlers: Record<string, Array<() => void>> = {};
    const mk = () => ({
      id: '', dataset: {} as Record<string, string>, textContent: '', innerHTML: '',
      setAttribute: () => undefined, remove: () => undefined,
    });
    const doc = {
      head: { appendChild: () => undefined },
      body: { appendChild: (e: (typeof els)[number]) => { els.push(e); } },
      createElement: () => mk(),
      activeElement: { tagName: activeTag, blur: () => { blurs++; } },
    };
    const win = {
      document: doc, innerWidth: w, innerHeight: h,
      matchMedia: () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }),
      addEventListener: (t: string, f: () => void) => { (handlers[t] ??= []).push(f); },
      removeEventListener: () => undefined,
    };
    return {
      win: win as unknown as Window, els, blurs: () => blurs,
      resize: (nw: number, nh: number) => { win.innerWidth = nw; win.innerHeight = nh; for (const f of handlers.resize ?? []) f(); },
    };
  }

  it('sets the calm flag from the motion setting and blurs the focused input when it blocks', () => {
    const f = fakeWin(844, 390);
    const ctl = installOrientationOverlay(f.win, () => true);
    const overlay = f.els.find((e) => e.id === 'orientation-overlay')!;
    expect(overlay.dataset.on).toBe('0');
    expect(f.blurs()).toBe(0);
    f.resize(390, 844);
    expect(overlay.dataset.on).toBe('1');
    expect(overlay.dataset.calm).toBe('1');
    expect(f.blurs()).toBe(1);
    ctl.dispose();
  });

  it('calm flag is off when motion is not reduced, and the setting is re-read each time it shows', () => {
    const f = fakeWin(844, 390);
    let reduced = false;
    const ctl = installOrientationOverlay(f.win, () => reduced);
    const overlay = f.els.find((e) => e.id === 'orientation-overlay')!;
    f.resize(390, 844);
    expect(overlay.dataset.calm).toBe('0');
    f.resize(844, 390);
    reduced = true;
    f.resize(390, 844);
    expect(overlay.dataset.calm).toBe('1');
    ctl.dispose();
  });
});
