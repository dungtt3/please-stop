import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG as C } from '../../src/config';
import { computeStats, createUnit } from '../../src/sim/units';
import type { ClassId, Rarity } from '../../src/sim/types';
import {
  estimateLines, PANEL_LINE_PX, PANEL_MAX_BOTTOM, PANEL_Y, panelHeightForBody, unitPanelText,
} from '../../src/ui/unitPanelText';

describe('estimateLines', () => {
  it('counts wrapped lines by words', () => {
    expect(estimateLines('abc def', 10)).toBe(1);
    expect(estimateLines('abc def', 5)).toBe(2);
    expect(estimateLines('a\nb', 10)).toBe(2);
    expect(estimateLines('x'.repeat(25), 10)).toBe(3);
  });
});

describe('unit panel height', () => {
  const classes = Object.keys(C.classes) as ClassId[];
  const rarities: Rarity[] = ['common', 'rare', 'epic'];
  for (const id of classes) {
    for (const rarity of rarities) {
      it(`${id}/${rarity} with all four cards ends above the bottom bar`, () => {
        const u = createUnit(C, 1, id, 0, rarity, { damage: 0.5, attackSpeed: 0.5 }, 1000);
        u.level = 3;
        u.cards = { damage: 1.2, attackSpeed: 1.2, range: 2.5, crit: 0.5 };
        const text = unitPanelText(C, u, computeStats(C, u));
        const bodyH = estimateLines(text.body) * PANEL_LINE_PX;
        expect(PANEL_Y + panelHeightForBody(bodyH)).toBeLessThanOrEqual(PANEL_MAX_BOTTOM);
      });
    }
  }
  it('title carries the rarity name, not only color', () => {
    const u = createUnit(C, 1, 'mage', 0, 'epic', { damage: 0, attackSpeed: 0 }, 1);
    expect(unitPanelText(C, u, computeStats(C, u)).title).toContain('Sử thi');
  });
});
