# Màn hình bắt đầu, lưu ván dở, đăng nhập Google: Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm màn hình bắt đầu (Chơi / Chơi tiếp / Ván mới / Đăng nhập Google), lưu ván dở giữa các wave cho khách (localStorage) và cho tài khoản (Supabase `ps_saves`), để người chơi đăng nhập chơi tiếp được ở thiết bị khác.

**Architecture:** Đóng gói/khôi phục `GameState` là hàm thuần trong `src/sim/save.ts`. Toàn bộ luật đồng bộ (bản cục bộ, cloud, `rev`, `run_id`, ván bị bỏ giữa wave, gộp ván khách) nằm trong `SaveManager` (`src/save/`), không import Phaser, nhận `KeyValueStore` và interface `CloudSaves` để test bằng bản giả. `src/net/saves.ts` là cài đặt `CloudSaves` bằng Supabase RPC; `src/net/auth.ts` bọc Supabase Auth. Phaser chỉ gọi: `StartScene` mới quyết định vào ván nào, `GameScene` tự lưu khi đang chuẩn bị và khi wave bắt đầu.

**Tech Stack:** Phaser 3.90.0, TypeScript 5.9.3, Vite 7.3.7, Vitest 3.2.7, @supabase/supabase-js 2.117.2, Supabase CLI 2.121.0 (đã link). Không thêm dependency.

**Spec:** `docs/superpowers/specs/2026-10-23-accounts-and-save-design.md`. Đọc kèm kế hoạch này.

## Global Constraints

- Bảng/hàm mới trên Supabase dùng tiền tố `ps_`. Khóa localStorage mới dùng tiền tố `ps.`.
- **Không đổi Site URL hay bất kỳ cài đặt dự án Supabase nào bằng code/CLI.** Bật Google là việc người dùng làm tay theo `docs/google-login-setup.md`.
- Mọi lệnh mạng bọc giới hạn thời gian `TIMEOUT_MS` (4000 ms, `src/net/cloud.ts`) và không bao giờ ném ra ngoài. Mất mạng thì game vẫn chơi được.
- `src/sim/**` và `src/save/**` không import `phaser` và không import `src/net/**` (chỉ nhận interface).
- Khách chơi đầy đủ khi không có Supabase (thiếu biến môi trường) hoặc khi localStorage bị chặn.
- Hằng số: `SAVE_VERSION = 1`; `MIN_RESUME_PREP = 10` (giây); `ELSEWHERE_MS = 600_000` (10 phút); `AUTOSAVE_MS = 1000`; giới hạn bản lưu `200000` byte (`pg_column_size`); mã lỗi xung đột SQLSTATE `PS409`.
- Khóa localStorage: `ps.deviceId`, `ps.save.guest`, `ps.save.<userId>`, `ps.ended.<userId>`, phiên đăng nhập `ps.auth`.
- Danh sách provider ở một chỗ: `PROVIDERS = ['google']` (`src/net/auth.ts`).
- Chữ hiển thị cho người chơi bằng tiếng Việt.

## Review Focus

- **Bản lưu hỏng hoặc bị sửa tay** (slot trỏ tới unit không có, số NaN, thiếu trường config, sai version): bỏ qua bản lưu, báo "Không đọc được ván đã lưu", không crash → test ở Task 2 và Task 5.
- **Đóng tab ngay sau khi wave bắt đầu, trước khi cloud ghi xong**: bản cục bộ `inWave` phải được ghi đồng bộ trước khi gọi cloud → test ở Task 5.
- **Hai lần lưu chồng nhau khi mạng chậm**: không gửi hai lần cùng một `baseRev` (tự gây xung đột), lần lưu cuối cùng thắng → test ở Task 5.
- **localStorage bị chặn (chế độ riêng tư)**: khách vẫn chơi, `save()` trả `'unsaved'` chứ không ném → test ở Task 3 và Task 5.
- **Đăng nhập xong nhưng mạng chập chờn**: lấy cloud lỗi → dùng bản cục bộ; có mạng lại thì bản cục bộ `dirty` được đẩy lên → test ở Task 5.

---

## Cấu trúc file

```
src/sim/rng.ts                 + Rng.state() (đọc trạng thái để lưu)
src/sim/save.ts                MỚI: RunSave, snapshotRun, parseRunSave, restoreGame, runStatsOf, saveFingerprint
src/save/localSaves.ts         MỚI: khóa localStorage, deviceId, đọc/ghi bản cục bộ, danh sách ended
src/save/SaveManager.ts        MỚI: luật đồng bộ khách/tài khoản (spec 3.1, 6)
src/net/saves.ts               MỚI: CloudSaves bằng Supabase (ps_saves, ps_put_save, ps_end_save)
src/net/auth.ts                MỚI: PROVIDERS, Account, currentAccount, signIn, signOut, accountFromUser
src/net/supabase.ts            bật lưu phiên đăng nhập
src/scenes/StartScene.ts       MỚI: màn hình bắt đầu
src/scenes/GameScene.ts        nhận dữ liệu vào ván, tự lưu, kết thúc ván
src/ui/ResultScreen.ts         + nút "Màn hình chính", điền sẵn tên tài khoản
src/ui/ConfigMenu.ts           xác nhận khi "Áp dụng & chơi lại" lúc đang có ván
src/main.ts                    scene: [StartScene, GameScene]
supabase/migrations/20261023120000_ps_saves.sql   MỚI
docs/google-login-setup.md     MỚI: các bước làm tay (Google Cloud, Supabase)
tests/sim/save.test.ts, tests/save/localSaves.test.ts, tests/save/saveManager.test.ts, tests/net/auth.test.ts
```

Bản giả `KeyValueStore` trong test: chép helper `mem()` có sẵn ở `tests/settings/cloudConfig.test.ts`.

---

### Task 1: RNG lưu/khôi phục được

**Files:**
- Modify: `src/sim/rng.ts`
- Test: `tests/sim/rng.test.ts`

**Interfaces:**
- Produces: `Rng.state(): number` trả về trạng thái nội bộ `a` (uint32). `createRng(rng.state())` tạo RNG tiếp tục đúng dãy số.

- [ ] **Step 1: Viết test**

```ts
test('state() khôi phục được dãy số', () => {
  const a = createRng(42);
  for (let i = 0; i < 7; i++) a.next();
  const b = createRng(a.state());
  expect([b.next(), b.next(), b.next()]).toEqual([a.next(), a.next(), a.next()]);
});
```

- [ ] **Step 2: Chạy `npx vitest run tests/sim/rng.test.ts`**. Kỳ vọng: FAIL (`state is not a function`).
- [ ] **Step 3: Thêm `state: () => a` vào object trả về và vào interface `Rng`** (comment ngắn tiếng Việt như các dòng khác).
- [ ] **Step 4: Chạy lại**. Kỳ vọng: PASS.
- [ ] **Step 5: Commit** `feat: rng exposes its state for saving`

---

### Task 2: Đóng gói và khôi phục ván (`src/sim/save.ts`)

**Files:**
- Create: `src/sim/save.ts`
- Test: `tests/sim/save.test.ts`

**Interfaces:**
- Consumes: `Rng.state()` (Task 1), `createRng`, `pathLength` (`src/sim/path.ts`), `mergeConfig` + `DEFAULT_CONFIG` (`src/settings/configStore.ts`, `src/config`), `configHash`.
- Produces:

```ts
export const SAVE_VERSION = 1;
export const MIN_RESUME_PREP = 10;
export interface SavedGame {
  config: GameConfig; rngState: number;
  hp: number; gold: number; wave: number; prepTimer: number;
  slots: (number | null)[]; units: Unit[]; hand: Card[];
  summonCount: number; drawCount: number; luckLevel: number;
  modifier: ModifierId | null; quizUsedThisPrep: boolean; kills: number; nextId: number;
}
export interface RunSave {
  version: typeof SAVE_VERSION; runId: string; deviceId: string;
  inWave: boolean; runSeconds: number; savedAt: number; game: SavedGame;
}
export function snapshotRun(state: GameState, meta: { runId: string; deviceId: string; runSeconds: number; now: number }): RunSave;
export function parseRunSave(raw: unknown): RunSave | null;
export function restoreGame(save: RunSave): GameState;
export function runStatsOf(save: RunSave): { waveReached: number; won: false; kills: number; durationS: number; configHash: string };
export function saveFingerprint(save: RunSave): string;
```

Quy tắc:
- `snapshotRun` lưu **toàn bộ object `Unit`** (bản sao sâu, thứ tự theo `units.values()`), `inWave = state.phase === 'wave'`, `quizUsedThisPrep = state.quizUsedThisPrep || state.quiz !== null`.
- `parseRunSave` trả `null` nếu: không phải object, `version !== 1`, `runId`/`deviceId` không phải chuỗi khác rỗng, có số không hữu hạn, `mergeConfig(DEFAULT_CONFIG, game.config).errors.length > 0`, `wave` ngoài `1..config.economy.totalWaves`, `slots.length !== config.map.slots.length`, slot trỏ id không có trong `units` hoặc `unit.slot !== index`, số unit khác số slot khác null, `classId` không có trong `config.classes`, `rarity` không thuộc `RARITY_ORDER`, `hand.length > config.economy.handLimit`, `nextId` ≤ id lớn nhất (unit, thẻ). Hợp lệ thì trả bản đã chuẩn hóa (`config` lấy từ kết quả `mergeConfig`).
- `restoreGame`: `phase = 'prep'`, `prepTimer = max(MIN_RESUME_PREP, saved)`, `quiz = null`, `enemies/minions/spawnQueue/events = []`, `waveTime = 0`, `map = config.map`, `pathLen = pathLength(config.map.path)`, `rng = createRng(rngState)`, `units` dựng lại thành `Map` theo id, `attackCooldown = 0` cho mọi unit.
- `runStatsOf`: `waveReached = game.wave`, `durationS = runSeconds`, `configHash = configHash(game.config)`.
- `saveFingerprint`: JSON của `game` bỏ `prepTimer`, cộng `inWave` (bỏ `savedAt`, `runSeconds`), dùng để biết có gì đổi chưa.

- [ ] **Step 1: Viết test** (dựng ván bằng `createGame(1)`, chạy vài lệnh `summon`/`drawCard`, `tick` qua wave 1 đến `phase === 'prep'`):

```ts
const meta = { runId: 'r1', deviceId: 'd1', runSeconds: 12.5, now: 1000 };
test('lưu → JSON → khôi phục ra ván tương đương', () => {
  const s = playedToWave2();
  const back = restoreGame(parseRunSave(JSON.parse(JSON.stringify(snapshotRun(s, meta))))!);
  expect(back.wave).toBe(2);
  expect(back.gold).toBe(s.gold);
  expect(back.hp).toBe(s.hp);
  expect(back.slots).toEqual(s.slots);
  expect([...back.units.values()]).toEqual([...s.units.values()].map((u) => ({ ...u, attackCooldown: 0 })));
  expect(back.hand).toEqual(s.hand);
  expect(back.modifier).toBe(s.modifier);
  expect(back.nextId).toBe(s.nextId);
  expect(back.rng.next()).toBe(s.rng.next());
});
test('đồng hồ chuẩn bị tối thiểu 10 giây', () => { /* prepTimer = 3 → 10; prepTimer = 14 → 14 */ });
test('quiz đang mở → mất lượt quiz', () => { /* startQuiz(s) rồi lưu → restore: quiz === null, quizUsedThisPrep === true */ });
test('inWave khi lưu lúc wave đang chạy', () => { /* startWave(s) → snapshotRun(...).inWave === true */ });
test.each([
  ['sai version', (r: any) => { r.version = 2; }],
  ['slot trỏ unit không có', (r: any) => { r.game.slots[0] = 9999; }],
  ['vàng NaN', (r: any) => { r.game.gold = NaN; }],
  ['config hỏng', (r: any) => { r.game.config.economy.totalWaves = 0; }],
  ['tay bài quá giới hạn', (r: any) => { r.game.hand = Array.from({ length: 6 }, (_, i) => ({ id: 1000 + i, stat: 'damage', rarity: 'common' })); }],
])('bản lưu hỏng (%s) → null', (_, mutate) => {
  const r = structuredClone(snapshotRun(playedToWave2(), meta));
  mutate(r);
  expect(parseRunSave(r)).toBeNull();
});
test('parseRunSave(null / chuỗi / {}) → null', () => { /* ... */ });
test('fingerprint bỏ qua đồng hồ chuẩn bị, bắt được đổi vàng', () => { /* đổi prepTimer → bằng; đổi gold → khác */ });
```

- [ ] **Step 2: Chạy `npx vitest run tests/sim/save.test.ts`**. Kỳ vọng: FAIL (module chưa có).
- [ ] **Step 3: Cài đặt `src/sim/save.ts`** theo interface và quy tắc trên.
- [ ] **Step 4: Chạy lại**, rồi `npm test`. Kỳ vọng: PASS hết.
- [ ] **Step 5: Commit** `feat: snapshot and restore a run between waves`

---

### Task 3: Bản lưu cục bộ (`src/save/localSaves.ts`)

**Files:**
- Create: `src/save/localSaves.ts`
- Test: `tests/save/localSaves.test.ts`

**Interfaces:**
- Consumes: `KeyValueStore` (`src/settings/configStore.ts`), `RunSave`, `parseRunSave` (Task 2).
- Produces:

```ts
export const DEVICE_KEY = 'ps.deviceId';
export const GUEST_KEY = 'ps.save.guest';
export const accountKey = (userId: string): string => `ps.save.${userId}`;
export const endedKey = (userId: string): string => `ps.ended.${userId}`;
export interface LocalSave { save: RunSave; baseRev: number; dirty: boolean }
export function uuid(): string;  // crypto.randomUUID nếu có, không thì dựng uuid v4 từ crypto.getRandomValues (http qua LAN không có randomUUID)
export function getDeviceId(store: KeyValueStore | null, gen?: () => string): string;
export function readLocal(store: KeyValueStore | null, key: string): LocalSave | null | 'invalid';
export function writeLocal(store: KeyValueStore | null, key: string, v: LocalSave): boolean;
export function removeLocal(store: KeyValueStore | null, key: string): void;
export function readEnded(store: KeyValueStore | null, userId: string): string[];
export function addEnded(store: KeyValueStore | null, userId: string, runId: string): void;
export function removeEnded(store: KeyValueStore | null, userId: string, runId: string): void;
```

- `getDeviceId`: đọc `ps.deviceId`, chưa có thì sinh bằng `gen` (mặc định `uuid`) và ghi. Store `null` hoặc ném lỗi → trả id sinh một lần và nhớ trong module (cùng phiên vẫn ổn định).
- `readLocal`: không có → `null`; JSON hỏng hoặc `parseRunSave` null → xóa khóa và trả `'invalid'`.
- Mọi hàm bọc try/catch; store ném lỗi → hành xử như rỗng, `writeLocal` trả `false`.

- [ ] **Step 1: Viết test**

```ts
test('deviceId ổn định trong cùng store', () => { const m = mem(); expect(getDeviceId(m)).toBe(getDeviceId(m)); });
test('ghi rồi đọc lại', () => { /* writeLocal(m, GUEST_KEY, { save, baseRev: 0, dirty: false }) → readLocal trả object bằng */ });
test('bản hỏng → invalid và bị xóa', () => { /* m.setItem(GUEST_KEY, '{oops') → 'invalid', lần đọc sau → null */ });
test('store ném lỗi → không ném', () => {
  const bad = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
  expect(readLocal(bad, GUEST_KEY)).toBeNull();
  expect(writeLocal(bad, GUEST_KEY, local)).toBe(false);
  expect(typeof getDeviceId(bad)).toBe('string');
});
test('ended thêm/bớt không trùng', () => { /* addEnded 2 lần cùng id → readEnded có 1 phần tử; removeEnded → [] */ });
test('uuid đúng dạng kể cả khi không có randomUUID', () => {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  expect(uuid()).toMatch(re);
  vi.spyOn(crypto, 'randomUUID').mockImplementation(undefined as never); // hoặc tạm xóa thuộc tính
  expect(uuid()).toMatch(re);
});
```

- [ ] **Step 2: Chạy `npx vitest run tests/save/localSaves.test.ts`**. Kỳ vọng: FAIL.
- [ ] **Step 3: Cài đặt.**
- [ ] **Step 4: Chạy lại.** Kỳ vọng: PASS.
- [ ] **Step 5: Commit** `feat: local save slots and device id`

---

### Task 4: Bảng `ps_saves` và client cloud (`src/net/saves.ts`)

**Files:**
- Create: `supabase/migrations/20261023120000_ps_saves.sql`
- Create: `src/net/saves.ts`
- Modify: `src/net/cloud.ts` (chỉ export `withTimeout` để dùng lại)

**Interfaces:**
- Consumes: `getSupabase()`, `withTimeout`, `RunSave`.
- Produces:

```ts
export interface CloudRow { runId: string; rev: number; save: unknown; inWave: boolean; deviceId: string; updatedAt: number /* ms */ }
export type PutResult = { ok: true; rev: number } | { ok: false; error: 'conflict' | 'network' };
export interface CloudSaves {
  fetch(): Promise<CloudRow | null | 'error'>;
  put(runId: string, baseRev: number, save: RunSave): Promise<PutResult>;
  end(runId: string): Promise<boolean | 'error'>;
}
export function supabaseSaves(): CloudSaves | null; // null khi getSupabase() null
```

`put` truyền `p_in_wave = save.inWave`, `p_device_id = save.deviceId`. Lỗi có `code === 'PS409'` → `'conflict'`, mọi lỗi khác/hết giờ → `'network'`. `fetch` đọc `run_id, rev, save, in_wave, device_id, updated_at` bằng `.maybeSingle()` (RLS đã lọc theo người dùng), `updatedAt = Date.parse(updated_at)`.

- [ ] **Step 1: Viết migration** (cùng phong cách file `20261021120000_ps_tables.sql`, comment tiếng Anh ở đầu):

```sql
create table if not exists public.ps_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  run_id uuid not null,
  rev bigint not null check (rev >= 1),
  save jsonb not null check (jsonb_typeof(save) = 'object' and pg_column_size(save) <= 200000),
  in_wave boolean not null,
  device_id uuid not null,
  updated_at timestamptz not null default now()
);
alter table public.ps_saves enable row level security;
drop policy if exists ps_saves_select on public.ps_saves;
create policy ps_saves_select on public.ps_saves
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.ps_saves from anon, authenticated;
grant select on public.ps_saves to authenticated;
```

`ps_put_save(p_run_id uuid, p_base_rev bigint, p_save jsonb, p_in_wave boolean, p_device_id uuid) returns bigint`, `security definer`, `set search_path = ''`:
- `auth.uid()` null → `raise … errcode '28000'`.
- `p_base_rev = 0` → `insert … rev = 1 … on conflict (user_id) do nothing returning rev`.
- ngược lại → `update … set rev = rev + 1, save, in_wave, device_id, updated_at = now() where user_id = auth.uid() and run_id = p_run_id and rev = p_base_rev returning rev`.
- Không có dòng nào được chèn/sửa → `raise exception 'save conflict' using errcode = 'PS409'`.

`ps_end_save(p_run_id uuid) returns boolean`, `security definer`, `set search_path = ''`: `delete … where user_id = auth.uid() and run_id = p_run_id`; trả `found`.

Cả hai hàm: `revoke all … from public, anon;` `grant execute … to authenticated;`.

- [ ] **Step 2: Cài đặt `src/net/saves.ts`**, export `withTimeout` từ `cloud.ts`.
- [ ] **Step 3: Chạy `npm run build`**. Kỳ vọng: không lỗi kiểu. (Chưa đẩy migration; xem Task 9.)
- [ ] **Step 4: Commit** `feat: ps_saves table and cloud save client`

---

### Task 5: `SaveManager` (luật đồng bộ)

**Files:**
- Create: `src/save/SaveManager.ts`
- Test: `tests/save/saveManager.test.ts`

**Interfaces:**
- Consumes: Task 2 (`RunSave`, `parseRunSave`), Task 3 (mọi hàm), Task 4 (`CloudSaves`, `CloudRow`, chỉ import **type**).
- Produces:

```ts
export const ELSEWHERE_MS = 600_000;
export type StartInfo =
  | { kind: 'none' }
  | { kind: 'invalid' }                               // có bản lưu nhưng hỏng, đã bỏ
  | { kind: 'resume'; save: RunSave }
  | { kind: 'lost'; save: RunSave; record: boolean }  // bỏ giữa wave; record = được ghi ps_runs
  | { kind: 'elsewhere'; save: RunSave };             // đang chơi ở máy khác (< 10 phút)
export type SaveResult = 'ok' | 'pending' | 'conflict' | 'unsaved';
export interface GuestCheck { lostGuest: RunSave | null; guest: RunSave | null }
export class SaveManager {
  constructor(opts: { store: KeyValueStore | null; cloud: CloudSaves | null; userId: string | null; now?: () => number });
  readonly deviceId: string;
  readonly signedIn: boolean;          // userId !== null && cloud !== null
  get offline(): boolean;              // true nếu lần load() gần nhất không lấy được cloud (row === 'error')
  load(): Promise<StartInfo>;
  save(s: RunSave): Promise<SaveResult>;
  end(runId: string): Promise<void>;
  checkGuest(): GuestCheck;            // chỉ dùng khi signedIn
  adoptGuest(): Promise<SaveResult>;
  dropGuest(): void;
}
```

**Khách** (`signedIn === false`): slot `GUEST_KEY`. `load`: `'invalid'` → `{kind:'invalid'}`; `inWave` → xóa, `{kind:'lost', record:true}`; còn lại `resume`. `save` → `writeLocal({save, baseRev:0, dirty:false})`, trả `'ok'` hoặc `'unsaved'`. `end` → xóa nếu cùng `runId`.

**Tài khoản**: `load` làm đúng thứ tự spec 6.2 "Khi mở game":
1. Gửi lại `cloud.end(id)` cho từng id trong `readEnded`; kết quả khác `'error'` → `removeEnded`.
2. `row = await cloud.fetch()`; `row.runId` còn trong `ended` → coi như `null`.
3. Chọn bản dùng (`cand`) và nguồn (`src`):
   - `row === 'error'` → `cand = local?.save`, `src = 'local'`.
   - `row` có, `parseRunSave(row.save)` null → `cloud.end(row.runId)`, xóa local, trả `{kind:'invalid'}`.
   - `row` và local cùng `runId`: local `dirty` và `local.baseRev === row.rev` → `cand = local.save` (nếu không `inWave` thì `put` lên rồi cập nhật `baseRev`); không thì `cand = row`, ghi đè local `{baseRev: row.rev, dirty:false}`.
   - `row` và local khác `runId`, hoặc chỉ có `row` → `cand = row`, ghi đè local.
   - Không `row`: local `dirty` và `baseRev === 0` → `put` local lên, `cand = local.save`; còn lại → xóa local, `none`.
4. `cand.inWave`:
   - `src === 'cloud'`, `cand.deviceId !== deviceId`, `now() - row.updatedAt < ELSEWHERE_MS` → `elsewhere` (giữ nguyên mọi thứ).
   - `src === 'cloud'` → `r = await cloud.end(runId)`; xóa local; `r === 'error'` → `addEnded`; `record = r === true`.
   - `src === 'local'` → xóa local, `addEnded`, `record = cand.deviceId === deviceId`.
   - Trả `{kind:'lost', save: cand, record}`.
5. Còn lại → `resume`.

`save(s)`: **ghi local đồng bộ trước** (`dirty: true`, giữ `baseRev` hiện tại; `runId` khác bản đang nhớ → `baseRev = 0`), rồi đẩy cloud **tuần tự**: nếu đang có lệnh `put` chạy thì chỉ nhớ bản mới nhất, chạy sau lệnh đang chạy với `baseRev` mới. `put` ok → `baseRev = rev`, `dirty = false` (chỉ khi local vẫn là bản vừa gửi), trả `'ok'`. `'network'` → `'pending'`. `'conflict'` → xóa local, đặt cờ dừng; mọi `save` sau trả `'conflict'` mà không gọi mạng.

`end(runId)`: xóa local nếu cùng `runId`; tài khoản: `cloud.end` → `'error'` thì `addEnded`.

`checkGuest()`: đọc `GUEST_KEY`. `inWave` → xóa, trả vào `lostGuest`. Bản hợp lệ khác → `guest`. `adoptGuest()`: `put(guest.runId, 0, guest)` lên tài khoản, ok → ghi local tài khoản và xóa `GUEST_KEY`. `dropGuest()`: xóa `GUEST_KEY`.

- [ ] **Step 1: Viết test** với `fakeCloud()` (giữ một dòng trong bộ nhớ, mô phỏng đúng luật `rev`/`run_id` của SQL Task 4, có cờ `offline` để trả `'error'`/`'network'`, đếm số lần gọi `put` và các `baseRev` đã gửi):

```ts
test('khách: lưu → load → resume', ...);
test('khách: inWave → lost, record true, bản lưu bị xóa', ...);
test('khách: bản hỏng → invalid', ...);
test('khách: store bị chặn → save trả unsaved, load trả none', ...);
test('tài khoản: máy B thấy ván máy A lưu', ...);           // hai SaveManager khác deviceId, chung fakeCloud
test('tài khoản: local ghi trước khi put trả về', async () => {
  const cloud = fakeCloud({ hang: true });                  // put không bao giờ xong
  const m = new SaveManager({ store, cloud, userId: 'u', now });
  void m.save(inWaveSave);
  expect(readLocal(store, accountKey('u'))).toMatchObject({ save: { inWave: true }, dirty: true });
});
test('tài khoản: hai lần lưu chồng nhau → không gửi trùng baseRev, bản cuối thắng', async () => {
  // cloud.put chậm; gọi save(a), save(b), save(c) liên tiếp
  // kỳ vọng: baseRevs gửi đi là [0, 1] và dòng cloud cuối cùng chứa c
});
test('tài khoản: offline → pending; có mạng lại thì load đẩy bản dirty lên', ...);
test('tài khoản: fetch lỗi → resume bản cục bộ và offline === true', ...);
test('tài khoản: máy khác đã chơi tiếp (rev cloud mới hơn) → cloud thắng, bỏ local', ...);
test('tài khoản: conflict → save sau trả conflict, không gọi mạng', ...);
test('tài khoản: inWave của máy khác, mới 2 phút → elsewhere', ...);
test('tài khoản: inWave của máy khác, 11 phút → lost, record true, cloud trống', ...);
test('tài khoản: inWave cùng máy → lost ngay', ...);
test('tài khoản: end lúc offline → ended; load sau gửi lại end và không trả ván cũ', ...);
test('tài khoản: inWave chỉ có ở local lúc offline → lost, record true; lần sau không tính lại', ...);
test('checkGuest: guest inWave → lostGuest và bị xóa', ...);
test('adoptGuest: tài khoản trống → ván khách lên cloud, GUEST_KEY bị xóa', ...);
```

- [ ] **Step 2: Chạy `npx vitest run tests/save/saveManager.test.ts`**. Kỳ vọng: FAIL.
- [ ] **Step 3: Cài đặt `SaveManager`.**
- [ ] **Step 4: Chạy lại, rồi `npm test`.** Kỳ vọng: PASS hết.
- [ ] **Step 5: Commit** `feat: SaveManager syncs guest and account saves`

---

### Task 6: Đăng nhập Google (`src/net/auth.ts`)

**Files:**
- Modify: `src/net/supabase.ts`
- Create: `src/net/auth.ts`
- Create: `docs/google-login-setup.md`
- Test: `tests/net/auth.test.ts`

**Interfaces:**
- Consumes: `getSupabase()`, `withTimeout` (export từ `cloud.ts` ở Task 4), `sanitizeName`.
- Produces:

```ts
export type Provider = 'google';
export const PROVIDERS: readonly Provider[] = ['google'];
export const PROVIDER_LABEL: Record<Provider, string> = { google: 'Đăng nhập bằng Google' };
export interface Account { userId: string; name: string }
export function accountFromUser(u: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null }): Account;
export function authAvailable(): boolean;            // getSupabase() !== null
export function currentAccount(): Promise<Account | null>;  // getSession() bọc withTimeout; lỗi → null
export function signIn(p: Provider): Promise<boolean>;      // signInWithOAuth, chuyển trang; lỗi → false
export function signOut(): Promise<void>;                   // lỗi bỏ qua
```

- `supabase.ts`: `auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'ps.auth' }`.
- `signIn`: `redirectTo = window.location.origin + window.location.pathname`.
- `accountFromUser`: tên = `sanitizeName` của `user_metadata.full_name`, rồi `name`, rồi phần trước `@` của email, cuối cùng `'Người chơi'` (bỏ qua giá trị không phải chuỗi hoặc rỗng sau khi sanitize).
- `docs/google-login-setup.md`: chép nguyên ba bước của spec mục 7 (OAuth client Google, bật provider, Redirect URLs `http://localhost:5173/**` và `https://please-stop-*-<team-slug>.vercel.app/**`), cảnh báo không dùng `*.vercel.app`, không đổi Site URL, và cách thử: nút đăng nhập báo lỗi của Supabase nếu chưa bật provider.

- [ ] **Step 1: Viết test**

```ts
test.each([
  [{ id: 'u', user_metadata: { full_name: '  Nguyễn   Văn A ' } }, 'Nguyễn Văn A'],
  [{ id: 'u', user_metadata: { name: 'Bee' } }, 'Bee'],
  [{ id: 'u', email: 'dung@x.vn', user_metadata: {} }, 'dung'],
  [{ id: 'u', user_metadata: { full_name: 42 } }, 'Người chơi'],
  [{ id: 'u', user_metadata: { full_name: 'x'.repeat(40) } }, 'x'.repeat(20)],
])('accountFromUser %#', (u, name) => expect(accountFromUser(u)).toEqual({ userId: 'u', name }));
```

- [ ] **Step 2: Chạy `npx vitest run tests/net/auth.test.ts`**. Kỳ vọng: FAIL.
- [ ] **Step 3: Cài đặt `auth.ts`, sửa `supabase.ts`, viết `docs/google-login-setup.md`.**
- [ ] **Step 4: Chạy lại, rồi `npm run build`.** Kỳ vọng: PASS, không lỗi kiểu.
- [ ] **Step 5: Commit** `feat: Google sign-in through Supabase Auth`

---

### Task 7: `GameScene` tự lưu và kết thúc ván

**Files:**
- Modify: `src/scenes/GameScene.ts`, `src/ui/ResultScreen.ts`, `src/ui/ConfigMenu.ts`

**Interfaces:**
- Consumes: `SaveManager`, `StartInfo` (Task 5), `snapshotRun`, `restoreGame`, `runStatsOf`, `saveFingerprint` (Task 2), `recordRun`.
- Produces (cho Task 8):

```ts
export type GameStart =
  | { kind: 'new' }
  | { kind: 'resume'; save: RunSave }
  | { kind: 'lost'; save: RunSave; record: boolean };
export interface GameSceneData { manager: SaveManager; start: GameStart; accountName: string | null }
// GameScene.create(data: GameSceneData). Scene key vẫn là 'Game'.
```

Hành vi:
- `new` → `createGame` như cũ, `runId = uuid()` (Task 3), lưu ngay.
- `resume` → `state = restoreGame(save)`, `runId`/`runSeconds` lấy từ bản lưu.
- `lost` → `state = restoreGame(save)`, đặt `state.phase = 'lost'`, `runSeconds = save.runSeconds`, `runRecorded = !record` (để `update()` tự ghi `ps_runs` đúng một lần), không gọi `end` (đã kết thúc trong `load`).
- Thiếu `data` → coi như `{ kind: 'new' }` với `new SaveManager({ store: browserStore(), cloud: null, userId: null })`.
- Tự lưu: trong `update()`, khi `phase === 'prep'` và menu không mở, mỗi `AUTOSAVE_MS` so `saveFingerprint`; khác bản đã lưu thì `manager.save(snapshotRun(...))`. Lưu **ngay** khi: xử lý sự kiện `waveEnd` mà `state.phase === 'prep'` (ghi đè bản `inWave`), khi xử lý sự kiện `waveStart` (bản `inWave`), và khi `document.visibilityState === 'hidden'` lúc đang `prep` (gỡ listener khi scene `SHUTDOWN`).
- Kết quả `'conflict'` → dừng tự lưu, `banner.show('Ván này đã được chơi ở thiết bị khác')`, sau 2 giây `this.scene.start('Start')`. `'unsaved'` → `toast.show('Trình duyệt chặn lưu trữ — ván này sẽ không được lưu')` một lần mỗi ván.
- Ván kết thúc (`won`/`lost`, không phải ván `lost` vào từ `StartInfo`): gọi `manager.end(runId)` một lần, cùng chỗ với `recordRun` hiện có.
- `restart()` (nút Chơi lại): `runId = uuid()` mới, lưu ngay.
- `ResultScreen`: constructor thêm `home: () => void` và `defaultName: () => string`. Nút "Chơi lại" dời sang trái, thêm nút "Màn hình chính" cùng cỡ bên phải (y = 625, depth 501), bấm thì `this.scene.start('Start')`. Ô tên: `sanitizeName(readName() || defaultName())`; `defaultName` trả `accountName ?? ''`.
- `ConfigMenu`: thêm option `runActive: () => boolean`. Khi true, lần bấm đầu "Áp dụng & chơi lại" chỉ hiện trạng thái `'Ván đang chơi sẽ bị tính thua. Bấm lần nữa để áp dụng.'` (giống cách nút Đặt lại xác nhận hiện có). Lần bấm thứ hai mới gọi `onApplyAndRestart`. GameScene: trong `onApplyAndRestart`, nếu ván chưa kết thúc thì `recordRun` như ván thua (wave, kills, giây hiện tại), `manager.end(runId)`, rồi `restart(cfg)`.

- [ ] **Step 1: Cài đặt các thay đổi trên.**
- [ ] **Step 2: Chạy `npm run build && npm test`.** Kỳ vọng: không lỗi kiểu, test cũ vẫn PASS.
- [ ] **Step 3: Commit** `feat: game scene autosaves between waves`

(Kiểm tra trên trình duyệt làm chung ở Task 8, vì cần `StartScene` để vào ván.)

---

### Task 8: Màn hình bắt đầu (`StartScene`)

**Files:**
- Create: `src/scenes/StartScene.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `currentAccount`, `signIn`, `signOut`, `authAvailable`, `PROVIDERS`, `PROVIDER_LABEL` (Task 6); `SaveManager` (Task 5); `supabaseSaves` (Task 4); `browserStore`; `GameSceneData` (Task 7); `recordRun`, `runStatsOf`.
- Produces: scene key `'Start'`. `main.ts` dùng `scene: [StartScene, GameScene]`.

Luồng `create()`:
1. Hiện tên game và "Đang tải…". Chặn bấm cho đến khi xong.
2. `account = authAvailable() ? await currentAccount() : null`.
3. `manager = new SaveManager({ store: browserStore(), cloud: account ? supabaseSaves() : null, userId: account?.userId ?? null })`.
4. Có tài khoản → `checkGuest()`: `lostGuest` → `recordRun(runStatsOf(lostGuest))`.
5. `info = await manager.load()`.
6. Có tài khoản và `guest`:
   - `info.kind === 'none'` hoặc `'lost'` → `await adoptGuest()`. Nếu `info` là `none` thì đổi thành `resume` ván khách.
   - `info.kind === 'resume'` → hộp chọn: "Giữ ván trên máy này (wave X)" / "Giữ ván của tài khoản (wave Y)". Chọn ván máy: `recordRun(runStatsOf(info.save))`, `manager.end(info.save.runId)`, `adoptGuest()`, rồi resume ván khách. Chọn tài khoản: `recordRun(runStatsOf(guest))`, `dropGuest()`.
   - `info.kind === 'elsewhere'` → không gộp, giữ ván khách trên máy (spec: thử lại lần sau).
7. Vẽ theo `info`:
   - `manager.offline` → `Toast` "Không kết nối được, đang dùng bản lưu trên máy này".
   - `none`/`invalid` → nút **Chơi**. `invalid` → kèm `Toast` "Không đọc được ván đã lưu".
   - `resume` → nút chính **Chơi tiếp — Wave N** và nút **Ván mới**. Ván mới → hỏi xác nhận "Bỏ ván đang chơi dở?" (Có/Không, vẽ trong scene). Có → `recordRun(runStatsOf(save))`, `manager.end(save.runId)`, vào ván mới.
   - `lost` → vào thẳng `GameScene` với `{ kind: 'lost', save, record }` (hiện màn Thua của ván đó).
   - `elsewhere` → dòng "Ván đang được chơi ở thiết bị khác (wave N)" và chỉ nút **Ván mới** (xác nhận như trên; bấm thì ván kia tính thua).
8. Khu tài khoản: có Supabase mà chưa đăng nhập → mỗi provider trong `PROVIDERS` một nút `PROVIDER_LABEL[p]` và dòng nhỏ "Đăng nhập để chơi tiếp trên thiết bị khác". `signIn` trả false → `Toast` "Không mở được đăng nhập". Đã đăng nhập → "Đã đăng nhập: <tên>" và nút **Đăng xuất** (`await signOut(); this.scene.restart()`). Không có Supabase → không vẽ khu này.
9. Vào ván: `this.scene.start('Game', { manager, start, accountName: account?.name ?? null } satisfies GameSceneData)`.

Bố cục cụ thể do người làm quyết định. Dùng `Button` (`src/ui/BottomBar.ts`), `COLORS`/`FONT`/`GAME_W`/`GAME_H` (`src/ui/theme.ts`), nút chính màu `0x2e7d32` như "Chơi lại".

- [ ] **Step 1: Cài đặt `StartScene` và sửa `main.ts`.**
- [ ] **Step 2: Chạy `npm run build && npm test`.** Kỳ vọng: PASS.
- [ ] **Step 3: Kiểm tra thủ công với `npm run dev`** (chế độ khách, chưa cần Google), dùng skill `run` hoặc trình duyệt:
  - Mở trang → thấy màn hình bắt đầu với nút **Chơi**. Bấm → vào ván.
  - Qua wave 1, triệu hồi vài con, F5 lúc đang chuẩn bị → **Chơi tiếp — Wave 2**. Bấm → đội hình, vàng, thẻ y như cũ, đồng hồ ≥ 10 giây.
  - Bắt đầu wave rồi F5 giữa wave → hiện màn **Thất bại** của ván đó, gửi điểm được. Về màn hình chính → chỉ còn nút **Chơi**.
  - **Ván mới** khi đang có ván dở → hỏi xác nhận.
  - Màn kết quả có nút **Màn hình chính**.
  - Không có biến môi trường Supabase → không có nút đăng nhập, game vẫn chạy.
- [ ] **Step 4: Commit** `feat: start screen with play, continue and Google sign-in`

---

### Task 9: Đưa migration lên Supabase và thử đăng nhập thật

**Files:** không có file mới.

- [ ] **Step 1: Chạy `npx supabase db push --dry-run`.** Kỳ vọng: chỉ liệt kê `20261023120000_ps_saves.sql`.
- [ ] **Step 2: Dừng lại, hỏi người dùng có cho đẩy migration lên dự án Supabase dùng chung không.** Chỉ khi được đồng ý mới chạy `npx supabase db push`.
- [ ] **Step 3: Nhắc người dùng làm các bước trong `docs/google-login-setup.md`** (OAuth client, bật Google, Redirect URLs). Chờ họ báo xong.
- [ ] **Step 4: Kiểm tra thủ công trên `npm run dev`:**
  - Đăng nhập Google → quay lại màn hình bắt đầu, thấy "Đã đăng nhập: <tên>".
  - Đang có ván khách dở, rồi đăng nhập → ván khách thành ván tài khoản.
  - Chơi đến wave 3, thoát. Mở trình duyệt khác (hoặc cửa sổ ẩn danh), đăng nhập cùng tài khoản → **Chơi tiếp — Wave 3**, đúng đội hình.
  - Mở cùng tài khoản ở hai trình duyệt, chơi ở trình duyệt B, quay lại A bấm gì đó lúc chuẩn bị → A báo "Ván này đã được chơi ở thiết bị khác" và về màn hình chính.
  - Tắt mạng (DevTools → Offline) lúc chuẩn bị, vẫn chơi tiếp được. Bật lại, F5 → bản mới nhất được đẩy lên.
  - Màn kết quả điền sẵn tên Google.
- [ ] **Step 5: Ghi kết quả kiểm tra vào báo cáo cuối** (bước nào đạt, bước nào chưa làm được, và vì sao).
