import type { Rng } from './rng';
import { tileCenter } from './path';
import { enemyPos, modifierOf } from './enemies';
import { grantCard } from './commands';
import { computeStats } from './units';
import { basicAttack, updateActive } from './skills';
import type { Enemy, GameState, Unit, UnitStats, Vec } from './types';

/** Tâm ô của slot mà unit đang đứng. */
export function unitPos(state: GameState, unit: Unit): Vec {
  return tileCenter(state.map.slots[unit.slot]);
}

/** Quái còn sống trong tầm (khoảng cách Euclid ≤ range). */
export function enemiesInRange(state: GameState, pos: Vec, range: number): Enemy[] {
  return state.enemies.filter((e) => {
    if (e.dead) return false;
    const p = enemyPos(state, e);
    return Math.hypot(p.x - pos.x, p.y - pos.y) <= range;
  });
}

/** Quái đi xa nhất (distance lớn nhất) trong tầm. */
export function findTarget(state: GameState, pos: Vec, range: number): Enemy | null {
  let best: Enemy | null = null;
  for (const e of enemiesInRange(state, pos, range)) {
    if (best === null || e.distance > best.distance) best = e;
  }
  return best;
}

export function rollHit(rng: Rng, stats: UnitStats, mult: number): { amount: number; crit: boolean } {
  const crit = rng.chance(stats.critChance);
  return { amount: stats.damage * mult * (crit ? stats.critMultiplier : 1), crit };
}

/** Trả về sát thương thực nhận. emit=false: không phát event damage (dùng cho cháy). */
export function damageEnemy(state: GameState, enemy: Enemy, amount: number, crit: boolean, emit = true): number {
  if (enemy.dead) return 0;
  const mod = modifierOf(state);
  const taken = amount * (1 - enemy.armor) * mod.damageTakenMult;
  enemy.hp -= taken;
  const pos = enemyPos(state, enemy);
  if (emit) state.events.push({ type: 'damage', pos, amount: taken, crit });
  if (enemy.hp <= 0) {
    enemy.dead = true;
    state.kills++;
    const gold = Math.round(enemy.goldDrop) /* goldDropMult đã áp ở spawnEnemy */;
    state.gold += gold;
    state.events.push({ type: 'kill', pos, gold, enemyId: enemy.id, kind: enemy.kind });
    if (enemy.kind === 'boss') grantCard(state, 'rare');
  }
  return taken;
}

export function updateUnits(state: GameState, dt: number): void {
  const rangeMult = modifierOf(state).rangeMult;
  for (const unit of state.units.values()) {
    const stats = computeStats(state.config, unit, rangeMult);
    updateActive(state, unit, stats, dt);
    unit.attackCooldown -= dt;
    if (unit.attackCooldown > 0) continue;
    const target = findTarget(state, unitPos(state, unit), stats.range);
    if (target) {
      basicAttack(state, unit, stats, target);
      unit.attackCooldown = 1 / stats.attackSpeed;
    } else {
      unit.attackCooldown = 0;
    }
  }
}

export function removeDead(state: GameState): void {
  state.enemies = state.enemies.filter((e) => !e.dead);
}
