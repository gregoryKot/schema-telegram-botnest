import Phaser from 'phaser';
import { W, H, GROUND_Y, S, PHYS } from '../constants';
import { CardOverlay } from '../ui/CardOverlay';

// ── Shared types ──────────────────────────────────────────────────────────────

export interface GapDef  { start: number; end: number; }
export interface PlatDef { x: number; w: number; y: number; }
export interface EnemyDef { id: string; x: number; angle: number; y?: number; }
// Unavoidable "mode" — a full-height zone the player MUST pass through.
export interface GateDef { id: string; x: number; }
// Oscillating platform (moving up/down or side to side).
export interface MovePlatDef { x: number; w: number; y: number; axis: 'x' | 'y'; range: number; speed: number; }

export interface LevelConfig {
  levelTitle: string;       // "ГЛАВА 1" etc.
  levelWidth: number;
  groundGaps: GapDef[];
  platforms: PlatDef[];
  enemyDefs: EnemyDef[];
  sageX: number;
  doorX: number;
  nextScene: string | null; // null = last level
  groundTileKey: string;    // texture key for ground tiles
  groundTileW: number;      // tile image width in px
  groundTileH: number;      // tile image height in px
  platTileKey: string;      // texture key for platform tiles
  platTileW: number;
  modeGates?: GateDef[];     // unavoidable mode encounters
  movePlats?: MovePlatDef[]; // moving platforms (Mario-style)
  darkenOnProgress?: boolean;// day darkens as you advance
}

interface EnemyObj {
  img: Phaser.GameObjects.Image;
  id: string; baseX: number; dir: number; active: boolean; phase: number;
}

interface PillEffect {
  id: string; remaining: number; speedMul: number;
  autoRight: boolean; noMove: boolean;
  clone?: Phaser.GameObjects.Sprite;
  zzzTexts?: Phaser.GameObjects.Text[];
}

const PILL_FX: Record<string, {
  label: string; tint: number; speedMul: number;
  autoRight?: boolean; shake?: boolean; noMove?: boolean; spawnClone?: boolean;
}> = {
  anxiety:         { label: '😰 тревога захлёстывает...',  tint: 0xFF8820, speedMul: 0.55, shake: true },
  procrastination: { label: '🛋️  не могу встать...',       tint: 0x5577AA, speedMul: 0, noMove: true  },
  phone:           { label: '📱 отвлёкся...',               tint: 0x3388FF, speedMul: 0.50 },
  irritation:      { label: '😤 несёт вперёд!',            tint: 0xFF4400, speedMul: 1.80, autoRight: true },
  selfcritic:      { label: '🪞 за тобой идёт тень...',    tint: 0xAA44DD, speedMul: 0.80, spawnClone: true },
};
const EFFECT_DURATION = 3500;

// ── Base class — all game logic ───────────────────────────────────────────────

export abstract class BaseLevelScene extends Phaser.Scene {
  protected abstract getLevelConfig(): LevelConfig;
  protected abstract buildBackground(): void;

  protected cfg!: LevelConfig;
  protected player!: Phaser.Physics.Arcade.Sprite;
  protected bgScrollLayer: Phaser.GameObjects.TileSprite | null = null;

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
  private frozen = false;
  private sageHit = false;

  private effect: PillEffect | null = null;
  private effectText!: Phaser.GameObjects.Text;
  private effectBar!: Phaser.GameObjects.Rectangle;

  private gates: { id: string; x: number; triggered: boolean }[] = [];
  private encounterCount: Record<string, number> = {};
  private movePlats: { rect: Phaser.GameObjects.Rectangle; imgs: Phaser.GameObjects.Image[]; def: MovePlatDef; phase: number; lastX: number; lastY: number }[] = [];
  private dayOverlay!: Phaser.GameObjects.Rectangle;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  create() {
    this.cfg = this.getLevelConfig();
    this.frozen = false;
    this.sageHit = false;
    this.enemies = [];
    this.colliders = [];
    this.effect = null;
    this.bgScrollLayer = null;
    this.gates = [];
    this.encounterCount = {};
    this.movePlats = [];
    this.card = new CardOverlay();

    this.buildBackground();
    this.buildWorld();
    this.spawnMovePlats();
    this.spawnPlayer();
    this.spawnEnemies();
    this.buildModeGates();
    this.spawnSage();
    this.buildDoor();
    this.buildHUD();
    this.dayOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x05060f, 0)
      .setScrollFactor(0).setDepth(60);
    this.setupInput();
    this.setupTouchControls();
    this.setupCamera();
  }

  // ── World ─────────────────────────────────────────────────────────────────

  private buildWorld() {
    const { groundTileKey, groundTileW, groundTileH, platTileKey, platTileW,
            groundGaps, platforms, levelWidth } = this.cfg;

    const tiles = Math.ceil(levelWidth / groundTileW) + 2;
    for (let i = 0; i < tiles; i++) {
      const tx = i * groundTileW;
      const inGap = groundGaps.some(g => tx < g.end && (tx + groundTileW) > g.start);
      if (!inGap)
        this.add.image(tx + groundTileW / 2, GROUND_Y + groundTileH / 2, groundTileKey).setDepth(2);
    }

    const allEdges = [0, ...groundGaps.flatMap(g => [g.start, g.end]), levelWidth];
    for (let i = 0; i < allEdges.length - 1; i += 2) {
      const sx = allEdges[i], ex = allEdges[i + 1], w = ex - sx;
      const gr = this.add.rectangle(sx + w / 2, GROUND_Y + 20, w, 40, 0, 0);
      this.physics.add.existing(gr, true);
      this.colliders.push(gr);
    }

    for (const p of platforms) {
      const cols = Math.ceil(p.w / platTileW);
      for (let i = 0; i < cols; i++)
        this.add.image(p.x + i * platTileW + platTileW / 2, p.y + platTileW / 2, platTileKey).setDepth(2);
      const pr = this.add.rectangle(p.x + p.w / 2, p.y + 5 * S, p.w, 10 * S, 0, 0);
      this.physics.add.existing(pr, true);
      this.colliders.push(pr);
    }
  }

  // ── Moving platforms (Mario-style) ──────────────────────────────────────────

  private spawnMovePlats() {
    const { platTileKey, platTileW } = this.cfg;
    for (const d of this.cfg.movePlats ?? []) {
      const imgs: Phaser.GameObjects.Image[] = [];
      const cols = Math.ceil(d.w / platTileW);
      for (let i = 0; i < cols; i++)
        imgs.push(this.add.image(d.x + i * platTileW + platTileW / 2, d.y + platTileW / 2, platTileKey).setDepth(2));
      const rect = this.add.rectangle(d.x + d.w / 2, d.y + 5 * S, d.w, 10 * S, 0, 0);
      this.physics.add.existing(rect, true);
      this.colliders.push(rect);
      this.movePlats.push({ rect, imgs, def: d, phase: Math.random() * Math.PI * 2, lastX: rect.x, lastY: rect.y });
    }
  }

  // ── Mode gates — unavoidable encounters ─────────────────────────────────────

  private buildModeGates() {
    for (const g of this.cfg.modeGates ?? []) {
      const fx = PILL_FX[g.id];
      const tint = fx?.tint ?? 0x8888ff;
      // Vertical fog column from ceiling to ground — the "wall" you must pass through
      const col = this.add.graphics().setDepth(3);
      col.fillStyle(tint, 0.10); col.fillRect(g.x - 34, 0, 68, GROUND_Y + 30);
      col.fillStyle(tint, 0.18); col.fillRect(g.x - 20, 0, 40, GROUND_Y + 30);
      col.fillStyle(tint, 0.30); col.fillRect(g.x - 6,  0, 12, GROUND_Y + 30);
      // Drifting motes
      for (let i = 0; i < 5; i++) {
        const m = this.add.rectangle(g.x + Phaser.Math.Between(-22, 22), Phaser.Math.Between(60, GROUND_Y - 20), 3, 3, tint, 0.6).setDepth(4);
        this.tweens.add({ targets: m, y: m.y - Phaser.Math.Between(30, 70), alpha: 0, duration: 1600 + i * 300, repeat: -1, delay: i * 280,
          onRepeat: () => { m.y = GROUND_Y - 20; m.x = g.x + Phaser.Math.Between(-22, 22); m.setAlpha(0.6); } });
      }
      this.gates.push({ id: g.id, x: g.x, triggered: false });
    }
  }

  private enterMode(id: string) {
    const count = (this.encounterCount[id] = (this.encounterCount[id] ?? 0) + 1);
    if (count === 1) {
      // First time — explain via card, THEN apply effect so player understands
      this.frozen = true;
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
      this.player.play('p-idle', true);
      const understood = Object.keys(this.encounterCount).length;
      this.card.show(id, 0, understood, () => {
        this.frozen = false;
        this.applyEffect(id);
      });
    } else {
      // Returning — no card, just the effect + a small caption "опять..."
      this.applyEffect(id);
      const cap = this.add.text(this.player.x, this.player.y - 70, 'опять...', {
        fontFamily: 'Courier New', fontSize: '12px', color: '#ccbbdd',
      }).setOrigin(0.5).setDepth(99).setAlpha(0);
      this.tweens.add({ targets: cap, alpha: 0.9, y: cap.y - 16, duration: 700, yoyo: true, hold: 500, onComplete: () => cap.destroy() });
    }
  }

  // ── Player ────────────────────────────────────────────────────────────────

  private spawnPlayer() {
    if (!this.anims.exists('p-idle'))
      this.anims.create({ key: 'p-idle', frames: this.anims.generateFrameNumbers('cat_idle', { start: 0, end: 11 }), frameRate: 8, repeat: -1 });
    if (!this.anims.exists('p-walk'))
      this.anims.create({ key: 'p-walk', frames: this.anims.generateFrameNumbers('cat_run',  { start: 0, end: 5  }), frameRate: 14, repeat: -1 });
    if (!this.anims.exists('p-jump'))
      this.anims.create({ key: 'p-jump', frames: [{ key: 'cat_run', frame: 2 }], frameRate: 1, repeat: 0 });

    this.player = this.physics.add.sprite(80, GROUND_Y - 20, 'cat_idle');
    this.player.setOrigin(0.5, 1).setScale(1.5).setCollideWorldBounds(false).setDepth(10);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(22, 30); body.setOffset(13, 16);
    this.player.play('p-idle');
    for (const col of this.colliders) this.physics.add.collider(this.player, col);

    // Soft glow around player — makes cat visible in dark scenes
    const glow = this.add.graphics().setDepth(9);
    glow.fillStyle(0xffffcc, 0.06); glow.fillCircle(0, 0, 38);
    glow.fillStyle(0xffffcc, 0.04); glow.fillCircle(0, 0, 55);
    this.player.setData('glow', glow);
  }

  // ── Enemies ───────────────────────────────────────────────────────────────

  private spawnEnemies() {
    for (const def of this.cfg.enemyDefs) {
      const ey = def.y ?? GROUND_Y;
      const img = this.add.image(def.x, ey, def.id)
        .setOrigin(0.5, 1).setDepth(5).setAngle(def.angle);
      // Platform enemies get a subtle glow so player can spot them
      if (def.y !== undefined) {
        const glow = this.add.graphics().setDepth(4);
        glow.fillStyle(0xffaa44, 0.12); glow.fillEllipse(def.x, ey - 5, 60, 20);
        img.setData('baseY', ey);
      }
      this.enemies.push({ img, id: def.id, baseX: def.x, dir: 1, active: true, phase: Math.random() * Math.PI * 2 });
    }
  }

  // ── Sage ──────────────────────────────────────────────────────────────────

  private spawnSage() {
    const sx = this.cfg.sageX;
    this.sage = this.add.image(sx, GROUND_Y, 'sage').setOrigin(0.5, 1).setDepth(5);
    const glow = this.add.graphics().setDepth(4);
    glow.fillStyle(0xa0ffc0, 0.06); glow.fillEllipse(sx, GROUND_Y - 40, 80, 100);
    this.add.text(sx, GROUND_Y - this.textures.get('sage').getSourceImage().height - 6,
      'М У Д Р Е Ц', { fontFamily: 'Courier New', fontSize: '8px', color: '#a0ffc0', letterSpacing: 3 })
      .setOrigin(0.5, 1).setDepth(6).setAlpha(0.7);
    for (let i = 0; i < 4; i++) {
      const px = sx + Phaser.Math.Between(-20, 20), py = GROUND_Y - Phaser.Math.Between(20, 80);
      const dot = this.add.rectangle(px, py, 3, 3, 0xa0ffc0, 0.6).setDepth(6);
      this.tweens.add({ targets: dot, y: py - Phaser.Math.Between(15, 30), alpha: 0,
        duration: 1800 + i * 400, repeat: -1, delay: i * 450,
        onRepeat: () => { dot.x = sx + Phaser.Math.Between(-20, 20); dot.y = py; dot.setAlpha(0.6); },
      });
    }
  }

  // ── Door ──────────────────────────────────────────────────────────────────

  private buildDoor() {
    const g = this.add.graphics().setDepth(4), dx = this.cfg.doorX;
    g.fillStyle(0x78350f); g.fillRect(dx - 4, GROUND_Y - 82, 58, 82);
    g.fillStyle(0xa16207); g.fillRoundedRect(dx, GROUND_Y - 78, 50, 78, 5);
    g.fillStyle(0xbae6fd, 0.55); g.fillRoundedRect(dx + 8, GROUND_Y - 68, 34, 22, 6);
    g.fillStyle(0xfbbf24); g.fillCircle(dx + 44, GROUND_Y - 34, 4);
    this.add.text(dx + 25, GROUND_Y - 96, '→', { fontFamily: 'Courier New', fontSize: '16px', color: '#a08fff' })
      .setOrigin(0.5).setDepth(6);
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  private buildHUD() {
    this.effectBar = this.add.rectangle(W / 2, H - 8, 0, 4, 0xFF8820)
      .setScrollFactor(0).setDepth(100).setAlpha(0);
    this.effectText = this.add.text(W / 2, H - 22, '', {
      fontFamily: 'Courier New', fontSize: '11px', color: '#ffcc88', letterSpacing: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0);
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA = this.input.keyboard!.addKey('A');
    this.keyD = this.input.keyboard!.addKey('D');
    this.keyW = this.input.keyboard!.addKey('W');
  }

  private setupTouchControls() {
    if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return;
    const container = document.getElementById('touch-controls')!;
    // Guard: only wire listeners once (persists across scene transitions)
    if (container.dataset.wired) return;
    container.dataset.wired = '1';
    container.classList.add('visible');
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

  // ── Camera ────────────────────────────────────────────────────────────────

  private setupCamera() {
    this.cameras.main.setBounds(0, 0, this.cfg.levelWidth, H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setFollowOffset(-W * 0.15, 0);
    this.physics.world.setBounds(0, -H, this.cfg.levelWidth, H * 3);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(_time: number, delta: number) {
    if (this.frozen || this.card.isVisible()) return;

    this.updateEffect(delta);

    const body    = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down;
    const spd     = PHYS.playerSpeed * (this.effect?.speedMul ?? 1);
    const left    = this.cursors.left.isDown  || this.keyA.isDown || this.touchInput.left;
    const right   = this.cursors.right.isDown || this.keyD.isDown || this.touchInput.right;
    const jump    = Phaser.Input.Keyboard.JustDown(this.cursors.up)
                 || Phaser.Input.Keyboard.JustDown(this.cursors.space)
                 || Phaser.Input.Keyboard.JustDown(this.keyW)
                 || this.consumeTouch();

    if (this.effect?.noMove) {
      body.setVelocityX(0);
    } else if (this.effect?.autoRight) {
      body.setVelocityX(spd); this.player.setFlipX(false);
    } else if (right)  { body.setVelocityX(spd);  this.player.setFlipX(false); }
    else if (left)     { body.setVelocityX(-spd); this.player.setFlipX(true); }
    else               { body.setVelocityX(body.velocity.x * 0.75); }

    if (jump && onGround && !this.effect?.noMove) body.setVelocityY(PHYS.jumpVel);

    if (!onGround) {
      if (this.player.anims.currentAnim?.key !== 'p-jump') this.player.play('p-jump', true);
    } else if (Math.abs(body.velocity.x) > 20) {
      this.player.play('p-walk', true);
    } else {
      this.player.play('p-idle', true);
    }

    if (this.bgScrollLayer)
      this.bgScrollLayer.tilePositionX = this.cameras.main.scrollX * 0.18;

    // Move glow with player
    const glow = this.player.getData('glow') as Phaser.GameObjects.Graphics | undefined;
    if (glow) { glow.x = this.player.x; glow.y = this.player.y - 20; }

    this.updateMovePlats();
    this.updateGates();

    // Day darkens as you advance — life grinding you down
    if (this.cfg.darkenOnProgress) {
      const prog = Phaser.Math.Clamp(this.player.x / this.cfg.doorX, 0, 1);
      this.dayOverlay.fillAlpha = prog * 0.5;
    }

    this.sageBob += delta * 0.002;
    this.sage.y = GROUND_Y - Math.abs(Math.sin(this.sageBob)) * 5;

    this.updateEnemies(delta);
    this.checkSage();
    if (this.player.x > this.cfg.doorX - 35) this.onComplete();
    if (this.player.y > H + 80) this.respawnFromFall();
  }

  private updateGates() {
    if (this.effect || this.frozen) return;
    for (const g of this.gates) {
      if (!g.triggered && this.player.x > g.x - 18 && this.player.x < g.x + 40) {
        g.triggered = true;
        this.enterMode(g.id);
        break;
      }
    }
  }

  private updateMovePlats() {
    for (const mp of this.movePlats) {
      mp.phase += 0.016 * mp.def.speed;
      const offset = Math.sin(mp.phase) * mp.def.range;
      const nx = mp.def.axis === 'x' ? mp.def.x + mp.def.w / 2 + offset : mp.rect.x;
      const ny = mp.def.axis === 'y' ? mp.def.y + 5 * S + offset : mp.rect.y;
      const dx = nx - mp.lastX, dy = ny - mp.lastY;
      // Carry the player if standing on this platform
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const onIt = body.blocked.down
        && Math.abs(this.player.x - mp.rect.x) < mp.def.w / 2 + 14
        && Math.abs((this.player.y) - (mp.rect.y - 5 * S)) < 22;
      if (onIt) { this.player.x += dx; this.player.y += dy; }
      mp.rect.x = nx; mp.rect.y = ny;
      (mp.rect.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
      const baseImgX = mp.def.axis === 'x' ? nx - mp.def.w / 2 : mp.def.x;
      mp.imgs.forEach((img, i) => {
        img.x = baseImgX + i * (this.cfg.platTileW) + this.cfg.platTileW / 2;
        img.y = ny - 5 * S + this.cfg.platTileW / 2;
      });
      mp.lastX = nx; mp.lastY = ny;
    }
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

  private respawnFromFall() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    // Find which gap the player fell into and respawn BEFORE it
    let safeX = Math.max(80, this.player.x - 80);
    for (const gap of this.cfg.groundGaps) {
      if (this.player.x >= gap.start - 30 && this.player.x <= gap.end + 30) {
        safeX = Math.max(80, gap.start - 100);
        break;
      }
    }
    body.reset(safeX, GROUND_Y - 60);
    body.setVelocity(0, 0);
    this.clearEffect();
    this.cameras.main.shake(280, 0.009);
    this.player.setAlpha(0.3);
    this.tweens.add({ targets: this.player, alpha: 1, duration: 600 });
  }

  // ── Effect system ─────────────────────────────────────────────────────────

  private applyEffect(id: string) {
    const fx = PILL_FX[id];
    if (!fx) return;
    this.effect = { id, remaining: EFFECT_DURATION, speedMul: fx.speedMul, autoRight: fx.autoRight ?? false, noMove: fx.noMove ?? false };
    this.player.setTint(fx.tint);
    if (fx.shake) this.cameras.main.shake(600, 0.004);

    if (fx.noMove) {
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
      this.tweens.add({ targets: this.player, scaleX: 2.5, scaleY: 0.4, duration: 280, ease: 'Power2' });
      this.effect.zzzTexts = ['z', 'z z', 'Z Z Z'].map((txt, i) => {
        const t = this.add.text(W / 2, GROUND_Y - 55 - i * 26, txt, {
          fontFamily: 'Courier New', fontSize: `${10 + i * 3}px`, color: '#88aacc', letterSpacing: 3,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(99).setAlpha(0);
        this.tweens.add({ targets: t, alpha: 0.85, y: t.y - 6, duration: 500, delay: i * 200, yoyo: true, hold: 600, repeat: -1 });
        return t;
      });
    }

    if (fx.spawnClone) {
      const clone = this.add.sprite(this.player.x - 90, this.player.y, 'cat_idle');
      clone.setOrigin(0.5, 1).setScale(1.5).setDepth(9).setTint(0x220033).setAlpha(0).play('p-walk');
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

    if (this.effect.clone) {
      const clone = this.effect.clone;
      const dx = this.player.x - clone.x;
      clone.x += Math.sign(dx) * 110 * (delta / 1000);
      clone.y = this.player.y;
      clone.setFlipX(dx < 0);
      if (Math.abs(dx) < 22) { this.cameras.main.flash(180, 180, 0, 80); clone.x = this.player.x - 120; }
    }

    if (this.effect.remaining <= 0) this.clearEffect();
  }

  protected clearEffect() {
    if (!this.effect) return;
    if (this.effect.clone) {
      const c = this.effect.clone;
      this.tweens.add({ targets: c, alpha: 0, scaleX: 0.1, duration: 400, onComplete: () => c.destroy() });
    }
    this.effect.zzzTexts?.forEach(t => {
      this.tweens.killTweensOf(t);
      this.tweens.add({ targets: t, alpha: 0, duration: 200, onComplete: () => t.destroy() });
    });
    this.player.setAngle(0).clearTint();
    this.tweens.add({ targets: this.player, scaleX: 1.5, scaleY: 1.5, duration: 250, ease: 'Back.Out' });
    this.effectText.setAlpha(0);
    this.tweens.add({ targets: this.effectBar, width: 0, alpha: 0, duration: 300 });
    this.effect = null;
  }

  // ── Enemy logic ───────────────────────────────────────────────────────────

  private updateEnemies(delta: number) {
    for (const e of this.enemies) {
      if (!e.active) continue;
      e.phase += delta * 0.0025;
      const baseY = (e.img.getData('baseY') as number) ?? GROUND_Y;
      e.img.y = baseY - Math.abs(Math.sin(e.phase)) * 5;
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
    this.time.delayedCall(6000, () => {
      e.active = true;
      e.baseX = this.player.x + W * 0.7 + Phaser.Math.Between(60, 200);
      e.img.x = e.baseX;
      e.img.setAlpha(0).setScale(1);
      this.tweens.add({ targets: e.img, alpha: 1, duration: 500 });
    });
  }

  // ── Sage ──────────────────────────────────────────────────────────────────

  private checkSage() {
    if (this.sageHit) return;
    if (Math.abs(this.player.x - this.sage.x) < 50) {
      this.sageHit = true;
      this.frozen = true;
      // Stop the cat cleanly — no running-in-place on the sage
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(0);
      this.player.play('p-idle', true);
      this.clearEffect();
      this.card.showSage(() => { this.frozen = false; });
    }
  }

  // ── Complete ──────────────────────────────────────────────────────────────

  private onComplete() {
    if (this.frozen) return;
    this.frozen = true;

    const completeText = this.add.text(W / 2, H / 2 - 20, `✦  ${this.cfg.levelTitle} ПРОЙДЕНА  ✦`, {
      fontFamily: 'Courier New', fontSize: '16px', color: '#a0ffc0', letterSpacing: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);

    this.tweens.add({ targets: completeText, alpha: 1, duration: 600 });

    if (this.cfg.nextScene) {
      const next = this.cfg.nextScene;
      this.add.text(W / 2, H / 2 + 18, 'продолжить →', {
        fontFamily: 'Courier New', fontSize: '13px', color: '#ffcc88', letterSpacing: 2,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0.8);
      this.time.delayedCall(2800, () => this.scene.start(next));
    }
  }
}
