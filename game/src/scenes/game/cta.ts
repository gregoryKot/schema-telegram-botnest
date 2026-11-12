// Сцен-скрипт развилки после главы и CTA к терапии (с телефоном доверия).
import { W, H } from '../../constants';
import { IS_TOUCH } from '../../controls';
import { t } from '../../i18n';
import { track, trackEvent } from '../../analytics';
import type { GameScene } from '../GameScene';

// Телефон доверия: тот же, что в shared/src/utils/crisisMarkers.ts (сверка — тест
// src/test-support/gates/game-crisis-hotline.spec.ts). Игра — отдельный пакет без shared/.
const CRISIS_TEL = 'tel:88001004994';

// Финальная CTA: запись + шаринг + донат
export function showTherapyCta(s: GameScene) {
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

  const ctaTxt = mk(286, t('m_learn_about_schema_therapy'), 12, '#88ffcc');
  const cta = s.add.rectangle(W / 2, 286 * ky, ctaTxt.width + 40, 42, 0x153028)
    .setStrokeStyle(2, 0x88ffcc).setScrollFactor(0).setDepth(deep).setAlpha(0).setInteractive({ useHandCursor: true });
  const shareTxt = mk(348, t('m_share'), 10, '#c0b8e8');
  const share = s.add.rectangle(W / 2, 348 * ky, shareTxt.width + 30, 34, 0x241d3a)
    .setStrokeStyle(1, 0x6a5aaf).setScrollFactor(0).setDepth(deep).setAlpha(0).setInteractive({ useHandCursor: true });
  const donTxt = mk(398, t('m_support_game'), 9, '#7a6fa0').setInteractive({ useHandCursor: true });
  const menu = mk(444, t('m_or_back_to_menu'), 9, '#5a4f7a').setInteractive({ useHandCursor: true });

  s.tweens.add({ targets: top, alpha: 1, duration: 800, delay: 300 });
  s.tweens.add({ targets: sum, alpha: 1, duration: 700, delay: 1200 });
  s.tweens.add({ targets: [ctaTxt, cta], alpha: 1, duration: 700, delay: 2000 });
  s.tweens.add({ targets: [shareTxt, share], alpha: 1, duration: 700, delay: 2600 });
  s.tweens.add({ targets: [donTxt, menu], alpha: 0.85, duration: 700, delay: 3100 });

  cta.on('pointerover', () => cta.setFillStyle(0x1d4536));
  cta.on('pointerout', () => cta.setFillStyle(0x153028));
  cta.on('pointerdown', () => { trackEvent('game_cta_click', { from: 'cabinet' }); window.open('https://schemehappens.ru/?from=game', '_blank'); });
  share.on('pointerover', () => share.setFillStyle(0x322a52));
  share.on('pointerout', () => share.setFillStyle(0x241d3a));
  share.on('pointerdown', () => {
    trackEvent('game_share', { from: 'cabinet' });
    const url = 'https://schemehappens.ru/game/?src=share';
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(t('m_share_road'))}`, '_blank');
  });
  donTxt.on('pointerover', () => donTxt.setColor('#ffd86a'));
  donTxt.on('pointerout', () => donTxt.setColor('#7a6fa0'));
  donTxt.on('pointerdown', () => { track('donate_click', { source: 'cabinet' }); window.open('https://schemehappens.ru/donate', '_blank'); });
  menu.on('pointerdown', () => s.scene.start('Start'));
  addCrisisLine(s, 486 * ky, deep + 1);
}

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

  // Главная кнопка — записаться в терапию (честно: справиться можно, но одному долго)
  const ctaTxt = mk(286, t('m_learn_about_schema_therapy'), 12, '#88ffcc', 154);
  const cta = s.add.rectangle(W / 2, 286 * ky, ctaTxt.width + 40, 42, 0x153028)
    .setStrokeStyle(2, 0x88ffcc).setScrollFactor(0).setDepth(153).setAlpha(0).setInteractive({ useHandCursor: true });
  // Продолжить — смотреть путь Мистера дальше
  const goTxt = mk(346, t('m_or_keep_going_with_mister'), 10, '#9b8fbf', 154).setInteractive({ useHandCursor: true });
  // Поддержать игру донатом
  const donTxt = mk(388, t('m_support_game'), 9, '#7a6fa0', 154).setInteractive({ useHandCursor: true });

  s.tweens.add({ targets: [top], alpha: 1, duration: 800 });
  s.tweens.add({ targets: [sub], alpha: 1, duration: 700, delay: 600 });
  s.tweens.add({ targets: [ctaTxt, cta], alpha: 1, duration: 700, delay: 1400 });
  s.tweens.add({ targets: goTxt, alpha: 0.85, duration: 700, delay: 2200 });
  s.tweens.add({ targets: donTxt, alpha: 0.8, duration: 700, delay: 2700 });

  cta.on('pointerover', () => cta.setFillStyle(0x1d4536));
  cta.on('pointerout', () => cta.setFillStyle(0x153028));
  cta.on('pointerdown', () => { trackEvent('game_cta_click', { from: 'act1' }); window.open('https://schemehappens.ru/?from=game', '_blank'); });
  goTxt.on('pointerover', () => goTxt.setColor('#d8c8ec'));
  goTxt.on('pointerout', () => goTxt.setColor('#9b8fbf'));
  goTxt.on('pointerdown', () => { track('continue', { to: nextChapter }); s.scene.restart({ chapter: nextChapter }); });
  donTxt.on('pointerover', () => donTxt.setColor('#ffd86a'));
  donTxt.on('pointerout', () => donTxt.setColor('#7a6fa0'));
  donTxt.on('pointerdown', () => { track('donate_click', { source: 'act1_branch' }); window.open('https://schemehappens.ru/donate', '_blank'); });
  addCrisisLine(s, 440 * ky, 154);
}

// Кризисная строка: игра нарочно доводит до «сил не осталось» — рядом обязан быть
// выход (правило №7 CLAUDE.md). Тихая, но кликабельная: tel-ссылка.
export function addCrisisLine(s: GameScene, y: number, depth: number) {
  const ln = s.add.text(W / 2, y, t('m_crisis_line'), {
    fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: IS_TOUCH ? '9px' : '10px', color: '#a89fd0', align: 'center',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(depth).setAlpha(0).setInteractive({ useHandCursor: true });
  ln.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: { stopPropagation(): void }) => { ev.stopPropagation(); window.location.href = CRISIS_TEL; });
  s.tweens.add({ targets: ln, alpha: 0.9, duration: 600, delay: 900 });
  return ln;
}
