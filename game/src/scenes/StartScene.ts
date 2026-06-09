import Phaser from 'phaser';
import { W, H } from '../constants';

export class StartScene extends Phaser.Scene {
  constructor() { super('Start'); }

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x1a0800);

    this.add.text(W / 2, 90, 'RUN THROUGH', {
      fontFamily: 'Courier New', fontSize: '34px', color: '#fff0d8',
      fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5);
    this.add.text(W / 2, 130, 'YOUR MIND', {
      fontFamily: 'Courier New', fontSize: '34px', color: '#ff7733',
      fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5);

    // Анимация котика для превью
    this.anims.create({
      key: 's-cat-idle',
      frames: this.anims.generateFrameNumbers('cat_idle', { start: 0, end: 11 }),
      frameRate: 10, repeat: -1,
    });

    const cat = this.add.sprite(W / 2, H / 2 + 20, 'cat_idle').setScale(4).play('s-cat-idle');

    // Кнопка запуска
    const btn = this.add.rectangle(W / 2, H / 2 + 130, 200, 48, 0x3a1500)
      .setStrokeStyle(2, 0xa08fff)
      .setInteractive({ useHandCursor: true });
    const btnTxt = this.add.text(W / 2, H / 2 + 130, 'Н А Ч А Т Ь', {
      fontFamily: 'Courier New', fontSize: '16px', color: '#ff7733', letterSpacing: 4,
    }).setOrigin(0.5);

    btn.on('pointerover', () => {
      btn.fillColor = 0xcc5522;
      btnTxt.setColor('#fff0d8');
      cat.setScale(4.3);
    });
    btn.on('pointerout', () => {
      btn.fillColor = 0x3a1500;
      btnTxt.setColor('#ff7733');
      cat.setScale(4);
    });
    btn.on('pointerdown', () => this.scene.start('Intro'));

    this.add.text(W / 2, H - 40, 'стрелки / WASD / тач для управления', {
      fontFamily: 'Courier New', fontSize: '11px', color: '#7a3a10', letterSpacing: 1,
    }).setOrigin(0.5);
  }
}
