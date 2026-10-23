import Phaser from 'phaser';
import { applyCard, discardCard } from '../sim/commands';
import type { Card, CommandResult, GameState } from '../sim/types';
import { Button } from './BottomBar';
import { LAYOUT } from './layout';
import { cardLabel, COLORS, RARITY_COLOR, RARITY_NAME, textStyle } from './theme';

const H = LAYOUT.hand;
const CARD_W = H.cardW;
const CARD_H = H.cardH;
const MAX_CARDS = H.maxCards;
const DRAG_THRESHOLD = 8;

interface Slot {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  rarity: Phaser.GameObjects.Text;
  cardId: number | null;
}

export class Hand {
  selectedId: number | null = null;
  private slots: Slot[] = [];
  private discardBtn: Button;
  private press: { cardId: number; x: number; y: number; moving: boolean } | null = null;
  private ghost: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text } | null = null;
  private flashUntil = new Map<number, number>();

  constructor(
    private scene: Phaser.Scene,
    private getState: () => GameState,
    private act: (r: CommandResult) => void,
    private slotAt: (x: number, y: number) => number,
  ) {
    for (let i = 0; i < MAX_CARDS; i++) {
      const { x, y: Y } = H.cards[i].rect;
      const bg = scene.add.rectangle(x, Y, CARD_W, CARD_H, 0x252a3a).setOrigin(0).setDepth(110).setStrokeStyle(4, 0x9e9e9e)
        .setInteractive({ useHandCursor: true });
      const label = scene.add
        .text(x + CARD_W / 2, Y + H.labelDy, '', textStyle({
          size: 22, color: COLORS.text, bold: true, align: 'center', wrap: CARD_W - 16, extra: { lineSpacing: -4 },
        }))
        .setOrigin(0.5).setDepth(111);
      const rarity = scene.add.text(x + 8, Y + H.rarityDy, '', textStyle({ size: 22, color: COLORS.muted })).setDepth(111);
      const slot: Slot = { bg, label, rarity, cardId: null };
      bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (slot.cardId !== null) this.press = { cardId: slot.cardId, x: p.x, y: p.y, moving: false };
      });
      this.slots.push(slot);
    }
    // Nút bỏ thẻ cố định bên phải hàng thẻ (không đè chữ của thẻ đang chọn).
    this.discardBtn = Button.at(scene, H.discard, 'Bỏ thẻ', () => {
      if (this.selectedId !== null) {
        this.act(discardCard(this.getState(), this.selectedId));
        this.selectedId = null;
      }
    }, { depth: 130, fill: 0x7a2e2e, fontSize: 22 });
    this.discardBtn.setVisible(false);

    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    scene.input.on('pointerupoutside', () => this.cancelPress());
  }

  /** Hand đang giữ con trỏ (kéo thẻ). */
  get busy(): boolean {
    return this.press !== null;
  }

  flash(cardId: number): void {
    this.flashUntil.set(cardId, this.scene.time.now + 900);
  }

  reset(): void {
    this.selectedId = null;
    this.press = null;
    this.clearGhost();
    this.flashUntil.clear();
  }

  /** Áp thẻ lên nhân vật ở ô slot; trả về ok. */
  applyTo(cardId: number, slot: number): boolean {
    const r = applyCard(this.getState(), cardId, slot);
    this.act(r);
    if (r.ok) this.selectedId = null;
    return r.ok;
  }

  private clearGhost(): void {
    this.ghost?.bg.destroy();
    this.ghost?.label.destroy();
    this.ghost = null;
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const pr = this.press;
    if (!pr) return;
    if (!pr.moving && Math.hypot(p.x - pr.x, p.y - pr.y) >= DRAG_THRESHOLD) {
      pr.moving = true;
      const card = this.getState().hand.find((c) => c.id === pr.cardId);
      if (!card) return;
      const bg = this.scene.add.rectangle(p.x, p.y, CARD_W, CARD_H, 0x252a3a, 0.9).setDepth(250).setStrokeStyle(4, RARITY_COLOR[card.rarity]);
      const label = this.scene.add
        .text(p.x, p.y, cardLabel(card.stat, this.getState().config.cards.values[card.stat][card.rarity]), textStyle({
          size: 22, color: COLORS.text, bold: true, align: 'center', wrap: CARD_W - 16, extra: { lineSpacing: -4 },
        }))
        .setOrigin(0.5).setDepth(251);
      this.ghost = { bg, label };
    }
    if (pr.moving && this.ghost) {
      this.ghost.bg.setPosition(p.x, p.y);
      this.ghost.label.setPosition(p.x, p.y);
    }
  }

  /** Thả ngoài canvas: kết thúc nhấn/kéo, không thả vào đâu. */
  private cancelPress(): void {
    this.press = null;
    this.clearGhost();
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const pr = this.press;
    this.press = null;
    if (!pr) return;
    this.clearGhost();
    if (!pr.moving) {
      this.selectedId = this.selectedId === pr.cardId ? null : pr.cardId;
      return;
    }
    const slot = this.slotAt(p.x, p.y);
    if (slot >= 0 && this.getState().slots[slot] !== null) this.applyTo(pr.cardId, slot);
  }

  update(s: GameState): void {
    const now = this.scene.time.now;
    if (this.selectedId !== null && !s.hand.some((c) => c.id === this.selectedId)) this.selectedId = null;
    for (let i = 0; i < MAX_CARDS; i++) {
      const sl = this.slots[i];
      const card: Card | undefined = s.hand[i];
      const show = card !== undefined;
      sl.cardId = card ? card.id : null;
      sl.bg.setVisible(show);
      sl.label.setVisible(show);
      sl.rarity.setVisible(show);
      if (!card) continue;
      const selected = card.id === this.selectedId;
      const lift = selected ? H.lift : 0;
      const { x, y: Y } = H.cards[i].rect;
      const flashing = (this.flashUntil.get(card.id) ?? 0) > now;
      const blink = flashing ? 0.5 + 0.5 * Math.sin(now / 60) : 0;
      sl.bg.setPosition(x, Y - lift);
      sl.bg.setFillStyle(flashing ? 0x6a6a3a : selected ? 0x363d57 : 0x252a3a, 1);
      sl.bg.setStrokeStyle(selected || flashing ? 6 : 4, flashing && blink > 0.5 ? COLORS.highlight : RARITY_COLOR[card.rarity]);
      sl.label.setPosition(x + CARD_W / 2, Y + H.labelDy - lift)
        .setText(cardLabel(card.stat, s.config.cards.values[card.stat][card.rarity]));
      sl.rarity.setPosition(x + 8, Y + H.rarityDy - lift).setText(RARITY_NAME[card.rarity]).setColor('#' + RARITY_COLOR[card.rarity].toString(16).padStart(6, '0'));
    }
    this.discardBtn.setVisible(this.selectedId !== null);
  }
}
