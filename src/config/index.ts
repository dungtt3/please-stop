import type { MapDef } from '../sim/path';
import { DEFAULT_MAP } from './map';
import { ECONOMY, type EconomyConfig } from './economy';
import { CARDS, type CardsConfig } from './cards';
import { CLASSES, LEVEL_DAMAGE, type ClassDef } from './characters';
import { ENEMIES, ENEMY_SCALING, type EnemyDef, type EnemyScaling } from './enemies';
import { WAVES, type WaveDef } from './waves';
import { MODIFIERS, MODIFIER_RULES, type ModifierDef, type ModifierRules } from './modifiers';
import type { ClassId, EnemyKind, ModifierId } from '../sim/types';

export type { WaveDef, EnemyDef, EnemyScaling, ModifierDef, ModifierRules };

/** Toàn bộ số cân bằng; chỉ chứa dữ liệu thuần (JSON). Các task sau thêm skills, quiz. */
export interface GameConfig {
  map: MapDef;
  economy: EconomyConfig;
  cards: CardsConfig;
  classes: Record<ClassId, ClassDef>;
  levelDamage: number[];
  enemies: Record<EnemyKind, EnemyDef>;
  /** enemyScaling.hpGrowth: máu quái nhân hpGrowth^(wave-1). */
  enemyScaling: EnemyScaling;
  waves: WaveDef[];
  modifiers: Record<ModifierId, ModifierDef>;
  modifierRules: ModifierRules;
}

export const DEFAULT_CONFIG: GameConfig = {
  map: DEFAULT_MAP,
  economy: ECONOMY,
  cards: CARDS,
  classes: CLASSES,
  levelDamage: LEVEL_DAMAGE,
  enemies: ENEMIES,
  enemyScaling: ENEMY_SCALING,
  waves: WAVES,
  modifiers: MODIFIERS,
  modifierRules: MODIFIER_RULES,
};
