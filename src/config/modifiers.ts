import type { ModifierId } from '../sim/types';

export interface ModifierDef {
  name: string;
  desc: string;
  speedMult: number;
  goldDropMult: number;
  countMult: number;
  hpMult: number;
  damageTakenMult: number;
  waveRewardMult: number;
  rangeMult: number;
}

export interface ModifierRules {
  /** Wave đầu tiên có thể xuất hiện modifier. */
  fromWave: number;
  /** Xác suất có modifier mỗi wave (từ fromWave). */
  chance: number;
}

const base = {
  speedMult: 1, goldDropMult: 1, countMult: 1, hpMult: 1, damageTakenMult: 1, waveRewardMult: 1, rangeMult: 1,
};

export const MODIFIERS: Record<ModifierId, ModifierDef> = {
  frenzy: { ...base, name: 'Cuồng nộ', desc: 'Quái chạy nhanh hơn 30%, rơi vàng ×1.5', speedMult: 1.3, goldDropMult: 1.5 },
  goldRain: { ...base, name: 'Mưa vàng', desc: 'Quái rơi vàng ×2', goldDropMult: 2 },
  swarm: { ...base, name: 'Bầy đàn', desc: 'Số quái ×1.5 nhưng máu chỉ 70%', countMult: 1.5, hpMult: 0.7 },
  ironArmor: { ...base, name: 'Giáp sắt', desc: 'Quái chịu 80% sát thương, thưởng wave ×2', damageTakenMult: 0.8, waveRewardMult: 2 },
  darkness: { ...base, name: 'Bóng đêm', desc: 'Tầm đánh giảm 20%, thưởng wave ×2', rangeMult: 0.8, waveRewardMult: 2 },
};

export const MODIFIER_RULES: ModifierRules = { fromWave: 2, chance: 0.5 };
