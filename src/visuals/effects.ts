// Đạn, hiệu ứng trúng đích và hiệu ứng skill từng lớp, vẽ theo event của sim (chỉ để nhìn, không đổi luật).
// Có sprite trong manifest thì dùng sprite; không có thì vẽ hình khối. File này không import Phaser lúc chạy
// (chỉ kiểu) để `FxBudget` test được.
import type Phaser from 'phaser';
import type { ClassId, GameEvent, Vec } from '../sim/types';
import { COLORS } from '../ui/theme';
import { applyEntry } from './applyEntry';
import type { VisualRegistry } from './loader';
import type { VisualKey } from './manifest';

export const MAX_PROJECTILES = 60;
export const PROJECTILE_FLIGHT_S = 0.15;
export const SKILL_FX_MAX_S = 0.6;

/** Trên quái (12) và lính (13), dưới con trỏ kéo (30), chữ nổi (50), UI (100+) và popup (450). */
export const FX_DEPTH = 20;

const CRIT_COLOR = parseInt(COLORS.crit.slice(1), 16);
const CRIT_SCALE = 1.5;
const DEFAULT_SPLASH = 0.75;
const DEFAULT_SPRITE_MS = 300;

const FX_COLOR: Record<ClassId | 'minion', number> = {
  swordsman: 0xeceff1,
  archer: 0xc5e1a5,
  mage: 0xff7043,
  summoner: 0xce93d8,
  minion: COLORS.minion,
};

/** Giới hạn số đạn/hiệu ứng đang chạy. Thuần: không phụ thuộc Phaser. */
export class FxBudget {
  private n = 0;
  constructor(private readonly max: number) {}

  tryAcquire(): boolean {
    if (this.n >= this.max) return false;
    this.n++;
    return true;
  }

  release(): void {
    if (this.n > 0) this.n--;
  }

  get active(): number {
    return this.n;
  }

  /** Xin một suất; trả về hàm trả suất chỉ có tác dụng một lần (gọi lại không làm gì), hoặc null nếu hết suất. */
  lease(): (() => void) | null {
    if (!this.tryAcquire()) return null;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.release();
    };
  }
}

type Obj = Phaser.GameObjects.GameObject;
type TweenCfg = Phaser.Types.Tweens.TweenBuilderConfig & { onDone?: () => void };

/**
 * Một hiệu ứng: gom đối tượng và tween; kết thúc đúng một lần khi tween cuối xong
 * (hoặc bị ép dừng) → hủy đối tượng, trả suất.
 */
class Fx {
  private done = false;
  private pending = 0;
  private readonly objs: Obj[] = [];
  private readonly tweens: Phaser.Tweens.Tween[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly release: () => void,
    private readonly onEnd: (fx: Fx) => void,
  ) {}

  add<T extends Obj>(o: T): T {
    this.objs.push(o);
    return o;
  }

  /** Chạy tween; `onDone` có thể thêm tween nối tiếp. Hết mọi tween thì hiệu ứng kết thúc. */
  tween(cfg: TweenCfg): void {
    if (this.done) return;
    const { onDone, ...rest } = cfg;
    this.pending++;
    const t = this.scene.tweens.add({
      ...rest,
      onComplete: () => {
        if (this.done) return;
        onDone?.();
        if (--this.pending <= 0) this.finish();
      },
    });
    this.tweens.push(t);
  }

  finish(): void {
    if (this.done) return;
    this.done = true;
    for (const t of this.tweens) if (!t.isDestroyed()) t.stop();
    for (const o of this.objs) o.destroy();
    this.tweens.length = 0;
    this.objs.length = 0;
    this.release();
    this.onEnd(this);
  }
}

const NOOP = (): void => undefined;
const ms = (s: number): number => Math.round(s * 1000);

type AttackEvent = Extract<GameEvent, { type: 'attack' }>;
type SkillEvent = Extract<GameEvent, { type: 'skill' }>;

const projectileKey = (c: ClassId | 'minion'): VisualKey => `projectile.${c}`;
const impactKey = (c: ClassId | 'minion'): VisualKey => `impact.${c}`;

export class Effects {
  private readonly budget = new FxBudget(MAX_PROJECTILES);
  private readonly live = new Set<Fx>();
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly visuals: VisualRegistry,
    private readonly toScreen: (v: Vec) => { x: number; y: number },
    private readonly tileSize: () => number,
    /** Bán kính nổ lan của đòn thường pháp sư (ô); đọc mỗi lần vì cấu hình đổi theo ván. */
    private readonly splashRadius: () => number = () => DEFAULT_SPLASH,
  ) {}

  /** Số đạn/hiệu ứng đang giữ suất (cho kiểm tra). */
  get active(): number {
    return this.budget.active;
  }

  onEvent(e: GameEvent): void {
    if (this.destroyed) return;
    if (e.type === 'attack') this.attack(e);
    else if (e.type === 'skill') this.skill(e);
  }

  /** Hủy mọi hiệu ứng đang chạy (tween dừng, đối tượng hủy, suất trả lại). */
  destroy(): void {
    this.destroyed = true;
    for (const fx of [...this.live]) fx.finish();
    this.live.clear();
  }

  private newFx(release: (() => void) | null): Fx {
    const fx = new Fx(this.scene, release ?? NOOP, (f) => this.live.delete(f));
    this.live.add(fx);
    return fx;
  }

  // ---- Sprite / hình khối dùng chung ----

  /** Tạo sprite từ manifest (null nếu không có khóa). `repeat`: -1 theo `loop` của mục, 0 chạy một lần. */
  private makeSprite(fx: Fx, key: VisualKey, x: number, y: number, depth: number, once: boolean): Phaser.GameObjects.Sprite | null {
    const v = this.visuals;
    if (!v.has(key)) return null;
    const s = fx.add(this.scene.add.sprite(x, y, v.textureKey(key)).setDepth(depth));
    const entry = v.entry(key);
    applyEntry(s, entry, this.tileSize());
    s.play({ key: v.animKey(key), repeat: once || !entry?.loop ? 0 : -1 });
    return s;
  }

  /** Sprite chạy một lần tại chỗ; hiệu ứng giữ tới hết hoạt ảnh (tối đa `maxS`). Trả về false nếu không có sprite. */
  private spriteFx(fx: Fx, key: VisualKey, x: number, y: number, depth: number, maxS: number): boolean {
    const s = this.makeSprite(fx, key, x, y, depth, true);
    if (!s) return false;
    const dur = Math.min(s.anims.currentAnim?.duration ?? DEFAULT_SPRITE_MS, ms(maxS));
    fx.tween({ targets: s, alpha: { from: 1, to: 1 }, duration: Math.max(1, dur) });
    return true;
  }

  private rect(fx: Fx, x: number, y: number, w: number, h: number, color: number, depth: number): Phaser.GameObjects.Rectangle {
    return fx.add(this.scene.add.rectangle(x, y, w, h, color).setDepth(depth));
  }

  private disc(fx: Fx, x: number, y: number, r: number, color: number, alpha: number, depth: number): Phaser.GameObjects.Arc {
    return fx.add(this.scene.add.circle(x, y, r, color, alpha).setDepth(depth));
  }

  /** Vòng tròn (viền + tô mờ theo `fillAlpha`) nở dần rồi mờ đi. */
  private burst(fx: Fx, x: number, y: number, r: number, color: number, fillAlpha: number, from: number, to: number, durMs: number, depth: number): void {
    const c = fx.add(this.scene.add.circle(x, y, r, color, fillAlpha).setStrokeStyle(3, color, 1).setDepth(depth).setScale(from));
    fx.tween({ targets: c, scale: to, alpha: 0, duration: durMs, ease: 'Quad.easeOut' });
  }

  // ---- Đòn thường ----

  private attack(e: AttackEvent): void {
    const lease = this.budget.lease();
    if (!lease) return; // hết suất: bỏ hiệu ứng, sát thương vẫn tính
    const fx = this.newFx(lease);
    const t = this.tileSize();
    const a = this.toScreen(e.from);
    const b = this.toScreen(e.to);
    const cls = e.classId;
    const land = (): void => this.impact(fx, cls, b.x, b.y, e.crit, t);

    // Kiếm sĩ/lính đánh gần: vệt chém tại mục tiêu, chỉ bay khi có sprite đạn riêng.
    const ranged = cls === 'archer' || cls === 'mage' || cls === 'summoner';
    if (!ranged && !this.visuals.has(projectileKey(cls))) {
      land();
      return;
    }
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const proj = this.projectile(fx, cls, a.x, a.y, ang, e.crit, t);
    fx.tween({
      targets: proj,
      x: b.x,
      y: b.y,
      duration: ms(PROJECTILE_FLIGHT_S),
      onDone: () => {
        proj.destroy();
        land();
      },
    });
  }

  private projectile(fx: Fx, cls: ClassId | 'minion', x: number, y: number, ang: number, crit: boolean, t: number): Phaser.GameObjects.Shape | Phaser.GameObjects.Sprite {
    const key = projectileKey(cls);
    const s = this.makeSprite(fx, key, x, y, FX_DEPTH, false);
    if (s) {
      if (this.visuals.entry(key)?.rotateToTarget) s.setRotation(ang);
      if (crit) s.setScale(s.scaleX * CRIT_SCALE, s.scaleY * CRIT_SCALE);
      return s;
    }
    const color = crit ? CRIT_COLOR : FX_COLOR[cls];
    const k = crit ? CRIT_SCALE : 1;
    if (cls === 'archer') return this.rect(fx, x, y, t * 0.32 * k, 3 * k, color, FX_DEPTH).setRotation(ang);
    return this.disc(fx, x, y, t * (cls === 'mage' ? 0.14 : 0.09) * k, color, 1, FX_DEPTH);
  }

  private impact(fx: Fx, cls: ClassId | 'minion', x: number, y: number, crit: boolean, t: number): void {
    const color = crit ? CRIT_COLOR : FX_COLOR[cls];
    const k = crit ? CRIT_SCALE : 1;
    if (!this.spriteFx(fx, impactKey(cls), x, y, FX_DEPTH + 1, SKILL_FX_MAX_S)) {
      if (cls === 'mage') {
        this.burst(fx, x, y, this.splashRadius() * t, color, 0.3, 0.3, 1, 250, FX_DEPTH + 1);
      } else if (cls === 'swordsman' || cls === 'minion') {
        const small = cls === 'minion' ? 0.5 : 1;
        const slash = this.rect(fx, x, y, t * 0.8 * small * k, (cls === 'minion' ? 3 : 4) * k, color, FX_DEPTH + 1).setRotation(-0.8).setScale(0.2, 1);
        fx.tween({ targets: slash, scaleX: 1, alpha: 0, duration: ms(PROJECTILE_FLIGHT_S), ease: 'Quad.easeOut' });
      } else {
        this.burst(fx, x, y, t * 0.12 * k, color, 0.5, 1, 2.2, 120, FX_DEPTH + 1);
      }
    }
    if (crit && !this.spriteFx(fx, 'impact.crit', x, y, FX_DEPTH + 2, SKILL_FX_MAX_S)) {
      this.burst(fx, x, y, t * 0.35, CRIT_COLOR, 0.6, 0.3, 1.4, 200, FX_DEPTH + 2);
    }
  }

  // ---- Skill ----

  private skill(e: SkillEvent): void {
    const t = this.tileSize();
    const p = this.toScreen(e.pos);
    switch (e.skill) {
      case 'swordsman':
        this.swordsmanSkill(p, (e.range ?? 1.5) * t);
        break;
      case 'archer':
        this.archerSkill(p, (e.hits ?? []).map((h) => this.toScreen(h)), t);
        break;
      case 'mage':
        this.mageSkill(this.toScreen(e.center ?? e.pos), (e.radius ?? 1) * t, t);
        break;
      case 'summoner':
        this.summonerSkill((e.spawns?.length ? e.spawns : [e.pos]).map((s) => this.toScreen(s)), t);
        break;
    }
  }

  private swordsmanSkill(p: { x: number; y: number }, r: number): void {
    const fx = this.newFx(null);
    if (this.spriteFx(fx, 'skill.swordsman', p.x, p.y, FX_DEPTH + 1, SKILL_FX_MAX_S)) return;
    const dur = 450;
    this.burst(fx, p.x, p.y, r, FX_COLOR.swordsman, 0.15, 0.4, 1, dur, FX_DEPTH + 1);
    const blade = this.rect(fx, p.x, p.y, r, 5, 0xffffff, FX_DEPTH + 2).setOrigin(0, 0.5);
    fx.tween({ targets: blade, rotation: Math.PI * 2, alpha: 0.2, duration: dur, ease: 'Sine.easeInOut' });
  }

  private archerSkill(p: { x: number; y: number }, hits: { x: number; y: number }[], t: number): void {
    const flourish = this.newFx(null);
    if (!this.spriteFx(flourish, 'skill.archer', p.x, p.y, FX_DEPTH + 1, SKILL_FX_MAX_S)) flourish.finish();
    const fall = 180;
    hits.forEach((h, i) => {
      const lease = this.budget.lease();
      if (!lease) return;
      const fx = this.newFx(lease);
      const sy = h.y - t * 3;
      const down = Math.PI / 2;
      let arrow: Phaser.GameObjects.Shape | Phaser.GameObjects.Sprite;
      const spr = this.makeSprite(fx, 'skill.archer.arrow', h.x, sy, FX_DEPTH + 1, false);
      if (spr) {
        if (this.visuals.entry('skill.archer.arrow')?.rotateToTarget) spr.setRotation(down);
        arrow = spr;
      } else {
        arrow = this.rect(fx, h.x, sy, 4, t * 0.4, FX_COLOR.archer, FX_DEPTH + 1);
      }
      arrow.setVisible(false);
      fx.tween({
        targets: arrow,
        y: h.y,
        duration: fall,
        delay: Math.min(i * 40, 200),
        ease: 'Quad.easeIn',
        onStart: () => arrow.setVisible(true),
        onDone: () => {
          arrow.destroy();
          this.burst(fx, h.x, h.y, t * 0.18, FX_COLOR.archer, 0.5, 1, 2, 120, FX_DEPTH + 1);
        },
      });
    });
  }

  private mageSkill(c: { x: number; y: number }, r: number, t: number): void {
    const fx = this.newFx(null);
    const fall = 300;
    const sx = c.x + t * 1.5;
    const sy = c.y - t * 3;
    const blast = (): void => {
      if (this.spriteFx(fx, 'skill.mage', c.x, c.y, FX_DEPTH + 1, 0.3)) return;
      this.burst(fx, c.x, c.y, r, FX_COLOR.mage, 0.45, 0.2, 1, 300, FX_DEPTH + 1);
    };
    const meteor: Phaser.GameObjects.Shape | Phaser.GameObjects.Sprite =
      this.makeSprite(fx, 'skill.mage.meteor', sx, sy, FX_DEPTH + 1, false) ?? this.disc(fx, sx, sy, t * 0.22, FX_COLOR.mage, 1, FX_DEPTH + 1);
    fx.tween({
      targets: meteor,
      x: c.x,
      y: c.y,
      duration: fall,
      ease: 'Quad.easeIn',
      onDone: () => {
        meteor.destroy();
        blast();
      },
    });
  }

  private summonerSkill(spawns: { x: number; y: number }[], t: number): void {
    const fx = this.newFx(null);
    for (const s of spawns) {
      if (this.spriteFx(fx, 'skill.summoner', s.x, s.y, FX_DEPTH + 1, SKILL_FX_MAX_S)) continue;
      this.burst(fx, s.x, s.y, t * 0.5, FX_COLOR.summoner, 0.25, 0.3, 1, 450, FX_DEPTH + 1);
    }
    if (spawns.length === 0) fx.finish();
  }
}
