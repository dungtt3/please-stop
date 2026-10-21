import type { GameConfig } from '../config';
import { damageEnemy, enemiesInRange, rollHit, unitPos } from './combat';
import { enemyPos } from './enemies';
import type { ClassId, Enemy, GameState, Unit, UnitStats, Vec } from './types';

/** Hồi chiêu skill chủ động: cooldown × (1 − giảm × (cấp − 1)). */
export function activeCooldown(cfg: GameConfig, classId: ClassId, level: number): number {
  return cfg.skills[classId].cooldown * (1 - cfg.skillCooldownPerLevel * (level - 1));
}

function hit(state: GameState, stats: UnitStats, enemy: Enemy, mult: number): void {
  const h = rollHit(state.rng, stats, mult);
  damageEnemy(state, enemy, h.amount, h.crit);
}

const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Đòn thường theo lớp. */
export function basicAttack(state: GameState, unit: Unit, stats: UnitStats, target: Enemy): void {
  const cfg = state.config.skills;
  switch (unit.classId) {
    case 'swordsman': {
      unit.attackCount++;
      const combo = unit.attackCount % cfg.swordsman.comboEvery === 0;
      hit(state, stats, target, combo ? cfg.swordsman.comboMult : 1);
      return;
    }
    case 'mage': {
      const m = cfg.mage;
      const h = rollHit(state.rng, stats, 1);
      const centre = enemyPos(state, target);
      for (const e of enemiesInRange(state, centre, m.splashRadius)) {
        damageEnemy(state, e, h.amount, h.crit);
        if (!e.dead) e.burn = { dps: h.amount * m.burnRatio, remaining: m.burnDuration, acc: 0, timer: 0 };
      }
      return;
    }
    default:
      hit(state, stats, target, 1);
  }
}

/** Skill chủ động: đếm hồi chiêu; chỉ kích hoạt khi có mục tiêu hợp lệ, nếu không chờ ở 0. */
export function updateActive(state: GameState, unit: Unit, stats: UnitStats, dt: number): void {
  unit.skillCooldown -= dt;
  if (unit.skillCooldown > 0) return;
  unit.skillCooldown = 0;
  const pos = unitPos(state, unit);
  const cfg = state.config;
  let at: Vec;
  switch (unit.classId) {
    case 'swordsman': {
      const targets = enemiesInRange(state, pos, stats.range);
      if (targets.length === 0) return;
      for (const e of targets) hit(state, stats, e, cfg.skills.swordsman.whirlMult);
      at = pos;
      break;
    }
    case 'archer': {
      const targets = enemiesInRange(state, pos, stats.range);
      if (targets.length === 0) return;
      state.rng.shuffle(targets);
      for (const e of targets.slice(0, cfg.skills.archer.rainArrows)) hit(state, stats, e, cfg.skills.archer.rainMult);
      at = pos;
      break;
    }
    case 'mage': {
      const m = cfg.skills.mage;
      const targets = enemiesInRange(state, pos, stats.range);
      if (targets.length === 0) return;
      const all = state.enemies.filter((e) => !e.dead).map((e) => ({ e, p: enemyPos(state, e) }));
      let best = enemyPos(state, targets[0]);
      let bestCount = -1;
      for (const t of targets) {
        const p = enemyPos(state, t);
        const n = all.filter((o) => o.e !== t && dist(o.p, p) <= m.meteorRadius).length;
        if (n > bestCount) { bestCount = n; best = p; }
      }
      for (const e of enemiesInRange(state, best, m.meteorRadius)) hit(state, stats, e, m.meteorMult);
      at = best;
      break;
    }
    default:
      return; // Triệu hồi sư: Task 7
  }
  state.events.push({ type: 'skill', unitId: unit.id, skill: unit.classId, pos: at });
  unit.skillCooldown = activeCooldown(cfg, unit.classId, unit.level);
}
