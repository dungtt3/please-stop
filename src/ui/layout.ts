/**
 * Bố cục khung game 1280×720 và vùng chạm của mọi nút (thuần, không phụ thuộc Phaser để test được).
 *
 * Mục tiêu: điện thoại ngang 844×390 CSS px (hệ số ~0,54) → vùng chạm ≥ 82 px khung game (≈ 44 CSS px)
 * theo chiều nhỏ nhất, cách nhau ≥ 8 px, không chồng nhau, nằm trong khung; ô bàn chơi ≥ 50 px.
 *
 * Mỗi nút có `rect` (hình vẽ) và `hit` (vùng chạm, có thể lớn hơn hình). Nút di chuyển được (thẻ được
 * nâng lên khi chọn, nút Bán theo chiều cao bảng chi tiết) có thêm `reach`: hợp mọi vị trí vùng chạm có
 * thể có — test chồng nhau / khoảng cách dùng `reach`, test kích thước dùng `hit`.
 *
 * Quyết định hàng cuối bàn chơi: vùng chạm thanh dưới **không** lấn vào bàn chơi (bắt đầu đúng ở đáy
 * hàng cuối), nên `GameScene.uiOwns` không cần ưu tiên gì — chạm vào ô hàng cuối luôn thuộc bàn chơi.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Btn {
  rect: Rect;
  hit: Rect;
  /** Hợp mọi vị trí vùng chạm có thể có (nút di chuyển được). */
  reach?: Rect;
}

/** Phần mở rộng vùng chạm quanh hình vẽ (px khung game). */
export interface HitPad {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const GAME_W = 1280;
export const GAME_H = 720;
/** Vùng chạm tối thiểu theo chiều nhỏ nhất (≈ 44 CSS px ở 844×390). */
export const MIN_HIT = 82;
/** Khoảng cách tối thiểu giữa hai vùng chạm. */
export const MIN_GAP = 8;
/** Ô bàn chơi tối thiểu. */
export const MIN_TILE = 50;
export const MAX_TILE = 64;
/** Chiều cao thanh trên (hình). Nút ⚙/tốc độ có vùng chạm cao hơn, lấn xuống cột phải (không phải bàn chơi). */
export const TOP_BAR_H = 64;
/** Chiều cao dải dưới: hàng nút (chạm 82) + 8 + hàng thẻ (88, nâng 6) + lề. */
export const BOTTOM_H = 188;
/** Lề trái của bản đồ; phần còn lại bên phải dành cho thanh boss và bảng chi tiết nhân vật. */
export const MAP_LEFT = 16;
/** Chiều cao nút chữ nhật dùng chung (hình). */
export const BTN_H = 56;
/** Kích thước bản đồ mặc định (`DEFAULT_MAP`). */
export const BOARD_COLS = 16;
export const BOARD_ROWS = 9;

/** Cột phải (thanh boss + bảng chi tiết) bắt đầu ở x này. */
export const RIGHT_X = 856;
export const RIGHT_W = GAME_W - 8 - RIGHT_X;

const CX = GAME_W / 2;

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

/** Nút có hình `x,y,w,h` và vùng chạm mở rộng theo `pad` (mặc định bằng hình). */
export function btn(x: number, y: number, w: number, h: number, pad: Partial<HitPad> & { x?: number; y?: number } = {}): Btn {
  const left = pad.left ?? pad.x ?? 0;
  const right = pad.right ?? pad.x ?? 0;
  const top = pad.top ?? pad.y ?? 0;
  const bottom = pad.bottom ?? pad.y ?? 0;
  return { rect: rect(x, y, w, h), hit: rect(x - left, y - top, w + left + right, h + top + bottom) };
}

/** Phần mở rộng vùng chạm của một nút so với hình (để dựng hit area Phaser tương đối). */
export function padOf(b: Btn): HitPad {
  return {
    left: b.rect.x - b.hit.x,
    top: b.rect.y - b.hit.y,
    right: b.hit.x + b.hit.w - (b.rect.x + b.rect.w),
    bottom: b.hit.y + b.hit.h - (b.rect.y + b.rect.h),
  };
}

export function contains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

export function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return rect(x, y, Math.max(a.x + a.w, b.x + b.w) - x, Math.max(a.y + a.h, b.y + b.h) - y);
}

/** Khoảng cách giữa hai hình chữ nhật (0 nếu chạm/chồng; âm không dùng). */
export function gapBetween(a: Rect, b: Rect): number {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
  return Math.max(dx, dy);
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Ô bàn chơi tính từ chiều cao còn lại giữa hai thanh và chiều rộng trái cột phải. */
export function boardTile(rows = BOARD_ROWS, cols = BOARD_COLS): number {
  const availH = GAME_H - TOP_BAR_H - BOTTOM_H;
  const availW = RIGHT_X - MIN_GAP - MAP_LEFT;
  return Math.max(16, Math.floor(Math.min(MAX_TILE, availH / rows, availW / cols)));
}

const TILE = boardTile();
const BOARD = rect(MAP_LEFT, TOP_BAR_H + (GAME_H - TOP_BAR_H - BOTTOM_H - BOARD_ROWS * TILE) / 2, BOARD_COLS * TILE, BOARD_ROWS * TILE);
const BOTTOM_Y = GAME_H - BOTTOM_H;

// --- Thanh trên: nút tốc độ sát phải, ⚙ bên trái nó. Vùng chạm 0..82 theo chiều dọc.
const TOP_BTN_Y = 4;
const TOP_HIT = { top: TOP_BTN_Y, bottom: MIN_HIT - TOP_BTN_Y - BTN_H };
const SPEED = btn(GAME_W - 16 - 156, TOP_BTN_Y, 156, BTN_H, TOP_HIT);
const GEAR_W = 56;
const GEAR_PAD_X = (MIN_HIT - GEAR_W) / 2;
const GEAR = btn(SPEED.hit.x - MIN_GAP - GEAR_PAD_X - GEAR_W, TOP_BTN_Y, GEAR_W, BTN_H, { ...TOP_HIT, x: GEAR_PAD_X });

// --- Thanh dưới: 5 nút, hình cao 66, vùng chạm 82 (bắt đầu đúng ở đáy bàn chơi).
const BB_W = 240;
const BB_H = 66;
const BB_PAD_Y = (MIN_HIT - BB_H) / 2;
const BB_X0 = (GAME_W - (5 * BB_W + 4 * MIN_GAP)) / 2;
const BOTTOM_BUTTONS = [0, 1, 2, 3, 4].map((i) => btn(BB_X0 + i * (BB_W + MIN_GAP), BOTTOM_Y + BB_PAD_Y, BB_W, BB_H, { y: BB_PAD_Y }));

// --- Thẻ bài: hàng dưới cùng; thẻ được chọn nâng lên `LIFT` px (vẫn cách hàng nút ≥ 8).
const CARD_W = 150;
const CARD_H = 88;
const CARD_GAP = 10;
const MAX_CARDS = 5;
const LIFT = 6;
const CARD_Y = BOTTOM_Y + MIN_HIT + MIN_GAP + LIFT;
const CARD_X0 = (GAME_W - (MAX_CARDS * CARD_W + (MAX_CARDS - 1) * CARD_GAP)) / 2;
const CARDS: Btn[] = Array.from({ length: MAX_CARDS }, (_, i) => {
  const b = btn(CARD_X0 + i * (CARD_W + CARD_GAP), CARD_Y, CARD_W, CARD_H);
  return { ...b, reach: union(b.hit, { ...b.hit, y: b.hit.y - LIFT }) };
});
/** Nút "Bỏ thẻ": cố định bên phải hàng thẻ (không đè chữ của thẻ đang chọn). */
const DISCARD = btn(CARD_X0 + MAX_CARDS * (CARD_W + CARD_GAP) - CARD_GAP + 16, CARD_Y, 130, CARD_H);

// --- Cột phải: thanh boss rồi bảng chi tiết nhân vật.
const BOSS_BAR = rect(RIGHT_X, MIN_HIT + MIN_GAP, RIGHT_W, 30);
const PANEL_Y = BOSS_BAR.y + BOSS_BAR.h + MIN_GAP;
const PANEL_PAD = 8;
const PANEL_BODY_TOP = 36;
/** Khoảng cách từ đáy thân bảng tới hàng hồi chiêu + nút Bán. */
const PANEL_ACTION_GAP = 14;
const SELL_W = 200;
const SELL_PAD_Y = (MIN_HIT - BTN_H) / 2;
/** Lề dưới bảng = phần mở rộng vùng chạm của nút Bán (vùng chạm nằm gọn trong bảng). */
const PANEL_BOTTOM_PAD = SELL_PAD_Y;
/** Đáy tối đa của bảng: cách vùng chạm thanh dưới ≥ 8. */
const PANEL_MAX_BOTTOM = BOTTOM_Y - MIN_GAP;
const SELL_X = RIGHT_X + RIGHT_W - PANEL_PAD - SELL_W;
/** Nút Bán ở vị trí thấp nhất (bảng chạm đáy tối đa); `reach` từ thân bảng tới đáy tối đa. */
const SELL: Btn = (() => {
  const y = PANEL_MAX_BOTTOM - PANEL_BOTTOM_PAD - BTN_H;
  const b = btn(SELL_X, y, SELL_W, BTN_H, { y: SELL_PAD_Y });
  const top = PANEL_Y + PANEL_BODY_TOP;
  return { ...b, reach: rect(b.hit.x, top, b.hit.w, b.hit.y + b.hit.h - top) };
})();

// --- Quiz (đã đủ lớn).
const QUIZ_W = 760;
const QUIZ_H = 440;
const QUIZ_X = (GAME_W - QUIZ_W) / 2;
const QUIZ_Y = 110;
const QUIZ_ANSWERS = [0, 1, 2, 3].map((i) =>
  btn(QUIZ_X + 30 + (i % 2) * (340 + 20), QUIZ_Y + 165 + Math.floor(i / 2) * (90 + 14), 340, 90),
);

// --- Popup tạm dừng.
const POP_W = 560;
const POP_H = 500;
const POP_X = CX - POP_W / 2;
const POP_Y = (GAME_H - POP_H) / 2;
const POP_BTN_H = 72;
const POP_PAD = (MIN_HIT - POP_BTN_H) / 2;
const POP_CONTINUE = btn(POP_X + 40, POP_Y + 86, POP_W - 80, POP_BTN_H, { y: POP_PAD });
const POP_SOUND = btn(POP_X + POP_W - 40 - 140, POP_Y + 180, 140, 64, { y: (MIN_HIT - 64) / 2 });
const SLIDER_Y = POP_Y + 302;
const SLIDER_X = POP_X + 40;
const SLIDER_W = POP_W - 80 - 90;
const KNOB_R = 16;
const SLIDER_HIT = rect(SLIDER_X - KNOB_R, SLIDER_Y - MIN_HIT / 2, SLIDER_W + 2 * KNOB_R, MIN_HIT);
const POP_HOME = btn(POP_X + 40, POP_Y + 356, POP_W - 80, POP_BTN_H, { y: POP_PAD });

const CONF_W = 520;
const CONF_H = 250;
const CONF_X = CX - CONF_W / 2;
const CONF_Y = (GAME_H - CONF_H) / 2;
const CONF_BW = (CONF_W - 60 - 16) / 2;
const CONF_YES = btn(CONF_X + 30, CONF_Y + CONF_H - 100, CONF_BW, POP_BTN_H, { y: POP_PAD });
const CONF_NO = btn(CONF_X + 30 + CONF_BW + 16, CONF_Y + CONF_H - 100, CONF_BW, POP_BTN_H, { y: POP_PAD });

// --- Màn bắt đầu (chừa chỗ cho dòng kỷ lục và dòng gợi ý lần đầu dưới nút chính).
const START_MAIN = btn(CX - 210, 246, 420, POP_BTN_H, { y: POP_PAD });
const START_SECONDARY = btn(CX - 210, 400, 420, POP_BTN_H, { y: POP_PAD });
const START_SIGN_OUT = btn(CX - 130, 538, 260, POP_BTN_H, { y: POP_PAD });
/** Số nút đăng nhập tối đa mà bố cục chừa chỗ (hiện có 1). */
export const START_MAX_PROVIDERS = 2;
export function startProvider(i: number): Btn {
  return btn(CX - 180, 538 + i * (MIN_HIT + MIN_GAP), 360, POP_BTN_H, { y: POP_PAD });
}

/** Hộp chọn ở màn bắt đầu với `n` lựa chọn. */
export function askLayout(n: number): { box: Rect; titleY: number; choices: Btn[] } {
  const w = 560;
  const h = 130 + n * (MIN_HIT + MIN_GAP);
  const top = (GAME_H - h) / 2;
  const choices = Array.from({ length: n }, (_, i) =>
    btn(CX - (w - 60) / 2, top + 100 + i * (MIN_HIT + MIN_GAP), w - 60, POP_BTN_H, { y: POP_PAD }),
  );
  return { box: rect(CX - w / 2, top, w, h), titleY: top + 50, choices };
}
/** Số lựa chọn tối đa của hộp chọn ở màn bắt đầu. */
export const START_ASK_MAX = 2;

// --- Màn kết quả: ô nhập tên DOM (cao 82 khung game ≈ 44 CSS px) + nút Gửi điểm, hai nút dưới.
const RESULT_FORM = rect(CX - 340, 128, 680, MIN_HIT);
/** Đủ rộng cho "Gửi điểm" ở 16 CSS px khi canvas co còn ~0,54. */
const RESULT_SEND_W = 190;
const RESULT_NAME = btn(RESULT_FORM.x, RESULT_FORM.y, RESULT_FORM.w - MIN_GAP - RESULT_SEND_W, MIN_HIT);
const RESULT_SEND = btn(RESULT_FORM.x + RESULT_FORM.w - RESULT_SEND_W, RESULT_FORM.y, RESULT_SEND_W, MIN_HIT);
const RESULT_REPLAY = btn(CX - 270, 628, 260, POP_BTN_H, { y: POP_PAD });
const RESULT_HOME = btn(CX + 10, 628, 260, POP_BTN_H, { y: POP_PAD });

export const LAYOUT = {
  top: { h: TOP_BAR_H, gear: GEAR, speed: SPEED },
  board: BOARD,
  tile: TILE,
  bottom: { y: BOTTOM_Y, buttons: BOTTOM_BUTTONS },
  hand: {
    cards: CARDS, cardW: CARD_W, cardH: CARD_H, gap: CARD_GAP, maxCards: MAX_CARDS, lift: LIFT,
    /** Tâm dọc nhãn thẻ và đỉnh dòng độ hiếm, tính từ đỉnh thẻ. */
    labelDy: 59, rarityDy: 4,
    discard: DISCARD,
  },
  bossBar: BOSS_BAR,
  panel: {
    x: RIGHT_X, y: PANEL_Y, w: RIGHT_W, pad: PANEL_PAD, bodyTop: PANEL_BODY_TOP, actionGap: PANEL_ACTION_GAP,
    bottomPad: PANEL_BOTTOM_PAD, maxBottom: PANEL_MAX_BOTTOM, sellW: SELL_W, sellPadY: SELL_PAD_Y, sell: SELL,
  },
  quiz: { box: rect(QUIZ_X, QUIZ_Y, QUIZ_W, QUIZ_H), answers: QUIZ_ANSWERS },
  popup: {
    box: rect(POP_X, POP_Y, POP_W, POP_H), titleY: POP_Y + 44,
    continue: POP_CONTINUE,
    soundLabelY: POP_SOUND.rect.y + POP_SOUND.rect.h / 2, sound: POP_SOUND,
    slider: { x: SLIDER_X, y: SLIDER_Y, w: SLIDER_W, knobR: KNOB_R, hit: SLIDER_HIT },
    home: POP_HOME, statusY: POP_Y + 462,
    confirm: { box: rect(CONF_X, CONF_Y, CONF_W, CONF_H), textY: CONF_Y + 70, yes: CONF_YES, no: CONF_NO },
  },
  start: {
    titleY: 130, loadingY: 340, noticeY: 212,
    main: START_MAIN,
    /** Dòng kỷ lục và dòng gợi ý lần đầu (Task 4) nằm giữa nút chính và nút phụ. */
    recordY: 346, hintY: 378,
    secondary: START_SECONDARY,
    accountY: 510, signOut: START_SIGN_OUT,
  },
  result: {
    titleY: 46, infoY: 100,
    form: RESULT_FORM, name: RESULT_NAME, send: RESULT_SEND,
    statusY: 236, boardTitleY: 268, colsY: 292, colX: [70, CX + 30] as const,
    replay: RESULT_REPLAY, home: RESULT_HOME,
  },
} as const;

// Bản đồ (16 cột × ô) phải kết thúc bên trái cột phải (thanh boss, bảng chi tiết), cách ≥ 8.
if (BOARD.x + BOARD.w + MIN_GAP > RIGHT_X) throw new Error('layout: bản đồ lấn vào bảng chi tiết');

/** Con trỏ thuộc thanh trên (dải 0..TOP_BAR_H hoặc vùng chạm ⚙/tốc độ lấn xuống). */
export function topBarOwns(x: number, y: number): boolean {
  return y < TOP_BAR_H || contains(GEAR.hit, x, y) || contains(SPEED.hit, x, y);
}

export type Screen = 'game' | 'quiz' | 'pause' | 'confirm' | 'start' | 'startAccount' | 'startAsk' | 'result';
export const SCREENS: readonly Screen[] = ['game', 'quiz', 'pause', 'confirm', 'start', 'startAccount', 'startAsk', 'result'];

export interface HitArea {
  id: string;
  hit: Rect;
  reach?: Rect;
}

const entry = (id: string, b: Btn): HitArea => (b.reach ? { id, hit: b.hit, reach: b.reach } : { id, hit: b.hit });

/** Mọi vùng chạm cùng hiện trên một màn (lớp phủ như quiz/popup là màn riêng: nó chặn màn dưới). */
export function hitAreas(screen: Screen): HitArea[] {
  switch (screen) {
    case 'game':
      return [
        entry('top.gear', GEAR),
        entry('top.speed', SPEED),
        ...BOTTOM_BUTTONS.map((b, i) => entry(`bottom.${i}`, b)),
        ...CARDS.map((b, i) => entry(`hand.card${i}`, b)),
        entry('hand.discard', DISCARD),
        entry('panel.sell', SELL),
      ];
    case 'quiz':
      return QUIZ_ANSWERS.map((b, i) => entry(`quiz.${i}`, b));
    case 'pause':
      return [
        entry('pause.continue', POP_CONTINUE),
        entry('pause.sound', POP_SOUND),
        { id: 'pause.volume', hit: SLIDER_HIT },
        entry('pause.home', POP_HOME),
      ];
    case 'confirm':
      return [entry('confirm.yes', CONF_YES), entry('confirm.no', CONF_NO)];
    case 'start':
      return [
        entry('start.main', START_MAIN),
        entry('start.secondary', START_SECONDARY),
        ...Array.from({ length: START_MAX_PROVIDERS }, (_, i) => entry(`start.provider${i}`, startProvider(i))),
      ];
    case 'startAccount':
      return [entry('start.main', START_MAIN), entry('start.secondary', START_SECONDARY), entry('start.signOut', START_SIGN_OUT)];
    case 'startAsk':
      return askLayout(START_ASK_MAX).choices.map((b, i) => entry(`ask.${i}`, b));
    case 'result':
      return [entry('result.name', RESULT_NAME), entry('result.send', RESULT_SEND), entry('result.replay', RESULT_REPLAY), entry('result.home', RESULT_HOME)];
  }
}
