import { distanceOfTile, pathTiles, tileCenter } from './path';
import { damageEnemy, unitPos } from './combat';
import { newId } from './state';
import type { GameState, Unit, UnitStats } from './types';

/** Tạo lính tại ô đường gần chủ nhất trong tầm. false nếu đủ lính hoặc không có ô trong tầm. */
export function spawnMinion(state: GameState, owner: Unit, stats: UnitStats): boolean {
  const cfg = state.config.skills.summoner;
  if (state.minions.filter((m) => m.ownerId === owner.id).length >= cfg.maxMinions) return false;
  const from = unitPos(state, owner);
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (const t of pathTiles(state.map.path)) {
    const c = tileCenter(t);
    const d = Math.hypot(c.x - from.x, c.y - from.y);
    if (d <= stats.range && d < bestDist) { best = t; bestDist = d; }
  }
  if (best === null) return false;
  const hp = cfg.minionHpPerLevel * owner.level;
  state.minions.push({
    id: newId(state),
    ownerId: owner.id,
    pos: tileCenter(best),
    pathDistance: distanceOfTile(state.map.path, best),
    hp,
    maxHp: hp,
    damage: cfg.minionDamageRatio * stats.damage,
    attackCooldown: 0,
    lifetime: cfg.minionLifetime,
  });
  return true;
}

/** Gỡ chặn mọi quái bị lính `minionId` giữ. */
export function releaseBlocked(state: GameState, minionId: number): void {
  for (const e of state.enemies) if (e.blockedBy === minionId) e.blockedBy = null;
}

/** Xóa một lính và giải phóng quái bị nó chặn. */
export function removeMinion(state: GameState, minionId: number): void {
  releaseBlocked(state, minionId);
  state.minions = state.minions.filter((m) => m.id !== minionId);
}

export function removeMinionsOf(state: GameState, ownerId: number): void {
  for (const m of state.minions) if (m.ownerId === ownerId) releaseBlocked(state, m.id);
  state.minions = state.minions.filter((m) => m.ownerId !== ownerId);
}

export function updateMinions(state: GameState, dt: number): void {
  const cfg = state.config.skills.summoner;
  for (const m of [...state.minions]) {
    m.lifetime -= dt;
    const blocked = state.enemies.filter((e) => !e.dead && e.blockedBy === m.id);
    for (const e of blocked) m.hp -= e.minionDps * dt;
    m.attackCooldown -= dt;
    if (m.attackCooldown <= 0) {
      if (blocked.length > 0) {
        damageEnemy(state, blocked[0], m.damage, false);
        m.attackCooldown = 1 / cfg.minionAttackRate;
      } else {
        m.attackCooldown = 0;
      }
    }
    if (m.hp <= 0 || m.lifetime <= 0) removeMinion(state, m.id);
  }
}
