import Phaser from 'phaser';
import { createGame } from '../sim/state';
import { tick, startWave } from '../sim/game';
import { summon, dragUnit } from '../sim/commands';
import { canMerge, computeStats } from '../sim/units';
import { unitPos } from '../sim/combat';
import { enemyPos } from '../sim/enemies';
import { pathTiles, tileCenter } from '../sim/path';
import type { GameEvent, GameState, Unit, Vec } from '../sim/types';
import { TopBar } from '../ui/TopBar';
import { BOTTOM_H, COLORS, FONT, GAME_H, GAME_W, MAX_TILE, RARITY_COLOR, TOP_BAR_H } from '../ui/theme';

const DRAG_THRESHOLD = 8;

export class GameScene extends Phaser.Scene {
  state!: GameState;
  speed: 1 | 2 = 1;
  selectedUnitId: number | null = null;
  tileSize = MAX_TILE;
  private originX = 0;
  private originY = 0;
  private board!: Phaser.GameObjects.Graphics;
  private dyn!: Phaser.GameObjects.Graphics;
  private topBar!: TopBar;
  private starTexts = new Map<number, Phaser.GameObjects.Text>();
  private staticTexts: Phaser.GameObjects.Text[] = [];
  private drag: { slot: number; startX: number; startY: number; x: number; y: number; moving: boolean } | null = null;

  constructor() {
    super('Game');
  }

  create(): void {
    this.state = createGame(Date.now());
    this.board = this.add.graphics().setDepth(0);
    this.dyn = this.add.graphics().setDepth(10);
    this.topBar = new TopBar(this, () => {
      this.speed = this.speed === 1 ? 2 : 1;
    });
    this.layout();
    this.drawBoard();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.keyboard?.on('keydown-S', () => summon(this.state)); // TẠM: Task 11 xóa
    this.input.keyboard?.on('keydown-W', () => startWave(this.state)); // TẠM
  }

  /** Tạo lại ván mới và xóa mọi đối tượng hiển thị. */
  restart(): void {
    this.state = createGame(Date.now());
    this.selectedUnitId = null;
    this.drag = null;
    this.speed = 1;
    for (const t of this.starTexts.values()) t.destroy();
    this.starTexts.clear();
    this.dyn.clear();
    this.layout();
    this.drawBoard();
  }

  toScreen(v: Vec): { x: number; y: number } {
    return { x: this.originX + v.x * this.tileSize, y: this.originY + v.y * this.tileSize };
  }

  private layout(): void {
    const m = this.state.map;
    const availH = GAME_H - TOP_BAR_H - BOTTOM_H;
    this.tileSize = Math.max(16, Math.floor(Math.min(MAX_TILE, availH / m.rows, GAME_W / m.cols)));
    this.originX = (GAME_W - m.cols * this.tileSize) / 2;
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
        this.add.text(c.x, c.y, txt, { fontFamily: FONT, fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(1),
      );
    };
    label(first, 'Vào');
    label(last, 'Ra');
  }

  private slotAt(x: number, y: number): number {
    const t = this.tileSize;
    const tx = Math.floor((x - this.originX) / t);
    const ty = Math.floor((y - this.originY) / t);
    return this.state.map.slots.findIndex((s) => s.x === tx && s.y === ty);
  }

  private onDown(p: Phaser.Input.Pointer): void {
    const slot = this.slotAt(p.x, p.y);
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
    const s = this.state;
    tick(s, Math.min(delta / 1000, 0.25) * this.speed);
    this.render();
    this.topBar.update(s, this.speed);
    for (const e of s.events) this.handleEvent(e);
    s.events.length = 0;
  }

  private unitScreen(u: Unit): { x: number; y: number } {
    return this.toScreen(unitPos(this.state, u));
  }

  private drawUnit(g: Phaser.GameObjects.Graphics, u: Unit, cx: number, cy: number, alpha = 1): void {
    const sz = this.tileSize - 10;
    const col = this.state.config.classes[u.classId].color;
    g.fillStyle(col, alpha).fillRect(cx - sz / 2, cy - sz / 2, sz, sz);
    g.lineStyle(3, RARITY_COLOR[u.rarity], alpha).strokeRect(cx - sz / 2, cy - sz / 2, sz, sz);
  }

  private render(): void {
    const s = this.state;
    const g = this.dyn;
    const t = this.tileSize;
    g.clear();
    const dragging = this.drag?.moving ? this.drag : null;
    const dragId = dragging ? s.slots[dragging.slot] : null;
    const dragUnitObj = dragId !== null && dragId !== undefined ? s.units.get(dragId) : undefined;

    const live = new Set<number>();
    for (const u of s.units.values()) {
      live.add(u.id);
      const c = this.unitScreen(u);
      const isDragged = dragUnitObj?.id === u.id;
      this.drawUnit(g, u, c.x, c.y, isDragged ? 0.3 : 1);
      if (dragUnitObj && !isDragged && canMerge(s.config, dragUnitObj, u)) {
        const blink = 0.5 + 0.5 * Math.sin(this.time.now / 100);
        g.lineStyle(4, COLORS.highlight, 0.4 + 0.6 * blink).strokeRect(c.x - t / 2 + 1, c.y - t / 2 + 1, t - 2, t - 2);
      }
      let st = this.starTexts.get(u.id);
      if (!st) {
        st = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '12px', color: '#fff176', fontStyle: 'bold' }).setOrigin(0, 0).setDepth(20);
        this.starTexts.set(u.id, st);
      }
      st.setText('★' + u.level).setPosition(c.x - t / 2 + 4, c.y - t / 2 + 3).setAlpha(isDragged ? 0.3 : 1);
    }
    for (const [id, tx] of this.starTexts) {
      if (!live.has(id)) {
        tx.destroy();
        this.starTexts.delete(id);
      }
    }

    const sel = this.selectedUnitId !== null ? s.units.get(this.selectedUnitId) : undefined;
    if (sel) {
      const c = this.unitScreen(sel);
      const range = computeStats(s.config, sel, 1).range;
      g.fillStyle(0xffffff, 0.06).fillCircle(c.x, c.y, range * t);
      g.lineStyle(2, 0xffffff, 0.8).strokeCircle(c.x, c.y, range * t);
    } else if (this.selectedUnitId !== null) {
      this.selectedUnitId = null;
    }

    for (const e of s.enemies) {
      if (e.dead) continue;
      const c = this.toScreen(enemyPos(s, e));
      const r = (e.kind === 'boss' ? 0.5 : 0.25) * t;
      g.fillStyle(s.config.enemies[e.kind].color, 1).fillCircle(c.x, c.y, r);
      if (e.burn) g.lineStyle(3, COLORS.burn, 1).strokeCircle(c.x, c.y, r + 1);
      this.bar(g, c.x, c.y - r - 6, r * 2, 4, e.hp / e.maxHp, 0xe53935);
    }

    for (const m of s.minions) {
      const c = this.toScreen(m.pos);
      g.fillStyle(COLORS.minion, 1).fillCircle(c.x, c.y, t * 0.14);
      this.bar(g, c.x, c.y - t * 0.14 - 5, t * 0.3, 3, m.hp / m.maxHp, 0x66bb6a);
    }

    if (dragging && dragUnitObj) this.drawUnit(g, dragUnitObj, dragging.x, dragging.y, 0.9);
  }

  private bar(g: Phaser.GameObjects.Graphics, cx: number, y: number, w: number, h: number, frac: number, color: number): void {
    g.fillStyle(0x000000, 0.6).fillRect(cx - w / 2, y, w, h);
    g.fillStyle(color, 1).fillRect(cx - w / 2, y, w * Math.max(0, Math.min(1, frac)), h);
  }

  private floatText(v: Vec, txt: string, color: string, size: number): void {
    const c = this.toScreen(v);
    const tx = this.add
      .text(c.x + Phaser.Math.Between(-8, 8), c.y, txt, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(50);
    this.tweens.add({ targets: tx, y: c.y - 36, alpha: 0, duration: 800, onComplete: () => tx.destroy() });
  }

  private handleEvent(e: GameEvent): void {
    switch (e.type) {
      case 'damage':
        this.floatText(e.pos, String(Math.round(e.amount)), e.crit ? COLORS.crit : '#ffffff', e.crit ? 22 : 14);
        break;
      case 'kill':
        this.floatText(e.pos, `+${e.gold}`, COLORS.gold, 16);
        break;
      case 'skill': {
        const c = this.toScreen(e.pos);
        const ring = this.add.circle(c.x, c.y, this.tileSize * 0.3, 0xffffff, 0.35).setStrokeStyle(3, 0xfff59d).setDepth(40);
        this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 350, onComplete: () => ring.destroy() });
        break;
      }
      case 'leak':
        this.cameras.main.shake(150, 0.004);
        break;
      default:
        break;
    }
  }
}
