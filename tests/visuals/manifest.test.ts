import { describe, expect, test } from 'vitest';
import { CLASS_IDS, ENEMY_KINDS, VISUAL_KEYS, parseManifest } from '../../src/visuals/manifest';

const sheet = { type: 'sheet', file: 'units/archer.png', frameWidth: 64, frameHeight: 64 };

describe('VISUAL_KEYS', () => {
  test('không trùng và chứa các khóa chính', () => {
    expect(new Set(VISUAL_KEYS).size).toBe(VISUAL_KEYS.length);
    for (const k of ['unit.archer.attack', 'enemy.boss.die', 'skill.mage.meteor', 'skill.archer.arrow', 'impact.crit', 'minion.idle', 'projectile.minion']) {
      expect(VISUAL_KEYS).toContain(k);
    }
  });

  test('liệt kê đủ theo công thức', () => {
    const c = CLASS_IDS.length;
    const expected =
      c * 3 + 2 +                 // unit.<lớp>.{idle,attack,skill} + minion.{idle,attack}
      ENEMY_KINDS.length * 2 +    // enemy.<loại>.{walk,die}
      (c + 1) +                   // projectile.<lớp|minion>
      (c + 2) +                   // impact.<lớp|minion|crit>
      c + 2;                      // skill.<lớp> + skill.mage.meteor + skill.archer.arrow
    expect(VISUAL_KEYS.length).toBe(expected);
  });
});

describe('parseManifest', () => {
  test('không phải object → rỗng và một cảnh báo', () => {
    for (const raw of [null, undefined, 42, 'x', true, [], [sheet]]) {
      const r = parseManifest(raw);
      expect(r.entries).toEqual({});
      expect(r.warnings).toHaveLength(1);
    }
  });

  test('object rỗng → rỗng, không cảnh báo', () => {
    expect(parseManifest({})).toEqual({ entries: {}, warnings: [] });
  });

  test('khóa lạ bị bỏ kèm cảnh báo', () => {
    const r = parseManifest({ 'unit.dragon.idle': sheet });
    expect(r.entries).toEqual({});
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('unit.dragon.idle');
  });

  test('sheet hợp lệ: mặc định fps 10, loop theo loại khóa', () => {
    const r = parseManifest({
      'unit.archer.idle': sheet,
      'enemy.tank.walk': sheet,
      'unit.archer.attack': sheet,
      'enemy.tank.die': sheet,
      'projectile.archer': sheet,
    });
    expect(r.warnings).toEqual([]);
    expect(r.entries['unit.archer.idle']).toEqual({ ...sheet, fps: 10, loop: true });
    expect(r.entries['enemy.tank.walk']).toMatchObject({ fps: 10, loop: true });
    expect(r.entries['unit.archer.attack']).toMatchObject({ fps: 10, loop: false });
    expect(r.entries['enemy.tank.die']).toMatchObject({ fps: 10, loop: false });
    expect(r.entries['projectile.archer']).toMatchObject({ loop: false });
  });

  test('minion.idle mặc định loop, minion.attack thì không', () => {
    const r = parseManifest({ 'minion.idle': sheet, 'minion.attack': sheet });
    expect(r.entries['minion.idle']?.loop).toBe(true);
    expect(r.entries['minion.attack']?.loop).toBe(false);
  });

  test('giữ các giá trị người dùng đặt và tùy chọn chung', () => {
    const r = parseManifest({
      'projectile.mage': { ...sheet, frames: 4, fps: 24, loop: true, scale: 0.5, originX: 0.5, originY: 1, tint: 0xff0000, rotateToTarget: true },
    });
    expect(r.warnings).toEqual([]);
    expect(r.entries['projectile.mage']).toEqual({
      ...sheet, frames: 4, fps: 24, loop: true, scale: 0.5, originX: 0.5, originY: 1, tint: 0xff0000, rotateToTarget: true,
    });
  });

  test('atlas hợp lệ, có prefix', () => {
    const r = parseManifest({ 'skill.mage.meteor': { type: 'atlas', file: 'fx/meteor.png', data: 'fx/meteor.json', prefix: 'meteor_' } });
    expect(r.warnings).toEqual([]);
    expect(r.entries['skill.mage.meteor']).toEqual({
      type: 'atlas', file: 'fx/meteor.png', data: 'fx/meteor.json', prefix: 'meteor_', fps: 10, loop: false,
    });
  });

  test('atlas thiếu data → bỏ khóa', () => {
    const r = parseManifest({ 'skill.mage': { type: 'atlas', file: 'a.png' }, 'skill.archer': { type: 'atlas', file: 'a.png', data: '' } });
    expect(r.entries).toEqual({});
    expect(r.warnings).toHaveLength(2);
  });

  test('prefix sai kiểu → bỏ khóa', () => {
    const r = parseManifest({ 'skill.mage': { type: 'atlas', file: 'a.png', data: 'a.json', prefix: 3 } });
    expect(r.entries).toEqual({});
    expect(r.warnings).toHaveLength(1);
  });

  test('type thiếu hoặc lạ → bỏ khóa', () => {
    const r = parseManifest({ 'skill.mage': { file: 'a.png' }, 'skill.archer': { ...sheet, type: 'gif' }, 'skill.swordsman': 'a.png', 'skill.summoner': null });
    expect(r.entries).toEqual({});
    expect(r.warnings).toHaveLength(4);
  });

  test('file thiếu, rỗng hoặc sai kiểu → bỏ khóa', () => {
    const { file: _f, ...noFile } = sheet;
    const r = parseManifest({
      'unit.archer.idle': noFile,
      'unit.mage.idle': { ...sheet, file: '' },
      'unit.swordsman.idle': { ...sheet, file: 7 },
    });
    expect(r.entries).toEqual({});
    expect(r.warnings).toHaveLength(3);
  });

  test('frameWidth/frameHeight phải là số nguyên > 0', () => {
    const bad = [undefined, 0, -64, 12.5, '64', NaN, Infinity];
    bad.forEach((v, i) => {
      const w = parseManifest({ 'unit.archer.idle': { ...sheet, frameWidth: v } });
      const h = parseManifest({ 'unit.archer.idle': { ...sheet, frameHeight: v } });
      expect(w.entries, `frameWidth #${i}`).toEqual({});
      expect(h.entries, `frameHeight #${i}`).toEqual({});
      expect(w.warnings).toHaveLength(1);
      expect(h.warnings).toHaveLength(1);
    });
  });

  test('frames (nếu có) phải là số nguyên > 0', () => {
    for (const v of [0, -1, 1.5, '4', null]) {
      expect(parseManifest({ 'unit.archer.idle': { ...sheet, frames: v } }).entries).toEqual({});
    }
  });

  test('fps phải > 0 (sai thì bỏ khóa, thiếu thì mặc định)', () => {
    for (const v of [0, -5, '12', NaN, null]) {
      const r = parseManifest({ 'unit.archer.idle': { ...sheet, fps: v } });
      expect(r.entries).toEqual({});
      expect(r.warnings).toHaveLength(1);
    }
    expect(parseManifest({ 'unit.archer.idle': sheet }).entries['unit.archer.idle']?.fps).toBe(10);
  });

  test('loop phải là boolean', () => {
    for (const v of [1, 'true', null]) {
      const r = parseManifest({ 'unit.archer.idle': { ...sheet, loop: v } });
      expect(r.entries).toEqual({});
      expect(r.warnings).toHaveLength(1);
    }
    expect(parseManifest({ 'unit.archer.idle': { ...sheet, loop: false } }).entries['unit.archer.idle']?.loop).toBe(false);
  });

  test('tùy chọn chung sai kiểu → bỏ khóa', () => {
    const bads = [{ scale: 0 }, { scale: '2' }, { originX: 'a' }, { originY: NaN }, { tint: -1 }, { tint: 'red' }, { rotateToTarget: 'yes' }];
    for (const b of bads) {
      const r = parseManifest({ 'projectile.archer': { ...sheet, ...b } });
      expect(r.entries, JSON.stringify(b)).toEqual({});
      expect(r.warnings).toHaveLength(1);
    }
  });

  test('đường dẫn không an toàn bị bỏ: .., tuyệt đối, ://', () => {
    const files = ['../secret.png', 'a/../../b.png', 'a\\..\\b.png', '/abs.png', '\\abs.png', 'C:\\x.png', 'C:/x.png', 'https://evil.com/a.png', 'http://x/a.png', '//cdn/a.png', 'data://x'];
    for (const file of files) {
      const r = parseManifest({ 'unit.archer.idle': { ...sheet, file } });
      expect(r.entries, file).toEqual({});
      expect(r.warnings, file).toHaveLength(1);
    }
    const a = parseManifest({ 'skill.mage': { type: 'atlas', file: 'ok.png', data: '../x.json' } });
    expect(a.entries).toEqual({});
    expect(a.warnings).toHaveLength(1);
  });

  test('đường dẫn con hợp lệ được giữ', () => {
    const r = parseManifest({ 'unit.archer.idle': { ...sheet, file: 'units/a.v2/archer.png' } });
    expect(r.entries['unit.archer.idle']?.file).toBe('units/a.v2/archer.png');
  });

  test('manifest hỗn hợp: giữ đúng, bỏ sai', () => {
    const r = parseManifest({
      'unit.archer.idle': sheet,
      'unit.archer.attack': { ...sheet, frameWidth: 0 },
      'enemy.boss.walk': { type: 'atlas', file: 'boss.png', data: 'boss.json' },
      'bogus.key': sheet,
      'impact.crit': { ...sheet, file: '../x.png' },
    });
    expect(Object.keys(r.entries).sort()).toEqual(['enemy.boss.walk', 'unit.archer.idle']);
    expect(r.warnings).toHaveLength(3);
  });

  test('không bao giờ ném lỗi với đầu vào bất kỳ', () => {
    const evil = { get 'unit.archer.idle'(): unknown { throw new Error('boom'); } };
    const inputs: unknown[] = [
      Symbol('x'), () => 1, 10n, JSON.parse('{"__proto__":{"a":1}}'), { 'unit.archer.idle': [] }, { 'unit.archer.idle': { ...sheet, file: {} } },
      evil, new Proxy({}, { ownKeys() { throw new Error('boom'); } }),
    ];
    for (const raw of inputs) expect(() => parseManifest(raw)).not.toThrow();
  });
});
