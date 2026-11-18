// Панель ПАУЗЫ: мир замер, вопрос и названия на выбор. Неверное тускнеет и остаётся — выбор продолжается.
import Phaser from 'phaser';
import { W, H } from '../constants';
import { IS_TOUCH } from '../controls';
import { FONT } from './hud';

const ROW_H = 52; // на телефоне кадр идёт 1:1 и мельче — с запасом над 44

export class PausePanel {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private rows: Phaser.GameObjects.Text[] = [];
  constructor(private scene: Phaser.Scene, private question: string, private options: string[],
    private onPick: (i: number) => void) {}

  get shown() { return this.objs.length > 0; }

  show() {
    if (this.shown) return;
    const s = this.scene, top = H * 0.2;
    const fixed = (o: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text) => { o.setScrollFactor(0).setDepth(50); this.objs.push(o); return o; };
    fixed(s.add.rectangle(W / 2, H / 2, W, H, 0x101018, 0.72));
    fixed(s.add.text(W / 2, top, this.question, { fontFamily: FONT, fontSize: '12px', color: '#f0f0f4' }).setOrigin(0.5));
    this.rows = this.options.map((text, i) => {
      const label = IS_TOUCH ? text : `${i + 1}  ${text}`;
      const row = s.add.text(W / 2, top + 30 + i * (ROW_H + 8), label, {
        fontFamily: FONT, fontSize: '10px', color: '#f0f0f4', backgroundColor: '#3a3a46', align: 'center',
        fixedWidth: W - 80, fixedHeight: ROW_H, padding: { y: (ROW_H - 10) / 2 },
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      row.on('pointerdown', () => this.onPick(i));
      fixed(row);
      return row;
    });
  }

  markWrong(i: number) { this.rows[i]?.setAlpha(0.35); }

  hide() {
    for (const o of this.objs) o.destroy();
    this.objs = []; this.rows = [];
  }
}
