// Ввод «Недели»: один палец. Саша бежит сам — касание кадра, кнопка или клавиша дают прыжок,
// остальное — кнопки действий и удержание ПАУЗЫ.
import Phaser from 'phaser';
import { touch } from '../controls';
import { weekTouch } from './touch';
import type { Act } from './monday';

type Key = Phaser.Input.Keyboard.Key;
const just = Phaser.Input.Keyboard.JustDown;
export const ACT_KEYS: Record<Act, string> = { overwork: 'Z', scroll: 'X', agree: 'C', pause: 'V' };

export class WeekInput {
  private k: Record<string, Key>;
  private tapped = false;
  constructor(scene: Phaser.Scene) {
    this.k = scene.input.keyboard!.addKeys('UP,W,SPACE,Z,X,C,V,ONE,TWO,THREE') as Record<string, Key>;
    scene.input.on('pointerdown', () => { this.tapped = true; });
    touch.drain();
  }
  /** Забыть касания до этого кадра: выбор в панели ПАУЗЫ не должен стать прыжком. */
  drain() { this.tapped = false; touch.drain(); }
  jump(): boolean {
    const keys = [this.k.UP, this.k.W, this.k.SPACE].map(k => just(k)); // прочитать все: нажатие не копится
    const tap = this.tapped;
    this.tapped = false;
    return touch.consume('jump') || tap || keys.some(Boolean);
  }
  /** Привычка, нажатая в этом кадре. */
  act(): Act | null {
    const z = just(this.k.Z), x = just(this.k.X), c = just(this.k.C);
    const hit = touch.consume('hit'), avoid = touch.consume('avoid'), fawn = touch.consume('fawn');
    if (z || hit) return 'overwork';
    if (x || avoid) return 'scroll';
    if (c || fawn) return 'agree';
    return null;
  }
  get pauseHeld(): boolean { return weekTouch.pauseHeld || this.k.V.isDown; }
  /** Название, выбранное цифрой (тапом выбирает сама панель). */
  choice(): number | null {
    const picks = [this.k.ONE, this.k.TWO, this.k.THREE].map(k => just(k));
    const i = picks.indexOf(true);
    return i < 0 ? null : i;
  }
}
