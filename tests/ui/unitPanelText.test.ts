import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG as C } from '../../src/config';
import { LAYOUT } from '../../src/ui/layout';
import { computeStats, createUnit } from '../../src/sim/units';
import type { ClassId, Rarity } from '../../src/sim/types';
import {
  estimateLines, fitBody, PANEL_BODY_TOP, PANEL_LINE_PX, PANEL_MAX_BODY_H, PANEL_MAX_BODY_LINES, PANEL_MAX_BOTTOM, PANEL_Y,
  panelHeightForBody, unitPanelText,
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

describe('over-long admin text', () => {
  const long = 'Một đoạn mô tả rất dài do quản trị viên sửa, '.repeat(40);
  const u = createUnit(C, 1, 'mage', 0, 'epic', { damage: 0.5, attackSpeed: 0.5 }, 1000);
  const cfg = {
    ...C,
    classes: { ...C.classes, mage: { ...C.classes.mage, passive: long, active: long } },
  };

  it('body is cropped with an ellipsis and the panel never passes the max bottom', () => {
    const text = unitPanelText(cfg, u, computeStats(cfg, u));
    expect(text.body.length).toBeLessThan(long.length);
    expect(text.body.endsWith('…')).toBe(true);
    expect(estimateLines(text.body)).toBeLessThanOrEqual(PANEL_MAX_BODY_LINES);
    const bodyH = estimateLines(text.body) * PANEL_LINE_PX;
    expect(bodyH).toBeLessThanOrEqual(PANEL_MAX_BODY_H);
    expect(PANEL_Y + panelHeightForBody(bodyH)).toBeLessThanOrEqual(PANEL_MAX_BOTTOM);
  });

  it('a full-height body puts the Bán row at or above its LAYOUT position, whose hit stays above the bottom bar', () => {
    const rowY = PANEL_Y + PANEL_BODY_TOP + PANEL_MAX_BODY_H + LAYOUT.panel.actionGap;
    expect(rowY).toBeLessThanOrEqual(LAYOUT.panel.sell.rect.y);
    expect(LAYOUT.panel.sell.hit.y + LAYOUT.panel.sell.hit.h + 8).toBeLessThanOrEqual(LAYOUT.bottom.buttons[0].hit.y);
  });

  it('fitBody leaves short text untouched and always satisfies the bound', () => {
    const two = ['a', 'b'].join(String.fromCharCode(10));
    expect(fitBody(two, 5)).toBe(two);
    for (const n of [1, 2, 5, 9]) expect(estimateLines(fitBody(long, n))).toBeLessThanOrEqual(n);
  });
});
