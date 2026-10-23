// Đối tượng hiển thị riêng cho từng nhân vật / quái / lính trên bàn chơi.
// Có sprite (manifest) thì dùng sprite + hoạt ảnh; không có thì vẽ hình khối như trước.
import Phaser from 'phaser';
import type { ClassId, Enemy, EnemyKind, Minion, Rarity, Unit } from '../sim/types';
import { COLORS, FONT, RARITY_COLOR } from '../ui/theme';
import type { VisualRegistry } from './loader';
import type { VisualKey } from './manifest';
import { applyEntry } from './applyEntry';
import { formatNum, hpFraction, hpValue } from './viewMath';

export const UNIT_DEPTH = 10;
export const ENEMY_DEPTH = 12;
export const MINION_DEPTH = 13;
/** Hoạt ảnh chết tối đa (ms); hết giờ view tự hủy dù hoạt ảnh chưa xong. */
export const DIE_MAX_MS = 600;

const CD_H = 3;
const CD_CHARGING = 0x42a5f5;
const CD_READY = 0xfff59d;
const ENEMY_BAR_H = 6;
const ENEMY_BAR_COLOR = 0xe53935;
const MINION_BAR_COLOR = 0x66bb6a;

const PRIO_ATTACK = 1;
const PRIO_SKILL = 2;

/**
 * Một sprite với hoạt ảnh nền (idle/walk, có thể không có) và hoạt ảnh chạy một lần (attack/skill/die).
 * Không có hoạt ảnh nền: sprite ẩn, chỉ hiện trong lúc chạy hoạt ảnh một lần (`onShown` báo cho view ẩn/hiện hình khối).
 */
class Actor {
  readonly sprite: Phaser.GameObjects.Sprite;
  private current: VisualKey | null = null;
  private priority = 0;
  private finalCb: (() => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly v: VisualRegistry,
    private readonly base: VisualKey | null,
    private readonly tile: number,
    private readonly onShown: (shown: boolean) => void = () => undefined,
  ) {
    this.sprite = scene.add.sprite(0, 0, base ? v.textureKey(base) : '__DEFAULT');
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onComplete, this);
    if (base) this.playBase();
    else this.sprite.setVisible(false);
  }

  /** Mép trên của sprite so với gốc (âm = phía trên). */
  top(): number {
    return -this.sprite.displayHeight * this.sprite.originY;
  }

  private start(key: VisualKey, repeatOnce: boolean): void {
    applyEntry(this.sprite, this.v.entry(key), this.tile);
    this.sprite.setVisible(true);
    if (repeatOnce) this.sprite.play({ key: this.v.animKey(key), repeat: 0 });
    else this.sprite.play(this.v.animKey(key));
  }

  private playBase(): void {
    if (this.base) this.start(this.base, false);
  }

  /** Chạy một lần rồi về hoạt ảnh nền. Đang chạy hoạt ảnh ưu tiên cao hơn hoặc chính nó → bỏ qua. */
  playOnce(key: VisualKey, priority: number): void {
    if (this.finalCb || !this.v.has(key)) return;
    if (this.current && (priority < this.priority || this.current === key)) return;
    this.current = key;
    this.priority = priority;
    if (!this.base) this.onShown(true);
    this.start(key, true);
  }

  /** Hoạt ảnh cuối (die): chạy một lần rồi gọi `done`, không quay về hoạt ảnh nền. */
  playFinal(key: VisualKey, done: () => void): void {
    this.current = key;
    this.finalCb = done;
    this.onShown(true);
    this.start(key, true);
  }

  private onComplete(anim: Phaser.Animations.Animation): void {
    if (!this.current || anim.key !== this.v.animKey(this.current)) return;
    if (this.finalCb) {
      const cb = this.finalCb;
      this.finalCb = null;
      cb();
      return;
    }
    this.current = null;
    if (this.base) {
      this.playBase();
    } else {
      this.sprite.stop();
      this.sprite.setVisible(false);
      this.onShown(false);
    }
  }
}

/** Có ít nhất một khóa → tạo Actor (nền = `base` nếu có). */
function makeActor(
  scene: Phaser.Scene, v: VisualRegistry, base: VisualKey, others: VisualKey[], tile: number, onShown: (shown: boolean) => void,
): Actor | null {
  if (v.has(base)) return new Actor(scene, v, base, tile);
  if (others.some((k) => v.has(k))) return new Actor(scene, v, null, tile, onShown);
  return null;
}

/** Thanh tỉ lệ (nền đen + phần màu co theo scaleX). */
class Bar {
  readonly back: Phaser.GameObjects.Rectangle;
  readonly fill: Phaser.GameObjects.Rectangle;
  private frac = -1;
  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color: number) {
    this.back = scene.add.rectangle(x, y, w, h, 0x000000, 0.6).setOrigin(0);
    this.fill = scene.add.rectangle(x, y, w, h, color).setOrigin(0);
  }
  set(frac: number): void {
    if (frac === this.frac) return;
    this.frac = frac;
    this.fill.scaleX = frac;
  }
  setVisible(v: boolean): void {
    this.back.setVisible(v);
    this.fill.setVisible(v);
  }
}

export class UnitView {
  readonly root: Phaser.GameObjects.Container;
  /** Dấu lần sync cuối thấy unit này (BoardViews dùng để hủy view thừa). */
  seen = 0;
  private frame: Phaser.GameObjects.Rectangle;
  private actor: Actor | null;
  private stars: Phaser.GameObjects.Text;
  private cd: Bar;
  private level = -1;
  private rarity: Rarity | null = null;
  private ready: boolean | null = null;
  private dragged: boolean | null = null;

  constructor(scene: Phaser.Scene, v: VisualRegistry, private readonly classId: ClassId, color: number, tile: number) {
    const sz = tile - 10;
    // Hình vuông màu lớp + viền độ hiếm. Có sprite nền thì chỉ giữ viền độ hiếm (thông tin để gộp).
    this.frame = scene.add.rectangle(0, 0, sz, sz, color);
    const showShape = (shown: boolean): void => {
      this.frame.isFilled = !shown;
    };
    this.actor = makeActor(scene, v, `unit.${classId}.idle`, [`unit.${classId}.attack`, `unit.${classId}.skill`], tile, showShape);
    if (this.actor && v.has(`unit.${classId}.idle`)) this.frame.isFilled = false;
    this.cd = new Bar(scene, -sz / 2, tile / 2 - CD_H, sz, CD_H, CD_CHARGING);
    this.stars = scene.add
      .text(-tile / 2 + 4, -tile / 2 + 3, '', { fontFamily: FONT, fontSize: '12px', color: '#fff176', fontStyle: 'bold' })
      .setOrigin(0, 0);
    const parts: Phaser.GameObjects.GameObject[] = [this.frame];
    if (this.actor) parts.push(this.actor.sprite);
    parts.push(this.cd.back, this.cd.fill, this.stars);
    this.root = scene.add.container(0, 0, parts).setDepth(UNIT_DEPTH);
  }

  update(x: number, y: number, u: Unit, cdFrac: number, dragged: boolean): void {
    this.root.setPosition(x, y);
    if (u.level !== this.level) {
      this.level = u.level;
      this.stars.setText('★' + u.level);
    }
    if (u.rarity !== this.rarity) {
      this.rarity = u.rarity;
      this.frame.setStrokeStyle(3, RARITY_COLOR[u.rarity]);
    }
    this.cd.set(cdFrac);
    const ready = cdFrac >= 1;
    if (ready !== this.ready) {
      this.ready = ready;
      this.cd.fill.setFillStyle(ready ? CD_READY : CD_CHARGING);
    }
    if (dragged !== this.dragged) {
      this.dragged = dragged;
      this.root.setAlpha(dragged ? 0.3 : 1);
    }
  }

  playAttack(): void {
    this.actor?.playOnce(`unit.${this.classId}.attack`, PRIO_ATTACK);
  }

  playSkill(): void {
    this.actor?.playOnce(`unit.${this.classId}.skill`, PRIO_SKILL);
  }

  destroy(): void {
    this.root.destroy();
  }
}

export class EnemyView {
  readonly root: Phaser.GameObjects.Container;
  seen = 0;
  private body: Phaser.GameObjects.Arc;
  private burn: Phaser.GameObjects.Arc;
  private actor: Actor | null;
  private bar: Bar;
  private hpText: Phaser.GameObjects.Text;
  private hp = -1;
  private burning: boolean | null = null;
  private dieTimer: Phaser.Time.TimerEvent | null = null;
  private gone = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly v: VisualRegistry,
    private readonly kind: EnemyKind,
    color: number,
    private readonly tile: number,
  ) {
    const r = (kind === 'boss' ? 0.5 : 0.25) * tile;
    this.body = scene.add.circle(0, 0, r, color);
    const walk: VisualKey = `enemy.${kind}.walk`;
    this.actor = v.has(walk) ? new Actor(scene, v, walk, tile) : null;
    if (this.actor) this.body.setVisible(false);
    this.burn = scene.add.circle(0, 0, r + 1).setStrokeStyle(3, COLORS.burn, 1).setVisible(false);
    const top = this.actor ? Math.min(-r, this.actor.top()) : -r;
    const w = 0.7 * tile;
    const barY = top - 2 - ENEMY_BAR_H;
    this.bar = new Bar(scene, -w / 2, barY, w, ENEMY_BAR_H, ENEMY_BAR_COLOR);
    this.hpText = scene.add
      .text(0, barY - 1, '', { fontFamily: FONT, fontSize: '11px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5, 1);
    const parts: Phaser.GameObjects.GameObject[] = [this.body];
    if (this.actor) parts.push(this.actor.sprite);
    parts.push(this.burn, this.bar.back, this.bar.fill, this.hpText);
    this.root = scene.add.container(0, 0, parts).setDepth(ENEMY_DEPTH);
  }

  update(x: number, y: number, e: Enemy): void {
    this.root.setPosition(x, y);
    const burning = e.burn !== null;
    if (burning !== this.burning) {
      this.burning = burning;
      this.burn.setVisible(burning);
    }
    const hp = hpValue(e.hp);
    if (hp !== this.hp) {
      this.hp = hp;
      this.hpText.setText(formatNum(hp));
    }
    this.bar.set(hpFraction(e.hp, e.maxHp));
  }

  /**
   * Quái chết: có hoạt ảnh `enemy.<loại>.die` thì chạy rồi tự hủy (tối đa DIE_MAX_MS) và gọi `onGone`; trả về true.
   * Không có → false (người gọi hủy ngay, như trước).
   */
  startDying(onGone: () => void): boolean {
    const die: VisualKey = `enemy.${this.kind}.die`;
    if (!this.v.has(die)) return false;
    this.bar.setVisible(false);
    this.hpText.setVisible(false);
    this.burn.setVisible(false);
    if (!this.actor) {
      this.actor = new Actor(this.scene, this.v, null, this.tile);
      this.root.add(this.actor.sprite);
    }
    this.body.setVisible(false);
    const finish = (): void => {
      if (this.gone) return;
      this.destroy();
      onGone();
    };
    this.actor.playFinal(die, finish);
    this.dieTimer = this.scene.time.delayedCall(DIE_MAX_MS, finish);
    return true;
  }

  destroy(): void {
    this.gone = true;
    this.dieTimer?.remove(false);
    this.dieTimer = null;
    this.root.destroy();
  }
}

export class MinionView {
  readonly root: Phaser.GameObjects.Container;
  seen = 0;
  private body: Phaser.GameObjects.Arc;
  private actor: Actor | null;
  private bar: Bar;

  constructor(scene: Phaser.Scene, private readonly v: VisualRegistry, tile: number) {
    const r = tile * 0.14;
    this.body = scene.add.circle(0, 0, r, COLORS.minion);
    this.actor = makeActor(scene, v, 'minion.idle', ['minion.attack'], tile, (shown) => this.body.setVisible(!shown));
    if (this.actor && v.has('minion.idle')) this.body.setVisible(false);
    const top = this.actor && v.has('minion.idle') ? Math.min(-r, this.actor.top()) : -r;
    const w = tile * 0.3;
    this.bar = new Bar(scene, -w / 2, top - 5, w, 3, MINION_BAR_COLOR);
    const parts: Phaser.GameObjects.GameObject[] = [this.body];
    if (this.actor) parts.push(this.actor.sprite);
    parts.push(this.bar.back, this.bar.fill);
    this.root = scene.add.container(0, 0, parts).setDepth(MINION_DEPTH);
  }

  update(x: number, y: number, m: Minion): void {
    this.root.setPosition(x, y);
    this.bar.set(hpFraction(m.hp, m.maxHp));
  }

  playAttack(): void {
    this.actor?.playOnce('minion.attack', PRIO_ATTACK);
  }

  destroy(): void {
    this.root.destroy();
  }
}
