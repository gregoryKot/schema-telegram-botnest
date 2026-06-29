import Phaser from 'phaser';
import { W, H, GROUND_Y, PHYS, S } from '../constants';
import { audio } from '../audio';
import { touch, IS_TOUCH, setTouchControls } from '../controls';
import { track } from '../analytics';
import { tr } from '../i18n';
import { placeProp } from '../props';

// ════════════════════════════════════════════════════════════════════════════
//  ПРОЛОГ — знакомство с Мистером и управлением. Четыре сценки, у каждой одна
//  «рабочая» реакция: дела → беги · переживания → отвлекись · коллега → бей · соседка → уступи.
//  Неверная реакция не наказывает — даёт честный фидбэк репликой.
// ════════════════════════════════════════════════════════════════════════════

type Step = 'meet' | 'walk' | 'dash' | 'freeze' | 'fight' | 'fawn' | 'done';

// соседка идёт по пятам и давит на вину, лишь бы согласился
const NEI_LINES = [
  'ты же не откажешь?', 'я на тебя рассчитываю...', 'тебе что, трудно?',
  'все бы согласились.', 'ну что тебе стоит.', 'я ведь обижусь.',
];

// «не та кнопка» в сценке: почему этот способ тут не сработает (много вариантов)
const WRONG: Record<string, Record<string, string[]>> = {
  dash: { // сценка ДЕЛА — верно ИЗБЕГАЙ
    hit: ['по делам не ударишь — их только больше.', 'бить бумаги? их не убавится.', 'злись не злись — задачи не разбегутся.', 'кулаком отчёт не сдашь.', 'агрессия их не уберёт, только вымотает.', 'дела не дерутся в ответ — просто ждут.'],
    fawn: ['сдаться делам? они и так на тебе.', 'кому уступать — стопке бумаг?', 'покорно сесть под ними — раздавят.', 'это не человек, уступать некому.', 'смирение дедлайн не подвинет.'],
    freeze: ['замрёшь — дела сами себя не сделают.', 'залипнешь — гора только вырастет.', 'отвлечёшься — дедлайн ближе.', 'спрячешься в телефон — они дождутся.', 'застынешь — завтра их вдвое.'],
  },
  freeze: { // сценка ТРЕВОГИ — верно ИЗБЕГАЙ (держать)
    hit: ['тревогу не ударишь — она внутри.', 'бить свои мысли? станет хуже.', 'кулаком страх не выгонишь.', 'злость на тревогу — та же тревога.', 'по переживаниям не попасть.'],
    fawn: ['сдаться страху — он накроет с головой.', 'уступишь тревоге — она будет править.', 'покорность мыслям их не уймёт.', 'кому уступать — голосу в голове?', 'согласишься с тревогой — поверишь ей.'],
    dash: ['от своей головы не убежишь.', 'бежишь — а мысли бегут с тобой.', 'рывок? тревога догонит на месте.', 'сменишь комнату — мысли те же.', 'быстрее ног они всё равно в голове.'],
  },
  fight: { // сценка БУДИЛЬНИК — верно БЕЙ
    dash: ['убежал в другую комнату — всё равно слышно.', 'рывком звон не выключишь.', 'спрячешься — орёт дальше.', 'от будильника не убегают — он везде.', 'сбежишь — опоздаешь ещё и проспав.'],
    freeze: ['отвлечься? оно ОРЁТ прямо в ухо.', 'залипнешь — звонит и звонит.', 'замри хоть весь — звон не стихнет.', 'в телефон? будильник громче.', 'переждать не выйдет — он не устаёт.'],
    fawn: ['уступить будильнику? это как?', 'сдаться звону — он не человек.', 'покориться железке — звенит дальше.', 'смирение его не выключит.'],
  },
  fawn: { // сценка СОСЕДКА — верно УСТУПИ
    hit: ['рявкнуть на соседку? ...язык не повернулся.', 'нагрубить ей — потом стыдно неделю.', 'злость на неё — не смог, воспитанный же.', 'накричать? а жить с ней дальше.', 'огрызнуться — рука не поднялась.', 'сорвёшься — будешь виноват сам.'],
    dash: ['сбежать? она догонит — она же соседка.', 'захлопнуть дверь — неудобно как-то.', 'улизнуть — а завтра в лифте встречать.', 'рывок? она просто придёт снова.', 'спрячешься — постучит ещё раз.'],
    freeze: ['играю, не вижу... а она всё ждёт.', 'сделать вид что нет дома — она слышит.', 'залипнуть в телефон — не уйдёт.', 'отвернуться — стоит и смотрит.', 'тянуть время — она терпеливее.'],
  },
};

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

  // жизни (как в игре — учим, что копинг их тратит)
  private hearts = 3; private heartsText!: Phaser.GameObjects.Text; private hurtT = 0;
  // walk
  private moved = 0; private jumped = false;
  // dash
  private pile: Phaser.GameObjects.Container | null = null;
  private pileSpr: Phaser.GameObjects.Sprite | null = null;
  private dashed = false; private dashT = 0; private dashCd = 0; private dashDir = 1;
  private neiSayT = 0; private neiLine = 0;
  private wrongCd = 0; private lastWrong = -1; // объяснения «не та кнопка» — троттлинг + без повтора
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
  private lungeSprite!: Phaser.GameObjects.Sprite; // выпад атаки — как в игре
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
    // пол — деревянная текстура (как дома в главах), а не плоский прямоугольник
    const TW = 16 * S;
    for (let fx = -TW; fx <= W + TW; fx += TW)
      this.add.image(fx, GROUND_Y, 'ground_room').setOrigin(0, 0).setDepth(1);
    bg.fillStyle(0x2e1d10, 1); bg.fillRect(0, GROUND_Y + TW, W, H - GROUND_Y - TW);

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
    this.safeAnim('nei-idle', 'nei_idle', 0, 3, 6, -1);
    this.sleepSprite = this.add.sprite(0, 0, 'cat_sleep', 0).setOrigin(0.5, 1).setScale(0.3).setDepth(10).setVisible(false);
    // выпад атаки — тот же спрайт, что в игре (cat_dash), грузится в фоне
    this.safeAnim('p-lunge', 'cat_dash', 1, 5, 24, 0);
    this.lungeSprite = this.add.sprite(0, 0, this.textures.exists('cat_dash') ? 'cat_dash' : 'cat_idle', 0).setOrigin(0.5, 1).setScale(0.26).setDepth(11).setVisible(false);
    this.paused = false;
    this.dim = this.add.rectangle(W / 2, H / 2, W, H, 0x06040e, 0).setDepth(48);
    this.contHint = this.add.text(W / 2, IS_TOUCH ? H - 210 : H - 100, tr(IS_TOUCH ? 'тапни — дальше' : 'любая клавиша — дальше'),
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

    // жизни — как в игре; учим, что каждый «способ справиться» их тратит
    // жизни — В ТОЧНОСТИ как в игре (тот же размер/цвет/позиция)
    this.hearts = 3; this.hurtT = 0;
    this.heartsText = this.add.text(18, 14, '', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '24px', color: '#ff5577' })
      .setScrollFactor(0).setDepth(60);
    this.updateHearts();

    const skip = this.add.text(W - 20, 16, tr('пропустить →'), { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '9px', color: '#6a5f8a' })
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

  private updateHearts() {
    this.heartsText.setText('♥'.repeat(Math.max(0, this.hearts)) + '·'.repeat(Math.max(0, 3 - this.hearts)));
  }
  // в обучении жизнь не падает до конца (clamp 1), но убыль показываем — учим цену
  private loseHeart(msg: string) {
    if (this.hurtT > 0) return;
    this.hurtT = 1300;
    this.hearts = Math.max(1, this.hearts - 1);
    this.updateHearts();
    this.cameras.main.shake(180, 0.01); this.cameras.main.flash(120, 120, 20, 40);
    audio.hurt();
    this.player.setTint(0xff5555);
    this.time.delayedCall(180, () => this.player.clearTint());
    this.say(msg, 2600);
  }

  // ── Знакомство ──────────────────────────────────────────────────────────────
  private meet() {
    this.narrTell('Это кот Мистер.\nЖивёт, всем доволен.', () => {
      this.narrTell(
        'Когда накрывает, Мистер справляется\nтремя способами. Так научили —\nи это нормально.\n\n♥ слева — его силы. борьба их тратит.',
        () => {
          this.step = 'walk';
          this.setNarr('пойдём — посмотрим на эти три способа');
          this.setPrompt(IS_TOUCH ? '◀ ▶ идти · ▲ прыжок' : 'A D идти · W прыжок');
        });
    });
  }

  // Стоп-кадр для текста: мир замирает и темнеет, читаешь спокойно,
  // дальше — по тапу/клавише. Иначе внимание на коте и текст теряется.
  private narrTell(text: string, onContinue: () => void) {
    this.paused = true;
    this.physics.pause();
    this.player.anims.pause();
    this.setNarr(text);
    this.setPrompt('');
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
      this.setNarr(''); // иначе нарезка висит поверх геймплея и наезжает на подсказку
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
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.wrongCd > 0) this.wrongCd -= dt;
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
      case 'fawn':   this.updateNeighbor(dt); break;
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
    // залип (ИЗБЕГАЙ держать) там, где это не работает — объясняем почему
    if (this.frozen && (this.step === 'dash' || this.step === 'fight' || this.step === 'fawn')) this.wrongTry('freeze');
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
      // ВЫПАД — один в один как в игре: спрайт cat_dash, прячем обычного кота
      if (this.anims.exists('p-lunge')) {
        if (!this.lungeSprite.visible) { this.lungeSprite.setVisible(true).play('p-lunge'); this.player.setVisible(false); }
        this.lungeSprite.setPosition(this.player.x, this.player.y).setFlipX(dir < 0);
      }
      const cx = this.player.x + dir * 30, cy = this.player.y - 34;
      const len = 34 * Math.min(1, prog * 1.6);
      const a = 1 - Math.max(0, prog - 0.45) * 1.8;
      for (let i = 0; i < 3; i++) {
        const ox = i * 7 * dir, oy = i * 9 - 6;
        this.slash.lineStyle(3, i === 1 ? 0xff4455 : 0xd92b3d, Math.max(0, a));
        this.slash.lineBetween(cx + ox, cy + oy, cx + ox + len * dir, cy + oy + len * 0.55);
      }
      if (prog > 0.4 && prog < 0.6) this.burstAt(cx + len * dir * 0.7, cy + 12, 0xff4455);
      // ударная волна-кольцо вокруг кота — как в игре (бьёт во все стороны)
      this.slash.lineStyle(3, 0xff5566, Math.max(0, 1 - prog) * 0.7);
      this.slash.strokeCircle(this.player.x, this.player.y - 22, 104 * (0.45 + prog * 0.6));
      if (this.attackT <= 0) { this.lungeSprite.setVisible(false); this.player.setVisible(true); }
    }
  }

  // мелкие частицы (как burst в игре) — для удара
  private burstAt(x: number, y: number, color: number) {
    for (let i = 0; i < 4; i++) {
      const p = this.add.rectangle(x, y, 3, 3, color).setDepth(12);
      const ang = Math.random() * 6.28, s = 60 * (0.5 + Math.random());
      this.tweens.add({ targets: p, x: x + Math.cos(ang) * s, y: y + Math.sin(ang) * s, alpha: 0, scale: 0, duration: 300, onComplete: () => p.destroy() });
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

    // мягкий островок света из окна — атмосфера, на фоне спрайтов реквизита
    const windowGlow = (cx: number, warm: boolean) => {
      rect(cx - 76, G - 256, 152, 168, warm ? 0x6a4a2a : 0x10182e, 0.55);
      g.fillStyle(warm ? 0xffd070 : 0xeaeaff, warm ? 0.45 : 0.85);
      g.fillCircle(cx + 50, G - 214, warm ? 20 : 15);                    // солнце / луна
      rect(cx - 80, G - 88, 160, 7, 0x4a4060);                           // подоконник
      g.fillStyle(warm ? 0xffd9a0 : 0x9fb6e0, 0.06);
      g.fillTriangle(cx - 76, G - 88, cx + 76, G - 88, cx, G);           // дорожка света на пол
    };

    const prop = (key: string, x: number, w: number) => {
      const p = placeProp(this, key, x, G, w, 3); if (p) c.add(p);
    };
    if (kind === 'office') {
      windowGlow(W * 0.62, true);
      prop('prop_desk', 150, 190);
    } else if (kind === 'night' || kind === 'morning') {
      const warm = kind === 'morning';
      windowGlow(W * 0.36, warm);
      prop('prop_bed', 165, 230);
    } else { // door
      prop('prop_door', W - 110, 150);
    }
  }

  // ── Шаг 1: походить-попрыгать ───────────────────────────────────────────────
  private checkWalk() {
    if (this.moved > 900 && this.jumped) {
      this.step = 'dash';
      this.narrTell('Понедельник. Дел — целая гора.\nМистер боится, что не успеет.\n\nКогда наваливается — можно увернуться.', () => {
        this.clearBeat();
        this.setScene('office');
        this.setNarr('ИЗБЕГАЙ — рывком проскользнуть мимо');
        this.setPrompt(IS_TOUCH ? 'ИЗБЕГАЙ (тап) — рывок' : 'Z (тап) — рывок, увернись');
        this.spawnPile();
      });
    }
  }

  // ── Шаг 2: БЕГИ — куча дел, от которой можно только увернуться ─────────────
  private spawnPile() {
    const c = this.add.container(110, GROUND_Y).setDepth(8); // на экране слева, наступает
    // настоящий спрайт «пачка дел» (дрожит), origin снизу — стоит на полу
    this.pileSpr = this.add.sprite(0, 0, 'workload').setOrigin(0.5, 1).setScale(0.9);
    if (this.anims.exists('workload-wobble')) this.pileSpr.play('workload-wobble');
    c.add(this.pileSpr);
    this.pile = c;
  }

  private updatePile(dt: number) {
    const p = this.pile; if (!p) return;
    const d = this.player.x - p.x;
    p.x += Math.sign(d) * dt * 0.06;       // ползёт к Мистеру (фронтальный спрайт — без флипа)
    p.y = GROUND_Y + Math.sin(this.t * 0.01) * 2;
    if (Math.abs(d) < 60 && this.dashT <= 0) {
      // навалились — будто ударили: толчок назад + минус жизнь. Уйти можно только рывком
      (this.player.body as Phaser.Physics.Arcade.Body).velocity.x = Math.sign(d || 1) * 280;
      this.loseHeart('дела навалились! только рывок (Z) спасает.');
    }
  }
  private onDash() {
    if (this.step !== 'dash') { this.wrongTry('dash'); return; }
    // рывок — и есть способ уйти от дел: уводит мимо в любом случае
    this.clearPile('...фух. рывком — мимо. (но завтра снова)');
  }
  private clearPile(line: string) {
    if (this.dashed || !this.pile) return;
    this.dashed = true;
    const p = this.pile; this.pile = null;
    this.tweens.add({ targets: p, alpha: 0, y: p.y + 40, duration: 700, onComplete: () => p.destroy() });
    this.say(line, 2600);
    this.time.delayedCall(1500, () => this.beginFreeze());
  }

  // ── Шаг 3: ЗАМРИ — переживания, которые нельзя ни убить, ни обогнать ───────
  private beginFreeze() {
    if (this.step !== 'dash') return;
    this.step = 'freeze';
    this.narrTell('Ночь. В голове крутятся тревоги —\nне уснуть. Их не побить и не обогнать.\n\nМожно отвлечься, переждать.', () => {
      this.clearBeat();
      this.setScene('night');
      this.setNarr('ИЗБЕГАЙ (держи) — отвлечься, и отступят');
      this.setPrompt(IS_TOUCH ? 'ИЗБЕГАЙ (держи) — залипни' : 'Z (держи) — залипни, отвлекись');
      for (let i = 0; i < 3; i++) this.worries.push(this.add.sprite(this.player.x, this.player.y - 60, 'anxmob').setDepth(7).setScale(0.42).play('anx-fly'));
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
    // бег не спасает — разные объяснения почему
    if (!this.frozen && Math.abs((this.player.body as Phaser.Physics.Arcade.Body).velocity.x) > 200)
      this.wrongTry('dash');
  }

  // ── Шаг 4: БЕЙ — будильник орёт и не затыкается, только вырубить ───────────
  private beginFight() {
    if (this.step !== 'freeze') return;
    this.step = 'fight';
    this.narrTell('Утро. Будильник орёт и не унимается.\nЖуть как бесит.\n\nИногда хочется просто врезать.', () => {
      this.clearBeat();
      this.setScene('morning');
      this.setNarr('БЕЙ — вырубить, дать отпор');
      this.setPrompt(IS_TOUCH ? 'БЕЙ — по будильнику' : 'X — вырубить будильник');
      // будильник рядом с кроватью, поменьше — Мистер подходит и бьёт
      this.colleague = this.add.sprite(305, GROUND_Y - 4, 'prop_alarm').setOrigin(0.5, 1).setScale(0.15).setDepth(8);
      this.colBubble = this.add.text(0, 0, tr('ДЗЗ-ДЗЗ-ДЗЗ!'), { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '9px', color: '#1a1020',
        backgroundColor: '#ffd870', padding: { x: 7, y: 4 } }).setOrigin(0.5, 1).setDepth(45);
    });
  }

  private updateColleague(dt: number) {
    const c = this.colleague; if (!c || !c.active) return;
    c.setAngle(Math.sin(this.t * 0.04) * 9); // трясётся от звона
    const d = Math.abs(this.player.x - c.x);
    if (this.colBubble?.active) {
      this.colBubble.x = c.x; this.colBubble.y = c.y - 70 + Math.sin(this.t * 0.04) * 3;
      this.colBubble.setText(tr(['ДЗЗ-ДЗЗ-ДЗЗ!', 'ВСТАВАЙ!', 'ДЗЗЗЗ!'][Math.floor(this.t / 1400) % 3]));
    }
  }

  private onHit() {
    if (this.step !== 'fight') { this.wrongTry('hit'); return; }
    if (!this.colleague?.active) return;
    // удар — аура вокруг кота (как в игре), а не узкий конус спереди
    if (Math.hypot(this.colleague.x - this.player.x, this.colleague.y - (this.player.y - 22)) > 104) return;
    audio.hit();
    this.cameras.main.shake(220, 0.015);
    const c = this.colleague; this.colleague = null;
    this.colBubble?.destroy();
    // ХРЯСЬ! — лупит по будильнику, тот замолкает
    const smash = this.add.text(c.x, c.y - 60, tr('ХРЯСЬ!'),
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
    this.narrTell('Вечер. Соседка снова просит об одолжении.\nОтказать — неловко.\n\nПроще согласиться, лишь бы отстали.', () => {
      this.clearBeat();
      this.setScene('door');
      this.setNarr('УСТУПИ — согласиться, лишь бы отстали');
      this.setPrompt(IS_TOUCH ? 'УСТУПИ — сдайся' : 'V — уступи, сдайся');
      this.neiSayT = 0;
      this.neighbor = this.add.sprite(W - 90, GROUND_Y, 'nei_idle').setOrigin(0.5, 1).setScale(1.5)
        .setFlipX(true).setDepth(8);
      this.safeAnim('nei-idle', 'nei_idle', 0, 3, 6, -1);
      if (this.anims.exists('nei-idle')) this.neighbor.play('nei-idle');
      this.neiBubble = this.add.text(0, 0, tr('ты же не откажешь?'), { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '9px', color: '#1a1020',
        backgroundColor: '#e8b8d0', padding: { x: 7, y: 4 } }).setOrigin(0.5, 1).setDepth(45);
    });
  }

  private updateNeighbor(dt: number) {
    const n = this.neighbor; if (!n || !n.active) return;
    // ходит по пятам — догоняет, лицом к Мистеру (flipX true = смотрит влево)
    const d = this.player.x - n.x;
    if (Math.abs(d) > 66) n.x += Math.sign(d) * dt * 0.13;
    n.setFlipX(d < 0); // кот слева → смотрит влево
    if (this.neiBubble?.active) {
      this.neiBubble.x = n.x; this.neiBubble.y = n.y - 54;
      this.neiSayT += dt;
      if (this.neiSayT > 2200) { this.neiSayT = 0; this.neiBubble.setText(tr(NEI_LINES[this.neiLine++ % NEI_LINES.length])); }
    }
  }

  private onFawn() {
    if (this.step !== 'fawn') { this.wrongTry('fawn'); return; }
    if (!this.neighbor?.active) return;
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
    const ok = this.add.text(this.player.x, this.player.y - 66, tr('«конечно... давайте ваш фикус»'),
      { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '10px', color: '#b8a8d0' }).setOrigin(0.5).setDepth(46);
    this.tweens.add({ targets: ok, y: ok.y - 20, alpha: 0, duration: 1800, onComplete: () => ok.destroy() });
    this.tweens.add({ targets: n, x: n.x + 200, alpha: 0, duration: 900, delay: 500, onComplete: () => n.destroy() });
    // уступка тоже стоит сил — показываем минус жизни
    this.hearts = Math.max(1, this.hearts - 1); this.updateHearts();
    this.player.setTint(0x8a7aaa); this.time.delayedCall(320, () => this.player.clearTint());
    this.say('уступил. все довольны — кроме Мистера. −1 жизнь.', 3200);
    this.time.delayedCall(2400, () => this.finish());
  }

  private finish() {
    this.step = 'done';
    track('tutorial_done');
    this.setNarr('БЕЙ · ИЗБЕГАЙ · УСТУПИ\n\n...должно хватать. да?');
    this.setPrompt(IS_TOUCH ? 'тапни — дальше' : 'E / клик — дальше');
    this.input.once('pointerdown', () => this.scene.start('Intro'));
  }

  // ── Реплики ────────────────────────────────────────────────────────────────
  private setNarr(s: string) { this.narr.setText(tr(s)); }
  private setPrompt(s: string) { this.prompt.setText(tr(s)); }
  private say(text: string, dur: number) { this.bubble.setText(tr(text)).setAlpha(1); this.bubbleT = dur; }
  private sayOnce(key: string, text: string, dur: number) { if (this.said.has(key)) return; this.said.add(key); this.say(text, dur); }
  // нажал «не ту» кнопку в этой сценке — объясняем, почему не сработает (разные варианты)
  private wrongTry(action: string) {
    const pool = WRONG[this.step]?.[action];
    if (!pool || !pool.length) return;
    if (this.wrongCd > 0) return; // троттлинг от спама, но реагируем почти сразу
    let i = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && i === this.lastWrong) i = (i + 1) % pool.length;
    this.lastWrong = i; this.wrongCd = 900;
    this.say(pool[i], 2400);
  }
  private updateBubble(dt: number) {
    if (this.bubbleT <= 0) return;
    // если рядом говорит NPC (соседка/будильник) — реплику кота поднимаем ВЫШЕ,
    // чтобы пузыри стояли стопкой, а не наезжали (и ничего не «исчезало»)
    const npcTalking = (this.neiBubble?.active) || (this.colBubble?.active);
    this.bubble.x = this.player.x; this.bubble.y = this.player.y - (npcTalking ? 104 : 64);
    this.bubbleT -= dt;
    if (this.bubbleT < 300) this.bubble.setAlpha(Math.max(0, this.bubbleT / 300));
  }
}
