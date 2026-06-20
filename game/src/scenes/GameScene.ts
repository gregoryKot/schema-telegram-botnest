import Phaser from 'phaser';
import { W, H, GROUND_Y, S, PHYS } from '../constants';
import { audio } from '../audio';
import { CHAPTERS, DEFAULT_CHAPTER, ChapterConfig } from '../chapters';
import { HomeMob, MobCtx, Procrastination, PhoneMob, Irritation } from '../enemies/home';
import { buildDecor } from '../decor';
import { touch, IS_TOUCH, setTouchControls } from '../controls';
import { ensureEnemyAnims } from '../props';
import { unlockChapter } from '../progress';
import { getAssist } from '../assist';
import { track } from '../analytics';

// ════════════════════════════════════════════════════════════════════════════
//  GAME — the gameplay engine. A "chapter" (config in chapters.ts) supplies the
//  level data; this scene just runs it. Core: fight / freeze / flee.
// ════════════════════════════════════════════════════════════════════════════

const trackedStarts = new Set<string>(); // chapter_start один раз за загрузку страницы

const RUN_SPEED = 250;
const DASH_SPEED = 560;
const DASH_MS   = 170;
const DASH_CD   = 480;
const ATTACK_MS = 170;
const ATTACK_CD = 300;
const ATTACK_RANGE = 72;
const ATTACK_AURA = 104; // радиус удара вокруг кота — бьёт всё рядом, не только спереди
const ANX_SCALE = 0.42;  // спрайт тучи широкий — ужимаем до размера как в обучении
// тень-критик выкрикивает это постоянно (голос Карающего Родителя)
const CRITIC_LINES = [
  'ты опять не справился.', 'все смогли. кроме тебя.', 'я же говорил — не выйдет.',
  'и так каждый раз.', 'соберись уже.', 'кому ты такой нужен.',
  'опять всё испортил.', 'стыдно должно быть.',
];
// game feel
const COYOTE_MS = 90;        // прыжок прощается N мс после схода с платформы
const JUMP_BUFFER_MS = 130;  // прыжок, нажатый до приземления, срабатывает при касании
const RISE_GRAVITY = -210;   // при удержании прыжка — легче (плавный взлёт)
const FALL_GRAVITY = 520;    // при падении — тяжелее (быстрое, чёткое приземление)

type AnxState = 'chase' | 'windup' | 'lunge' | 'calm';
interface Anx {
  img: Phaser.GameObjects.Image; halo: Phaser.GameObjects.Ellipse;
  state: AnxState; t: number; size: number;
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
  private criticBubble: Phaser.GameObjects.Text | null = null;
  private criticSayT = 0; private criticLine = 0;
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
  private coyoteT = 0; private jumpBufferT = 0; private wasOnGround = true; private jumping = false;
  private slash!: Phaser.GameObjects.Graphics;
  private playSprite!: Phaser.GameObjects.Sprite;
  private sleepSprite!: Phaser.GameObjects.Sprite;
  private lungeSprite!: Phaser.GameObjects.Sprite; // атака — выпад с красными штрихами
  private playerLight!: Phaser.GameObjects.Graphics;

  private hitstop = 0;
  private exhaustion = 0;                          // спираль: копинг + время → мир враждебнее
  private exhaustOverlay!: Phaser.GameObjects.Graphics;
  private assistInvuln = false;                    // ассист-режим: «не умирать»
  private overwhelmed = false;
  private triggers: { x: number; done: boolean; fn: () => void }[] = [];
  private wasFrozen = false;

  private bubble!: Phaser.GameObjects.Text; private bubbleT = 0;
  private said = new Set<string>();
  private introduced = new Set<string>(); // каждого врага представляем стоп-кадром один раз

  constructor() { super('Game'); }

  init(data: { chapter?: string }) {
    this.chapter = CHAPTERS[data?.chapter ?? DEFAULT_CHAPTER] ?? CHAPTERS[DEFAULT_CHAPTER];
  }

  create() {
    setTouchControls(true); // геймплей — тач-кнопки нужны
    const ARENA_W = this.chapter.arenaW;
    Object.assign(this, {
      anx: [], critic: null, criticBubble: null, criticSayT: 0, criticLine: 0,
      homeMobs: [], speedMult: 1, trail: [], hearts: 3, invuln: 0, checkpointX: 100,
      dead: false, attacking: false, attackCd: 0, dashing: false, dashCd: 0,
      frozen: false, hitstop: 0, exhaustion: 0, overwhelmed: false, wasFrozen: false,
      coyoteT: 0, jumpBufferT: 0, wasOnGround: true, jumping: false,
    });
    this.said = new Set();
    this.introduced = new Set();
    this.attackHit = new Set();
    this.triggers = []; this.gates = [];
    this.floorColliders = []; this.platColliders = []; this.spikeRects = []; this.heartPickups = [];

    this.buildBackground();
    this.exhaustOverlay = this.add.graphics().setScrollFactor(0).setDepth(59); // виньетка истощения
    buildDecor(this, this.chapter);
    this.buildGround();
    this.buildPlatforms();
    this.buildSpikes();
    ensureEnemyAnims(this);
    this.buildHearts();
    this.spawnPlayer();
    this.buildHUD();
    this.setupInput();
    this.setupTriggers();

    // Ассист-режим (этика для ЦА в дистрессе): больше жизней / бессмертие
    const assist = getAssist();
    if (assist.extraLives) { this.hearts = this.MAX_HEARTS; this.updateHearts(); }
    this.assistInvuln = assist.invuln;

    this.cameras.main.setBounds(0, 0, ARENA_W, H);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.physics.world.setBounds(0, -H, ARENA_W, H * 3);
    this.cameras.main.fadeIn(600, 8, 6, 16);
    this.showTitleCard();
    unlockChapter(this.chapter.id);
    if (!trackedStarts.has(this.chapter.id)) { // рестарты после смерти — не «старт»
      trackedStarts.add(this.chapter.id);
      track('chapter_start', { chapter: this.chapter.id });
    }

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
      this.add.text(W / 2, y, text, { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: `${size}px`, color, letterSpacing: 3, align: 'center' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(120).setAlpha(0);
    const t1 = mk(170, this.chapter.title.toUpperCase(), 24, '#fff0d8');
    const t2 = mk(208, this.chapter.tagline, 11, '#9a8fb8');
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
      const img = this.add.image(s.x, s.y, 'heartpk').setDepth(7).setScale(0.8);
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
        if (t.anx) { for (let i = 0; i < t.anx; i++) this.spawnAnx(this.player.x + 360 + i * 120, 1);
          this.introOnce('anx', 'ТРЕВОГА', 'бьёшь — делится. избегаешь — отступит.\nно совсем не уходит.'); }
        if (t.critic) this.spawnCritic(); // у критика свой стоп-кадр
        if (t.proc) { this.homeMobs.push(new Procrastination(this.mobCtx(), t.proc, t.seat ? GROUND_Y - t.seat : undefined));
          this.introOnce('proc', 'ПРОКРАСТИНАЦИЯ', 'липнет, тянет вниз.\nрывок снимает — на время.'); }
        if (t.phone) { this.homeMobs.push(new PhoneMob(this.mobCtx(), t.phone));
          this.introOnce('phone', 'ТЕЛЕФОН', 'тянет в уют, крадёт время.\nвырубишь ударом — загорится снова.'); }
        if (t.irrit) { this.homeMobs.push(new Irritation(this.mobCtx(), t.irrit));
          this.introOnce('irrit', 'РАЗДРАЖЕНИЕ', 'вспыхивает из ничего.\nвыпустишь пар — вскипит опять.'); }
        if (t.say) { this.say(t.say, 2400); if (t.anx) audio.anx(); }
        if (t.gate) this.makeGate(t.gate, [...this.anx.slice(beforeA), ...this.homeMobs.slice(beforeH)]);
        if (t.overwhelm) this.beginOverwhelm();
      },
    }));
  }
  // «привет, это —» : представляем врага стоп-кадром при первой встрече
  private introOnce(key: string, name: string, line: string) {
    if (this.introduced.has(key)) return;
    this.introduced.add(key);
    this.storyFrame(name, line);
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
    // не больше одного триггера за кадр: первый ставит стоп-кадр (hitstop), и
    // следующие дождутся своего кадра — иначе два стоп-кадра наложатся
    for (const t of this.triggers) {
      if (!t.done && this.player.x > t.x) { t.done = true; t.fn(); return; }
    }
  }

  // ── Гейты: дальше нельзя, пока не разобрался с тем, что навалилось ─────────
  private makeGate(x: number, mobs: { alive: boolean }[]) {
    const col = this.add.rectangle(x, GROUND_Y / 2, 18, GROUND_Y + 40, 0, 0);
    this.physics.add.existing(col, true);
    this.physics.add.collider(this.player, col, () =>
      this.sayOnce('gate', 'не пройти. сначала — с этим.', 2600));
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
    // важная правда главы: копинг = передышка, не решение — отпустило НЕНАДОЛГО
    this.say('...отпустило. ненадолго.', 2400);
  }

  // тревога, отколовшаяся от «гейтовой», тоже держит стену
  private adoptIntoGate(parent: object, child: object) {
    const g = this.gates.find(g => !g.open && g.mobs.includes(parent as { alive: boolean }));
    if (g) g.mobs.push(child as { alive: boolean });
  }

  // Создать анимацию только если её спрайт-лист реально загрузился.
  private safeAnim(key: string, sheet: string, start: number, end: number, frameRate: number, repeat: number) {
    if (this.anims.exists(key) || !this.textures.exists(sheet)) return;
    this.anims.create({ key, frames: this.anims.generateFrameNumbers(sheet, { start, end }), frameRate, repeat });
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
    // cat_play/cat_sleep/cat_dash — необязательные спрайты (грузятся отдельными
    // запросами и могут не доехать). Анимацию создаём ТОЛЬКО если текстура есть —
    // иначе .play() по пустой анимации роняет update-цикл и игра «зависает».
    this.safeAnim('p-play', 'cat_play', 0, 5, 7, -1);
    this.safeAnim('p-sleep', 'cat_sleep', 0, 5, 6, 0);
    this.playSprite = this.add.sprite(0, 0, 'cat_play', 0).setOrigin(0.5, 1).setScale(0.24).setDepth(10).setVisible(false);
    this.sleepSprite = this.add.sprite(0, 0, 'cat_sleep', 0).setOrigin(0.5, 1).setScale(0.3).setDepth(10).setVisible(false);
    this.safeAnim('p-lunge', 'cat_dash', 1, 5, 24, 0);
    this.lungeSprite = this.add.sprite(0, 0, 'cat_dash', 5).setOrigin(0.5, 1).setScale(0.26).setDepth(11).setVisible(false);
    this.bubble = this.add.text(0, 0, '', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '10px', color: '#fff0d8',
      backgroundColor: 'rgba(16,12,30,0.88)', padding: { x: 9, y: 5 }, align: 'center' })
      .setOrigin(0.5, 1).setDepth(45).setAlpha(0);
  }

  private buildHUD() {
    this.heartsText = this.add.text(18, 14, '', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '24px', color: '#ff5577' })
      .setScrollFactor(0).setDepth(100);
    this.updateHearts();
    if (!IS_TOUCH)
      this.add.text(W / 2, H - 20, 'X бей · Z избегай (тап рывок / держи залипни) · V уступи', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '9px', color: '#6a5f8a' })
        .setOrigin(0.5, 1).setScrollFactor(0).setDepth(100);
  }
  private updateHearts() {
    this.heartsText.setText('♥'.repeat(Math.max(0, this.hearts)) + '·'.repeat(Math.max(0, 3 - this.hearts)));
  }

  private setupInput() {
    this.input.keyboard!.resetKeys(); // залипшие клавиши после смены сцены/alt-tab
    this.cursors = this.input.keyboard!.createCursorKeys();
    // одна схема: движение — стрелки/WASD, действия — Z X C V (как на Денди)
    this.keys = {
      A: this.input.keyboard!.addKey('A'), D: this.input.keyboard!.addKey('D'),
      W: this.input.keyboard!.addKey('W'),
      X: this.input.keyboard!.addKey('X'), C: this.input.keyboard!.addKey('C'),
      Z: this.input.keyboard!.addKey('Z'), V: this.input.keyboard!.addKey('V'),
    };
  }

  // ── Spawns ───────────────────────────────────────────────────────────────--
  private spawnAnx(x: number, size: number) {
    const s2 = size * (1 + this.exhaustion * 0.3); // спираль: чем выжатее — тем крупнее возвращается
    // ореол позади — отделяет тёмную тучу от чёрного кота и «дышит»
    const halo = this.add.ellipse(x, GROUND_Y - 44, 104, 78, 0x9a5ad0, 0.22).setDepth(5);
    const img = this.add.sprite(x, GROUND_Y - 44, 'anxmob').setDepth(6).setScale(s2 * ANX_SCALE).play('anx-fly');
    this.anx.push({ img, halo, state: 'chase', t: 0, size: s2, vx: 0, vy: 0, jit: Math.random()*6, calm: 0, cd: 0, alive: true });
  }
  private spawnCritic() {
    if (this.critic) return;
    const img = this.add.sprite(this.player.x - 200, this.player.y, 'cat_idle')
      .setOrigin(0.5, 1).setScale(1.5).setDepth(9).setTint(0x1a0030).setAlpha(0).play('p-walk');
    this.tweens.add({ targets: img, alpha: 0.82, duration: 600 });
    this.critic = { img, size: 1, struck: 0, alive: true };
    // тень постоянно выкрикивает упрёки — её не заткнуть
    this.criticBubble = this.add.text(0, 0, '', {
      fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '8px',
      color: '#ff8aa6', backgroundColor: 'rgba(18,6,18,0.72)', padding: { x: 6, y: 4 }, align: 'center',
    }).setOrigin(0.5, 1).setDepth(46).setAlpha(0);
    this.criticSayT = 2200; // первый упрёк почти сразу
    // важный новый враг — представляем стоп-кадром, иначе «просто какой-то кот»
    this.storyFrame('ВНУТРЕННИЙ КРИТИК',
      'тень Мистера. ходит следом, не отстаёт.\n\n' +
      'рявкнешь (X) — притихнет на миг и станет громче.\n' +
      'убегаешь — растёт за спиной.\n' +
      'это ты сам. от себя не отмахнуться.');
  }

  // Стоп-кадр посреди главы: пауза, затемнение, текст, продолжение по тапу
  private storyFrame(title: string, text: string) {
    this.hitstop = 9e9; // update() стоит, пока не отпустим
    // update стоит, но физика Phaser — нет: тормозим игрока, иначе он улетает
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    pb.setVelocity(0, 0); pb.setAllowGravity(false); pb.moves = false;
    const deep = 130;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x06040e, 0.78).setScrollFactor(0).setDepth(deep);
    const t1 = this.add.text(W / 2, 120, title, { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '18px', color: '#ff8aa6', align: 'center' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(deep + 1);
    const t2 = this.add.text(W / 2, 175, text, { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '11px', color: '#d8c8ec', align: 'center', lineSpacing: 10 })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(deep + 1);
    const hint = this.add.text(W / 2, H - 60, IS_TOUCH ? 'тапни — дальше' : 'любая клавиша — дальше',
      { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '9px', color: '#88ffcc' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(deep + 1).setAlpha(0);
    this.tweens.add({ targets: hint, alpha: 0.9, duration: 400, delay: 800 });
    this.time.delayedCall(700, () => {
      const go = () => { this.hitstop = 0; pb.setAllowGravity(true); pb.moves = true; [dim, t1, t2, hint].forEach(o => o.destroy()); };
      this.input.keyboard!.once('keydown', go);
      this.input.once('pointerdown', go);
    });
  }

  // ── УСТУПИ (fawn): купить мир ценой себя — враги отстают, сердце уходит ────
  private doFawn() {
    if (this.invuln > 0) return; // не спамить
    // уступать только когда есть кому — иначе V «внезапно» съедал сердце впустую
    const nearThreat =
      this.anx.some(m => m.alive && Phaser.Math.Distance.Between(m.img.x, m.img.y, this.player.x, this.player.y) < 260) ||
      (this.critic?.alive && Phaser.Math.Distance.Between(this.critic.img.x, this.critic.img.y, this.player.x, this.player.y) < 280) ||
      this.homeMobs.some(m => m.alive);
    if (!nearThreat) { this.sayOnce('fawn_none', 'уступать... да некому пока.', 1600); return; }
    this.hidePlay();
    this.hearts -= 1; this.updateHearts();
    this.invuln = 3500;
    audio.freeze();
    this.cameras.main.flash(160, 80, 50, 110);
    this.burst(this.player.x, this.player.y - 24, 0xb08fd0, 12, 150);
    this.curlUp(); // свернулся калачиком, сдался — вздох
    for (const m of this.anx) { if (m.alive) { m.vx = Math.sign(m.img.x - this.player.x) * 320; m.vy = -120; m.cd = 2600; m.calm += 1000; } }
    if (this.critic?.alive) {
      // уступка — единственное, что прогоняет тень… временно
      this.critic.struck = 8000;
      this.say('уступил — и тень отстала. пока что.', 3000);
    } else {
      this.sayOnce('fawn', '«ладно-ладно, как скажете...» — и правда отстали. но чего это стоило.', 3400);
    }
    if (this.hearts <= 0) this.gameOver();
  }

  // Мистер сворачивается калачиком (сдался), держит позу, потом встаёт
  private curlUp() {
    this.safeAnim('p-sleep', 'cat_sleep', 0, 5, 6, 0); // спрайт грузится в фоне — создаём при первом использовании
    if (!this.anims.exists('p-sleep')) return; // спрайт «сна» не доехал — без позы, кот остаётся стоять
    this.player.setVisible(false);
    this.sleepSprite.setVisible(true).setPosition(this.player.x, this.player.y)
      .setFlipX(this.player.flipX).play('p-sleep');
    const sigh = this.add.text(this.player.x, this.player.y - 30, '...',
      { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '12px', color: '#8a8a98' })
      .setOrigin(0.5).setDepth(46);
    this.tweens.add({ targets: sigh, y: sigh.y - 16, alpha: 0, duration: 1600, onComplete: () => sigh.destroy() });
    this.time.delayedCall(1500, () => {
      if (this.dead) return;
      this.sleepSprite.setVisible(false);
      this.player.setVisible(true);
    });
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
    this.updateSpiral(dt);
    if (this.invuln > 0) this.invuln -= dt;
    if (this.player.y > H + 70) this.fallRespawn();
  }

  // ── СПИРАЛЬ (не цикл): копинг и время копят истощение → мир враждебнее ──────
  private updateSpiral(dt: number) {
    const coping = this.frozen || this.dashing || this.attacking;
    this.exhaustion = Math.min(1, this.exhaustion + dt * (coping ? 0.00011 : 0.000022));
    audio.setDetune(1 - this.exhaustion * 0.06); // музыка чуть ниже = «расстроеннее»
    // виньетка темнеет к краям
    const g = this.exhaustOverlay; g.clear();
    const a = this.exhaustion;
    if (a > 0.02) {
      const band = 24 + 70 * a, t = 0.5 * a;
      g.fillStyle(0x080510, t);
      g.fillRect(0, 0, W, band); g.fillRect(0, H - band, W, band);
      g.fillRect(0, 0, band * 0.7, H); g.fillRect(W - band * 0.7, 0, band * 0.7, H);
    }
    // состояние пальцами: рядом угрозы — экран подрагивает (п.4)
    let threats = this.anx.filter(a2 => a2.alive && Phaser.Math.Distance.Between(a2.img.x, a2.img.y, this.player.x, this.player.y) < 150).length;
    if (this.critic?.alive && Phaser.Math.Distance.Between(this.critic.img.x, this.critic.img.y, this.player.x, this.player.y) < 150) threats++;
    if (threats > 0 && !this.dashing) this.cameras.main.shake(50, 0.0012 * Math.min(threats, 3), false);
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
    // падение в пропасть — реальная потеря: минус жизнь (иначе «ничего не меняется»)
    if (this.assistInvuln) return;
    this.hearts -= 1; this.updateHearts();
    this.cameras.main.flash(120, 80, 20, 40);
    this.say('сорвался... −1 жизнь.', 1800);
    if (this.hearts <= 0) this.gameOver();
  }

  private updateMoves(dt: number) {
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = b.blocked.down;
    const left  = this.cursors.left.isDown  || this.keys.A.isDown || touch.left;
    const right = this.cursors.right.isDown || this.keys.D.isDown || touch.right;
    const jump  = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.cursors.space)
               || Phaser.Input.Keyboard.JustDown(this.keys.W) || touch.consume('jump');
    const jumpHeld = this.cursors.up.isDown || this.cursors.space.isDown || this.keys.W.isDown || touch.jumpHeld;
    const hit   = Phaser.Input.Keyboard.JustDown(this.keys.X) || touch.consume('hit');
    const fawn  = Phaser.Input.Keyboard.JustDown(this.keys.V) || touch.consume('fawn');
    // ИЗБЕГАНИЕ — один копинг, одна кнопка: тап = рывок, удержание = залипнуть
    const avoidPress = Phaser.Input.Keyboard.JustDown(this.keys.Z) || touch.consume('avoid');
    const avoidHeld  = this.keys.Z.isDown || touch.avoidHeld;
    const dash = avoidPress;
    // на кадре нажатия — это рывок, не залипание (иначе frozen гасит рывок)
    this.frozen = avoidHeld && !avoidPress && onGround && !this.dashing && !this.attacking;
    if (fawn && !this.dead) this.doFawn();
    if (this.frozen && !this.wasFrozen) audio.freeze();
    this.wasFrozen = this.frozen;

    // light pool follows the cat
    this.playerLight.x = this.player.x; this.playerLight.y = this.player.y - 22;

    // record trail for the self-critic mirror
    this.trail.push({ x: this.player.x, y: this.player.y, flip: this.player.flipX });
    if (this.trail.length > 90) this.trail.shift();

    if (this.dashCd > 0) this.dashCd -= dt;

    // ── ОТВЛЕКИСЬ: показываем спрайт «играет с клубком» ──
    if (this.frozen) {
      b.setVelocityX(0);
      this.showPlay();
    } else {
      this.hidePlay();
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
      this.ghost(); // синий шлейф i-кадров — рывок как был
      if (this.dashT <= 0) { this.dashing = false; b.setAllowGravity(true); }
    } else if (!this.frozen) {
      // ── БЕГИ ──
      const run = RUN_SPEED * this.speedMult;
      if (this.attacking) b.setVelocityX(this.player.flipX ? -50 : 50);
      else if (right) { b.setVelocityX(run); this.player.setFlipX(false); }
      else if (left)  { b.setVelocityX(-run); this.player.setFlipX(true); }
      else            { b.setVelocityX(b.velocity.x * 0.7); }

      // ── ПРЫЖОК: coyote time + jump buffer + вариативная высота + дуга ──
      if (onGround) { this.coyoteT = COYOTE_MS; if (!this.wasOnGround) this.onLand(); }
      else this.coyoteT = Math.max(0, this.coyoteT - dt);
      this.jumpBufferT = jump ? JUMP_BUFFER_MS : Math.max(0, this.jumpBufferT - dt);
      if (this.jumpBufferT > 0 && this.coyoteT > 0) {
        b.setVelocityY(PHYS.jumpVel); audio.jump();
        this.player.setScale(1.3, 1.75); // вытягивается на отрыве, плавно к норме
        this.tweens.add({ targets: this.player, scaleX: 1.5, scaleY: 1.5, duration: 220, ease: 'Quad.Out' });
        this.jumping = true; this.coyoteT = 0; this.jumpBufferT = 0;
      }
      // отпустил на взлёте — короткий подскок
      if (this.jumping && !jumpHeld && b.velocity.y < 0) { b.setVelocityY(b.velocity.y * 0.45); this.jumping = false; }
      if (b.velocity.y >= 0) this.jumping = false;
      // непараболическая дуга: вверх с удержанием — легче, вниз — тяжелее
      if (!onGround) b.setGravityY(b.velocity.y < 0 && jumpHeld ? RISE_GRAVITY : FALL_GRAVITY);
      else b.setGravityY(0);
      this.wasOnGround = onGround;

      if (!onGround) { if (this.player.anims.currentAnim?.key !== 'p-jump') this.player.play('p-jump', true); }
      else if (Math.abs(b.velocity.x) > 20) this.player.play('p-walk', true);
      else this.player.play('p-idle', true);
      // на земле в покое и без активного твина — вернуть базовый масштаб
      if (onGround && !this.jumping && !this.tweens.isTweening(this.player)) this.player.setScale(1.5, 1.5);
    }

    // ── БЕЙ ── (короткие i-кадры на замах — копинг сохраняет в моменте)
    if (hit && this.attackCd <= 0 && !this.frozen && !this.dashing) {
      this.attacking = true; this.attackT = ATTACK_MS; this.attackCd = ATTACK_CD; this.attackHit.clear();
      this.invuln = Math.max(this.invuln, ATTACK_CD + 40); // копинг сохраняет в моменте — пробить нельзя
    }

    this.player.setAlpha(this.invuln > 0 && !this.dashing ? (Math.sin(this.invuln * 0.05) * 0.5 + 0.5) : 1);
  }

  private updateAttack(dt: number) {
    if (this.attackCd > 0) this.attackCd -= dt;
    this.slash.clear();
    if (!this.attacking) return;
    this.attackT -= dt;
    const dir = this.player.flipX ? -1 : 1;
    const prog = 1 - this.attackT / ATTACK_MS;
    // выпад с красными штрихами (спрайт), на время атаки прячем обычного кота.
    // спрайт грузится в фоне; нет — атакуем обычным котом, видны только штрихи.
    this.safeAnim('p-lunge', 'cat_dash', 1, 5, 24, 0);
    if (this.anims.exists('p-lunge')) {
      if (!this.lungeSprite.visible) { this.lungeSprite.setVisible(true).play('p-lunge'); this.player.setVisible(false); }
      this.lungeSprite.setPosition(this.player.x, this.player.y).setFlipX(dir < 0);
    }
    // следы когтей поверх — продают удар
    const cx = this.player.x + dir * 30, cy = this.player.y - 34;
    const len = 34 * Math.min(1, prog * 1.6);
    const a = 1 - Math.max(0, prog - 0.45) * 1.8;
    for (let i = 0; i < 3; i++) {
      const ox = i * 7 * dir, oy = i * 9 - 6;
      this.slash.lineStyle(3, i === 1 ? 0xff4455 : 0xd92b3d, Math.max(0, a));
      this.slash.lineBetween(cx + ox, cy + oy, cx + ox + len * dir, cy + oy + len * 0.55);
    }
    if (prog > 0.4 && prog < 0.6) this.burst(cx + len * dir * 0.7, cy + 12, 0xff4455, 2, 60);
    // ударная волна — кольцо ауры вокруг кота (бьёт во все стороны)
    this.slash.lineStyle(3, 0xff5566, Math.max(0, 1 - prog) * 0.7);
    this.slash.strokeCircle(this.player.x, this.player.y - 22, ATTACK_AURA * (0.45 + prog * 0.6));

    // удар — аура вокруг кота: задевает всё в радиусе, не только спереди
    const px = this.player.x, py = this.player.y - 22;
    for (const m of this.anx) {
      if (!m.alive || this.attackHit.has(m)) continue;
      if (Math.hypot(m.img.x - px, m.img.y - py) < ATTACK_AURA) { this.attackHit.add(m); this.hitAnx(m, dir); }
    }
    for (const m of this.homeMobs) {
      if (!m.alive || this.attackHit.has(m)) continue;
      if (m.tryHit(dir, ATTACK_AURA)) this.attackHit.add(m);
    }
    if (this.critic && this.critic.alive && !this.attackHit.has(this.critic)) {
      if (Math.hypot(this.critic.img.x - px, this.critic.img.y - py) < ATTACK_AURA + 20) {
        this.attackHit.add(this.critic); this.hitCritic();
      }
    }
    if (this.attackT <= 0) {
      this.attacking = false;
      this.lungeSprite.setVisible(false); this.player.setVisible(true);
    }
  }

  // ── Anxiety: бить = их только больше; растворяет лишь спокойствие ──────────
  private hitAnx(m: Anx, dir: number) {
    m.vx = dir * 300; m.vy = -140; m.state = 'chase'; m.cd = 600;
    this.doHitstop(55); this.cameras.main.shake(70, 0.005); audio.hit();
    this.burst(m.img.x, m.img.y, 0xaa55cc, 8, 130);
    const aliveCount = this.anx.filter(a => a.alive).length;
    if (aliveCount < 7 && m.size > 0.6) {
      // удар по тревоге — она делится (хуже). Ловушка.
      m.size = Math.max(0.6, m.size * 0.85); m.img.setScale(m.size * ANX_SCALE);
      this.spawnAnx(m.img.x, m.size);
      const nb = this.anx[this.anx.length - 1]; nb.vx = -dir * 220; nb.vy = -110;
      this.adoptIntoGate(m, nb);
      audio.split();
      this.sayOnce('hit', 'бить бесполезно — их только больше!', 2600);
    } else {
      // делиться больше некуда — измотал, оседает (но любой способ это лишь оттянет)
      m.calm += 600;
      this.sayOnce('hit_many', 'задолбал... оседает. но это ненадолго.', 2800);
    }
  }

  // ── Self-critic: его не победить. Рявкнул — притих на миг и вырос. Он же ты.
  private hitCritic() {
    const c = this.critic;
    if (!c) return;
    this.doHitstop(50); this.cameras.main.shake(90, 0.006); audio.hit();
    this.burst(c.img.x, c.img.y - 20, 0x6a2a8a, 8, 110);
    c.struck = 1600;                              // огрызнулся — притих на секунду
    c.size = Math.min(2.4, c.size + 0.18);        // ...и в ответ стал больше
    c.img.setScale(1.5 * c.size);
    this.sayOnce('critic_hit', 'рявкнул — притих. и стал громче. с собой не поспоришь.', 3200);
  }

  private updateAnx(dt: number) {
    const px = this.player.x, py = this.player.y - 24;
    for (const m of this.anx) {
      if (!m.alive) continue;
      m.jit += dt * 0.02; m.cd -= dt;
      // критик рядом — тревога подпитывается и растёт (мысли громче под его голос)
      if (this.critic?.alive && m.state !== 'calm'
        && Phaser.Math.Distance.Between(m.img.x, m.img.y, this.critic.img.x, this.critic.img.y) < 220) {
        m.size = Math.min(2.0, m.size + dt * 0.0002); m.img.setScale(m.size * ANX_SCALE);
      }
      const dist = Phaser.Math.Distance.Between(m.img.x, m.img.y, px, py);
      // любой копинг копит «передышку»: залипание рядом — быстрее всего,
      // проскок рывком сквозь неё — чуть-чуть. Накопил — отступает (на время).
      if (this.frozen && dist < 240) m.calm += dt;
      else if (this.dashing && dist < 64) m.calm += dt * 2;
      else if (m.state !== 'calm') m.calm = Math.max(0, m.calm - dt * 0.3);
      if (m.calm > 800 && m.state !== 'calm') { m.state = 'calm'; m.t = 0; this.sayOnce('freeze', 'отступает... но она вернётся.', 2600); }

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
          m.img.setScale(m.size * ANX_SCALE * (1 + Math.sin(m.t * 0.04) * 0.12));
          if (m.t > 460) { m.state = 'lunge'; m.t = 0; m.img.clearTint().setScale(m.size * ANX_SCALE); audio.anx();
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
          m.size = Math.max(0.2, m.size - dt * 0.0004); m.img.setScale(m.size * ANX_SCALE).setAlpha(0.6);
          if (!this.frozen && dist > 360) { m.state = 'chase'; m.calm = 0; m.img.setAlpha(1); }
          if (m.size <= 0.2) { m.alive = false; this.tweens.add({ targets: [m.img, m.halo], alpha: 0, duration: 350, onComplete: () => m.img.destroy() }); }
          break;
        }
      }
      m.img.x += m.vx * dt / 1000; m.img.y += m.vy * dt / 1000; m.vx *= 0.96; m.vy *= 0.98;
      m.img.x += Math.sin(m.jit * 3) * 0.8; m.img.y += Math.cos(m.jit * 4) * 0.8;
      m.img.y = Math.min(m.img.y, GROUND_Y - 12);
      // ореол следует и пульсирует (ярче на замахе)
      m.halo.setPosition(m.img.x, m.img.y).setScale(m.size * (1 + Math.sin(m.jit * 2) * 0.12))
        .setAlpha((m.state === 'calm' ? 0.1 : 0.22) + (m.state === 'windup' ? 0.18 : 0));
    }
    this.anx = this.anx.filter(m => {
      if (!m.alive && !m.img.active) { m.halo.destroy(); return false; }
      return true;
    });
  }

  // Критик ходит тенью за тобой. Бег от него и клубок его КОРМЯТ.
  private updateCritic(dt: number) {
    const c = this.critic; if (!c || !c.alive) return;
    // уступка прогнала его — стоит вдалеке, выцветший, и ждёт своего часа
    if (c.struck > 1500) {
      c.struck -= dt;
      c.img.setAlpha(0.22);
      c.img.play('p-idle', true);
      this.criticBubble?.setAlpha(0); // притих, пока выцветший
      if (c.struck <= 1500) this.sayOnce('critic_back', '...вернулся. они всегда возвращаются.', 2800);
      return;
    }
    // постоянный поток упрёков над тенью — её не заткнуть
    if (this.criticBubble) {
      this.criticSayT += dt;
      this.criticBubble.x = c.img.x;
      this.criticBubble.y = c.img.y - 66 * c.size;
      if (this.criticSayT > 2300) {
        this.criticSayT = 0;
        this.criticBubble.setText(CRITIC_LINES[this.criticLine++ % CRITIC_LINES.length]).setAlpha(0).setScale(0.85);
        this.tweens.add({ targets: this.criticBubble, alpha: 0.95, scale: 1, duration: 260, ease: 'Back.Out' });
      }
    }
    c.img.setAlpha(0.82);
    const target = this.trail[0];   // oldest = ~1.5s behind
    if (target) {
      c.img.x += (target.x - c.img.x) * 0.12;
      c.img.y += (target.y - c.img.y) * 0.18;
      c.img.setFlipX(target.flip);
      c.img.play(Math.abs(target.x - c.img.x) > 4 ? 'p-walk' : 'p-idle', true);
    }
    const dist = Phaser.Math.Distance.Between(c.img.x, c.img.y - 20, this.player.x, this.player.y - 20);
    // убегаешь — он растёт за спиной
    if (this.dashing || dist > 320) {
      c.size = Math.min(2.4, c.size + dt * 0.00012);
      if (c.size > 1.6) this.sayOnce('critic_grow', 'убегаю — а он за спиной только громче...', 2800);
    }
    // отвлёкся на клубок при нём — кормишь его ещё быстрее
    if (this.frozen && dist < 300) {
      c.size = Math.min(2.4, c.size + dt * 0.0005);
      this.sayOnce('critic_frz', 'клубок?! он же прямо ЗА тобой!', 2800);
    }
    c.img.setScale(1.5 * c.size);
    c.struck -= dt;
    if (dist < 34 && this.invuln <= 0 && c.struck <= 0) {
      c.struck = 1200; this.damage(c.img.x);
      this.sayOnce('critic_catch', '«ты опять не справился». чем ни ответь — он рядом.', 3000);
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
    track('chapter_done', { chapter: this.chapter.id });
    if (this.chapter.next) unlockChapter(this.chapter.next);
    audio.stopMusic(); audio.toll();
    this.cameras.main.resetFX();
    this.add.rectangle(W / 2, H / 2, W, H, 0x06040e).setScrollFactor(0).setDepth(150);

    const ky = H / 540; // y развязок написаны под десктопную высоту
    const lines: Phaser.GameObjects.Text[] = [];
    const line = (text: string, y: number, color: string, size: number, delay: number) => {
      const t = this.add.text(W / 2, y * ky, text, {
        fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: `${size}px`, color, align: 'center', lineSpacing: 6,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(151).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 900, delay });
      lines.push(t);
    };

    // What just happened — supplied by the chapter (cat's reckoning).
    for (const l of this.chapter.ending) line(l.text, l.y, l.color, l.size, l.delay);
    this.time.delayedCall(10600, () => audio.toll());

    // Дверь, а не тупик: после безнадёжности — проблеск четвёртого хода.
    // Сначала ГАСИМ текст развязки, иначе он наезжает на контакт/карточку.
    this.time.delayedCall(13200, () => this.tweens.add({ targets: lines, alpha: 0, duration: 700,
      onComplete: () => lines.forEach(t => t.destroy()) }));
    this.time.delayedCall(14100, () => this.contactGlimpse(() => {
      const next = this.chapter.next;
      if (next && CHAPTERS[next]) {
        const act = IS_TOUCH ? 'тапни' : 'нажми любую клавишу';
        const hint = this.add.text(W / 2, H - 28, `дальше — «${CHAPTERS[next].title}». ${act}`,
          { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '11px', color: '#5a4f7a' })
          .setOrigin(0.5).setScrollFactor(0).setDepth(160).setAlpha(0);
        this.tweens.add({ targets: hint, alpha: 0.8, duration: 800 });
        const go = () => this.scene.restart({ chapter: next });
        this.input.keyboard!.once('keydown', go);
        this.input.once('pointerdown', go);
      } else {
        this.showCta();
      }
    }));
  }

  // Враг = режим схема-терапии — называем в момент узнавания (без лекции)
  private modeName(): string {
    if (this.chapter.id === 'chapter1') return 'это — Карающий Родитель.\nчужой голос, что тебя стыдил.\n\n';
    if (this.chapter.id === 'chapter2') return 'это — Отстранённый Защитник.\nуводил в телефон, лишь бы не чувствовать.\n\n';
    return '';
  }
  private modeShort(): string {
    if (this.chapter.id === 'chapter1') return 'Карающий Родитель';
    if (this.chapter.id === 'chapter2') return 'Отстранённый Защитник';
    return 'Тревога';
  }

  // ── КОНТАКТ-проблеск: впервые не бей/беги/уступи, а останься рядом ──────────
  private contactGlimpse(onDone: () => void) {
    const cx = W / 2, cy = H / 2, font = '"Press Start 2P", "Courier New", monospace';
    const last = !this.chapter.next; // финал — дверь распахнута; иначе короткий проблеск-семя
    // тёплый проблеск + силуэт «тени» (критика) рядом
    const warm = this.add.graphics().setScrollFactor(0).setDepth(154).setAlpha(0);
    warm.fillStyle(0xffd9a0, 0.12); warm.fillCircle(cx, cy + 30, 220);
    warm.fillStyle(0xffd9a0, 0.08); warm.fillCircle(cx, cy + 30, 320);
    const shadow = this.add.sprite(cx, cy + 60, 'cat_idle').setOrigin(0.5, 1).setScale(2).setTint(0x2a1d3a).setAlpha(0).setScrollFactor(0).setDepth(155).play('p-idle');
    const ask = this.add.text(cx, 120, 'бил, бежал, уступал — он всё равно тут.\nостался один ход: повернуться к нему.',
      { fontFamily: font, fontSize: '12px', color: '#ffe0b0', align: 'center', lineSpacing: 10,
        backgroundColor: 'rgba(8,6,18,0.7)', padding: { x: 14, y: 10 } })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(156).setAlpha(0);
    const prompt = this.add.text(cx, H - 70, IS_TOUCH ? 'тапни — ПОВЕРНУТЬСЯ' : 'E / клик — ПОВЕРНУТЬСЯ',
      { fontFamily: font, fontSize: '11px', color: '#88ffcc', backgroundColor: 'rgba(8,6,18,0.7)', padding: { x: 10, y: 7 } })
      .setOrigin(0.5).setScrollFactor(0).setDepth(156).setAlpha(0);
    this.tweens.add({ targets: [warm, shadow], alpha: { from: 0, to: 1 }, duration: 1000 });
    this.tweens.add({ targets: ask, alpha: 1, duration: 900, delay: 600 });
    this.tweens.add({ targets: prompt, alpha: 0.9, duration: 600, delay: 1600 });

    let done = false;
    const meet = () => {
      if (done) return; done = true;
      track('contact_glimpse', { chapter: this.chapter.id }); // «дошёл до момента узнавания»
      this.input.keyboard!.off('keydown', meet);
      audio.pickup();
      this.cameras.main.flash(500, 60, 50, 30);
      this.tweens.add({ targets: prompt, alpha: 0, duration: 300 });
      // тень не исчезает — становится маленькой и садится рядом, а не сверху
      this.tweens.add({ targets: shadow, scale: 1, x: cx + 70, y: cy + 50, duration: 900, ease: 'Quad.Out' });
      this.tweens.add({ targets: warm, alpha: 1.6, duration: 900, yoyo: true });
      ask.setText(this.modeName() + (last
        ? 'ты повернулся — и он сел рядом, а не навис.\nодному так не суметь. этому учит терапия.'
        : 'ты повернулся — и он рядом, а не сверху.\nна миг, но по-другому.'));
      this.time.delayedCall(last ? 3200 : 2600, () => {
        this.tweens.add({ targets: [warm, shadow, ask], alpha: 0, duration: 700,
          onComplete: () => { [warm, shadow, ask, prompt].forEach(o => o.destroy()); onDone(); } });
      });
    };
    // даём прочитать, потом ловим ввод
    this.time.delayedCall(1700, () => {
      this.input.keyboard!.once('keydown', meet);
      this.input.once('pointerdown', meet);
    });
  }

  // Мост в реальную терапию — карточка-результат + воронка + виральность
  private showCta() {
    track('demo_end', { chapter: this.chapter.id });
    const ky = H / 540, font = '"Press Start 2P", "Courier New", monospace';
    const mk = (y: number, text: string, size: number, color: string, depth = 153) =>
      this.add.text(W / 2, y * ky, text, { fontFamily: font, fontSize: `${size}px`, color, align: 'center', lineSpacing: 9 })
        .setOrigin(0.5).setScrollFactor(0).setDepth(depth).setAlpha(0);

    // Карточка-результат: «твой главный враг» = режим (виральный крючок, п.7)
    const top  = mk(196, '🐈‍⬛  ты прошёл сквозь свою голову.', 12, '#d8c8ec');
    const lbl  = mk(244, 'твой главный враг —', 10, '#9a8fb8');
    const mode = mk(282, this.modeShort(), 16, '#ff8aa6');
    const sub  = mk(336, 'его не одолеть в одиночку.\nно рядом — можно. дальше — терапия.', 11, '#a8e8d0');

    const ctaTxt = mk(404, 'узнать про схема-терапию →', 11, '#88ffcc', 154);
    const cta = this.add.rectangle(W / 2, 404 * ky, ctaTxt.width + 34, 38, 0x153028)
      .setStrokeStyle(2, 0x88ffcc).setScrollFactor(0).setDepth(153).setAlpha(0).setInteractive({ useHandCursor: true });
    const shareTxt = mk(452, 'поделиться →', 10, '#c0b8e8', 154);
    const share = this.add.rectangle(W / 2, 452 * ky, shareTxt.width + 30, 34, 0x241d3a)
      .setStrokeStyle(1, 0x6a5aaf).setScrollFactor(0).setDepth(153).setAlpha(0).setInteractive({ useHandCursor: true });
    const menu = mk(498, 'или — в меню', 9, '#5a4f7a', 154).setInteractive({ useHandCursor: true });

    this.tweens.add({ targets: [top], alpha: 1, duration: 800 });
    this.tweens.add({ targets: [lbl, mode], alpha: 1, duration: 700, delay: 500 });
    this.tweens.add({ targets: [sub], alpha: 1, duration: 700, delay: 1100 });
    this.tweens.add({ targets: [ctaTxt, cta], alpha: 1, duration: 700, delay: 1600 });
    this.tweens.add({ targets: [shareTxt, share], alpha: 1, duration: 700, delay: 2000 });
    this.tweens.add({ targets: menu, alpha: 0.7, duration: 700, delay: 2400 });

    cta.on('pointerover', () => cta.setFillStyle(0x1d4536));
    cta.on('pointerout', () => cta.setFillStyle(0x153028));
    cta.on('pointerdown', () => { track('cta_click'); window.open('https://schemalab.ru/?from=game', '_blank'); });
    share.on('pointerover', () => share.setFillStyle(0x322a52));
    share.on('pointerout', () => share.setFillStyle(0x241d3a));
    share.on('pointerdown', () => {
      track('cta_share');
      const url = 'https://schemalab.ru/game/';
      const text = `Прошёл сквозь собственную голову в этой игре. Мой главный враг — ${this.modeShort()}. А твой?`;
      window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    });
    menu.on('pointerdown', () => this.scene.start('Start'));
  }

  // ── Damage / lives ─────────────────────────────────────────────────────────
  private damage(fromX: number) {
    if (this.assistInvuln) return; // ассист «не умирать»
    // копинг «сохраняет в моменте»: пока залип (зона) — урон не проходит
    if (this.frozen) { this.sayOnce('frz_safe', 'пока залип — не достают. но и не уйду.', 2600); return; }
    this.hidePlay();
    this.invuln = 1100; this.hearts -= 1; this.updateHearts();
    this.doHitstop(70); this.cameras.main.shake(220, 0.014); this.cameras.main.flash(140, 120, 20, 40); audio.hurt();
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    b.setVelocity(Math.sign(this.player.x - fromX) * 240, -210);
    this.sayOnce('firsthit', 'ай! да я ничего не могу — только бежать!', 2800);
    if (this.hearts <= 0) this.gameOver();
  }

  private gameOver() {
    if (this.dead) return;            // не запускать дважды (смерть во время overwhelm)
    this.dead = true;
    track('game_over', { chapter: this.chapter.id });
    audio.stopMusic();
    // сразу гасим хаос (огромные тучи и пр.) чёрной шторой — иначе он лезет в кадр
    const cover = this.add.rectangle(W / 2, H / 2, W, H, 0x06040e).setScrollFactor(0).setDepth(150).setAlpha(0);
    this.tweens.add({ targets: cover, alpha: 1, duration: 700 });
    const txt = this.add.text(W / 2, H / 2, 'так больше нельзя...', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '20px', color: '#ff7799', letterSpacing: 2 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);
    this.tweens.add({ targets: txt, alpha: 1, duration: 800, delay: 400 });
    // «дно» — момент, когда дверь нужнее всего: даём контакт, не просто рестарт
    this.time.delayedCall(2200, () => {
      txt.destroy();
      this.contactGlimpse(() => this.scene.restart());
    });
  }

  // приземление: облачко пыли + лёгкий squash — вес и тактильность
  private onLand() {
    this.player.setScale(1.7, 1.3);
    this.tweens.add({ targets: this.player, scaleX: 1.5, scaleY: 1.5, duration: 110, ease: 'Quad.Out' });
    for (let i = 0; i < 5; i++) {
      const dx = (Math.random() - 0.5) * 28;
      const p = this.add.rectangle(this.player.x + dx, this.player.y - 2, 3, 3, 0xc8bcd8, 0.7).setDepth(9);
      this.tweens.add({ targets: p, x: p.x + dx * 1.5, y: p.y - Math.random() * 8, alpha: 0, duration: 280, onComplete: () => p.destroy() });
    }
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
  // «Отвлечься» = Мистер играет с клубком; мысли теряют к нему интерес
  private showPlay() {
    this.safeAnim('p-play', 'cat_play', 0, 5, 7, -1); // спрайт грузится в фоне — создаём при первом использовании
    if (!this.anims.exists('p-play')) return; // клубок не доехал — кот просто стоит, без анимации
    if (!this.playSprite.visible) {
      this.playSprite.setVisible(true).play('p-play');
      this.player.setVisible(false);
    }
    this.playSprite.setPosition(this.player.x, this.player.y).setFlipX(this.player.flipX);
  }
  private hidePlay() {
    if (this.playSprite.visible) { this.playSprite.setVisible(false); this.player.setVisible(true); }
  }

  // ── Cat voice ──────────────────────────────────────────────────────────────
  // не перебиваем читаемую реплику — иначе мельтешат и не прочитать
  private say(text: string, dur: number): boolean {
    if (this.bubbleT > 900) return false;
    this.bubble.setText(text).setAlpha(1); this.bubbleT = dur; return true;
  }
  private sayOnce(key: string, text: string, dur: number) {
    if (this.said.has(key)) return;
    if (this.say(text, dur)) this.said.add(key); // не «съедаем» ключ, если реплику не показали
  }
  private updateBubble(dt: number) {
    if (this.bubbleT <= 0) return;
    this.bubble.x = this.player.x; this.bubble.y = this.player.y - 52;
    this.bubbleT -= dt;
    if (this.bubbleT < 300) this.bubble.setAlpha(Math.max(0, this.bubbleT / 300));
  }
}
