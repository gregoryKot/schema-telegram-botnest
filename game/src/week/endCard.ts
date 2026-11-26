// Конец главы без зова (между главами ссылок нет — зов живёт в сюжете): день пройден (у тяжёлой главы — с кризисной строкой), путь в следующую главу (или «продолжение скоро»), «ещё раз» и «поделиться».
import Phaser from 'phaser';
import { W, H } from '../constants';
import { t, type MsgKey } from '../i18n';
import { C, FONT, SKIN, button, hex, px } from './ui';
import { shareWeek } from './share';
import { crisisLines } from './crisis';

export interface EndOpts { day: MsgKey; again: () => void; next?: { label: MsgKey; go: () => void }; crisis?: boolean }

export function showWeekEnd(s: Phaser.Scene, o: EndOpts) {
  const all: (Phaser.GameObjects.Text | Phaser.GameObjects.Container)[] = [];
  const put = <T extends Phaser.GameObjects.Text | Phaser.GameObjects.Container>(x: T) => { x.setScrollFactor(0).setDepth(60).setAlpha(0); all.push(x); return x; };
  const text = (y: number, str: string, size: number, color: number) =>
    put(s.add.text(W / 2, y, str, { fontFamily: FONT, fontSize: `${px(size)}px`, fontStyle: '700', color: hex(color) }).setOrigin(0.5));
  text(H / 2 - px(96), t('m_wk_end_kicker'), 16, C.haze).setLetterSpacing(px(4));
  text(H / 2 - px(58), t(o.day), 44, C.paper);
  const bw = px(240), bh = px(44), y0 = H / 2 + px(4);
  if (o.next) put(button(s, W / 2, y0, bw, bh, t(o.next.label), SKIN.sun, o.next.go));
  else put(button(s, W / 2, y0, bw, bh, t('m_wk_card_soon'), SKIN.ghost)); // следующая глава не вышла: строка, а не кнопка
  put(button(s, W / 2 - bw / 4 - px(4), y0 + bh + px(10), bw / 2 - px(4), bh, t('m_wk_end_again'), SKIN.paper, o.again));
  put(button(s, W / 2 + bw / 4 + px(4), y0 + bh + px(10), bw / 2 - px(4), bh, t('m_wk_card_btn_share'), SKIN.night, () => shareWeek(t('m_wk_share_text'))));
  if (o.crisis) crisisLines(s, H - px(42)).forEach(put);
  all.forEach((x, i) => s.tweens.add({ targets: x, alpha: 1, duration: 400, delay: 140 * i }));
}
