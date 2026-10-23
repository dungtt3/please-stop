import type { GameConfig } from '../config';
import type { MapDef } from './path';
import type { Rng } from './rng';

export interface Vec {
  x: number;
  y: number;
}

export type ClassId = 'swordsman' | 'archer' | 'mage' | 'summoner';
export type Rarity = 'common' | 'rare' | 'epic';
export const RARITY_ORDER: readonly Rarity[] = ['common', 'rare', 'epic'];
export type CardStat = 'damage' | 'attackSpeed' | 'range' | 'crit';

export interface Card {
  id: number;
  stat: CardStat;
  rarity: Rarity;
}

export interface Unit {
  id: number;
  classId: ClassId;
  level: number;
  rarity: Rarity;
  slot: number;
  bonus: { damage: number; attackSpeed: number };
  cards: Record<CardStat, number>;
  goldInvested: number;
  attackCooldown: number;
  skillCooldown: number;
  passiveTimer: number;
  attackCount: number;
}

export interface UnitStats {
  damage: number;
  attackSpeed: number;
  range: number;
  critChance: number;
  critMultiplier: number;
}

export type Phase = 'prep' | 'wave' | 'won' | 'lost';
export type EnemyKind = 'normal' | 'fast' | 'tank' | 'boss';
export type ModifierId = 'frenzy' | 'goldRain' | 'swarm' | 'ironArmor' | 'darkness';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  speed: number;
  distance: number;
  armor: number;
  leakDamage: number;
  goldDrop: number;
  minionDps: number;
  blockedBy: number | null;
  /** acc/timer: sát thương cháy chờ phát event damage gộp mỗi 0.5s. */
  burn: { dps: number; remaining: number; acc: number; timer: number } | null;
  dead: boolean;
}

export interface Minion {
  id: number;
  ownerId: number;
  pos: Vec;
  pathDistance: number;
  hp: number;
  maxHp: number;
  damage: number;
  attackCooldown: number;
  lifetime: number;
}

export interface QuizQuestion {
  text: string;
  answer: number;
  options: number[];
}

export interface QuizState {
  question: QuizQuestion;
  elapsed: number;
  result: null | 'correct' | 'wrong' | 'timeout';
}

export type GameEvent =
  | { type: 'damage'; pos: Vec; amount: number; crit: boolean }
  | { type: 'kill'; pos: Vec; gold: number; enemyId: number; kind: EnemyKind }
  | { type: 'leak'; amount: number }
  | { type: 'attack'; source: 'unit' | 'minion'; id: number; classId: ClassId | 'minion'; from: Vec; to: Vec; crit: boolean }
  | { type: 'summon'; unitId: number }
  | { type: 'merge'; unitId: number }
  | { type: 'quiz'; result: 'correct' | 'wrong' | 'timeout' }
  | {
      type: 'skill';
      unitId: number;
      skill: ClassId;
      /** vị trí nhân vật */
      pos: Vec;
      /** swordsman: tầm vòng chém */
      range?: number;
      /** archer: các điểm trúng */
      hits?: Vec[];
      /** mage: tâm + bán kính thiên thạch */
      center?: Vec;
      radius?: number;
      /** summoner: chỗ lính xuất hiện */
      spawns?: Vec[];
    }
  | { type: 'cardGranted'; card: Card }
  | { type: 'cardConverted'; gold: number }
  | { type: 'waveStart'; wave: number }
  | { type: 'waveEnd'; wave: number; reward: number };

export interface GameState {
  rng: Rng;
  config: GameConfig;
  map: MapDef;
  pathLen: number;
  phase: Phase;
  hp: number;
  gold: number;
  /** wave hiện tại hoặc sắp tới, 1..15 */
  wave: number;
  prepTimer: number;
  /** id unit theo slot */
  slots: (number | null)[];
  units: Map<number, Unit>;
  hand: Card[];
  summonCount: number;
  drawCount: number;
  luckLevel: number;
  enemies: Enemy[];
  minions: Minion[];
  spawnQueue: { kind: EnemyKind; at: number }[];
  waveTime: number;
  modifier: ModifierId | null;
  quiz: QuizState | null;
  quizUsedThisPrep: boolean;
  kills: number;
  events: GameEvent[];
  nextId: number;
}

export type CommandResult =
  | { ok: true }
  | { ok: false; reason: 'gold' | 'noSlot' | 'handFull' | 'invalid' | 'maxLuck' | 'rangeCap' | 'gameOver' };
