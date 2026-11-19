// Панель ПАУЗЫ: мир замер, вопрос и названия на выбор. Неверное тускнеет и остаётся — выбор продолжается.
import Phaser from 'phaser';
import { W, H } from '../constants';
import { IS_TOUCH } from '../controls';
import { C, FONT, SKIN, button, hex, px } from './ui';

const ROW_H = px(52), GAP = px(8); // строка выше 44: в неё попадают пальцем

export class PausePanel {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private rows: Phaser.GameObjects.Container[] = [];
  constructor(private scene: Phaser.Scene, private kicker: string, private question: string, private options: string[],
    private onPick: (i: number) => void) {}

  get shown() { return this.objs.length > 0; }

  show() {
    if (this.shown) return;
    const s = this.scene, n = this.options.length, top = (H - (px(58) + n * ROW_H + (n - 1) * GAP)) / 2;
    const keep = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T) => {
      o.setScrollFactor(0).setDepth(50); this.objs.push(o); return o;
    };
    const text = (y: number, str: string, size: number, color: number) =>
      keep(s.add.text(W / 2, y, str, { fontFamily: FONT, fontSize: `${px(size)}px`, fontStyle: '700', color: hex(color) }).setOrigin(0.5));
    keep(s.add.rectangle(W / 2, H / 2, W, H, C.deep, 0.86));
    text(top + px(8), this.kicker, 15, C.haze).setLetterSpacing(px(4));
    text(top + px(32), this.question, 26, C.paper);
    this.rows = this.options.map((label, i) => keep(button(s, W / 2, top + px(58) + ROW_H / 2 + i * (ROW_H + GAP), W - px(120), ROW_H,
      IS_TOUCH ? label : `${i + 1}   ${label}`, SKIN.night, () => this.onPick(i), 19)));
  }

  /** Неверное название: строка вздрагивает и гаснет — оно не подошло, выбор остаётся. */
  markWrong(i: number) {
    const row = this.rows[i];
    if (!row || row.alpha < 1) return;
    row.setAlpha(0.4);
    this.scene.tweens.add({ targets: row, x: row.x + px(6), duration: 50, yoyo: true, repeat: 2 });
  }

  hide() {
    for (const o of this.objs) o.destroy();
    this.objs = []; this.rows = [];
  }
}
