import Phaser from 'phaser';
import type { MsgKey } from '../i18n';
import { GROUND_Y } from '../constants';
import { audio } from '../audio';

// ════════════════════════════════════════════════════════════════════════════
//  Глава 2 «Дома». Единый закон (как в гл.1): любой копинг копит «передышку»
//  (relief) → на максимуме враг ОТСТУПАЕТ (не убит, вернётся позже). Разница
//  только в текстуре — у каждого свой лучший копинг и свой копинг-ловушка:
//  · Прокрастинация — липнет, замедляет. Рывок снимает быстро; удар — слабо;
//    ЗАЛИПАНИЕ = ловушка (вязнешь глубже, передышка тает).
//  · Телефон — зона «уюта» тянет и съедает время. Удар (выключить) — быстро;
//    рывок из зоны — средне; ЗАЛИПНУТЬ в зоне = ловушка (доскролл).
//  · Раздражение — вспышка, жжёт. Удар (выпустить пар) — но вспыхивает обратно;
//    рывок прочь и игнор тоже остужают. Возвращается всегда.
// ════════════════════════════════════════════════════════════════════════════

export interface MobCtx {
  scene: Phaser.Scene;
  player(): Phaser.Physics.Arcade.Sprite;
  frozen(): boolean;
  dashing(): boolean;
  damage(fromX: number): void;
  sayOnce(key: string, text: MsgKey, dur: number): void;
  burst(x: number, y: number, color: number, n: number, sp: number): void;
  hitstop(ms: number): void;
  slow(mult: number): void; // вызывается каждый кадр, пока враг держит игрока
}

export interface HomeMob {
  alive: boolean;
  update(dt: number): void;
  /** Попытка удара игрока по врагу. true = удар засчитан (не повторять в этом замахе). */
  tryHit(dir: number, range: number): boolean;
}

// процедурные текстуры мобов удалены — теперь это настоящие спрайты (props.ts)

// ── Прокрастинация — липкая масса; снимается только рывком ──────────────────
export class Procrastination implements HomeMob {
  alive = true;
  private img: Phaser.GameObjects.Sprite;
  private state: 'idle' | 'latched' | 'stunned' = 'idle';
  private size = 1;
  private t = 0;
  private frozenT = 0;
  private wob = Math.random() * 6;
  private homeX: number;
  private seatY: number;
  private relief = 0; // любой копинг копит передышку; ловушка — залипание

  constructor(private ctx: MobCtx, x: number, seatY = GROUND_Y - 20) {
    this.homeX = x; this.seatY = seatY;
    this.img = ctx.scene.add.sprite(x, seatY, 'procmob').setDepth(6).play('proc-idle');
  }

  update(dt: number) {
    if (!this.alive) return;
    const p = this.ctx.player();
    this.wob += dt * 0.003;
    switch (this.state) {
      case 'idle': {
        this.img.setScale(this.size * (1 + Math.sin(this.wob) * 0.06), this.size * (1 - Math.sin(this.wob) * 0.06));
        const d = Phaser.Math.Distance.Between(this.img.x, this.img.y, p.x, p.y - 20);
        // медленно подползает, когда ты рядом и не в рывке
        if (d < 220 && !this.ctx.dashing()) this.img.x += Math.sign(p.x - this.img.x) * dt * 0.022;
        // на диване сидит выше; сполз с него — оседает на пол
        const targetY = Math.abs(this.img.x - this.homeX) < 70 ? this.seatY : GROUND_Y - 20;
        this.img.y += (targetY - this.img.y) * 0.06;
        if (d < 56 && !this.ctx.dashing()) {
          this.state = 'latched'; this.frozenT = 0;
          audio.anx();
          this.ctx.sayOnce('proc_latch', 'm_something_drags_you_down_too_lazy', 2600);
        }
        break;
      }
      case 'latched': {
        // висит на спине и замедляет; рывок стряхивает
        this.img.x = p.x - (p.flipX ? -12 : 12);
        this.img.y = p.y - 12;
        this.img.setScale(this.size).setAlpha(0.92);
        this.ctx.slow(this.size > 1.5 ? 0.35 : 0.5);
        this.size = Math.min(2.0, this.size + dt * 0.00006); // тяжелеет со временем
        if (this.ctx.frozen()) {
          // ЗАЛИПАНИЕ — ловушка: вязнешь глубже, передышка тает
          this.frozenT += dt;
          this.size = Math.min(2.0, this.size + dt * 0.0004);
          this.relief = Math.max(0, this.relief - dt * 0.0004);
          if (this.frozenT > 1100) { this.frozenT = 0; this.ctx.sayOnce('proc_freeze', 'm_stuck_even_deeper_that_s_what', 2800); }
        } else this.frozenT = 0;
        if (this.ctx.dashing()) this.shakeOff(p);  // рывок — лучший копинг
        break;
      }
      case 'stunned': {
        this.t -= dt;
        this.img.setAlpha(0.55).setScale(this.size * 1.1, this.size * 0.7);
        // не добита — отлежится и снова налипнет (возвращается)
        if (this.t <= 0) { this.state = 'idle'; this.img.setAlpha(1); this.img.y = GROUND_Y - 20; }
        break;
      }
    }
  }

  private shakeOff(p: Phaser.Physics.Arcade.Sprite) {
    this.state = 'stunned'; this.t = 900;
    this.size = Math.max(0.5, this.size * 0.7);
    this.relief += 0.4;                                   // рывок — крупная передышка
    this.img.x = p.x - (p.flipX ? -1 : 1) * 70;
    this.img.y = GROUND_Y - 20;
    this.ctx.burst(this.img.x, this.img.y, 0x6a7a4a, 8, 120);
    audio.split();
    if (this.relief >= 1) this.standDown('m_broke_free_but_the_laziness_will');
    else this.ctx.sayOnce('proc_dash', 'm_a_dash_and_unstuck_for_a', 2400);
  }

  // отступает «на время» — не убита; гейт откроется, но она вернётся позже
  private standDown(line: MsgKey) {
    this.alive = false;
    this.ctx.sayOnce('proc_off', line, 2600);
    this.ctx.scene.tweens.add({ targets: this.img, alpha: 0, scale: 0, duration: 320, onComplete: () => this.img.destroy() });
  }

  tryHit(dir: number, range: number): boolean {
    if (!this.alive) return false;
    const p = this.ctx.player();
    if (this.state === 'latched') {
      // бить по налипшему — слабая, но передышка (себя же лупишь)
      this.relief += 0.12;
      if (this.relief >= 1) this.standDown('m_broke_free_but_the_laziness_will');
      else this.ctx.sayOnce('proc_hit', 'm_you_beat_at_it_eases_a', 2600);
      return true;
    }
    if (Math.hypot(this.img.x - p.x, this.img.y - (p.y - 20)) < range) {
      this.img.x += dir * 16;
      this.ctx.burst(this.img.x, this.img.y, 0x4a5a3a, 4, 60);
      this.ctx.sayOnce('proc_soft', 'm_soft_the_hit_sinks_in_movement', 2400);
      return true;
    }
    return false;
  }
}

// ── Телефон — уютная ловушка; выключается ударом ────────────────────────────
const PHONE_R = 160;
const PHONE_Y = GROUND_Y - 30; // телефон-монстрик стоит на полу (ножки у земли)
export class PhoneMob implements HomeMob {
  alive = true;
  private img: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Graphics;
  private drain = 0;
  private bob = Math.random() * 6;
  private ping = 0;
  private relief = 0; // удар выключает быстро, рывок из зоны — средне; ловушка — залипнуть в зоне

  constructor(private ctx: MobCtx, private x: number) {
    this.img = ctx.scene.add.sprite(x, PHONE_Y, 'phonemob').setDepth(6).play('phone-walk');
    this.glow = ctx.scene.add.graphics().setDepth(4);
  }

  update(dt: number) {
    if (!this.alive) return;
    this.bob += dt * 0.004;
    // расхаживает у своего места: ножки шагают, повёрнут по ходу, не левитирует
    this.img.x = this.x + Math.sin(this.bob * 0.8) * 48;
    this.img.setFlipX(Math.cos(this.bob * 0.8) < 0);
    this.img.y = PHONE_Y - Math.abs(Math.sin(this.bob * 4)) * 3; // лёгкий шаговый подскок, ноги у пола
    this.img.setAngle(0);
    this.notify(dt);
    const p = this.ctx.player();
    const d = Phaser.Math.Distance.Between(this.img.x, this.img.y, p.x, p.y - 20);
    const inZone = d < PHONE_R;

    this.glow.clear();
    const pulse = PHONE_R + Math.sin(this.bob * 2.4) * 8;
    this.glow.lineStyle(2, 0x6ab4ff, inZone ? 0.5 : 0.25);
    this.glow.strokeCircle(this.img.x, this.img.y, pulse);
    this.glow.fillStyle(0x6ab4ff, inZone ? 0.10 : 0.05);
    this.glow.fillCircle(this.img.x, this.img.y, pulse);

    if (inZone && !this.ctx.dashing()) {
      // затягивает: мягкая тяга к телефону
      const b = p.body as Phaser.Physics.Arcade.Body;
      b.velocity.x += Math.sign(this.img.x - p.x) * dt * 0.45;
      this.drain += dt * (this.ctx.frozen() ? 3 : 1); // залип = время летит втрое
      this.relief = Math.max(0, this.relief - dt * 0.0003); // в зоне передышка тает — ловушка
      this.ctx.sayOnce('phone_zone', 'm_just_a_minute_only_a_quick', 2400);
      if (this.drain > 2300) {
        this.drain = 0;
        this.ctx.damage(this.img.x);
        this.ctx.sayOnce('phone_drain', 'm_two_hours_where_did_they_go', 2800);
      }
    } else {
      this.drain = Math.max(0, this.drain - dt * 1.5);
      if (this.ctx.dashing() && d < PHONE_R + 60) this.relief += dt * 0.0014; // вырвался рывком — передышка
    }
  }

  // «уведомления» летят к котику — телефон сам зовёт в зону
  private notify(dt: number) {
    this.ping += dt;
    const p = this.ctx.player();
    if (this.ping < 800 || Math.abs(p.x - this.img.x) > 460) return;
    this.ping = 0;
    const s = this.ctx.scene;
    const dot = s.add.rectangle(this.img.x, this.img.y - 18, 5, 5, 0x9fd0ff).setDepth(7);
    s.tweens.add({
      targets: dot, x: p.x + Phaser.Math.Between(-12, 12), y: p.y - 40,
      alpha: { from: 1, to: 0 }, duration: 700, ease: 'Sine.In', onComplete: () => dot.destroy(),
    });
  }

  tryHit(dir: number, range: number): boolean {
    if (!this.alive) return false;
    const p = this.ctx.player();
    if (Math.hypot(this.img.x - p.x, this.img.y - (p.y - 20)) < range) {
      this.ctx.hitstop(60); audio.hit();
      this.ctx.burst(this.img.x, this.img.y, 0x9fd0ff, 8, 130);
      this.relief += 0.55;                                  // удар — выключить, крупная передышка
      if (this.relief >= 1) {
        this.alive = false;
        this.glow.clear(); this.glow.destroy();
        this.ctx.scene.tweens.add({ targets: this.img, alpha: 0, angle: 70, y: GROUND_Y - 10, duration: 360, onComplete: () => this.img.destroy() });
        this.ctx.sayOnce('phone_break', 'm_switched_off_until_the_next_ping', 2600);
      } else {
        this.img.setAngle(40); this.ctx.scene.tweens.add({ targets: this.img, angle: 0, duration: 250 });
        this.ctx.sayOnce('phone_hit', 'm_went_dark_and_lit_up_again', 2600);
      }
      return true;
    }
    return false;
  }
}

// ── Раздражение — вспышка; лопается, но возвращается меньше ─────────────────
export class Irritation implements HomeMob {
  alive = true;
  private img: Phaser.GameObjects.Sprite;
  private state: 'chase' | 'tired' | 'gone' = 'chase';
  private relief = 0; // удар выпускает пар (но вспыхивает), рывок прочь и игнор — тоже передышка
  private size = 1;
  private t = 0;
  private cd = 0;
  private jit = Math.random() * 6;
  private vx = 0; private vy = 0;

  constructor(private ctx: MobCtx, x: number) {
    this.img = ctx.scene.add.sprite(x, GROUND_Y - 50, 'irritmob').setDepth(6).play('irrit-flicker');
  }

  update(dt: number) {
    if (!this.alive) return;
    const p = this.ctx.player();
    const px = p.x, py = p.y - 24;
    this.jit += dt * 0.03; this.cd -= dt; this.t += dt;
    // рывок прочь или игнор (залипание) рядом — тоже остужают (медленнее удара)
    const near = Phaser.Math.Distance.Between(this.img.x, this.img.y, px, py) < 220;
    if (this.state !== 'gone' && near) {
      if (this.ctx.dashing()) this.relief += dt * 0.0010;
      else if (this.ctx.frozen()) this.relief += dt * 0.0008;
    }
    if (this.relief >= 1 && this.state !== 'gone') this.standDown();
    switch (this.state) {
      case 'chase': {
        this.vx += Math.sign(px - this.img.x) * 22;
        this.vx = Phaser.Math.Clamp(this.vx, -235, 235);
        const ty = GROUND_Y - 46 + Math.sin(this.jit * 2) * 16;
        this.vy += (ty - this.img.y) * 0.05;
        this.img.setAngle(Math.sin(this.jit * 5) * 14);
        const d = Phaser.Math.Distance.Between(this.img.x, this.img.y, px, py);
        if (d < 30 && this.cd <= 0) {
          this.cd = 900;
          this.ctx.damage(this.img.x);
          this.vx = -Math.sign(px - this.img.x) * 260;
          if (this.ctx.frozen()) this.ctx.sayOnce('irrit_freeze', 'm_froze_and_still_it_burns', 2800);
          else this.ctx.sayOnce('irrit_burn', 'm_it_burns_where_s_all_this', 2600);
        }
        if (this.t > 2600) { this.state = 'tired'; this.t = 0; this.vx *= 0.1; }
        break;
      }
      case 'tired': {
        // выдохлось — обмякло, можно проскочить
        this.img.setAngle(0).setScale(this.size * 0.92).setAlpha(0.7);
        this.vx *= 0.9; this.vy = (GROUND_Y - 40 - this.img.y) * 0.04;
        if (this.t > 1200) { this.state = 'chase'; this.t = 0; this.img.setAlpha(1).setScale(this.size); }
        break;
      }
      case 'gone': {
        if (this.t > 1700) {
          this.state = 'chase'; this.t = 0; this.cd = 600;
          this.img.setVisible(true).setAlpha(0).setScale(this.size);
          this.img.x = px + 240; this.img.y = GROUND_Y - 60;
          this.ctx.scene.tweens.add({ targets: this.img, alpha: 1, duration: 300 });
          this.ctx.sayOnce('irrit_back', 'm_again_i_just_caught_my_breath', 2600);
        }
        break;
      }
    }
    this.img.x += this.vx * dt / 1000; this.img.y += this.vy * dt / 1000;
    this.vx *= 0.96; this.vy *= 0.97;
    this.img.y = Math.min(this.img.y, GROUND_Y - 18);
  }

  // выдохся «на время» — не убит, вернётся позже (общий закон главы)
  private standDown() {
    this.alive = false;
    this.ctx.scene.tweens.add({ targets: this.img, alpha: 0, scale: 0, duration: 260, onComplete: () => this.img.destroy() });
    this.ctx.sayOnce('irrit_dead', 'm_spent_it_let_go_until_next', 2600);
  }

  tryHit(dir: number, range: number): boolean {
    if (!this.alive || this.state === 'gone') return false;
    const p = this.ctx.player();
    if (Math.hypot(this.img.x - p.x, this.img.y - (p.y - 22)) < range) {
      this.ctx.hitstop(55); audio.hit();
      this.ctx.burst(this.img.x, this.img.y, 0xff7733, 10, 140);
      this.relief += 0.34;                                  // выпустил пар — передышка
      if (this.relief >= 1) { this.standDown(); }
      else {
        // вспыхивает обратно (возвращается) — текстура злости
        this.size = Math.max(0.6, this.size * 0.82);
        this.state = 'gone'; this.t = 0;
        this.img.setVisible(false);
        this.ctx.sayOnce('irrit_pop', 'm_let_off_steam_and_it_boils', 2400);
      }
      return true;
    }
    return false;
  }
}
