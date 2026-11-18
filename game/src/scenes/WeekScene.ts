// «Неделя», каркас главы на серых блоках: Саша бежит сам, игрок прыгает и выбирает привычки с ценой;
// дверь держится впереди, бег останавливает и дверь открывает только ПАУЗА. Глава — данные (week/monday.ts), цена — чистые функции (week/habits.ts).
import Phaser from 'phaser';
import { W, H, GROUND_Y, PHYS } from '../constants';
import { setTouchControls } from '../controls';
import { audio } from '../audio';
import { t, type MsgKey } from '../i18n';
import { MONDAY, doorX, gateInReach, type Act } from '../week/monday';
import { runSpeed, type Pace } from '../week/run';
import {
  RULES, agree, glitchLevel, isResting, jumpFactor, nameGlitch, newWeekState, overwork, reachClock, scroll,
  tick, type WeekState,
} from '../week/habits';
import { choosePause, holdPause, holdProgress, newPause, type PauseState } from '../week/pause';
import { addGate, buildWorld, openGate, type World } from '../week/world';
import { WeekHud, FONT } from '../week/hud';
import { PausePanel } from '../week/pausePanel';
import { ACT_KEYS, WeekInput } from '../week/input';
import { enterWeekTouch, leaveWeekTouch, revealWeekAct } from '../week/touch';

const DASH_SPEED = 520, DASH_MS = 260, PHONE_MS = 1200, LOW_PILE = 45, TALL_PILE = 170;
const WARM = 0x4a4038, COLD = 0x2c3038;
const LABEL: Record<Act, MsgKey> = {
  overwork: 'm_wk_act_overwork', scroll: 'm_wk_act_scroll', agree: 'm_wk_act_agree', pause: 'm_wk_act_pause',
};

export class WeekScene extends Phaser.Scene {
  readonly ch = MONDAY;
  st!: WeekState;
  ps!: PauseState;
  player!: Phaser.GameObjects.Rectangle;
  world!: World;
  revealed = new Set<Act>();
  done = false;
  baseGlitch = 0; // сколько сбоя в этом месте главы
  pace: Pace = 'walk';
  private pack!: Phaser.GameObjects.Rectangle;
  private phone!: Phaser.GameObjects.Rectangle;
  private ctl!: WeekInput;
  private hud!: WeekHud;
  private panel!: PausePanel;
  private notifs: Phaser.GameObjects.Text[] = [];
  private notifKeys: MsgKey[] = [];
  private beat = 0; private dashT = 0; private phoneT = 0; private faceT = 0;
  private peakMs = 0; private peakHabit = false; private notifAcc = 0; private notifN = 0;
  private nextPeakPile = 0;

  constructor() { super('Week'); }

  create() {
    const ch = this.ch;
    Object.assign(this, { done: false, baseGlitch: 0, pace: ch.startPace, beat: 0, nextPeakPile: 0, dashT: 0, phoneT: 0, faceT: 0,
      peakMs: 0, peakHabit: false, notifAcc: 0, notifN: 0, notifs: [], notifKeys: [] });
    this.revealed = new Set();
    this.st = newWeekState(ch.startClock);
    this.ps = newPause();
    this.cameras.main.setBackgroundColor(WARM);
    this.physics.world.setBounds(0, -H, ch.worldW, 2 * H);
    this.world = buildWorld(this, ch);

    this.player = this.add.rectangle(ch.startX, GROUND_Y - 22, 22, 44, 0xc4c4cc).setDepth(10);
    this.physics.add.existing(this.player);
    (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.world.solids);
    this.pack = this.add.rectangle(0, 0, 10, 14, 0x6e6e78).setDepth(9);
    this.phone = this.add.rectangle(0, 0, 8, 12, 0xe8f0ff).setDepth(11).setVisible(false);
    this.cameras.main.setBounds(0, 0, ch.worldW, H).startFollow(this.player, true, 0.12, 0.12, -W * 0.2, 0); // Саша слева: видно, что впереди

    this.ctl = new WeekInput(this);
    this.hud = new WeekHud(this);
    this.panel = new PausePanel(this, t(ch.pause.question), ch.pause.options.map(k => t(k)), i => this.pick(i));
    enterWeekTouch({ overwork: t(LABEL.overwork), scroll: t(LABEL.scroll), agree: t(LABEL.agree), pause: t(LABEL.pause) });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, leaveWeekTouch);
    this.hud.title(t(ch.title));

    audio.setMode('day');
    const begin = () => { audio.ensure(); audio.startMusic(); };
    this.input.once('pointerdown', begin);
    this.input.keyboard?.once('keydown', begin);
  }

  get peak() { return this.baseGlitch >= 1 && !this.st.named; }
  get glitching() { return this.baseGlitch > 0 && !this.st.named; }
  /** Саша занят прошлым действием (рывок, телефон, нет сил) — новое не начнётся. */
  get busy() { return this.dashT > 0 || this.phoneT > 0 || isResting(this.st); }
  private get body() { return this.player.body as Phaser.Physics.Arcade.Body; }

  update(_time: number, dtRaw: number) {
    if (this.done) { this.hud.update(this.st, 0, this.player.x, this.player.y - 22); return; }
    const dt = Math.min(dtRaw, 50);
    this.stepPause(dt);
    if (this.ps.open) return; // мир замер
    this.st = tick(this.st, dt);
    this.stepBeats();
    if (this.peak) {
      this.peakMs += dt;
      if (this.peakHabit || this.peakMs >= this.ch.door.pauseAfterMs) this.reveal('pause');
    }
    const glitch = glitchLevel(this.st, this.baseGlitch);
    this.stepActs();
    this.stepMove(dt);
    this.stepPeakPiles();
    this.stepNotifs(dt, glitch);

    const { door, faces } = this.world, px = this.player.x, py = this.player.y;
    door.x = doorX(door.x, px, this.glitching, this.st.named, this.ch.door);
    door.setScale(this.peak ? 2 : 1);
    this.faceT = Math.max(0, this.faceT - dt);
    for (const f of faces) f.setVisible(glitch < 0.05 || this.faceT > 0);
    const size = 10 + 6 * this.st.load;
    this.pack.setPosition(px - (11 + size / 2), py - 4).setSize(size, size + 4);
    this.phone.setPosition(px + 14, py - 6).setVisible(this.phoneT > 0);
    this.player.setFillStyle(isResting(this.st) ? 0x80808a : 0xc4c4cc);
    this.hud.update(this.st, holdProgress(this.ps), px, py - 22);
    if (this.st.named && Math.abs(px - door.x) < 34) this.finish();
  }

  private stepBeats() {
    const b = this.ch.beats[this.beat];
    if (!b || this.player.x < b.x) return;
    this.beat++;
    if (b.pace) this.pace = b.pace;
    if (b.clock) this.st = reachClock(this.st, b.clock);
    if (b.glitch !== undefined) { this.baseGlitch = b.glitch; this.cameras.main.setBackgroundColor(COLD); }
    if (b.reveal) this.reveal(b.reveal);
    if (b.notifs) this.notifKeys = b.notifs;
    if (b.say) {
      if (b.sayAt !== undefined) this.hud.say(t(b.say), b.sayAt, GROUND_Y - 110, 6000);
      else this.hud.think(t(b.say));
    }
  }

  reveal(act: Act) {
    if (this.revealed.has(act)) return;
    this.revealed.add(act);
    revealWeekAct(act);
    this.hud.keysHint([...this.revealed].map(a => `${ACT_KEYS[a]} ${t(LABEL[a])}`).join('  '));
    if (act === 'pause') this.hud.think(`${t(LABEL.pause)}: ${t('m_wk_act_pause_hold')}`, 5000);
  }

  private stepActs() {
    const act = this.ctl.act();
    if (!act || !this.revealed.has(act) || this.busy) return;
    this.doAct(act);
  }

  /** Привычка срабатывает всегда; что она убрала и чего стоила — видно в мире. */
  doAct(act: Act) {
    const peak = this.peak, px = this.player.x, w = this.world;
    if (peak) this.peakHabit = true;
    if (act === 'overwork') {
      this.st = overwork(this.st, peak);
      this.dashT = DASH_MS; audio.dash();
      const g = gateInReach(w.gates, act, px + 110, 130);
      if (g) openGate(this, g);
      // цена: дел больше — новые стопки встают на пути; на пике рывок упирается в высокую
      if (peak) addGate(this, w, { x: px + 200, kind: 'pile', h: TALL_PILE });
      else for (let i = 0; i < RULES.overworkPiles; i++) addGate(this, w, { x: px + 420 + i * 300, kind: 'pile', h: LOW_PILE });
    } else if (act === 'scroll') {
      const before = this.st;
      this.st = scroll(this.st, peak);
      this.phoneT = peak ? 400 : PHONE_MS; // на пике телефон гаснет сам
      if (this.st === before) return;
      audio.freeze(); this.clearNotifs();
      const g = gateInReach(w.gates, act, px + 150, 300);
      if (g) openGate(this, g);
    } else if (act === 'agree') {
      const g = gateInReach(w.gates, act, px, 170);
      this.st = agree(this.st, !!g);
      if (!g) return;
      openGate(this, g); audio.pickup();
      this.faceT = 1300;
      this.hud.say(t(this.ch.agreeThanks), g.x, GROUND_Y - 110, 2400);
    }
  }

  /** Саша движется сам: игрок только прыгает. Привычки бег не останавливают — его тормозит удержание ПАУЗЫ. */
  private stepMove(dt: number) {
    const b = this.body, jump = this.ctl.jump(), resting = isResting(this.st);
    this.phoneT = Math.max(0, this.phoneT - dt);
    if (this.dashT > 0) { this.dashT -= dt; b.setVelocityX(DASH_SPEED); return; }
    b.setVelocityX(runSpeed({ pace: this.pace, resting, named: this.st.named, hold: holdProgress(this.ps) }));
    if (jump && b.blocked.down && !resting) { b.setVelocityY(PHYS.jumpVel * jumpFactor(this.st)); audio.jump(); }
  }

  /** На пике коридор не кончается: стопки встают впереди, пока сбой не назван. */
  private stepPeakPiles() {
    if (!this.peak || this.player.x < this.nextPeakPile) return;
    this.nextPeakPile = this.player.x + this.ch.door.peakPileEvery;
    addGate(this, this.world, { x: this.player.x + W, kind: 'pile', h: LOW_PILE });
  }

  /** Уведомления сыплются сверху, пока сбой рядом: живут в кадре, чтобы читаться на бегу; в паузе повисают. */
  private stepNotifs(dt: number, glitch: number) {
    if (glitch < 0.2 || !this.notifKeys.length) return;
    this.notifAcc += dt * glitch;
    if (this.notifAcc < 700) return;
    this.notifAcc = 0;
    const key = this.notifKeys[this.notifN++ % this.notifKeys.length];
    const x = Phaser.Math.Between(120, W - 120);
    const n = this.add.text(x, -20, t(key), { fontFamily: FONT, fontSize: '10px', color: '#1c1c22', backgroundColor: '#c8ccd8',
      padding: { x: 6, y: 5 } }).setOrigin(0.5).setDepth(8).setScrollFactor(0);
    this.notifs.push(n);
    this.tweens.add({ targets: n, y: GROUND_Y - 16, duration: 3400, onComplete: () => {
      this.notifs = this.notifs.filter(o => o !== n); n.destroy();
    } });
  }
  private clearNotifs() { for (const n of this.notifs) n.destroy(); this.notifs = []; }

  private stepPause(dt: number) {
    if (!this.revealed.has('pause') || this.st.named) return;
    if (this.ps.open) { const i = this.ctl.choice(); if (i !== null) this.pick(i); return; }
    this.ps = holdPause(this.ps, dt, this.ctl.pauseHeld && !isResting(this.st));
    if (this.ps.open) this.freeze(true);
  }

  private freeze(on: boolean) {
    if (on) { this.physics.world.pause(); this.tweens.pauseAll(); this.panel.show(); audio.freeze(); }
    else { this.physics.world.resume(); this.tweens.resumeAll(); this.panel.hide(); }
    this.time.paused = on;
    setTouchControls(!on); // названия занимают низ кадра — кнопки не должны их перекрывать
  }

  /** Выбор названия в ПАУЗЕ: неверное — мир вздрагивает и остаётся прежним, верное гасит сбой. */
  pick(i: number) {
    if (!this.ps.open) return;
    this.ps = choosePause(this.ps, i, this.ch.pause.correct);
    if (!this.ps.named) { this.cameras.main.shake(180, 0.01); this.panel.markWrong(i); audio.anx(); return; }
    this.freeze(false);
    this.ctl.drain(); // тап по названию — не прыжок
    this.st = nameGlitch(this.st);
    this.clearNotifs();
    for (const g of this.world.gates) openGate(this, g);
    this.world.door.x = this.player.x + this.ch.door.nearSteps; // коридор — десять шагов
    this.cameras.main.setBackgroundColor(WARM);
    audio.gate();
  }

  private finish() {
    this.done = true;
    this.body.setVelocity(0, 0);
    setTouchControls(false);
    this.hud.say(t(this.ch.end.bossLine), this.world.door.x, GROUND_Y - 120, 3000);
    this.time.delayedCall(1800, () => this.hud.think(t(this.ch.end.afterThought), 2400));
    this.time.delayedCall(4400, () => this.hud.end(t('m_wk_card_soon')));
  }
}
