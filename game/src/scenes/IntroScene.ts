import Phaser from 'phaser';
import { W, H } from '../constants';
import { setTouchControls } from '../controls';
import { t, type MsgKey } from '../i18n';

// Текст появляется построчно, затем кнопка «Начать путь»
const SLIDES = [
  {
    title: 'm_part_i',
    subtitle: 'm_what_gets_in_the_way',
    lines: [
      'm_every_day_we_run_into_things',
      'm_that_drag_us_down',
      '',
      'm_anxiety_that_won_t_let_go',
      'm_irritation_out_of_nowhere',
      'm_procrastination_you_can_t_stop',
      '',
      'm_we_re_used_to_fighting_it',
      'm_or_running_away',
      '',
      'm_but_what_if_you_just_pass',
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
    this.add.text(W / 2, 70, t(slide.title as MsgKey).toUpperCase(), {
      fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '11px',
      color: '#aa4411', letterSpacing: 6,
    }).setOrigin(0.5);

    // Подзаголовок
    this.add.text(W / 2, 105, t(slide.subtitle as MsgKey), {
      fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '18px',
      color: '#fff0d8', letterSpacing: 1,
    }).setOrigin(0.5);

    // Линия под заголовком
    line.fillStyle(0xff7733, 0.15);
    line.fillRect(W / 2 - 200, 130, 400, 1);

    // Текст — построчно с анимацией появления
    const startY = 160;
    const lineH = 26;

    slide.lines.forEach((key, i) => {
      const ln = this.add.text(W / 2, startY + i * lineH, key === '' ? '' : t(key as MsgKey), {
        fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '14px',
        color: key === '' ? '#000' : '#e8c8a0',
        letterSpacing: 0.5, align: 'center',
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: ln,
        alpha: 1,
        duration: 400,
        delay: 300 + i * 180,
        ease: 'Linear',
      });
    });

    // Кнопка появляется после всего текста
    const totalDelay = 300 + slide.lines.length * 180 + 400;

    const btnTxt = this.add.text(W / 2, H - 80, t('m_begin_the_journey'), {
      fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '14px',
      color: '#ff7733', letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0);
    const btn = this.add.rectangle(W / 2, H - 80, btnTxt.width + 40, 48, 0x3a1500)
      .setStrokeStyle(1, 0xff7733)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0);
    btnTxt.setDepth(1);

    this.tweens.add({ targets: [btn, btnTxt], alpha: 1, duration: 600, delay: totalDelay });

    btn.on('pointerover', () => { btn.fillColor = 0x3a2a8f; btnTxt.setColor('#fff0d8'); });
    btn.on('pointerout',  () => { btn.fillColor = 0x3a1500; btnTxt.setColor('#ff7733'); });
    btn.on('pointerdown', () => this.scene.start('Game'));

    // Пропуск по пробелу/клику на фон
    this.input.keyboard!.once('keydown-SPACE', () => this.scene.start('Game'));
    this.input.keyboard!.once('keydown-ENTER', () => this.scene.start('Game'));
  }
}
