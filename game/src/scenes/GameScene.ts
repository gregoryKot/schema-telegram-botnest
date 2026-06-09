import Phaser from 'phaser';
import { W, H, GROUND_Y, S, C, PHYS, LEVEL_W } from '../constants';
import { CardOverlay } from '../ui/CardOverlay';

interface EnemyObj {
  img: Phaser.GameObjects.Image;
  id: string;
  baseX: number;
  dir: number;
  active: boolean;   // false = поглощена котом, ждёт респауна
  phase: number;
}

interface PillEffect {
  id: string;
  remaining: number;
  speedMul: number;
  autoRight: boolean;
  noMove: boolean;                          // прокрастинация: совсем лечь
  clone?: Phaser.GameObjects.Sprite;        // самокритик: тёмный двойник
  zzzTexts?: Phaser.GameObjects.Text[];     // прокрастинация: ZZZ над котом
}

const PILL_FX: Record<string, { label: string; tint: number; speedMul: number; autoRight?: boolean; shake?: boolean; noMove?: boolean; spawnClone?: boolean }> = {
  anxiety:         { label: '😰 тревога захлёстывает...',  tint: 0xFF8820, speedMul: 0.55, shake: true },
  procrastination: { label: '🛋️  не могу встать...',       tint: 0x5577AA, speedMul: 0, noMove: true  },
  phone:           { label: '📱 отвлёкся...',               tint: 0x3388FF, speedMul: 0.50 },
  irritation:      { label: '😤 несёт вперёд!',            tint: 0xFF4400, speedMul: 1.80, autoRight: true },
  selfcritic:      { label: '🪞 за тобой идёт тень...',    tint: 0xAA44DD, speedMul: 0.80, spawnClone: true },
};
const EFFECT_DURATION = 3500; // ms

const PLATFORMS = [
  { x: 600,  w: 160, y: GROUND_Y - 100 },
  { x: 1000, w: 180, y: GROUND_Y - 120 },
  { x: 1500, w: 150, y: GROUND_Y - 95  },
  { x: 2100, w: 200, y: GROUND_Y - 115 },
  { x: 2700, w: 160, y: GROUND_Y - 90  },
  { x: 3400, w: 180, y: GROUND_Y - 110 },
  { x: 4100, w: 160, y: GROUND_Y - 100 },
  { x: 4900, w: 200, y: GROUND_Y - 120 },
];

const ENEMY_DEFS = [
  { id: 'anxiety',         x: 800,  angle: -14 },
  { id: 'procrastination', x: 1700, angle:  22 },
  { id: 'phone',           x: 2700, angle:  -8 },
  { id: 'irritation',      x: 3700, angle: -25 },
  { id: 'selfcritic',      x: 4700, angle:  10 },
];

const SAGE_X = 5600;
const DOOR_X = 6400;

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private colliders: Phaser.GameObjects.Rectangle[] = [];
  private enemies: EnemyObj[] = [];
  private sage!: Phaser.GameObjects.Image;
  private sageBob = 0;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private touchInput = { left: false, right: false, jump: false };

  private card!: CardOverlay;
  private frozen = false;   // только для мудреца и финала
  private sageHit = false;

  private effect: PillEffect | null = null;
  private effectText!: Phaser.GameObjects.Text;
  private effectBar!: Phaser.GameObjects.Rectangle;

  private bgMountains!: Phaser.GameObjects.TileSprite;

  constructor() { super('Game'); }

  create() {
    this.frozen = false;
    this.sageHit = false;
    this.enemies = [];
    this.effect = null;
    this.card = new CardOverlay();

    this.buildBackground();
    this.buildWorld();
    this.spawnPlayer();
    this.spawnEnemies();
    this.spawnSage();
    this.buildDoor();
    this.buildHUD();
    this.setupInput();
    this.setupTouchControls();
    this.setupCamera();
  }

  // ── Background ────────────────────────────────────────────────────────
  private buildBackground() {
    const sky = this.add.graphics().setScrollFactor(0).setDepth(-5);
    // Рассвет: синий вверху → тёплый оранжевый у горизонта
    sky.fillGradientStyle(0x4a90c8, 0x4a90c8, 0xff8833, 0xff8833, 1, 1, 1, 1);
    sky.fillRect(0, 0, W, GROUND_Y - 70);
    // Земля — тёплая коричневая
    sky.fillStyle(0x6b3a1e, 1);
    sky.fillRect(0, GROUND_Y - 70, W, H - GROUND_Y + 70);

    // Солнце на горизонте
    const sun = this.add.graphics().setScrollFactor(0).setDepth(-4);
    sun.fillStyle(0xffee44, 0.9); sun.fillCircle(W * 0.72, GROUND_Y - 85, 28);
    sun.fillStyle(0xffcc00, 0.3); sun.fillCircle(W * 0.72, GROUND_Y - 85, 44);
    sun.fillStyle(0xff8800, 0.15); sun.fillCircle(W * 0.72, GROUND_Y - 85, 64);

    // Редкие птицы
    const birds = this.add.graphics().setScrollFactor(0.04).setDepth(-3);
    birds.fillStyle(0x2a1000, 0.6);
    for (const [bx, by] of [[200,80],[220,74],[600,100],[620,94],[950,60],[970,66]] as number[][]) {
      birds.fillTriangle(bx, by, bx + 7, by - 5, bx + 14, by);
    }

    const mtH = 180, mtBase = GROUND_Y - 70;
    this.bgMountains = this.add.tileSprite(W / 2, mtBase, W, mtH, 'bg-mountains')
      .setOrigin(0.5, 1).setScrollFactor(0).setDepth(-3)
      .setTint(0xffaa66);  // тёплый золотистый тинт на горах

    // Мягкий туман у основания
    const horizon = this.add.graphics().setScrollFactor(0).setDepth(-2);
    horizon.fillGradientStyle(0xff8833, 0xff8833, 0x8b5020, 0x8b5020, 0.25, 0.25, 0, 0);
    horizon.fillRect(0, mtBase - 30, W, 50);
  }

  // ── World ─────────────────────────────────────────────────────────────
  private buildWorld() {
    const tileW = 16 * S, tileH = 16 * S;
    const tiles = Math.ceil(LEVEL_W / tileW) + 1;
    for (let i = 0; i < tiles; i++)
      this.add.image(i * tileW + tileW / 2, GROUND_Y + tileH / 2, 'ground').setDepth(2);

    const gr = this.add.rectangle(LEVEL_W / 2, GROUND_Y + 20, LEVEL_W, 40, 0, 0);
    this.physics.add.existing(gr, true);
    this.colliders.push(gr);

    for (const p of PLATFORMS) {
      const platTiles = Math.ceil(p.w / tileW);
      for (let i = 0; i < platTiles; i++)
        this.add.image(p.x + i * tileW + tileW / 2, p.y + 5 * S, 'plat').setDepth(2);
      const pr = this.add.rectangle(p.x + p.w / 2, p.y + 5 * S, p.w, 10 * S, 0, 0);
      this.physics.add.existing(pr, true);
      this.colliders.push(pr);
    }
  }

  // ── Player ────────────────────────────────────────────────────────────
  private spawnPlayer() {
    this.anims.create({ key: 'p-idle', frames: this.anims.generateFrameNumbers('cat_idle', { start: 0, end: 11 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'p-walk', frames: this.anims.generateFrameNumbers('cat_run',  { start: 0, end: 5  }), frameRate: 14, repeat: -1 });
    this.anims.create({ key: 'p-jump', frames: [{ key: 'cat_run', frame: 2 }], frameRate: 1, repeat: 0 });

    this.player = this.physics.add.sprite(80, GROUND_Y - 20, 'cat_idle');
    this.player.setOrigin(0.5, 1).setScale(1.5).setCollideWorldBounds(false).setDepth(10);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(22, 30); body.setOffset(13, 16);
    this.player.play('p-idle');
    for (const col of this.colliders) this.physics.add.collider(this.player, col);
  }

  // ── Enemies ───────────────────────────────────────────────────────────
  private spawnEnemies() {
    for (const def of ENEMY_DEFS) {
      const img = this.add.image(def.x, GROUND_Y, def.id)
        .setOrigin(0.5, 1).setDepth(5).setAngle(def.angle);
      this.enemies.push({ img, id: def.id, baseX: def.x, dir: 1, active: true, phase: Math.random() * Math.PI * 2 });
    }
  }

  // ── Sage ──────────────────────────────────────────────────────────────
  private spawnSage() {
    this.sage = this.add.image(SAGE_X, GROUND_Y, 'sage').setOrigin(0.5, 1).setDepth(5);
    const glow = this.add.graphics().setDepth(4);
    glow.fillStyle(0xa0ffc0, 0.06); glow.fillEllipse(SAGE_X, GROUND_Y - 40, 80, 100);
    this.add.text(SAGE_X, GROUND_Y - this.textures.get('sage').getSourceImage().height - 6,
      'М У Д Р Е Ц', { fontFamily: 'Courier New', fontSize: '8px', color: '#a0ffc0', letterSpacing: 3 })
      .setOrigin(0.5, 1).setDepth(6).setAlpha(0.7);

    for (let i = 0; i < 4; i++) {
      const px = SAGE_X + Phaser.Math.Between(-20, 20);
      const py = GROUND_Y - Phaser.Math.Between(20, 80);
      const dot = this.add.rectangle(px, py, 3, 3, 0xa0ffc0, 0.6).setDepth(6);
      this.tweens.add({ targets: dot, y: py - Phaser.Math.Between(15, 30), alpha: 0,
        duration: 1800 + i * 400, repeat: -1, delay: i * 450,
        onRepeat: () => { dot.x = SAGE_X + Phaser.Math.Between(-20, 20); dot.y = py; dot.setAlpha(0.6); },
      });
    }
  }

  // ── Door ──────────────────────────────────────────────────────────────
  private buildDoor() {
    const g = this.add.graphics().setDepth(4), dx = DOOR_X;
    g.fillStyle(0x78350f); g.fillRect(dx - 4, GROUND_Y - 82, 58, 82);
    g.fillStyle(0xa16207); g.fillRoundedRect(dx, GROUND_Y - 78, 50, 78, 5);
    g.fillStyle(0xbae6fd, 0.55); g.fillRoundedRect(dx + 8, GROUND_Y - 68, 34, 22, 6);
    g.fillStyle(0xfbbf24); g.fillCircle(dx + 44, GROUND_Y - 34, 4);
    this.add.text(dx + 25, GROUND_Y - 96, '→', { fontFamily: 'Courier New', fontSize: '16px', color: '#a08fff' })
      .setOrigin(0.5).setDepth(6);
  }

  // ── HUD ───────────────────────────────────────────────────────────────
  private buildHUD() {
    // Полоска эффекта (внизу экрана)
    this.effectBar = this.add.rectangle(W / 2, H - 8, 0, 4, 0xFF8820)
      .setScrollFactor(0).setDepth(100).setAlpha(0);
    // Текст эффекта
    this.effectText = this.add.text(W / 2, H - 22, '', {
      fontFamily: 'Courier New', fontSize: '11px',
      color: '#ffcc88', letterSpacing: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0);
  }

  // ── Input ─────────────────────────────────────────────────────────────
  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA = this.input.keyboard!.addKey('A');
    this.keyD = this.input.keyboard!.addKey('D');
    this.keyW = this.input.keyboard!.addKey('W');
  }

  private setupTouchControls() {
    if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return;
    document.getElementById('touch-controls')!.classList.add('visible');
    const add = (id: string, down: () => void, up: () => void) => {
      const el = document.getElementById(id)!;
      el.addEventListener('touchstart', e => { e.preventDefault(); el.classList.add('pressed'); down(); }, { passive: false });
      el.addEventListener('touchend',   e => { e.preventDefault(); el.classList.remove('pressed'); up(); },   { passive: false });
      el.addEventListener('touchcancel',e => { e.preventDefault(); el.classList.remove('pressed'); up(); },   { passive: false });
    };
    add('tbtn-left',  () => { this.touchInput.left = true;  }, () => { this.touchInput.left = false; });
    add('tbtn-right', () => { this.touchInput.right = true; }, () => { this.touchInput.right = false; });
    add('tbtn-jump',  () => { this.touchInput.jump = true;  }, () => { this.touchInput.jump = false; });
  }

  // ── Camera ────────────────────────────────────────────────────────────
  private setupCamera() {
    this.cameras.main.setBounds(0, 0, LEVEL_W, H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setFollowOffset(-W * 0.15, 0);
    this.physics.world.setBounds(0, -H, LEVEL_W, H * 3);
  }

  // ── Update ────────────────────────────────────────────────────────────
  update(_time: number, delta: number) {
    if (this.frozen || this.card.isVisible()) return;

    this.updateEffect(delta);

    const body   = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down;
    const spd    = PHYS.playerSpeed * (this.effect?.speedMul ?? 1);
    const left   = this.cursors.left.isDown  || this.keyA.isDown || this.touchInput.left;
    const right  = this.cursors.right.isDown || this.keyD.isDown || this.touchInput.right;
    const jump   = Phaser.Input.Keyboard.JustDown(this.cursors.up)
                || Phaser.Input.Keyboard.JustDown(this.cursors.space)
                || Phaser.Input.Keyboard.JustDown(this.keyW)
                || this.consumeTouch();

    if (this.effect?.noMove) {
      // Прокрастинация — лежит, ничего не делает
      body.setVelocityX(0);
    } else if (this.effect?.autoRight) {
      // Раздражение — несёт вправо сами
      body.setVelocityX(spd);
      this.player.setFlipX(false);
    } else if (right)     { body.setVelocityX(spd);  this.player.setFlipX(false); }
    else if (left)        { body.setVelocityX(-spd); this.player.setFlipX(true); }
    else                  { body.setVelocityX(body.velocity.x * 0.75); }

    if (jump && onGround && !this.effect?.noMove) body.setVelocityY(PHYS.jumpVel);

    // Анимация
    if (!onGround) {
      if (this.player.anims.currentAnim?.key !== 'p-jump') this.player.play('p-jump', true);
    } else if (Math.abs(body.velocity.x) > 20) {
      this.player.play('p-walk', true);
    } else {
      this.player.play('p-idle', true);
    }

    this.bgMountains.tilePositionX = this.cameras.main.scrollX * 0.18;
    this.sageBob += delta * 0.002;
    this.sage.y = GROUND_Y - Math.abs(Math.sin(this.sageBob)) * 5;

    this.updateEnemies(delta);
    this.checkSage();
    if (this.player.x > DOOR_X - 35) this.onComplete();
  }

  private _touchJumpConsumed = false;
  private consumeTouch(): boolean {
    if (this.touchInput.jump && !this._touchJumpConsumed) {
      this._touchJumpConsumed = true;
      this.touchInput.jump = false;
      setTimeout(() => { this._touchJumpConsumed = false; }, 300);
      return true;
    }
    return false;
  }

  // ── Effect system ─────────────────────────────────────────────────────
  private applyEffect(id: string) {
    const fx = PILL_FX[id];
    if (!fx) return;

    this.effect = {
      id, remaining: EFFECT_DURATION,
      speedMul: fx.speedMul, autoRight: fx.autoRight ?? false,
      noMove: fx.noMove ?? false,
    };
    this.player.setTint(fx.tint);
    if (fx.shake) this.cameras.main.shake(600, 0.004);

    // Прокрастинация — кот заваливается набок
    if (fx.noMove) {
      this.player.setAngle(90);
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
      // ZZZ над котом (screen-space)
      this.effect.zzzTexts = ['z', 'z z', 'Z Z Z'].map((txt, i) =>
        this.add.text(W / 2, H - 90 - i * 18, txt, {
          fontFamily: 'Courier New', fontSize: `${9 + i * 2}px`,
          color: '#88aacc', letterSpacing: 3,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(99).setAlpha(0)
      );
      this.effect.zzzTexts.forEach((t, i) => {
        this.tweens.add({ targets: t, alpha: 0.7, duration: 300, delay: i * 250, yoyo: true, repeat: -1 });
      });
    }

    // Самокритик — тёмный двойник появляется сзади
    if (fx.spawnClone) {
      const clone = this.add.sprite(this.player.x - 90, this.player.y, 'cat_idle');
      clone.setOrigin(0.5, 1).setScale(1.5).setDepth(9);
      clone.setTint(0x220033).setAlpha(0).play('p-walk');
      this.tweens.add({ targets: clone, alpha: 0.8, duration: 400 });
      this.effect.clone = clone;
    }

    this.effectText.setText(fx.label).setAlpha(1);
    this.effectBar.setAlpha(1).setFillStyle(fx.tint);
    this.tweens.add({ targets: this.effectBar, width: W * 0.6, duration: 200 });
  }

  private updateEffect(delta: number) {
    if (!this.effect) return;
    this.effect.remaining -= delta;

    const frac = Math.max(0, this.effect.remaining / EFFECT_DURATION);
    this.effectBar.width = W * 0.6 * frac;
    if (this.effect.remaining < 700)
      this.effectText.setAlpha(Math.sin(Date.now() * 0.015) * 0.5 + 0.5);

    // Двойник (самокритик) — догоняет кота
    if (this.effect.clone) {
      const clone = this.effect.clone;
      const dx = this.player.x - clone.x;
      clone.x += Math.sign(dx) * 110 * (delta / 1000);
      clone.y  = this.player.y;
      clone.setFlipX(dx < 0);
      // Поймал — вспышка и откидывает назад
      if (Math.abs(dx) < 22) {
        this.cameras.main.flash(180, 180, 0, 80);
        clone.x = this.player.x - 120;
      }
    }

    if (this.effect.remaining <= 0) this.clearEffect();
  }

  private clearEffect() {
    if (!this.effect) return;
    // Убираем двойника
    if (this.effect.clone) {
      const c = this.effect.clone;
      this.tweens.add({ targets: c, alpha: 0, scaleX: 0.1, duration: 400, onComplete: () => c.destroy() });
    }
    // Убираем ZZZ
    this.effect.zzzTexts?.forEach(t => { this.tweens.add({ targets: t, alpha: 0, duration: 200, onComplete: () => t.destroy() }); });
    // Восстанавливаем кота
    this.player.setAngle(0);
    this.player.clearTint();
    this.player.setScale(1.5);
    this.effectText.setAlpha(0);
    this.tweens.add({ targets: this.effectBar, width: 0, alpha: 0, duration: 300 });
    this.effect = null;
  }

  // ── Enemy logic ───────────────────────────────────────────────────────
  private updateEnemies(delta: number) {
    for (const e of this.enemies) {
      if (!e.active) continue;
      e.phase += delta * 0.0025;
      e.img.y = GROUND_Y - Math.abs(Math.sin(e.phase)) * 5;
      e.img.x += e.dir * PHYS.enemySpeed * (delta / 1000);
      if (e.img.x > e.baseX + PHYS.enemyPatrol) e.dir = -1;
      if (e.img.x < e.baseX - PHYS.enemyPatrol) e.dir = 1;
      e.img.setFlipX(e.dir < 0);

      const dx = Math.abs(this.player.x - e.img.x);
      const dy = Math.abs(this.player.y - 14 - e.img.y);
      if (dx < 28 && dy < 30) this.touchPill(e);
    }
  }

  private touchPill(e: EnemyObj) {
    e.active = false;
    this.applyEffect(e.id);
    this.tweens.add({ targets: e.img, alpha: 0, scaleY: 0.1, duration: 300, ease: 'Back.In' });

    // Респаун через 6 секунд, впереди игрока
    this.time.delayedCall(6000, () => {
      e.active = true;
      e.baseX = this.player.x + W * 0.7 + Phaser.Math.Between(60, 200);
      e.img.x = e.baseX;
      e.img.setAlpha(0).setScale(1);
      this.tweens.add({ targets: e.img, alpha: 1, duration: 500 });
    });
  }

  // ── Sage ──────────────────────────────────────────────────────────────
  private checkSage() {
    if (this.sageHit) return;
    if (Math.abs(this.player.x - this.sage.x) < 45) {
      this.sageHit = true;
      this.frozen = true;
      this.clearEffect();
      this.card.showSage(() => { this.frozen = false; });
    }
  }

  // ── Complete ──────────────────────────────────────────────────────────
  private onComplete() {
    if (this.frozen) return;
    this.frozen = true;
    this.add.text(W / 2, H / 2, '✦  ГЛАВА 1 ПРОЙДЕНА  ✦', {
      fontFamily: 'Courier New', fontSize: '16px', color: '#a0ffc0', letterSpacing: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
  }
}
