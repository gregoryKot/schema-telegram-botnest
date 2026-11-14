import Phaser from 'phaser';
import { H, CAM_TOP } from '../constants';
import { audio } from '../audio';
import { CHAPTERS, DEFAULT_CHAPTER, ChapterConfig } from '../chapters';
import type { HomeMob } from '../enemies/home';
import type { Door, ExcuseVoice } from '../doors';
import { buildDecor } from '../decor';
import { setTouchControls } from '../controls';
import { ensureEnemyAnims } from '../props';
import { t, type MsgKey } from '../i18n';
import { getAssist } from '../assist';
import { trackEvent } from '../analytics';
import { gameOver } from './game/death';
import { restoreCopingButtons, sessionScene } from './game/cabinet';
import { showBranch } from './game/cta';
import { updateAnx, type Anx } from './game/anx';
import { updateCritic, type Critic } from './game/critic';
import { updateMoves } from './game/moves';
import { updateAttack } from './game/attack';
import { buildBackground, buildGround, buildPlatforms, buildSpikes, buildHearts, buildMemories } from './game/level';
import { setupTriggers, updateTriggers } from './game/triggers';
import { buildDoors, updateDoors, updateGates, type Gate } from './game/gates';
import { spawnPlayer, setupInput } from './game/player';
import { showTitleCard, buildHUD, updateBubble } from './game/hud';
import { updateSpiral, updateHazards, fallRespawn } from './game/world';

// ════════════════════════════════════════════════════════════════════════════
//  GAME — the gameplay engine. A "chapter" (config in chapters.ts) supplies the
//  level data; this scene just runs it. Core: fight / freeze / flee.
// ════════════════════════════════════════════════════════════════════════════

const trackedStarts = new Set<string>(); // chapter_start один раз за загрузку страницы

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
  gates: Gate[] = [];
  speedMult = 1;
  trail: { x: number; y: number; flip: boolean }[] = [];

  hearts = 3;
  heartsText!: Phaser.GameObjects.Text;
  invuln = 0;
  private checkpointX = 100;
  dead = false;

  floorColliders: Phaser.GameObjects.Rectangle[] = [];
  platColliders: Phaser.GameObjects.Rectangle[] = [];
  spikeRects: { x: number; w: number }[] = [];
  heartPickups: Phaser.GameObjects.Image[] = [];
  memories: Phaser.GameObjects.Sprite[] = [];
  memText!: Phaser.GameObjects.Text;
  memGot = 0; memTotal = 0;
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
  exhaustOverlay!: Phaser.GameObjects.Graphics;
  assistInvuln = false;                    // ассист-режим: «без урона»
  deathsInChapter = 0;                     // после второй смерти экран смерти сам предлагает ассист
  deathX = 100;                            // где умер — оттуда считаем чекпоинт
  overwhelmed = false;
  triggers: { x: number; done: boolean; fn: () => void }[] = [];
  wasFrozen = false;

  bubble!: Phaser.GameObjects.Text; bubbleT = 0;
  private said = new Set<string>();

  // Акт II «Дорога»: дверь терапевта + отговорки-заслоны, которым отвечают
  doors: Door[] = [];
  voices: ExcuseVoice[] = [];
  copingsOff = false;         // у финальной двери копинги гаснут
  finalApproach = false;
  sessionLines: Phaser.GameObjects.Text[] = []; // реплики кабинета гл.4 — гасим перед CTA
  frameQueue: [MsgKey, MsgKey][] = [];      // стоп-кадры, пришедшие, пока открыт другой (два триггера подряд)
  titleCard: Phaser.GameObjects.Text[] = [];  // титул главы — гасим, если первый стоп-кадр пришёл раньше

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

    buildBackground(this);
    this.exhaustOverlay = this.add.graphics().setScrollFactor(0).setDepth(59); // виньетка истощения
    buildDecor(this, this.chapter);
    buildGround(this);
    buildPlatforms(this);
    buildSpikes(this);
    ensureEnemyAnims(this);
    buildHearts(this);
    buildMemories(this);
    spawnPlayer(this);
    buildHUD(this);
    setupInput(this);
    setupTriggers(this);
    buildDoors(this);
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
    showTitleCard(this);
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

  dropTitleCard() {
    for (const o of this.titleCard) { this.tweens.killTweensOf(o); o.destroy(); }
    this.titleCard = [];
  }

  // Создать анимацию только если её спрайт-лист реально загрузился.
  safeAnim(key: string, sheet: string, start: number, end: number, frameRate: number, repeat: number) {
    if (this.anims.exists(key) || !this.textures.exists(sheet)) return;
    this.anims.create({ key, frames: this.anims.generateFrameNumbers(sheet, { start, end }), frameRate, repeat });
  }

  updateHearts() {
    this.heartsText.setText('♥'.repeat(Math.max(0, this.hearts)) + '·'.repeat(Math.max(0, 3 - this.hearts)));
  }

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
    updateTriggers(this);
    updateGates(this, dt);
    updateDoors(this, dt);
    updateHazards(this);
    updateBubble(this, dt);
    updateSpiral(this, dt);
    if (this.invuln > 0) this.invuln -= dt;
    if (this.player.y > H + 70) fallRespawn(this);
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
}
