import type { ClassId, UnitStats } from '../sim/types';

export interface ClassDef {
  name: string;
  color: number;
  base: UnitStats;
  passive: string;
  active: string;
}

export const LEVEL_DAMAGE: number[] = [1, 2.2, 4.8, 10, 21];

export const CLASSES: Record<ClassId, ClassDef> = {
  swordsman: {
    name: 'Kiếm sĩ', color: 0xe05a47,
    base: { damage: 20, attackSpeed: 1.0, range: 1.5, critChance: 0.05, critMultiplier: 2 },
    passive: '', active: '',
  },
  archer: {
    name: 'Cung thủ', color: 0x4caf50,
    base: { damage: 10, attackSpeed: 1.6, range: 4, critChance: 0.2, critMultiplier: 2 },
    passive: '', active: '',
  },
  mage: {
    name: 'Pháp sư', color: 0x7e57c2,
    base: { damage: 14, attackSpeed: 0.8, range: 3, critChance: 0.05, critMultiplier: 2 },
    passive: '', active: '',
  },
  summoner: {
    name: 'Triệu hồi sư', color: 0xffb300,
    base: { damage: 6, attackSpeed: 0.8, range: 2.5, critChance: 0.05, critMultiplier: 2 },
    passive: '', active: '',
  },
};
