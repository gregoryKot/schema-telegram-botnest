import Phaser from 'phaser';
import { W, H, GROUND_Y, PHYS } from '../constants';
import { audio } from '../audio';
import { touch, IS_TOUCH } from '../controls';
import { track } from '../analytics';

// ════════════════════════════════════════════════════════════════════════════
//  ПРОЛОГ — знакомство с Йоськой и управлением. Три сценки, у каждой одна
//  «рабочая» реакция: дела → беги · переживания → замри · коллега → бей.
//  Неверная реакция не наказывает — даёт честный фидбэк репликой.
// ════════════════════════════════════════════════════════════════════════════

type Step = 'meet' | 'walk' | 'dash' | 'freeze' | 'fight' | 'done';

export class TutorialScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private narr!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private dim!: Phaser.GameObjects.Rectangle;
  private contHint!: Phaser.GameObjects.Text;
  private paused = false;
  private bubble!: Phaser.GameObjects.Text;
  private bubbleT = 0;
  private step: Step = 'meet';
  private t = 0;
  private said = new Set<string>();

  // walk
  private moved = 0; private jumped = false;
  // dash
  private pile: Phaser.GameObjects.Container | null = null;
  private dashed = false; private dashT = 0; private dashCd = 0; private dashDir = 1;
  // freeze
  private worries: Phaser.GameObjects.Image[] = [];
  private frozen = false; private calmT = 0; private orbit = 0;
  // fight
  private colleague: Phaser.GameObjects.Sprite | null = null;
  private colBubble: Phaser.GameObjects.Text | null = null;
  private attackT = 0; private attackCd = 0;
  private slash!: Phaser.GameObjects.Graphics;
  private calmRing!: Phaser.GameObjects.Graphics;
  private freezePulseT = 0;

  constructor() { super('Tutorial'); }

  create() {
    this.step = 'meet'; this.t = 0; this.said = new Set();
    this.moved = 0; this.jumped = false; this.pile = null; this.dashed = false;
    this.worries = []; this.calmT = 0; this.colleague = null; this.colBubble = null;

    // сцена-«прихожая»: тёплый полумрак, пятно света на котике
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x18142a, 0x18142a, 0x2e2440, 0x2e2440, 1, 1, 1, 1);
    bg.fillRect(0, 0, W, H);
    bg.fillStyle(0xffe9c0, 0.07); bg.fillEllipse(W / 2, GROUND_Y, 520, 250);
    bg.fillStyle(0x4a3c60, 1); bg.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    bg.fillStyle(0x6a5a80, 1); bg.fillRect(0, GROUND_Y, W, 4);

    const floor = this.add.rectangle(W / 2, GROUND_Y + 20, W, 40, 0, 0);
    this.physics.add.existing(floor, true);

    if (!this.anims.exists('p-idle'))
      this.anims.create({ key: 'p-idle', frames: this.anims.generateFrameNumbers('cat_idle', { start: 0, end: 11 }), frameRate: 8, repeat: -1 });
    if (!this.anims.exists('p-walk'))
      this.anims.create({ key: 'p-walk', frames: this.anims.generateFrameNumbers('cat_run', { start: 0, end: 5 }), frameRate: 16, repeat: -1 });

    this.player = this.physics.add.sprite(W / 2, GROUND_Y - 20, 'cat_idle').setOrigin(0.5, 1).setScale(1.5).setDepth(10);
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(22, 30).setOffset(13, 16);
    this.player.setCollideWorldBounds(true);
    this.player.play('p-idle');
    this.physics.add.collider(this.player, floor);

    this.slash = this.add.graphics().setDepth(11);
    this.calmRing = this.add.graphics().setDepth(8);
    this.paused = false;
    this.dim = this.add.rectangle(W / 2, H / 2, W, H, 0x06040e, 0).setDepth(48);
    this.contHint = this.add.text(W / 2, H - 96, IS_TOUCH ? 'тапни — дальше' : 'любая клавиша — дальше',
      { fontFamily: 'Courier New', fontSize: '12px', color: '#88ffcc' }).setOrigin(0.5).setDepth(50).setAlpha(0);
    this.narr = this.add.text(W / 2, 96, '', { fontFamily: 'Courier New', fontSize: '17px', color: '#fff0d8', align: 'center', lineSpacing: 8 })
      .setOrigin(0.5, 0).setDepth(50);
    this.prompt = this.add.text(W / 2, H - 64, '', { fontFamily: 'Courier New', fontSize: '14px', color: '#88ffcc', align: 'center' })
      .setOrigin(0.5).setDepth(50);
    this.bubble = this.add.text(0, 0, '', { fontFamily: 'Courier New', fontSize: '14px', color: '#fff0d8',
      backgroundColor: 'rgba(16,12,30,0.88)', padding: { x: 8, y: 5 } }).setOrigin(0.5, 1).setDepth(45).setAlpha(0);

    const skip = this.add.text(W - 20, 16, 'пропустить →', { fontFamily: 'Courier New', fontSize: '11px', color: '#6a5f8a' })
      .setOrigin(1, 0).setDepth(60).setInteractive({ useHandCursor: true });
    skip.on('pointerover', () => skip.setColor('#fff0d8'));
    skip.on('pointerout', () => skip.setColor('#6a5f8a'));
    skip.on('pointerdown', () => { track('tutorial_skip'); this.scene.start('Game', { chapter: 'chapter1' }); });

    this.input.keyboard!.resetKeys(); // залипшие клавиши после смены сцены/alt-tab
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = {
      A: this.input.keyboard!.addKey('A'), D: this.input.keyboard!.addKey('D'),
      W: this.input.keyboard!.addKey('W'), J: this.input.keyboard!.addKey('J'),
      K: this.input.keyboard!.addKey('K'), E: this.input.keyboard!.addKey('E'),
      SHIFT: this.input.keyboard!.addKey('SHIFT'),
      X: this.input.keyboard!.addKey('X'), C: this.input.keyboard!.addKey('C'),
      Z: this.input.keyboard!.addKey('Z'),
    };
    const begin = () => { audio.ensure(); audio.startMusic(); };
    this.input.keyboard!.once('keydown', begin);
    this.input.once('pointerdown', begin);

    this.meet();
  }

  // ── Знакомство ──────────────────────────────────────────────────────────────
  private meet() {
    this.narrTell(
      'Это Йоська. Обычный кот.\nЖивёт обычной жизнью. Всем доволен.\n\n' +
      '...правда, почти все силы уходят на борьбу.\nС чем? Да вроде бы и ни с чем.',
      () => {
        this.step = 'walk';
        this.narr.setText('У Йоськи на любую беду — три способа:\nБЕЙ. ЗАМРИ. БЕГИ.\nСейчас попробуем все.');
        this.prompt.setText(IS_TOUCH ? '◀ ▶ — идти      ▲ — прыгнуть' : '← → / A D — идти      ↑ / W / ПРОБЕЛ — прыгнуть');
      });
  }

  // Стоп-кадр для текста: мир замирает и темнеет, читаешь спокойно,
  // дальше — по тапу/клавише. Иначе внимание на коте и текст теряется.
  private narrTell(text: string, onContinue: () => void) {
    this.paused = true;
    this.physics.pause();
    this.player.anims.pause();
    this.narr.setText(text);
    this.prompt.setText('');
    this.tweens.add({ targets: this.dim, fillAlpha: 0.55, duration: 350 });
    this.tweens.add({ targets: this.contHint, alpha: 0.9, duration: 400, delay: 600 });
    const go = () => {
      this.input.keyboard!.off('keydown', go);
      this.paused = false;
      this.physics.resume();
      this.player.anims.resume();
      this.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 250 });
      this.contHint.setAlpha(0);
      onContinue();
    };
    // небольшая задержка, чтобы случайный зажатый input не проскочил текст
    this.time.delayedCall(700, () => {
      if (!this.paused) return;
      this.input.keyboard!.once('keydown', go);
      this.input.once('pointerdown', go);
    });
  }

  update(_: number, dt: number) {
    this.t += dt;
    if (this.paused) { this.updateBubble(dt); return; }
    this.updateMoves(dt);
    this.updateBubble(dt);
    switch (this.step) {
      case 'walk':   this.checkWalk(); break;
      case 'dash':   this.updatePile(dt); break;
      case 'freeze': this.updateWorries(dt); break;
      case 'fight':  this.updateColleague(dt); break;
      case 'done':   if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.scene.start('Game', { chapter: 'chapter1' }); break;
    }
  }

  // ── Управление (упрощённый дубль движка) ────────────────────────────────────
  private updateMoves(dt: number) {
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = b.blocked.down;
    const left = this.cursors.left.isDown || this.keys.A.isDown || touch.left;
    const right = this.cursors.right.isDown || this.keys.D.isDown || touch.right;
    const jump = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.cursors.space)
              || Phaser.Input.Keyboard.JustDown(this.keys.W) || touch.consume('jump');
    const dash = Phaser.Input.Keyboard.JustDown(this.keys.SHIFT) || Phaser.Input.Keyboard.JustDown(this.keys.Z) || touch.consume('dash');
    const hit = Phaser.Input.Keyboard.JustDown(this.keys.J) || Phaser.Input.Keyboard.JustDown(this.keys.X) || touch.consume('hit');
    const freezeHeld = this.keys.K.isDown || this.keys.C.isDown || this.cursors.down.isDown || touch.freeze;
    this.frozen = freezeHeld && onGround && this.dashT <= 0;

    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.attackCd > 0) this.attackCd -= dt;

    if (dash && this.dashCd <= 0 && !this.frozen) {
      this.dashT = 170; this.dashCd = 480;
      this.dashDir = left && !right ? -1 : right ? 1 : this.player.flipX ? -1 : 1;
      audio.dash();
      this.onDash();
    }
    if (this.dashT > 0) {
      this.calmRing.clear();
      this.dashT -= dt; b.setVelocityX(this.dashDir * 560);
      const g = this.add.image(this.player.x, this.player.y, this.player.texture.key, this.player.frame.name)
        .setOrigin(0.5, 1).setScale(1.5).setFlipX(this.player.flipX).setTint(0x9fd0ff).setAlpha(0.5).setDepth(9);
      this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
    } else if (this.frozen) {
      b.setVelocityX(0);
      this.player.setScale(1.65, 1.35).play('p-idle', true);
      this.freezePulseT += dt;
      this.calmRing.clear();
      const r = 30 + Math.sin(this.freezePulseT * 0.006) * 14;
      this.calmRing.lineStyle(2, 0x88ccff, 0.4);
      this.calmRing.strokeCircle(this.player.x, this.player.y - 22, r);
      this.calmRing.lineStyle(1, 0x88ccff, 0.2);
      this.calmRing.strokeCircle(this.player.x, this.player.y - 22, r + 14);
    } else {
      this.calmRing.clear();
      this.player.setScale(1.5, 1.5);
      if (right) { b.setVelocityX(250); this.player.setFlipX(false); this.moved += dt; }
      else if (left) { b.setVelocityX(-250); this.player.setFlipX(true); this.moved += dt; }
      else b.setVelocityX(b.velocity.x * 0.7);
      if (jump && onGround) { b.setVelocityY(PHYS.jumpVel); audio.jump(); this.jumped = true; }
      if (onGround && Math.abs(b.velocity.x) > 20) this.player.play('p-walk', true);
      else if (onGround) this.player.play('p-idle', true);
    }

    this.slash.clear();
    if (hit && this.attackCd <= 0 && !this.frozen) { this.attackT = 170; this.attackCd = 300; this.onHit(); }
    if (this.attackT > 0) {
      this.attackT -= dt;
      const dir = this.player.flipX ? -1 : 1;
      const prog = 1 - this.attackT / 170;
      this.slash.lineStyle(5, 0xfff0d8, 1 - prog * 0.8);
      this.slash.beginPath();
      this.slash.arc(this.player.x + dir * 34, this.player.y - 22, 28, (-0.8 + prog * 1.4) * dir, (0.8 + prog * 1.4) * dir, dir < 0);
      this.slash.strokePath();
    }
  }

  // ── Шаг 1: походить-попрыгать ───────────────────────────────────────────────
  private checkWalk() {
    if (this.moved > 900 && this.jumped) {
      this.step = 'dash';
      this.narrTell('Понедельник. На Йоську едет\nкуча несделанных дел.', () => {
        this.prompt.setText(IS_TOUCH ? 'РЫВОК — любимый способ Йоськи: быть где-то ещё' : 'SHIFT / Z — рывок. любимый способ Йоськи: быть где-то ещё');
        this.spawnPile();
      });
    }
  }

  // ── Шаг 2: БЕГИ — куча дел, от которой можно только увернуться ─────────────
  private spawnPile() {
    const c = this.add.container(-80, GROUND_Y).setDepth(8);
    const g = this.add.graphics();
    g.fillStyle(0x4a4458, 1);
    g.fillRect(-46, -34, 92, 34);
    g.fillRect(-34, -62, 68, 28);
    g.fillRect(-22, -84, 44, 22);
    g.fillStyle(0x6a6480, 1);
    g.fillRect(-46, -34, 92, 4); g.fillRect(-34, -62, 68, 4); g.fillRect(-22, -84, 44, 4);
    g.fillStyle(0xfff0d8, 0.7);
    g.fillRect(-38, -28, 18, 2); g.fillRect(-26, -54, 18, 2); g.fillRect(-14, -78, 16, 2);
    c.add(g);
    const lbl = this.add.text(0, -96, 'ДЕЛА', { fontFamily: 'Courier New', fontSize: '11px', color: '#9a90b8' }).setOrigin(0.5, 1);
    c.add(lbl);
    this.pile = c;
  }

  private updatePile(dt: number) {
    const p = this.pile; if (!p) return;
    const d = this.player.x - p.x;
    p.x += Math.sign(d) * dt * 0.07; // ползёт к Йоське — мимо не проедет
    p.y = GROUND_Y + Math.sin(this.t * 0.01) * 2;
    if (Math.abs(d) < 70 && this.dashT <= 0) {
      // дела «наезжают» — мягко толкают; рывок — единственный чистый выход
      (this.player.body as Phaser.Physics.Arcade.Body).velocity.x += dt * 0.5 * Math.sign(d || 1);
      this.sayOnce('pile_push', 'ну вот, уже наседают...', 2200);
    }
    if (this.frozen && Math.abs(d) < 160) this.sayOnce('pile_frz', 'замереть? дела сами себя не сделают.', 2600);
  }
  private onDash() {
    if (this.step !== 'dash' || this.dashed || !this.pile) return;
    if (Math.abs(this.player.x - this.pile.x) > 280) { this.sayOnce('dash_far', 'рывок! ...но дела были не там.', 2200); return; }
    this.dashed = true;
    const p = this.pile; this.pile = null;
    this.tweens.add({ targets: p, alpha: 0, y: p.y + 40, duration: 700, onComplete: () => p.destroy() });
    this.say('...фух. пронесло. (нет)', 2600);
    this.time.delayedCall(1500, () => this.beginFreeze());
  }

  // ── Шаг 3: ЗАМРИ — переживания, которые нельзя ни убить, ни обогнать ───────
  private beginFreeze() {
    if (this.step !== 'dash') return;
    this.step = 'freeze';
    this.narrTell('Ночь. Завтра важный день.\nВ голову лезут переживания.', () => {
      this.prompt.setText(IS_TOUCH ? 'ЗАМРИ (удерживай) — переждать' : 'K / C / ↓ (удерживай) — замереть и переждать');
      for (let i = 0; i < 3; i++) this.worries.push(this.add.image(this.player.x, this.player.y - 60, 'anxmob').setDepth(7).setScale(0.8));
      audio.anx();
    });
  }

  private updateWorries(dt: number) {
    this.orbit += dt * 0.0022;
    this.worries.forEach((w, i) => {
      if (!w.active) return;
      const a = this.orbit + (i / this.worries.length) * Math.PI * 2;
      const r = this.frozen ? 120 : 64; // замер — они отступают
      w.x += (this.player.x + Math.cos(a) * r - w.x) * 0.06;
      w.y += (this.player.y - 40 + Math.sin(a) * r * 0.55 - w.y) * 0.06;
    });
    if (this.frozen) {
      this.calmT += dt;
      this.worries.forEach(w => w.setAlpha(Math.max(0.15, 1 - this.calmT / 1900)));
      if (this.calmT > 2000 && this.worries.some(w => w.active)) {
        this.worries.forEach(w => { this.tweens.add({ targets: w, alpha: 0, scale: 0, duration: 400, onComplete: () => w.destroy() }); });
        this.say('выдохнул — и они растаяли.', 2600);
        audio.freeze();
        this.time.delayedCall(1600, () => this.beginFight());
      }
    } else this.calmT = Math.max(0, this.calmT - dt * 2);
    // движение не спасает
    if (!this.frozen && Math.abs((this.player.body as Phaser.Physics.Arcade.Body).velocity.x) > 200)
      this.sayOnce('worry_run', 'от своей головы не убежишь...', 2600);
  }

  // ── Шаг 4: БЕЙ — коллега, которому можно только рявкнуть «нет» ─────────────
  private beginFight() {
    if (this.step !== 'freeze') return;
    this.step = 'fight';
    this.narrTell('Утро. Коллега «по-дружески» просит\nсделать его работу. Снова. Бесплатно.', () => {
      this.prompt.setText(IS_TOUCH ? 'БЕЙ — рявкнуть. Йоська это не любит. но иначе сядут на шею' : 'J / X — рявкнуть. Йоська это не любит. но иначе сядут на шею');
      this.colleague = this.add.sprite(W - 80, GROUND_Y, 'cat_idle').setOrigin(0.5, 1).setScale(1.5)
        .setTint(0xc8a060).setFlipX(true).setDepth(8).play('p-walk');
      this.colBubble = this.add.text(0, 0, 'ну ты же можешь!', { fontFamily: 'Courier New', fontSize: '13px', color: '#1a1020',
        backgroundColor: '#e8c890', padding: { x: 7, y: 4 } }).setOrigin(0.5, 1).setDepth(45);
    });
  }

  private updateColleague(dt: number) {
    const c = this.colleague; if (!c || !c.active) return;
    const d = this.player.x - c.x;
    if (Math.abs(d) > 70) { c.x += Math.sign(d) * dt * 0.12; c.play('p-walk', true); }
    else c.play('p-idle', true);
    c.setFlipX(d < 0);
    if (this.colBubble?.active) {
      this.colBubble.x = c.x; this.colBubble.y = c.y - 56;
      const phrases = ['ну ты же можешь!', 'тебе же не сложно?', 'я бы для тебя сделал!'];
      this.colBubble.setText(phrases[Math.floor(this.t / 2600) % phrases.length]);
    }
    if (this.frozen && Math.abs(d) < 140) this.sayOnce('col_frz', 'замер... а он всё ещё тут. и ждёт.', 2600);
    if (this.dashT > 0 && Math.abs(d) < 200) this.sayOnce('col_dash', 'убежал... он уже написал в чат. дважды.', 2800);
  }

  private onHit() {
    if (this.step !== 'fight' || !this.colleague?.active) return;
    const dir = this.player.flipX ? -1 : 1;
    const dx = this.colleague.x - this.player.x;
    if (dx * dir < -12 || Math.abs(dx) > 80) return;
    audio.hit();
    this.cameras.main.shake(80, 0.005);
    const c = this.colleague; this.colleague = null;
    this.colBubble?.destroy();
    const no = this.add.text(this.player.x + dir * 50, this.player.y - 70, 'НЕТ.', { fontFamily: 'Courier New', fontSize: '22px', color: '#ff8866', fontStyle: 'bold' }).setOrigin(0.5).setDepth(46);
    this.tweens.add({ targets: no, y: no.y - 26, alpha: 0, duration: 1300, onComplete: () => no.destroy() });
    this.tweens.add({ targets: c, x: c.x + dir * 240, alpha: 0, duration: 700, onComplete: () => c.destroy() });
    this.say('...неприятно. но по-другому он не слышит.', 3000);
    this.time.delayedCall(2200, () => this.finish());
  }

  private finish() {
    this.step = 'done';
    track('tutorial_done');
    this.narr.setText('БЕЙ. ЗАМРИ. БЕГИ.\nТри способа на все случаи жизни.\n\n...должно же хватать. да?');
    this.prompt.setText(IS_TOUCH ? 'тапни — начать обычный день' : 'E / клик — начать обычный день');
    this.input.once('pointerdown', () => this.scene.start('Game', { chapter: 'chapter1' }));
  }

  // ── Реплики ────────────────────────────────────────────────────────────────
  private say(text: string, dur: number) { this.bubble.setText(text).setAlpha(1); this.bubbleT = dur; }
  private sayOnce(key: string, text: string, dur: number) { if (this.said.has(key)) return; this.said.add(key); this.say(text, dur); }
  private updateBubble(dt: number) {
    if (this.bubbleT <= 0) return;
    this.bubble.x = this.player.x; this.bubble.y = this.player.y - 52;
    this.bubbleT -= dt;
    if (this.bubbleT < 300) this.bubble.setAlpha(Math.max(0, this.bubbleT / 300));
  }
}
