// Развилка конца Акта I, CTA финала и кризисная строка.
import Phaser from 'phaser';
import { W, H } from '../../constants';
import { IS_TOUCH } from '../../controls';
import { t } from '../../i18n';
import { unlockChapter } from '../../progress';
import { track, trackEvent } from '../../analytics';
import { openCta } from '../../therapyCta';
import type { GameScene } from '../GameScene';

// Телефон доверия: тот же, что в shared/src/utils/crisisMarkers.ts (сверка — тест
// src/test-support/gates/game-crisis-hotline.spec.ts). Игра — отдельный пакет без shared/.
const CRISIS_TEL = 'tel:88001004994';

// Развилка конца Акта I: уйти в терапию сейчас (воронка) ИЛИ идти дальше (игра).
export function showBranch(s: GameScene, nextChapter: string) {
  track('act1_end', { chapter: s.chapter.id });
  trackEvent('game_cta_shown', { from: 'act1' });
  const ky = H / 540, font = '"Press Start 2P", "Courier New", monospace';
  const mk = (y: number, text: string, size: number, color: string, depth = 153) =>
    s.add.text(W / 2, y * ky, text, { fontFamily: font, fontSize: `${size}px`, color, align: 'center', lineSpacing: 9 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(depth).setAlpha(0);

  const top = mk(138, t('m_this_can_t_go_on_2'), 16, '#ff8aa6');
  const sub = mk(196, t('m_and_for_the_first_time_mister'), 11, '#d8c8ec');

  // Главная кнопка — попробовать в приложении (честно: справиться можно, но одному долго)
  const ctaTxt = mk(276, t('m_try_in_app'), 12, '#88ffcc', 154);
  const cta = s.add.rectangle(W / 2, 276 * ky, ctaTxt.width + 40, 42, 0x153028)
    .setStrokeStyle(2, 0x88ffcc).setScrollFactor(0).setDepth(153).setAlpha(0).setInteractive({ useHandCursor: true });
  // Вторая, тише — запись к терапевту
  const book = mk(320, t('m_book_therapist'), 9, '#9b8fbf', 154).setInteractive({ useHandCursor: true });
  // Продолжить — смотреть путь Мистера дальше
  const goTxt = mk(358, t('m_or_keep_going_with_mister'), 10, '#9b8fbf', 154).setInteractive({ useHandCursor: true });
  // Поддержать игру донатом
  const donTxt = mk(398, t('m_support_game'), 9, '#7a6fa0', 154).setInteractive({ useHandCursor: true });

  s.tweens.add({ targets: [top], alpha: 1, duration: 800 });
  s.tweens.add({ targets: [sub], alpha: 1, duration: 700, delay: 600 });
  s.tweens.add({ targets: [ctaTxt, cta], alpha: 1, duration: 700, delay: 1400 });
  s.tweens.add({ targets: book, alpha: 0.85, duration: 700, delay: 1800 });
  s.tweens.add({ targets: goTxt, alpha: 0.85, duration: 700, delay: 2200 });
  s.tweens.add({ targets: donTxt, alpha: 0.8, duration: 700, delay: 2700 });

  cta.on('pointerover', () => cta.setFillStyle(0x1d4536));
  cta.on('pointerout', () => cta.setFillStyle(0x153028));
  cta.on('pointerdown', () => openCta('act1', 'app'));
  book.on('pointerover', () => book.setColor('#d8c8ec'));
  book.on('pointerout', () => book.setColor('#9b8fbf'));
  book.on('pointerdown', () => openCta('act1', 'booking'));
  goTxt.on('pointerover', () => goTxt.setColor('#d8c8ec'));
  goTxt.on('pointerout', () => goTxt.setColor('#9b8fbf'));
  goTxt.on('pointerdown', () => { track('continue', { to: nextChapter }); unlockChapter(nextChapter); s.scene.restart({ chapter: nextChapter }); });
  donTxt.on('pointerover', () => donTxt.setColor('#ffd86a'));
  donTxt.on('pointerout', () => donTxt.setColor('#7a6fa0'));
  donTxt.on('pointerdown', () => { track('donate_click', { source: 'act1_branch' }); window.open('https://schemehappens.ru/donate', '_blank'); });
  addCrisisLine(s, 440 * ky, 154);
}

function modeShort(s: GameScene): string {
  if (s.chapter.id === 'chapter1') return t('m_punitive_parent');
  if (s.chapter.id === 'chapter2') return t('m_detached_protector');
  return t('m_anxiety_2');
}

// Мост в реальную терапию — карточка-результат + воронка + виральность
export function showCta(s: GameScene) {
  track('demo_end', { chapter: s.chapter.id });
  trackEvent('game_cta_shown', { from: 'ending' });
  const ky = H / 540, font = '"Press Start 2P", "Courier New", monospace';
  const mk = (y: number, text: string, size: number, color: string, depth = 153) =>
    s.add.text(W / 2, y * ky, text, { fontFamily: font, fontSize: `${size}px`, color, align: 'center', lineSpacing: 9 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(depth).setAlpha(0);

  // Карточка-результат: «твой главный враг» = режим (виральный крючок, п.7)
  const top  = mk(196, t('m_you_ran_through_your_own_mind'), 12, '#d8c8ec');
  const lbl  = mk(244, t('m_your_biggest_enemy'), 10, '#9a8fb8');
  const mode = mk(282, modeShort(s), 16, '#ff8aa6');
  const sub  = mk(336, t('m_you_can_t_beat_it_alone'), 11, '#a8e8d0');

  const ctaTxt = mk(404, t('m_try_in_app'), 11, '#88ffcc', 154);
  const cta = s.add.rectangle(W / 2, 404 * ky, ctaTxt.width + 34, 38, 0x153028)
    .setStrokeStyle(2, 0x88ffcc).setScrollFactor(0).setDepth(153).setAlpha(0).setInteractive({ useHandCursor: true });
  const shareTxt = mk(452, t('m_share'), 10, '#c0b8e8', 154);
  const share = s.add.rectangle(W / 2, 452 * ky, shareTxt.width + 30, 34, 0x241d3a)
    .setStrokeStyle(1, 0x6a5aaf).setScrollFactor(0).setDepth(153).setAlpha(0).setInteractive({ useHandCursor: true });
  const menu = mk(498, t('m_or_back_to_menu'), 9, '#5a4f7a', 154).setInteractive({ useHandCursor: true });

  s.tweens.add({ targets: [top], alpha: 1, duration: 800 });
  s.tweens.add({ targets: [lbl, mode], alpha: 1, duration: 700, delay: 500 });
  s.tweens.add({ targets: [sub], alpha: 1, duration: 700, delay: 1100 });
  s.tweens.add({ targets: [ctaTxt, cta], alpha: 1, duration: 700, delay: 1600 });
  s.tweens.add({ targets: [shareTxt, share], alpha: 1, duration: 700, delay: 2000 });
  s.tweens.add({ targets: menu, alpha: 0.7, duration: 700, delay: 2400 });

  cta.on('pointerover', () => cta.setFillStyle(0x1d4536));
  cta.on('pointerout', () => cta.setFillStyle(0x153028));
  cta.on('pointerdown', () => openCta('ending', 'app'));
  share.on('pointerover', () => share.setFillStyle(0x322a52));
  share.on('pointerout', () => share.setFillStyle(0x241d3a));
  share.on('pointerdown', () => {
    trackEvent('game_share', { from: 'ending' });
    const url = 'https://schemehappens.ru/game/?src=share';
    const text = t('m_share_text', { enemy: modeShort(s) });
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
  });
  menu.on('pointerdown', () => s.scene.start('Start'));
}

// Кризисная строка: игра нарочно доводит до «сил не осталось» — рядом обязан быть
// выход (правило №7 CLAUDE.md). Тихая, но кликабельная: tel-ссылка.
export function addCrisisLine(s: GameScene, y: number, depth: number) {
  const ln = s.add.text(W / 2, y, t('m_crisis_line'), {
    fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: IS_TOUCH ? '9px' : '10px', color: '#a89fd0', align: 'center',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(depth).setAlpha(0).setInteractive({ useHandCursor: true });
  ln.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev.stopPropagation(); window.location.href = CRISIS_TEL; });
  s.tweens.add({ targets: ln, alpha: 0.9, duration: 600, delay: 900 });
  return ln;
}
