import type { GameConfig, ModifierDef, WaveDef } from '../config';
import type { Rng } from './rng';
import { positionAt } from './path';
import { damageEnemy } from './combat';
import { newId } from './state';
import type { Enemy, EnemyKind, GameState, ModifierId, Vec } from './types';

const NEUTRAL: ModifierDef = {
  name: '', desc: '',
  speedMult: 1, goldDropMult: 1, countMult: 1, hpMult: 1, damageTakenMult: 1, waveRewardMult: 1, rangeMult: 1,
};

/** Modifier đang áp dụng; bộ toàn 1 khi không có. */
export function modifierOf(state: GameState): ModifierDef {
  return state.modifier ? state.config.modifiers[state.modifier] : NEUTRAL;
}

/** Wave dưới fromWave → null; ngược lại có xác suất chance, chọn đều. */
export function rollModifier(cfg: GameConfig, rng: Rng, wave: number): ModifierId | null {
  if (wave < cfg.modifierRules.fromWave) return null;
  if (!rng.chance(cfg.modifierRules.chance)) return null;
  return rng.pick(Object.keys(cfg.modifiers) as ModifierId[]);
}

/** Số lượng nhân countMult làm tròn lên, trừ boss. Sắp theo thời điểm. */
export function buildSpawnQueue(def: WaveDef, countMult: number): { kind: EnemyKind; at: number }[] {
  const queue: { kind: EnemyKind; at: number }[] = [];
  for (const g of def.groups) {
    const count = g.kind === 'boss' ? g.count : Math.ceil(g.count * countMult - 1e-9);
    for (let i = 0; i < count; i++) queue.push({ kind: g.kind, at: g.delay + i * g.interval });
  }
  return queue.sort((a, b) => a.at - b.at);
}

export function spawnEnemy(state: GameState, kind: EnemyKind): Enemy {
  const cfg = state.config;
  const def = cfg.enemies[kind];
  const mod = modifierOf(state);
  const hp = def.hp * cfg.enemyScaling.hpGrowth ** (state.wave - 1) * mod.hpMult;
  const enemy: Enemy = {
    id: newId(state),
    kind,
    hp,
    maxHp: hp,
    speed: def.speed,
    distance: 0,
    armor: def.armor,
    leakDamage: def.leak,
    goldDrop: def.gold * mod.goldDropMult,
    minionDps: def.minionDps,
    blockedBy: null,
    burn: null,
    dead: false,
  };
  state.enemies.push(enemy);
  return enemy;
}

const BURN_EVENT_INTERVAL = 0.5;

/** Cháy: trừ máu mỗi tick nhưng chỉ phát event damage gộp mỗi 0.5s (và khi hết cháy / chết). */
function tickBurn(state: GameState, e: Enemy, dt: number): void {
  const b = e.burn!;
  const step = Math.min(dt, b.remaining);
  b.remaining -= step;
  b.acc += damageEnemy(state, e, b.dps * step, false, false);
  b.timer += step;
  if (b.acc > 0 && (b.timer >= BURN_EVENT_INTERVAL - 1e-9 || b.remaining <= 0 || e.dead)) {
    state.events.push({ type: 'damage', pos: enemyPos(state, e), amount: b.acc, crit: false });
    b.acc = 0;
    b.timer = 0;
  }
  if (b.remaining <= 0 || e.dead) e.burn = null;
}

export function updateEnemies(state: GameState, dt: number): void {
  state.waveTime += dt;
  while (state.spawnQueue.length > 0 && state.spawnQueue[0].at <= state.waveTime) {
    spawnEnemy(state, state.spawnQueue.shift()!.kind);
  }

  const speedMult = modifierOf(state).speedMult;
  const remaining: Enemy[] = [];
  for (const e of state.enemies) {
    if (!e.dead && e.burn) tickBurn(state, e, dt);
    if (!e.dead && e.blockedBy === null) e.distance += e.speed * speedMult * dt;
    if (!e.dead && e.distance >= state.pathLen) {
      state.hp = Math.max(0, state.hp - e.leakDamage);
      state.events.push({ type: 'leak', amount: e.leakDamage });
      continue;
    }
    remaining.push(e);
  }
  state.enemies = remaining;
  if (state.hp <= 0) state.phase = 'lost';
}

export function enemyPos(state: GameState, e: Enemy): Vec {
  return positionAt(state.map.path, e.distance);
}
