# Áp dụng hướng dẫn UI/UX (ưu tiên màn hình ngang): Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm please-stop dễ dùng trên điện thoại ngang và desktop theo các nguyên tắc chung của `docs/arcade-game-ui-ux-agent-guide.md`: chữ rõ và đủ lớn, vùng chạm ≥ 44 CSS px, phân biệt bằng hình, giảm chuyển động, popup chuẩn có Chơi lại + phím tắt, màn kết quả trung tính có kỷ lục, nhắc xoay ngang trên điện thoại dọc.

**Architecture:** Giữ kiến trúc Phaser hiện có. Logic quyết định đặt trong module thuần có test (`src/ui/layout.ts`, `src/save/best.ts`, `src/settings/motion.ts`, `src/ui/orientation.ts`, hàm hình học trong `src/visuals/shapes.ts`); Phaser/DOM chỉ vẽ và nối sự kiện. Không đổi luật chơi, cân bằng, lưu ván, /admin.

**Tech Stack:** Phaser 3.90.0, TypeScript 5.9.3, Vite 7.3.7, Vitest 3.2.7. Không thêm dependency.

**Spec:** `docs/superpowers/specs/2026-10-24-ux-guide-landscape-design.md` — **mục 12 ghi đè các mục trước nếu mâu thuẫn**. Đọc kèm.

## Global Constraints

- Không đổi luật sim, cân bằng, RNG, lưu ván/tài khoản, `/admin`; test cũ vẫn qua (chỉ sửa test khi đổi chữ hiển thị/định dạng có chủ đích).
- Khung game 1280×720 (Phaser FIT). Số đo vùng chạm theo khung game: mỗi vùng chạm ≥ **82 px** theo chiều nhỏ nhất (≈ 44 CSS px ở 844×390), khoảng cách giữa hai vùng ≥ 8 px, không chồng nhau, nằm trong khung; ô bàn chơi ≥ **50 px**.
- Cỡ chữ (khung game): thiết yếu ≥ **22 px**; bảng chi tiết nhân vật ≥ **18 px**; nhãn trên bàn ≥ **14 px**. Mọi `Text` dùng helper `textStyle()` có `resolution = min(devicePixelRatio, 2)`.
- Định dạng số: `viewMath.formatNum` (nhóm bằng dấu cách).
- Khóa localStorage mới: `ps.best` = `{ wave, kills, won }`, `ps.motion` = `{ reduced }` — đọc/ghi bọc try/catch, hỏng → coi như chưa có.
- Giảm chuyển động: hiệu ứng skill/trúng đích ≤ **200 ms** tổng; không rung; khi không giảm: `shake(150, 0.002)`, cách lần trước ≥ **300 ms**.
- Lớp phủ xoay: chỉ khi `pointer: coarse` **và** khung dọc **và** `min(innerWidth, innerHeight) < 600`.
- Chữ hiển thị tiếng Việt; chuỗi cố định lấy nguyên văn từ spec.

## Review Focus

- **Xoay dọc khi quiz đang mở / khi màn kết quả đang hiện / khi đang lưu-rồi-thoát**: ván đứng yên, không mất input, xoay lại không chạy ván ngoài ý muốn → test logic ở Task 7.
- **Chơi lại bấm hai lần nhanh hoặc ngay lúc wave kết thúc**: ghi thua đúng một lần, không ghi kỷ lục hai lần → test ở Task 6 (+ Task 4 cho kỷ lục).
- **`ps.best` hỏng hoặc từ phiên bản khác**: không hiện số giả, không crash → test ở Task 4.
- **Vùng chạm mở rộng chồng lên ô bàn chơi hàng dưới**: chạm vào ô vẫn chọn đúng nhân vật → test bố cục ở Task 2.
- **Phím Esc/P/Space khi đang gõ tên ở màn kết quả (DOM input)**: không mở popup, không nuốt phím → test/kiểm thủ công ở Task 6.

---

### Task 1: Chữ rõ và đủ lớn, định dạng số

**Files:** Modify `src/ui/theme.ts` (thêm `textStyle(opts)`), mọi file tạo `Text` trong `src/ui/`, `src/scenes/`, `src/visuals/` (vd TopBar, BottomBar, Hand, UnitPanel, QuizModal, ResultScreen, Toast/Banner, BossBar, PauseMenu, StartScene, GameScene `floatText`/nhãn bàn, views.ts). Test: `tests/ui/theme.test.ts`.

- `export function textStyle(o: { size: number; color?: string; bold?: boolean; align?: string; wrap?: number; stroke?: …; mono?: boolean }): Phaser.Types.GameObjects.Text.TextStyle` — trả style có `fontFamily` (FONT hoặc monospace), `fontSize: \`${size}px\``, `resolution: Math.min(window.devicePixelRatio || 1, 2)` (an toàn khi không có `window`).
- Nâng cỡ chữ theo Global Constraints; được giãn bảng chi tiết nhân vật/thẻ bài để chữ vừa. Vàng ở HUD và số quái ở bảng xếp hạng dùng `formatNum` (giữ căn cột bảng xếp hạng).
- [ ] Test `textStyle`: size → `fontSize`, resolution ∈ [1, 2], mono → font monospace.
- [ ] Chuyển toàn bộ `scene.add.text(...)` sang `textStyle` (grep `scene.add.text\|this.add.text` không còn object style tự viết `fontFamily`).
- [ ] `npm test && npm run build`. Commit `feat: shared text style with DPR resolution and minimum sizes`.

### Task 2: Bố cục và vùng chạm (`src/ui/layout.ts`)

**Files:** Create `src/ui/layout.ts`, `tests/ui/layout.test.ts`. Modify `TopBar.ts`, `BottomBar.ts` (`Button` nhận `hit?: {padX, padY}` để mở rộng vùng chạm không đổi hình), `Hand.ts`, `UnitPanel.ts`, `PauseMenu.ts`, `ResultScreen.ts` (cả ô nhập tên DOM: cao ≥ 44 CSS px, font ≥ 16 CSS px, `user-select` mặc định), `StartScene.ts`, `GameScene.ts` (`layout()` dùng hằng mới), `theme.ts` (`TOP_BAR_H`, `BOTTOM_H` lấy từ layout).

- `export interface Rect { x: number; y: number; w: number; h: number }`; `export const LAYOUT` gom: thanh trên (cao, nút ⚙, nút tốc độ), thanh dưới (hàng nút), thẻ bài, bảng chi tiết, nút popup, nút màn bắt đầu, nút màn kết quả — mỗi nút có `rect` (hình) và `hit` (vùng chạm).
- `export function hitAreas(): { id: string; hit: Rect }[]` liệt kê mọi vùng chạm của một màn; `export function boardTile(): number` tính ô bàn từ chiều cao còn lại.
- [ ] Test: mọi `hit` có `min(w,h) ≥ 82`; trong cùng một màn không cặp nào chồng nhau và cách ≥ 8; mọi `hit` nằm trong 1280×720; `boardTile() ≥ 50`; vùng chạm thanh dưới không lấn vào ô bàn chơi hàng cuối (hoặc nếu lấn thì `GameScene.uiOwns` ưu tiên bàn chơi — chọn một, ghi rõ, test).
- [ ] Nối các UI vào `LAYOUT`. Kiểm `slotAt`/kéo thả vẫn đúng.
- [ ] `npm test && npm run build`. Commit `feat: layout module with 44px touch targets`.

### Task 3: Phân biệt bằng hình (nhân vật, độ hiếm, quái)

**Files:** Create `src/visuals/shapes.ts`, `tests/visuals/shapes.test.ts`. Modify `src/visuals/views.ts` (đường vẽ hình khối khi không có sprite; chấm độ hiếm cả khi có sprite), `GameScene.ts` (bóng kéo thả dùng cùng hình).

- `export type ShapeKind = 'square' | 'triangle' | 'diamond' | 'hexagon' | 'circle' | 'roundedSquare' | 'octagon'`; `CLASS_SHAPE: Record<ClassId, ShapeKind>` = swordsman square, archer triangle, mage diamond, summoner hexagon; `ENEMY_SHAPE: Record<EnemyKind, ShapeKind>` = normal circle, fast triangle (chĩa theo hướng đi), tank roundedSquare, boss octagon; `RARITY_PIPS: Record<Rarity, number>` = common 0, rare 1, epic 2.
- `export function shapePoints(kind: ShapeKind, cx: number, cy: number, r: number, angle = 0): {x:number;y:number}[]` (circle → null/empty, vẽ bằng `fillCircle`).
- [ ] Test: số đỉnh từng hình; điểm nằm trong bán kính r; CLASS/ENEMY map đủ khóa, các lớp khác hình nhau.
- [ ] Vẽ theo map; hướng tam giác quái nhanh theo vector đi (từ `enemyPos` frame trước/sau hoặc đoạn đường hiện tại).
- [ ] `npm test && npm run build`. Commit `feat: class, enemy and rarity shapes beyond colour`.

### Task 4: Kỷ lục cá nhân, màn kết quả, màn bắt đầu

**Files:** Create `src/save/best.ts`, `tests/save/best.test.ts`. Modify `ResultScreen.ts`, `StartScene.ts`, `GameScene.ts` (`recordResult`), mọi chỗ gọi `recordRun` cho ván kết thúc (`StartScene` abandon/lost/merge, GameScene quit) — cập nhật kỷ lục cùng chỗ.

- `export const BEST_KEY = 'ps.best'`; `export interface Best { wave: number; kills: number; won: boolean }`; `readBest(store): Best | null`; `isBetter(a: Best, b: Best | null): boolean` (thắng > thua → wave → kills); `recordBest(store, run: Best): { previous: Best | null; isNew: boolean }` (đọc trước, ghi sau, chỉ ghi khi tốt hơn).
- Màn kết quả: thắng "Chiến thắng!" (vàng); thua "Kết thúc" (màu chữ thường); dòng "Bạn đã đến wave N/15 · Quái đã giết K"; nhãn nhỏ "Kỷ lục mới!" khi `isNew`.
- Màn bắt đầu: "Kỷ lục: Wave N" (thêm " · Thắng" nếu won) khi có kỷ lục hợp lệ; lần đầu (không kỷ lục, không ván dở) dòng gợi ý nguyên văn spec mục 8. Dời nút nếu cần (dùng `LAYOUT`).
- [ ] Test `best`: hỏng/thiếu → null; so sánh đủ các nhánh; `recordBest` chỉ ghi khi tốt hơn; store ném lỗi → không ném.
- [ ] Nối các điểm kết thúc ván; một ván chỉ gọi `recordBest` một lần (đi cùng chỗ `recordRun` đã có guard).
- [ ] `npm test && npm run build`. Commit `feat: personal best, neutral result screen and start-screen record`.

### Task 5: Giảm chuyển động

**Files:** Create `src/settings/motion.ts`, `tests/settings/motion.test.ts`. Modify `src/visuals/effects.ts`, `GameScene.ts` (rung khi lọt, `floatText`, banner), `Hand.ts` (nhấp nháy thẻ), `PauseMenu.ts` không đụng (Task 6).

- `export const MOTION_KEY = 'ps.motion'`; `export class MotionSettings { constructor(store, mediaReduced: () => boolean); get reduced(): boolean; set(reduced: boolean): void }` — chưa có lựa chọn → theo `mediaReduced()`; có lựa chọn → theo lựa chọn; `export const motion` instance dùng `matchMedia('(prefers-reduced-motion: reduce)')` an toàn khi không có window.
- `export class ShakeGate { constructor(now: () => number); allow(): boolean }` — cho phép rung khi cách lần trước ≥ 300 ms.
- Áp dụng: giảm → không rung (viền đỏ mờ mép bàn ≤ 200 ms), hiệu ứng skill/trúng đích ≤ 200 ms (cắt sprite ở 200 ms), chữ sát thương không bay lên, thẻ mới nhận viền sáng tĩnh 600 ms; không giảm → `shake(150, 0.002)` qua `ShakeGate`.
- [ ] Test: mặc định theo media; set ghi store và ghi đè media; store hỏng → theo media; ShakeGate 299/300 ms.
- [ ] `npm test && npm run build`. Commit `feat: reduced-motion setting and calmer feedback`.

### Task 6: Popup chuẩn: Chơi lại, Giảm chuyển động, phím tắt

**Files:** Modify `src/ui/PauseMenu.ts`, `GameScene.ts`, `src/scenes/RunSaver.ts` (nếu cần hàm cho Chơi lại). Test: `tests/scenes/runSaver.test.ts` và/hoặc `tests/ui/keys.test.ts` (logic phím thuần).

- Thứ tự: Tạm dừng → **Tiếp tục** (nổi bật) → **Chơi lại** → hàng Âm thanh → hàng **Giảm chuyển động** (bật/tắt, dùng `motion`) → **Màn hình chính** (giữ hành vi cũ).
- **Chơi lại**: hỏi "Chơi lại từ đầu? Ván này sẽ bị tính thua." (Có/Không) → Có: ghi thua một lần (`recordResult(false)` + `recordBest`), `saver.end()`, `restart()`; có busy guard.
- Phím (một listener `keydown` gắn khi scene tạo, gỡ khi SHUTDOWN; bỏ qua khi `event.target` là input/textarea): Esc/P mở/đóng popup (đóng = Tiếp tục) khi không quiz/kết quả/xác nhận/halted; trong hộp xác nhận Esc = Không; Space = Tiếp tục khi popup mở. Hàm thuần `keyAction(key, state) → 'open' | 'close' | 'cancelConfirm' | null` có test.
- Popup vào/ra mờ dần ≤ 200 ms; giảm chuyển động thì hiện ngay.
- [ ] Test `keyAction` đủ nhánh (kể cả target là input) và Chơi lại ghi thua đúng một lần (logic thuần nếu tách được).
- [ ] `npm test && npm run build`. Commit `feat: pause popup restart, motion toggle and keyboard shortcuts`.

### Task 7: Nhắc xoay ngang, safe area, chặn cuộn trong vùng game

**Files:** Create `src/ui/orientation.ts`, `tests/ui/orientation.test.ts`. Modify `index.html` (`viewport-fit=cover`; `#game` padding `env(safe-area-inset-*)`, `touch-action: none`, `user-select: none` chỉ cho `#game` canvas), `src/main.ts` (gắn lớp phủ), `GameScene.ts` (cờ `orientationBlocked` chặn tick như `menuOpen`; xoay lại → mở popup nếu mở được, không thì chỉ bỏ cờ), `StartScene.ts` (không cần logic dừng).

- `export function shouldBlock(v: { w: number; h: number; coarse: boolean }): boolean` = `coarse && h > w && Math.min(w, h) < 600`.
- `export function installOrientationOverlay(win = window): { blocked(): boolean; onChange(cb): () => void }` — lớp phủ DOM (z-index trên ô nhập tên), biểu tượng xoay (CSS/SVG nội tuyến) + "Xoay ngang điện thoại để chơi", lắng nghe `resize`/`orientationchange`/`matchMedia('(pointer: coarse)')`.
- [ ] Test `shouldBlock` (điện thoại dọc/ngang, tablet dọc 768×1024, desktop hẹp không coarse) và logic chuyển trạng thái GameScene nếu tách được (thuần: `onOrientation(blocked, ctx) → actions`).
- [ ] `npm test && npm run build`. Commit `feat: rotate-to-landscape overlay, safe area and scoped touch rules`.

### Task 8: Kiểm thử trên trình duyệt, PR, deploy

- [ ] `npm run dev`; Chrome chế độ thiết bị: 844×390 (ngang), 390×844 (dọc: lớp phủ + tự dừng, cả khi quiz mở), 768×1024 (không lớp phủ), 1280×720; Esc/P/Space; giảm chuyển động bật/tắt; kỷ lục mới; chữ rõ ở DPR 2–3; đo vài vùng chạm bằng DevTools.
- [ ] Ghi kết quả từng mục tiêu chí nghiệm thu (pass/fail/not tested) trong báo cáo cuối.
- [ ] PR vào `main`; người dùng merge; deploy production (người dùng đã yêu cầu quy trình này).
