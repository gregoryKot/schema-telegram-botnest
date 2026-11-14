import Phaser from 'phaser';
import { W, H, GROUND_Y, S, CAM_TOP } from '../constants';
import { audio } from '../audio';
import { CHAPTERS, DEFAULT_CHAPTER, ChapterConfig } from '../chapters';
import { HomeMob, MobCtx, Procrastination, PhoneMob, Irritation } from '../enemies/home';
import { SelfSoothe, CrookedMirror, Bargainer } from '../enemies/road';
import { Door, ExcuseVoice } from '../doors';
import { buildDecor } from '../decor';
import { IS_TOUCH, setTouchControls } from '../controls';
import { ensureEnemyAnims, LEDGE } from '../props';
import { buildGroundStrip, groundKey } from '../ground';
import { t, type MsgKey } from '../i18n';
import { getAssist } from '../assist';
import { track, trackEvent } from '../analytics';
import { gameOver } from './game/death';
import { addGlow, HUD_STROKE } from '../look';
import { storyFrame } from './game/frames';
import { beginOverwhelm } from './game/ending';
import { onDoorEnter, beginFinalApproach, restoreCopingButtons, sessionScene } from './game/cabinet';
import { showBranch } from './game/cta';
import { spawnAnx, updateAnx, type Anx } from './game/anx';
import { spawnCritic, updateCritic, type Critic } from './game/critic';
import { updateMoves } from './game/moves';
import { updateAttack } from './game/attack';

// ════════════════════════════════════════════════════════════════════════════
//  GAME — the gameplay engine. A "chapter" (config in chapters.ts) supplies the
//  level data; this scene just runs it. Core: fight / freeze / flee.
// ════════════════════════════════════════════════════════════════════════════

const trackedStarts = new Set<string>(); // chapter_start один раз за загрузку страницы
// Стоп-кадры знакомства с врагами — один раз на игрока, а не на главу: живут вне
// сцены и в localStorage, иначе каждая глава и каждый рестарт «представляли» заново.
const INTRO_KEY = 'rtym_intro';
const introduced = new Set<string>();
try { for (const k of JSON.parse(localStorage.getItem(INTRO_KEY) ?? '[]') as unknown[]) introduced.add(String(k)); } catch { /* приватный режим — без памяти */ }
function markIntroduced(key: string) {
  introduced.add(key);
  try { localStorage.setItem(INTRO_KEY, JSON.stringify([...introduced])); } catch { /* ок */ }
}


// Боевой гейт: стена «не пройти, пока не разобрался» — падает, когда все
// привязанные враги разрешены (убиты / успокоены / выключены).
interface Gate {
  x: number; col: Phaser.GameObjects.Rectangle; gfx: Phaser.GameObjects.Graphics;
  mobs: { alive: boolean }[]; open: boolean; t: number;
}

export class GameScene extends Phaser.Scene {
  chapter!: ChapterConfig;
  player!: Phaser.Physics.Arcade.Sprite;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;

  anx: Anx[] = [];
  critic: Critic | null = null;
  criticBubble: Phaser.GameObjects.Text | null = null;
  criticSayT = 0; criticLine = 0;
  homeMobs: HomeMob[] = [];
  private gates: Gate[] = [];
  speedMult = 1;
  trail: { x: number; y: number; flip: boolean }[] = [];

  hearts = 3;
  private heartsText!: Phaser.GameObjects.Text;
  invuln = 0;
  private checkpointX = 100;
  dead = false;

  private floorColliders: Phaser.GameObjects.Rectangle[] = [];
  private spikeRects: { x: number; w: number }[] = [];
  private heartPickups: Phaser.GameObjects.Image[] = [];
  private memories: Phaser.GameObjects.Sprite[] = [];
  private memText!: Phaser.GameObjects.Text;
  private memGot = 0; private memTotal = 0;
  readonly MAX_HEARTS = 5;

  // moves
  attacking = false; attackT = 0; attackCd = 0;
  attackHit = new Set<object>();
  dashing = false; dashT = 0; dashCd = 0; dashDir = 1;
  frozen = false; private freezePulseT = 0;
  coyoteT = 0; jumpBufferT = 0; wasOnGround = true; jumping = false;
  slash!: Phaser.GameObjects.Graphics;
  playSprite!: Phaser.GameObjects.Sprite;
  sleepSprite!: Phaser.GameObjects.Sprite;
  lungeSprite!: Phaser.GameObjects.Sprite; // атака — выпад с красными штрихами
  playerLight!: Phaser.GameObjects.Image;

  hitstop = 0;
  exhaustion = 0;                          // спираль: копинг + время → мир враждебнее
  private exhaustOverlay!: Phaser.GameObjects.Graphics;
  assistInvuln = false;                    // ассист-режим: «без урона»
  deathsInChapter = 0;                     // после второй смерти экран смерти сам предлагает ассист
  deathX = 100;                            // где умер — оттуда считаем чекпоинт
  overwhelmed = false;
  private triggers: { x: number; done: boolean; fn: () => void }[] = [];
  wasFrozen = false;

  private bubble!: Phaser.GameObjects.Text; private bubbleT = 0;
  private said = new Set<string>();

  // Акт II «Дорога»: дверь терапевта + отговорки-заслоны, которым отвечают
  private doors: Door[] = [];
  private voices: ExcuseVoice[] = [];
  copingsOff = false;         // у финальной двери копинги гаснут
  finalApproach = false;
  sessionLines: Phaser.GameObjects.Text[] = []; // реплики кабинета гл.4 — гасим перед CTA
  frameQueue: [MsgKey, MsgKey][] = [];      // стоп-кадры, пришедшие, пока открыт другой (два триггера подряд)
  private titleCard: Phaser.GameObjects.Text[] = [];  // титул главы — гасим, если первый стоп-кадр пришёл раньше

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
      frozen: false, hitstop: 0, exhaustion: 0, overwhelmed: false, wasFrozen: false, deathsInChapter: 0, frameQueue: [],
      coyoteT: 0, jumpBufferT: 0, wasOnGround: true, jumping: false,
      bubbleT: 0, attackT: 0, dashT: 0, // иначе переживают restart: пустая плашка реплики в новой главе
    });
    this.said = new Set();
    this.attackHit = new Set();
    this.triggers = []; this.gates = [];
    this.floorColliders = []; this.platColliders = []; this.spikeRects = []; this.heartPickups = [];
    this.memories = []; this.memGot = 0; this.memTotal = 0;
    this.doors = []; this.voices = []; this.sessionLines = [];
    this.copingsOff = false; this.finalApproach = false;
    restoreCopingButtons(); // после финальной двери прошлого захода

    this.buildBackground();
    this.exhaustOverlay = this.add.graphics().setScrollFactor(0).setDepth(59); // виньетка истощения
    buildDecor(this, this.chapter);
    this.buildGround();
    this.buildPlatforms();
    this.buildSpikes();
    ensureEnemyAnims(this);
    this.buildHearts();
    this.buildMemories();
    this.spawnPlayer();
    this.buildHUD();
    this.setupInput();
    this.setupTriggers();
    this.buildDoors();
    // гл.4 — не платформер, а скриптовая сцена первого сеанса
    if (this.chapter.id === 'chapter4') this.time.delayedCall(2400, () => sessionScene(this));

    // Ассист-режим (этика для ЦА в дистрессе): больше жизней / бессмертие
    const assist = getAssist();
    if (assist.extraLives) { this.hearts = this.MAX_HEARTS; this.updateHearts(); }
    this.assistInvuln = assist.invuln;

    this.cameras.main.setBounds(0, -CAM_TOP, ARENA_W, H + CAM_TOP);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.physics.world.setBounds(0, -H, ARENA_W, H * 3);
    this.cameras.main.fadeIn(600, 8, 6, 16);
    this.showTitleCard();
    if (!trackedStarts.has(this.chapter.id)) { // рестарты после смерти — не «старт»
      trackedStarts.add(this.chapter.id);
      trackEvent('game_chapter_start', { chapter: this.chapter.id });
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
      this.add.text(W / 2, y, text, { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: `${size}px`, color, letterSpacing: 3, align: 'center', ...HUD_STROKE, wordWrap: { width: W - 48 } })
        .setOrigin(0.5).setScrollFactor(0).setDepth(120).setAlpha(0);
    const t1 = mk(170, t(this.chapter.title).toUpperCase(), 24, '#fff0d8');
    const t2 = mk(208, t(this.chapter.tagline), 11, '#d8c8ec');
    this.titleCard = [t1, t2];
    this.tweens.add({ targets: [t1, t2], alpha: 1, duration: 700, delay: 350 });
    this.tweens.add({ targets: [t1, t2], alpha: 0, duration: 800, delay: 3200, onComplete: () => this.dropTitleCard() });
  }
  dropTitleCard() {
    for (const o of this.titleCard) { this.tweens.killTweensOf(o); o.destroy(); }
    this.titleCard = [];
  }

  // ── Atmosphere — inside a restless mind ─────────────────────────────────────
  private buildBackground() {
    const ARENA_W = this.chapter.arenaW;
    const pal = this.chapter.palette;
    const g = this.add.graphics().setScrollFactor(0).setDepth(-9);
    g.fillGradientStyle(pal.skyTop, pal.skyTop, pal.skyBot, pal.skyBot, 1, 1, 1, 1);
    g.fillRect(0, 0, W, H);
    // distant glow lighting the play zone
    addGlow(this, W / 2, GROUND_Y - 10, W * 1.8, 420, pal.glow1, 0.30, -8).setScrollFactor(0);
    addGlow(this, W / 2, GROUND_Y - 10, W * 1.1, 260, pal.glow2, 0.22, -8).setScrollFactor(0);
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
    const key = groundKey(this.chapter.theme);
    const edges = [0, ...pits.flatMap(p => [p.s, p.e]), ARENA_W];
    for (let i = 0; i < edges.length - 1; i += 2) {
      const sx = edges[i], ex = edges[i + 1], w = ex - sx;
      buildGroundStrip(this, key, sx, ex, 2);
      const r = this.add.rectangle(sx + w / 2, GROUND_Y + 20, w, 40, 0, 0);
      this.physics.add.existing(r, true);
      this.floorColliders.push(r);
    }
  }

  // ── Level geometry: a deliberate line — intro · gaps · spikes · climb · gauntlet
  private buildPlatforms() {
    const tw = 16 * S, th = 10 * S;
    const P = this.chapter.platforms;
    const ledge = this.chapter.theme === 'room' ? LEDGE.room : LEDGE.street;
    const platTex = this.chapter.theme === 'room' ? 'plat_room' : 'plat';
    const LH = 16; // карниз 48×16 в логических пикселях, показ ×2; верх — поверхность (p.y)
    for (const p of P) {
      if (this.textures.exists(ledge.key)) {
        // настоящий карниз: торцы не тянутся, середина растягивается под ширину
        this.add.nineslice(p.x + p.w / 2, p.y + LH, ledge.key, undefined, p.w / 2, LH, ledge.cap, ledge.cap, 0, 0).setScale(2).setDepth(2);
      } else {
        const cols = Math.ceil(p.w / tw); // запасной процедурный тайл
        for (let i = 0; i < cols; i++)
          this.add.image(p.x + i * tw + tw / 2, p.y + th / 2, platTex).setDepth(2).setTint(this.chapter.palette.platTint);
      }
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

  // Тёплые воспоминания — коллектиблы; часть на секретных верхних маршрутах
  private buildMemories() {
    const spots = this.chapter.memories ?? [];
    this.memTotal = spots.length;
    for (const s of spots) {
      const img = this.add.sprite(s.x, s.y, 'memory').setDepth(7).setScale(0.9);
      if (this.anims.exists('memory-twinkle')) img.play('memory-twinkle');
      this.tweens.add({ targets: img, y: s.y - 7, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.memories.push(img);
    }
  }

  // Story beats fire as you ADVANCE — running right = the day passing toward dusk
  private setupTriggers() {
    this.triggers = this.chapter.triggers.map(t => ({
      x: t.x, done: false,
      fn: () => {
        const beforeA = this.anx.length, beforeH = this.homeMobs.length;
        if (t.anx) { for (let i = 0; i < t.anx; i++) spawnAnx(this, this.player.x + 360 + i * 120, 1);
          this.introOnce('anx', 'm_anxiety', 'm_hit_it_it_splits_avoid_it'); }
        if (t.critic) spawnCritic(this); // у критика свой стоп-кадр
        if (t.proc) { this.homeMobs.push(new Procrastination(this.mobCtx(), t.proc, t.seat ? GROUND_Y - t.seat : undefined));
          this.introOnce('proc', 'm_procrastination', 'm_it_clings_drags_you_down_a'); }
        if (t.phone) { this.homeMobs.push(new PhoneMob(this.mobCtx(), t.phone));
          this.introOnce('phone', 'm_the_phone', 'm_lures_you_into_comfort_steals_time'); }
        if (t.irrit) { this.homeMobs.push(new Irritation(this.mobCtx(), t.irrit));
          this.introOnce('irrit', 'm_irritation', 'm_flares_out_of_nowhere_blow_off'); }
        // зазывалы Акта II — без интро-стоп-кадров: их дверь представится сама
        if (t.soothe) this.homeMobs.push(new SelfSoothe(this.mobCtx(), t.soothe));
        if (t.mirror) this.homeMobs.push(new CrookedMirror(this.mobCtx(), t.mirror));
        if (t.bargainer) this.homeMobs.push(new Bargainer(this.mobCtx(), t.bargainer));
        if (t.say) { this.say(t.say, 2400); if (t.anx) audio.anx(); }
        if (t.gate) this.makeGate(t.gate, [...this.anx.slice(beforeA), ...this.homeMobs.slice(beforeH)]);
        if (t.overwhelm) beginOverwhelm(this);
      },
    }));
  }
  // «привет, это —» : представляем врага стоп-кадром при первой встрече
  introOnce(key: string, name: MsgKey, line: MsgKey) {
    if (introduced.has(key)) return;
    markIntroduced(key);
    storyFrame(this, name, line);
  }

  // shared context the home-chapter mobs use to read/affect the player
  private mobCtx(): MobCtx {
    return {
      scene: this,
      player: () => this.player,
      frozen: () => this.frozen,
      dashing: () => this.dashing,
      damage: (fromX, throughFreeze) => { if (this.invuln <= 0) this.damage(fromX, throughFreeze); },
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

  // ── Акт II «Дорога»: дверь терапевта + отговорки-заслоны ────────────────────
  // Отговорка = голос-пузырь + невидимый гейт. Копинги на неё не действуют —
  // путь открывает только ОТВЕТ (E/тап). Ответы — голос терапевта.
  private buildDoors() {
    if (!this.chapter.doors?.length) return;
    for (const cfg of this.chapter.doors)
      this.doors.push(new Door(this, cfg.kind, cfg.x, () => onDoorEnter(this), this.chapter.arenaW));
    // заслоны: (x голоса, реплики, ответ) — гейт чуть дальше голоса
    const blocks: { x: number; lines: MsgKey[]; answer: MsgKey }[] = [
      { x: 880,  lines: ['m_exc_pass', 'm_exc_later'],        answer: 'm_ans_later' },
      { x: 1720, lines: ['m_exc_expensive'],                  answer: 'm_ans_expensive' },
      { x: 2520, lines: ['m_exc_fine', 'm_exc_others_worse'], answer: 'm_ans_fine' },
      { x: 3260, lines: ['m_exc_worse'],                      answer: 'm_ans_worse' },
    ];
    for (const b of blocks) {
      const stub = { alive: true };                       // держит гейт, пока не ответил
      this.makeGate(b.x + 90, [stub]);
      this.voices.push(new ExcuseVoice(this, b.x, GROUND_Y - 150, b.lines, b.answer,
        v => { stub.alive = false; this.onVoiceAnswered(v); }));
    }
    // тач: пузырь — мелкая цель, поэтому тап В ЛЮБОМ месте рядом с голосом = ответить.
    // guard по hitstop: тап, закрывающий стоп-кадр, не должен заодно «ответить».
    this.input.on('pointerdown', () => {
      if (this.dead || this.hitstop > 0) return;
      this.voices.find(v => !v.answered && v.near(this.player.x))?.doAnswer();
    });
  }

  private updateDoors(dt: number) {
    if (!this.doors.length) return;
    for (const d of this.doors) d.update(dt, this.player.x);
    for (const v of this.voices) v.update(dt, this.player.x);
    // E: сначала ответить голосу рядом, иначе — войти в дверь рядом
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      const v = this.voices.find(v => !v.answered && v.near(this.player.x));
      if (v) v.doAnswer();
      else this.doors.find(d => d.near(this.player.x))?.tryEnter();
    }
    // финальный подход к двери терапевта: копинги гаснут один за другим
    const th = this.doors.find(d => d.kind === 'therapist');
    if (th && !this.finalApproach && this.player.x > th.x - 420) beginFinalApproach(this);
  }

  private onVoiceAnswered(v: ExcuseVoice) {
    track('excuse_answered', { answer: v.answer });
    audio.gate();
    this.say(v.answer, 3400);
    this.burst(this.player.x, this.player.y - 30, 0x88ffcc, 10, 130);
    if (this.hearts < this.MAX_HEARTS) { this.hearts += 1; this.updateHearts(); } // ответил себе — стало легче
  }

  // ── Гейты: дальше нельзя, пока не разобрался с тем, что навалилось ─────────
  private makeGate(x: number, mobs: { alive: boolean }[]) {
    const col = this.add.rectangle(x, GROUND_Y / 2, 18, GROUND_Y + 40, 0, 0);
    this.physics.add.existing(col, true);
    this.physics.add.collider(this.player, col, () =>
      this.sayOnce('gate', 'm_can_t_pass_deal_with_this', 2600));
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
    this.say('m_it_let_go_not_for_long', 2400);
  }

  // тревога, отколовшаяся от «гейтовой», тоже держит стену
  adoptIntoGate(parent: object, child: object) {
    const g = this.gates.find(g => !g.open && g.mobs.includes(parent as { alive: boolean }));
    if (g) g.mobs.push(child as { alive: boolean });
  }

  // Создать анимацию только если её спрайт-лист реально загрузился.
  safeAnim(key: string, sheet: string, start: number, end: number, frameRate: number, repeat: number) {
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
    this.player.setCollideWorldBounds(true); // за дверью гл.3 мир кончается — раньше кот падал с края
    this.player.play('p-idle');
    for (const r of this.floorColliders) this.physics.add.collider(this.player, r);
    for (const r of this.platColliders) this.physics.add.collider(this.player, r);

    // soft light pool — keeps the cat readable in the dark, "your small light"
    this.playerLight = addGlow(this, 0, 0, 260, 260, 0xffe9c0, 0.14, 1);

    this.slash = this.add.graphics().setDepth(11);
    // cat_play/cat_sleep/cat_dash — необязательные спрайты (грузятся отдельными
    // запросами и могут не доехать). Анимацию создаём ТОЛЬКО если текстура есть —
    // иначе .play() по пустой анимации роняет update-цикл и игра «зависает».
    this.safeAnim('p-play', 'cat_play', 0, 5, 7, -1);
    this.safeAnim('p-sleep', 'cat_sleep', 0, 5, 6, 0);
    this.playSprite = this.add.sprite(0, 0, 'cat_play', 0).setOrigin(0.5, 1).setScale(1.5).setDepth(10).setVisible(false);
    this.sleepSprite = this.add.sprite(0, 0, 'cat_sleep', 0).setOrigin(0.5, 1).setScale(1.5).setDepth(10).setVisible(false);
    this.safeAnim('p-lunge', 'cat_dash', 1, 5, 24, 0);
    this.lungeSprite = this.add.sprite(0, 0, 'cat_dash', 5).setOrigin(0.5, 1).setScale(1.5).setDepth(11).setVisible(false);
    this.bubble = this.add.text(0, 0, '', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '11px', color: '#fff0d8',
      backgroundColor: 'rgba(16,12,30,0.88)', padding: { x: 9, y: 5 }, align: 'center' })
      .setOrigin(0.5, 1).setDepth(45).setAlpha(0);
  }

  private buildHUD() {
    this.heartsText = this.add.text(18, 14, '', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '24px', color: '#ff5577', ...HUD_STROKE })
      .setScrollFactor(0).setDepth(100);
    this.updateHearts();
    // счётчик воспоминаний — только если они есть в главе
    this.memText = this.add.text(18, 48, this.memTotal ? `✦ 0/${this.memTotal}` : '', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '14px', color: '#ffd86a', ...HUD_STROKE })
      .setScrollFactor(0).setDepth(100);
    if (!IS_TOUCH)
      this.add.text(W / 2, H - 20, t('m_x_fight_z_avoid_tap_dash'), { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '11px', color: '#a89fd0', ...HUD_STROKE })
        .setOrigin(0.5, 1).setScrollFactor(0).setDepth(100);
  }
  updateHearts() {
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
      E: this.input.keyboard!.addKey('E'), // Акт II: войти в дверь / ответить отговорке
    };
  }

  // ── Spawns ───────────────────────────────────────────────────────────────--



  // ── Main loop ────────────────────────────────────────────────────────────--
  // тонкая обёртка: дёргается из e2e-browser/game-smoke.spec.ts
  showBranch(nextChapter: string) { showBranch(this, nextChapter); }

  update(_t: number, delta: number) {
    if (this.dead) return;
    if (this.hitstop > 0) { this.hitstop -= delta; return; }
    const dt = delta;
    this.speedMult = 1;
    for (const m of this.homeMobs) m.update(dt);     // могут замедлить игрока на этот кадр
    this.homeMobs = this.homeMobs.filter(m => m.alive);
    updateMoves(this, dt);
    updateAttack(this, dt);
    updateAnx(this, dt);
    updateCritic(this, dt);
    this.updateTriggers();
    this.updateGates(dt);
    this.updateDoors(dt);
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
    // тёплые воспоминания
    for (const m of this.memories) {
      if (!m.active) continue;
      if (Phaser.Math.Distance.Between(px, py - 22, m.x, m.y) < 34) {
        this.collectMemory(m);
      }
    }
  }

  private collectMemory(m: Phaser.GameObjects.Sprite) {
    m.setActive(false); // сразу снимаем с учёта — иначе твин-исчезновение даёт двойной счёт
    this.memGot++;
    audio.pickup();
    this.burst(m.x, m.y, 0xffd870, 10, 120);
    this.tweens.add({ targets: m, y: m.y - 24, alpha: 0, scale: 1.6, duration: 380, onComplete: () => m.destroy() });
    this.memText?.setText(`✦ ${this.memGot}/${this.memTotal}`);
    if (this.memGot >= this.memTotal && this.memTotal > 0) {
      // все собраны — награда: тёплая строка + полное здоровье
      this.hearts = this.MAX_HEARTS; this.updateHearts();
      this.cameras.main.flash(300, 80, 70, 30);
      this.say('m_every_warm_thought_is_with_you', 3200);
    } else {
      this.sayOnce('mem_first', 'm_warm_good_things_exist_too_gather', 2400);
    }
  }

  private fallRespawn() {
    const cp = [...this.chapter.checkpoints].reverse().find(c => c <= this.player.x) ?? 100;
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    b.reset(cp, GROUND_Y - 60); b.setVelocity(0, 0);
    this.cameras.main.shake(160, 0.008);
    this.player.setAlpha(0.35);
    this.tweens.add({ targets: this.player, alpha: 1, duration: 450 });
    // падение в пропасть — реальная потеря: минус жизнь (i-кадры от двойного списания)
    if (this.assistInvuln || this.invuln > 0) return;
    this.invuln = 900;
    this.hearts -= 1; this.updateHearts();
    audio.hurt(); // звук падения — раньше его не было
    this.cameras.main.flash(120, 80, 20, 40);
    this.say('m_fell_1_life', 1800);
    if (this.hearts <= 0) this.gameOver();
  }







  // ── Damage / lives ─────────────────────────────────────────────────────────
  damage(fromX: number, throughFreeze = false) {
    if (this.assistInvuln) return; // ассист «не умирать»
    if (this.finalApproach) return; // у двери терапевта кнопки погашены — и урона нет, тень только шепчет
    if (this.overwhelmed) return;    // «навалилось разом» — декорация финала: смерть тут отменяла развязку
    // копинг «сохраняет в моменте»: пока залип (зона) — урон не проходит
    if (this.frozen && !throughFreeze) { this.sayOnce('frz_safe', 'm_while_zoned_out_they_can_t', 2600); return; }
    this.hidePlay();
    this.invuln = 1100; this.hearts -= 1; this.updateHearts();
    this.doHitstop(70); this.cameras.main.shake(220, 0.014); this.cameras.main.flash(140, 120, 20, 40); audio.hurt();
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    b.setVelocity(Math.sign(this.player.x - fromX) * 240, -210);
    this.sayOnce('firsthit', 'm_ow_i_can_t_do_anything', 2800);
    if (this.hearts <= 0) this.gameOver();
  }

  gameOver() { gameOver(this); } // смок зовёт его на сцене


  // ── Juice helpers ────────────────────────────────────────────────────────--
  doHitstop(ms: number) { this.hitstop = ms; }
  burst(x: number, y: number, color: number, n: number, sp: number) {
    for (let i = 0; i < n; i++) {
      const p = this.add.rectangle(x, y, 3, 3, color).setDepth(12);
      const a = Math.random() * 6.28, s = sp * (0.5 + Math.random());
      this.tweens.add({ targets: p, x: x + Math.cos(a) * s, y: y + Math.sin(a) * s, alpha: 0, scale: 0,
        duration: 260 + Math.random() * 200, onComplete: () => p.destroy() });
    }
  }
  hidePlay() {
    if (this.playSprite.visible) { this.playSprite.setVisible(false); this.player.setVisible(true); }
  }

  // ── Cat voice ──────────────────────────────────────────────────────────────
  // не перебиваем читаемую реплику — иначе мельтешат и не прочитать
  say(text: MsgKey, dur: number): boolean {
    if (this.bubbleT > 900) return false;
    this.bubble.setText(t(text)).setAlpha(1); this.bubbleT = dur; return true;
  }
  sayOnce(key: string, text: MsgKey, dur: number) {
    if (this.said.has(key)) return;
    if (this.say(text, dur)) this.said.add(key); // не «съедаем» ключ, если реплику не показали
  }
  private updateBubble(dt: number) {
    if (this.bubbleT <= 0) return;
    const cam = this.cameras.main, hw = this.bubble.width / 2 + 6;
    this.bubble.x = Phaser.Math.Clamp(this.player.x, cam.scrollX + hw, cam.scrollX + W - hw); this.bubble.y = this.player.y - 52;
    this.bubbleT -= dt;
    if (this.bubbleT < 300) this.bubble.setAlpha(Math.max(0, this.bubbleT / 300));
  }
}
