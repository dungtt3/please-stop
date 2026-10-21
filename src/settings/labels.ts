import { stripIndices } from './configStore';

/** Nhãn tiếng Việt theo đường dẫn khóa; `*` khớp đúng một đoạn. Chỉ số mảng bị bỏ khi tra (trừ khi có nhãn riêng). */
export const LABELS: Record<string, string> = {
  // ---- Map
  map: 'Bản đồ',
  'map.cols': 'Số cột',
  'map.rows': 'Số hàng',
  'map.path': 'Điểm đường',
  'map.path.x': 'Cột',
  'map.path.y': 'Hàng',
  'map.slots': 'Ô đặt',
  'map.slots.x': 'Cột',
  'map.slots.y': 'Hàng',

  // ---- Kinh tế
  economy: 'Kinh tế',
  'economy.startHp': 'Máu căn cứ khởi đầu',
  'economy.startGold': 'Vàng khởi đầu',
  'economy.prepSeconds': 'Thời gian chuẩn bị (giây)',
  'economy.totalWaves': 'Tổng số wave',
  'economy.maxLevel': 'Cấp tối đa',
  'economy.handLimit': 'Số thẻ tối đa trên tay',
  'economy.rangeCardCap': 'Tầm đánh cộng từ thẻ tối đa (ô)',
  'economy.baseRarityWeights': 'Trọng số độ hiếm cơ bản',
  'economy.baseRarityWeights.0': 'Thường',
  'economy.baseRarityWeights.1': 'Hiếm',
  'economy.baseRarityWeights.2': 'Sử thi',
  'economy.luckStep': 'Đổi trọng số mỗi bậc Luck',
  'economy.luckStep.0': 'Thường',
  'economy.luckStep.1': 'Hiếm',
  'economy.luckStep.2': 'Sử thi',
  'economy.maxLuck': 'Bậc Luck tối đa',
  'economy.summonCost': 'Giá triệu hồi',
  'economy.summonCost.base': 'Giá gốc',
  'economy.summonCost.step': 'Tăng mỗi lần mua',
  'economy.drawCost': 'Giá rút thẻ',
  'economy.drawCost.base': 'Giá gốc',
  'economy.drawCost.step': 'Tăng mỗi lần mua',
  'economy.luckCost': 'Giá nâng Luck',
  'economy.luckCost.base': 'Giá gốc',
  'economy.luckCost.mult': 'Hệ số nhân mỗi bậc',
  'economy.rarityBonus': 'Khoảng cộng ngẫu nhiên theo độ hiếm',
  'economy.rarityBonus.*': 'Khoảng cộng',
  'economy.rarityBonus.common': 'Thường',
  'economy.rarityBonus.rare': 'Hiếm',
  'economy.rarityBonus.epic': 'Sử thi',
  'economy.rarityBonus.*.0': 'Tối thiểu',
  'economy.rarityBonus.*.1': 'Tối đa',
  'economy.attackSpeedPerLevel': 'Tốc đánh cộng mỗi cấp',
  'economy.waveReward': 'Thưởng cuối wave',
  'economy.waveReward.base': 'Thưởng gốc',
  'economy.waveReward.perWave': 'Cộng thêm mỗi wave',

  // ---- Thẻ
  cards: 'Thẻ',
  'cards.values': 'Giá trị thẻ',
  'cards.values.damage': 'Sát thương',
  'cards.values.attackSpeed': 'Tốc đánh',
  'cards.values.range': 'Tầm đánh',
  'cards.values.crit': 'Chí mạng',
  'cards.values.*.common': 'Thường',
  'cards.values.*.rare': 'Hiếm',
  'cards.values.*.epic': 'Sử thi',
  'cards.goldValue': 'Vàng khi đổi thẻ (tay đầy)',
  'cards.goldValue.common': 'Thường',
  'cards.goldValue.rare': 'Hiếm',
  'cards.goldValue.epic': 'Sử thi',

  // ---- Nhân vật
  classes: 'Nhân vật',
  'classes.swordsman': 'Kiếm sĩ',
  'classes.archer': 'Cung thủ',
  'classes.mage': 'Pháp sư',
  'classes.summoner': 'Triệu hồi sư',
  'classes.*.name': 'Tên',
  'classes.*.color': 'Màu (số)',
  'classes.*.base': 'Chỉ số gốc',
  'classes.*.base.damage': 'Sát thương',
  'classes.*.base.attackSpeed': 'Tốc đánh',
  'classes.*.base.range': 'Tầm đánh (ô)',
  'classes.*.base.critChance': 'Tỉ lệ chí mạng',
  'classes.*.base.critMultiplier': 'Hệ số chí mạng',
  'classes.*.passive': 'Mô tả nội tại',
  'classes.*.active': 'Mô tả skill chủ động',
  levelDamage: 'Hệ số sát thương theo cấp',

  // ---- Skill
  skills: 'Skill',
  'skills.swordsman': 'Kiếm sĩ',
  'skills.archer': 'Cung thủ',
  'skills.mage': 'Pháp sư',
  'skills.summoner': 'Triệu hồi sư',
  'skills.swordsman.comboEvery': 'Đòn thứ mấy gấp đôi',
  'skills.swordsman.comboMult': 'Hệ số đòn gấp',
  'skills.swordsman.whirlMult': 'Hệ số Chém xoáy',
  'skills.swordsman.cooldown': 'Hồi chiêu (giây)',
  'skills.archer.rainArrows': 'Số mũi tên Mưa tên',
  'skills.archer.rainMult': 'Hệ số mỗi mũi tên',
  'skills.archer.cooldown': 'Hồi chiêu (giây)',
  'skills.mage.splashRadius': 'Bán kính nổ lan (ô)',
  'skills.mage.burnRatio': 'Tỉ lệ sát thương thiêu cháy',
  'skills.mage.burnDuration': 'Thời gian cháy (giây)',
  'skills.mage.meteorMult': 'Hệ số Thiên thạch',
  'skills.mage.meteorRadius': 'Bán kính Thiên thạch (ô)',
  'skills.mage.cooldown': 'Hồi chiêu (giây)',
  'skills.summoner.passiveEvery': 'Gọi lính mỗi (giây)',
  'skills.summoner.waveCount': 'Số lính mỗi đợt gọi',
  'skills.summoner.maxMinions': 'Số lính tối đa',
  'skills.summoner.minionLifetime': 'Thời gian tồn tại của lính (giây)',
  'skills.summoner.minionDamageRatio': 'Tỉ lệ sát thương của lính',
  'skills.summoner.minionHpPerLevel': 'Máu lính mỗi cấp',
  'skills.summoner.minionAttackRate': 'Tốc đánh của lính',
  'skills.summoner.cooldown': 'Hồi chiêu (giây)',
  skillCooldownPerLevel: 'Giảm hồi chiêu mỗi cấp',

  // ---- Quái
  enemies: 'Quái',
  'enemies.normal': 'Quái thường',
  'enemies.fast': 'Quái nhanh',
  'enemies.tank': 'Quái giáp (Trâu)',
  'enemies.boss': 'Trùm',
  'enemies.*.name': 'Tên',
  'enemies.*.hp': 'Máu',
  'enemies.*.speed': 'Tốc độ (ô/giây)',
  'enemies.*.leak': 'Sát thương khi lọt',
  'enemies.*.gold': 'Vàng rơi',
  'enemies.*.armor': 'Giáp (giảm sát thương)',
  'enemies.*.minionDps': 'Sát thương lên lính (mỗi giây)',
  'enemies.*.color': 'Màu (số)',
  enemyScaling: 'Tăng trưởng quái',
  'enemyScaling.hpGrowth': 'Hệ số tăng máu mỗi wave',

  // ---- Wave
  waves: 'Wave',
  'waves.groups': 'Nhóm quái',
  'waves.groups.kind': 'Loại quái',
  'waves.groups.count': 'Số lượng',
  'waves.groups.interval': 'Giãn cách (giây)',
  'waves.groups.delay': 'Xuất hiện sau (giây)',

  // ---- Modifier
  modifiers: 'Modifier',
  'modifiers.frenzy': 'Cuồng nộ',
  'modifiers.goldRain': 'Mưa vàng',
  'modifiers.swarm': 'Bầy đàn',
  'modifiers.ironArmor': 'Giáp sắt',
  'modifiers.darkness': 'Bóng tối',
  'modifiers.*.name': 'Tên',
  'modifiers.*.desc': 'Mô tả',
  'modifiers.*.speedMult': 'Hệ số tốc độ quái',
  'modifiers.*.goldDropMult': 'Hệ số vàng rơi',
  'modifiers.*.countMult': 'Hệ số số lượng quái',
  'modifiers.*.hpMult': 'Hệ số máu quái',
  'modifiers.*.damageTakenMult': 'Hệ số sát thương quái nhận',
  'modifiers.*.waveRewardMult': 'Hệ số thưởng wave',
  'modifiers.*.rangeMult': 'Hệ số tầm đánh',
  modifierRules: 'Luật xuất hiện modifier',
  'modifierRules.fromWave': 'Từ wave',
  'modifierRules.chance': 'Xác suất mỗi wave',

  // ---- Quiz
  quiz: 'Quiz',
  'quiz.timeLimit': 'Thời gian trả lời (giây)',
  'quiz.fastTime': 'Ngưỡng trả lời nhanh (giây)',
  'quiz.fastGoldMult': 'Hệ số vàng khi trả lời nhanh',
  'quiz.baseGold': 'Vàng thưởng gốc',
  'quiz.goldPerWave': 'Cộng thêm mỗi wave',
  'quiz.bands': 'Mốc độ khó',
  'quiz.bands.fromWave': 'Từ wave',
  'quiz.bands.ops': 'Phép tính',
  'quiz.bands.addMax': 'Toán hạng tối đa (+, −)',
  'quiz.bands.mulMax': 'Thừa số tối đa (×, ÷)',
};

const PATTERNS = Object.keys(LABELS)
  .map((p) => ({ p, segs: p.split('.') }))
  .sort((a, b) => a.segs.filter((s) => s === '*').length - b.segs.filter((s) => s === '*').length);

function lookup(segs: string[]): string | undefined {
  if (!segs.length) return undefined;
  for (const { p, segs: ps } of PATTERNS) {
    if (ps.length === segs.length && ps.every((s, i) => s === '*' || s === segs[i])) return LABELS[p];
  }
  return undefined;
}

/** Nhãn tiếng Việt của một đường dẫn khóa; không có nhãn thì trả khóa cuối. */
export function labelFor(path: string): string {
  const segs = path.split('.');
  return lookup(segs) ?? lookup(stripIndices(path).split('.')) ?? segs[segs.length - 1];
}
