import Phaser from 'phaser';
import { GROUND_Y } from './constants';
import { t, type MsgKey } from './i18n';
import { IS_TOUCH } from './controls';
import type { DoorKind } from './chapters';

// ════════════════════════════════════════════════════════════════════════════
//  Двери Акта II. Дверь — не враг, а ВЫБОР: войти можно в любую (E / тап),
//  разница — в последствиях. Неверные двери после попытки запираются
//  («уже пробовал»). Вся драма главы — здесь, не в боях.
// ════════════════════════════════════════════════════════════════════════════

const FONT = '"Press Start 2P", "Courier New", monospace';

interface DoorStyle {
  w: number; h: number; leaf: number; frame: number; glow: number;
  label: MsgKey; labelColor: string; sub?: MsgKey;
}

const STYLE: Record<DoorKind, DoorStyle> = {
  home: { w: 76, h: 118, leaf: 0x4a3424, frame: 0x6a4a32, glow: 0xffd9a0,
    label: 'm_door_home', labelColor: '#ffd9a0' },
  guru: { w: 86, h: 134, leaf: 0x2a0a3a, frame: 0xff2fd6, glow: 0xff2fd6,
    label: 'm_door_guru', labelColor: '#ff8af0', sub: 'm_door_guru_sub' },
  therapist: { w: 72, h: 112, leaf: 0x1e2a24, frame: 0x4a6a5a, glow: 0x88ffcc,
    label: 'm_door_therapist', labelColor: '#a8e8d0' },
};

export class Door {
  taken = false;
  locked = false;
  private isNear = false;
  private label: Phaser.GameObjects.Text;
  private glow: Phaser.GameObjects.Ellipse;
  private prompt: Phaser.GameObjects.Text;
  private leaf: Phaser.GameObjects.Rectangle;

  constructor(
    private scene: Phaser.Scene, readonly kind: DoorKind, readonly x: number,
    private onEnter: (d: Door) => void, private onLockedTry: () => void,
  ) {
    const st = STYLE[kind];
    const g = scene.add.graphics().setDepth(5);
    // рама + полотно + ручка
    g.fillStyle(st.frame, 1); g.fillRect(x - st.w / 2 - 6, GROUND_Y - st.h - 6, st.w + 12, st.h + 6);
    this.leaf = scene.add.rectangle(x, GROUND_Y - st.h / 2, st.w, st.h, st.leaf).setDepth(5)
      .setInteractive({ useHandCursor: true });
    scene.add.circle(x + st.w / 2 - 12, GROUND_Y - st.h / 2, 4, st.glow, 0.9).setDepth(6);
    // тёплый свет из-под двери и вывеска
    this.glow = scene.add.ellipse(x, GROUND_Y - 2, st.w + 60, 16, st.glow, 0.14).setDepth(4);
    scene.tweens.add({ targets: this.glow, alpha: { from: 0.7, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
    this.label = scene.add.text(x, GROUND_Y - st.h - 18, t(st.label), {
      fontFamily: FONT, fontSize: '10px', color: st.labelColor, align: 'center',
    }).setOrigin(0.5, 1).setDepth(6);
    if (st.sub) {
      const sub = scene.add.text(x, GROUND_Y - st.h - 6, t(st.sub), {
        fontFamily: FONT, fontSize: '7px', color: st.labelColor, align: 'center',
      }).setOrigin(0.5, 1).setDepth(6).setAlpha(0.9);
      // неон «Гуру-Экспресс» мигает — кричащая реклама
      scene.tweens.add({ targets: [this.label, sub], alpha: { from: 1, to: 0.35 }, duration: 420, yoyo: true, repeat: -1 });
    }
    this.prompt = scene.add.text(x, GROUND_Y - st.h - 44, t(IS_TOUCH ? 'm_tap_door_enter' : 'm_e_door_enter'), {
      fontFamily: FONT, fontSize: '9px', color: '#fff0d8',
      backgroundColor: 'rgba(10,8,20,0.72)', padding: { x: 5, y: 4 },
    }).setOrigin(0.5, 1).setDepth(9).setAlpha(0);
    this.leaf.on('pointerdown', () => { if (this.isNear) this.tryEnter(); });
  }

  near(playerX: number) { return Math.abs(playerX - this.x) < 72; }

  update(_dt: number, playerX: number) {
    this.isNear = this.near(playerX);
    const show = this.isNear && !this.taken && !this.locked;
    this.prompt.setAlpha(Phaser.Math.Linear(this.prompt.alpha, show ? 0.95 : 0, 0.12));
  }

  lock() {
    this.locked = true;
    this.leaf.setFillStyle(0x1a141e); this.glow.setAlpha(0.25);
    this.label.setAlpha(0.4);
    this.scene.add.text(this.x, GROUND_Y - 54, t('m_door_tried_short'), {
      fontFamily: FONT, fontSize: '8px', color: '#7f74a4', align: 'center',
    }).setOrigin(0.5).setDepth(6).setAngle(-8);
  }

  tryEnter() {
    if (this.taken) return;
    if (this.locked) { this.onLockedTry(); return; }
    this.taken = true;
    this.onEnter(this);
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Голос-отговорка: пузырь мысли у двери. Ему можно ОТВЕТИТЬ (E / тап по
//  пузырю) — Мистер отвечает словами терапевта, голос стихает. Это и есть
//  «жизнь без копингов»: с отговоркой не дерутся — ей отвечают.
// ════════════════════════════════════════════════════════════════════════════

export class ExcuseVoice {
  answered = false;
  private bubble: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private li = 0;
  private cycleT = 9e9; // первая реплика — сразу при подходе

  constructor(
    scene: Phaser.Scene, private x: number, y: number,
    private lines: MsgKey[], readonly answer: MsgKey,
    private onAnswer: (v: ExcuseVoice) => void,
  ) {
    this.bubble = scene.add.text(x, y, '', {
      fontFamily: FONT, fontSize: '9px', color: '#bfe0ff', align: 'center',
      backgroundColor: 'rgba(14,10,26,0.8)', padding: { x: 7, y: 6 },
    }).setOrigin(0.5, 1).setDepth(46).setAlpha(0).setInteractive({ useHandCursor: true });
    this.hint = scene.add.text(x, y + 14, t(IS_TOUCH ? 'm_tap_answer' : 'm_e_answer'), {
      fontFamily: FONT, fontSize: '7px', color: '#88ffcc',
    }).setOrigin(0.5, 0).setDepth(46).setAlpha(0);
    this.bubble.on('pointerdown', () => this.doAnswer());
  }

  near(playerX: number) { return Math.abs(playerX - this.x) < 130; }

  update(dt: number, playerX: number) {
    if (this.answered) return;
    const seen = Math.abs(playerX - this.x) < 300;
    this.cycleT += dt;
    if (seen && this.cycleT > 4200) {
      this.cycleT = 0;
      this.bubble.setText(t(this.lines[this.li++ % this.lines.length])).setScale(0.85);
      this.bubble.setInteractive(); // hit-area создаётся по ПУСТОМУ тексту — пересоздаём под реальный размер
      this.bubble.scene.tweens.add({ targets: this.bubble, scale: 1, duration: 240, ease: 'Back.Out' });
    }
    this.bubble.setAlpha(Phaser.Math.Linear(this.bubble.alpha, seen ? 0.95 : 0, 0.1));
    this.hint.setAlpha(Phaser.Math.Linear(this.hint.alpha, this.near(playerX) ? 0.9 : 0, 0.1));
  }

  doAnswer() {
    if (this.answered) return;
    this.answered = true;
    const s = this.bubble.scene;
    s.tweens.add({ targets: [this.bubble, this.hint], alpha: 0, y: '-=14', duration: 480,
      onComplete: () => { this.bubble.destroy(); this.hint.destroy(); } });
    this.onAnswer(this);
  }
}
