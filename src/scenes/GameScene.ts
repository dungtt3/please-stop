import Phaser from 'phaser';
import { createGame } from '../sim/state';
import { restoreGame, type RunSave } from '../sim/save';
import { tick } from '../sim/game';
import { dragUnit } from '../sim/commands';
import { canMerge, computeStats } from '../sim/units';
import { unitPos } from '../sim/combat';
import { modifierOf } from '../sim/enemies';
import { pathTiles, tileCenter } from '../sim/path';
import type { CommandResult, GameEvent, GameState, Unit, Vec } from '../sim/types';
import { TopBar } from '../ui/TopBar';
import { BottomBar } from '../ui/BottomBar';
import { Hand } from '../ui/Hand';
import { UnitPanel } from '../ui/UnitPanel';
import { QuizModal } from '../ui/QuizModal';
import { ResultScreen } from '../ui/ResultScreen';
import { PauseMenu } from '../ui/PauseMenu';
import { sfx } from '../audio/sfx';
import { Banner, Toast } from '../ui/Toast';
import { browserStore } from '../settings/configStore';
import { LEAK_CUE_MIN_GAP_MS, motion, REDUCED_FX_MAX_MS, ShakeGate } from '../settings/motion';
import { resolveConfig } from '../settings/resolveConfig';
import { configHash } from '../settings/configHash';
import { recordRun, TIMEOUT_MS } from '../net/cloud';
import { recordBest } from '../save/best';
import { SaveManager } from '../save/SaveManager';
import { RunSaver } from './RunSaver';
import { PointerShield } from './PointerShield';
import { runRestart } from './restartFlow';
import { isEditableTarget, keyAction } from '../ui/keys';
import { getOrientation, onOrientation, soundSuspended } from '../ui/orientation';
import { getCloudCache, refreshCloudCache } from '../net/cloudCache';
import { boardTile, topBarOwns } from '../ui/layout';
import { BOTTOM_H, COLORS, GAME_H, MAP_LEFT, MAX_TILE, TOP_BAR_H, textStyle } from '../ui/theme';
import { BossBar } from '../ui/BossBar';
import { BoardViews } from '../visuals/BoardViews';
import { Effects } from '../visuals/effects';
import { getVisuals } from '../visuals/loader';
import { drawRarityPips, drawUnitBody } from '../visuals/views';

const DRAG_THRESHOLD = 8;
/** Giảm chuyển động: viền đỏ mờ ở mép bàn khi quái lọt. */
const LEAK_CUE_COLOR = 0xe53935;
const LEAK_CUE_ALPHA = 0.5;

export type GameStart =
  | { kind: 'new' }
  | { kind: 'resume'; save: RunSave }
  | { kind: 'lost'; save: RunSave; record: boolean };
export interface GameSceneData {
  manager: SaveManager;
  start: GameStart;
  accountName: string | null;
}

export class GameScene extends Phaser.Scene {
  state!: GameState;
  speed: 1 | 2 = 1;
  selectedUnitId: number | null = null;
  tileSize = MAX_TILE;
  private originX = 0;
  private originY = 0;
  private board!: Phaser.GameObjects.Graphics;
  /** Viền gộp + vùng tầm (giữa lớp nhân vật và lớp quái). */
  private dyn!: Phaser.GameObjects.Graphics;
  /** Hình kéo theo con trỏ khi kéo nhân vật (trên cùng bàn chơi). */
  private ghost!: Phaser.GameObjects.Graphics;
  /** View riêng cho từng nhân vật / quái / lính. */
  private views!: BoardViews;
  /** Đạn, hiệu ứng trúng đích và skill. */
  private effects!: Effects;
  private bossBar!: BossBar;
  private topBar!: TopBar;
  private bottomBar!: BottomBar;
  private hand!: Hand;
  private unitPanel!: UnitPanel;
  private quizModal!: QuizModal;
  private resultScreen!: ResultScreen;
  private pauseMenu!: PauseMenu;
  private toast!: Toast;
  private banner!: Banner;
  /** Chống rung màn hình dồn dập (≥ 300 ms giữa hai lần). */
  private readonly shakeGate = new ShakeGate(() => this.time.now);
  /** Giảm chuyển động: viền đỏ + nhấp máu khi quái lọt tối đa < 3 lần/giây (chống nhấp nháy). */
  private readonly leakCueGate = new ShakeGate(() => this.time.now, LEAK_CUE_MIN_GAP_MS);
  /** Một viền duy nhất dùng lại cho mọi lần báo lọt (khởi động lại hiệu ứng mờ, không chồng viền). */
  private leakEdge: Phaser.GameObjects.Rectangle | null = null;
  private leakEdgeTween: Phaser.Tweens.Tween | null = null;
  private staticTexts: Phaser.GameObjects.Text[] = [];
  private menuOpen = false;
  /** Lớp phủ "Xoay ngang" đang che màn hình: ván đứng yên (kể cả đồng hồ quiz), độc lập với `menuOpen`. */
  private orientationBlocked = false;
  /** Lần chạm vừa đóng/mở popup không được lọt xuống bàn chơi. */
  private shield = new PointerShield();
  private runRecorded = false;
  /** Ván vừa kết thúc ở màn này phá kỷ lục cá nhân (kỷ lục cũ được đọc trước khi ghi). */
  private newBest = false;
  /** Đã phát tiếng thắng/thua của ván này (chỉ một lần). */
  private endSounded = false;
  private saver!: RunSaver;
  private manager!: SaveManager;
  private accountName: string | null = null;
  /** Đã xung đột với máy khác: đóng băng ván cho tới khi về màn hình chính. */
  private halted = false;
  private conflictTimer: Phaser.Time.TimerEvent | null = null;
  private drag: { slot: number; startX: number; startY: number; x: number; y: number; moving: boolean } | null = null;

  constructor() {
    super('Game');
  }

  create(data?: Partial<GameSceneData>): void {
    this.manager = data?.manager ?? new SaveManager({ store: browserStore(), cloud: null, userId: null });
    this.accountName = data?.accountName ?? null;
    const start: GameStart = data?.start ?? { kind: 'new' };
    this.saver = new RunSaver(this.manager, {
      onConflict: () => this.onSaveConflict(),
      onUnsaved: () => this.toast.show('Trình duyệt chặn lưu trữ — ván này sẽ không được lưu'),
    });
    // Scene được dùng lại giữa các lần vào ván: xóa trạng thái cũ (đối tượng hiển thị đã bị hủy).
    this.staticTexts = [];
    this.leakEdge = null;
    this.leakEdgeTween = null;
    this.menuOpen = false;
    this.orientationBlocked = false;
    this.shield = new PointerShield();
    this.halted = false;
    this.speed = 1;
    this.selectedUnitId = null;
    this.drag = null;
    this.runRecorded = false;
    this.newBest = false;
    this.endSounded = false;
    const cfg = this.resolveCfg().config;
    if (start.kind === 'new') {
      this.state = createGame(Date.now(), cfg);
    } else {
      this.state = restoreGame(start.save);
      if (start.kind === 'lost') {
        this.state.phase = 'lost';
        // Bản ghi ps_runs do update() ghi đúng một lần (nếu lần load này xóa được bản lưu).
        this.runRecorded = !start.record;
        this.endSounded = true; // ván thua đã báo từ lần trước: không phát lại tiếng
      }
    }
    this.board = this.add.graphics().setDepth(0);
    this.dyn = this.add.graphics().setDepth(11);
    this.ghost = this.add.graphics().setDepth(30);
    this.views = this.makeViews();
    this.effects = this.makeEffects();
    this.topBar = new TopBar(
      this,
      () => {
        this.speed = this.speed === 1 ? 2 : 1;
      },
      () => this.openMenu(),
    );
    this.layout();
    this.drawBoard();

    const getState = () => this.state;
    const act = (r: CommandResult) => this.toast.result(r);
    this.toast = new Toast(this);
    this.banner = new Banner(this);
    this.bottomBar = new BottomBar(this, getState, act);
    this.hand = new Hand(this, getState, act, (x, y) => this.slotAt(x, y));
    this.unitPanel = new UnitPanel(this, getState, act, () => {
      this.selectedUnitId = null;
    });
    this.quizModal = new QuizModal(this, getState, act);
    this.bossBar = new BossBar(this);
    this.resultScreen = new ResultScreen(
      this,
      () => this.restart(),
      () => this.scene.start('Start'),
      () => this.accountName ?? '',
    );

    this.pauseMenu = new PauseMenu(this, {
      onToggle: (open) => {
        this.menuOpen = open;
        this.shield.arm();
        this.syncSound();
        if (open) this.cancelInput();
      },
      phase: () => this.state.phase,
      saveAndLeave: async () => {
        await this.saver.saveAndWait(this.state, TIMEOUT_MS);
        this.saver.stop();
        this.scene.start('Start');
      },
      quitAsLoss: () => {
        // Ván đã mất quyền (xung đột/đã kết thúc): chỉ về màn hình chính, không ghi thêm.
        if (this.saver.live) this.recordResult(false);
        this.scene.start('Start');
      },
      restart: () => {
        // Ghi thua đúng một lần (recordResult tự chống ghi lại, kể cả kỷ lục) rồi chơi ván mới.
        runRestart({
          halted: () => this.halted,
          live: () => this.saver.live,
          recordLoss: () => this.recordResult(false),
          restart: () => this.restart(),
          closePopup: () => this.pauseMenu.close(),
        });
      },
    });

    // Phím tắt: một listener cho cả scene, gỡ khi SHUTDOWN. Bỏ qua phím gõ vào ô nhập tên (DOM).
    const onKey = (e: KeyboardEvent): void => {
      const act = keyAction(e.key, {
        popupOpen: this.pauseMenu.open,
        confirmOpen: this.pauseMenu.confirming,
        blocked: this.resultScreen.open || this.quizModal.open || this.halted || this.orientationBlocked,
        targetEditable: isEditableTarget(e.target),
        modifier: e.ctrlKey || e.altKey || e.metaKey,
        repeat: e.repeat,
      });
      if (act === null) return;
      e.preventDefault(); // Space không cuộn trang
      if (act === 'open') this.openMenu();
      else if (act === 'close') this.pauseMenu.requestClose();
      else this.pauseMenu.cancelConfirm();
    };
    window.addEventListener('keydown', onKey);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('pointerupoutside', () => {
      this.drag = null;
    });

    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        this.saver.flushPrep(this.state);
      }
      this.syncSound();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Lớp phủ xoay ngang: dừng ván khi dọc; xoay lại thì mở popup nếu mở được, không thì chỉ bỏ cờ.
    const orient = getOrientation();
    const offOrient = orient.onChange((blocked) => this.applyOrientation(blocked));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offOrient();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', onKey);
      this.menuOpen = false;
      this.orientationBlocked = false;
      sfx.setSuspended(document.visibilityState === 'hidden');
      this.saver.stop();
      this.conflictTimer?.remove(false);
      this.conflictTimer = null;
      this.views.destroy();
      this.effects.destroy();
    });

    if (start.kind === 'new') this.saver.beginNew(this.state);
    else if (start.kind === 'resume') this.saver.resume(start.save);
    else this.saver.markLost(start.save);

    // Vào ván khi màn hình đang dọc: đứng yên ngay (không tự mở popup).
    if (orient.blocked()) this.applyOrientation(true);
  }

  /** Áp chuyển trạng thái hướng màn hình (logic thuần ở `onOrientation`). */
  private applyOrientation(blocked: boolean): void {
    const a = onOrientation(blocked, {
      popupOpen: this.pauseMenu.open,
      quizOpen: this.quizModal.open,
      resultOpen: this.resultScreen.open,
      halted: this.halted,
    });
    this.orientationBlocked = a.blocked;
    if (a.cancelInput) this.cancelInput();
    this.syncSound();
    if (a.openPopup) this.openMenu();
  }

  /** Hủy kéo thả bàn chơi và nhấn/kéo thẻ bài đang dở (tạm dừng không được để chúng sống tiếp). */
  private cancelInput(): void {
    this.drag = null;
    this.hand.cancelPress();
  }

  /** Âm thanh chỉ chạy khi không có popup, không bị lớp phủ xoay và tab đang hiện. */
  private syncSound(): void {
    sfx.setSuspended(
      soundSuspended({
        popupOpen: this.menuOpen,
        orientationBlocked: this.orientationBlocked,
        hidden: document.visibilityState === 'hidden',
      }),
    );
  }

  private onSaveConflict(): void {
    this.halted = true;
    // Popup (depth 450) che biển thông báo (350): đóng trước để người chơi đọc được. halted đã giữ ván đứng yên.
    this.pauseMenu?.close();
    this.banner.show('Ván này đã được chơi ở thiết bị khác');
    this.conflictTimer = this.time.delayedCall(2000, () => this.scene.start('Start'));
  }

  /** Tạo lại ván mới và xóa mọi đối tượng hiển thị. */
  restart(): void {
    this.state = createGame(Date.now(), this.resolveCfg().config);
    this.runRecorded = false;
    this.newBest = false;
    this.endSounded = false;
    this.halted = false;
    this.conflictTimer?.remove(false);
    this.conflictTimer = null;
    this.saver.beginNew(this.state);
    // Tải nền để ván sau nhận cấu hình cloud mới nhất, không chặn ván này.
    void refreshCloudCache().catch(() => undefined);
    this.selectedUnitId = null;
    this.drag = null;
    this.speed = 1;
    this.hand.reset();
    this.views.destroy();
    this.views = this.makeViews();
    this.effects.destroy();
    this.effects = this.makeEffects();
    this.dyn.clear();
    this.ghost.clear();
    this.layout();
    this.drawBoard();
  }

  private makeViews(): BoardViews {
    return new BoardViews(this, getVisuals(), (v) => this.toScreen(v), () => this.tileSize);
  }

  private makeEffects(): Effects {
    return new Effects(this, getVisuals(), (v) => this.toScreen(v), () => this.tileSize, () => this.state.config.skills.mage.splashRadius);
  }

  /** Người chơi luôn dùng cấu hình cloud (hoặc mặc định nếu cloud trống/lỗi). */
  private resolveCfg(): ReturnType<typeof resolveConfig> {
    const r = resolveConfig({ cloud: getCloudCache()?.config ?? null });
    if (r.errors.length) console.warn('Cấu hình cloud có giá trị không hợp lệ, đã dùng mặc định cho các trường đó:', r.errors);
    return r;
  }

  /** Nút ⚙: mở popup tạm dừng (không mở khi đang có màn kết quả, quiz hoặc ván bị đóng băng). */
  private openMenu(): void {
    if (this.resultScreen.open || this.quizModal.open || this.halted || this.orientationBlocked) return;
    this.pauseMenu.show();
  }

  /** Ghi kết quả ván lên cloud đúng một lần và xóa bản lưu. Dùng cho thắng/thua tự nhiên và thoát giữa wave (tính thua). */
  private recordResult(won: boolean): void {
    if (this.runRecorded) return;
    this.runRecorded = true;
    const s = this.state;
    void recordRun({ waveReached: s.wave, won, kills: s.kills, durationS: this.saver.runSeconds, configHash: configHash(s.config) });
    // Cùng chỗ và cùng guard với recordRun: mỗi ván cập nhật kỷ lục đúng một lần.
    this.newBest = recordBest(browserStore(), { wave: s.wave, kills: s.kills, won }).isNew;
    this.saver.end();
  }

  toScreen(v: Vec): { x: number; y: number } {
    return { x: this.originX + v.x * this.tileSize, y: this.originY + v.y * this.tileSize };
  }

  private layout(): void {
    const m = this.state.map;
    const availH = GAME_H - TOP_BAR_H - BOTTOM_H;
    // Ô tính từ chiều cao còn lại giữa hai thanh và chiều rộng trái cột phải (`layout.ts`).
    this.tileSize = boardTile(m.rows, m.cols);
    this.originX = MAP_LEFT;
    this.originY = TOP_BAR_H + (availH - m.rows * this.tileSize) / 2;
  }

  private drawBoard(): void {
    const s = this.state;
    const t = this.tileSize;
    const g = this.board;
    g.clear();
    for (const o of this.staticTexts) o.destroy();
    this.staticTexts = [];
    const tl = this.toScreen({ x: 0, y: 0 });
    g.fillStyle(COLORS.ground, 1).fillRect(tl.x, tl.y, s.map.cols * t, s.map.rows * t);
    g.fillStyle(COLORS.path, 1);
    for (const p of pathTiles(s.map.path)) {
      const q = this.toScreen(p);
      g.fillRect(q.x, q.y, t, t);
    }
    g.lineStyle(1, COLORS.slotLine, 0.35);
    for (const sl of s.map.slots) {
      const q = this.toScreen(sl);
      g.fillStyle(COLORS.slot, 0.55).fillRect(q.x + 2, q.y + 2, t - 4, t - 4);
      g.strokeRect(q.x + 2, q.y + 2, t - 4, t - 4);
    }
    const first = s.map.path[0];
    const last = s.map.path[s.map.path.length - 1];
    const label = (v: Vec, txt: string) => {
      const c = this.toScreen(tileCenter(v));
      this.staticTexts.push(
        this.add.text(c.x, c.y, txt, textStyle({ size: 14, color: '#ffffff', bold: true })).setOrigin(0.5).setDepth(1),
      );
    };
    label(first, 'Vào');
    label(last, 'Ra');
  }

  slotAt(x: number, y: number): number {
    const t = this.tileSize;
    const tx = Math.floor((x - this.originX) / t);
    const ty = Math.floor((y - this.originY) / t);
    return this.state.map.slots.findIndex((s) => s.x === tx && s.y === ty);
  }

  /**
   * Vùng UI (thanh trên/dưới, bảng, modal) sở hữu con trỏ; bản đồ bỏ qua. Vùng chạm thanh dưới bắt đầu
   * đúng ở đáy hàng cuối của bàn chơi (không lấn), nên chạm vào ô hàng cuối luôn thuộc bàn chơi.
   */
  private uiOwns(p: Phaser.Input.Pointer): boolean {
    return (
      this.menuOpen || this.orientationBlocked || topBarOwns(p.x, p.y) || p.y >= GAME_H - BOTTOM_H || this.unitPanel.contains(p.x, p.y) ||
      this.quizModal.open || this.resultScreen.open || this.hand.busy
    );
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.shield.consume()) return;
    if (this.uiOwns(p)) return;
    const slot = this.slotAt(p.x, p.y);
    if (this.hand.selectedId !== null && slot >= 0 && this.state.slots[slot] !== null) {
      const uid = this.state.slots[slot];
      if (this.hand.applyTo(this.hand.selectedId, slot)) this.selectedUnitId = uid;
      return;
    }
    if (slot < 0 || this.state.slots[slot] === null) {
      this.selectedUnitId = null;
      return;
    }
    this.drag = { slot, startX: p.x, startY: p.y, x: p.x, y: p.y, moving: false };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d) return;
    d.x = p.x;
    d.y = p.y;
    if (!d.moving && Math.hypot(p.x - d.startX, p.y - d.startY) >= DRAG_THRESHOLD) d.moving = true;
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (!d.moving) {
      this.selectedUnitId = this.state.slots[d.slot];
      return;
    }
    const to = this.slotAt(p.x, p.y);
    if (to >= 0 && to !== d.slot) dragUnit(this.state, d.slot, to);
  }

  update(_: number, delta: number): void {
    this.shield.reset();
    const s = this.state;
    if (!this.menuOpen && !this.halted && !this.orientationBlocked) {
      const dt = Math.min(delta / 1000, 0.25) * this.speed;
      const live = s.phase !== 'won' && s.phase !== 'lost';
      tick(s, dt);
      if (live) this.saver.addSeconds(dt);
    }
    if (s.phase === 'won' || s.phase === 'lost') {
      this.recordResult(s.phase === 'won');
      if (!this.endSounded) {
        this.endSounded = true;
        sfx.play(s.phase === 'won' ? 'win' : 'lose');
      }
    }
    this.saver.tick(s, delta, this.menuOpen || this.halted || this.orientationBlocked);
    // Trước khi sync view: quái vừa chết còn view để chạy hoạt ảnh chết.
    for (const e of s.events) this.views.onEvent(e);
    this.render();
    this.bossBar.update(s);
    this.topBar.update(s, this.speed);
    this.bottomBar.update(s);
    this.hand.update(s);
    this.unitPanel.update(s, this.selectedUnitId);
    this.quizModal.update(s);
    this.resultScreen.update(s, this.newBest);
    for (const e of s.events) this.handleEvent(e);
    s.events.length = 0;
  }

  private unitScreen(u: Unit): { x: number; y: number } {
    return this.toScreen(unitPos(this.state, u));
  }

  private drawUnit(g: Phaser.GameObjects.Graphics, u: Unit, cx: number, cy: number, alpha = 1): void {
    const col = this.state.config.classes[u.classId].color;
    drawUnitBody(g, u.classId, col, u.rarity, this.tileSize, cx, cy, true, alpha);
    drawRarityPips(g, u.rarity, this.tileSize, cx, cy, alpha);
  }

  private render(): void {
    const s = this.state;
    const g = this.dyn;
    const t = this.tileSize;
    g.clear();
    this.ghost.clear();
    const dragging = this.drag?.moving ? this.drag : null;
    const dragId = dragging ? s.slots[dragging.slot] : null;
    const dragUnitObj = dragId !== null && dragId !== undefined ? s.units.get(dragId) : undefined;

    this.views.sync(s, { draggingUnitId: dragUnitObj ? dragUnitObj.id : null });

    if (dragUnitObj) {
      const blink = 0.5 + 0.5 * Math.sin(this.time.now / 100);
      for (const u of s.units.values()) {
        if (u.id === dragUnitObj.id || !canMerge(s.config, dragUnitObj, u)) continue;
        const c = this.unitScreen(u);
        g.lineStyle(4, COLORS.highlight, 0.4 + 0.6 * blink).strokeRect(c.x - t / 2 + 1, c.y - t / 2 + 1, t - 2, t - 2);
      }
    }

    const sel = this.selectedUnitId !== null ? s.units.get(this.selectedUnitId) : undefined;
    if (sel) {
      const c = this.unitScreen(sel);
      const range = computeStats(s.config, sel, modifierOf(s).rangeMult).range;
      g.fillStyle(0xffffff, 0.06).fillCircle(c.x, c.y, range * t);
      g.lineStyle(2, 0xffffff, 0.8).strokeCircle(c.x, c.y, range * t);
    } else if (this.selectedUnitId !== null) {
      this.selectedUnitId = null;
    }

    if (dragging && dragUnitObj) this.drawUnit(this.ghost, dragUnitObj, dragging.x, dragging.y, 0.9);
  }

  private floatText(v: Vec, txt: string, color: string, size: number): void {
    const c = this.toScreen(v);
    const tx = this.add
      .text(c.x + Phaser.Math.Between(-8, 8), c.y, txt, textStyle({ size, color, bold: true, stroke: { color: '#000000', width: 3 } }))
      .setOrigin(0.5)
      .setDepth(50);
    // Giảm chuyển động: chữ hiện tại chỗ rồi mờ, không bay lên.
    const calm = motion.reduced;
    this.tweens.add({ targets: tx, ...(calm ? {} : { y: c.y - 36 }), alpha: 0, duration: calm ? 600 : 800, onComplete: () => tx.destroy() });
  }

  /** Giảm chuyển động: viền đỏ mờ ở mép bàn thay cho rung, tắt trong ≤ 200 ms. */
  private leakCue(): void {
    const m = this.state.map;
    const tl = this.toScreen({ x: 0, y: 0 });
    this.leakEdgeTween?.stop();
    this.leakEdge ??= this.add.rectangle(0, 0, 1, 1).setOrigin(0).setDepth(55);
    this.leakEdge
      .setPosition(tl.x, tl.y).setSize(m.cols * this.tileSize, m.rows * this.tileSize)
      .setStrokeStyle(6, LEAK_CUE_COLOR, LEAK_CUE_ALPHA).setAlpha(1).setVisible(true);
    this.leakEdgeTween = this.tweens.add({
      targets: this.leakEdge, alpha: 0, duration: REDUCED_FX_MAX_MS,
      onComplete: () => this.leakEdge?.setVisible(false),
    });
  }

  private handleEvent(e: GameEvent): void {
    switch (e.type) {
      case 'attack':
        this.effects.onEvent(e);
        sfx.play(e.crit ? 'crit' : 'hit');
        break;
      case 'summon':
        sfx.play('summon');
        break;
      case 'merge':
        sfx.play('merge');
        break;
      case 'quiz':
        sfx.play(e.result === 'correct' ? 'quizRight' : 'quizWrong');
        break;
      case 'damage':
        this.floatText(e.pos, String(Math.round(e.amount)), e.crit ? COLORS.crit : '#ffffff', e.crit ? 22 : 14);
        break;
      case 'kill':
        this.floatText(e.pos, `+${e.gold}`, COLORS.gold, 18);
        sfx.play(e.kind === 'boss' ? 'bossKill' : 'kill');
        break;
      case 'skill':
        this.effects.onEvent(e);
        sfx.play(`skill.${e.skill}`);
        break;
      case 'cardGranted':
        this.hand.flash(e.card.id);
        break;
      case 'cardConverted':
        this.toast.show(`Tay bài đầy: +${e.gold} vàng`);
        break;
      case 'waveStart': {
        this.saver.waveStarted(this.state);
        sfx.play('waveStart');
        const m = this.state.modifier ? this.state.config.modifiers[this.state.modifier].name : '';
        this.banner.show(m ? `Wave ${e.wave}
${m}` : `Wave ${e.wave}`);
        break;
      }
      case 'waveEnd':
        this.saver.waveEnded(this.state);
        sfx.play('waveEnd');
        this.banner.show(`+${e.reward} vàng`, COLORS.gold);
        break;
      case 'leak':
        if (motion.reduced) {
          if (this.leakCueGate.allow()) {
            this.leakCue();
            this.topBar.pulseHp();
          }
        } else if (this.shakeGate.allow()) this.cameras.main.shake(150, 0.002);
        sfx.play('leak');
        break;
      default:
        break;
    }
  }
}
