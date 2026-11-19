// Карточка после хука: три абзаца о том, что было в игре, зов (запись, приложение), продолжение и «поделиться».
// Игра доводит до «сил нет» — рядом обязан быть выход: кризисная строка двумя линиями (правило №7).
import Phaser from 'phaser';
import { W, H } from '../constants';
import { t, type MsgKey } from '../i18n';
import { trackEvent } from '../analytics';
import { openCta } from '../therapyCta';
import { C, FONT, SKIN, button, hex, px } from './ui';
import { shareWeek } from './share';

// Те же линии, что в shared/src/utils/crisisMarkers.ts; сверка — src/test-support/gates/game-crisis-hotline.spec.ts.
const CRISIS_TEL = 'tel:88001004994';
const CRISIS_CHILD_TEL = 'tel:88002000122';
const PARAS: MsgKey[] = ['m_wk_card_p1', 'm_wk_card_p2', 'm_wk_card_p3'];

export function showWeekCard(s: Phaser.Scene) {
  trackEvent('game_cta_shown', { from: 'hook' });
  const colW = px(332), left = px(30), btnW = px(216), btnH = px(44), btnX = W - px(30) - btnW / 2;
  const all: (Phaser.GameObjects.Text | Phaser.GameObjects.Container)[] = [];
  const put = <T extends Phaser.GameObjects.Text | Phaser.GameObjects.Container>(o: T) => { o.setScrollFactor(0).setDepth(60).setAlpha(0); all.push(o); return o; };

  let y = px(52);
  PARAS.forEach((key, i) => {
    const p = put(s.add.text(left, y, t(key), { fontFamily: FONT, fontSize: `${px(18)}px`, fontStyle: '500', color: hex(i === 2 ? C.paper : C.haze),
      wordWrap: { width: colW }, lineSpacing: px(1) }));
    y += p.height + px(10);
  });

  const row = (i: number) => px(70) + btnH / 2 + i * (btnH + px(8)); // ниже кнопки меню в углу
  put(button(s, btnX, row(0), btnW, btnH, t('m_wk_card_btn_book'), SKIN.sun, () => openCta('hook', 'booking')));
  put(button(s, btnX, row(1), btnW, btnH, t('m_wk_card_btn_app'), SKIN.paper, () => openCta('hook', 'app')));
  put(button(s, btnX, row(2), btnW, btnH, t('m_wk_card_btn_share'), SKIN.night, () => shareWeek(t('m_wk_share_text'))));
  put(button(s, btnX, row(3), btnW, btnH, t('m_wk_card_soon'), SKIN.ghost)); // следующая глава не вышла: строка, а не кнопка

  // кризисные линии: взрослая первой, детская второй; каждая — своя tel-ссылка с зоной нажатия во всю строку
  [['m_wk_crisis_adult', CRISIS_TEL], ['m_wk_crisis_child', CRISIS_CHILD_TEL]].forEach(([key, tel], i) => {
    const ln = put(s.add.text(W / 2, H - px(42) + i * px(22), t(key as MsgKey), { fontFamily: FONT, fontSize: `${px(16)}px`, fontStyle: '500', color: hex(C.haze) })
      .setOrigin(0.5).setPadding(px(40), px(3), px(40), px(3)).setInteractive({ useHandCursor: true }));
    ln.on('pointerdown', () => { window.location.href = tel; });
  });
  all.forEach((o, i) => s.tweens.add({ targets: o, alpha: 1, duration: 400, delay: 120 * i }));
}
