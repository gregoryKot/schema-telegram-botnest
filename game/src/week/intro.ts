// Заставка дня: мир стоит, справа — кто это, куда идёт и как управлять; старт — касанием.
// Над Сашей — бирка с именем, она держится первые секунды бега.
import Phaser from 'phaser';
import { W } from '../constants';
import { IS_TOUCH } from '../controls';
import { t } from '../i18n';
import type { Chapter } from './chapter';
import { C, FONT, SKIN, hex, label, plate, px } from './ui';

export interface IntroOpts { ch: Pick<Chapter, 'title' | 'about' | 'again' | 'who'>; again: boolean; sasha: Phaser.GameObjects.Sprite }

export function showWeekIntro(s: Phaser.Scene, o: IntroOpts, onStart: () => void) {
  const x0 = px(286), w = W - x0 - px(24), y0 = px(58), pad = px(18);
  const g = s.add.graphics();
  plate(g, 0, 0, w, px(212), SKIN.night);
  const txt = (y: number, text: string, size: number, color: number, bold = false) =>
    s.add.text(pad, y, text, { fontFamily: FONT, fontSize: `${px(size)}px`, fontStyle: bold ? '700' : '500', color: hex(color),
      wordWrap: { width: w - 2 * pad } });
  const parts: Phaser.GameObjects.GameObject[] = [g,
    txt(px(12), t(o.again ? o.ch.again : o.ch.about), 14, C.haze),
    txt(px(30), t(o.ch.title), 40, C.paper, true),
    txt(px(78), t(o.ch.who), 20, C.paper)];
  // как управлять: две строки горчичным — тем же цветом, что силы и рюкзак
  const how = [t('m_wk_intro_auto'), t(IS_TOUCH ? 'm_wk_intro_tap' : 'm_wk_intro_key')];
  how.forEach((line, i) => {
    const y = px(114) + i * px(24);
    g.fillStyle(C.sun).fillRect(pad, y + px(8), px(6), px(6));
    parts.push(txt(y, line, 18, C.sun, true).setX(pad + px(14)));
  });
  const go = label(s, t(IS_TOUCH ? 'm_wk_intro_start' : 'm_wk_intro_start_key'), SKIN.sun, { size: 17, bold: true, padX: 14, padY: 5 });
  go.box.setPosition(w / 2, px(204));
  parts.push(go.box);
  const panel = s.add.container(x0, y0, parts).setScrollFactor(0).setDepth(55).setAlpha(0);
  s.tweens.add({ targets: panel, alpha: 1, x: { from: x0 + px(16), to: x0 }, duration: 260, ease: 'Cubic.Out' });
  s.tweens.add({ targets: go.box, alpha: 0.35, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

  const tag = nameTag(s, o.sasha);
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    s.tweens.killTweensOf(go.box);
    s.tweens.add({ targets: panel, alpha: 0, x: x0 + px(16), duration: 200, onComplete: () => panel.destroy() });
    s.time.delayedCall(3500, () => s.tweens.add({ targets: tag, alpha: 0, duration: 400, onComplete: () => tag.destroy() }));
    onStart();
  };
  s.time.delayedCall(250, () => { // случайное касание при загрузке не пропускает заставку
    s.input.once('pointerdown', start);
    s.input.keyboard?.once('keydown', start);
  });
}

/** Бирка с именем над головой: идёт за Сашей, пока не погаснет. */
function nameTag(s: Phaser.Scene, sasha: Phaser.GameObjects.Sprite): Phaser.GameObjects.Container {
  const tag = label(s, t('m_wk_name'), SKIN.sun, { size: 16, bold: true, tail: 'say', padX: 8, padY: 3 }).box.setDepth(43);
  const follow = () => { if (tag.active) tag.setPosition(sasha.x, sasha.y - sasha.displayHeight - px(2)); };
  follow();
  s.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
  tag.once(Phaser.GameObjects.Events.DESTROY, () => s.events.off(Phaser.Scenes.Events.POST_UPDATE, follow));
  return tag;
}
