import { DEFAULT_CONFIG, type GameConfig } from '../config';
import { createRng } from './rng';
import { pathLength } from './path';
import type { GameState } from './types';

export function createGame(seed: number, config: GameConfig = DEFAULT_CONFIG): GameState {
  const cfg = structuredClone(config);
  return {
    rng: createRng(seed),
    config: cfg,
    map: cfg.map,
    pathLen: pathLength(cfg.map.path),
    phase: 'prep',
    hp: cfg.economy.startHp,
    gold: cfg.economy.startGold,
    wave: 1,
    prepTimer: cfg.economy.prepSeconds,
    slots: cfg.map.slots.map(() => null),
    units: new Map(),
    hand: [],
    summonCount: 0,
    drawCount: 0,
    luckLevel: 0,
    enemies: [],
    minions: [],
    spawnQueue: [],
    waveTime: 0,
    modifier: null,
    quiz: null,
    quizUsedThisPrep: false,
    kills: 0,
    events: [],
    nextId: 1,
  };
}

export function newId(state: GameState): number {
  return state.nextId++;
}
