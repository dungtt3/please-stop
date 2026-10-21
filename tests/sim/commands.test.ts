import { DEFAULT_CONFIG } from '../../src/config';
import { createGame } from '../../src/sim/state';
import {
  applyCard, buyLuck, discardCard, dragUnit, drawCard, grantCard, sellUnit, summon,
} from '../../src/sim/commands';
import { createUnit } from '../../src/sim/units';
import type { ClassId, GameState, Rarity, Unit } from '../../src/sim/types';

const ZERO = { damage: 0, attackSpeed: 0 };

function put(s: GameState, slot: number, classId: ClassId, gold = 20, rarity: Rarity = 'common'): Unit {
  const u = createUnit(DEFAULT_CONFIG, s.nextId++, classId, slot, rarity, ZERO, gold);
  s.units.set(u.id, u);
  s.slots[slot] = u.id;
  return u;
}
const at = (s: GameState, slot: number): Unit => s.units.get(s.slots[slot]!)!;

test('createGame deep-copies config and uses starting values', () => {
  const s = createGame(1);
  expect(s.config).toEqual(DEFAULT_CONFIG);
  expect(s.config).not.toBe(DEFAULT_CONFIG);
  expect(s.config.economy).not.toBe(DEFAULT_CONFIG.economy);
  expect(s.slots).toHaveLength(DEFAULT_CONFIG.map.slots.length);
  expect([s.phase, s.wave, s.prepTimer, s.hp, s.gold, s.modifier]).toEqual(['prep', 1, 15, 20, 100, null]);
});

test('summon trừ 20 rồi 25 vàng, đặt cấp 1 vào ô trống', () => {
  const s = createGame(1);
  expect(summon(s)).toEqual({ ok: true }); expect(s.gold).toBe(80);
  summon(s); expect(s.gold).toBe(55);
  expect([...s.units.values()].every(u => u.level === 1)).toBe(true);
  expect(s.slots.filter(x => x !== null)).toHaveLength(2);
});

test('summon bị từ chối khi thiếu vàng hoặc hết ô, state không đổi', () => {
  const s = createGame(1); s.gold = 5;
  expect(summon(s)).toEqual({ ok: false, reason: 'gold' }); expect(s.summonCount).toBe(0);
  const t = createGame(1); t.gold = 1e6;
  for (let i = 0; i < 15; i++) summon(t);
  const g = t.gold; expect(summon(t)).toEqual({ ok: false, reason: 'noSlot' }); expect(t.gold).toBe(g);
});

test('dragUnit: gộp, di chuyển, hoán đổi', () => {
  const s = createGame(1);
  put(s, 0, 'mage'); put(s, 1, 'mage'); const archer = put(s, 2, 'archer');
  expect(dragUnit(s, 0, 1)).toEqual({ ok: true });
  expect(s.slots[0]).toBeNull();
  expect(at(s, 1).classId).toBe('mage'); expect(at(s, 1).level).toBe(2);
  expect(at(s, 1).slot).toBe(1);
  expect(s.units.size).toBe(2);
  expect(dragUnit(s, 1, 5)).toEqual({ ok: true });
  expect(s.slots[1]).toBeNull(); expect(at(s, 5).level).toBe(2); expect(at(s, 5).slot).toBe(5);
  expect(dragUnit(s, 5, 2)).toEqual({ ok: true });
  expect(at(s, 2).classId).toBe('mage'); expect(at(s, 2).level).toBe(2);
  expect(s.slots[5]).toBe(archer.id); expect(archer.slot).toBe(5);
});

test('dragUnit từ chối from = to, ô nguồn trống, ô ngoài phạm vi', () => {
  const s = createGame(1); put(s, 0, 'mage');
  expect(dragUnit(s, 0, 0)).toEqual({ ok: false, reason: 'invalid' });
  expect(dragUnit(s, 3, 4)).toEqual({ ok: false, reason: 'invalid' });
  expect(dragUnit(s, 0, 99)).toEqual({ ok: false, reason: 'invalid' });
  expect(at(s, 0).level).toBe(1);
});

test('kéo con cấp 5 lên con cấp 5 cùng lớp thì hoán đổi, không gộp', () => {
  const s = createGame(1);
  const a = put(s, 0, 'mage'); const b = put(s, 1, 'mage');
  a.level = 5; b.level = 5;
  expect(dragUnit(s, 0, 1)).toEqual({ ok: true });
  expect(s.units.size).toBe(2);
  expect(s.slots[0]).toBe(b.id); expect(s.slots[1]).toBe(a.id);
  expect(a.level).toBe(5); expect(a.slot).toBe(1); expect(b.slot).toBe(0);
});

test('gộp xóa lính của cả hai con', () => {
  const s = createGame(1);
  const a = put(s, 0, 'summoner'); const b = put(s, 1, 'summoner'); const c = put(s, 2, 'archer');
  const mk = (id: number, ownerId: number) => ({
    id, ownerId, pos: { x: 0, y: 0 }, pathDistance: 0, hp: 1, maxHp: 1, damage: 1, attackCooldown: 0, lifetime: 1,
  });
  s.minions.push(mk(900, a.id), mk(901, b.id), mk(902, c.id));
  dragUnit(s, 0, 1);
  expect(s.minions.map(m => m.id)).toEqual([902]);
});

test('bán con đã gộp hoàn floor(tổng/2)', () => {
  const s = createGame(1);
  put(s, 0, 'mage', 20); put(s, 1, 'mage', 25);
  dragUnit(s, 0, 1);
  const g = s.gold;
  expect(sellUnit(s, 1)).toEqual({ ok: true });
  expect(s.gold).toBe(g + 22);
  expect(s.slots[1]).toBeNull(); expect(s.units.size).toBe(0);
  expect(sellUnit(s, 1)).toEqual({ ok: false, reason: 'invalid' });
});

test('bán con xóa lính của nó', () => {
  const s = createGame(1);
  const a = put(s, 0, 'summoner');
  s.minions.push({ id: 5, ownerId: a.id, pos: { x: 0, y: 0 }, pathDistance: 0, hp: 1, maxHp: 1, damage: 1, attackCooldown: 0, lifetime: 1 });
  sellUnit(s, 0);
  expect(s.minions).toHaveLength(0);
});

test('applyCard dùng thẻ lên unit và bỏ thẻ khỏi tay', () => {
  const s = createGame(1); const u = put(s, 0, 'mage');
  s.hand.push({ id: 50, stat: 'damage', rarity: 'rare' });
  expect(applyCard(s, 50, 0)).toEqual({ ok: true });
  expect(u.cards.damage).toBeCloseTo(0.2);
  expect(s.hand).toHaveLength(0);
  expect(applyCard(s, 50, 0)).toEqual({ ok: false, reason: 'invalid' });
});

test('applyCard tầm khi chạm trần trả rangeCap và giữ thẻ trong tay', () => {
  const s = createGame(1); const u = put(s, 0, 'archer');
  u.cards.range = 2;
  s.hand.push({ id: 60, stat: 'range', rarity: 'common' });
  expect(applyCard(s, 60, 0)).toEqual({ ok: false, reason: 'rangeCap' });
  expect(s.hand).toHaveLength(1);
  expect(u.cards.range).toBe(2);
});

test('discardCard bỏ thẻ', () => {
  const s = createGame(1); s.hand.push({ id: 7, stat: 'crit', rarity: 'common' });
  expect(discardCard(s, 8)).toEqual({ ok: false, reason: 'invalid' });
  expect(discardCard(s, 7)).toEqual({ ok: true });
  expect(s.hand).toHaveLength(0);
});

test('drawCard trừ 25 rồi 30 vàng, thêm thẻ vào tay', () => {
  const s = createGame(1);
  expect(drawCard(s)).toEqual({ ok: true }); expect(s.gold).toBe(75);
  drawCard(s); expect(s.gold).toBe(45);
  expect(s.hand).toHaveLength(2); expect(s.drawCount).toBe(2);
  const g = createGame(1); g.gold = 10;
  expect(drawCard(g)).toEqual({ ok: false, reason: 'gold' }); expect(g.drawCount).toBe(0);
});

test('drawCard bị từ chối khi tay đầy', () => {
  const s = createGame(1); s.gold = 1000;
  for (let i = 0; i < 5; i++) s.hand.push({ id: 100 + i, stat: 'damage', rarity: 'common' });
  expect(drawCard(s)).toEqual({ ok: false, reason: 'handFull' });
  expect(s.gold).toBe(1000); expect(s.drawCount).toBe(0); expect(s.hand).toHaveLength(5);
});

test('grantCard thêm vào tay khi còn chỗ', () => {
  const s = createGame(2);
  grantCard(s, 'rare');
  expect(s.hand).toHaveLength(1);
  expect(s.hand[0].rarity).not.toBe('common');
  expect(s.events.at(-1)?.type).toBe('cardGranted');
});

test('grantCard khi tay đầy đổi ra vàng theo độ hiếm', () => {
  const s = createGame(2); for (let i = 0; i < 5; i++) s.hand.push({ id: 100 + i, stat: 'damage', rarity: 'common' });
  const g = s.gold; grantCard(s, 'rare');
  expect(s.hand).toHaveLength(5);
  expect([g + 25, g + 60]).toContain(s.gold);
  expect(s.events.at(-1)?.type).toBe('cardConverted');
});

test('buyLuck: 40 rồi 60; bậc 5 thì maxLuck', () => {
  const s = createGame(1); s.gold = 10000;
  expect(buyLuck(s)).toEqual({ ok: true }); expect(s.gold).toBe(9960); expect(s.luckLevel).toBe(1);
  buyLuck(s); expect(s.gold).toBe(9900); expect(s.luckLevel).toBe(2);
  buyLuck(s); buyLuck(s); buyLuck(s);
  expect(s.luckLevel).toBe(5);
  const g = s.gold;
  expect(buyLuck(s)).toEqual({ ok: false, reason: 'maxLuck' });
  expect(s.gold).toBe(g); expect(s.luckLevel).toBe(5);
  const t = createGame(1); t.gold = 10;
  expect(buyLuck(t)).toEqual({ ok: false, reason: 'gold' });
});

test('mọi lệnh trả gameOver khi phase lost', () => {
  for (const phase of ['lost', 'won'] as const) {
    const s = createGame(1); put(s, 0, 'mage'); put(s, 1, 'mage');
    s.hand.push({ id: 9, stat: 'damage', rarity: 'common' });
    s.phase = phase;
    const r = { ok: false, reason: 'gameOver' };
    expect(summon(s)).toEqual(r);
    expect(dragUnit(s, 0, 1)).toEqual(r);
    expect(sellUnit(s, 0)).toEqual(r);
    expect(drawCard(s)).toEqual(r);
    expect(applyCard(s, 9, 0)).toEqual(r);
    expect(discardCard(s, 9)).toEqual(r);
    expect(buyLuck(s)).toEqual(r);
    expect(s.units.size).toBe(2); expect(s.hand).toHaveLength(1); expect(s.gold).toBe(100);
  }
});
