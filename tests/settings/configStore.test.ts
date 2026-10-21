import { describe, expect, test } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config';
import { createGame } from '../../src/sim/state';
import {
  STORAGE_KEY, exportConfig, importConfig, loadConfig, mergeConfig, resetConfig, saveConfig,
} from '../../src/settings/configStore';
import { activeCooldown } from '../../src/sim/skills';
import { labelFor } from '../../src/settings/labels';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

describe('configStore', () => {
  test('chưa lưu gì → mặc định', () => expect(loadConfig(mem())).toEqual(DEFAULT_CONFIG));
  test('lưu rồi tải lại giữ nguyên thay đổi', () => {
    const st = mem(); const c = structuredClone(DEFAULT_CONFIG); c.economy.startGold = 500; c.enemies.tank.hp = 999;
    saveConfig(st, c); expect(loadConfig(st)).toEqual(c);
  });
  test('resetConfig xóa bản lưu', () => {
    const st = mem(); const c = structuredClone(DEFAULT_CONFIG); c.economy.startGold = 500;
    saveConfig(st, c); resetConfig(st); expect(loadConfig(st)).toEqual(DEFAULT_CONFIG);
  });
  test('giá trị sai kiểu bị bỏ, giữ mặc định, báo lỗi theo đường dẫn', () => {
    const r = mergeConfig(DEFAULT_CONFIG, { enemies: { tank: { hp: 'nhiều' } }, economy: { startGold: 300 } });
    expect(r.config.enemies.tank.hp).toBe(DEFAULT_CONFIG.enemies.tank.hp);
    expect(r.config.economy.startGold).toBe(300);
    expect(r.errors).toContain('enemies.tank.hp: phải là số');
  });
  test('khóa lạ bị bỏ qua, khóa thiếu giữ mặc định', () => {
    const r = mergeConfig(DEFAULT_CONFIG, { lạ: 1, economy: { zzz: 2 } });
    expect(r.config).toEqual(DEFAULT_CONFIG); expect(r.errors).toEqual([]);
  });
  test('số âm bị từ chối (trừ luckStep)', () => {
    const r = mergeConfig(DEFAULT_CONFIG, { economy: { startGold: -5, luckStep: [-1, 2, 3] } });
    expect(r.config.economy.startGold).toBe(DEFAULT_CONFIG.economy.startGold);
    expect(r.config.economy.luckStep).toEqual([-1, 2, 3]);
    expect(r.errors).toEqual(['economy.startGold: không được âm']);
  });
  test('mảng độ dài cố định sai độ dài bị từ chối', () => {
    const r = mergeConfig(DEFAULT_CONFIG, { levelDamage: [1, 2] });
    expect(r.config.levelDamage).toEqual(DEFAULT_CONFIG.levelDamage); expect(r.errors).toHaveLength(1);
  });
  test('thêm wave mới được nhận; kind lạ bị từ chối', () => {
    const waves = [...DEFAULT_CONFIG.waves, { groups: [{ kind: 'normal', count: 5, interval: 1, delay: 0 }] }];
    expect(mergeConfig(DEFAULT_CONFIG, { waves }).config.waves).toHaveLength(16);
    const bad = mergeConfig(DEFAULT_CONFIG, { waves: [{ groups: [{ kind: 'rồng', count: 1, interval: 1, delay: 0 }] }] });
    expect(bad.errors.length).toBeGreaterThan(0);
  });
  test('op quiz lạ bị từ chối', () => {
    const bands = [{ fromWave: 1, ops: ['%'], addMax: 5, mulMax: 0 }];
    const r = mergeConfig(DEFAULT_CONFIG, { quiz: { bands } });
    expect(r.errors.some((e) => e.startsWith('quiz.bands.0.ops.0'))).toBe(true);
  });
  test('ít wave hơn totalWaves → dùng lại cả waves lẫn totalWaves mặc định', () => {
    const r = mergeConfig(DEFAULT_CONFIG, { waves: DEFAULT_CONFIG.waves.slice(0, 3), economy: { totalWaves: 10 } });
    expect(r.config.waves).toEqual(DEFAULT_CONFIG.waves);
    expect(r.config.economy.totalWaves).toBe(DEFAULT_CONFIG.economy.totalWaves);
    expect(r.errors.length).toBeGreaterThan(0);
  });
  test('giảm bớt wave cùng totalWaves hợp lệ được nhận', () => {
    const r = mergeConfig(DEFAULT_CONFIG, { waves: DEFAULT_CONFIG.waves.slice(0, 3), economy: { totalWaves: 3 } });
    expect(r.config.waves).toHaveLength(3); expect(r.errors).toEqual([]);
  });
  test('map không hợp lệ bị từ chối', () => {
    const r = mergeConfig(DEFAULT_CONFIG, { map: { path: [{ x: 0, y: 1 }, { x: 99, y: 1 }] } });
    expect(r.config.map).toEqual(DEFAULT_CONFIG.map); expect(r.errors.length).toBeGreaterThan(0);
  });
  test('tổng trọng số độ hiếm bằng 0 bị từ chối', () => {
    const r = mergeConfig(DEFAULT_CONFIG, { economy: { baseRarityWeights: [0, 0, 0] } });
    expect(r.config.economy.baseRarityWeights).toEqual(DEFAULT_CONFIG.economy.baseRarityWeights);
  });
  test('JSON hỏng trong storage → mặc định', () => { const st = mem(); st.setItem(STORAGE_KEY, '{oops'); expect(loadConfig(st)).toEqual(DEFAULT_CONFIG); });
  test('store ném lỗi → mặc định, không văng', () => {
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    expect(loadConfig(bad)).toEqual(DEFAULT_CONFIG); expect(saveConfig(bad, DEFAULT_CONFIG)).toBe(false);
  });
  test('xuất rồi nhập ra đúng config', () => {
    const c = structuredClone(DEFAULT_CONFIG); c.quiz.timeLimit = 6;
    expect(importConfig(exportConfig(c))).toEqual({ config: c, errors: [] });
  });
  test('nhập file không phải JSON → mặc định kèm lỗi', () => {
    expect(importConfig('xxx')).toEqual({ config: DEFAULT_CONFIG, errors: ['File không phải JSON hợp lệ'] });
  });
  test('ván mới dùng config truyền vào; sửa bản gốc không ảnh hưởng ván đang chạy', () => {
    const c = structuredClone(DEFAULT_CONFIG); c.economy.startGold = 777;
    const s = createGame(1, c); expect(s.gold).toBe(777);
    c.economy.startGold = 1; expect(s.config.economy.startGold).toBe(777);
  });
});

describe('ràng buộc chống crash', () => {
  const band = (o: object) => ({ fromWave: 1, ops: ['+'], addMax: 5, mulMax: 0, ...o });
  const bandsFallback = (bands: unknown[]) => {
    const r = mergeConfig(DEFAULT_CONFIG, { quiz: { bands } });
    expect(r.config.quiz.bands).toEqual(DEFAULT_CONFIG.quiz.bands);
    expect(r.errors.length).toBeGreaterThan(0);
  };
  test('bands rỗng bị từ chối', () => bandsFallback([]));
  test('ops rỗng bị từ chối', () => bandsFallback([band({ ops: [] })]));
  test('× hoặc ÷ với mulMax < 2 bị từ chối', () => {
    bandsFallback([band({ ops: ['*'], mulMax: 1 })]);
    bandsFallback([band({ ops: ['+', '/'], mulMax: 0 })]);
  });
  test('band hợp lệ được nhận', () => {
    const r = mergeConfig(DEFAULT_CONFIG, { quiz: { bands: [band({ ops: ['*'], mulMax: 2 })] } });
    expect(r.errors).toEqual([]); expect(r.config.quiz.bands).toHaveLength(1);
  });
  test.each([
    ['enemies.tank.speed', { enemies: { tank: { speed: 0 } } }, 'phải lớn hơn 0'],
    ['classes.mage.base.attackSpeed', { classes: { mage: { base: { attackSpeed: 0 } } } }, 'phải lớn hơn 0'],
    ['quiz.timeLimit', { quiz: { timeLimit: 0 } }, 'phải lớn hơn 0'],
    ['skills.summoner.minionAttackRate', { skills: { summoner: { minionAttackRate: 0 } } }, 'phải lớn hơn 0'],
    ['economy.handLimit', { economy: { handLimit: 0 } }, 'phải là số nguyên ≥ 1'],
    ['economy.totalWaves', { economy: { totalWaves: 2.5 } }, 'phải là số nguyên ≥ 1'],
    ['economy.maxLuck', { economy: { maxLuck: 1.5 } }, 'phải là số nguyên ≥ 0'],
  ])('%s sai bị từ chối', (path, input, msg) => {
    const r = mergeConfig(DEFAULT_CONFIG, input);
    expect(r.errors).toContain(`${path}: ${msg}`);
    expect(r.config).toEqual(DEFAULT_CONFIG);
  });
  test('wave group interval 0 và count 0 / lẻ bị từ chối', () => {
    const w = (g: object) => ({ waves: [{ groups: [{ kind: 'normal', count: 3, interval: 1, delay: 0, ...g }] }].concat(DEFAULT_CONFIG.waves.slice(1) as never) });
    expect(mergeConfig(DEFAULT_CONFIG, w({ interval: 0 })).errors).toContain('waves.0.groups.0.interval: phải lớn hơn 0');
    expect(mergeConfig(DEFAULT_CONFIG, w({ count: 0 })).errors).toContain('waves.0.groups.0.count: phải là số nguyên ≥ 1');
    expect(mergeConfig(DEFAULT_CONFIG, w({ count: 1.5 })).errors.length).toBe(1);
  });
  test('maxLevel > số phần tử levelDamage bị từ chối', () => {
    const r = mergeConfig(DEFAULT_CONFIG, { economy: { maxLevel: 6 } });
    expect(r.config.economy.maxLevel).toBe(DEFAULT_CONFIG.economy.maxLevel); expect(r.errors.length).toBe(1);
  });
  test('maxMinions = 0 được phép (tắt lính)', () => {
    const r = mergeConfig(DEFAULT_CONFIG, { skills: { summoner: { maxMinions: 0 } } });
    expect(r.errors).toEqual([]);
  });
});

describe('ràng buộc bổ sung (final review)', () => {
  test.each([
    ['modifiers.frenzy.speedMult', { modifiers: { frenzy: { speedMult: 0 } } }, 'phải lớn hơn 0'],
    ['modifiers.ironArmor.damageTakenMult', { modifiers: { ironArmor: { damageTakenMult: 0 } } }, 'phải lớn hơn 0'],
    ['enemies.tank.armor', { enemies: { tank: { armor: 1 } } }, 'phải trong khoảng [0, 1)'],
    ['enemies.tank.armor', { enemies: { tank: { armor: 1.5 } } }, 'phải trong khoảng [0, 1)'],
    ['economy.startHp', { economy: { startHp: 0 } }, 'phải là số nguyên ≥ 1'],
    ['economy.startHp', { economy: { startHp: 2.5 } }, 'phải là số nguyên ≥ 1'],
    ['economy.handLimit', { economy: { handLimit: 6 } }, 'phải là số nguyên từ 1 đến 5'],
  ])('%s sai bị từ chối', (path, input, msg) => {
    const r = mergeConfig(DEFAULT_CONFIG, input);
    expect(r.errors).toContain(`${path}: ${msg}`);
    expect(r.config).toEqual(DEFAULT_CONFIG);
  });
  test('armor 0.99 và handLimit 5 hợp lệ', () => {
    expect(mergeConfig(DEFAULT_CONFIG, { enemies: { tank: { armor: 0.99 } }, economy: { handLimit: 5 } }).errors).toEqual([]);
  });
  test('skillCooldownPerLevel × (maxLevel − 1) ≥ 1 bị từ chối', () => {
    const r = mergeConfig(DEFAULT_CONFIG, { skillCooldownPerLevel: 0.3 });
    expect(r.config.skillCooldownPerLevel).toBe(DEFAULT_CONFIG.skillCooldownPerLevel);
    expect(r.errors.length).toBe(1);
  });
  test('activeCooldown có sàn an toàn', () => {
    const c = structuredClone(DEFAULT_CONFIG); c.skillCooldownPerLevel = 0.5;
    expect(activeCooldown(c, 'swordsman', 5)).toBeGreaterThanOrEqual(0.5);
  });
  test('importConfig giữ giá trị của base cho trường thiếu/sai', () => {
    const base = structuredClone(DEFAULT_CONFIG); base.quiz.timeLimit = 7; base.economy.startGold = 321;
    const r = importConfig(JSON.stringify({ economy: { startHp: 0, prepSeconds: 33 } }), base);
    expect(r.config.quiz.timeLimit).toBe(7);
    expect(r.config.economy.startGold).toBe(321);
    expect(r.config.economy.startHp).toBe(base.economy.startHp);
    expect(r.config.economy.prepSeconds).toBe(33);
    expect(r.errors.length).toBe(1);
    expect(importConfig('xxx', base).config).toEqual(base);
  });
});

describe('labels', () => {
  test('mọi khóa lá của DEFAULT_CONFIG có nhãn tiếng Việt', () => {
    const missing: string[] = [];
    const check = (path: string[]): void => {
      if (labelFor(path.join('.')) === path[path.length - 1]) missing.push(path.join('.'));
    };
    const walk = (v: unknown, path: string[]): void => {
      if (Array.isArray(v)) {
        if (v.every((x) => typeof x !== 'object')) check(path);
        else v.forEach((x) => walk(x, path));
      } else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) walk(x, [...path, k]);
      } else check(path);
    };
    walk(DEFAULT_CONFIG, []);
    expect(missing).toEqual([]);
  });
  test('labelFor bỏ chỉ số và rơi về khóa cuối', () => {
    expect(labelFor('enemies.tank.hp')).toBe('Máu');
    expect(labelFor('waves.3.groups.1.count')).toBe(labelFor('waves.groups.count'));
    expect(labelFor('foo.bar')).toBe('bar');
  });
});
