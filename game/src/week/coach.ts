// Понятность хука: цель под часами, бирка над дверью, подсказка, когда Саша упёрся, цена привычки у Саши.
// Что подсказать — чистая логика (week/guide.ts); здесь только показ и мигание DOM-кнопок (week/touch.ts).
import Phaser from 'phaser';
import { W, GROUND_Y, PHYS } from '../constants';
import { IS_TOUCH } from '../controls';
import { t, type MsgKey } from '../i18n';
import { jumpHeight, needFor, pickHint, type Need } from './guide';
import { ACT_KEYS } from './input';
import { callWeekAct } from './touch';
import { SKIN, label, px } from './ui';
import type { Act } from './monday';
import type { World } from './world';
import type { WeekHud } from './hud';

const HINT: Record<Act, MsgKey> = {
  overwork: 'm_wk_hint_overwork', scroll: 'm_wk_hint_scroll', agree: 'm_wk_hint_agree', pause: 'm_wk_hint_pause',
};
const AHEAD = 120; // преграда ближе этого — «прямо перед Сашей»
type Box = Phaser.GameObjects.Container;

export interface CoachView {
  x: number; blocked: boolean; jumpFactor: number; peak: boolean; revealed: Act[];
  world: World; blocks: { x: number; w: number }[];
}

export class WeekCoach {
  private goalBox: Box | null = null;
  private doorTag: Box | null = null;
  private tip: Box | null = null;
  private stuckMs = 0; private sinceHint = Infinity;
  private calling = new Set<Need>();

  constructor(private s: Phaser.Scene, private hud: WeekHud) {}

  /** Цель под часами: сменилась — плашка вспыхивает. */
  goal(key: MsgKey) {
    this.goalBox?.destroy();
    const b = label(this.s, t(key), SKIN.paper, { size: 15, bold: true, padX: 8, padY: 3 }).box;
    this.goalBox = b.setScrollFactor(0).setDepth(42).setPosition(W / 2, px(56)).setScale(1.25);
    this.s.tweens.add({ targets: b, scale: 1, duration: 360, ease: 'Back.Out' });
  }
  /** Бирка над дверью начальницы: появляется вместе с сообщением и идёт за дверью. */
  tagDoor() {
    if (this.doorTag) return;
    this.doorTag = label(this.s, t('m_wk_door_tag'), SKIN.acid, { size: 15, bold: true, tail: 'say', padX: 8, padY: 3 }).box.setDepth(6);
  }
  /** Кнопка появилась — Саша думает, зачем она, кнопка мигает до первого нажатия. */
  reveal(act: Act) { this.hint(act); }
  /** Нажали — мигать перестаёт. */
  used(n: Need) {
    if (n === 'jump') this.stuckMs = 0;
    if (!this.calling.delete(n)) return;
    callWeekAct(n, false);
    if (n === 'jump') this.dropTip();
  }
  /** Цена привычки всплывает над Сашей и уходит вверх. */
  cost(key: MsgKey, x: number, y: number) {
    const b = label(this.s, t(key), SKIN.acid, { size: 15, bold: true, padX: 7, padY: 3 }).box.setDepth(44).setPosition(x, y);
    this.s.tweens.add({ targets: b, y: y - px(46), duration: 1500, ease: 'Cubic.Out' });
    this.s.tweens.add({ targets: b, alpha: 0, delay: 1100, duration: 500, onComplete: () => b.destroy() });
  }

  step(dt: number, v: CoachView) {
    const door = v.world.door;
    // бирка покачивается над дверью: стрелка-хвостик смотрит на неё
    this.doorTag?.setPosition(door.x, door.y - door.displayHeight - px(4) + Math.round(Math.sin(this.s.time.now / 260) * px(3)));
    this.tip?.setPosition(v.x, GROUND_Y - px(118));
    this.sinceHint += dt;
    this.stuckMs = v.blocked ? this.stuckMs + dt : 0;
    const jumpPx = jumpHeight(PHYS.jumpVel * v.jumpFactor, PHYS.gravity);
    const gate = v.world.gates.find(g => !g.open && g.x > v.x && g.x - v.x <= AHEAD);
    const block = v.blocks.find(b => b.x > v.x && b.x - b.w / 2 - v.x <= AHEAD);
    const need = gate ? needFor(gate.kind, gate.h, jumpPx) : block ? 'jump' : null;
    const n = pickHint({ need: v.blocked ? need : null, stuckMs: this.stuckMs, revealed: v.revealed, peak: v.peak, sinceHintMs: this.sinceHint });
    if (n) this.hint(n);
  }

  private hint(n: Need) {
    this.sinceHint = 0;
    this.calling.add(n);
    callWeekAct(n, true);
    if (n === 'jump') { this.showTip(t(IS_TOUCH ? 'm_wk_intro_tap' : 'm_wk_intro_key')); return; }
    this.hud.think(IS_TOUCH ? t(HINT[n]) : `${t(HINT[n])} [${ACT_KEYS[n]}]`, 4200);
  }
  /** Подсказка управления — не мысль Саши, а горчичная плашка над ним. */
  private showTip(text: string) {
    this.dropTip();
    this.tip = label(this.s, text, SKIN.sun, { size: 17, bold: true, padX: 10, padY: 4 }).box.setDepth(43);
    this.s.tweens.add({ targets: this.tip, scale: { from: 1, to: 1.08 }, duration: 380, yoyo: true, repeat: -1 });
    const tip = this.tip;
    this.s.time.delayedCall(3200, () => { if (this.tip === tip) this.dropTip(); });
  }
  private dropTip() { this.tip?.destroy(); this.tip = null; }
}
