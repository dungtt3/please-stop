import type { MapDef } from '../sim/path';
import { DEFAULT_MAP } from './map';
import { ECONOMY, type EconomyConfig } from './economy';
import { CARDS, type CardsConfig } from './cards';
import { CLASSES, LEVEL_DAMAGE, type ClassDef } from './characters';
import type { ClassId } from '../sim/types';

/** Toàn bộ số cân bằng; chỉ chứa dữ liệu thuần (JSON). Các task sau thêm skills, enemies, waves, modifiers, modifierRules, quiz. */
export interface GameConfig {
  map: MapDef;
  economy: EconomyConfig;
  cards: CardsConfig;
  classes: Record<ClassId, ClassDef>;
  levelDamage: number[];
}

export const DEFAULT_CONFIG: GameConfig = {
  map: DEFAULT_MAP,
  economy: ECONOMY,
  cards: CARDS,
  classes: CLASSES,
  levelDamage: LEVEL_DAMAGE,
};
