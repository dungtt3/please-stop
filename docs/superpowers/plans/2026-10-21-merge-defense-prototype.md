# Merge Defense — Bản chơi thử: Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web game tower/merge defense chơi được trọn một ván 15 wave trên trình duyệt: triệu hồi ngẫu nhiên, gộp, thẻ chỉ số, 4 lớp nhân vật có skill, quái đi theo đường, modifier wave, quiz toán.

**Architecture:** Toàn bộ luật chơi nằm trong `src/sim/` — TypeScript thuần, không import Phaser, test bằng Vitest, chạy bằng `tick(state, dt)` và các hàm lệnh (`summon`, `dragUnit`…). Số cân bằng nằm trong `src/config/`. Phaser (`src/scenes/`, `src/ui/`) chỉ đọc `GameState`, vẽ, và gọi hàm lệnh; sim phát `state.events` để phần vẽ hiện số sát thương, hiệu ứng.

**Tech Stack:** Phaser 3.90.0, TypeScript 5.9.3, Vite 7.3.7, Vitest 3.2.7 (kèm `vite-node` để chạy script cân bằng). Node 24.

**Spec:** `docs/superpowers/specs/2026-10-20-merge-defense-design.md` — đọc kèm kế hoạch này.

## Global Constraints

- Mọi đơn vị vị trí/khoảng cách trong sim tính bằng **ô** (tile); tâm ô (c, r) là (c + 0.5, r + 0.5). Thời gian tính bằng **giây**.
- `src/sim/**` và `src/config/**` không được import `phaser`.
- Mọi phép ngẫu nhiên đi qua `state.rng` (seed được) — không dùng `Math.random` trong sim.
- Khởi đầu ván: HP 20, vàng 100, giai đoạn chuẩn bị 15 giây, 15 wave, boss ở wave 10 và 15.
- Triệu hồi: giá 20 + 5 × số lần đã triệu hồi. Rút thẻ: 25 + 5 × số lần đã rút. Luck: round(40 × 1.5^bậc hiện tại), tối đa 5 bậc.
- Độ hiếm cơ bản Thường/Hiếm/Sử thi = 70/25/5; mỗi bậc Luck: −4/+3/+1.
- Cấp tối đa 5; hệ số sát thương theo cấp `[1, 2.2, 4.8, 10, 21]`; tốc đánh × (1 + 0.1 × (cấp − 1)).
- Tay bài tối đa 5 thẻ; tầm đánh cộng từ thẻ tối đa +2 ô; bán hoàn floor(goldInvested / 2).
- Khung hình 1280×720, Phaser Scale FIT, chỉ dùng pointer events (chuột và cảm ứng như nhau).
- Chữ hiển thị cho người chơi bằng tiếng Việt.

## Review Focus

- **Phần thưởng thẻ khi tay bài đầy** (quiz, boss): phải đổi ra vàng (10/25/60), không mất trắng, không vượt 5 thẻ → test ở Task 3.
- **Hai đòn cùng giết một quái trong cùng tick** (hoặc skill + đòn thường): chỉ cộng vàng và `kills` một lần → test ở Task 5.
- **Bán / gộp Triệu hồi sư khi lính còn trên đường**: lính của con bị bỏ phải biến mất, quái đang bị chặn đi tiếp → test ở Task 7.
- **Tab bị ẩn rồi quay lại** (delta khung hình rất lớn): sim phải chia nhỏ bước, quái không nhảy qua lính / qua End mà không xử lý → test ở Task 8.
- **Áp thẻ Tầm đánh khi con đã chạm trần +2 ô**: từ chối, thẻ không bị tiêu; gộp hai con có thẻ tầm vẫn giữ trần → test ở Task 2 và Task 3.

---

## Cấu trúc file

```
index.html
package.json, tsconfig.json, vite.config.ts
src/main.ts                     khởi tạo Phaser.Game
src/config/map.ts               DEFAULT_MAP
src/config/characters.ts        chỉ số gốc + thông số skill 4 lớp
src/config/cards.ts             giá trị thẻ, đổi vàng
src/config/economy.ts           giá, tỉ lệ độ hiếm, hằng số ván
src/config/enemies.ts           4 loại quái
src/config/waves.ts             15 wave
src/config/modifiers.ts         5 modifier
src/sim/rng.ts                  RNG seed được
src/sim/types.ts                kiểu dùng chung (GameState, Unit, Enemy…)
src/sim/path.ts                 hình học đường đi, kiểm tra map
src/sim/units.ts                độ hiếm, cộng ngẫu nhiên, computeStats, gộp, áp thẻ
src/sim/state.ts                createGame
src/sim/commands.ts             lệnh của người chơi
src/sim/enemies.ts              sinh, di chuyển, lọt, wave spawner, modifier
src/sim/combat.ts               chọn mục tiêu, đòn đánh, sát thương, giết
src/sim/skills.ts               bị động + chủ động của Kiếm sĩ/Cung thủ/Pháp sư
src/sim/minions.ts              lính của Triệu hồi sư, chặn đường
src/sim/quiz.ts                 câu hỏi toán + thưởng
src/sim/game.ts                 tick, vòng giai đoạn chuẩn bị/wave/thắng/thua
src/scenes/GameScene.ts         vẽ map, nhân vật, quái, kéo thả
src/ui/*.ts                     HUD, thanh dưới, tay bài, bảng chi tiết, quiz, kết quả
scripts/balance.ts              chạy nhiều ván tự động để cân bằng
tests/sim/*.test.ts
```

---

### Task 1: Khung dự án, RNG, map

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `.gitignore`
- Create: `src/sim/rng.ts`, `src/sim/path.ts`, `src/config/map.ts`, `src/sim/types.ts` (chỉ `Vec` ở task này)
- Test: `tests/sim/rng.test.ts`, `tests/sim/path.test.ts`

**Interfaces:**
- Produces:
  - `interface Vec { x: number; y: number }`
  - `interface Rng { next(): number /* [0,1) */; int(min: number, max: number): number /* bao gồm 2 đầu */; float(min: number, max: number): number; chance(p: number): boolean; pick<T>(arr: readonly T[]): T; shuffle<T>(arr: T[]): T[] }`
  - `createRng(seed: number): Rng` — mulberry32.
  - `interface MapDef { cols: number; rows: number; path: Vec[] /* waypoint theo chỉ số ô, các đoạn thẳng trục */; slots: Vec[] /* chỉ số ô */ }`
  - `DEFAULT_MAP: MapDef` (cols 16, rows 9, đúng 15 slot)
  - `tileCenter(t: Vec): Vec`, `pathLength(path: Vec[]): number`, `positionAt(path: Vec[], distance: number): Vec` (kẹp trong [0, length], trả tọa độ tâm), `pathTiles(path: Vec[]): Vec[]` (mọi ô đường đi theo thứ tự), `distanceOfTile(path: Vec[], tile: Vec): number` (khoảng cách dọc đường tới tâm ô đó), `validateMap(map: MapDef): string[]`

- [ ] **Step 1: Dựng dự án.** `npm init -y`, cài `phaser@3.90.0`, dev: `typescript@5.9.3 vite@7.3.7 vitest@3.2.7`. Scripts: `dev: vite`, `build: tsc --noEmit && vite build`, `test: vitest run`, `balance: vite-node scripts/balance.ts`. `tsconfig` strict, target ES2022, moduleResolution bundler. `src/main.ts` tạo `Phaser.Game` 1280×720, `scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }`, nền tối, một scene rỗng tạm. `.gitignore`: `node_modules`, `dist`.

- [ ] **Step 2: Viết test thất bại**

```ts
// tests/sim/rng.test.ts
test('cùng seed cho cùng dãy', () => {
  const a = createRng(42), b = createRng(42);
  expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
});
test('int nằm trong khoảng, bao gồm 2 đầu', () => {
  const r = createRng(1); const seen = new Set<number>();
  for (let i = 0; i < 1000; i++) seen.add(r.int(1, 3));
  expect([...seen].sort()).toEqual([1, 2, 3]);
});
// tests/sim/path.test.ts
const L = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }];
test('pathLength cộng các đoạn', () => expect(pathLength(L)).toBe(5));
test('positionAt nội suy theo tâm ô', () => {
  expect(positionAt(L, 0)).toEqual({ x: 0.5, y: 0.5 });
  expect(positionAt(L, 4)).toEqual({ x: 3.5, y: 1.5 });
  expect(positionAt(L, 99)).toEqual({ x: 3.5, y: 2.5 });
});
test('pathTiles liệt kê đủ ô', () => expect(pathTiles(L)).toHaveLength(6));
test('distanceOfTile', () => expect(distanceOfTile(L, { x: 3, y: 1 })).toBe(4));
test('DEFAULT_MAP hợp lệ, 15 slot, mỗi slot kề (8 hướng) ít nhất một ô đường', () => {
  expect(validateMap(DEFAULT_MAP)).toEqual([]);
  expect(DEFAULT_MAP.slots).toHaveLength(15);
});
test('validateMap bắt slot nằm trên đường và đoạn chéo', () => {
  expect(validateMap({ cols: 5, rows: 5, path: [{ x: 0, y: 0 }, { x: 2, y: 2 }], slots: [{ x: 0, y: 0 }] }).length).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 3: Chạy `npm test` — FAIL** (module chưa tồn tại).
- [ ] **Step 4: Cài đặt** `rng.ts`, `path.ts`, `map.ts`. `validateMap` báo lỗi khi: đoạn không thẳng trục, ô ngoài lưới, slot trùng nhau, slot nằm trên đường, slot không kề ô đường nào, đường có ít hơn 2 điểm. Bố cục `DEFAULT_MAP` do người làm chọn: đường vào từ mép trái, ra mép phải, ≥3 khúc cua.
- [ ] **Step 5: `npm test` PASS, `npm run build` thành công, `npm run dev` mở được canvas trống.**
- [ ] **Step 6: Commit** `feat: scaffold project, seeded rng, map geometry`

---

### Task 2: Nhân vật — độ hiếm, chỉ số, gộp, áp thẻ (hàm thuần)

**Files:**
- Create: `src/config/economy.ts`, `src/config/cards.ts`, `src/config/characters.ts`, `src/sim/units.ts`
- Modify: `src/sim/types.ts`
- Test: `tests/sim/units.test.ts`

**Interfaces:**
- Consumes: `Rng`
- Produces (types.ts):
  - `type ClassId = 'swordsman' | 'archer' | 'mage' | 'summoner'`
  - `type Rarity = 'common' | 'rare' | 'epic'` (`RARITY_ORDER = ['common','rare','epic']`)
  - `type CardStat = 'damage' | 'attackSpeed' | 'range' | 'crit'`
  - `interface Card { id: number; stat: CardStat; rarity: Rarity }`
  - `interface Unit { id: number; classId: ClassId; level: number; rarity: Rarity; slot: number; bonus: { damage: number; attackSpeed: number }; cards: Record<CardStat, number>; goldInvested: number; attackCooldown: number; skillCooldown: number; passiveTimer: number; attackCount: number }`
  - `interface UnitStats { damage: number; attackSpeed: number; range: number; critChance: number; critMultiplier: number }`
- Produces (config):
  - `economy.ts`: `START_HP=20, START_GOLD=100, PREP_SECONDS=15, TOTAL_WAVES=15, MAX_LEVEL=5, HAND_LIMIT=5, RANGE_CARD_CAP=2, BASE_RARITY_WEIGHTS=[70,25,5], LUCK_STEP=[-4,3,1], MAX_LUCK=5`, `summonCost(n)`, `drawCost(n)`, `luckCost(level)`
  - `cards.ts`: `CARD_VALUES: Record<CardStat, Record<Rarity, number>>` = damage 0.10/0.20/0.40, attackSpeed 0.06/0.12/0.24, range 0.25/0.5/1, crit 0.03/0.06/0.12; `CARD_GOLD_VALUE: Record<Rarity, number>` = 10/25/60
  - `characters.ts`: `LEVEL_DAMAGE=[1,2.2,4.8,10,21]`, `CLASSES: Record<ClassId, { name: string; color: number; base: UnitStats; passive: string; active: string }>` — gốc: Kiếm sĩ dmg 20 / aspd 1.0 / tầm 1.5; Cung thủ 10 / 1.6 / 4; Pháp sư 14 / 0.8 / 3; Triệu hồi sư 6 / 0.8 / 2.5. Chí mạng gốc 0.05 (Cung thủ 0.20 = 0.05 + bị động 0.15), critMultiplier 2. `name/passive/active` là chữ tiếng Việt hiển thị. Thông số skill thêm ở Task 6–7.
- Produces (units.ts):
  - `rarityWeights(luckLevel: number): [number, number, number]`
  - `rollRarity(rng: Rng, luckLevel: number, minRarity?: Rarity): Rarity` — loại các độ hiếm thấp hơn `minRarity` rồi quay theo trọng số còn lại
  - `rollRandomBonus(rng: Rng, rarity: Rarity): { damage: number; attackSpeed: number }` — mỗi chỉ số độc lập, đều trong common [0,0.10], rare [0.10,0.25], epic [0.25,0.50]
  - `createUnit(id: number, classId: ClassId, slot: number, rarity: Rarity, bonus, goldInvested: number): Unit` — cấp 1, cards = 0, `skillCooldown` = hồi chiêu đầy (Task 6 cung cấp `activeCooldown`; ở task này đặt 0)
  - `computeStats(unit: Unit, rangeMult = 1): UnitStats` — theo đúng công thức spec 5.3; crit kẹp ≤ 1
  - `canMerge(a: Unit, b: Unit): boolean`
  - `mergeUnits(a: Unit, b: Unit, newId: number): Unit` — slot = b.slot, level + 1, rarity cao hơn, bonus lấy max từng chỉ số, cards cộng dồn (range kẹp ≤ 2), goldInvested cộng, các bộ đếm thời gian/attackCount về 0
  - `applyCardToUnit(unit: Unit, card: Card): boolean` — false (không đổi gì) khi card.stat = 'range' và `unit.cards.range >= RANGE_CARD_CAP`; ngược lại cộng (range kẹp) và true

- [ ] **Step 1: Viết test thất bại**

```ts
test('trọng số độ hiếm theo Luck', () => {
  expect(rarityWeights(0)).toEqual([70, 25, 5]);
  expect(rarityWeights(5)).toEqual([50, 40, 10]);
});
test('minRarity rare không bao giờ ra common', () => {
  const r = createRng(3);
  for (let i = 0; i < 500; i++) expect(rollRarity(r, 0, 'rare')).not.toBe('common');
});
test('cộng ngẫu nhiên epic nằm trong [0.25, 0.5]', () => {
  const r = createRng(7);
  for (let i = 0; i < 200; i++) { const b = rollRandomBonus(r, 'epic');
    expect(b.damage).toBeGreaterThanOrEqual(0.25); expect(b.damage).toBeLessThanOrEqual(0.5); }
});
test('computeStats: Kiếm sĩ cấp 3, thẻ +20% sát thương, cộng ngẫu nhiên 10%', () => {
  const u = { ...createUnit(1, 'swordsman', 0, 'common', { damage: 0.1, attackSpeed: 0 }, 20), level: 3 };
  u.cards.damage = 0.2;
  const s = computeStats(u);
  expect(s.damage).toBeCloseTo(20 * 4.8 * 1.2 * 1.1);
  expect(s.attackSpeed).toBeCloseTo(1.0 * 1.2);
  expect(s.range).toBe(1.5);
});
test('Cung thủ có 20% chí mạng gốc, thẻ chí mạng cộng thẳng, kẹp 100%', () => {
  const u = createUnit(1, 'archer', 0, 'common', { damage: 0, attackSpeed: 0 }, 20);
  expect(computeStats(u).critChance).toBeCloseTo(0.2);
  u.cards.crit = 5; expect(computeStats(u).critChance).toBe(1);
});
test('rangeMult áp lên tầm cuối', () => {
  const u = createUnit(1, 'archer', 0, 'common', { damage: 0, attackSpeed: 0 }, 20);
  u.cards.range = 1; expect(computeStats(u, 0.8).range).toBeCloseTo(4);
});
test('canMerge: cùng lớp + cùng cấp + dưới cấp 5', () => {
  const a = createUnit(1, 'mage', 0, 'common', { damage: 0, attackSpeed: 0 }, 20);
  const b = createUnit(2, 'mage', 1, 'common', { damage: 0, attackSpeed: 0 }, 25);
  expect(canMerge(a, b)).toBe(true);
  expect(canMerge(a, { ...b, level: 2 })).toBe(false);
  expect(canMerge(a, { ...b, classId: 'archer' })).toBe(false);
  expect(canMerge({ ...a, level: 5 }, { ...b, level: 5 })).toBe(false);
});
test('mergeUnits giữ max cộng ngẫu nhiên, độ hiếm cao hơn, cộng thẻ và vàng', () => {
  const a = createUnit(1, 'mage', 0, 'rare', { damage: 0.2, attackSpeed: 0.1 }, 20);
  const b = createUnit(2, 'mage', 4, 'common', { damage: 0.05, attackSpeed: 0.3 }, 25);
  a.cards.range = 1.5; b.cards.range = 1; a.cards.damage = 0.1; b.cards.damage = 0.2;
  const m = mergeUnits(a, b, 3);
  expect(m).toMatchObject({ id: 3, slot: 4, level: 2, rarity: 'rare', goldInvested: 45,
    bonus: { damage: 0.2, attackSpeed: 0.3 } });
  expect(m.cards.range).toBe(2); expect(m.cards.damage).toBeCloseTo(0.3);
});
test('áp thẻ tầm bị từ chối khi đã chạm trần, kẹp khi gần trần', () => {
  const u = createUnit(1, 'archer', 0, 'common', { damage: 0, attackSpeed: 0 }, 20);
  u.cards.range = 1.5;
  expect(applyCardToUnit(u, { id: 1, stat: 'range', rarity: 'epic' })).toBe(true);
  expect(u.cards.range).toBe(2);
  expect(applyCardToUnit(u, { id: 2, stat: 'range', rarity: 'common' })).toBe(false);
  expect(u.cards.range).toBe(2);
});
test('giá', () => {
  expect(summonCost(0)).toBe(20); expect(summonCost(3)).toBe(35);
  expect(drawCost(2)).toBe(35); expect(luckCost(0)).toBe(40); expect(luckCost(2)).toBe(90);
});
```

- [ ] **Step 2: `npm test` — FAIL.**
- [ ] **Step 3: Cài đặt các config và `units.ts` theo Interfaces.**
- [ ] **Step 4: `npm test` — PASS.**
- [ ] **Step 5: Commit** `feat: unit stats, rarity rolls, merge and card rules`

---

### Task 3: GameState và lệnh của người chơi

**Files:**
- Create: `src/sim/state.ts`, `src/sim/commands.ts`
- Modify: `src/sim/types.ts`
- Test: `tests/sim/commands.test.ts`

**Interfaces:**
- Consumes: Task 1–2.
- Produces (types.ts):
  - `type Phase = 'prep' | 'wave' | 'won' | 'lost'`
  - `type EnemyKind = 'normal' | 'fast' | 'tank' | 'boss'`, `type ModifierId = 'frenzy' | 'goldRain' | 'swarm' | 'ironArmor' | 'darkness'`
  - `interface Enemy { id: number; kind: EnemyKind; hp: number; maxHp: number; speed: number; distance: number; armor: number; leakDamage: number; goldDrop: number; minionDps: number; blockedBy: number | null; burn: { dps: number; remaining: number } | null; dead: boolean }`
  - `interface Minion { id: number; ownerId: number; pos: Vec; pathDistance: number; hp: number; maxHp: number; damage: number; attackCooldown: number; lifetime: number }`
  - `interface QuizState { question: QuizQuestion; elapsed: number; result: null | 'correct' | 'wrong' | 'timeout' }` (`QuizQuestion` định nghĩa ở Task 9; ở task này khai báo trước `{ text: string; answer: number; options: number[] }`)
  - `type GameEvent = { type: 'damage'; pos: Vec; amount: number; crit: boolean } | { type: 'kill'; pos: Vec; gold: number } | { type: 'leak'; amount: number } | { type: 'skill'; unitId: number; skill: string; pos: Vec } | { type: 'cardGranted'; card: Card } | { type: 'cardConverted'; gold: number } | { type: 'waveStart'; wave: number } | { type: 'waveEnd'; wave: number; reward: number }`
  - `interface GameState { rng: Rng; map: MapDef; pathLen: number; phase: Phase; hp: number; gold: number; wave: number /* wave hiện tại hoặc sắp tới, 1..15 */; prepTimer: number; slots: (number | null)[] /* id unit theo slot */; units: Map<number, Unit>; hand: Card[]; summonCount: number; drawCount: number; luckLevel: number; enemies: Enemy[]; minions: Minion[]; spawnQueue: { kind: EnemyKind; at: number }[]; waveTime: number; modifier: ModifierId | null; quiz: QuizState | null; quizUsedThisPrep: boolean; kills: number; events: GameEvent[]; nextId: number }`
- Produces (state.ts): `createGame(seed: number, map: MapDef = DEFAULT_MAP): GameState` — phase 'prep', wave 1, prepTimer 15, HP 20, vàng 100, modifier null; `newId(state): number`.
- Produces (commands.ts), mỗi lệnh trả `CommandResult = { ok: true } | { ok: false; reason: 'gold' | 'noSlot' | 'handFull' | 'invalid' | 'maxLuck' | 'rangeCap' | 'gameOver' }` và không đổi state khi `ok: false`. Mọi lệnh từ chối với `'gameOver'` khi phase là won/lost.
  - `summon(state)` — kiểm tra vàng và ô trống; trừ giá; lớp ngẫu nhiên đều; `rollRarity` với luckLevel; `rollRandomBonus`; đặt vào ô trống ngẫu nhiên; `goldInvested` = giá vừa trả; `summonCount++`
  - `dragUnit(state, fromSlot: number, toSlot: number)` — ô đích trống → di chuyển; ô đích có con `canMerge` → `mergeUnits` (con mới ở toSlot, ô nguồn trống, xóa lính của cả hai con — gọi `removeMinionsOf` của Task 7, ở task này lọc `state.minions` theo ownerId); không gộp được → hoán đổi; from = to hoặc ô nguồn trống → invalid
  - `sellUnit(state, slot)` — cộng floor(goldInvested / 2), xóa unit + lính của nó
  - `drawCard(state)` — kiểm tra tay < 5 và vàng; trừ giá; `drawCount++`; thẻ: stat ngẫu nhiên đều, `rollRarity` theo luck
  - `applyCard(state, cardId, slot)` — `applyCardToUnit`; false → `'rangeCap'`, thẻ giữ lại
  - `discardCard(state, cardId)`
  - `buyLuck(state)`
  - `grantCard(state, minRarity?: Rarity): void` — dùng bởi boss/quiz: quay thẻ; tay đầy → cộng `CARD_GOLD_VALUE[rarity]` và phát `cardConverted`, ngược lại thêm vào tay và phát `cardGranted`

- [ ] **Step 1: Viết test thất bại** (mỗi test dùng `createGame(seed)` cố định):

```ts
test('summon trừ 20 rồi 25 vàng, đặt cấp 1 vào ô trống', () => {
  const s = createGame(1);
  expect(summon(s)).toEqual({ ok: true }); expect(s.gold).toBe(80);
  summon(s); expect(s.gold).toBe(55);
  expect([...s.units.values()].every(u => u.level === 1)).toBe(true);
  expect(s.slots.filter(x => x !== null)).toHaveLength(2);
});
test('summon bị từ chối khi thiếu vàng hoặc hết ô, state không đổi', () => {
  const s = createGame(1); s.gold = 5;
  expect(summon(s)).toEqual({ ok: false, reason: 'gold' }); expect(s.summonCount).toBe(0);
  const t = createGame(1); t.gold = 1e6;
  for (let i = 0; i < 15; i++) summon(t);
  const g = t.gold; expect(summon(t)).toEqual({ ok: false, reason: 'noSlot' }); expect(t.gold).toBe(g);
});
test('dragUnit: gộp, di chuyển, hoán đổi', () => { /* đặt tay 3 unit vào slots 0,1,2: mage L1, mage L1, archer L1
  dragUnit(0→1): slot 1 là mage L2, slot 0 trống
  dragUnit(1→5 trống): di chuyển
  dragUnit(5→2 archer): hoán đổi, slot 2 là mage L2, slot 5 là archer */ });
test('kéo con cấp 5 lên con cấp 5 cùng lớp thì hoán đổi, không gộp', () => { /* … */ });
test('bán con đã gộp hoàn floor(tổng/2)', () => { /* hai con goldInvested 20 và 25 → gộp → bán → +22 */ });
test('applyCard tầm khi chạm trần trả rangeCap và giữ thẻ trong tay', () => { /* … */ });
test('grantCard khi tay đầy đổi ra vàng theo độ hiếm', () => {
  const s = createGame(2); for (let i = 0; i < 5; i++) s.hand.push({ id: 100 + i, stat: 'damage', rarity: 'common' });
  const g = s.gold; grantCard(s, 'rare');
  expect(s.hand).toHaveLength(5);
  expect([g + 25, g + 60]).toContain(s.gold);
  expect(s.events.at(-1)?.type).toBe('cardConverted');
});
test('drawCard bị từ chối khi tay đầy', () => { /* reason 'handFull', vàng không đổi */ });
test('buyLuck: 40 rồi 60; bậc 5 thì maxLuck', () => { /* … */ });
test('mọi lệnh trả gameOver khi phase lost', () => { /* … */ });
```

Các test có chú thích `/* … */` phải được viết đầy đủ với giá trị như mô tả.

- [ ] **Step 2: `npm test` — FAIL.**
- [ ] **Step 3: Cài đặt `state.ts`, `commands.ts`.**
- [ ] **Step 4: `npm test` — PASS.**
- [ ] **Step 5: Commit** `feat: game state and player commands`

---

### Task 4: Quái, wave, modifier

**Files:**
- Create: `src/config/enemies.ts`, `src/config/waves.ts`, `src/config/modifiers.ts`, `src/sim/enemies.ts`
- Test: `tests/sim/enemies.test.ts`

**Interfaces:**
- Consumes: `GameState`, `positionAt`, `pathLength`.
- Produces:
  - `ENEMIES: Record<EnemyKind, { hp: number; speed: number; leak: number; gold: number; armor: number; minionDps: number; color: number }>` — normal 60 / 1.0 / 1 / 3 / 0 / 10; fast 35 / 1.8 / 1 / 3 / 0 / 6; tank 160 / 0.6 / 2 / 6 / 0.3 / 15; boss 2500 / 0.5 / 10 / 50 / 0 / 0. `HP_GROWTH = 1.15`.
  - `WAVES: WaveDef[]` (đúng 15 phần tử), `interface WaveDef { groups: { kind: EnemyKind; count: number; interval: number; delay: number }[] }` — thành phần do người làm chọn; wave 10 và 15 có đúng 1 boss; số quái tăng dần.
  - `MODIFIERS: Record<ModifierId, { name: string; desc: string; speedMult: number; goldDropMult: number; countMult: number; hpMult: number; damageTakenMult: number; waveRewardMult: number; rangeMult: number }>` — frenzy speed 1.3 gold 1.5; goldRain gold 2; swarm count 1.5 hp 0.7; ironArmor dmgTaken 0.8 reward 2; darkness range 0.8 reward 2; còn lại = 1.
  - `modifierOf(state): ModifierDef` (trả bộ toàn 1 khi null)
  - `rollModifier(rng: Rng, wave: number): ModifierId | null` — wave < 2 → null; 50% → chọn đều
  - `buildSpawnQueue(def: WaveDef, countMult: number): { kind: EnemyKind; at: number }[]` — sắp theo `at`; count × countMult làm tròn lên, **trừ boss**
  - `spawnEnemy(state, kind): Enemy` — hp = gốc × 1.15^(wave−1) × hpMult
  - `updateEnemies(state, dt): void` — xử lý spawnQueue theo `state.waveTime`; di chuyển quái không bị chặn `speed × speedMult × dt` (cháy được trừ ở Task 6); quái tới `pathLen` → trừ `hp` người chơi, phát `leak`, xóa; `hp <= 0` → `phase = 'lost'`
  - `enemyPos(state, e): Vec`

- [ ] **Step 1: Viết test thất bại**

```ts
test('15 wave, boss đúng ở wave 10 và 15', () => {
  expect(WAVES).toHaveLength(15);
  WAVES.forEach((w, i) => expect(w.groups.some(g => g.kind === 'boss')).toBe(i === 9 || i === 14));
});
test('máu quái tăng 1.15 mỗi wave, swarm ×0.7', () => {
  const s = createGame(1); s.wave = 3; expect(spawnEnemy(s, 'normal').hp).toBeCloseTo(60 * 1.15 ** 2);
  s.modifier = 'swarm'; expect(spawnEnemy(s, 'normal').hp).toBeCloseTo(60 * 1.15 ** 2 * 0.7);
});
test('swarm tăng số quái nhưng không tăng boss', () => {
  const q = buildSpawnQueue({ groups: [{ kind: 'normal', count: 3, interval: 1, delay: 0 }, { kind: 'boss', count: 1, interval: 1, delay: 0 }] }, 1.5);
  expect(q.filter(e => e.kind === 'normal')).toHaveLength(5);
  expect(q.filter(e => e.kind === 'boss')).toHaveLength(1);
});
test('rollModifier không bao giờ ra ở wave 1', () => { const r = createRng(1); for (let i = 0; i < 50; i++) expect(rollModifier(r, 1)).toBeNull(); });
test('quái tới End trừ HP theo leak và bị xóa; HP về 0 thì thua', () => {
  const s = createGame(1); s.phase = 'wave'; const e = spawnEnemy(s, 'tank'); e.distance = s.pathLen - 0.01;
  updateEnemies(s, 0.1); expect(s.hp).toBe(18); expect(s.enemies).toHaveLength(0);
  s.hp = 1; spawnEnemy(s, 'normal').distance = s.pathLen; updateEnemies(s, 0.01); expect(s.phase).toBe('lost');
});
test('quái bị chặn không di chuyển', () => { /* blockedBy = 1 → distance không đổi */ });
test('frenzy tăng tốc 30%', () => { /* normal, dt 1 → distance 1.3 */ });
```

- [ ] **Step 2: FAIL.** - [ ] **Step 3: Cài đặt.** - [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** `feat: enemies, waves and modifiers`

---

### Task 5: Chiến đấu cơ bản

**Files:**
- Create: `src/sim/combat.ts`
- Test: `tests/sim/combat.test.ts`

**Interfaces:**
- Consumes: `computeStats`, `modifierOf`, `enemyPos`, `tileCenter`, `grantCard`.
- Produces:
  - `unitPos(state, unit): Vec` (tâm ô của slot)
  - `enemiesInRange(state, pos: Vec, range: number): Enemy[]` (còn sống, khoảng cách Euclid ≤ range)
  - `findTarget(state, pos, range): Enemy | null` — `distance` lớn nhất
  - `rollHit(rng: Rng, stats: UnitStats, mult: number): { amount: number; crit: boolean }` — amount = stats.damage × mult × (crit ? critMultiplier : 1)
  - `damageEnemy(state, enemy, amount: number, crit: boolean): void` — thực nhận = amount × (1 − armor) × damageTakenMult; phát `damage`; nếu hp ≤ 0 và chưa `dead` → `dead = true`, `kills++`, vàng += round(goldDrop × goldDropMult), phát `kill`; boss → `grantCard(state, 'rare')`
  - `updateUnits(state, dt): void` — mỗi unit: `attackCooldown -= dt`; nếu ≤ 0 và có mục tiêu → gọi `basicAttack(state, unit, stats, target)` rồi `attackCooldown = 1 / stats.attackSpeed`; không có mục tiêu thì giữ ở ≤ 0 (sẵn sàng). Ở task này `basicAttack` mặc định = một `rollHit(…, 1)` lên mục tiêu; Task 6 thay bằng hook theo lớp.
  - `removeDead(state): void` — lọc quái `dead`

- [ ] **Step 1: Viết test thất bại**

```ts
test('chọn quái đi xa nhất trong tầm', () => { /* 2 quái trong tầm, distance 3 và 5 → chọn 5; quái ngoài tầm bị bỏ qua */ });
test('giáp của Trâu giảm 30%, ironArmor thêm ×0.8', () => {
  const s = createGame(1); s.modifier = 'ironArmor'; const e = spawnEnemy(s, 'tank');
  damageEnemy(s, e, 100, false); expect(e.maxHp - e.hp).toBeCloseTo(100 * 0.7 * 0.8);
});
test('hai đòn cùng giết một quái chỉ cho vàng một lần', () => {
  const s = createGame(1); const e = spawnEnemy(s, 'normal'); const g = s.gold;
  damageEnemy(s, e, 1000, false); damageEnemy(s, e, 1000, false);
  expect(s.gold).toBe(g + 3); expect(s.kills).toBe(1);
});
test('goldRain nhân đôi vàng rơi', () => { /* normal → +6 */ });
test('giết boss cho một thẻ Hiếm trở lên', () => { /* hand[0].rarity !== 'common' */ });
test('chí mạng nhân critMultiplier', () => { /* stats critChance 1 → amount = damage × 2, crit true */ });
test('nhân vật đánh theo tốc đánh', () => {
  /* Kiếm sĩ cấp 1 (aspd 1) đặt cạnh đường, một quái normal đứng yên (blockedBy giả) trong tầm,
     gọi updateUnits 15 lần dt 0.1 → quái nhận đúng 2 đòn (t=0 và t≈1.0) */
});
```

- [ ] **Step 2: FAIL.** - [ ] **Step 3: Cài đặt.** - [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** `feat: targeting, attacks, crits and kills`

---

### Task 6: Skill của Kiếm sĩ, Cung thủ, Pháp sư

**Files:**
- Create: `src/sim/skills.ts`
- Modify: `src/config/characters.ts` (thêm `SKILLS`), `src/sim/combat.ts` (gọi hook), `src/sim/enemies.ts` (trừ cháy), `src/sim/units.ts` (`createUnit` đặt `skillCooldown = activeCooldown(classId, 1)`; `mergeUnits` đặt theo cấp mới)
- Test: `tests/sim/skills.test.ts`

**Interfaces:**
- Produces (`SKILLS` trong characters.ts — mọi số ở đây):
  - swordsman: `comboEvery 3, comboMult 2, whirlMult 3, cooldown 8`
  - archer: `rainArrows 5, rainMult 1.5, cooldown 7` (bị động +0.15 crit đã nằm trong chỉ số gốc)
  - mage: `splashRadius 0.75, burnRatio 0.3 /* dps = 30% sát thương đòn */, burnDuration 3, meteorMult 5, meteorRadius 1.5, cooldown 12`
  - summoner: `cooldown 14` (chi tiết ở Task 7)
- Produces (skills.ts):
  - `activeCooldown(classId: ClassId, level: number): number` = cooldown × (1 − 0.08 × (level − 1))
  - `basicAttack(state, unit, stats, target): void` — theo lớp:
    - Kiếm sĩ: `attackCount++`; đòn thứ 3, 6, … nhân 2
    - Cung thủ: một đòn thường
    - Pháp sư: đòn trúng mọi quái trong `splashRadius` quanh mục tiêu; mỗi quái trúng được đặt `burn = { dps: amount × 0.3, remaining: 3 }` (ghi đè, không cộng dồn)
    - Triệu hồi sư: một đòn thường
  - `updateActive(state, unit, stats, dt): void` — `skillCooldown -= dt`; khi ≤ 0 và kích hoạt được thì kích hoạt, phát `skill`, đặt lại `activeCooldown`; không có mục tiêu hợp lệ thì chờ ở 0:
    - Kiếm sĩ "Chém xoáy": 300% lên mọi quái trong tầm
    - Cung thủ "Mưa tên": tối đa 5 quái khác nhau chọn ngẫu nhiên trong tầm, mỗi con 150%
    - Pháp sư "Thiên thạch": tâm = quái trong tầm có nhiều quái khác trong 1.5 ô nhất; 500% lên mọi quái trong 1.5 ô quanh tâm (kể cả ngoài tầm unit)
  - Mỗi lần gây sát thương đều qua `rollHit` (skill cũng có thể chí mạng) và `damageEnemy`.
  - Cháy trong `updateEnemies`: `damageEnemy(state, e, dps × dt, false)` không phát event `damage` mỗi tick — chỉ phát mỗi 0.5s cộng dồn (tránh tràn số bay).

- [ ] **Step 1: Viết test thất bại**

```ts
test('activeCooldown giảm 8% mỗi cấp', () => expect(activeCooldown('mage', 3)).toBeCloseTo(12 * 0.84));
test('Kiếm sĩ: đòn thứ 3 gấp đôi', () => { /* crit 0 (đặt cards.crit âm hoặc rng stub), 3 đòn → sát thương [20,20,40] */ });
test('Pháp sư: nổ lan trong 0.75 ô và gây cháy 3 giây', () => { /* 2 quái cách 0.5 ô cùng mất máu; quái cách 1 ô không; sau 3s cháy hết */ });
test('Cung thủ mưa tên trúng tối đa 5 quái khác nhau', () => { /* 7 quái trong tầm → đúng 5 quái mất máu */ });
test('Thiên thạch nhắm chỗ quái đông nhất', () => { /* cụm 3 quái và 1 quái lẻ xa hơn → cụm 3 nhận sát thương */ });
test('skill chờ khi không có quái và bắn ngay khi quái vào tầm', () => { /* … */ });
```

Để chí mạng không làm lệch test, dùng unit có `cards.crit = -1` (kẹp về 0 trong `computeStats` — thêm kẹp ≥ 0 nếu chưa có).

- [ ] **Step 2: FAIL.** - [ ] **Step 3: Cài đặt.** - [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** `feat: class passives and active skills`

---

### Task 7: Triệu hồi sư và lính chặn đường

**Files:**
- Create: `src/sim/minions.ts`
- Modify: `src/config/characters.ts` (thêm vào `SKILLS.summoner`), `src/sim/skills.ts`, `src/sim/enemies.ts` (chặn), `src/sim/commands.ts` (dùng `removeMinionsOf`)
- Test: `tests/sim/minions.test.ts`

**Interfaces:**
- Produces (`SKILLS.summoner`): `passiveEvery 6, waveCount 3, maxMinions 4, minionLifetime 10, minionDamageRatio 0.5, minionHpPerLevel 40, minionAttackRate 1, cooldown 14`
- Produces (minions.ts):
  - `spawnMinion(state, owner: Unit, stats: UnitStats): boolean` — false khi đã đủ 4 lính hoặc không có ô đường nào trong tầm. Vị trí: ô đường (`pathTiles`) gần Triệu hồi sư nhất trong tầm; `pathDistance = distanceOfTile`. hp = 40 × cấp; damage = 50% `stats.damage`.
  - `removeMinionsOf(state, ownerId: number): void` — xóa lính và gỡ `blockedBy` của quái đang bị chúng chặn
  - `updateMinions(state, dt): void` — giảm `lifetime`, đánh quái đầu tiên đang bị chặn bởi mình (`damageEnemy` không chí mạng, 1 đòn/giây), nhận `minionDps × dt` từ mọi quái bị nó chặn; chết hoặc hết giờ → xóa và gỡ chặn
- Quy tắc chặn (trong `updateEnemies`): quái không phải boss, chưa bị chặn, nếu bước di chuyển làm `distance` vượt `pathDistance` của một lính còn sống phía trước → `distance = pathDistance`, `blockedBy = minion.id`. Boss đi qua lính → lính đó chết ngay.
- Bị động: `passiveTimer += dt`, đủ 6s → `spawnMinion`, về 0 (chỉ trong phase 'wave'). Chủ động: gọi `spawnMinion` 3 lần; coi là kích hoạt được khi tạo được ít nhất 1 lính.

- [ ] **Step 1: Viết test thất bại**

```ts
test('lính sinh ra ở ô đường gần nhất trong tầm', () => { /* … */ });
test('quái thường dừng tại lính, đánh lính theo minionDps', () => { /* normal: lính mất 10 hp sau 1s */ });
test('boss đi xuyên và giẫm chết lính', () => { /* … */ });
test('tối đa 4 lính mỗi Triệu hồi sư', () => { /* spawnMinion lần 5 trả false */ });
test('lính biến mất sau 10s và quái đi tiếp', () => { /* … */ });
test('bán Triệu hồi sư xóa lính và giải phóng quái đang bị chặn', () => {
  /* sellUnit → state.minions rỗng, enemy.blockedBy === null, tick tiếp thì distance tăng */
});
test('gộp hai Triệu hồi sư xóa lính của cả hai', () => { /* … */ });
```

- [ ] **Step 2: FAIL.** - [ ] **Step 3: Cài đặt.** - [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** `feat: summoner minions that block enemies`

---

### Task 8: Vòng ván — tick, giai đoạn, thắng/thua, script cân bằng

**Files:**
- Create: `src/sim/game.ts`, `scripts/bot.ts`, `scripts/balance.ts`
- Test: `tests/sim/game.test.ts`

**Interfaces:**
- Produces:
  - `tick(state, dt: number): void` — bỏ qua nếu won/lost; chia `dt` thành các bước ≤ 0.05s; mỗi bước theo thứ tự: quiz timer (Task 9 nối vào) → nếu 'prep': `prepTimer -= step`, ≤ 0 → `startWave` → nếu 'wave': `waveTime += step`, `updateEnemies`, `updateMinions`, `updateUnits` (gồm skill), `removeDead`, kiểm tra kết thúc wave. Không xóa `state.events` — phần vẽ xóa sau khi đọc.
  - `startWave(state): void` — phase 'wave', `waveTime = 0`, `spawnQueue = buildSpawnQueue(WAVES[wave-1], countMult)`, phát `waveStart`. Gọi được từ nút "Bắt đầu ngay" khi đang 'prep'.
  - Kết thúc wave (queue rỗng và không còn quái): thưởng round((20 + 5 × wave) × waveRewardMult), phát `waveEnd`; wave 15 → 'won'; ngược lại `wave++`, 'prep', `prepTimer = 15`, `modifier = rollModifier(rng, wave)`, `quizUsedThisPrep = false`, xóa toàn bộ lính, đặt lại `attackCooldown`.
  - Nhân vật chỉ đánh và dùng skill trong phase 'wave'.
  - `scripts/bot.ts`: `runBot(seed: number): GameState` — "bot" đơn giản (triệu hồi khi đủ vàng và còn ô, gộp mọi cặp gộp được, áp mọi thẻ vào con cấp cao nhất, mua Luck khi dư > 200), `tick` 0.05s đến khi kết thúc.
  - `scripts/balance.ts`: gọi `runBot` cho seed 1..20, in wave đạt được từng seed và trung bình.

- [ ] **Step 1: Viết test thất bại**

```ts
test('hết 15 giây chuẩn bị thì wave 1 bắt đầu', () => { const s = createGame(1); tick(s, 15.01); expect(s.phase).toBe('wave'); });
test('startWave bắt đầu ngay', () => { /* … */ });
test('wave kết thúc: thưởng 20 + 5 × wave, sang chuẩn bị wave kế', () => {
  /* startWave(s) rồi đặt s.spawnQueue = [{ kind: 'normal', at: 0 }]; tick cho quái sinh, giết nó bằng damageEnemy → vàng tăng 3 (rơi) + 25 (thưởng), wave 2, phase prep, prepTimer 15 */
});
test('qua wave 15 thì thắng', () => { /* s.wave = 15, wave rỗng → 'won' */ });
test('dt lớn được chia nhỏ: quái không vượt qua lính', () => {
  /* lính tại pathDistance 3, quái normal ở 0, tick(s, 10) → quái blockedBy lính, distance === 3 */
});
test('ván tự chơi với bot kết thúc thắng hoặc thua, không có NaN', () => {
  /* import { runBot } from '../../scripts/bot' — phase ∈ {won, lost}, Number.isFinite(gold), wave ≥ 3 */
});
```

- [ ] **Step 2: FAIL.** - [ ] **Step 3: Cài đặt.** - [ ] **Step 4: PASS.**
- [ ] **Step 5: Chạy `npm run balance`.** Mục tiêu từ spec: bot đơn giản thường qua được wave 10, ít khi qua wave 15. Nếu lệch xa (trung bình < 7 hoặc > 14), chỉnh số trong `src/config/` (không đổi logic) rồi chạy lại; ghi kết quả cuối vào thông điệp commit.
- [ ] **Step 6: Commit** `feat: game loop, wave flow and balance script`

---

### Task 9: Quiz toán

**Files:**
- Create: `src/sim/quiz.ts`
- Modify: `src/sim/types.ts` (`QuizQuestion` chính thức), `src/sim/game.ts` (nối timer)
- Test: `tests/sim/quiz.test.ts`

**Interfaces:**
- Produces:
  - `interface QuizQuestion { text: string /* vd "7 × 8 = ?" dùng ký tự + − × ÷ */; answer: number; options: number[] /* 4 số khác nhau, chứa answer, đã xáo */ }`
  - `generateQuestion(rng, wave): QuizQuestion` —
    - wave 1–5: + hoặc −, toán hạng 0–20, kết quả ≥ 0
    - wave 6–10: + − (0–20) hoặc × (2–9 × 2–9) hoặc ÷ (tích của 2–9 chia một thừa số)
    - wave 11–15: + − toán hạng 0–100, kết quả ≥ 0; × đến 12 × 12; ÷ tương ứng
    - Đáp án nhiễu: answer ± (1…5) hoặc ± 10, khác nhau, ≥ 0
  - `startQuiz(state): CommandResult` — chỉ khi 'prep' và `!quizUsedThisPrep` và `quiz === null`; đặt `quizUsedThisPrep = true`
  - `answerQuiz(state, optionIndex: number): CommandResult` — đúng → `quizReward` → cộng vàng, `grantCard(state, minRarity)`; sai → không thưởng
  - `quizReward(wave: number, elapsed: number): { gold: number; minRarity?: Rarity }` — base = 10 + 3 × wave; elapsed ≤ 3 → gold = 2 × base, minRarity 'rare'; 3 < elapsed < 8 → gold = round(base × (2 − (elapsed − 3) / 5)), không minRarity
  - `updateQuiz(state, dt)` — `elapsed += dt`; ≥ 8 và chưa trả lời → `result = 'timeout'`. Quiz chạy tiếp kể cả khi giai đoạn chuẩn bị đã hết. Phần vẽ đặt `state.quiz = null` khi đóng bảng kết quả (`closeQuiz(state)`).

- [ ] **Step 1: Viết test thất bại**

```ts
test('wave 3 chỉ có + và −, kết quả 0..40 và ≥ 0', () => { /* 200 câu */ });
test('wave 8 chia luôn chia hết', () => { /* với câu chứa ÷: Number.isInteger(answer) */ });
test('4 đáp án khác nhau, có đáp án đúng, không âm', () => { /* mọi wave 1..15, 100 câu mỗi wave */ });
test('quizReward', () => {
  expect(quizReward(5, 2)).toEqual({ gold: 50, minRarity: 'rare' });
  expect(quizReward(5, 5.5)).toEqual({ gold: 38 });
});
test('chỉ một quiz mỗi giai đoạn chuẩn bị, không quiz khi đang wave', () => { /* … */ });
test('hết 8 giây thì timeout và không thưởng', () => { /* … */ });
test('trả lời đúng khi tay đầy thì thẻ đổi ra vàng', () => { /* … */ });
```

- [ ] **Step 2: FAIL.** - [ ] **Step 3: Cài đặt.** - [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** `feat: timed math quiz with card rewards`

---

### Task 10: Phaser — bàn chơi, quái, kéo thả gộp, HUD trên

**Files:**
- Create: `src/scenes/GameScene.ts`, `src/ui/theme.ts` (màu, font, kích thước), `src/ui/TopBar.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: toàn bộ sim. Scene giữ `state: GameState` (`createGame(Date.now())`), `speed: 1 | 2`.
- Produces: `GameScene` với `toScreen(v: Vec): { x, y }` (tile 64px, map đặt giữa vùng giữa thanh trên 64px và thanh dưới ~176px), `restart()`.

Hành vi (hình khối tạm, theo spec mục 9–10):
- `update(_, delta)`: `tick(state, Math.min(delta / 1000, 0.25) * speed)`, rồi vẽ lại theo state, rồi xử lý và xóa `state.events`.
- Đường đi tô màu đất; slot là ô viền mờ; Start/End có nhãn.
- Nhân vật: ô vuông màu theo `CLASSES[].color`, viền theo độ hiếm (Thường xám, Hiếm xanh dương, Sử thi tím), số cấp dạng sao ở góc.
- Quái: hình tròn màu theo `ENEMIES[].color`, boss to gấp đôi, thanh máu; có cháy thì viền cam.
- Lính: hình tròn nhỏ có thanh máu.
- Event `damage`: số bay lên mờ dần; `crit` màu vàng, to hơn. `kill`: "+N" vàng. `skill`: hiệu ứng vòng tròn/chớp ngắn tại `pos`. `leak`: rung camera nhẹ.
- Kéo thả nhân vật bằng pointer: khi đang kéo, các con `canMerge` được làm nổi (viền sáng nhấp nháy); thả → `dragUnit`. Chạm (không kéo, < 8px) → chọn nhân vật (Task 11 hiện bảng chi tiết) và vẽ vòng tầm đánh.
- TopBar: "❤ HP", "💰 vàng", "Wave x/15", tên + mô tả modifier, đồng hồ chuẩn bị, nút tốc độ ×1/×2.

- [ ] **Step 1: Cài đặt `GameScene`, `TopBar`, `theme`.**
- [ ] **Step 2: `npm run build` thành công, `npm test` vẫn PASS.**
- [ ] **Step 3: Kiểm tra bằng mắt** (`npm run dev`, dùng skill `run` hoặc claude-in-chrome để mở và chụp màn hình): tạm gọi `summon` vài lần trong `create()` qua phím `S`; thấy nhân vật xuất hiện, kéo hai con giống nhau gộp được và được làm nổi khi kéo, quái chạy hết đường, HP giảm, số sát thương bay lên, ×2 nhanh gấp đôi.
- [ ] **Step 4: Commit** `feat: render board, enemies, drag-to-merge and top bar`

---

### Task 11: Phaser — thanh dưới, tay bài, bảng chi tiết, quiz, màn kết quả

**Files:**
- Create: `src/ui/BottomBar.ts`, `src/ui/Hand.ts`, `src/ui/UnitPanel.ts`, `src/ui/QuizModal.ts`, `src/ui/ResultScreen.ts`, `src/ui/Toast.ts`
- Modify: `src/scenes/GameScene.ts` (bỏ phím `S` tạm)

**Interfaces:**
- Consumes: lệnh ở Task 3, `startWave`, `startQuiz/answerQuiz/closeQuiz`, `summonCost/drawCost/luckCost`, `computeStats`, `modifierOf`.
- Lệnh trả `ok: false` → `Toast` hiện lý do tiếng Việt: gold "Không đủ vàng", noSlot "Hết ô trống", handFull "Tay bài đã đầy", maxLuck "Luck đã tối đa", rangeCap "Tầm đánh đã tối đa", invalid/gameOver không hiện.

Hành vi:
- **BottomBar:** nút "Triệu hồi (giá)", "Rút thẻ (giá)", "Luck Lv n (giá)", "Thử thách toán" (chỉ bật khi đang chuẩn bị và chưa dùng), "Bắt đầu ngay" (chỉ khi đang chuẩn bị). Nút mờ khi không dùng được. Mọi nút cao ≥ 56px.
- **Hand:** tối đa 5 thẻ, mỗi thẻ ghi chỉ số + giá trị ("+20% Sát thương"), viền theo độ hiếm. Áp thẻ bằng hai cách: kéo thẻ thả lên nhân vật, hoặc chạm thẻ (thẻ nổi lên) rồi chạm nhân vật. Nút "Bỏ" nhỏ trên thẻ đang chọn → `discardCard`. Event `cardGranted` làm thẻ mới nháy sáng; `cardConverted` hiện toast "Tay bài đầy: +N vàng".
- **UnitPanel** (khi chọn nhân vật): tên lớp, cấp, độ hiếm, chỉ số cuối (`computeStats` với `rangeMult`), cộng ngẫu nhiên (%), cộng từ thẻ, mô tả bị động và chủ động, thanh hồi chiêu, nút "Bán (+N vàng)" với N = floor(goldInvested / 2). Chạm ra ngoài thì đóng.
- **QuizModal:** câu hỏi to, 4 nút đáp án lớn (lưới 2×2), thanh đếm ngược 8 giây; sau khi trả lời hiện đúng/sai + phần thưởng, đóng sau 1.2s (`closeQuiz`). Trận vẫn chạy phía sau.
- **Banner** giữa màn hình khi `waveStart` ("Wave 5", tên modifier nếu có) và khi `waveEnd` ("+N vàng").
- **ResultScreen** khi won/lost: "Chiến thắng!" / "Thất bại", wave đạt được, số quái đã giết, nút "Chơi lại" → `restart()`.

- [ ] **Step 1: Cài đặt các thành phần UI.**
- [ ] **Step 2: `npm run build` thành công, `npm test` PASS.**
- [ ] **Step 3: Chơi thử trọn một ván trên trình duyệt** (claude-in-chrome; ghi GIF `merge_defense_playthrough.gif`). Danh sách kiểm:
  - triệu hồi tới khi hết ô → toast "Hết ô trống"; bán một con → nhận đúng số vàng ghi trên nút
  - rút thẻ tới 5 → nút bị mờ; áp thẻ bằng kéo thả và bằng chạm-chạm; thẻ Tầm vào con đã tối đa → toast
  - quiz: trả lời nhanh nhận thẻ Hiếm trở lên; để hết giờ → không thưởng; nút quiz tắt sau khi dùng
  - modifier hiện ở thanh trên và banner; boss xuất hiện wave 10
  - Triệu hồi sư gọi lính chặn quái; boss giẫm qua
  - thu cửa sổ trình duyệt hẹp lại → game co giãn vừa khung, vẫn bấm được
  - thua → màn kết quả → "Chơi lại" bắt đầu ván mới sạch
- [ ] **Step 4: Commit** `feat: bottom bar, card hand, unit panel, quiz modal and result screen`
