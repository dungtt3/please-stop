import { buildSpawnQueue, modifierOf, rollModifier, updateEnemies } from './enemies';
import { removeDead, updateUnits } from './combat';
import { releaseBlocked, updateMinions } from './minions';
import { updateQuiz } from './quiz';
import type { GameState } from './types';

const MAX_STEP = 0.05;

/** Chỉ chạy từ giai đoạn chuẩn bị. */
export function startWave(state: GameState): void {
  if (state.phase !== 'prep') return;
  const def = state.config.waves[state.wave - 1];
  state.phase = 'wave';
  state.waveTime = 0;
  state.spawnQueue = buildSpawnQueue(def, modifierOf(state).countMult);
  state.events.push({ type: 'waveStart', wave: state.wave });
}

function endWave(state: GameState): void {
  const cfg = state.config;
  const { base, perWave } = cfg.economy.waveReward;
  const reward = Math.round((base + perWave * state.wave) * modifierOf(state).waveRewardMult);
  state.gold += reward;
  state.events.push({ type: 'waveEnd', wave: state.wave, reward });
  if (state.wave >= cfg.economy.totalWaves) {
    state.phase = 'won';
    return;
  }
  state.wave++;
  state.phase = 'prep';
  state.prepTimer = cfg.economy.prepSeconds;
  state.modifier = rollModifier(cfg, state.rng, state.wave);
  state.quizUsedThisPrep = false;
  for (const m of state.minions) releaseBlocked(state, m.id);
  state.minions = [];
  for (const u of state.units.values()) u.attackCooldown = 0;
}

function step(state: GameState, dt: number): void {
  updateQuiz(state, dt);
  if (state.phase === 'prep') {
    state.prepTimer -= dt;
    if (state.prepTimer <= 0) startWave(state);
  }
  if (state.phase === 'wave') {
    // updateEnemies tự cộng waveTime
    updateEnemies(state, dt);
    if (state.phase !== 'wave') return; // thua
    updateMinions(state, dt);
    updateUnits(state, dt);
    removeDead(state);
    if (state.spawnQueue.length === 0 && state.enemies.length === 0) endWave(state);
  }
}

export function tick(state: GameState, dt: number): void {
  let left = dt;
  while (left > 1e-9 && state.phase !== 'won' && state.phase !== 'lost') {
    const d = Math.min(MAX_STEP, left);
    step(state, d);
    left -= d;
  }
}
