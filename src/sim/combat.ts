import type { Rng } from './rng';
import { tileCenter } from './path';
import { enemyPos, modifierOf } from './enemies';
import { grantCard } from './commands';
import { computeStats } from './units';
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

export function damageEnemy(state: GameState, enemy: Enemy, amount: number, crit: boolean): void {
  if (enemy.dead) return;
  const mod = modifierOf(state);
  const taken = amount * (1 - enemy.armor) * mod.damageTakenMult;
  enemy.hp -= taken;
  const pos = enemyPos(state, enemy);
  state.events.push({ type: 'damage', pos, amount: taken, crit });
  if (enemy.hp <= 0) {
    enemy.dead = true;
    state.kills++;
    const gold = Math.round(enemy.goldDrop) /* goldDropMult đã áp ở spawnEnemy */;
    state.gold += gold;
    state.events.push({ type: 'kill', pos, gold });
    if (enemy.kind === 'boss') grantCard(state, 'rare');
  }
}

/** Đòn đánh mỗi lần tấn công; Task 6 thay bằng logic theo lớp. */
export function basicAttack(state: GameState, _unit: Unit, stats: UnitStats, target: Enemy): void {
  const hit = rollHit(state.rng, stats, 1);
  damageEnemy(state, target, hit.amount, hit.crit);
}

export function updateUnits(state: GameState, dt: number): void {
  const rangeMult = modifierOf(state).rangeMult;
  for (const unit of state.units.values()) {
    unit.attackCooldown -= dt;
    if (unit.attackCooldown > 0) continue;
    const stats = computeStats(state.config, unit, rangeMult);
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
