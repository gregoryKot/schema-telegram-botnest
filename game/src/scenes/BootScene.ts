import Phaser from 'phaser';

// Арт «Недели» грузит сама WeekScene (data-URI, без сети), здесь только вход.
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() { this.scene.start('Week'); }
}
