// Кризисная строка двумя линиями (правило №7): взрослая первой, детская второй; каждая — tel-ссылка во всю строку.
// Те же линии, что в shared/src/utils/crisisMarkers.ts; сверка — src/test-support/gates/game-crisis-hotline.spec.ts.
import Phaser from 'phaser';
import { W } from '../constants';
import { t, type MsgKey } from '../i18n';
import { C, FONT, hex, px } from './ui';

const CRISIS_TEL = 'tel:88001004994';
const CRISIS_CHILD_TEL = 'tel:88002000122';

/** Две линии от строки y вниз; size — кегль (на карточке крупнее, чем в углу главы). */
export function crisisLines(s: Phaser.Scene, y: number, size = 16): Phaser.GameObjects.Text[] {
  return [['m_wk_crisis_adult', CRISIS_TEL], ['m_wk_crisis_child', CRISIS_CHILD_TEL]].map(([key, tel], i) => {
    const ln = s.add.text(W / 2, y + i * px(size + 6), t(key as MsgKey), { fontFamily: FONT, fontSize: `${px(size)}px`, fontStyle: '500', color: hex(C.haze) })
      .setOrigin(0.5).setPadding(px(40), px(3), px(40), px(3)).setInteractive({ useHandCursor: true });
    ln.on('pointerdown', () => { window.location.href = tel; });
    return ln;
  });
}
