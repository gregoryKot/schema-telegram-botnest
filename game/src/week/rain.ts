// Строки сбоя сыплются сверху кадра (уведомления хука, мамины слова «Среды»): живут в кадре, чтобы читаться на бегу;
// в ПАУЗЕ повисают вместе с миром, название сбоя их гасит.
import Phaser from 'phaser';
import { W, GROUND_Y } from '../constants';
import { t, type MsgKey } from '../i18n';
import type { WeekHud } from './hud';

export class WordRain {
  keys: MsgKey[] = [];
  private boxes: Phaser.GameObjects.Container[] = [];
  private acc = 0; private n = 0;
  constructor(private s: Phaser.Scene, private hud: WeekHud) {}

  /** glitch — сколько сбоя сейчас: чем сильнее, тем чаще строки. */
  step(dt: number, glitch: number) {
    if (glitch < 0.2 || !this.keys.length) return;
    this.acc += dt * glitch;
    if (this.acc < 700) return;
    this.acc = 0;
    const key = this.keys[this.n++ % this.keys.length];
    const b = this.hud.notif(t(key), Phaser.Math.Between(W * 0.2, W * 0.8), this.n).box;
    this.boxes.push(b);
    this.s.tweens.add({ targets: b, y: GROUND_Y - 16, duration: 3400, onComplete: () => {
      this.boxes = this.boxes.filter(o => o !== b); b.destroy();
    } });
  }
  clear() { for (const b of this.boxes) b.destroy(); this.boxes = []; }
}
