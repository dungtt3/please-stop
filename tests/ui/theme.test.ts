import { afterEach, describe, expect, it, vi } from 'vitest';
import { FONT, MONO_FONT, textStyle } from '../../src/ui/theme';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('textStyle', () => {
  it('maps size to fontSize in px and uses the UI font', () => {
    const s = textStyle({ size: 22 });
    expect(s.fontSize).toBe('22px');
    expect(s.fontFamily).toBe(FONT);
  });

  it('uses a monospace font when mono is set', () => {
    const s = textStyle({ size: 18, mono: true });
    expect(s.fontFamily).toBe(MONO_FONT);
    expect(String(s.fontFamily)).toContain('monospace');
  });

  it('is safe without window (resolution 1)', () => {
    vi.stubGlobal('window', undefined);
    expect(textStyle({ size: 22 }).resolution).toBe(1);
  });

  it('clamps resolution to [1, 2]', () => {
    vi.stubGlobal('window', { devicePixelRatio: 3 });
    expect(textStyle({ size: 22 }).resolution).toBe(2);
    vi.stubGlobal('window', { devicePixelRatio: 0.5 });
    expect(textStyle({ size: 22 }).resolution).toBe(1);
    vi.stubGlobal('window', { devicePixelRatio: 1.5 });
    expect(textStyle({ size: 22 }).resolution).toBe(1.5);
  });

  it('maps bold, color, align, wrap and stroke', () => {
    const s = textStyle({ size: 20, color: '#fff', bold: true, align: 'center', wrap: 200, stroke: { color: '#000', width: 3 } });
    expect(s.color).toBe('#fff');
    expect(s.fontStyle).toBe('bold');
    expect(s.align).toBe('center');
    expect(s.wordWrap).toEqual({ width: 200 });
    expect(s.stroke).toBe('#000');
    expect(s.strokeThickness).toBe(3);
  });

  it('omits optional fields when not given', () => {
    const s = textStyle({ size: 20 });
    expect(s.fontStyle).toBeUndefined();
    expect(s.wordWrap).toBeUndefined();
    expect(s.stroke).toBeUndefined();
  });

  it('passes through extra style fields', () => {
    const s = textStyle({ size: 20, extra: { lineSpacing: 4, backgroundColor: '#000' } });
    expect(s.lineSpacing).toBe(4);
    expect(s.backgroundColor).toBe('#000');
  });
});
