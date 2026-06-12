import Phaser from 'phaser';
import { W, H, GROUND_Y, S, PHYS } from '../constants';
import { audio } from '../audio';
import { CHAPTERS, DEFAULT_CHAPTER, ChapterConfig } from '../chapters';
import { HomeMob, MobCtx, Procrastination, PhoneMob, Irritation, makeHomeTextures } from '../enemies/home';
import { buildDecor } from '../decor';

// ════════════════════════════════════════════════════════════════════════════
//  GAME — the gameplay engine. A "chapter" (config in chapters.ts) supplies the
//  level data; this scene just runs it. Core: fight / freeze / flee.
// ════════════════════════════════════════════════════════════════════════════

const RUN_SPEED = 250;
const DASH_SPEED = 560;
const DASH_MS   = 170;
const DASH_CD   = 480;
const ATTACK_MS = 170;
const ATTACK_CD = 300;
const ATTACK_RANGE = 72;

type AnxState = 'chase' | 'windup' | 'lunge' | 'calm';
interface Anx {
  img: Phaser.GameObjects.Image; state: AnxState; t: number; size: number;
  vx: number; vy: number; jit: number; calm: number; cd: number; alive: boolean;
}
interface Critic {
  img: Phaser.GameObjects.Sprite; size: number; struck: number; alive: boolean;
}
// Боевой гейт: стена «не пройти, пока не разобрался» — падает, когда все
// привязанные враги разрешены (убиты / успокоены / выключены).
interface Gate {
  x: number; col: Phaser.GameObjects.Rectangle; gfx: Phaser.GameObjects.Graphics;
  mobs: { alive: boolean }[]; open: boolean; t: number;
}

export class GameScene extends Phaser.Scene {
  private chapter!: ChapterConfig;
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  private anx: Anx[] = [];
  private critic: Critic | null = null;
  private homeMobs: HomeMob[] = [];
  private gates: Gate[] = [];
  private speedMult = 1;
  private trail: { x: number; y: number; flip: boolean }[] = [];

  private hearts = 3;
  private heartsText!: Phaser.GameObjects.Text;
  private invuln = 0;
  private checkpointX = 100;
  private dead = false;

  private floorColliders: Phaser.GameObjects.Rectangle[] = [];
  private spikeRects: { x: number; w: number }[] = [];
  private heartPickups: Phaser.GameObjects.Image[] = [];
  private readonly MAX_HEARTS = 5;

  // moves
  private attacking = false; private attackT = 0; private attackCd = 0;
  private attackHit = new Set<object>();
  private dashing = false; private dashT = 0; private dashCd = 0; private dashDir = 1;
  private frozen = false; private freezePulseT = 0;
  private slash!: Phaser.GameObjects.Graphics;
  private calmRing!: Phaser.GameObjects.Graphics;
  private playerLight!: Phaser.GameObjects.Graphics;

  private hitstop = 0;
  private overwhelmed = false;
  private triggers: { x: number; done: boolean; fn: () => void }[] = [];
  private wasFrozen = false;

  private bubble!: Phaser.GameObjects.Text; private bubbleT = 0;
  private said = new Set<string>();

  constructor() { super('Game'); }

  init(data: { chapter?: string }) {
    this.chapter = CHAPTERS[data?.chapter ?? DEFAULT_CHAPTER] ?? CHAPTERS[DEFAULT_CHAPTER];
  }

  create() {
    const ARENA_W = this.chapter.arenaW;
    Object.assign(this, {
      anx: [], critic: null, homeMobs: [], speedMult: 1, trail: [], hearts: 3, invuln: 0, checkpointX: 100,
      dead: false, attacking: false, attackCd: 0, dashing: false, dashCd: 0,
      frozen: false, hitstop: 0, overwhelmed: false, wasFrozen: false,
    });
    this.said = new Set();
    this.attackHit = new Set();
    this.triggers = []; this.gates = [];
    this.floorColliders = []; this.platColliders = []; this.spikeRects = []; this.heartPickups = [];

    this.buildBackground();
    buildDecor(this, this.chapter);
    this.buildGround();
    this.buildPlatforms();
    this.buildSpikes();
    this.makeTextures();
    makeHomeTextures(this);
    this.buildHearts();
    this.spawnPlayer();
    this.buildHUD();
    this.setupInput();
    this.setupTriggers();

    this.cameras.main.setBounds(0, 0, ARENA_W, H);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.physics.world.setBounds(0, -H, ARENA_W, H * 3);
    this.cameras.main.fadeIn(600, 8, 6, 16);
    this.showTitleCard();

    // start music on the first input (browsers require a gesture)
    audio.setMode(this.chapter.music);
    const begin = () => { audio.ensure(); audio.startMusic(); };
    this.input.keyboard!.once('keydown', begin);
    this.input.once('pointerdown', begin);
    audio.startMusic(); // in case the context is already unlocked (came from menu)
  }

  // Титульная карточка: где ты и какое у этого места настроение
  private showTitleCard() {
    const mk = (y: number, text: string, size: number, color: string) =>
      this.add.text(W / 2, y, text, { fontFamily: 'Courier New', fontSize: `${size}px`, color, letterSpacing: 3, align: 'center' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(120).setAlpha(0);
    const t1 = mk(170, this.chapter.title.toUpperCase(), 30, '#fff0d8');
    const t2 = mk(208, this.chapter.tagline, 13, '#9a8fb8');
    this.tweens.add({ targets: [t1, t2], alpha: 1, duration: 700, delay: 350 });
    this.tweens.add({ targets: [t1, t2], alpha: 0, duration: 800, delay: 3200, onComplete: () => { t1.destroy(); t2.destroy(); } });
  }

  // ── Atmosphere — inside a restless mind ─────────────────────────────────────
  private buildBackground() {
    const ARENA_W = this.chapter.arenaW;
    const pal = this.chapter.palette;
    const g = this.add.graphics().setScrollFactor(0).setDepth(-9);
    g.fillGradientStyle(pal.skyTop, pal.skyTop, pal.skyBot, pal.skyBot, 1, 1, 1, 1);
    g.fillRect(0, 0, W, H);
    // distant glow lighting the play zone
    const glow = this.add.graphics().setScrollFactor(0).setDepth(-8);
    glow.fillStyle(pal.glow1, 0.30); glow.fillEllipse(W / 2, GROUND_Y - 10, W * 1.6, 320);
    glow.fillStyle(pal.glow2, 0.22); glow.fillEllipse(W / 2, GROUND_Y - 10, W * 1.0, 220);
    // drifting "thought" motes (parallax)
    for (let layer = 0; layer < 2; layer++) {
      const depth = layer === 0 ? -7 : -3;
      const sf = layer === 0 ? 0.2 : 0.5;
      const cont = this.add.container(0, 0).setScrollFactor(sf).setDepth(depth);
      for (let i = 0; i < 14; i++) {
        const m = this.add.rectangle(Phaser.Math.Between(0, ARENA_W), Phaser.Math.Between(40, GROUND_Y - 30),
          2 + layer, 2 + layer, pal.mote, 0.18 + layer * 0.12);
        cont.add(m);
        this.tweens.add({ targets: m, y: m.y - Phaser.Math.Between(20, 60), x: m.x + Phaser.Math.Between(-30, 30),
          alpha: 0, duration: 4000 + Math.random() * 3000, repeat: -1, delay: i * 300,
          onRepeat: () => { m.y = GROUND_Y - 30; m.x = Phaser.Math.Between(0, ARENA_W); m.alpha = 0.2; } });
      }
    }
    // low fog band
    const fog = this.add.graphics().setScrollFactor(0).setDepth(-2);
    fog.fillGradientStyle(pal.fog, pal.fog, pal.fog, pal.fog, 0, 0, 0.55, 0.55);
    fog.fillRect(0, GROUND_Y - 80, W, 90);
    // vignette (soft)
    const vig = this.add.graphics().setScrollFactor(0).setDepth(58);
    vig.fillStyle(0x000000, 0.28);
    vig.fillRect(0, 0, W, 16); vig.fillRect(0, H - 16, W, 16);
    vig.fillRect(0, 0, 28, H); vig.fillRect(W - 28, 0, 28, H);
  }

  private buildGround() {
    const ARENA_W = this.chapter.arenaW, pits = this.chapter.pits;
    const tw = 16 * S, th = 16 * S;
    const n = Math.ceil(ARENA_W / tw) + 2;
    for (let i = 0; i < n; i++) {
      const tx = i * tw;
      if (pits.some(p => tx < p.e && tx + tw > p.s)) continue;
      const groundTex = this.chapter.theme === 'room' ? 'ground_room' : 'ground';
      this.add.image(tx + tw / 2, GROUND_Y + th / 2, groundTex).setDepth(2).setTint(this.chapter.palette.groundTint);
    }
    const edges = [0, ...pits.flatMap(p => [p.s, p.e]), ARENA_W];
    for (let i = 0; i < edges.length - 1; i += 2) {
      const sx = edges[i], ex = edges[i + 1], w = ex - sx;
      const r = this.add.rectangle(sx + w / 2, GROUND_Y + 20, w, 40, 0, 0);
      this.physics.add.existing(r, true);
      this.floorColliders.push(r);
    }
  }

  // ── Level geometry: a deliberate line — intro · gaps · spikes · climb · gauntlet
  private buildPlatforms() {
    const tw = 16 * S, th = 10 * S;
    const P = this.chapter.platforms;
    const platTex = this.chapter.theme === 'room' ? 'plat_room' : 'plat';
    for (const p of P) {
      const cols = Math.ceil(p.w / tw);
      for (let i = 0; i < cols; i++)
        this.add.image(p.x + i * tw + tw / 2, p.y + th / 2, platTex).setDepth(2).setTint(this.chapter.palette.platTint);
      const r = this.add.rectangle(p.x + p.w / 2, p.y + 5 * S, p.w, th, 0, 0);
      this.physics.add.existing(r, true);
      this.platColliders.push(r);
    }
  }
  private platColliders: Phaser.GameObjects.Rectangle[] = [];

  // ── Spikes — sharp intrusive thoughts; touching costs a heart ───────────────
  private buildSpikes() {
    const defs = this.chapter.spikes;
    for (const d of defs) {
      const g = this.add.graphics().setDepth(3);
      const n = Math.floor(d.w / 16);
      for (let i = 0; i < n; i++) {
        const sx = d.x + i * 16;
        g.fillStyle(0x2a1330, 1); g.fillTriangle(sx, GROUND_Y, sx + 16, GROUND_Y, sx + 8, GROUND_Y - 22);
        g.fillStyle(0xb04050, 1); g.fillTriangle(sx + 5, GROUND_Y, sx + 11, GROUND_Y, sx + 8, GROUND_Y - 20);
      }
      this.spikeRects.push({ x: d.x, w: d.w });
    }
  }

  // ── Hearts — scattered; some easy, some high over gaps (reach for it) ───────
  private buildHearts() {
    const spots = this.chapter.hearts;
    for (const s of spots) {
      const img = this.add.image(s.x, s.y, 'heartpk').setDepth(7);
      this.tweens.add({ targets: img, y: s.y - 8, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.heartPickups.push(img);
    }
  }

  // Story beats fire as you ADVANCE — running right = the day passing toward dusk
  private setupTriggers() {
    this.triggers = this.chapter.triggers.map(t => ({
      x: t.x, done: false,
      fn: () => {
        const beforeA = this.anx.length, beforeH = this.homeMobs.length;
        if (t.anx) for (let i = 0; i < t.anx; i++) this.spawnAnx(this.player.x + 360 + i * 120, 1);
        if (t.critic) this.spawnCritic();
        if (t.proc) this.homeMobs.push(new Procrastination(this.mobCtx(), t.proc, t.seat ? GROUND_Y - t.seat : undefined));
        if (t.phone) this.homeMobs.push(new PhoneMob(this.mobCtx(), t.phone));
        if (t.irrit) this.homeMobs.push(new Irritation(this.mobCtx(), t.irrit));
        if (t.say) { this.say(t.say, 2400); if (t.anx) audio.anx(); }
        if (t.gate) this.makeGate(t.gate, [...this.anx.slice(beforeA), ...this.homeMobs.slice(beforeH)]);
        if (t.overwhelm) this.beginOverwhelm();
      },
    }));
  }
  // shared context the home-chapter mobs use to read/affect the player
  private mobCtx(): MobCtx {
    return {
      scene: this,
      player: () => this.player,
      frozen: () => this.frozen,
      dashing: () => this.dashing,
      damage: (fromX) => { if (this.invuln <= 0) this.damage(fromX); },
      sayOnce: (k, t, d) => this.sayOnce(k, t, d),
      burst: (x, y, c, n, sp) => this.burst(x, y, c, n, sp),
      hitstop: (ms) => this.doHitstop(ms),
      slow: (m) => { this.speedMult = Math.min(this.speedMult, m); },
    };
  }

  private updateTriggers() {
    for (const t of this.triggers) {
      if (!t.done && this.player.x > t.x) { t.done = true; t.fn(); }
    }
  }

  // ── Гейты: дальше нельзя, пока не разобрался с тем, что навалилось ─────────
  private makeGate(x: number, mobs: { alive: boolean }[]) {
    const col = this.add.rectangle(x, GROUND_Y / 2, 18, GROUND_Y + 40, 0, 0);
    this.physics.add.existing(col, true);
    this.physics.add.collider(this.player, col, () =>
      this.sayOnce('gate', 'не пройти... сначала разберись с этим.', 2600));
    const gfx = this.add.graphics().setDepth(5);
    this.gates.push({ x, col, gfx, mobs, open: false, t: Math.random() * 1000 });
  }

  private updateGates(dt: number) {
    const color = this.chapter.palette.glow2;
    for (const g of this.gates) {
      if (g.open) continue;
      g.t += dt;
      if (g.mobs.length && g.mobs.every(m => !m.alive)) { this.openGate(g); continue; }
      g.gfx.clear();
      for (let y = 26; y < GROUND_Y - 6; y += 26) {
        const a = 0.30 + 0.18 * Math.sin(g.t * 0.005 + y * 0.35);
        g.gfx.fillStyle(color, a);
        g.gfx.fillRect(g.x - 7 + Math.sin(g.t * 0.003 + y) * 3, y, 14, 18);
      }
      g.gfx.fillStyle(color, 0.12);
      g.gfx.fillEllipse(g.x, GROUND_Y - 2, 70, 12);
    }
  }

  private openGate(g: Gate) {
    g.open = true;
    g.gfx.clear();
    g.col.destroy();
    for (let y = 60; y < GROUND_Y; y += 90) this.burst(g.x, y, this.chapter.palette.glow2, 6, 120);
    audio.gate();
    this.sayOnce('gate_open', '...прошло. можно идти дальше.', 2400);
  }

  // тревога, отколовшаяся от «гейтовой», тоже держит стену
  private adoptIntoGate(parent: object, child: object) {
    const g = this.gates.find(g => !g.open && g.mobs.includes(parent as { alive: boolean }));
    if (g) g.mobs.push(child as { alive: boolean });
  }

  private makeTextures() {
    if (!this.textures.exists('anxmob')) {
      const g = this.add.graphics(); const u = S, R = 11;
      g.fillStyle(0x6a2a8a, 0.35); g.fillCircle(R*u, R*u, R*u);
      g.fillStyle(0x3a1050, 1);    g.fillCircle(R*u, R*u, (R-2)*u);
      g.fillStyle(0x551a78, 1);    g.fillCircle(R*u, (R-1.5)*u, (R-4)*u);
      g.fillStyle(0xffe066, 1);    g.fillCircle((R-3)*u, R*u, 2*u); g.fillCircle((R+3)*u, R*u, 2*u);
      g.fillStyle(0x1a0010, 1);    g.fillCircle((R-3)*u, R*u, 1*u); g.fillCircle((R+3)*u, R*u, 1*u);
      g.generateTexture('anxmob', R*2*u, R*2*u); g.destroy();
    }
    if (!this.textures.exists('heartpk')) {
      const g = this.add.graphics(); const u = S;
      g.fillStyle(0xff5577, 0.25); g.fillCircle(7*u, 7*u, 8*u);  // glow
      g.fillStyle(0xff3366, 1);
      g.fillCircle(4.5*u, 5*u, 3*u); g.fillCircle(9.5*u, 5*u, 3*u);
      g.fillTriangle(1.5*u, 6*u, 12.5*u, 6*u, 7*u, 12.5*u);
      g.fillStyle(0xffaacc, 0.9); g.fillCircle(5*u, 4.5*u, 1.2*u); // highlight
      g.generateTexture('heartpk', 14*u, 14*u); g.destroy();
    }
  }

  // ── Player ───────────────────────────────────────────────────────────────--
  private spawnPlayer() {
    if (!this.anims.exists('p-idle'))
      this.anims.create({ key: 'p-idle', frames: this.anims.generateFrameNumbers('cat_idle', { start: 0, end: 11 }), frameRate: 8, repeat: -1 });
    if (!this.anims.exists('p-walk'))
      this.anims.create({ key: 'p-walk', frames: this.anims.generateFrameNumbers('cat_run', { start: 0, end: 5 }), frameRate: 16, repeat: -1 });
    if (!this.anims.exists('p-jump'))
      this.anims.create({ key: 'p-jump', frames: [{ key: 'cat_run', frame: 2 }], frameRate: 1, repeat: 0 });

    this.player = this.physics.add.sprite(100, GROUND_Y - 20, 'cat_idle').setOrigin(0.5, 1).setScale(1.5).setDepth(10);
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    b.setSize(22, 30); b.setOffset(13, 16);
    this.player.play('p-idle');
    for (const r of this.floorColliders) this.physics.add.collider(this.player, r);
    for (const r of this.platColliders) this.physics.add.collider(this.player, r);

    // soft light pool — keeps the cat readable in the dark, "your small light"
    this.playerLight = this.add.graphics().setDepth(1);
    this.playerLight.fillStyle(0xffe9c0, 0.10); this.playerLight.fillCircle(0, 0, 90);
    this.playerLight.fillStyle(0xffe9c0, 0.07); this.playerLight.fillCircle(0, 0, 130);

    this.slash = this.add.graphics().setDepth(11);
    this.calmRing = this.add.graphics().setDepth(8);
    this.bubble = this.add.text(0, 0, '', { fontFamily: 'Courier New', fontSize: '15px', color: '#fff0d8',
      backgroundColor: 'rgba(16,12,30,0.88)', padding: { x: 9, y: 5 }, align: 'center' })
      .setOrigin(0.5, 1).setDepth(45).setAlpha(0);
  }

  private buildHUD() {
    this.heartsText = this.add.text(18, 14, '', { fontFamily: 'Courier New', fontSize: '24px', color: '#ff5577' })
      .setScrollFactor(0).setDepth(100);
    this.updateHearts();
    this.add.text(W / 2, H - 20, 'J удар   ·   K замри   ·   SHIFT рывок', { fontFamily: 'Courier New', fontSize: '11px', color: '#6a5f8a' })
      .setOrigin(0.5, 1).setScrollFactor(0).setDepth(100);
  }
  private updateHearts() {
    this.heartsText.setText('♥'.repeat(Math.max(0, this.hearts)) + '·'.repeat(Math.max(0, 3 - this.hearts)));
  }

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = {
      A: this.input.keyboard!.addKey('A'), D: this.input.keyboard!.addKey('D'),
      W: this.input.keyboard!.addKey('W'), J: this.input.keyboard!.addKey('J'),
      K: this.input.keyboard!.addKey('K'), SHIFT: this.input.keyboard!.addKey('SHIFT'),
    };
  }

  // ── Spawns ───────────────────────────────────────────────────────────────--
  private spawnAnx(x: number, size: number) {
    const img = this.add.image(x, GROUND_Y - 44, 'anxmob').setDepth(6).setScale(size);
    this.anx.push({ img, state: 'chase', t: 0, size, vx: 0, vy: 0, jit: Math.random()*6, calm: 0, cd: 0, alive: true });
  }
  private spawnCritic() {
    if (this.critic) return;
    const img = this.add.sprite(this.player.x - 200, this.player.y, 'cat_idle')
      .setOrigin(0.5, 1).setScale(1.5).setDepth(9).setTint(0x1a0030).setAlpha(0).play('p-walk');
    this.tweens.add({ targets: img, alpha: 0.82, duration: 600 });
    this.critic = { img, size: 1, struck: 0, alive: true };
    this.say('...а это — я? за спиной?', 2600);
  }

  // ── Main loop ────────────────────────────────────────────────────────────--
  update(_t: number, delta: number) {
    if (this.dead) return;
    if (this.hitstop > 0) { this.hitstop -= delta; return; }
    const dt = delta;
    this.speedMult = 1;
    for (const m of this.homeMobs) m.update(dt);     // могут замедлить игрока на этот кадр
    this.homeMobs = this.homeMobs.filter(m => m.alive);
    this.updateMoves(dt);
    this.updateAttack(dt);
    this.updateAnx(dt);
    this.updateCritic(dt);
    this.updateTriggers();
    this.updateGates(dt);
    this.updateHazards();
    this.updateBubble(dt);
    if (this.invuln > 0) this.invuln -= dt;
    if (this.player.y > H + 70) this.fallRespawn();
  }

  private updateHazards() {
    const px = this.player.x, py = this.player.y;
    // spikes — touching the ground band over a spike strip costs a heart
    if (this.invuln <= 0 && py > GROUND_Y - 26) {
      for (const s of this.spikeRects) {
        if (px > s.x && px < s.x + s.w) { this.damage(px); break; }
      }
    }
    // heart pickups
    for (const h of this.heartPickups) {
      if (!h.active) continue;
      if (Phaser.Math.Distance.Between(px, py - 22, h.x, h.y) < 32) {
        h.destroy();
        if (this.hearts < this.MAX_HEARTS) { this.hearts++; this.updateHearts(); }
        audio.pickup();
        this.burst(h.x, h.y, 0xff6688, 8, 110);
      }
    }
  }

  private fallRespawn() {
    const cp = [...this.chapter.checkpoints].reverse().find(c => c <= this.player.x) ?? 100;
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    b.reset(cp, GROUND_Y - 60); b.setVelocity(0, 0);
    this.cameras.main.shake(160, 0.008);
    this.player.setAlpha(0.35);
    this.tweens.add({ targets: this.player, alpha: 1, duration: 450 });
  }

  private updateMoves(dt: number) {
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = b.blocked.down;
    const left  = this.cursors.left.isDown  || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const jump  = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.cursors.space) || Phaser.Input.Keyboard.JustDown(this.keys.W);
    const hit   = Phaser.Input.Keyboard.JustDown(this.keys.J);
    const dash  = Phaser.Input.Keyboard.JustDown(this.keys.SHIFT);
    this.frozen = this.keys.K.isDown && onGround && !this.dashing && !this.attacking;
    if (this.frozen && !this.wasFrozen) audio.freeze();
    this.wasFrozen = this.frozen;

    // light pool follows the cat
    this.playerLight.x = this.player.x; this.playerLight.y = this.player.y - 22;

    // record trail for the self-critic mirror
    this.trail.push({ x: this.player.x, y: this.player.y, flip: this.player.flipX });
    if (this.trail.length > 90) this.trail.shift();

    if (this.dashCd > 0) this.dashCd -= dt;

    // ── ЗАМРИ ──
    if (this.frozen) {
      b.setVelocityX(0);
      this.player.setScale(1.65, 1.35);
      this.player.play('p-idle', true);
      this.freezePulseT += dt;
      this.drawCalmRing();
    } else {
      this.calmRing.clear();
      this.player.setScale(1.5, 1.5);
    }

    // ── РЫВОК (dash) — i-frames + afterimage ──
    if (dash && this.dashCd <= 0 && !this.frozen) {
      this.dashing = true; this.dashT = DASH_MS; this.dashCd = DASH_CD;
      this.dashDir = (left && !right) ? -1 : (right ? 1 : (this.player.flipX ? -1 : 1));
      this.player.setFlipX(this.dashDir < 0);
      this.invuln = Math.max(this.invuln, DASH_MS + 40);
      b.setAllowGravity(false); b.setVelocityY(0);
      this.burst(this.player.x - this.dashDir * 14, this.player.y - 18, 0x9fd0ff, 6, 90);
      audio.dash();
    }
    if (this.dashing) {
      this.dashT -= dt;
      b.setVelocityX(this.dashDir * DASH_SPEED);
      this.ghost();
      if (this.dashT <= 0) { this.dashing = false; b.setAllowGravity(true); }
    } else if (!this.frozen) {
      // ── БЕГИ ──
      const run = RUN_SPEED * this.speedMult;
      if (this.attacking) b.setVelocityX(this.player.flipX ? -50 : 50);
      else if (right) { b.setVelocityX(run); this.player.setFlipX(false); }
      else if (left)  { b.setVelocityX(-run); this.player.setFlipX(true); }
      else            { b.setVelocityX(b.velocity.x * 0.7); }
      if (jump && onGround) { b.setVelocityY(PHYS.jumpVel); this.player.setScale(1.35, 1.7); audio.jump(); }
      if (!onGround) { if (this.player.anims.currentAnim?.key !== 'p-jump') this.player.play('p-jump', true); }
      else if (Math.abs(b.velocity.x) > 20) this.player.play('p-walk', true);
      else this.player.play('p-idle', true);
    }

    // ── БЕЙ ──
    if (hit && this.attackCd <= 0 && !this.frozen && !this.dashing) {
      this.attacking = true; this.attackT = ATTACK_MS; this.attackCd = ATTACK_CD; this.attackHit.clear();
    }

    this.player.setAlpha(this.invuln > 0 && !this.dashing ? (Math.sin(this.invuln * 0.05) * 0.5 + 0.5) : 1);
  }

  private updateAttack(dt: number) {
    if (this.attackCd > 0) this.attackCd -= dt;
    this.slash.clear();
    if (!this.attacking) return;
    this.attackT -= dt;
    const dir = this.player.flipX ? -1 : 1;
    const cx = this.player.x + dir * 34, cy = this.player.y - 22;
    const prog = 1 - this.attackT / ATTACK_MS;
    this.slash.lineStyle(5, 0xfff0d8, 1 - prog * 0.8);
    this.slash.beginPath();
    this.slash.arc(cx, cy, 28, (-0.8 + prog * 1.4) * dir, (0.8 + prog * 1.4) * dir, dir < 0);
    this.slash.strokePath();

    for (const m of this.anx) {
      if (!m.alive || this.attackHit.has(m)) continue;
      const dx = m.img.x - this.player.x, dy = m.img.y - (this.player.y - 22);
      if (dx * dir > -12 && Math.abs(dx) < ATTACK_RANGE && Math.abs(dy) < 52) { this.attackHit.add(m); this.hitAnx(m, dir); }
    }
    for (const m of this.homeMobs) {
      if (!m.alive || this.attackHit.has(m)) continue;
      if (m.tryHit(dir, ATTACK_RANGE)) this.attackHit.add(m);
    }
    if (this.critic && this.critic.alive && !this.attackHit.has(this.critic)) {
      const dx = this.critic.img.x - this.player.x;
      if (dx * dir > -12 && Math.abs(dx) < ATTACK_RANGE && Math.abs(this.critic.img.y - this.player.y) < 60) {
        this.attackHit.add(this.critic); this.hitCritic();
      }
    }
    if (this.attackT <= 0) this.attacking = false;
  }

  // ── Anxiety: fighting splits it, freezing calms it ──────────────────────────
  private hitAnx(m: Anx, dir: number) {
    m.vx = dir * 300; m.vy = -140; m.state = 'chase'; m.cd = 600;
    this.doHitstop(55); this.cameras.main.shake(70, 0.005); audio.hit();
    this.burst(m.img.x, m.img.y, 0xaa55cc, 8, 130);
    if (m.size > 0.55) {
      m.size *= 0.7; m.img.setScale(m.size);
      this.spawnAnx(m.img.x, m.size);
      const nb = this.anx[this.anx.length - 1]; nb.vx = -dir * 220; nb.vy = -110;
      this.adoptIntoGate(m, nb);
      audio.split();
      this.sayOnce('hit', 'бить бесполезно — их только больше!', 2600);
    } else {
      m.alive = false;
      this.tweens.add({ targets: m.img, alpha: 0, scale: 0, duration: 180, onComplete: () => m.img.destroy() });
    }
  }

  // ── Self-critic: fighting it only makes it bigger ───────────────────────────
  private hitCritic() {
    if (!this.critic) return;
    this.doHitstop(50); this.cameras.main.shake(90, 0.006); audio.hit();
    this.critic.size = Math.min(2.4, this.critic.size + 0.22);
    this.critic.img.setScale(1.5 * this.critic.size);
    this.burst(this.critic.img.x, this.critic.img.y - 20, 0x6a2a8a, 6, 90);
    this.sayOnce('critic_hit', 'споришь с собой? он только громче.', 2800);
  }

  private updateAnx(dt: number) {
    const px = this.player.x, py = this.player.y - 24;
    for (const m of this.anx) {
      if (!m.alive) continue;
      m.jit += dt * 0.02; m.cd -= dt;
      const dist = Phaser.Math.Distance.Between(m.img.x, m.img.y, px, py);
      if (this.frozen && dist < 240) {
        m.calm += dt;
        if (m.calm > 800 && m.state !== 'calm') { m.state = 'calm'; m.t = 0; this.sayOnce('freeze', 'замираю... и она отступает?', 2600); }
      } else if (m.state !== 'calm') m.calm = Math.max(0, m.calm - dt * 0.5);

      switch (m.state) {
        case 'chase': {
          m.vx += Math.sign(px - m.img.x) * 14; m.vx = Phaser.Math.Clamp(m.vx, -155, 155);
          const ty = GROUND_Y - 48 + Math.sin(m.jit) * 9; m.vy += (ty - m.img.y) * 0.04; m.vy = Phaser.Math.Clamp(m.vy, -130, 130);
          if (dist < 155 && m.cd <= 0) { m.state = 'windup'; m.t = 0; m.vx *= 0.2; }
          break;
        }
        case 'windup': {
          m.t += dt; m.vx *= 0.85; m.vy *= 0.85;
          m.img.setTint(m.t % 150 < 75 ? 0xff4466 : 0xffffff);
          m.img.setScale(m.size * (1 + Math.sin(m.t * 0.04) * 0.12));
          if (m.t > 460) { m.state = 'lunge'; m.t = 0; m.img.clearTint().setScale(m.size); audio.anx();
            const a = Math.atan2(py - m.img.y, px - m.img.x); m.vx = Math.cos(a) * 450; m.vy = Math.sin(a) * 450; }
          break;
        }
        case 'lunge': {
          m.t += dt; if (m.t > 270) { m.state = 'chase'; m.cd = 680; }
          if (dist < 30 && this.invuln <= 0) this.damage(m.img.x);
          break;
        }
        case 'calm': {
          m.t += dt; m.vx += Math.sign(m.img.x - px) * 8; m.vy -= 2;
          m.size = Math.max(0.2, m.size - dt * 0.0004); m.img.setScale(m.size).setAlpha(0.6);
          if (!this.frozen && dist > 360) { m.state = 'chase'; m.calm = 0; m.img.setAlpha(1); }
          if (m.size <= 0.2) { m.alive = false; this.tweens.add({ targets: m.img, alpha: 0, duration: 350, onComplete: () => m.img.destroy() }); }
          break;
        }
      }
      m.img.x += m.vx * dt / 1000; m.img.y += m.vy * dt / 1000; m.vx *= 0.96; m.vy *= 0.98;
      m.img.x += Math.sin(m.jit * 3) * 0.8; m.img.y += Math.cos(m.jit * 4) * 0.8;
      m.img.y = Math.min(m.img.y, GROUND_Y - 12);
    }
    this.anx = this.anx.filter(m => m.alive || m.img.active);
  }

  // Self-critic mirrors your path with delay; it catches you when you falter.
  private updateCritic(dt: number) {
    const c = this.critic; if (!c || !c.alive) return;
    const target = this.trail[0];   // oldest = ~1.5s behind
    if (target) {
      c.img.x += (target.x - c.img.x) * 0.12;
      c.img.y += (target.y - c.img.y) * 0.18;
      c.img.setFlipX(target.flip);
      c.img.play(Math.abs(target.x - c.img.x) > 4 ? 'p-walk' : 'p-idle', true);
    }
    // shrink slowly when you DON'T engage (keep moving, ignore it)
    if (c.size > 1 && !this.attacking) { c.size = Math.max(1, c.size - dt * 0.00018); c.img.setScale(1.5 * c.size); }
    const dist = Phaser.Math.Distance.Between(c.img.x, c.img.y - 20, this.player.x, this.player.y - 20);
    c.struck -= dt;
    if (dist < 34 && this.invuln <= 0 && c.struck <= 0) {
      c.struck = 1200; this.damage(c.img.x);
      this.sayOnce('critic_catch', '«ты опять не справился»', 2800);
    }
  }

  private beginOverwhelm() {
    this.overwhelmed = true;
    audio.setIntensity(1);
    for (let i = 0; i < this.chapter.overwhelmAnx; i++) this.spawnAnx(this.player.x + (i - 1) * 200 + Phaser.Math.Between(-40, 40), 1);
    this.say(this.chapter.overwhelmSay, 3200);
    // The day collapses → the realization (sage hook for next build)
    this.time.delayedCall(3600, () => {
      if (this.dead) return;
      this.cameras.main.fade(1400, 8, 6, 16);
      this.time.delayedCall(1500, () => this.showRealization());
    });
  }

  private showRealization() {
    this.dead = true;
    audio.stopMusic(); audio.toll();
    this.cameras.main.resetFX();
    this.add.rectangle(W / 2, H / 2, W, H, 0x06040e).setScrollFactor(0).setDepth(150);

    const line = (text: string, y: number, color: string, size: number, delay: number) => {
      const t = this.add.text(W / 2, y, text, {
        fontFamily: 'Courier New', fontSize: `${size}px`, color, align: 'center', lineSpacing: 6,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(151).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 900, delay });
    };

    // What just happened — supplied by the chapter (cat's reckoning).
    for (const l of this.chapter.ending) line(l.text, l.y, l.color, l.size, l.delay);
    this.time.delayedCall(10600, () => audio.toll());

    // not a soft-lock: let the player restart after it settles
    this.time.delayedCall(14000, () => {
      const next = this.chapter.next;
      const label = next && CHAPTERS[next] ? `дальше — «${CHAPTERS[next].title}». нажми любую клавишу` : 'нажми любую клавишу';
      const hint = this.add.text(W / 2, H - 28, label, { fontFamily: 'Courier New', fontSize: '11px', color: '#5a4f7a' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(151).setAlpha(0);
      this.tweens.add({ targets: hint, alpha: 0.8, duration: 800 });
      const go = () => next && CHAPTERS[next] ? this.scene.restart({ chapter: next }) : this.scene.start('Start');
      this.input.keyboard!.once('keydown', go);
      this.input.once('pointerdown', go);
    });
  }

  // ── Damage / lives ─────────────────────────────────────────────────────────
  private damage(fromX: number) {
    this.invuln = 1100; this.hearts -= 1; this.updateHearts();
    this.doHitstop(70); this.cameras.main.shake(220, 0.014); this.cameras.main.flash(140, 120, 20, 40); audio.hurt();
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    b.setVelocity(Math.sign(this.player.x - fromX) * 240, -210);
    this.sayOnce('firsthit', 'ай! да я ничего не могу — только бежать!', 2800);
    if (this.hearts <= 0) this.gameOver();
  }

  private gameOver() {
    this.dead = true;
    const txt = this.add.text(W/2, H/2, 'так больше нельзя...', { fontFamily: 'Courier New', fontSize: '20px', color: '#ff7799', letterSpacing: 2 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);
    this.tweens.add({ targets: txt, alpha: 1, duration: 800 });
    this.cameras.main.fade(1800, 6, 4, 12);
    this.time.delayedCall(2400, () => this.scene.restart());
  }

  // ── Juice helpers ────────────────────────────────────────────────────────--
  private doHitstop(ms: number) { this.hitstop = ms; }
  private burst(x: number, y: number, color: number, n: number, sp: number) {
    for (let i = 0; i < n; i++) {
      const p = this.add.rectangle(x, y, 3, 3, color).setDepth(12);
      const a = Math.random() * 6.28, s = sp * (0.5 + Math.random());
      this.tweens.add({ targets: p, x: x + Math.cos(a) * s, y: y + Math.sin(a) * s, alpha: 0, scale: 0,
        duration: 260 + Math.random() * 200, onComplete: () => p.destroy() });
    }
  }
  private ghost() {
    const g = this.add.image(this.player.x, this.player.y, this.player.texture.key, this.player.frame.name)
      .setOrigin(0.5, 1).setScale(this.player.scaleX, this.player.scaleY).setFlipX(this.player.flipX)
      .setTint(0x9fd0ff).setAlpha(0.5).setDepth(9);
    this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
  }
  private drawCalmRing() {
    this.calmRing.clear();
    const r = 30 + Math.sin(this.freezePulseT * 0.006) * 14;
    this.calmRing.lineStyle(2, 0x88ccff, 0.4);
    this.calmRing.strokeCircle(this.player.x, this.player.y - 22, r);
    this.calmRing.lineStyle(1, 0x88ccff, 0.2);
    this.calmRing.strokeCircle(this.player.x, this.player.y - 22, r + 14);
  }

  // ── Cat voice ──────────────────────────────────────────────────────────────
  private say(text: string, dur: number) { this.bubble.setText(text).setAlpha(1); this.bubbleT = dur; }
  private sayOnce(key: string, text: string, dur: number) { if (this.said.has(key)) return; this.said.add(key); this.say(text, dur); }
  private updateBubble(dt: number) {
    if (this.bubbleT <= 0) return;
    this.bubble.x = this.player.x; this.bubble.y = this.player.y - 52;
    this.bubbleT -= dt;
    if (this.bubbleT < 300) this.bubble.setAlpha(Math.max(0, this.bubbleT / 300));
  }
}
