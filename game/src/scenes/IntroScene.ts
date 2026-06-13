import Phaser from 'phaser';
import { W, H } from '../constants';
import { setTouchControls } from '../controls';

// Текст появляется построчно, затем кнопка «Начать путь»
const SLIDES = [
  {
    title: 'Часть I',
    subtitle: 'Что мешает жить',
    lines: [
      'Каждый день мы сталкиваемся с тем,',
      'что тянет нас вниз.',
      '',
      'Тревога, которая не отпускает.',
      'Раздражение без причины.',
      'Прокрастинация, которую не остановить.',
      '',
      'Мы привыкли с этим бороться.',
      'Или убегать.',
      '',
      'Но что если просто — пройти сквозь?',
    ],
  },
];

export class IntroScene extends Phaser.Scene {
  constructor() { super('Intro'); }

  create() {
    setTouchControls(false); // катсцена — тач-кнопки не нужны и мешают
    const slide = SLIDES[0];

    // Фон
    this.add.rectangle(W / 2, H / 2, W, H, 0x1a0800);

    // Тонкая декоративная линия сверху
    const line = this.add.graphics();
    line.fillStyle(0xff7733, 0.3);
    line.fillRect(W / 2 - 80, 50, 160, 1);

    // Заголовок главы
    this.add.text(W / 2, 70, slide.title.toUpperCase(), {
      fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '11px',
      color: '#aa4411', letterSpacing: 6,
    }).setOrigin(0.5);

    // Подзаголовок
    this.add.text(W / 2, 105, slide.subtitle, {
      fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '18px',
      color: '#fff0d8', letterSpacing: 1,
    }).setOrigin(0.5);

    // Линия под заголовком
    line.fillStyle(0xff7733, 0.15);
    line.fillRect(W / 2 - 200, 130, 400, 1);

    // Текст — построчно с анимацией появления
    const startY = 160;
    const lineH = 26;

    slide.lines.forEach((text, i) => {
      const t = this.add.text(W / 2, startY + i * lineH, text, {
        fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '14px',
        color: text === '' ? '#000' : '#e8c8a0',
        letterSpacing: 0.5, align: 'center',
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: t,
        alpha: 1,
        duration: 400,
        delay: 300 + i * 180,
        ease: 'Linear',
      });
    });

    // Кнопка появляется после всего текста
    const totalDelay = 300 + slide.lines.length * 180 + 400;

    const btn = this.add.rectangle(W / 2, H - 80, 220, 48, 0x3a1500)
      .setStrokeStyle(1, 0xff7733)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0);
    const btnTxt = this.add.text(W / 2, H - 80, 'Начать путь  →', {
      fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '15px',
      color: '#ff7733', letterSpacing: 3,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: [btn, btnTxt], alpha: 1, duration: 600, delay: totalDelay });

    btn.on('pointerover', () => { btn.fillColor = 0x3a2a8f; btnTxt.setColor('#fff0d8'); });
    btn.on('pointerout',  () => { btn.fillColor = 0x3a1500; btnTxt.setColor('#ff7733'); });
    btn.on('pointerdown', () => this.scene.start('Game'));

    // Пропуск по пробелу/клику на фон
    this.input.keyboard!.once('keydown-SPACE', () => this.scene.start('Game'));
    this.input.keyboard!.once('keydown-ENTER', () => this.scene.start('Game'));
  }
}
