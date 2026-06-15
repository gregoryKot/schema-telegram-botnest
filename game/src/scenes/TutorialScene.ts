import Phaser from 'phaser';
import { W, H, GROUND_Y, PHYS } from '../constants';
import { audio } from '../audio';
import { touch, IS_TOUCH, setTouchControls } from '../controls';
import { track } from '../analytics';

// ════════════════════════════════════════════════════════════════════════════
//  ПРОЛОГ — знакомство с Мистером и управлением. Четыре сценки, у каждой одна
//  «рабочая» реакция: дела → беги · переживания → отвлекись · коллега → бей · соседка → уступи.
//  Неверная реакция не наказывает — даёт честный фидбэк репликой.
// ════════════════════════════════════════════════════════════════════════════

type Step = 'meet' | 'walk' | 'dash' | 'freeze' | 'fight' | 'fawn' | 'done';

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
  private narrContinue: (() => void) | null = null; // листать текст по тач-кнопке

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
  private playSprite!: Phaser.GameObjects.Sprite;
  private sleepSprite!: Phaser.GameObjects.Sprite;
  // fawn (сценка «уступи»)
  private neighbor: Phaser.GameObjects.Sprite | null = null;
  private neiBubble: Phaser.GameObjects.Text | null = null;
  // обстановка под сценку (офис, спальня, дверь)
  private sceneDecor: Phaser.GameObjects.Container | null = null;

  constructor() { super('Tutorial'); }

  create() {
    setTouchControls(true); // геймплей — тач-кнопки нужны
    this.step = 'meet'; this.t = 0; this.said = new Set();
    this.moved = 0; this.jumped = false; this.pile = null; this.dashed = false;
    this.worries = []; this.calmT = 0; this.colleague = null; this.colBubble = null;
    this.neighbor = null; this.neiBubble = null;

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
    // Необязательные спрайты (cat_play/cat_sleep/dog/nei) грузятся отдельными
    // запросами и могут не доехать по сети. Анимацию создаём ТОЛЬКО если текстура
    // реально загрузилась — иначе .play() по пустой анимации роняет update-цикл
    // и игра «зависает» (так вешалось ОТВЛЕКИСЬ без клубка).
    this.safeAnim('p-play', 'cat_play', 0, 5, 7, -1);
    this.playSprite = this.add.sprite(0, 0, 'cat_play', 0).setOrigin(0.5, 1).setScale(0.24).setDepth(10).setVisible(false);
    this.safeAnim('p-sleep', 'cat_sleep', 0, 5, 6, 0);
    this.safeAnim('dog-idle', 'dog_idle', 0, 3, 6, -1);
    this.safeAnim('dog-walk', 'dog_walk', 0, 5, 12, -1);
    this.safeAnim('nei-idle', 'nei_idle', 0, 3, 6, -1);
    this.sleepSprite = this.add.sprite(0, 0, 'cat_sleep', 0).setOrigin(0.5, 1).setScale(0.3).setDepth(10).setVisible(false);
    this.paused = false;
    this.dim = this.add.rectangle(W / 2, H / 2, W, H, 0x06040e, 0).setDepth(48);
    this.contHint = this.add.text(W / 2, IS_TOUCH ? H - 210 : H - 100, IS_TOUCH ? 'тапни — дальше' : 'любая клавиша — дальше',
      { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '9px', color: '#88ffcc',
        backgroundColor: 'rgba(8,6,18,0.7)', padding: { x: 8, y: 5 } }).setOrigin(0.5).setDepth(50).setAlpha(0);
    this.narr = this.add.text(W / 2, 104, '', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '13px', color: '#fff0d8', align: 'center', lineSpacing: 14, wordWrap: { width: W - 90 },
      backgroundColor: 'rgba(8,6,18,0.82)', padding: { x: 16, y: 12 } })
      .setOrigin(0.5, 0).setDepth(50);
    this.prompt = this.add.text(W / 2, IS_TOUCH ? H - 250 : H - 56, '', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '11px', color: '#88ffcc', align: 'center', wordWrap: { width: W - 80 },
      backgroundColor: 'rgba(8,6,18,0.82)', padding: { x: 12, y: 8 } })
      .setOrigin(0.5).setDepth(50);
    this.bubble = this.add.text(0, 0, '', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '10px', color: '#fff0d8',
      backgroundColor: 'rgba(16,12,30,0.88)', padding: { x: 8, y: 5 } }).setOrigin(0.5, 1).setDepth(45).setAlpha(0);

    const skip = this.add.text(W - 20, 16, 'пропустить →', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '9px', color: '#6a5f8a' })
      .setOrigin(1, 0).setDepth(60).setInteractive({ useHandCursor: true });
    skip.on('pointerover', () => skip.setColor('#fff0d8'));
    skip.on('pointerout', () => skip.setColor('#6a5f8a'));
    skip.on('pointerdown', () => { track('tutorial_skip'); this.scene.start('Game', { chapter: 'chapter1' }); });

    this.input.keyboard!.resetKeys(); // залипшие клавиши после смены сцены/alt-tab
    this.cursors = this.input.keyboard!.createCursorKeys();
    // одна схема: движение — стрелки/WASD, действия — Z X C V
    this.keys = {
      A: this.input.keyboard!.addKey('A'), D: this.input.keyboard!.addKey('D'),
      W: this.input.keyboard!.addKey('W'), E: this.input.keyboard!.addKey('E'),
      X: this.input.keyboard!.addKey('X'), C: this.input.keyboard!.addKey('C'),
      Z: this.input.keyboard!.addKey('Z'), V: this.input.keyboard!.addKey('V'),
    };
    const begin = () => { audio.ensure(); audio.startMusic(); };
    this.input.keyboard!.once('keydown', begin);
    this.input.once('pointerdown', begin);

    this.meet();
  }

  // Создать анимацию только если её спрайт-лист реально загрузился.
  private safeAnim(key: string, sheet: string, start: number, end: number, frameRate: number, repeat: number) {
    if (this.anims.exists(key) || !this.textures.exists(sheet)) return;
    this.anims.create({ key, frames: this.anims.generateFrameNumbers(sheet, { start, end }), frameRate, repeat });
  }

  // ── Знакомство ──────────────────────────────────────────────────────────────
  private meet() {
    this.narrTell(
      'Это кот Мистер.\nЖивёт, всем доволен.\n\nТолько вечно с чем-то борется.',
      () => {
        this.step = 'walk';
        this.narr.setText('3 способа справляться:\nБЕЙ · ИЗБЕГАЙ · УСТУПИ');
        this.prompt.setText(IS_TOUCH ? '◀ ▶ идти · ▲ прыжок' : 'A D идти · W прыжок');
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
      if (!this.paused) return;
      this.input.keyboard!.off('keydown', go);
      this.narrContinue = null;
      this.paused = false;
      this.physics.resume();
      this.player.anims.resume();
      this.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 250 });
      this.tweens.killTweensOf(this.contHint); // иначе отложенный твин показа перебьёт сброс альфы
      this.contHint.setAlpha(0);
      this.narr.setText(''); // иначе нарезка висит поверх геймплея и наезжает на подсказку
      onContinue();
    };
    // небольшая задержка, чтобы случайный зажатый input не проскочил текст
    this.time.delayedCall(700, () => {
      if (!this.paused) return;
      this.input.keyboard!.once('keydown', go);
      this.input.once('pointerdown', go);
      this.narrContinue = go; // тап по тач-кнопке (HTML вне канваса) тоже листает
    });
  }

  update(_: number, dt: number) {
    this.t += dt;
    // пустую строку не показываем — иначе подложка рисует пустую плашку
    this.narr.setVisible(this.narr.text.length > 0);
    this.prompt.setVisible(this.prompt.text.length > 0);
    if (this.paused) {
      // Тач-кнопки — HTML вне канваса, их тап не доходит до Phaser-инпута. Без
      // этого на экране-подсказке нажатие кнопки действия (напр. УСТУПИ) не
      // листало текст — казалось, что кнопка «не работает».
      if (this.narrContinue && (touch.consume('jump') || touch.consume('hit') || touch.consume('avoid') || touch.consume('fawn')))
        this.narrContinue();
      this.updateBubble(dt);
      return;
    }
    this.updateMoves(dt);
    this.updateBubble(dt);
    switch (this.step) {
      case 'walk':   this.checkWalk(); break;
      case 'dash':   this.updatePile(dt); break;
      case 'freeze': this.updateWorries(dt); break;
      case 'fight':  this.updateColleague(dt); break;
      case 'fawn':   this.updateNeighbor(); break;
      case 'done':   if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.scene.start('Intro'); break;
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
    const hit = Phaser.Input.Keyboard.JustDown(this.keys.X) || touch.consume('hit');
    const fawn = Phaser.Input.Keyboard.JustDown(this.keys.V) || touch.consume('fawn');
    // ИЗБЕГАНИЕ — одна кнопка: тап = рывок, удержание = залипнуть
    const dash = Phaser.Input.Keyboard.JustDown(this.keys.Z) || touch.consume('avoid');
    const avoidHeld = this.keys.Z.isDown || touch.avoidHeld;
    // на кадре нажатия — это рывок, не залипание (иначе frozen гасит рывок)
    this.frozen = avoidHeld && !dash && onGround && this.dashT <= 0;
    if (fawn) this.onFawn();

    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.attackCd > 0) this.attackCd -= dt;

    if (dash && this.dashCd <= 0 && !this.frozen) {
      this.dashT = 170; this.dashCd = 480;
      this.dashDir = left && !right ? -1 : right ? 1 : this.player.flipX ? -1 : 1;
      audio.dash();
      this.onDash();
    }
    if (this.dashT > 0) {
      if (this.playSprite.visible) { this.playSprite.setVisible(false); this.player.setVisible(true); }
      this.dashT -= dt; b.setVelocityX(this.dashDir * 560);
      const g = this.add.image(this.player.x, this.player.y, this.player.texture.key, this.player.frame.name)
        .setOrigin(0.5, 1).setScale(1.5).setFlipX(this.player.flipX).setTint(0x9fd0ff).setAlpha(0.5).setDepth(9);
      this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
    } else if (this.frozen) {
      b.setVelocityX(0);
      this.player.setScale(1.5, 1.5);
      // Мистер играет с клубком. Спрайт грузится в фоне — создаём анимацию при
      // первом использовании. Если ещё не доехал — просто стоим (idle).
      this.safeAnim('p-play', 'cat_play', 0, 5, 7, -1);
      if (this.anims.exists('p-play')) {
        if (!this.playSprite.visible) { this.playSprite.setVisible(true).play('p-play'); this.player.setVisible(false); }
        this.playSprite.setPosition(this.player.x, this.player.y).setFlipX(this.player.flipX);
      } else {
        this.player.play('p-idle', true);
      }
    } else {
      if (this.playSprite.visible) { this.playSprite.setVisible(false); this.player.setVisible(true); }
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
      // выпад с выгнутой спиной + три следа когтей
      this.player.setScale(1.5 + 0.25 * Math.sin(prog * Math.PI), 1.5 - 0.2 * Math.sin(prog * Math.PI));
      const cx = this.player.x + dir * 30, cy = this.player.y - 34;
      const len = 34 * Math.min(1, prog * 1.6);
      const a = 1 - Math.max(0, prog - 0.45) * 1.8;
      for (let i = 0; i < 3; i++) {
        const ox = i * 7 * dir, oy = i * 9 - 6;
        this.slash.lineStyle(3, i === 1 ? 0xff4455 : 0xd92b3d, Math.max(0, a));
        this.slash.lineBetween(cx + ox, cy + oy, cx + ox + len * dir, cy + oy + len * 0.55);
      }
    }
  }

  // Снести объекты предыдущей сценки — страховка от наслоения («всё сразу»)
  private clearBeat() {
    this.pile?.destroy(); this.pile = null;
    this.worries.forEach(w => w.destroy()); this.worries = [];
    this.colleague?.destroy(); this.colleague = null; this.colBubble?.destroy(); this.colBubble = null;
    this.neighbor?.destroy(); this.neighbor = null; this.neiBubble?.destroy(); this.neiBubble = null;
    this.sceneDecor?.destroy(); this.sceneDecor = null;
    if (this.playSprite.visible) { this.playSprite.setVisible(false); this.player.setVisible(true); }
  }

  // Обстановка под сценку: офис / спальня-ночь / спальня-утро / дверь
  private setScene(kind: 'office' | 'night' | 'morning' | 'door') {
    this.sceneDecor?.destroy();
    const c = this.add.container(0, 0).setDepth(2);
    this.sceneDecor = c;
    const G = GROUND_Y;
    const g = this.add.graphics(); c.add(g);
    const rect = (x: number, y: number, w: number, h: number, col: number, a = 1) => { g.fillStyle(col, a); g.fillRect(x, y, w, h); };
    const label = (x: number, t: string) => { const tx = this.add.text(x, G - 8, t, { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '8px', color: '#6a5f8a' }).setOrigin(0.5, 1); c.add(tx); };

    if (kind === 'office') {
      rect(W * 0.5, G - 230, W * 0.5, 150, 0x3a4a7a, 0.5);            // окно-день
      rect(W * 0.5, G - 230, W * 0.5, 8, 0x5a6a9a, 0.6);
      rect(60, G - 70, 150, 12, 0x4a3a2e);                            // стол
      rect(70, G - 58, 10, 58, 0x3a2c22); rect(190, G - 58, 10, 58, 0x3a2c22);
      rect(95, G - 116, 64, 46, 0x14101c); rect(101, G - 110, 52, 34, 0x3a5a8a, 0.8); // монитор
      rect(120, G - 70, 14, 14, 0x2a2030);                            // стопка бумаг под монитором
      label(135, 'ОФИС');
    } else if (kind === 'night' || kind === 'morning') {
      const warm = kind === 'morning';
      rect(W * 0.34, G - 250, 150, 170, warm ? 0x6a4a2a : 0x10182e, 0.7); // окно
      g.fillStyle(warm ? 0xffd070 : 0xeaeaff, warm ? 0.5 : 0.9);
      g.fillCircle(W * 0.34 + 110, G - 210, warm ? 22 : 16);             // солнце / луна
      rect(W * 0.34, G - 80, 158, 8, 0x4a4060);                          // подоконник
      // кровать слева
      rect(60, G - 46, 190, 46, 0x4a3a5a);                              // матрас
      rect(60, G - 70, 44, 24, 0x6a5a7a);                               // изголовье
      rect(108, G - 58, 56, 18, 0xc8b8d8, 0.9);                         // подушка
      rect(164, G - 40, 86, 12, 0x6a4a6a);                              // одеяло
      if (warm) { rect(W - 132, G - 40, 56, 40, 0x3a2c22); rect(W - 130, G - 44, 52, 6, 0x4a3a2e); label(W - 104, 'ТУМБА'); } // тумбочка под будильник
      else label(155, 'НОЧЬ');
    } else { // door
      const dx = W - 110;
      rect(dx - 60, G - 200, 120, 200, 0x2a2438);                       // дверной проём
      rect(dx - 52, G - 192, 104, 192, 0x4a3a2e);                       // дверь
      rect(dx - 40, G - 100, 8, 8, 0xd8c020);                           // ручка
      rect(dx - 70, G - 200, 140, 8, 0x3a2c22);                         // косяк
      rect(dx - 44, G - 6, 88, 6, 0x6a3a50, 0.6);                       // коврик
      label(dx, 'ДВЕРЬ');
    }
  }

  // ── Шаг 1: походить-попрыгать ───────────────────────────────────────────────
  private checkWalk() {
    if (this.moved > 900 && this.jumped) {
      this.step = 'dash';
      this.narrTell('Понедельник.\nНа Мистера летят дела.', () => {
        this.clearBeat();
        this.setScene('office');
        this.narr.setText('ИЗБЕГАЙ — быть где-то ещё');
        this.prompt.setText(IS_TOUCH ? 'ИЗБЕГАЙ (тап) — рывок' : 'Z (тап) — рывок, увернись');
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
    const lbl = this.add.text(0, -96, 'ДЕЛА', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '11px', color: '#9a90b8' }).setOrigin(0.5, 1);
    c.add(lbl);
    this.pile = c;
  }

  private updatePile(dt: number) {
    const p = this.pile; if (!p) return;
    const d = this.player.x - p.x;
    p.x += Math.sign(d) * dt * 0.07; // ползёт к Мистеру — мимо не проедет
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
    this.narrTell('Ночь. Лезут тревоги.\nИх не побить и не обогнать.', () => {
      this.clearBeat();
      this.setScene('night');
      this.narr.setText('ИЗБЕГАЙ (держи) — залипни, и отстанут');
      this.prompt.setText(IS_TOUCH ? 'ИЗБЕГАЙ (держи) — залипни' : 'Z (держи) — залипни, отвлекись');
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
        this.say('клубок важнее. а мысли... отстали?', 2600);
        audio.freeze();
        this.time.delayedCall(1600, () => this.beginFight());
      }
    } else this.calmT = Math.max(0, this.calmT - dt * 2);
    // движение не спасает
    if (!this.frozen && Math.abs((this.player.body as Phaser.Physics.Arcade.Body).velocity.x) > 200)
      this.sayOnce('worry_run', 'от своей головы не убежишь...', 2600);
  }

  // ── Шаг 4: БЕЙ — будильник орёт и не затыкается, только вырубить ───────────
  private beginFight() {
    if (this.step !== 'freeze') return;
    this.step = 'fight';
    this.narrTell('Утро. Будильник орёт.\nИ не затыкается.', () => {
      this.clearBeat();
      this.setScene('morning');
      this.narr.setText('БЕЙ — вырубить');
      this.prompt.setText(IS_TOUCH ? 'БЕЙ — по будильнику' : 'X — вырубить будильник');
      // будильник на тумбочке справа — Мистер подходит и бьёт
      this.colleague = this.add.sprite(W - 100, GROUND_Y - 6, 'alarm').setOrigin(0.5, 1).setScale(1.7).setDepth(8);
      this.colBubble = this.add.text(0, 0, 'ДЗЗ-ДЗЗ-ДЗЗ!', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '9px', color: '#1a1020',
        backgroundColor: '#ffd870', padding: { x: 7, y: 4 } }).setOrigin(0.5, 1).setDepth(45);
    });
  }

  private updateColleague(dt: number) {
    const c = this.colleague; if (!c || !c.active) return;
    c.setAngle(Math.sin(this.t * 0.04) * 9); // трясётся от звона
    const d = Math.abs(this.player.x - c.x);
    if (this.colBubble?.active) {
      this.colBubble.x = c.x; this.colBubble.y = c.y - 70 + Math.sin(this.t * 0.04) * 3;
      this.colBubble.setText(['ДЗЗ-ДЗЗ-ДЗЗ!', 'ВСТАВАЙ!', 'ДЗЗЗЗ!'][Math.floor(this.t / 1400) % 3]);
    }
    if (this.frozen && d < 160) this.sayOnce('col_frz', 'отвлечься? оно ОРЁТ прямо в ухо.', 2600);
    if (this.dashT > 0 && d < 220) this.sayOnce('col_dash', 'убежал в другую комнату — всё равно слышно.', 2800);
  }

  private onHit() {
    // на соседку рявкнуть «язык не повернулся» — даём реакцию, а не тишину
    if (this.step === 'fawn' && this.neighbor?.active) {
      this.sayOnce('nei_hit', 'рявкнуть на соседку? ...не смог.', 2600);
      return;
    }
    if (this.step !== 'fight' || !this.colleague?.active) return;
    const dir = this.player.flipX ? -1 : 1;
    const dx = this.colleague.x - this.player.x;
    if (dx * dir < -12 || Math.abs(dx) > 90) return;
    audio.hit();
    this.cameras.main.shake(220, 0.015);
    const c = this.colleague; this.colleague = null;
    this.colBubble?.destroy();
    // ХРЯСЬ! — лупит по будильнику, тот замолкает
    const smash = this.add.text(c.x, c.y - 60, 'ХРЯСЬ!',
      { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '16px', color: '#ff5544' })
      .setOrigin(0.5).setDepth(46).setAngle(Phaser.Math.Between(-8, 8));
    this.tweens.add({ targets: smash, scale: 1.4, alpha: 0, duration: 900, onComplete: () => smash.destroy() });
    for (let i = 0; i < 8; i++) { const p = this.add.rectangle(c.x, c.y - 20, 3, 3, 0xd8a020).setDepth(46);
      const a = Math.random() * 6.28; this.tweens.add({ targets: p, x: c.x + Math.cos(a) * 80, y: c.y - 20 + Math.sin(a) * 60, alpha: 0, duration: 600, onComplete: () => p.destroy() }); }
    this.tweens.add({ targets: c, angle: 80, y: c.y + 14, alpha: 0, duration: 500, onComplete: () => c.destroy() });
    this.say('ХРЯСЬ! ...тишина. наконец-то.', 3000);
    this.time.delayedCall(2400, () => this.beginFawn());
  }

  // ── Шаг 5: УСТУПИ — соседка, которой нельзя ни рявкнуть, ни сбежать ────────
  private beginFawn() {
    if (this.step !== 'fight') return;
    this.step = 'fawn';
    this.narrTell('Вечер. Соседка опять просит\nпосидеть с её фикусом.', () => {
      this.clearBeat();
      this.setScene('door');
      this.narr.setText('УСТУПИ — лишь бы отстали');
      this.prompt.setText(IS_TOUCH ? 'УСТУПИ — сдайся' : 'V — уступи, сдайся');
      this.neighbor = this.add.sprite(W - 90, GROUND_Y, 'nei_idle').setOrigin(0.5, 1).setScale(1.5)
        .setFlipX(true).setDepth(8);
      this.safeAnim('nei-idle', 'nei_idle', 0, 3, 6, -1);
      if (this.anims.exists('nei-idle')) this.neighbor.play('nei-idle');
      this.neiBubble = this.add.text(0, 0, 'ты же не откажешь?', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '9px', color: '#1a1020',
        backgroundColor: '#e8b8d0', padding: { x: 7, y: 4 } }).setOrigin(0.5, 1).setDepth(45);
    });
  }

  private updateNeighbor() {
    const n = this.neighbor; if (!n || !n.active) return;
    if (this.neiBubble?.active) { this.neiBubble.x = n.x; this.neiBubble.y = n.y - 54; }
    const d = Math.abs(this.player.x - n.x);
    if (this.frozen && d < 200) this.sayOnce('nei_frz', 'играю, не вижу... а она всё ждёт.', 2600);
    if (this.dashT > 0 && d < 240) this.sayOnce('nei_dash', 'сбежать? она же соседка...', 2600);
  }

  private onFawn() {
    if (this.step !== 'fawn' || !this.neighbor?.active) return;
    const n = this.neighbor; this.neighbor = null;
    this.neiBubble?.destroy();
    audio.freeze();
    // свернулся калачиком — сдался (спрайт «сна» грузится в фоне; нет — стоим)
    this.safeAnim('p-sleep', 'cat_sleep', 0, 5, 6, 0);
    if (this.anims.exists('p-sleep')) {
      this.player.setVisible(false);
      this.sleepSprite.setVisible(true).setPosition(this.player.x, this.player.y).setFlipX(this.player.flipX).play('p-sleep');
      this.time.delayedCall(2200, () => { this.sleepSprite.setVisible(false); this.player.setVisible(true); });
    }
    const ok = this.add.text(this.player.x, this.player.y - 66, '«конечно... давайте ваш фикус»',
      { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '10px', color: '#b8a8d0' }).setOrigin(0.5).setDepth(46);
    this.tweens.add({ targets: ok, y: ok.y - 20, alpha: 0, duration: 1800, onComplete: () => ok.destroy() });
    this.tweens.add({ targets: n, x: n.x + 200, alpha: 0, duration: 900, delay: 500, onComplete: () => n.destroy() });
    this.say('все довольны. кроме Мистера.', 3000);
    this.time.delayedCall(2400, () => this.finish());
  }

  private finish() {
    this.step = 'done';
    track('tutorial_done');
    this.narr.setText('БЕЙ · ИЗБЕГАЙ · УСТУПИ\n\n...должно хватать. да?');
    this.prompt.setText(IS_TOUCH ? 'тапни — дальше' : 'E / клик — дальше');
    this.input.once('pointerdown', () => this.scene.start('Intro'));
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
