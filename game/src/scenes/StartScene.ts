import Phaser from 'phaser';
import { W, H } from '../constants';
import { getContinueChapter } from '../progress';
import { track, trackEvent } from '../analytics';
import { CHAPTERS } from '../chapters';
import { setTouchControls, IS_TOUCH } from '../controls';
import { t } from '../i18n';
import { drawStartArt } from './startArt';
import { HUD_STROKE } from '../look';

export class StartScene extends Phaser.Scene {
  constructor() { super('Start'); }

  create() {
    setTouchControls(false); // титул — тач-кнопки перекрывали «НАЧАТЬ»
    const cat = drawStartArt(this);
    document.title = t('m_game_title'); // в index.html — русское имя, EN подменяет здесь

    this.add.text(W / 2, IS_TOUCH ? 48 : 84, t('m_title_top'), {
      fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '26px', color: '#fff0d8',
      letterSpacing: 4,
    }).setOrigin(0.5);
    this.add.text(W / 2, IS_TOUCH ? 84 : 124, t('m_title_bottom'), {
      fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '26px', color: '#ff7733',
      letterSpacing: 4,
    }).setOrigin(0.5);

    // кнопка — между титулом и комнатой, не поверх дивана
    const btnY = IS_TOUCH ? 140 : 214;

    // Кнопка запуска — рамка подгоняется под текст, чтобы он не вылезал
    const btnTxt = this.add.text(W / 2, btnY, t('m_start'), {
      fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '16px', color: '#ff7733', letterSpacing: 6,
    }).setOrigin(0.5);
    const btn = this.add.rectangle(W / 2, btnY, btnTxt.width + 48, 48, 0x3a1500)
      .setStrokeStyle(2, 0xa08fff)
      .setInteractive({ useHandCursor: true });
    btnTxt.setDepth(1); // текст поверх рамки

    btn.on('pointerover', () => {
      btn.fillColor = 0xcc5522;
      btnTxt.setColor('#fff0d8');
      cat.setTint(0xfff0d8);
    });
    btn.on('pointerout', () => {
      btn.fillColor = 0x3a1500;
      btnTxt.setColor('#ff7733');
      cat.clearTint();
    });
    btn.on('pointerdown', () => { trackEvent('game_start'); this.scene.start('Tutorial'); });

    // вернулся — продолжай с достигнутой главы, не с нуля
    const cont = getContinueChapter();
    if (cont && CHAPTERS[cont]) {
      const cbtn = this.add.text(W / 2, btnY + 48, t('m_continue') + ` — «${t(CHAPTERS[cont].title)}» →`, {
        fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '11px', color: '#88ffcc', letterSpacing: 0, ...HUD_STROKE,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      cbtn.on('pointerover', () => cbtn.setColor('#fff0d8'));
      cbtn.on('pointerout', () => cbtn.setColor('#88ffcc'));
      cbtn.on('pointerdown', () => { track('game_continue', { chapter: cont }); this.scene.start('Game', { chapter: cont }); });
    }

    // на таче «стрелки/WASD» бессмысленны и налезали на START — не показываем
    if (!IS_TOUCH) {
      this.add.text(W / 2, H - 40, t('m_arrows_wasd_tap_to_play'), {
        fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '11px', color: '#a89fd0', letterSpacing: 1,
      }).setOrigin(0.5);
    }
  }
}
