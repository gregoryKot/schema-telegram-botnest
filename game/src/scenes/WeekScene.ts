// «Неделя»: Саша бежит сам, игрок прыгает и выбирает привычки с ценой; цель держится впереди,
// бег останавливает и цель открывает только ПАУЗА. Глава — данные (week/chapters.ts), цена — чистые функции (week/habits.ts).
import Phaser from 'phaser';
import { W, H, GROUND_Y, PHYS } from '../constants';
import { GRID } from '../gridScale';
import { setTouchControls } from '../controls';
import { audio } from '../audio';
import { t, type MsgKey } from '../i18n';
import { doorX, gateInReach, type Act, type Chapter } from '../week/chapter';
import { chapterById, nextChapter } from '../week/chapters';
import { runSpeed, type Pace } from '../week/run';
import {
  RULES, agree, glitchLevel, isResting, isSitting, jumpFactor, nameGlitch, newWeekState, overwork, reachClock, scroll,
  tick, type WeekState,
} from '../week/habits';
import { choosePause, holdPause, holdProgress, isFrozen, newPause, type PauseState } from '../week/pause';
import { SlipView } from '../week/slip';
import { addGate, buildWorld, openGate, type World } from '../week/world';
import { WordRain } from '../week/rain';
import { WeekHud } from '../week/hud';
import { showWeekCard } from '../week/card';
import { showWeekEnd } from '../week/endCard';
import { trackEvent } from '../analytics';
import { px as ui } from '../week/ui';
import { PausePanel } from '../week/pausePanel';
import { ACT_KEYS, WeekInput } from '../week/input';
import { enterWeekTouch, leaveWeekTouch, revealWeekAct } from '../week/touch';
import { makeWeekAnims, preloadWeekArt } from '../week/art';
import { makeBackdrop, type Backdrop } from '../week/scenery';
import { sashaLook } from '../week/look';
import { showWeekIntro } from '../week/intro';
import { WeekCoach } from '../week/coach';
import { peakDue } from '../week/guide';
import { isWeekDone, markWeekDone } from '../week/progress';

const DASH_SPEED = 520, DASH_MS = 260, PHONE_MS = 1200, LOW_PILE = 45, TALL_PILE = 170;
const LABEL: Record<Act, MsgKey> = {
  overwork: 'm_wk_act_overwork', scroll: 'm_wk_act_scroll', agree: 'm_wk_act_agree', pause: 'm_wk_act_pause',
};

export class WeekScene extends Phaser.Scene {
  ch!: Chapter;
  st!: WeekState;
  ps!: PauseState;
  player!: Phaser.GameObjects.Rectangle;
  world!: World;
  revealed = new Set<Act>();
  done = false;
  baseGlitch = 0; // сколько сбоя в этом месте главы
  pace: Pace = 'walk';
  sasha!: Phaser.GameObjects.Sprite;
  private back!: Backdrop;
  private ctl!: WeekInput;
  private hud!: WeekHud;
  private panel!: PausePanel;
  private coach!: WeekCoach; private slip!: SlipView;
  private started = false; private runMs = 0; // бег идёт после заставки; runMs — для срока пика
  private rain!: WordRain;
  half = false; // первый шаг ПАУЗЫ пройден, сбой стих, но не ушёл
  private beat = 0; private dashT = 0; private phoneT = 0; private faceT = 0;
  private peakMs = 0; private peakHabit = false;
  private nextPeakPile = 0; private bossX = 0;

  constructor() { super('Week'); }
  init(data: { ch?: string }) { this.ch = chapterById(data?.ch); }
  preload() { preloadWeekArt(this); }

  create() {
    const ch = this.ch;
    Object.assign(this, { done: false, baseGlitch: 0, pace: ch.startPace, beat: 0, nextPeakPile: 0, dashT: 0, phoneT: 0, faceT: 0,
      peakMs: 0, peakHabit: false, started: false, runMs: 0, half: false });
    this.revealed = new Set(); this.st = newWeekState(ch.startClock); this.ps = newPause();
    makeWeekAnims(this);
    this.back = makeBackdrop(this, ch);
    this.physics.world.setBounds(0, -H, ch.worldW, 2 * H);
    this.world = buildWorld(this, ch);

    this.player = this.add.rectangle(ch.startX, GROUND_Y - 22, 22, 44, 0, 0); // тело для столкновений; видно Сашу — спрайт
    this.physics.add.existing(this.player);
    (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.world.solids);
    this.sasha = this.add.sprite(ch.startX, GROUND_Y, 'wk_sasha_idle').setOrigin(0.5, 1).setScale(GRID).setDepth(10);
    this.cameras.main.setBounds(0, 0, ch.worldW, H).startFollow(this.player, true, 0.12, 0.12, -W * 0.2, 0); // Саша слева: видно, что впереди

    this.ctl = new WeekInput(this);
    this.hud = new WeekHud(this);
    this.panel = new PausePanel(this, i => this.pick(i));
    this.coach = new WeekCoach(this, this.hud, ch);
    this.slip = new SlipView(this, this.hud, this.coach, ch.pause.slips);
    this.rain = new WordRain(this, this.hud);
    enterWeekTouch({ overwork: t(LABEL.overwork), scroll: t(LABEL.scroll), agree: t(LABEL.agree), pause: t(LABEL.pause) }, t('m_wk_act_pause_hold'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, leaveWeekTouch);
    showWeekIntro(this, { ch, again: isWeekDone(ch.id), sasha: this.sasha }, () => {
      this.started = true;
      this.ctl.drain(); // касание «старт» — не прыжок
      setTouchControls(true);
      this.coach.goal(ch.goal);
    });

    audio.setMode('day');
    const begin = () => { audio.ensure(); audio.startMusic(); trackEvent('game_chapter_start', { chapter: ch.id }); };
    this.input.once('pointerdown', begin);
    this.input.keyboard?.once('keydown', begin);
  }

  get peak() { return this.baseGlitch >= 1 && !this.st.named; }
  get glitching() { return this.baseGlitch > 0 && !this.st.named; }
  /** Саша занят прошлым действием (рывок, телефон, нет сил) — новое не начнётся. */
  get busy() { return this.dashT > 0 || this.phoneT > 0 || isResting(this.st); }
  private get body() { return this.player.body as Phaser.Physics.Arcade.Body; }

  update(_time: number, dtRaw: number) {
    if (this.done || !this.started) { this.body.setVelocityX(0); this.hud.update(this.st, 0, this.player.x, this.player.y - 62); this.draw(0); return; }
    const dt = Math.min(dtRaw, 50);
    this.stepPause(dt);
    if (isFrozen(this.ps)) { this.draw(1); return; } // мир замер
    this.st = tick(this.st, dt);
    this.runMs += dt;
    if (this.baseGlitch < 1 && peakDue(this.runMs, this.st.clockMin, this.ch.clockCap)) this.forcePeak();
    this.stepBeats();
    if (this.peak) {
      this.peakMs += dt;
      if (this.peakHabit || this.peakMs >= this.ch.door.pauseAfterMs) this.reveal('pause');
    }
    const glitch = glitchLevel(this.st, this.baseGlitch);
    this.stepActs();
    this.stepMove(dt);
    this.stepPeakPiles();
    this.rain.step(dt, glitch);

    const { door, people } = this.world, px = this.player.x, py = this.player.y;
    door.x = doorX(door.x, px, this.glitching, this.st.named, this.ch.door);
    door.setScale(this.peak && !this.half ? GRID * (this.ch.door.peakScale ?? 2) : GRID).setFrame(this.glitching ? 1 : 0);
    this.faceT = Math.max(0, this.faceT - dt);
    for (const p of people) p.setFrame(glitch < 0.05 || this.faceT > 0 ? 0 : 1);
    this.draw(glitch);
    this.hud.update(this.st, holdProgress(this.ps), px, py - 62); // над головой спрайта
    const b = this.body;
    this.coach.step(dt, { x: px, blocked: b.blocked.right && !this.busy && !this.ps.open, jumpFactor: jumpFactor(this.st), peak: this.peak,
      revealed: [...this.revealed], world: this.world, blocks: this.ch.blocks });
    if (this.st.named && Math.abs(px - door.x) < 34) this.finish();
  }

  /** Кадр Саши и фон: поза — по состоянию бега (week/look.ts), сбой проявляется в офисе. */
  private draw(glitch: number) {
    const b = this.body, hold = holdProgress(this.ps);
    const look = sashaLook({ frozen: isFrozen(this.ps) || hold >= 0.98, resting: isResting(this.st), sitting: isSitting(this.st), dashing: this.dashT > 0, onGround: b.blocked.down,
      vy: b.velocity.y, phone: this.phoneT > 0, speed: this.done ? 0 : Math.abs(b.velocity.x), load: this.st.load });
    if ('anim' in look) this.sasha.play(look.anim, true); else { this.sasha.anims.stop(); this.sasha.setTexture(look.sheet, look.frame); }
    this.sasha.setPosition(this.player.x, b.bottom + GRID);
    this.back.update(this.cameras.main.scrollX, this.st.named ? 0 : this.half ? glitch * 0.55 : glitch); // названо — стихло, но не ушло
  }
  /** Время вышло или телефон унёс часы к встрече — пик наступает здесь: темп мест по пути, остальное — пика. */
  private forcePeak() {
    const peakAt = this.ch.beats.findIndex(b => b.glitch === 1);
    for (; this.beat < peakAt; this.beat++) { const p = this.ch.beats[this.beat].pace; if (p) this.pace = p; }
    this.stepBeats(true);
  }
  private stepBeats(force = false) {
    const b = this.ch.beats[this.beat];
    if (!b || (!force && this.player.x < b.x)) return;
    this.beat++;
    if (b.pace) this.pace = b.pace;
    if (b.clock) this.st = reachClock(this.st, b.clock);
    if (b.glitch !== undefined) this.baseGlitch = b.glitch;
    if (b.reveal) this.reveal(b.reveal);
    if (b.notifs) this.rain.keys = b.notifs;
    if (b.goal) { this.coach.goal(b.goal); this.coach.tagDoor(); }
    if (b.say) {
      const at = b.atDoor ? this.world.door.x : b.sayAt; // реплика от цели звучит, пока Саша к ней идёт
      if (at !== undefined) this.hud.say(t(b.say), at, GROUND_Y - ui(b.atDoor ? 112 : 96), b.atDoor ? 3400 : 6000, b.msg ? 'msg' : 'say');
      else this.hud.think(t(b.say));
    }
  }

  reveal(act: Act) {
    if (this.revealed.has(act)) return;
    this.revealed.add(act);
    revealWeekAct(act);
    this.hud.keysHint([...this.revealed].map(a => `${ACT_KEYS[a]} ${t(LABEL[a])}`).join('  '));
    this.coach.reveal(act);
  }

  private stepActs() {
    const act = this.ctl.act();
    if (!act || !this.revealed.has(act) || this.busy) return;
    this.doAct(act);
    this.coach.used(act);
  }

  /** Привычка срабатывает всегда; что она убрала и чего стоила — видно в мире. */
  doAct(act: Act) {
    const peak = this.peak, px = this.player.x, w = this.world;
    const cost = (key: MsgKey) => this.coach.cost(peak ? 'm_wk_cost_peak' : this.ch.costs?.[act] ?? key, px, this.player.y - 70);
    if (peak) this.peakHabit = true;
    if (this.ch.hollow) { // зацепиться не за что: рывок в пустоту, телефон гаснет сам, цена — строка «почему»
      if (act === 'overwork') { this.dashT = DASH_MS; audio.dash(); } else if (act === 'scroll') this.phoneT = 400;
      return void this.coach.cost(this.ch.costs?.[act] ?? 'm_wk_cost_peak', px, this.player.y - 70);
    }
    if (act === 'overwork') {
      this.st = overwork(this.st, peak);
      this.dashT = DASH_MS; audio.dash(); cost('m_wk_cost_overwork');
      const g = gateInReach(w.gates, act, px + 110, 130);
      if (g) openGate(this, w, g);
      // цена: дел больше — новые стопки встают на пути; на пике рывок упирается в высокую
      if (peak) addGate(this, w, { x: px + 200, kind: 'pile', h: TALL_PILE }, this.ch.art);
      else for (let i = 0; i < RULES.overworkPiles; i++) addGate(this, w, { x: px + 420 + i * 300, kind: 'pile', h: LOW_PILE }, this.ch.art);
    } else if (act === 'scroll') {
      const before = this.st;
      this.st = scroll(this.st, peak, this.ch.clockCap);
      this.phoneT = peak ? 400 : PHONE_MS; // на пике телефон гаснет сам
      cost('m_wk_cost_scroll');
      if (this.st === before) return;
      audio.freeze(); this.rain.clear();
      const g = gateInReach(w.gates, act, px + 150, 300);
      if (g) openGate(this, w, g);
    } else if (act === 'agree') {
      const g = gateInReach(w.gates, act, px, 170);
      this.st = agree(this.st, !!g);
      if (!g) return;
      openGate(this, w, g); audio.pickup(); this.coach.cost(this.ch.costs?.agree ?? 'm_wk_cost_agree', px, this.player.y - 70);
      this.faceT = 1300;
      this.hud.say(t(this.ch.agreeThanks), g.x + 30, GROUND_Y - ui(96), 2400);
    }
  }

  /** Саша движется сам: игрок только прыгает. Привычки бег не останавливают — его тормозит удержание ПАУЗЫ. */
  private stepMove(dt: number) {
    const b = this.body, jump = this.ctl.jump(), resting = isResting(this.st);
    this.phoneT = Math.max(0, this.phoneT - dt);
    if (this.dashT > 0) { this.dashT -= dt; b.setVelocityX(DASH_SPEED); return; }
    b.setVelocityX(runSpeed({ pace: this.pace, resting, named: this.st.named, hold: holdProgress(this.ps), sitting: isSitting(this.st) }));
    if (jump && b.blocked.down && !resting) { b.setVelocityY(PHYS.jumpVel * jumpFactor(this.st)); audio.jump(); this.coach.used('jump'); }
  }

  /** На пике коридор не кончается: стопки встают впереди, пока сбой не назван. */
  private stepPeakPiles() {
    if (!this.peak || this.ch.hollow || this.player.x < this.nextPeakPile) return;
    this.nextPeakPile = this.player.x + this.ch.door.peakPileEvery;
    addGate(this, this.world, { x: this.player.x + W, kind: 'pile', h: LOW_PILE }, this.ch.art);
  }

  private stepPause(dt: number) {
    if (!this.revealed.has('pause') || this.st.named) return;
    if (this.ps.open) { const i = this.ctl.choice(); if (i !== null) this.pick(i); return; }
    if (this.ctl.pauseHeld) this.coach.used('pause');
    const was = this.ps;
    this.ps = holdPause(was, dt, this.ctl.pauseHeld && !isResting(this.st), this.ch.pause.slips?.map(s => s.ms));
    if (this.ps.open) this.freeze(true); else this.slip.step(was, this.ps);
  }

  private freeze(on: boolean) {
    const steps = this.ch.pause.steps, step = steps[this.ps.step];
    const kicker = t(steps.length > 1 && step.kicker ? step.kicker : LABEL.pause);
    if (on) { this.physics.world.pause(); this.tweens.pauseAll(); this.panel.show(kicker, t(step.question), step.options.map(k => t(k))); audio.freeze(); }
    else { this.physics.world.resume(); this.tweens.resumeAll(); this.panel.hide(); }
    this.time.paused = on;
    setTouchControls(!on); // названия занимают низ кадра — кнопки не должны их перекрывать
  }

  /** Выбор в ПАУЗЕ: неверный — мир вздрагивает и остаётся прежним; верный на последнем шаге гасит сбой,
   *  на первом из двух — сбой стихает, стены стоят, и Саша думает, чего не хватает (второй шаг держат заново). */
  pick(i: number) {
    if (!this.ps.open) return;
    const steps = this.ch.pause.steps, at = this.ps.step;
    this.ps = choosePause(this.ps, i, steps[at].correct, at === steps.length - 1);
    if (this.ps.open) { this.cameras.main.shake(180, 0.01); this.panel.markWrong(i); audio.anx(); return; }
    this.freeze(false);
    this.ctl.drain(); // тап по ответу — не прыжок
    this.rain.clear(); this.hud.hush();
    if (!this.ps.named) {
      this.half = true;
      this.hud.think(t(this.ch.pause.between ?? LABEL.pause), 5200);
      this.coach.blink('pause');
      return;
    }
    this.st = nameGlitch(this.st);
    for (const g of this.world.gates) openGate(this, this.world, g);
    this.world.door.x = this.player.x + this.ch.door.nearSteps; // коридор — десять шагов
    this.bossX = this.back.settle(this.world.door.x);
    if (this.ch.pause.named) this.hud.think(t(this.ch.pause.named), 3600);
    audio.gate();
  }

  private finish() {
    this.done = true;
    this.body.setVelocity(0, 0);
    setTouchControls(false); this.coach.done();
    const ch = this.ch, next = nextChapter(ch);
    trackEvent('game_chapter_done', { chapter: ch.id });
    markWeekDone(ch.id);
    this.hud.say(t(ch.end.line), ch.end.msg ? this.player.x : this.bossX, GROUND_Y - 132, 3000, ch.end.msg ? 'msg' : 'say');
    this.time.delayedCall(1800, () => this.hud.think(t(ch.end.after), 2400));
    const go = (id: string) => () => this.scene.restart({ ch: id });
    this.time.delayedCall(4400, () => this.hud.end(() => (ch.end.card === 'hook'
      ? showWeekCard(this, next && go(next.id)) : showWeekEnd(this, { day: ch.title, crisis: ch.crisis, again: go(ch.id), next: next && { label: next.invite ?? 'm_wk_card_btn_next', go: go(next.id) } }))));
  }
}
