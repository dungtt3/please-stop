import type { GameConfig } from '../config';
import { damageEnemy, enemiesInRange, rollHit, unitPos } from './combat';
import { enemyPos } from './enemies';
import { spawnMinion } from './minions';
import type { ClassId, Enemy, GameState, Unit, UnitStats, Vec } from './types';

/** Sàn an toàn (giây) cho hồi chiêu skill chủ động. */
export const MIN_ACTIVE_COOLDOWN = 0.5;

/** Hồi chiêu skill chủ động: cooldown × (1 − giảm × (cấp − 1)), không thấp hơn sàn. */
export function activeCooldown(cfg: GameConfig, classId: ClassId, level: number): number {
  return Math.max(MIN_ACTIVE_COOLDOWN, cfg.skills[classId].cooldown * (1 - cfg.skillCooldownPerLevel * (level - 1)));
}

function hit(state: GameState, stats: UnitStats, enemy: Enemy, mult: number): void {
  const h = rollHit(state.rng, stats, mult);
  damageEnemy(state, enemy, h.amount, h.crit);
}

/** Đòn thường: phát event attack (crit lấy từ chính lần rollHit) rồi gây sát thương. */
function attackHit(state: GameState, unit: Unit, stats: UnitStats, enemy: Enemy, mult: number): void {
  const h = rollHit(state.rng, stats, mult);
  state.events.push({
    type: 'attack', source: 'unit', id: unit.id, classId: unit.classId,
    from: unitPos(state, unit), to: enemyPos(state, enemy), crit: h.crit,
  });
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
      attackHit(state, unit, stats, target, combo ? cfg.swordsman.comboMult : 1);
      return;
    }
    case 'mage': {
      const m = cfg.mage;
      const h = rollHit(state.rng, stats, 1);
      state.events.push({
        type: 'attack', source: 'unit', id: unit.id, classId: 'mage',
        from: unitPos(state, unit), to: enemyPos(state, target), crit: h.crit,
      });
      const centre = enemyPos(state, target);
      for (const e of enemiesInRange(state, centre, m.splashRadius)) {
        damageEnemy(state, e, h.amount, h.crit);
        if (!e.dead) e.burn = { dps: h.amount * m.burnRatio, remaining: m.burnDuration, acc: 0, timer: 0 };
      }
      return;
    }
    default:
      attackHit(state, unit, stats, target, 1);
  }
}

/** Skill chủ động: đếm hồi chiêu; chỉ kích hoạt khi có mục tiêu hợp lệ, nếu không chờ ở 0. */
export function updateActive(state: GameState, unit: Unit, stats: UnitStats, dt: number): void {
  if (unit.classId === 'summoner' && state.phase === 'wave') {
    unit.passiveTimer += dt;
    if (unit.passiveTimer >= state.config.skills.summoner.passiveEvery) {
      spawnMinion(state, unit, stats);
      unit.passiveTimer = 0;
    }
  }
  unit.skillCooldown -= dt;
  if (unit.skillCooldown > 0) return;
  unit.skillCooldown = 0;
  const pos = unitPos(state, unit);
  const cfg = state.config;
  let extra: { range?: number; hits?: Vec[]; center?: Vec; radius?: number; spawns?: Vec[] };
  switch (unit.classId) {
    case 'swordsman': {
      const targets = enemiesInRange(state, pos, stats.range);
      if (targets.length === 0) return;
      for (const e of targets) hit(state, stats, e, cfg.skills.swordsman.whirlMult);
      extra = { range: stats.range };
      break;
    }
    case 'archer': {
      const targets = enemiesInRange(state, pos, stats.range);
      if (targets.length === 0) return;
      state.rng.shuffle(targets);
      const hits: Vec[] = [];
      for (const e of targets.slice(0, cfg.skills.archer.rainArrows)) {
        hits.push(enemyPos(state, e));
        hit(state, stats, e, cfg.skills.archer.rainMult);
      }
      extra = { hits };
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
      extra = { center: best, radius: m.meteorRadius };
      break;
    }
    default: {
      const spawns: Vec[] = [];
      for (let i = 0; i < cfg.skills.summoner.waveCount; i++) {
        const p = spawnMinion(state, unit, stats);
        if (p) spawns.push(p);
      }
      if (spawns.length === 0) return;
      extra = { spawns };
    }
  }
  state.events.push({ type: 'skill', unitId: unit.id, skill: unit.classId, pos, ...extra });
  unit.skillCooldown = activeCooldown(cfg, unit.classId, unit.level);
}
