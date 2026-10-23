import { DEFAULT_CONFIG, type GameConfig } from '../config';
import { configHash } from '../settings/configHash';
import { mergeConfig } from '../settings/configStore';
import { pathLength } from './path';
import { createRng } from './rng';
import { RARITY_ORDER } from './types';
import type { Card, CardStat, GameState, ModifierId, Rarity, Unit } from './types';

export const SAVE_VERSION = 1;
/** Khi tiếp tục ván, giai đoạn chuẩn bị còn ít nhất chừng này giây. */
export const MIN_RESUME_PREP = 10;

const CARD_STATS: readonly CardStat[] = ['damage', 'attackSpeed', 'range', 'crit'];

export interface SavedGame {
  config: GameConfig;
  rngState: number;
  hp: number;
  gold: number;
  wave: number;
  prepTimer: number;
  slots: (number | null)[];
  units: Unit[];
  hand: Card[];
  summonCount: number;
  drawCount: number;
  luckLevel: number;
  modifier: ModifierId | null;
  quizUsedThisPrep: boolean;
  kills: number;
  nextId: number;
}

export interface RunSave {
  version: typeof SAVE_VERSION;
  runId: string;
  deviceId: string;
  /** Đang giữa wave lúc lưu (khi tiếp tục sẽ chạy lại wave đó). */
  inWave: boolean;
  runSeconds: number;
  savedAt: number;
  game: SavedGame;
}

/** Quiz đang mở hoặc đã dùng đều tính là đã dùng lượt quiz. */
export function snapshotRun(
  state: GameState,
  meta: { runId: string; deviceId: string; runSeconds: number; now: number },
): RunSave {
  return {
    version: SAVE_VERSION,
    runId: meta.runId,
    deviceId: meta.deviceId,
    inWave: state.phase === 'wave',
    runSeconds: meta.runSeconds,
    savedAt: meta.now,
    game: {
      config: structuredClone(state.config),
      rngState: state.rng.state(),
      hp: state.hp,
      gold: state.gold,
      wave: state.wave,
      prepTimer: state.prepTimer,
      slots: [...state.slots],
      units: [...state.units.values()].map((u) => structuredClone(u)),
      hand: state.hand.map((c) => ({ ...c })),
      summonCount: state.summonCount,
      drawCount: state.drawCount,
      luckLevel: state.luckLevel,
      modifier: state.modifier,
      quizUsedThisPrep: state.quizUsedThisPrep || state.quiz !== null,
      kills: state.kills,
      nextId: state.nextId,
    },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isName = (v: unknown): v is string => typeof v === 'string' && v !== '';
const isRarity = (v: unknown): v is Rarity => RARITY_ORDER.includes(v as Rarity);

function parseUnit(raw: unknown, cfg: GameConfig): Unit | null {
  if (!isObj(raw)) return null;
  const { id, classId, level, rarity, slot, bonus, cards, goldInvested, skillCooldown, passiveTimer, attackCount } = raw;
  if (!isInt(id) || !isInt(slot) || !isInt(level) || level < 1 || level > cfg.economy.maxLevel) return null;
  if (typeof classId !== 'string' || !Object.hasOwn(cfg.classes, classId) || !isRarity(rarity)) return null;
  if (!isObj(bonus) || !isNum(bonus.damage) || !isNum(bonus.attackSpeed)) return null;
  if (!isObj(cards) || !CARD_STATS.every((k) => isNum(cards[k]))) return null;
  if (!isNum(goldInvested) || !isNum(skillCooldown) || !isNum(passiveTimer) || !isNum(attackCount)) return null;
  return {
    id,
    classId: classId as Unit['classId'],
    level,
    rarity,
    slot,
    bonus: { damage: bonus.damage, attackSpeed: bonus.attackSpeed },
    cards: {
      damage: cards.damage as number,
      attackSpeed: cards.attackSpeed as number,
      range: cards.range as number,
      crit: cards.crit as number,
    },
    goldInvested,
    attackCooldown: isNum(raw.attackCooldown) ? raw.attackCooldown : 0,
    skillCooldown,
    passiveTimer,
    attackCount,
  };
}

function parseCard(raw: unknown): Card | null {
  if (!isObj(raw) || !isInt(raw.id) || !isRarity(raw.rarity)) return null;
  if (!CARD_STATS.includes(raw.stat as CardStat)) return null;
  return { id: raw.id, stat: raw.stat as CardStat, rarity: raw.rarity };
}

function parseGame(raw: unknown): SavedGame | null {
  if (!isObj(raw)) return null;
  const merged = mergeConfig(DEFAULT_CONFIG, raw.config);
  if (merged.errors.length > 0) return null;
  const config = merged.config;
  const { rngState, hp, gold, wave, prepTimer, summonCount, drawCount, luckLevel, kills, nextId } = raw;
  if (![rngState, hp, gold, prepTimer, summonCount, drawCount, luckLevel, kills].every(isNum)) return null;
  if (!isInt(wave) || wave < 1 || wave > config.economy.totalWaves || !isInt(nextId)) return null;
  if (typeof raw.quizUsedThisPrep !== 'boolean') return null;
  const modifier = raw.modifier;
  if (modifier !== null && (typeof modifier !== 'string' || !Object.hasOwn(config.modifiers, modifier))) return null;
  if (!Array.isArray(raw.slots) || raw.slots.length !== config.map.slots.length) return null;
  if (!Array.isArray(raw.units) || !Array.isArray(raw.hand) || raw.hand.length > config.economy.handLimit) return null;

  const units: Unit[] = [];
  for (const r of raw.units) {
    const u = parseUnit(r, config);
    if (!u) return null;
    units.push(u);
  }
  const byId = new Map(units.map((u) => [u.id, u]));
  const slots: (number | null)[] = [];
  for (const [i, v] of raw.slots.entries()) {
    if (v === null) slots.push(null);
    else if (isInt(v) && byId.get(v)?.slot === i) slots.push(v);
    else return null;
  }
  if (byId.size !== units.length || units.length !== slots.filter((v) => v !== null).length) return null;

  const hand: Card[] = [];
  for (const r of raw.hand) {
    const c = parseCard(r);
    if (!c) return null;
    hand.push(c);
  }
  const maxId = Math.max(0, ...units.map((u) => u.id), ...hand.map((c) => c.id));
  if (nextId <= maxId) return null;

  return {
    config,
    rngState: rngState as number,
    hp: hp as number,
    gold: gold as number,
    wave,
    prepTimer: prepTimer as number,
    slots,
    units,
    hand,
    summonCount: summonCount as number,
    drawCount: drawCount as number,
    luckLevel: luckLevel as number,
    modifier: modifier as ModifierId | null,
    quizUsedThisPrep: raw.quizUsedThisPrep,
    kills: kills as number,
    nextId,
  };
}

/** Kiểm tra bản lưu đọc từ bên ngoài (localStorage/cloud); hỏng thì null, hợp lệ thì trả bản đã chuẩn hóa. */
export function parseRunSave(raw: unknown): RunSave | null {
  try {
    if (!isObj(raw) || raw.version !== SAVE_VERSION) return null;
    if (!isName(raw.runId) || !isName(raw.deviceId) || typeof raw.inWave !== 'boolean') return null;
    if (!isNum(raw.runSeconds) || !isNum(raw.savedAt)) return null;
    const game = parseGame(raw.game);
    if (!game) return null;
    return {
      version: SAVE_VERSION,
      runId: raw.runId,
      deviceId: raw.deviceId,
      inWave: raw.inWave,
      runSeconds: raw.runSeconds,
      savedAt: raw.savedAt,
      game,
    };
  } catch {
    return null;
  }
}

/** Tiếp tục luôn ở giai đoạn chuẩn bị của wave đã lưu. */
export function restoreGame(save: RunSave): GameState {
  const g = save.game;
  const config = structuredClone(g.config);
  const units = new Map<number, Unit>();
  for (const u of g.units) units.set(u.id, { ...structuredClone(u), attackCooldown: 0 });
  return {
    rng: createRng(g.rngState),
    config,
    map: config.map,
    pathLen: pathLength(config.map.path),
    phase: 'prep',
    hp: g.hp,
    gold: g.gold,
    wave: g.wave,
    prepTimer: Math.max(MIN_RESUME_PREP, g.prepTimer),
    slots: [...g.slots],
    units,
    hand: g.hand.map((c) => ({ ...c })),
    summonCount: g.summonCount,
    drawCount: g.drawCount,
    luckLevel: g.luckLevel,
    enemies: [],
    minions: [],
    spawnQueue: [],
    waveTime: 0,
    modifier: g.modifier,
    quiz: null,
    quizUsedThisPrep: g.quizUsedThisPrep,
    kills: g.kills,
    events: [],
    nextId: g.nextId,
  };
}

/** Số liệu để ghi ván bỏ dở lên bảng xếp hạng. */
export function runStatsOf(save: RunSave): { waveReached: number; won: false; kills: number; durationS: number; configHash: string } {
  return {
    waveReached: save.game.wave,
    won: false,
    kills: save.game.kills,
    durationS: save.runSeconds,
    configHash: configHash(save.game.config),
  };
}

/** Chỉ đổi khi ván thật sự đổi (bỏ đồng hồ chuẩn bị, thời gian chơi, savedAt). */
export function saveFingerprint(save: RunSave): string {
  const { prepTimer: _prepTimer, ...game } = save.game;
  return JSON.stringify({ game, inWave: save.inWave });
}
