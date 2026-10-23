import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP } from '../../src/config/map';
import {
  askLayout, BOARD_COLS, BOARD_ROWS, BOTTOM_H, boardTile, btn, contains, GAME_H, GAME_W, gapBetween, hitAreas, LAYOUT, MAP_LEFT,
  MIN_GAP, MIN_HIT, MIN_TILE, overlaps, padOf, type Rect, RIGHT_X, SCREENS, START_ASK_MAX, TOP_BAR_H, topBarOwns,
} from '../../src/ui/layout';
import { PANEL_MAX_BOTTOM, PANEL_Y, PANEL_X } from '../../src/ui/unitPanelText';

const bottomOf = (r: Rect) => r.y + r.h;
const rightOf = (r: Rect) => r.x + r.w;

describe('helpers', () => {
  it('btn pads the hit rect and padOf recovers the pads', () => {
    const b = btn(100, 50, 40, 30, { x: 5, top: 2, bottom: 9 });
    expect(b.rect).toEqual({ x: 100, y: 50, w: 40, h: 30 });
    expect(b.hit).toEqual({ x: 95, y: 48, w: 50, h: 41 });
    expect(padOf(b)).toEqual({ left: 5, right: 5, top: 2, bottom: 9 });
  });
  it('gapBetween and overlaps', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(gapBetween(a, { x: 18, y: 0, w: 5, h: 5 })).toBe(8);
    expect(gapBetween(a, { x: 0, y: 13, w: 5, h: 5 })).toBe(3);
    expect(overlaps(a, { x: 9, y: 9, w: 5, h: 5 })).toBe(true);
    expect(overlaps(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
  });
});

describe('touch targets', () => {
  for (const screen of SCREENS) {
    describe(screen, () => {
      const hits = hitAreas(screen);
      it('has hit areas', () => expect(hits.length).toBeGreaterThan(0));
      for (const h of hits) {
        it(`${h.id} is at least ${MIN_HIT} on its smaller side`, () => {
          expect(Math.min(h.hit.w, h.hit.h)).toBeGreaterThanOrEqual(MIN_HIT);
        });
        it(`${h.id} lies inside ${GAME_W}×${GAME_H} (every position it can take)`, () => {
          const r = h.reach ?? h.hit;
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.y).toBeGreaterThanOrEqual(0);
          expect(rightOf(r)).toBeLessThanOrEqual(GAME_W);
          expect(bottomOf(r)).toBeLessThanOrEqual(GAME_H);
        });
        if (h.reach) {
          it(`${h.id} reach contains its hit`, () => {
            const r = h.reach!;
            expect(h.hit.x).toBeGreaterThanOrEqual(r.x);
            expect(h.hit.y).toBeGreaterThanOrEqual(r.y);
            expect(rightOf(h.hit)).toBeLessThanOrEqual(rightOf(r));
            expect(bottomOf(h.hit)).toBeLessThanOrEqual(bottomOf(r));
          });
        }
      }
      it(`no two hit areas overlap and each pair is ≥ ${MIN_GAP} apart`, () => {
        const bad: string[] = [];
        for (let i = 0; i < hits.length; i++) {
          for (let j = i + 1; j < hits.length; j++) {
            const a = hits[i].reach ?? hits[i].hit;
            const b = hits[j].reach ?? hits[j].hit;
            if (overlaps(a, b) || gapBetween(a, b) < MIN_GAP) bad.push(`${hits[i].id} × ${hits[j].id}`);
          }
        }
        expect(bad).toEqual([]);
      });
      it('ids are unique', () => {
        const ids = hits.map((h) => h.id);
        expect(new Set(ids).size).toBe(ids.length);
      });
    });
  }

  it('every visual rect sits inside its hit rect', () => {
    for (const b of [
      LAYOUT.top.gear, LAYOUT.top.speed, ...LAYOUT.bottom.buttons, ...LAYOUT.hand.cards, LAYOUT.hand.discard, LAYOUT.panel.sell,
      LAYOUT.popup.continue, LAYOUT.popup.sound, LAYOUT.popup.home, LAYOUT.popup.confirm.yes, LAYOUT.popup.confirm.no,
      LAYOUT.start.main, LAYOUT.start.secondary, LAYOUT.start.signOut, LAYOUT.result.replay, LAYOUT.result.home,
    ]) {
      const p = padOf(b);
      expect(Math.min(p.left, p.right, p.top, p.bottom)).toBeGreaterThanOrEqual(0);
    }
  });

  it('the start-screen ask box fits its largest choice list', () => {
    const a = askLayout(START_ASK_MAX);
    for (const c of a.choices) {
      expect(c.hit.y).toBeGreaterThanOrEqual(a.box.y);
      expect(bottomOf(c.rect)).toBeLessThanOrEqual(bottomOf(a.box));
    }
  });

  it('the volume slider hit covers the whole track and knob travel', () => {
    const s = LAYOUT.popup.slider;
    expect(s.hit.x).toBeLessThanOrEqual(s.x - s.knobR);
    expect(rightOf(s.hit)).toBeGreaterThanOrEqual(s.x + s.w + s.knobR);
    expect(contains(s.hit, s.x, s.y)).toBe(true);
  });
});

describe('board', () => {
  const board = LAYOUT.board;
  it(`tile is at least ${MIN_TILE}`, () => {
    expect(boardTile()).toBeGreaterThanOrEqual(MIN_TILE);
    expect(boardTile(DEFAULT_MAP.rows, DEFAULT_MAP.cols)).toBe(boardTile());
    expect(LAYOUT.tile).toBe(boardTile());
  });
  it('default map matches the layout grid', () => {
    expect(DEFAULT_MAP.cols).toBe(BOARD_COLS);
    expect(DEFAULT_MAP.rows).toBe(BOARD_ROWS);
  });
  it('fits between the bars', () => {
    expect(board.y).toBeGreaterThanOrEqual(TOP_BAR_H);
    expect(bottomOf(board)).toBeLessThanOrEqual(GAME_H - BOTTOM_H);
    expect(board.x).toBe(MAP_LEFT);
  });
  it('the map (16 cols × tile) ends left of the unit panel and boss bar, ≥ 8 apart', () => {
    expect(rightOf(board) + MIN_GAP).toBeLessThanOrEqual(RIGHT_X);
    expect(rightOf(board) + MIN_GAP).toBeLessThanOrEqual(PANEL_X);
    expect(rightOf(board) + MIN_GAP).toBeLessThanOrEqual(LAYOUT.bossBar.x);
  });
  it('no game-screen hit area overlaps the board (bottom bar hits do not reach into the last row)', () => {
    for (const h of hitAreas('game')) expect(overlaps(h.reach ?? h.hit, board), h.id).toBe(false);
    // Hàng cuối: y thuộc [đáy - tile, đáy) vẫn trên đường ranh của uiOwns (GAME_H - BOTTOM_H).
    const lastRowY = bottomOf(board) - 1;
    expect(lastRowY).toBeLessThan(GAME_H - BOTTOM_H);
    for (const b of LAYOUT.bottom.buttons) expect(b.hit.y).toBe(bottomOf(board));
  });
  it('top-bar hits that drop below the bar stay off the board', () => {
    for (const b of [LAYOUT.top.gear, LAYOUT.top.speed]) {
      expect(b.hit.y).toBe(0);
      expect(b.hit.x).toBeGreaterThanOrEqual(rightOf(board) + MIN_GAP);
    }
    // Vùng chạm ⚙ lấn dưới thanh trên được thanh trên giữ; ô bàn chơi thì không.
    const g = LAYOUT.top.gear.hit;
    expect(topBarOwns(g.x + 1, bottomOf(g) - 1)).toBe(true);
    expect(topBarOwns(board.x + 1, TOP_BAR_H + 1)).toBe(false);
    expect(topBarOwns(rightOf(board) - 1, TOP_BAR_H)).toBe(false);
  });
});

describe('right column', () => {
  it('boss bar sits below the top-bar hits and above the unit panel', () => {
    const bb = LAYOUT.bossBar;
    expect(bb.y).toBeGreaterThanOrEqual(bottomOf(LAYOUT.top.gear.hit) + MIN_GAP);
    expect(bottomOf(bb) + MIN_GAP).toBeLessThanOrEqual(PANEL_Y);
  });
  it('the unit panel and its sell hit end ≥ 8 above the bottom-bar hits', () => {
    const bottomTop = Math.min(...LAYOUT.bottom.buttons.map((b) => b.hit.y));
    expect(PANEL_MAX_BOTTOM + MIN_GAP).toBeLessThanOrEqual(bottomTop);
    expect(bottomOf(LAYOUT.panel.sell.reach!)).toBeLessThanOrEqual(PANEL_MAX_BOTTOM);
  });
});

describe('hand', () => {
  const h = LAYOUT.hand;
  it('a lifted card stays ≥ 8 below the bottom-bar hits and ≥ 82 tall', () => {
    const bottomEnd = Math.max(...LAYOUT.bottom.buttons.map((b) => bottomOf(b.hit)));
    for (const c of h.cards) {
      expect(c.hit.y - h.lift - bottomEnd).toBeGreaterThanOrEqual(MIN_GAP);
      expect(c.hit.h).toBeGreaterThanOrEqual(MIN_HIT);
    }
  });
  it('discard button does not cover any card', () => {
    for (const c of h.cards) expect(gapBetween(c.reach!, h.discard.hit)).toBeGreaterThanOrEqual(MIN_GAP);
  });
  it('card label and rarity line fit inside the card', () => {
    expect(h.rarityDy).toBeGreaterThanOrEqual(0);
    // Nhãn 2 dòng cỡ 22 (≈ 48 px) căn giữa ở labelDy.
    expect(h.labelDy - 24).toBeGreaterThanOrEqual(h.rarityDy + 27);
    expect(h.labelDy + 24).toBeLessThanOrEqual(h.cardH);
  });
});

describe('result form', () => {
  it('name input and send button share the form row', () => {
    const r = LAYOUT.result;
    expect(r.name.hit.y).toBe(r.form.y);
    expect(rightOf(r.send.hit)).toBe(rightOf(r.form));
    // ≈ 44 CSS px tại hệ số 390/720.
    expect(r.form.h * (390 / 720)).toBeGreaterThanOrEqual(44);
  });
});
