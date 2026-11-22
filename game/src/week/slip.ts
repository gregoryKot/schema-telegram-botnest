// Срыв ПАУЗЫ («Пятница»): удержание замирает мир, полоска показывает, сколько оно держится, — и срывается само.
// Штрафа и возврата нет: Саша говорит, что так бывает с навыком, кнопка мигает снова. Логика — week/pause.ts.
import Phaser from 'phaser';
import { W, H } from '../constants';
import { audio } from '../audio';
import { t } from '../i18n';
import type { PauseSlip } from './chapter';
import type { PauseState } from './pause';
import type { WeekCoach } from './coach';
import type { WeekHud } from './hud';
import { C, FONT, SKIN, hex, label, px } from './ui';

export class SlipView {
  private objs: Phaser.GameObjects.GameObject[] = [];

  constructor(private s: Phaser.Scene, private hud: WeekHud, private coach: WeekCoach, private plan: PauseSlip[] = []) {}

  /** Кадр: was → now. Началось удержание-срыв — мир встал; кончилось — мир пошёл, Саша объясняет. */
  step(was: PauseState, now: PauseState) {
    if (was.slipMs === 0 && now.slipMs > 0) this.hold(now.slipMs);
    else if (was.slipMs > 0 && now.slipMs === 0) this.slipped(this.plan[now.slips - 1]);
  }

  private hold(ms: number) {
    const s = this.s, bw = px(220), y = H / 2;
    const keep = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T) => {
      o.setScrollFactor(0).setDepth(50); this.objs.push(o); return o;
    };
    s.physics.world.pause();
    audio.freeze();
    keep(s.add.rectangle(W / 2, H / 2, W, H, C.deep, 0.84));
    keep(s.add.text(W / 2, y - px(34), t('m_wk_act_pause'), { fontFamily: FONT, fontSize: `${px(40)}px`, fontStyle: '700', color: hex(C.paper) }).setOrigin(0.5));
    keep(s.add.text(W / 2, y + px(30), t('m_wk_slip_hold'), { fontFamily: FONT, fontSize: `${px(16)}px`, fontStyle: '700', color: hex(C.haze) }).setOrigin(0.5));
    keep(s.add.rectangle(W / 2, y + px(8), bw + px(6), px(14), C.ink));
    const bar = keep(s.add.rectangle(W / 2 - bw / 2, y + px(8), bw, px(8), C.sun).setOrigin(0, 0.5));
    s.tweens.add({ targets: bar, scaleX: 0, duration: ms }); // сколько держится эта попытка
  }

  private slipped(slip: PauseSlip | undefined) {
    const s = this.s;
    for (const o of this.objs) o.destroy();
    this.objs = [];
    s.physics.world.resume();
    s.cameras.main.shake(140, 0.006);
    audio.dash();
    if (!slip) return;
    // плашка в центре: это не промах, а свойство навыка
    const tag = label(s, t(slip.tag), SKIN.sun, { size: 18, bold: true, padX: 12, padY: 5 }).box.setScrollFactor(0).setDepth(45).setPosition(W / 2, H / 2 - px(40));
    s.tweens.add({ targets: tag, scale: { from: 1.3, to: 1 }, duration: 300, ease: 'Back.Out' });
    s.tweens.add({ targets: tag, alpha: 0, delay: 2600, duration: 400, onComplete: () => tag.destroy() });
    this.hud.think(t(slip.thought), 5200);
    this.coach.blink('pause');
  }
}
