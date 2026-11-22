// HUD «Недели»: полоска сил, часы, серость мира, реплики. Правил и подсказок-карточек нет — цену показывает мир.
import Phaser from 'phaser';
import { W, H } from '../constants';
import { IS_TOUCH } from '../controls';
import { clockText, isResting, type WeekState } from './habits';
import { C, FONT, SKIN, hex, label, plate, px, type Label, type Skin, type Tail } from './ui';

const SEGS = 10, SEG_W = px(8), SEG_GAP = px(2), BAR_X = px(34), BAR_Y = px(12), BAR_H = px(16);
const HOLD_W = px(48);
type Text = Phaser.GameObjects.Text;
type Box = Phaser.GameObjects.Container;
export type BubbleKind = 'say' | 'think' | 'msg';
const BUBBLE: Record<BubbleKind, { skin: Skin; tail: Tail; dot?: number }> = {
  say: { skin: SKIN.paper, tail: 'say' }, think: { skin: SKIN.paper, tail: 'think' },
  msg: { skin: SKIN.night, tail: 'say', dot: C.acid },
};

export class WeekHud {
  private bar: Phaser.GameObjects.Graphics;
  private frame: Phaser.GameObjects.Graphics;
  private clock: Text;
  private grey: Phaser.GameObjects.Rectangle;
  private dark: Phaser.GameObjects.Rectangle;
  private hold: Phaser.GameObjects.Graphics;
  private keys: Text;
  private thought: Box | null = null;
  private shownSegs = -1; private shownMin = -1; private ended = false;

  constructor(private scene: Phaser.Scene) {
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T, d: number) =>
      o.setScrollFactor(0).setDepth(d);
    this.grey = fixed(scene.add.rectangle(W / 2, H / 2, W, H, 0x80808a), 30).setAlpha(0);
    this.dark = fixed(scene.add.rectangle(W / 2, H / 2, W, H, C.deep), 31).setAlpha(0);
    const frame = this.frame = fixed(scene.add.graphics(), 40), u = px(2);
    plate(frame, px(10), BAR_Y, BAR_X - px(10) + SEGS * (SEG_W + SEG_GAP) + px(8), BAR_H, SKIN.night);
    // молния — знак сил: тем же горчичным, что рюкзак Саши
    frame.fillStyle(C.sun).fillRect(px(20), BAR_Y + 2 * u, 2 * u, 2 * u).fillRect(px(18), BAR_Y + 3 * u, 4 * u, u)
      .fillRect(px(18), BAR_Y + 4 * u, 2 * u, 2 * u);
    this.bar = fixed(scene.add.graphics(), 41);
    plate(frame, W / 2 - px(34), BAR_Y - px(2), px(68), px(20), SKIN.night);
    this.clock = fixed(scene.add.text(W / 2, BAR_Y + px(7), '', { fontFamily: FONT, fontSize: `${px(18)}px`, fontStyle: '700', color: hex(C.paper) })
      .setOrigin(0.5), 41);
    this.hold = scene.add.graphics().setDepth(41);
    this.keys = fixed(scene.add.text(px(12), H - px(22), '', { fontFamily: FONT, fontSize: `${px(15)}px`, color: hex(C.paper),
      stroke: hex(C.ink), strokeThickness: px(3) }), 41);
  }

  /** hold — доля удержания ПАУЗЫ (0..1): полоска над Сашей. */
  update(st: WeekState, hold: number, px0: number, py: number) {
    const segs = Math.ceil(st.energy / (100 / SEGS));
    if (segs !== this.shownSegs) {
      this.shownSegs = segs;
      this.bar.clear().fillStyle(segs <= 3 ? C.acid : C.sun);
      for (let i = 0; i < segs; i++) this.bar.fillRect(BAR_X + i * (SEG_W + SEG_GAP), BAR_Y + px(4), SEG_W, BAR_H - px(10));
    }
    if (st.clockMin !== this.shownMin) {
      // скачок часов (ушли в телефон) виден: цифры вспыхивают кислотным
      if (this.shownMin >= 0 && st.clockMin - this.shownMin > 20) {
        this.clock.setColor(hex(C.acid)).setScale(1.3);
        this.scene.tweens.add({ targets: this.clock, scale: 1, duration: 500, onComplete: () => this.clock.setColor(hex(C.paper)) });
      }
      this.shownMin = st.clockMin;
      this.clock.setText(clockText(st.clockMin));
    }
    this.grey.setAlpha((1 - st.color) * 0.6);
    const dark = isResting(st) ? 0.4 : 0;
    if (!this.ended) this.dark.setAlpha(this.dark.alpha + (dark - this.dark.alpha) * 0.12);
    this.hold.clear();
    if (hold > 0.01) {
      plate(this.hold, px0 - HOLD_W / 2, py - px(16), HOLD_W, px(10), SKIN.night);
      this.hold.fillStyle(C.paper).fillRect(px0 - HOLD_W / 2 + px(4), py - px(13), (HOLD_W - px(8)) * hold, px(4));
    }
    if (this.thought?.active) this.thought.setPosition(this.clampX(px0, this.thought.getData('w') as number), Math.max(py - px(8), (this.thought.getData('h') as number) + px(4))); // в прыжке пузырь не уходит за верх кадра
  }

  private clampX(x: number, w: number) {
    const view = this.scene.cameras.main.worldView, half = w / 2 + px(6); // у края кадра пузырь сдвигается, а не режется
    return Phaser.Math.Clamp(x, view.x + half, view.right - half);
  }
  private bubble(text: string, kind: BubbleKind, x: number, y: number, ms: number): Box {
    const { skin, tail, dot } = BUBBLE[kind];
    const b = label(this.scene, text, skin, { tail, dot, maxW: 280, bold: kind === 'msg' });
    b.box.setData('w', b.w).setData('h', b.h).setDepth(42).setPosition(this.clampX(x, b.w), y).setScale(0.6).setAlpha(0);
    this.scene.tweens.add({ targets: b.box, scale: 1, alpha: 1, duration: 140, ease: 'Back.Out' });
    this.scene.time.delayedCall(ms, () => b.box.destroy());
    return b.box;
  }
  /** Строка внутри мира — над точкой (сообщение, реплика). */
  say(text: string, x: number, y: number, ms = 3400, kind: BubbleKind = 'say') { this.bubble(text, kind, x, y, ms); }
  /** Мысль Саши — идёт вместе с ним. */
  think(text: string, ms = 3400) {
    this.thought?.destroy();
    this.thought = this.bubble(text, 'think', 0, 0, ms);
  }
  /** Мысль обрывается: сбой назван. */
  hush() { this.thought?.destroy(); }
  /** Уведомление сбоя: падает сверху кадра; через одно — белое, как в стене уведомлений. */
  notif(text: string, x: number, n: number): Label {
    const b = label(this.scene, text, n % 3 === 2 ? SKIN.paper : SKIN.acid, { tail: 'say', size: 16, bold: true });
    b.box.setScrollFactor(0).setDepth(8).setPosition(x, -px(4));
    return b;
  }

  /** Конец главы: мир уходит в тёмный индиго — поверх встаёт карточка. */
  end(onDark: () => void) {
    this.ended = true;
    for (const o of [this.frame, this.bar, this.clock, this.keys]) o.setVisible(false);
    this.scene.tweens.add({ targets: this.dark, alpha: 0.94, duration: 900, onComplete: onDark });
  }
  /** Клавиши открытых действий — только с клавиатурой; на телефоне это сами кнопки. */
  keysHint(line: string) { if (!IS_TOUCH) this.keys.setText(line); }
}
