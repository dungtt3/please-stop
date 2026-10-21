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
    passive: 'Mỗi đòn thứ 3 gây gấp đôi sát thương', active: 'Chém xoáy: 300% sát thương lên mọi quái trong tầm',
  },
  archer: {
    name: 'Cung thủ', color: 0x4caf50,
    base: { damage: 10, attackSpeed: 1.6, range: 4, critChance: 0.2, critMultiplier: 2 },
    passive: 'Chí mạng cao hơn (+15%)', active: 'Mưa tên: bắn 5 quái ngẫu nhiên, mỗi mũi 150% sát thương',
  },
  mage: {
    name: 'Pháp sư', color: 0x7e57c2,
    base: { damage: 14, attackSpeed: 0.8, range: 3, critChance: 0.05, critMultiplier: 2 },
    passive: 'Đòn nổ lan và thiêu cháy 3 giây', active: 'Thiên thạch: 500% sát thương lên cụm quái đông nhất',
  },
  summoner: {
    name: 'Triệu hồi sư', color: 0xffb300,
    base: { damage: 6, attackSpeed: 0.8, range: 2.5, critChance: 0.05, critMultiplier: 2 },
    passive: 'Cứ 6 giây gọi 1 lính', active: 'Gọi một đợt 3 lính',
  },
};

export interface SkillsConfig {
  swordsman: { comboEvery: number; comboMult: number; whirlMult: number; cooldown: number };
  archer: { rainArrows: number; rainMult: number; cooldown: number };
  mage: {
    splashRadius: number; burnRatio: number; burnDuration: number;
    meteorMult: number; meteorRadius: number; cooldown: number;
  };
  summoner: { cooldown: number };
}

export const SKILLS: SkillsConfig = {
  swordsman: { comboEvery: 3, comboMult: 2, whirlMult: 3, cooldown: 8 },
  archer: { rainArrows: 5, rainMult: 1.5, cooldown: 7 },
  mage: {
    splashRadius: 0.75, burnRatio: 0.3, burnDuration: 3,
    meteorMult: 5, meteorRadius: 1.5, cooldown: 12,
  },
  summoner: { cooldown: 14 },
};

/** Mỗi cấp giảm 8% hồi chiêu skill chủ động. */
export const SKILL_COOLDOWN_PER_LEVEL = 0.08;
