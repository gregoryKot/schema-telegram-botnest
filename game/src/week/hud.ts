// HUD «Недели»: полоска сил, часы, серость мира, реплики. Правил и подсказок-карточек нет — цену показывает мир.
import Phaser from 'phaser';
import { W, H } from '../constants';
import { IS_TOUCH } from '../controls';
import { clockText, isResting, type WeekState } from './habits';

export const FONT = '"Press Start 2P", "Courier New", monospace';
const BAR_W = 120;
type Text = Phaser.GameObjects.Text;

export class WeekHud {
  private bar: Phaser.GameObjects.Rectangle;
  private clock: Text;
  private grey: Phaser.GameObjects.Rectangle;
  private dark: Phaser.GameObjects.Rectangle;
  private hold: Phaser.GameObjects.Rectangle;
  private keys: Text;
  private thought: Text | null = null;
  private ended = false;

  constructor(private scene: Phaser.Scene) {
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T, d: number) =>
      o.setScrollFactor(0).setDepth(d);
    this.grey = fixed(scene.add.rectangle(W / 2, H / 2, W, H, 0x80808a, 0), 30);
    this.dark = fixed(scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0), 31);
    fixed(scene.add.rectangle(16, 16, BAR_W + 4, 14, 0x1c1c22).setOrigin(0, 0), 40);
    this.bar = fixed(scene.add.rectangle(18, 18, BAR_W, 10, 0xd8d8e0).setOrigin(0, 0), 41);
    this.clock = fixed(scene.add.text(W / 2, 14, '', { fontFamily: FONT, fontSize: '14px', color: '#f0f0f4' }).setOrigin(0.5, 0), 41);
    this.hold = scene.add.rectangle(0, 0, 0, 5, 0xf0f0f4).setOrigin(0, 0.5).setDepth(41);
    this.keys = fixed(scene.add.text(16, H - 22, '', { fontFamily: FONT, fontSize: '9px', color: '#b8b8c4' }), 41);
  }

  /** hold — доля удержания ПАУЗЫ (0..1): полоска над Сашей. */
  update(st: WeekState, hold: number, px: number, py: number) {
    this.bar.width = BAR_W * st.energy / 100;
    this.clock.setText(clockText(st.clockMin));
    this.grey.setAlpha((1 - st.color) * 0.6);
    const dark = isResting(st) ? 0.55 : 0;
    if (!this.ended) this.dark.setAlpha(this.dark.alpha + (dark - this.dark.alpha) * 0.12);
    this.hold.setPosition(px - 20, py - 14).setSize(40 * hold, 5);
    if (this.thought?.active) this.thought.setPosition(px, py - 22);
  }

  private bubble(text: string, x: number, y: number, ms: number): Text {
    const b = this.scene.add.text(x, y, text, {
      fontFamily: FONT, fontSize: '10px', color: '#f0f0f4', backgroundColor: '#1c1c22',
      padding: { x: 8, y: 6 }, align: 'center', wordWrap: { width: W * 0.6 },
    }).setOrigin(0.5, 1).setDepth(42);
    const view = this.scene.cameras.main.worldView, half = b.width / 2 + 8; // у края кадра пузырь сдвигается, а не режется
    b.setX(Phaser.Math.Clamp(x, view.x + half, view.right - half));
    this.scene.time.delayedCall(ms, () => b.destroy());
    return b;
  }
  /** Строка внутри мира — над точкой (сообщение, реплика). */
  say(text: string, x: number, y: number, ms = 3400) { this.bubble(text, x, y, ms); }
  /** Мысль Саши — идёт вместе с ним. */
  think(text: string, ms = 3400) {
    this.thought?.destroy();
    this.thought = this.bubble(text, 0, 0, ms);
  }

  title(text: string) {
    const tx = this.scene.add.text(W / 2, H * 0.3, text, { fontFamily: FONT, fontSize: '16px', color: '#f0f0f4' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(42);
    this.scene.tweens.add({ targets: tx, alpha: 0, delay: 2200, duration: 800, onComplete: () => tx.destroy() });
  }
  /** Конец главы: экран темнеет, остаётся одна строка. */
  end(text: string) {
    this.ended = true;
    this.scene.tweens.add({ targets: this.dark, alpha: 0.85, duration: 900 });
    this.scene.add.text(W / 2, H / 2, text, { fontFamily: FONT, fontSize: '12px', color: '#f0f0f4' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(43);
  }
  /** Клавиши открытых действий — только с клавиатурой; на телефоне это сами кнопки. */
  keysHint(line: string) { if (!IS_TOUCH) this.keys.setText(line); }
}
