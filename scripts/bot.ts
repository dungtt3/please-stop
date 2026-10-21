import { DEFAULT_CONFIG, type GameConfig } from '../src/config';
import { createGame } from '../src/sim/state';
import { startWave, tick } from '../src/sim/game';
import { applyCard, buyLuck, dragUnit, summon } from '../src/sim/commands';
import { canMerge, luckCost, summonCost } from '../src/sim/units';
import type { GameState } from '../src/sim/types';

const STEP = 0.05;
const MAX_GAME_SECONDS = 3 * 3600;

function unitAt(s: GameState, slot: number) {
  const id = s.slots[slot];
  return id === null ? null : s.units.get(id)!;
}

/** Gộp mọi cặp gộp được cho đến khi không còn. */
function mergeAll(s: GameState): void {
  for (let again = true; again; ) {
    again = false;
    for (let i = 0; i < s.slots.length && !again; i++) {
      const a = unitAt(s, i);
      if (!a) continue;
      for (let j = i + 1; j < s.slots.length; j++) {
        const b = unitAt(s, j);
        if (b && canMerge(s.config, a, b)) {
          dragUnit(s, i, j);
          again = true;
          break;
        }
      }
    }
  }
}

function botActions(s: GameState): void {
  const cfg = s.config;
  while (summonCost(cfg, s.summonCount) <= s.gold && s.slots.some((x) => x === null)) {
    if (!summon(s).ok) break;
    mergeAll(s);
  }
  mergeAll(s);
  // áp mọi thẻ vào con cấp cao nhất
  let best: number | null = null;
  s.slots.forEach((id, i) => {
    if (id === null) return;
    if (best === null || s.units.get(id)!.level > unitAt(s, best)!.level) best = i;
  });
  if (best !== null) for (const c of [...s.hand]) applyCard(s, c.id, best);
  while (s.luckLevel < cfg.economy.maxLuck && s.gold - luckCost(cfg, s.luckLevel) > 200) {
    if (!buyLuck(s).ok) break;
  }
}

export function runBot(seed: number, config: GameConfig = DEFAULT_CONFIG): GameState {
  const s = createGame(seed, config);
  let t = 0;
  while (s.phase !== 'won' && s.phase !== 'lost' && t < MAX_GAME_SECONDS) {
    botActions(s);
    if (s.phase === 'prep') startWave(s);
    tick(s, STEP);
    t += STEP;
    s.events.length = 0;
  }
  return s;
}
