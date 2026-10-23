import { describe, expect, test } from 'vitest';
import { FxBudget, MAX_PROJECTILES, PROJECTILE_FLIGHT_S, SKILL_FX_MAX_S } from '../../src/visuals/effects';

describe('hằng số', () => {
  test('đúng theo spec', () => {
    expect(MAX_PROJECTILES).toBe(60);
    expect(PROJECTILE_FLIGHT_S).toBe(0.15);
    expect(SKILL_FX_MAX_S).toBe(0.6);
  });
});

describe('FxBudget', () => {
  test('60 lần acquire thành công, lần 61 thất bại', () => {
    const b = new FxBudget(MAX_PROJECTILES);
    for (let i = 0; i < 60; i++) expect(b.tryAcquire()).toBe(true);
    expect(b.active).toBe(60);
    expect(b.tryAcquire()).toBe(false);
    expect(b.active).toBe(60);
  });

  test('release rồi acquire lại được', () => {
    const b = new FxBudget(2);
    expect(b.tryAcquire()).toBe(true);
    expect(b.tryAcquire()).toBe(true);
    expect(b.tryAcquire()).toBe(false);
    b.release();
    expect(b.active).toBe(1);
    expect(b.tryAcquire()).toBe(true);
  });

  test('release khi 0 không xuống âm', () => {
    const b = new FxBudget(3);
    b.release();
    b.release();
    expect(b.active).toBe(0);
    expect(b.tryAcquire()).toBe(true);
    expect(b.active).toBe(1);
  });

  test('lease: trả suất đúng một lần dù gọi nhiều lần', () => {
    const b = new FxBudget(2);
    const a = b.lease()!;
    const c = b.lease()!;
    expect(b.lease()).toBeNull();
    a();
    a();
    a();
    expect(b.active).toBe(1);
    expect(b.lease()).not.toBeNull();
    c();
    c();
    expect(b.active).toBe(1);
  });
});
