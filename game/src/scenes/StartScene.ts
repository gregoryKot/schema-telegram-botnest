import Phaser from 'phaser';
import { W, H } from '../constants';
import { getContinueChapter } from '../progress';
import { track } from '../analytics';
import { donate } from '../donate';
import { CHAPTERS } from '../chapters';
import { setTouchControls } from '../controls';

export class StartScene extends Phaser.Scene {
  constructor() { super('Start'); }

  create() {
    setTouchControls(false); // титул — тач-кнопки перекрывали «НАЧАТЬ»
    this.add.rectangle(W / 2, H / 2, W, H, 0x1a0800);

    this.add.text(W / 2, 90, 'RUN THROUGH', {
      fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '26px', color: '#fff0d8',
      letterSpacing: 4,
    }).setOrigin(0.5);
    this.add.text(W / 2, 130, 'YOUR MIND', {
      fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '26px', color: '#ff7733',
      letterSpacing: 4,
    }).setOrigin(0.5);

    // Анимация котика для превью
    this.anims.create({
      key: 's-cat-idle',
      frames: this.anims.generateFrameNumbers('cat_idle', { start: 0, end: 11 }),
      frameRate: 10, repeat: -1,
    });

    const cat = this.add.sprite(W / 2, H / 2 + 20, 'cat_idle').setScale(4).play('s-cat-idle');

    // Кнопка запуска — рамка подгоняется под текст, чтобы он не вылезал
    const btnTxt = this.add.text(W / 2, H / 2 + 130, 'НАЧАТЬ', {
      fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '16px', color: '#ff7733', letterSpacing: 6,
    }).setOrigin(0.5);
    const btn = this.add.rectangle(W / 2, H / 2 + 130, btnTxt.width + 48, 48, 0x3a1500)
      .setStrokeStyle(2, 0xa08fff)
      .setInteractive({ useHandCursor: true });
    btnTxt.setDepth(1); // текст поверх рамки

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
    btn.on('pointerdown', () => { track('game_start'); this.scene.start('Tutorial'); });

    // вернулся — продолжай с достигнутой главы, не с нуля
    const cont = getContinueChapter();
    if (cont && CHAPTERS[cont]) {
      const cbtn = this.add.text(W / 2, H / 2 + 178, `продолжить — «${CHAPTERS[cont].title}» →`, {
        fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '10px', color: '#88ffcc', letterSpacing: 0,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      cbtn.on('pointerover', () => cbtn.setColor('#fff0d8'));
      cbtn.on('pointerout', () => cbtn.setColor('#88ffcc'));
      cbtn.on('pointerdown', () => { track('game_continue', { chapter: cont }); this.scene.start('Game', { chapter: cont }); });
    }

    // ── Поддержать проект (донат) ──────────────────────────────────────────
    const fontPS = '"Press Start 2P", "Courier New", monospace';
    this.add.text(W / 2, H - 104, 'поддержать проект 💛', {
      fontFamily: fontPS, fontSize: '10px', color: '#d8b84a', letterSpacing: 1,
    }).setOrigin(0.5);
    const amounts = [200, 500, 1000];
    const gap = 92;
    amounts.forEach((amt, i) => {
      const x = W / 2 + (i - 1) * gap;
      const t = this.add.text(x, H - 78, `${amt} ₽`, {
        fontFamily: fontPS, fontSize: '11px', color: amt === 500 ? '#ffd86a' : '#9a8a4a', letterSpacing: 1,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor('#fff0d8'));
      t.on('pointerout', () => t.setColor(amt === 500 ? '#ffd86a' : '#9a8a4a'));
      t.on('pointerdown', () => { void donate(amt); });
    });

    this.add.text(W / 2, H - 40, 'стрелки / WASD / тач для управления', {
      fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '11px', color: '#7a3a10', letterSpacing: 1,
    }).setOrigin(0.5);
  }
}
