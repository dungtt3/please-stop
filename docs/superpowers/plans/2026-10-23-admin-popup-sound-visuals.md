# /admin, popup trong màn chơi, âm thanh, hiệu ứng chiến đấu: Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển menu cân bằng sang trang `/admin` có mã quản trị; nút ⚙ trong màn chơi thành popup (Tiếp tục / Âm thanh / Màn hình chính); thêm hiệu ứng âm thanh tạo bằng Web Audio; thêm thanh máu có số, thanh máu boss, đường đạn, hiệu ứng skill, thanh hồi skill trên bàn; dựng khung ghép sprite/hoạt ảnh qua manifest.

**Architecture:** Sim (`src/sim/`) chỉ phát thêm event (`attack`, `summon`, `merge`, `quiz`, dữ liệu `skill`/`kill` đầy đủ hơn), luật không đổi. Phần nhìn chuyển sang các "view" giữ theo id (`src/visuals/`), mỗi view vẽ bằng sprite nếu manifest có khóa đó, không thì bằng hình khối. Âm thanh là module thuần (`src/audio/sfx.ts`) nhận AudioContext tiêm vào. Trang `/admin` là trang HTML thứ hai của Vite, dùng lại `ConfigMenu` đã rút gọn, kiểm mã bằng RPC mới `ps_admin_check`.

**Tech Stack:** Phaser 3.90.0, TypeScript 5.9.3, Vite 7.3.7 (multi-page), Vitest 3.2.7, @supabase/supabase-js 2.117.2, Vercel. Không thêm dependency.

**Spec:** `docs/superpowers/specs/2026-10-23-admin-popup-sound-visuals-design.md` — đọc kèm.

## Global Constraints

- `src/sim/**`, `src/save/**`, `src/audio/**`, `src/visuals/manifest.ts` không import `phaser`. `src/sim/**` không import `src/net/**`.
- **Luật sim và cân bằng không đổi**: chỉ thêm event/trường event; mọi test sim cũ phải vẫn qua không sửa giá trị.
- Bảng/hàm Supabase mới dùng tiền tố `ps_`; khóa localStorage mới dùng `ps.`. Không đổi cài đặt dự án Supabase; không chạy Supabase CLI với remote.
- Mọi lệnh mạng bọc `withTimeout` (`TIMEOUT_MS` = 4000, `src/net/cloud.ts`) và không ném ra ngoài.
- Hằng số: `SFX_THROTTLE_MS = 60`; `SFX_MAX_VOICES = 8`; cài đặt âm thanh mặc định `{ on: true, volume: 0.6 }` ở khóa `ps.sound`; `MAX_PROJECTILES = 60`; thời gian bay đạn `0.15` s; hiệu ứng skill ≤ `0.6` s; thanh máu quái rộng `0.7 × ô`, cao `6` px; thanh hồi skill cao `3` px; giới hạn tải asset `ASSET_LOAD_TIMEOUT_MS = 8000`.
- Manifest asset ở `public/sprites/manifest.json` (không dùng `public/assets/` vì trùng thư mục `assets/` Vite tạo khi build — ruling của kế hoạch, sửa spec mục 6.5 theo).
- Chữ hiển thị cho người chơi bằng tiếng Việt; chuỗi cố định lấy nguyên văn từ spec.
- Game luôn chạy được khi: không có Supabase, không có asset nào, không có âm thanh (AudioContext lỗi/bị chặn), localStorage bị chặn.

## Review Focus

- **Wave đông + nhiều cung thủ/pháp sư**: vượt `MAX_PROJECTILES` thì bỏ hiệu ứng mới, không lỗi, không rò đối tượng → test ở Task 7 (`FxBudget`).
- **Manifest hỏng một phần** (thiếu trường, sai kiểu, khóa lạ, JSON hỏng): khóa hỏng rơi về hình khối, khóa đúng vẫn dùng, không ném → test ở Task 5.
- **AudioContext không tạo được / bị chặn / chưa mở khóa**: game im lặng, không ném; tắt âm thanh không tạo AudioContext → test ở Task 3.
- **`/admin` tải cấu hình cloud lỗi**: không hiện menu, không thể Lưu; cloud trống → menu từ mặc định kèm ghi chú → test ở Task 2.
- **Màn hình chính lúc wave đang chạy / lúc chuẩn bị với mạng chậm**: lúc wave → ghi thua đúng một lần; lúc chuẩn bị → chờ lưu tối đa 4 s rồi vẫn đi tiếp → test ở Task 4.

---

## Cấu trúc file

```
src/sim/types.ts, combat.ts, skills.ts, minions.ts, commands.ts, quiz.ts   thêm/bổ sung event
src/settings/resolveConfig.ts        bỏ bản riêng trình duyệt
src/net/cloud.ts                     fetchActiveConfig phân biệt lỗi/trống; checkAdminCode
src/net/cloudCache.ts                theo kiểu trả về mới
supabase/migrations/20261023150000_ps_admin_check.sql   MỚI
src/admin/adminFlow.ts               MỚI: logic cổng /admin (thuần, test được)
src/admin/main.ts, admin/index.html  MỚI: trang /admin
src/ui/ConfigMenu.ts                 rút gọn cho admin
vite.config.ts, vercel.json          multi-page + /admin
src/audio/sfx.ts                     MỚI: Sfx, cài đặt âm thanh
src/ui/PauseMenu.ts                  MỚI: popup ⚙
src/scenes/RunSaver.ts               + exitToMenu logic
src/scenes/GameScene.ts, StartScene.ts, src/ui/BottomBar.ts (Button click sound), TopBar.ts
src/visuals/manifest.ts              MỚI: VisualKey, parseManifest (thuần)
src/visuals/loader.ts                MỚI: tải manifest+asset trong Phaser, VisualRegistry
src/visuals/views.ts                 MỚI: UnitView, EnemyView, MinionView (sprite hoặc hình khối)
src/visuals/BoardViews.ts            MỚI: đồng bộ view với GameState
src/visuals/effects.ts               MỚI: FxBudget (thuần) + đạn, trúng đích, skill
src/ui/BossBar.ts                    MỚI
public/sprites/manifest.json         MỚI: {} (rỗng)
docs/assets.md                       MỚI
tests/sim/events.test.ts, tests/settings/resolveConfig.test.ts (hoặc cloudConfig.test.ts), tests/admin/adminFlow.test.ts,
tests/audio/sfx.test.ts, tests/scenes/runSaver.test.ts, tests/visuals/manifest.test.ts, tests/visuals/effects.test.ts
```

---

### Task 1: Sim phát event cho phần nhìn và âm thanh

**Files:** Modify `src/sim/types.ts`, `combat.ts`, `skills.ts`, `minions.ts`, `commands.ts`, `quiz.ts`. Test: `tests/sim/events.test.ts`.

**Interfaces — Produces** (thêm vào `GameEvent`):

```ts
| { type: 'attack'; source: 'unit' | 'minion'; id: number; classId: ClassId | 'minion'; from: Vec; to: Vec; crit: boolean }
| { type: 'summon'; unitId: number }
| { type: 'merge'; unitId: number }
| { type: 'quiz'; result: 'correct' | 'wrong' | 'timeout' }
// sửa:
| { type: 'kill'; pos: Vec; gold: number; enemyId: number; kind: EnemyKind }
| { type: 'skill'; unitId: number; skill: ClassId; pos: Vec /* vị trí nhân vật */;
    range?: number;      // swordsman: tầm vòng chém
    hits?: Vec[];        // archer: các điểm trúng
    center?: Vec; radius?: number;  // mage: tâm + bán kính thiên thạch
    spawns?: Vec[] }     // summoner: chỗ lính xuất hiện
```
- `spawnMinion(...)` trả `Vec | null` (vị trí lính) thay cho `boolean`; mọi chỗ gọi cập nhật theo.
- `attack` phát một lần mỗi đòn thường của nhân vật (mọi lớp, `from` = vị trí nhân vật, `to` = vị trí mục tiêu lúc bắn, `crit` = kết quả `rollHit` của đòn đó) và mỗi đòn của lính (`source: 'minion'`, `id` = id lính, `classId: 'minion'`). Lưu ý `pos` của event `skill` pháp sư **đổi nghĩa** thành vị trí nhân vật; tâm thiên thạch chuyển sang `center`.

- [ ] **Step 1: Viết test** (`createGame(seed)`, đặt nhân vật/quái bằng lệnh sim hoặc dựng state như các test sim hiện có):
  - `summon` thành công phát `{type:'summon', unitId}` đúng id; thất bại không phát.
  - `dragUnit` gộp phát `{type:'merge', unitId: <id mới>}`; đổi chỗ/di chuyển không phát.
  - đòn thường của cung thủ phát đúng một `attack` với `from` = `unitPos`, `to` = vị trí quái, `classId:'archer'`.
  - skill cung thủ có `hits.length` = số quái trúng; pháp sư có `center` + `radius === cfg.skills.mage.meteorRadius` và `pos` = vị trí nhân vật; triệu hồi sư có `spawns.length` = số lính sinh ra; kiếm sĩ có `range`.
  - trả lời quiz đúng/sai/hết giờ phát `quiz` với `result` tương ứng.
  - giết quái phát `kill` có `enemyId` và `kind`.
  - **Cân bằng không đổi:** chạy cùng seed 3 wave trước và sau thay đổi cho cùng `gold`, `kills`, `hp` (so với giá trị chạy ở commit gốc, ghi cứng vào test).
- [ ] **Step 2:** `npx vitest run tests/sim/events.test.ts` → FAIL.
- [ ] **Step 3:** Cài đặt. Không đổi thứ tự gọi RNG (để cân bằng/seed giữ nguyên).
- [ ] **Step 4:** `npx vitest run tests/sim` → PASS hết (test cũ không sửa giá trị); `npm run build`. Sửa chỗ GameScene đang dùng `e.pos` của skill nếu build báo lỗi (giữ hành vi vẽ vòng tròn tại `pos`).
- [ ] **Step 5: Commit** `feat: sim emits attack, summon, merge, quiz and richer skill/kill events`

---

### Task 2: Cấu hình chỉ từ cloud, kiểm mã quản trị, trang /admin

**Files:** Modify `src/settings/resolveConfig.ts`, `src/net/cloud.ts`, `src/net/cloudCache.ts`, `src/ui/ConfigMenu.ts`, `src/scenes/GameScene.ts` (bỏ mọi dùng `openConfigMenu`/`closeConfigMenu`, `loadSavedConfig`, `saveConfig`, `resetConfig`; nút ⚙ tạm thời không làm gì — Task 4 nối popup), `src/scenes/StartScene.ts` nếu đang dùng bản riêng, `vite.config.ts`. Create `supabase/migrations/20261023150000_ps_admin_check.sql`, `src/admin/adminFlow.ts`, `src/admin/main.ts`, `admin/index.html`, `vercel.json`. Test: `tests/admin/adminFlow.test.ts`, cập nhật test `resolveConfig`.

**Interfaces — Produces:**

```ts
// resolveConfig.ts
export type ConfigSource = 'cloud' | 'default';
export function resolveConfig(opts: { cloud: unknown | null }): { config: GameConfig; source: ConfigSource; errors: string[] };
// cloud.ts
export type CloudConfigFetch = { kind: 'ok'; config: unknown; updatedAt: string } | { kind: 'empty' } | { kind: 'error' };
export async function fetchActiveConfig(): Promise<CloudConfigFetch>;
export async function checkAdminCode(code: string): Promise<'ok' | 'wrong' | 'offline'>;  // rpc ps_admin_check
export async function saveActiveConfig(code: string, cfg: GameConfig): Promise<CloudWrite>;  // giữ nguyên
// adminFlow.ts (thuần, nhận hàm mạng tiêm vào)
export type AdminView =
  | { kind: 'gate'; error: null | 'wrong' | 'offline' }
  | { kind: 'loadError' }                       // "Không tải được cấu hình cloud" + Thử lại
  | { kind: 'menu'; config: GameConfig; cloudConfig: GameConfig | null; updatedAt: string | null; note: string | null };
export async function unlockAdmin(code: string, deps: { check(code: string): Promise<'ok'|'wrong'|'offline'>; fetch(): Promise<CloudConfigFetch> }): Promise<AdminView>;
export async function reloadAdmin(deps: { fetch(): Promise<CloudConfigFetch> }): Promise<AdminView>;
```
- `note` khi cloud trống: `'Cloud chưa có cấu hình — đang hiện giá trị mặc định'`. Cấu hình cloud có lỗi trường → `config` là bản đã gộp với mặc định, `note` liệt kê số trường lỗi.
- SQL `ps_admin_check(p_code text) returns boolean`: `security definer`, `search_path = ''`; `begin perform public.ps_check_admin(p_code); return true; exception when sqlstate '28000' then return false; end;`; `revoke all … from public; grant execute … to anon, authenticated;`.
- `ConfigMenuOptions` mới (bỏ `onSave`, `onApplyAndRestart`, `runActive`, `onReset`, `source`, `fallback`, `hasOverride`):
  ```ts
  { current: GameConfig; cloudConfig: GameConfig | null; cloudUpdatedAt: string | null; note: string | null;
    onCloudSave(cfg: GameConfig): Promise<CloudWrite>; onCloudClear(): Promise<CloudClear>; onClose?(): void }
  ```
  Bỏ ô nhập mã và `sessionStorage['ps.adminCode']`; bỏ nút "Lưu", "Áp dụng & chơi lại", "Bỏ cấu hình riêng…"; thêm nút **Về cấu hình cloud** (draft = `cloudConfig ?? DEFAULT_CONFIG`, hai bước xác nhận như nút đặt lại cũ); giữ ↺ từng ô, Xuất/Nhập JSON, **Lưu lên cloud**, **Gỡ cấu hình cloud**; sửa chú thích bỏ câu về "bản riêng trong trình duyệt". Trên trang `/admin` menu chiếm cả trang, nút đóng ẩn.
- `/admin`: `admin/index.html` là input thứ hai của Vite (`build.rollupOptions.input`), `vercel.json` rewrite `/admin` → `/admin/index.html`. Phải mở được ở `http://localhost:5173/admin` và `/admin/`.

- [ ] **Step 1: Viết test** `adminFlow`: sai mã → `{gate, error:'wrong'}`; offline → `{gate, error:'offline'}`; đúng mã + fetch `error` → `loadError` (và `fetch` được gọi đúng 1 lần); đúng mã + `empty` → menu từ `DEFAULT_CONFIG`, `cloudConfig: null`, `note` đúng chuỗi; đúng mã + `ok` → menu với config đã gộp, `cloudConfig` bằng nó; `reloadAdmin` lỗi → `loadError`. Test `resolveConfig`: không còn tham số `local`; cloud null → default; cloud hợp lệ → cloud.
- [ ] **Step 2:** chạy test → FAIL.
- [ ] **Step 3:** cài đặt mọi thứ ở trên; `src/admin/main.ts` vẽ cổng (ô mã + nút Mở + dòng lỗi), `loadError` (dòng chữ + Thử lại), hoặc gọi `openConfigMenu` với `onCloudSave = (cfg) => saveActiveConfig(code, cfg)`, `onCloudClear = () => clearActiveConfig(code)`; mã chỉ giữ trong biến.
- [ ] **Step 4:** `npm test && npm run build`; kiểm `dist/admin/index.html` tồn tại.
- [ ] **Step 5: Commit** `feat: balance menu moves to /admin behind the admin code`

---

### Task 3: Âm thanh (`src/audio/sfx.ts`)

**Files:** Create `src/audio/sfx.ts`. Test: `tests/audio/sfx.test.ts`.

**Interfaces — Produces:**

```ts
export type SfxName = 'click' | 'summon' | 'merge' | 'hit' | 'crit' | 'kill' | 'bossKill' | 'leak' | 'waveStart' | 'waveEnd'
  | 'quizRight' | 'quizWrong' | 'skill.swordsman' | 'skill.archer' | 'skill.mage' | 'skill.summoner' | 'win' | 'lose';
export const SFX_THROTTLE_MS = 60, SFX_MAX_VOICES = 8, SOUND_KEY = 'ps.sound';
export interface SoundSettings { on: boolean; volume: number /* 0..1 */ }
export function loadSoundSettings(store: KeyValueStore | null): SoundSettings;   // lỗi/thiếu → { on: true, volume: 0.6 }; volume kẹp 0..1
export function saveSoundSettings(store: KeyValueStore | null, s: SoundSettings): void;
export class Sfx {
  constructor(opts: { createContext?: () => AudioContextLike | null; now?: () => number; store?: KeyValueStore | null });
  get settings(): SoundSettings; set(s: Partial<SoundSettings>): void;   // lưu ngay
  unlock(): void;              // gọi ở lần bấm đầu tiên: tạo/resume context nếu đang bật
  play(name: SfxName): void;   // không ném; bỏ qua khi tắt, chưa unlock, bị throttle, hoặc đủ voices
  setSuspended(s: boolean): void;  // popup mở / tab ẩn
}
export const sfx: Sfx;  // instance dùng chung, createContext = () => new AudioContext() trong try/catch
```
`AudioContextLike` là interface tối thiểu (`currentTime`, `state`, `destination`, `createOscillator`, `createGain`, `resume`, `suspend`) để test bằng bản giả. Âm sắc từng tiếng: người làm tự chọn (oscillator + envelope ≤ 0,5 s).

- [ ] **Step 1: Viết test** với `fakeContext()` đếm oscillator đã start: tắt âm thanh → `play` không tạo oscillator và **không gọi `createContext`**; chưa `unlock` → không phát; cùng tên trong 60 ms → phát 1 lần, sau 60 ms → phát lại; 9 tiếng khác nhau cùng lúc → chỉ 8 voices (voice giải phóng khi oscillator `onended`); `createContext` trả null hoặc ném → `play` không ném; `loadSoundSettings` với JSON hỏng/volume 3 → mặc định/kẹp 1; `set({volume})` lưu vào store; `setSuspended(true)` gọi `suspend`.
- [ ] **Step 2:** FAIL. **Step 3:** cài đặt. **Step 4:** PASS, `npm run build`.
- [ ] **Step 5: Commit** `feat: synthesized sound effects with settings`

---

### Task 4: Popup ⚙ trong màn chơi + nối âm thanh

**Files:** Create `src/ui/PauseMenu.ts`. Modify `src/scenes/RunSaver.ts`, `src/scenes/GameScene.ts`, `src/scenes/StartScene.ts` (gọi `sfx.unlock()` ở lần bấm đầu), `src/ui/BottomBar.ts` (`Button` phát `'click'`), `src/ui/TopBar.ts` nếu cần. Test: `tests/scenes/runSaver.test.ts`.

**Interfaces:**
- Consumes: `sfx`, `SfxName` (Task 3); event mới (Task 1).
- Produces trong `RunSaver`:
  ```ts
  /** Lúc chuẩn bị: lưu ngay và chờ xong (tối đa timeoutMs). Trả về khi xong/hết giờ; không ném. */
  saveAndWait(state: GameState, timeoutMs: number): Promise<void>;
  ```
- Popup (Phaser, depth trên mọi thứ trừ màn kết quả): tiêu đề "Tạm dừng"; **Tiếp tục**; hàng **Âm thanh**: nút `Bật`/`Tắt` + thanh âm lượng kéo được (0–100%, hiện số %); **Màn hình chính**.
  - Mở bằng ⚙; không mở khi `resultScreen.open`, `quizModal.open`, hoặc `halted`. Khi mở: sim dừng (`menuOpen = true`), `sfx.setSuspended(true)`; đóng: ngược lại.
  - Màn hình chính lúc `prep`: hiện "Đang lưu…", `await saver.saveAndWait(state, TIMEOUT_MS)`, `saver.stop()`, `scene.start('Start')`.
  - Màn hình chính lúc `wave`: hộp xác nhận "Thoát bây giờ sẽ bị tính thua. Thoát?" Có/Không. Có → `recordRun` như ván thua (dùng chung một hàm `recordLoss()` với đường áp dụng cấu hình cũ đã bỏ — gom về một chỗ), `saver.end()`, `scene.start('Start')`.
  - Chạm ngoài popup không đóng popup.
- Nối âm thanh trong `GameScene.handleEvent`: `attack` → `'hit'` (crit → `'crit'`); `kill` → `'kill'` (`kind === 'boss'` → `'bossKill'`); `leak`; `waveStart`; `waveEnd`; `quiz` correct → `'quizRight'`, còn lại `'quizWrong'`; `skill` → `` `skill.${skill}` ``; `summon`; `merge`; phase chuyển sang `won`/`lost` → `'win'`/`'lose'` (một lần). `visibilitychange` ẩn → `sfx.setSuspended(true)`.

- [ ] **Step 1: Viết test** `saveAndWait`: manager có `save` treo → resolve sau `timeoutMs` (dùng fake timers); `save` xong nhanh → resolve ngay; phase `wave` → không gọi `save`, resolve ngay; sau `end()` → không gọi `save`.
- [ ] **Step 2:** FAIL. **Step 3:** cài đặt RunSaver + PauseMenu + nối GameScene/Button/StartScene.
- [ ] **Step 4:** `npm test && npm run build`.
- [ ] **Step 5: Commit** `feat: in-game pause popup with sound settings and main menu`

---

### Task 5: Manifest asset (`src/visuals/manifest.ts`) + tài liệu

**Files:** Create `src/visuals/manifest.ts`, `public/sprites/manifest.json` (`{}`), `docs/assets.md`. Modify spec mục 6.5 (đường dẫn `public/sprites/`). Test: `tests/visuals/manifest.test.ts`.

**Interfaces — Produces:**

```ts
export const CLASS_IDS = ['swordsman', 'archer', 'mage', 'summoner'] as const;
export const ENEMY_KINDS = ['normal', 'fast', 'tank', 'boss'] as const;
export type VisualKey =
  | `unit.${ClassId}.${'idle' | 'attack' | 'skill'}` | `minion.${'idle' | 'attack'}`
  | `enemy.${EnemyKind}.${'walk' | 'die'}` | `projectile.${ClassId | 'minion'}` | `impact.${ClassId | 'minion' | 'crit'}`
  | `skill.${ClassId}` | 'skill.mage.meteor' | 'skill.archer.arrow';
export const VISUAL_KEYS: readonly VisualKey[];   // liệt kê đủ
interface Common { fps: number; loop: boolean; scale?: number; originX?: number; originY?: number; tint?: number; rotateToTarget?: boolean }
export type ManifestEntry =
  | ({ type: 'sheet'; file: string; frameWidth: number; frameHeight: number; frames?: number } & Common)
  | ({ type: 'atlas'; file: string; data: string; prefix?: string } & Common);
export function parseManifest(raw: unknown): { entries: Partial<Record<VisualKey, ManifestEntry>>; warnings: string[] };
```
Quy tắc: `raw` không phải object → rỗng + 1 cảnh báo; khóa không thuộc `VISUAL_KEYS` → bỏ + cảnh báo; thiếu/sai kiểu trường bắt buộc (`file` chuỗi khác rỗng, `frameWidth/frameHeight` số nguyên > 0, `fps` > 0, `loop` boolean, `data` chuỗi với atlas) → bỏ khóa + cảnh báo; `file`/`data` là đường dẫn tương đối trong `sprites/` (không có `..`, không có `://`), mặc định `fps = 10`, `loop` mặc định `true` cho idle/walk, `false` cho còn lại.
`docs/assets.md` (tiếng Việt): bảng mọi khóa và nghĩa, hai dạng mục manifest kèm ví dụ, kích thước khuyến nghị (nhân vật/quái 64×64 mỗi khung theo ô 64 px, boss 128×128, đạn 16–32 px), gốc tọa độ, cách thử (thả file vào `public/sprites/`, khai báo, F5).

- [ ] **Step 1: Viết test** theo các quy tắc trên (mỗi quy tắc một case, kể cả manifest hỗn hợp đúng/sai → giữ đúng, bỏ sai) và `VISUAL_KEYS` không trùng, chứa `unit.archer.attack`, `enemy.boss.die`, `skill.mage.meteor`.
- [ ] **Step 2:** FAIL. **Step 3:** cài đặt + viết docs. **Step 4:** PASS, build.
- [ ] **Step 5: Commit** `feat: sprite manifest format and asset guide`

---

### Task 6: Tải asset + view theo id (nhân vật, quái, lính), thanh máu, thanh hồi skill, thanh boss

**Files:** Create `src/visuals/loader.ts`, `src/visuals/views.ts`, `src/visuals/BoardViews.ts`, `src/ui/BossBar.ts`. Modify `src/scenes/StartScene.ts` (gọi tải asset một lần, chờ tối đa `ASSET_LOAD_TIMEOUT_MS` song song với phần tải hiện có), `src/scenes/GameScene.ts` (thay vẽ nhân vật/quái/lính bằng `BoardViews`; giữ `Graphics` cho ô bàn, vùng tầm, kéo thả, viền gộp).

**Interfaces:**
- Consumes: `parseManifest`, `VisualKey`, `ManifestEntry` (Task 5); event `attack`/`skill`/`kill` (Task 1).
- Produces:
  ```ts
  // loader.ts
  export const ASSET_LOAD_TIMEOUT_MS = 8000;
  export interface VisualRegistry { has(key: VisualKey): boolean; textureKey(key: VisualKey): string; animKey(key: VisualKey): string; entry(key: VisualKey): ManifestEntry | undefined }
  export function loadVisuals(scene: Phaser.Scene): Promise<VisualRegistry>;  // gọi nhiều lần trả cùng kết quả (cache module); lỗi file → khóa đó không có, console.warn
  export function getVisuals(): VisualRegistry;  // chưa tải → registry rỗng
  // BoardViews.ts
  export class BoardViews {
    constructor(scene: Phaser.Scene, visuals: VisualRegistry, toScreen: (v: Vec) => { x: number; y: number }, tileSize: () => number);
    sync(state: GameState, opts: { draggingUnitId: number | null }): void;  // tạo/cập nhật/hủy view theo id
    onEvent(e: GameEvent): void;  // attack → anim attack của nhân vật/lính; skill → anim skill; kill → anim die (view quái tự hủy khi xong, tối đa 0,6 s)
    destroy(): void;
  }
  // BossBar.ts
  export class BossBar { constructor(scene: Phaser.Scene); update(state: GameState): void }  // boss còn sống đi xa nhất: "Trùm  1 234 / 2 500"
  ```
- View nhân vật: sprite `unit.<lớp>.idle` (chuyển `attack`/`skill` một lần rồi về idle) hoặc hình vuông màu lớp + viền độ hiếm như hiện tại; sao cấp; **thanh hồi skill** 3 px ở cạnh dưới ô: tỉ lệ `1 − skillCooldown / activeCooldown(cfg, classId, level)`, màu khác khi = 1.
- View quái: sprite `enemy.<loại>.walk` hoặc hình tròn như hiện tại; viền cháy; **thanh máu** rộng `0.7 × ô`, cao 6 px + số máu còn lại (`Math.ceil`) chữ nhỏ viền đen phía trên.
- View lính: sprite `minion.idle`/`attack` hoặc hình tròn + thanh máu như hiện tại.
- Mỗi view là `Container` của Phaser; số chữ chỉ cập nhật khi giá trị đổi.

- [ ] **Step 1: Cài đặt** (phần Phaser không có unit test; logic thuần nếu tách ra thì thêm test).
- [ ] **Step 2:** `npm test && npm run build` — test cũ vẫn qua.
- [ ] **Step 3: Kiểm thủ công** `npm run dev`: không có asset → nhân vật/quái giống cũ + thanh máu có số + thanh hồi skill; wave boss có thanh boss; kéo thả, gộp, chọn nhân vật, vùng tầm vẫn đúng; console không lỗi. Tạo tạm một spritesheet thử (vd PNG 4 khung tự vẽ bằng canvas script, hoặc file nào sẵn có) khai báo cho `unit.archer.idle` → thấy sprite; khai báo file không tồn tại → rơi về hình khối + 1 cảnh báo console; gỡ asset thử trước khi commit (chỉ giữ `{}`).
- [ ] **Step 4: Commit** `feat: per-entity views with sprite hooks, HP numbers, skill cooldown and boss bar`

---

### Task 7: Đạn, trúng đích, hiệu ứng skill

**Files:** Create `src/visuals/effects.ts`. Modify `src/scenes/GameScene.ts` (bỏ vòng tròn trắng chung của event `skill`, chuyển sang effects). Test: `tests/visuals/effects.test.ts`.

**Interfaces:**
- Consumes: `VisualRegistry` (Task 6), event `attack`/`skill` (Task 1), `MAX_PROJECTILES`.
- Produces:
  ```ts
  export const MAX_PROJECTILES = 60, PROJECTILE_FLIGHT_S = 0.15, SKILL_FX_MAX_S = 0.6;
  export class FxBudget { constructor(max: number); tryAcquire(): boolean; release(): void; get active(): number }  // thuần
  export class Effects {
    constructor(scene: Phaser.Scene, visuals: VisualRegistry, toScreen: (v: Vec) => { x: number; y: number }, tileSize: () => number);
    onEvent(e: GameEvent): void;
    destroy(): void;
  }
  ```
- Đạn (`attack`): cung thủ mũi tên, pháp sư cầu lửa (+ vòng nổ bán kính `cfg.skills.mage.splashRadius` khi tới), kiếm sĩ vệt chém tại `to` (không bay), lính vệt nhỏ; chí mạng to hơn/màu `COLORS.crit`; dùng sprite `projectile.<lớp>` / `impact.<lớp>` / `impact.crit` nếu có (xoay theo hướng nếu `rotateToTarget`). Mỗi đạn `tryAcquire()`; không được thì bỏ hiệu ứng; `release()` khi tween xong hoặc scene tắt.
- Skill: kiếm sĩ vòng chém xoay bán kính `range`; cung thủ mũi tên rơi xuống từng `hits`; pháp sư thiên thạch rơi xuống `center` rồi nổ bán kính `radius`; triệu hồi sư vòng triệu hồi tại mỗi `spawns`. Sprite `skill.<lớp>`, `skill.mage.meteor`, `skill.archer.arrow` nếu có. Mỗi hiệu ứng ≤ 0,6 s.

- [ ] **Step 1: Viết test** `FxBudget`: 60 lần acquire thành công, lần 61 false; release rồi acquire lại được; release khi 0 không xuống âm.
- [ ] **Step 2:** FAIL. **Step 3:** cài đặt.
- [ ] **Step 4:** `npm test && npm run build`; kiểm thủ công ở tốc độ ×2 wave đông: đạn, nổ, 4 loại skill hiện đúng, không giật rõ, console không lỗi.
- [ ] **Step 5: Commit** `feat: projectiles, impacts and per-class skill effects`

---

### Task 8: Đưa migration, kiểm tra toàn bộ trên trình duyệt

- [ ] **Step 1:** Nhờ người dùng chạy `supabase/migrations/20261023150000_ps_admin_check.sql` trong SQL Editor (như lần trước); kiểm tra chỉ đọc bằng RPC với mã sai → `false`.
- [ ] **Step 2:** `npm run dev`, kiểm: `/admin` sai mã → "Sai mã quản trị"; đúng mã → menu (người dùng tự nhập mã — controller không nhập mật khẩu); game không còn menu cân bằng; popup ⚙ ở prep và wave; âm thanh bật/tắt/âm lượng nhớ sau F5; hiệu ứng.
- [ ] **Step 3:** Ghi kết quả vào báo cáo cuối.
