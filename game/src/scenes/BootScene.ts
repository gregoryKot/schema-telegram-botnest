import Phaser from 'phaser';
import { chapterFromHash } from '../week/chapters';

// Арт «Недели» грузит сама WeekScene (data-URI, без сети), здесь только вход: скрытый хеш (#wed) открывает главу сразу.
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() { this.scene.start('Week', { ch: chapterFromHash(window.location.hash).id }); }
}
