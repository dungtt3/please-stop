// Giữ một view cho mỗi nhân vật / quái / lính theo id: tạo khi xuất hiện, cập nhật mỗi khung, hủy khi biến mất.
import type Phaser from 'phaser';
import { unitPos } from '../sim/combat';
import { enemyPos } from '../sim/enemies';
import { activeCooldown } from '../sim/skills';
import type { GameEvent, GameState, Vec } from '../sim/types';
import type { VisualRegistry } from './loader';
import { cooldownFraction } from './viewMath';
import { EnemyView, MinionView, UnitView } from './views';

interface Seen {
  seen: number;
  destroy(): void;
}

/** Hủy view không được đánh dấu ở lần sync này. */
function sweep<V extends Seen>(map: Map<number, V>, stamp: number): void {
  for (const [id, v] of map) {
    if (v.seen !== stamp) {
      v.destroy();
      map.delete(id);
    }
  }
}

export class BoardViews {
  private units = new Map<number, UnitView>();
  private enemies = new Map<number, EnemyView>();
  private minions = new Map<number, MinionView>();
  /** Quái đang chạy hoạt ảnh chết (tự hủy khi xong). */
  private dying = new Set<EnemyView>();
  private stamp = 0;
  private tile = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly visuals: VisualRegistry,
    private readonly toScreen: (v: Vec) => { x: number; y: number },
    private readonly tileSize: () => number,
  ) {}

  sync(state: GameState, opts: { draggingUnitId: number | null }): void {
    const t = this.tileSize();
    if (t !== this.tile) {
      // Kích thước ô đổi: dựng lại mọi view theo kích thước mới.
      this.clear();
      this.tile = t;
    }
    const stamp = ++this.stamp;
    const cfg = state.config;

    for (const u of state.units.values()) {
      let v = this.units.get(u.id);
      if (!v) {
        v = new UnitView(this.scene, this.visuals, u.classId, cfg.classes[u.classId].color, t);
        this.units.set(u.id, v);
      }
      v.seen = stamp;
      const c = this.toScreen(unitPos(state, u));
      v.update(c.x, c.y, u, cooldownFraction(u.skillCooldown, activeCooldown(cfg, u.classId, u.level)), opts.draggingUnitId === u.id);
    }
    sweep(this.units, stamp);

    for (const e of state.enemies) {
      if (e.dead) continue;
      let v = this.enemies.get(e.id);
      if (!v) {
        v = new EnemyView(this.scene, this.visuals, e.kind, cfg.enemies[e.kind].color, t);
        this.enemies.set(e.id, v);
      }
      v.seen = stamp;
      const c = this.toScreen(enemyPos(state, e));
      v.update(c.x, c.y, e);
    }
    sweep(this.enemies, stamp);

    for (const m of state.minions) {
      let v = this.minions.get(m.id);
      if (!v) {
        v = new MinionView(this.scene, this.visuals, t);
        this.minions.set(m.id, v);
      }
      v.seen = stamp;
      const c = this.toScreen(m.pos);
      v.update(c.x, c.y, m);
    }
    sweep(this.minions, stamp);
  }

  /** Gọi trước `sync` cùng khung để quái vừa chết còn view mà chạy hoạt ảnh chết. */
  onEvent(e: GameEvent): void {
    switch (e.type) {
      case 'attack':
        if (e.source === 'unit') this.units.get(e.id)?.playAttack();
        else this.minions.get(e.id)?.playAttack();
        break;
      case 'skill':
        this.units.get(e.unitId)?.playSkill();
        break;
      case 'kill': {
        const v = this.enemies.get(e.enemyId);
        if (!v) break;
        this.enemies.delete(e.enemyId);
        if (v.startDying(() => this.dying.delete(v))) this.dying.add(v);
        else v.destroy();
        break;
      }
      default:
        break;
    }
  }

  private clear(): void {
    for (const v of this.units.values()) v.destroy();
    for (const v of this.enemies.values()) v.destroy();
    for (const v of this.minions.values()) v.destroy();
    for (const v of this.dying) v.destroy();
    this.units.clear();
    this.enemies.clear();
    this.minions.clear();
    this.dying.clear();
  }

  destroy(): void {
    this.clear();
  }
}
