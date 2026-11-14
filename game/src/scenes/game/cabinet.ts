// Гл.4 «Первый сеанс»: дверь терапевта, кабинет и финальная CTA.
import Phaser from 'phaser';
import { W, H } from '../../constants';
import { audio } from '../../audio';
import { setTouchControls } from '../../controls';
import { t, type MsgKey } from '../../i18n';
import { unlockChapter } from '../../progress';
import { track, trackEvent } from '../../analytics';
import { openCta } from '../../therapyCta';
import { addCrisisLine } from './cta';
import { FLOORLAMP_W } from '../../props';
import { addTherapist, talk } from './therapist';
import type { GameScene } from '../GameScene';

export function onDoorEnter(s: GameScene) {
  // дверь терапевта → глава 4 «Первый сеанс»
  trackEvent('game_chapter_done', { chapter: s.chapter.id });
  unlockChapter('chapter4');
  s.dead = true;
  audio.stopMusic();
  s.cameras.main.fade(1200, 10, 8, 14);
  s.time.delayedCall(1300, () => s.scene.restart({ chapter: 'chapter4' }));
}

// У двери терапевта копинги буквально гаснут — против выбора они бессмысленны
export function beginFinalApproach(s: GameScene) {
  s.finalApproach = true;
  track('final_approach');
  s.time.delayedCall(500, () => s.say('m_whisper_worse', 2800)); // тревога: «а вдруг хуже»
  const ids = ['tbtn-hit', 'tbtn-avoid', 'tbtn-fawn'];
  ids.forEach((id, i) => s.time.delayedCall(1800 + i * 900, () => {
    const el = document.getElementById(id);
    if (el) { el.style.transition = 'opacity 1s'; el.style.opacity = '0.12'; el.style.pointerEvents = 'none'; }
  }));
  s.time.delayedCall(1800, () => { s.copingsOff = true; });
  s.time.delayedCall(4200, () => s.say('m_no_coping_here_note', 3000));
}

export function restoreCopingButtons() {
  for (const id of ['tbtn-hit', 'tbtn-avoid', 'tbtn-fawn']) {
    const el = document.getElementById(id);
    if (el) { el.style.opacity = '1'; el.style.pointerEvents = 'auto'; }
  }
}

// ── Гл.4 «Первый сеанс»: payoff всей игры — впервые тихо, и кто-то рядом.
//    И первый ВСТРЕТИТЬ: Критик вблизи меньше, чем казался.
export function sessionScene(s: GameScene) {
  s.dead = true;
  audio.stopMusic();
  const pb = s.player.body as Phaser.Physics.Arcade.Body;
  pb.setVelocity(0, 0); pb.moves = false;
  s.player.setVisible(false);          // Мистера рисуем сами, в кресле
  setTouchControls(false); // на сеансе кнопки не нужны — совсем
  const deep = 150;
  // тёплая комната
  const room = s.add.rectangle(W / 2, H / 2, W, H, 0x171008).setScrollFactor(0).setDepth(deep).setAlpha(0);
  s.tweens.add({ targets: room, alpha: 1, duration: 900 });
  const gfx = s.add.graphics().setScrollFactor(0).setDepth(deep + 1).setAlpha(0);
    gfx.fillStyle(0x2a2014, 1); gfx.fillRect(0, H - 64, W, 64);                     // пол
  const objs: Phaser.GameObjects.GameObject[] = [gfx];
  const put = (key: string, x: number, w: number) => {
    if (!s.textures.exists(key)) return null;
    const img = s.add.image(x, H - 64, key).setOrigin(0.5, 1).setScrollFactor(0).setDepth(deep + 2).setAlpha(0);
    img.setScale(w / img.width);
    objs.push(img); return img;
  };
  put('prop_couch', W * 0.30, 240);
  put('prop_lamp', W * 0.74, FLOORLAMP_W); // ореол и пятно на полу — в спрайте
  put('prop_plant', W * 0.92, 70);
  // Мистер и терапевт — просто сидят. никого не надо бить.
  const mister = s.add.sprite(W * 0.26, H - 64, 'cat_idle').setOrigin(0.5, 1)
    .setScale(1.6).setScrollFactor(0).setDepth(deep + 3).setAlpha(0).play('p-idle');
  const doc = addTherapist(s, W * 0.56, H - 64, deep + 3);
  objs.push(mister, doc);
  s.tweens.add({ targets: objs, alpha: 1, duration: 1100, delay: 700 });

  // строки — тихие, по одной
  const font = '"Press Start 2P", "Courier New", monospace';
  const ky = H / 540;
  const line = (key: MsgKey, y: number, color: string, size: number, delay: number) => {
    const ln = s.add.text(W / 2, y * ky, t(key), { fontFamily: font, fontSize: `${size}px`, color, align: 'center', lineSpacing: 8 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(deep + 5).setAlpha(0);
    s.tweens.add({ targets: ln, alpha: 1, duration: 900, delay });
    s.sessionLines.push(ln);
    return ln;
  };
  line('m_cab_1', 82, '#d8c8ec', 13, 1600);
  line('m_cab_2', 118, '#d8c8ec', 12, 3200);
  line('m_cab_3', 154, '#e8d8c0', 12, 5200);
  line('m_ther_q', 208, '#a8e8d0', 12, 7400);          // — кто приходит к тебе чаще всего?
  s.time.delayedCall(7400, () => talk(s, doc, 2600));
  // Критик встаёт в дверях — огромный, как всегда
  s.time.delayedCall(9000, () => {
    const shadow = s.add.sprite(W * 0.92, H - 64, 'cat_idle').setOrigin(0.5, 1)
      .setScale(2.2).setTint(0x1a0030).setScrollFactor(0).setDepth(deep + 4).setAlpha(0).play('p-idle');
    shadow.setFlipX(true);
    s.tweens.add({ targets: shadow, alpha: 0.85, duration: 900 });
    audio.anx();
    const prompt = s.add.text(W / 2, (H - 100), t('m_meet_prompt'), {
      fontFamily: font, fontSize: '11px', color: '#88ffcc',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(deep + 6).setAlpha(0);
    s.tweens.add({ targets: prompt, alpha: { from: 0.4, to: 1 }, duration: 700, yoyo: true, repeat: -1, delay: 1100 });
    // ВСТРЕТИТЬ — вместе: одно нажатие, и вблизи он меньше, чем казался
    s.time.delayedCall(1400, () => {
      let met = false;
      const meet = () => {
        if (met) return; // E, потом тап — раньше рисовало две CTA и слало demo_end дважды
        met = true;
        s.input.keyboard!.off('keydown-E', meet); s.input.off('pointerdown', meet);
        prompt.destroy();
        audio.gate();
        s.tweens.add({ targets: shadow, x: W * 0.72, scale: 0.9, duration: 1700, ease: 'Sine.InOut' });
        s.tweens.add({ targets: shadow, tint: 0x4a3060, alpha: 0.8, duration: 1700 });
        line('m_meet_1', 250, '#e8b8c8', 12, 1900);
        line('m_meet_2', 306, '#d8c8ec', 12, 4300);
        line('m_meet_3', 368, '#88ffcc', 12, 6900);
        s.time.delayedCall(10200, () => showTherapyCta(s));
      };
      s.input.keyboard!.once('keydown-E', meet);
      s.input.once('pointerdown', meet);
    });
  });
}

// Финальная CTA: запись + шаринг + донат
function showTherapyCta(s: GameScene) {
  track('demo_end', { chapter: s.chapter.id });
  trackEvent('game_chapter_done', { chapter: s.chapter.id });
  trackEvent('game_cta_shown', { from: 'cabinet' });
  const font = '"Press Start 2P", "Courier New", monospace';
  const ky = H / 540, deep = 160;
  // тексты кнопок — НАД заливкой (deep + 1): при равном depth Phaser рисует по порядку
  // добавления, и непрозрачный прямоугольник закрывал подпись «записаться в терапию»
  const mk = (y: number, text: string, size: number, color: string) =>
    s.add.text(W / 2, y * ky, text, { fontFamily: font, fontSize: `${size}px`, color, align: 'center', lineSpacing: 8 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(deep + 1).setAlpha(0);
  // реплики кабинета гасим — иначе они просвечивают сквозь затемнение под CTA
  const old = s.sessionLines; s.sessionLines = [];
  s.tweens.add({ targets: old, alpha: 0, duration: 500, onComplete: () => old.forEach(l => l.destroy()) });
  const dim = s.add.rectangle(W / 2, H / 2, W, H, 0x06040e, 0.6).setScrollFactor(0).setDepth(deep - 1).setAlpha(0);
  s.tweens.add({ targets: dim, alpha: 1, duration: 700 });

  const top = mk(130, t('m_mister_reached'), 13, '#fff0d8');
  const sum = mk(206, t('m_cab_final'), 11, '#c0b8e8');

  const ctaTxt = mk(276, t('m_try_in_app'), 12, '#88ffcc');
  const cta = s.add.rectangle(W / 2, 276 * ky, ctaTxt.width + 40, 42, 0x153028)
    .setStrokeStyle(2, 0x88ffcc).setScrollFactor(0).setDepth(deep).setAlpha(0).setInteractive({ useHandCursor: true });
  // вторая кнопка тише главной: честная подпись, без рамки
  const book = mk(320, t('m_book_therapist'), 11, '#9b8fbf').setInteractive({ useHandCursor: true });
  const shareTxt = mk(360, t('m_share'), 11, '#c0b8e8');
  const share = s.add.rectangle(W / 2, 360 * ky, shareTxt.width + 30, 34, 0x241d3a)
    .setStrokeStyle(1, 0x6a5aaf).setScrollFactor(0).setDepth(deep).setAlpha(0).setInteractive({ useHandCursor: true });
  const donTxt = mk(404, t('m_support_game'), 11, '#9b8fbf').setInteractive({ useHandCursor: true });
  const menu = mk(442, t('m_or_back_to_menu'), 11, '#9b8fbf').setInteractive({ useHandCursor: true });

  s.tweens.add({ targets: top, alpha: 1, duration: 800, delay: 300 });
  s.tweens.add({ targets: sum, alpha: 1, duration: 700, delay: 1200 });
  s.tweens.add({ targets: [ctaTxt, cta], alpha: 1, duration: 700, delay: 2000 });
  s.tweens.add({ targets: book, alpha: 0.85, duration: 700, delay: 2300 });
  s.tweens.add({ targets: [shareTxt, share], alpha: 1, duration: 700, delay: 2600 });
  s.tweens.add({ targets: [donTxt, menu], alpha: 0.85, duration: 700, delay: 3100 });

  cta.on('pointerover', () => cta.setFillStyle(0x1d4536));
  cta.on('pointerout', () => cta.setFillStyle(0x153028));
  cta.on('pointerdown', () => openCta('cabinet', 'app'));
  book.on('pointerover', () => book.setColor('#d8c8ec'));
  book.on('pointerout', () => book.setColor('#9b8fbf'));
  book.on('pointerdown', () => openCta('cabinet', 'booking'));
  share.on('pointerover', () => share.setFillStyle(0x322a52));
  share.on('pointerout', () => share.setFillStyle(0x241d3a));
  share.on('pointerdown', () => {
    trackEvent('game_share', { from: 'cabinet' });
    const url = 'https://schemehappens.ru/game/?src=share';
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(t('m_share_road'))}`, '_blank');
  });
  donTxt.on('pointerover', () => donTxt.setColor('#ffd86a'));
  donTxt.on('pointerout', () => donTxt.setColor('#9b8fbf'));
  donTxt.on('pointerdown', () => { track('donate_click', { source: 'cabinet' }); window.open('https://schemehappens.ru/donate', '_blank'); });
  menu.on('pointerdown', () => s.scene.start('Start'));
  addCrisisLine(s, 486 * ky, deep + 1);
}
