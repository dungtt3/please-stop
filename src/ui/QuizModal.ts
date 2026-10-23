import Phaser from 'phaser';
import { answerQuiz, closeQuiz, quizReward } from '../sim/quiz';
import type { CommandResult, GameState } from '../sim/types';
import { Button } from './BottomBar';
import { LAYOUT } from './layout';
import { COLORS, GAME_H, GAME_W, textStyle } from './theme';

const { x: PX, y: PY, w: PW, h: PH } = LAYOUT.quiz.box;
const CLOSE_DELAY = 1200;

export class QuizModal {
  private shade: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private question: Phaser.GameObjects.Text;
  private result: Phaser.GameObjects.Text;
  private barBack: Phaser.GameObjects.Rectangle;
  private bar: Phaser.GameObjects.Rectangle;
  private buttons: Button[] = [];
  private visible = false;
  private closeAt: number | null = null;

  constructor(private scene: Phaser.Scene, private getState: () => GameState, act: (r: CommandResult) => void) {
    this.shade = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.45).setOrigin(0).setDepth(400).setInteractive();
    this.panel = scene.add.rectangle(PX, PY, PW, PH, COLORS.bar).setOrigin(0).setDepth(401).setStrokeStyle(4, 0x5b6585);
    this.question = scene.add
      .text(GAME_W / 2, PY + 70, '', textStyle({ size: 64, bold: true, color: COLORS.text }))
      .setOrigin(0.5).setDepth(402);
    this.barBack = scene.add.rectangle(PX + 30, PY + 125, PW - 60, 16, 0x000000, 0.6).setOrigin(0).setDepth(402);
    this.bar = scene.add.rectangle(PX + 30, PY + 125, PW - 60, 16, 0x42a5f5).setOrigin(0).setDepth(403);
    for (let i = 0; i < 4; i++) {
      this.buttons.push(
        Button.at(scene, LAYOUT.quiz.answers[i], '', () => act(answerQuiz(this.getState(), i)), { depth: 402, fontSize: 40 }),
      );
    }
    this.result = scene.add
      .text(GAME_W / 2, PY + PH - 26, '', textStyle({ size: 26, bold: true, color: COLORS.text }))
      .setOrigin(0.5).setDepth(402);
    this.setVisible(false);
  }

  private setVisible(v: boolean): void {
    this.visible = v;
    for (const o of [this.shade, this.panel, this.question, this.result, this.barBack, this.bar]) o.setVisible(v);
    for (const b of this.buttons) b.setVisible(v);
  }

  get open(): boolean {
    return this.visible;
  }

  update(s: GameState): void {
    const q = s.quiz;
    if (!q) {
      if (this.visible) this.setVisible(false);
      this.closeAt = null;
      return;
    }
    if (!this.visible) this.setVisible(true);
    const limit = s.config.quiz.timeLimit;
    this.question.setText(q.question.text);
    this.bar.setSize((PW - 60) * Math.max(0, 1 - q.elapsed / limit), 16);
    this.bar.setFillStyle(q.elapsed / limit > 0.7 ? 0xe53935 : 0x42a5f5);
    q.question.options.forEach((o, i) => {
      const b = this.buttons[i];
      b.setText(String(o));
      let fill = 0x2f3650;
      if (q.result !== null && o === q.question.answer) fill = 0x2e7d32;
      b.bg.setFillStyle(fill);
      b.setDim(q.result !== null && o !== q.question.answer);
    });
    if (q.result === null) {
      this.result.setText('');
      return;
    }
    if (q.result === 'correct') {
      const r = quizReward(s.config, s.wave, q.elapsed);
      this.result.setText(`Đúng! +${r.gold} vàng${r.minRarity ? ' + thẻ Hiếm trở lên' : ' + 1 thẻ'}`).setColor('#81c784');
    } else if (q.result === 'wrong') {
      this.result.setText(`Sai! Đáp án: ${q.question.answer}`).setColor('#ef9a9a');
    } else {
      this.result.setText(`Hết giờ! Đáp án: ${q.question.answer}`).setColor('#ef9a9a');
    }
    const now = this.scene.time.now;
    if (this.closeAt === null) this.closeAt = now + CLOSE_DELAY;
    else if (now >= this.closeAt) {
      closeQuiz(s);
      this.closeAt = null;
    }
  }
}
