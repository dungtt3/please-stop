import { describe, expect, test } from 'vitest';
import { BEST_KEY, isBetter, readBest, recordBest, type Best } from '../../src/save/best';
import type { KeyValueStore } from '../../src/settings/configStore';

function mem(init: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}
const throwing: KeyValueStore = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};
const b = (wave: number, kills: number, won = false): Best => ({ wave, kills, won });

describe('readBest', () => {
  test('missing, null store -> null', () => {
    expect(readBest(mem())).toBeNull();
    expect(readBest(null)).toBeNull();
  });
  test('valid value round-trips', () => {
    expect(readBest(mem({ [BEST_KEY]: JSON.stringify(b(7, 120, true)) }))).toEqual(b(7, 120, true));
  });
  test.each([
    ['not json', '{oops'],
    ['array', '[1,2]'],
    ['null', 'null'],
    ['string', '"x"'],
    ['missing field', '{"wave":3,"kills":4}'],
    ['wave string', '{"wave":"3","kills":4,"won":false}'],
    ['won number', '{"wave":3,"kills":4,"won":1}'],
    ['negative wave', '{"wave":-1,"kills":4,"won":false}'],
    ['fractional kills', '{"wave":3,"kills":4.5,"won":false}'],
    ['huge wave', '{"wave":1e9,"kills":4,"won":false}'],
    ['huge kills', '{"wave":3,"kills":1e12,"won":false}'],
  ])('corrupt (%s) -> null', (_n, raw) => {
    expect(readBest(mem({ [BEST_KEY]: raw }))).toBeNull();
  });
  test('throwing store -> null', () => {
    expect(readBest(throwing)).toBeNull();
  });
});

describe('isBetter', () => {
  test('no previous -> better', () => expect(isBetter(b(1, 0), null)).toBe(true));
  test('win beats loss regardless of wave/kills', () => {
    expect(isBetter(b(3, 1, true), b(15, 999))).toBe(true);
    expect(isBetter(b(15, 999), b(3, 1, true))).toBe(false);
  });
  test('same outcome: higher wave wins', () => {
    expect(isBetter(b(5, 1), b(4, 900))).toBe(true);
    expect(isBetter(b(4, 900), b(5, 1))).toBe(false);
    expect(isBetter(b(15, 1, true), b(14, 5, true))).toBe(true);
  });
  test('same wave: more kills wins; equal is not better', () => {
    expect(isBetter(b(5, 11), b(5, 10))).toBe(true);
    expect(isBetter(b(5, 10), b(5, 11))).toBe(false);
    expect(isBetter(b(5, 10), b(5, 10))).toBe(false);
  });
});

describe('recordBest', () => {
  test('first run is a new best and is written', () => {
    const s = mem();
    expect(recordBest(s, b(2, 5))).toEqual({ previous: null, isNew: true });
    expect(readBest(s)).toEqual(b(2, 5));
  });
  test('better run returns the previous best and overwrites', () => {
    const s = mem({ [BEST_KEY]: JSON.stringify(b(2, 5)) });
    expect(recordBest(s, b(3, 1))).toEqual({ previous: b(2, 5), isNew: true });
    expect(readBest(s)).toEqual(b(3, 1));
  });
  test('worse or equal run does not write', () => {
    const raw = JSON.stringify(b(5, 50));
    const s = mem({ [BEST_KEY]: raw });
    expect(recordBest(s, b(4, 99))).toEqual({ previous: b(5, 50), isNew: false });
    expect(recordBest(s, b(5, 50))).toEqual({ previous: b(5, 50), isNew: false });
    expect(s.data[BEST_KEY]).toBe(raw);
  });
  test('corrupt previous is replaced and reported as none', () => {
    const s = mem({ [BEST_KEY]: 'garbage' });
    expect(recordBest(s, b(1, 0))).toEqual({ previous: null, isNew: true });
    expect(readBest(s)).toEqual(b(1, 0));
  });
  test('invalid run is ignored', () => {
    const s = mem();
    expect(recordBest(s, { wave: NaN, kills: 1, won: false })).toEqual({ previous: null, isNew: false });
    expect(s.data[BEST_KEY]).toBeUndefined();
  });
  test('throwing or missing store never throws', () => {
    expect(() => recordBest(throwing, b(1, 1))).not.toThrow();
    expect(() => recordBest(null, b(1, 1))).not.toThrow();
    expect(recordBest(null, b(1, 1)).previous).toBeNull();
  });
});
