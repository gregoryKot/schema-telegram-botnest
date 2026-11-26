// Финальная карточка игры: кто был в неделе (режимы по именам) и что с этим делают в терапии; зов — запись и приложение.
// Кризисная строка двумя линиями — как на карточке хука (правило №7).
import Phaser from 'phaser';
import { W, H } from '../constants';
import { t, type MsgKey } from '../i18n';
import { trackEvent } from '../analytics';
import { openCta } from '../therapyCta';
import { C, FONT, SKIN, button, hex, px } from './ui';
import { shareWeek } from './share';
import { crisisLines } from './crisis';

/** Режим и чем он был в игре; последний — тот, кого растят. */
export const MODES: [name: MsgKey, was: MsgKey][] = [
  ['m_wk_final_critic', 'm_wk_final_critic_is'], ['m_wk_final_protector', 'm_wk_final_protector_is'],
  ['m_wk_final_child', 'm_wk_final_child_is'], ['m_wk_final_adult', 'm_wk_final_adult_is'],
];

export function showFinalCard(s: Phaser.Scene, again: () => void) {
  trackEvent('game_cta_shown', { from: 'final' });
  const colW = px(346), left = px(26), btnW = px(216), btnH = px(44), btnX = W - px(26) - btnW / 2;
  const all: (Phaser.GameObjects.Text | Phaser.GameObjects.Container)[] = [];
  const put = <T extends Phaser.GameObjects.Text | Phaser.GameObjects.Container>(o: T) => { o.setScrollFactor(0).setDepth(60).setAlpha(0); all.push(o); return o; };
  const text = (y: number, str: string, size: number, color: number, bold = false) => put(s.add.text(left, y, str, {
    fontFamily: FONT, fontSize: `${px(size)}px`, fontStyle: bold ? '700' : '500', color: hex(color), wordWrap: { width: colW }, lineSpacing: px(1) }));

  let y = px(18);
  y += text(y, t('m_wk_final_kicker'), 15, C.haze, true).setLetterSpacing(px(3)).height + px(6);
  MODES.forEach(([name, was], i) => {
    y += text(y, t(name), 18, i === MODES.length - 1 ? C.sun : C.paper, true).height;
    y += text(y, t(was), 16, C.haze).height + px(5);
  });
  y += text(y + px(2), t('m_wk_final_lead'), 16, C.haze).height + px(8);
  text(y, t('m_wk_final_close'), 16, C.paper);

  const row = (i: number) => px(70) + btnH / 2 + i * (btnH + px(8)); // ниже кнопки меню в углу
  put(button(s, btnX, row(0), btnW, btnH, t('m_wk_card_btn_book'), SKIN.sun, () => openCta('final', 'booking')));
  put(button(s, btnX, row(1), btnW, btnH, t('m_wk_card_btn_app'), SKIN.paper, () => openCta('final', 'app')));
  put(button(s, btnX, row(2), btnW, btnH, t('m_wk_card_btn_share'), SKIN.night, () => shareWeek(t('m_wk_share_text'), 'final')));
  put(button(s, btnX, row(3), btnW, btnH, t('m_wk_final_again'), SKIN.night, again));

  crisisLines(s, H - px(42)).forEach(put);
  all.forEach((o, i) => s.tweens.add({ targets: o, alpha: 1, duration: 400, delay: 90 * i }));
}
