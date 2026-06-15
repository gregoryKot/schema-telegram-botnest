import Phaser from 'phaser';
import { GROUND_Y, S } from '../constants';
import { audio } from '../audio';

// ════════════════════════════════════════════════════════════════════════════
//  Глава 2 «Дома» — враги. Каждый — головоломка на читаемость:
//  · Прокрастинация — липнет и замедляет. Бить бесполезно, ЗАМРИ = ловушка
//    (растёт и бьёт). Снимается только рывком — движение лечит.
//  · Телефон — зона «уюта» затягивает и съедает время (сердце). Замер в зоне —
//    утекает быстрее. Здесь БЕЙ — верный ответ: выключить требует усилия.
//  · Раздражение — быстрое, жжёт при касании, замирание не спасает. Лопается
//    от удара, но возвращается меньше; либо переждать паузу «выдохся» и уйти.
// ════════════════════════════════════════════════════════════════════════════

export interface MobCtx {
  scene: Phaser.Scene;
  player(): Phaser.Physics.Arcade.Sprite;
  frozen(): boolean;
  dashing(): boolean;
  damage(fromX: number): void;
  sayOnce(key: string, text: string, dur: number): void;
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

export function makeHomeTextures(scene: Phaser.Scene) {
  const u = S;
  if (!scene.textures.exists('procmob')) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x4a5a3a, 0.4); g.fillEllipse(13 * u, 11 * u, 26 * u, 18 * u);
    g.fillStyle(0x39482e, 1);   g.fillEllipse(13 * u, 12 * u, 22 * u, 14 * u);
    g.fillStyle(0x4f6040, 1);   g.fillEllipse(13 * u, 11 * u, 16 * u, 10 * u);
    g.fillStyle(0xc8d8a8, 1);   g.fillEllipse(9 * u, 10 * u, 3.4 * u, 2 * u); g.fillEllipse(17 * u, 10 * u, 3.4 * u, 2 * u);
    g.fillStyle(0x141a0c, 1);   g.fillEllipse(9 * u, 10.4 * u, 1.6 * u, 1.2 * u); g.fillEllipse(17 * u, 10.4 * u, 1.6 * u, 1.2 * u);
    g.generateTexture('procmob', 26 * u, 22 * u); g.destroy();
  }
  if (!scene.textures.exists('phonemob')) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x6ab4ff, 0.30); g.fillCircle(8 * u, 12 * u, 11 * u);
    g.fillStyle(0x14182a, 1);    g.fillRoundedRect(2 * u, 2 * u, 12 * u, 20 * u, 2 * u);
    g.fillStyle(0x9fd0ff, 1);    g.fillRoundedRect(3.2 * u, 4 * u, 9.6 * u, 15 * u, 1 * u);
    g.fillStyle(0xd8ecff, 1);    g.fillRect(4.4 * u, 6 * u, 7.2 * u, 1.4 * u);
    g.fillRect(4.4 * u, 9 * u, 5.4 * u, 1.4 * u); g.fillRect(4.4 * u, 12 * u, 6.6 * u, 1.4 * u);
    g.generateTexture('phonemob', 16 * u, 24 * u); g.destroy();
  }
  if (!scene.textures.exists('irritmob')) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const cx = 10 * u, cy = 10 * u;
    g.fillStyle(0xff7733, 0.35); g.fillCircle(cx, cy, 9.5 * u);
    g.fillStyle(0xcc3a10, 1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillTriangle(cx + Math.cos(a) * 4 * u, cy + Math.sin(a) * 4 * u,
        cx + Math.cos(a + 0.45) * 4 * u, cy + Math.sin(a + 0.45) * 4 * u,
        cx + Math.cos(a + 0.22) * 9 * u, cy + Math.sin(a + 0.22) * 9 * u);
    }
    g.fillStyle(0xff8a3a, 1); g.fillCircle(cx, cy, 5 * u);
    g.fillStyle(0xffe0a0, 1); g.fillCircle(cx - 1.6 * u, cy - 0.6 * u, 1.1 * u); g.fillCircle(cx + 1.6 * u, cy - 0.6 * u, 1.1 * u);
    g.generateTexture('irritmob', 20 * u, 20 * u); g.destroy();
  }
}

// ── Прокрастинация — липкая масса; снимается только рывком ──────────────────
export class Procrastination implements HomeMob {
  alive = true;
  private img: Phaser.GameObjects.Image;
  private state: 'idle' | 'latched' | 'stunned' = 'idle';
  private size = 1;
  private t = 0;
  private frozenT = 0;
  private wob = Math.random() * 6;
  private homeX: number;
  private seatY: number;

  constructor(private ctx: MobCtx, x: number, seatY = GROUND_Y - 20) {
    this.homeX = x; this.seatY = seatY;
    this.img = ctx.scene.add.image(x, seatY, 'procmob').setDepth(6);
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
          this.ctx.sayOnce('proc_latch', 'что-то... тянет вниз. двигаться лень.', 2600);
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
          this.frozenT += dt;
          this.size = Math.min(2.0, this.size + dt * 0.0004); // замер — растёт быстро
          if (this.frozenT > 1100) {
            this.frozenT = 0;
            this.ctx.damage(this.img.x);
            this.ctx.sayOnce('proc_freeze', 'замер — и залип ещё глубже!', 2800);
          }
        } else this.frozenT = 0;
        if (this.ctx.dashing()) this.shakeOff(p);
        break;
      }
      case 'stunned': {
        this.t -= dt;
        this.img.setAlpha(0.55).setScale(this.size * 1.1, this.size * 0.7);
        if (this.t <= 0) {
          if (this.size <= 0.5) this.die();
          else { this.state = 'idle'; this.img.setAlpha(1); this.img.y = GROUND_Y - 20; }
        }
        break;
      }
    }
  }

  private shakeOff(p: Phaser.Physics.Arcade.Sprite) {
    this.state = 'stunned'; this.t = 1500;
    this.size *= 0.62;
    this.img.x = p.x - (p.flipX ? -1 : 1) * 70;
    this.img.y = GROUND_Y - 20;
    this.ctx.burst(this.img.x, this.img.y, 0x6a7a4a, 8, 120);
    audio.split();
    if (this.size <= 0.5) this.ctx.sayOnce('proc_off', 'оторвался... пока опять не накатит.', 2600);
    else this.ctx.sayOnce('proc_dash', 'рывок — и отлипло. на чуть-чуть.', 2400);
  }

  private die() {
    this.alive = false;
    this.ctx.scene.tweens.add({ targets: this.img, alpha: 0, scale: 0, duration: 320, onComplete: () => this.img.destroy() });
  }

  tryHit(dir: number, range: number): boolean {
    if (!this.alive) return false;
    const p = this.ctx.player();
    if (this.state === 'latched') {
      this.ctx.sayOnce('proc_hit', 'оно на мне — себя же не ударишь.', 2600);
      return true;
    }
    const dx = this.img.x - p.x;
    if (dx * dir > -12 && Math.abs(dx) < range && Math.abs(this.img.y - (p.y - 20)) < 56) {
      // мягкое: удар проваливается, только колышется
      this.img.x += dir * 16;
      this.ctx.burst(this.img.x, this.img.y, 0x4a5a3a, 4, 60);
      this.ctx.sayOnce('proc_soft', 'мягкое... бить бесполезно.', 2400);
      return true;
    }
    return false;
  }
}

// ── Телефон — уютная ловушка; выключается ударом ────────────────────────────
const PHONE_R = 160;
const PHONE_Y = GROUND_Y - 96; // парит над столиком
export class PhoneMob implements HomeMob {
  alive = true;
  private img: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Graphics;
  private drain = 0;
  private bob = Math.random() * 6;
  private ping = 0;

  constructor(private ctx: MobCtx, private x: number) {
    // столик — телефон лежит «дома», а не висит в воздухе
    const t = ctx.scene.add.graphics().setDepth(4);
    t.fillStyle(0x4a3220, 1); t.fillRect(x - 38, GROUND_Y - 62, 76, 7);
    t.fillStyle(0x2e1d10, 1); t.fillRect(x - 30, GROUND_Y - 55, 6, 55); t.fillRect(x + 24, GROUND_Y - 55, 6, 55);
    this.img = ctx.scene.add.image(x, PHONE_Y, 'phonemob').setDepth(6).setScale(1.4);
    this.glow = ctx.scene.add.graphics().setDepth(4);
  }

  update(dt: number) {
    if (!this.alive) return;
    this.bob += dt * 0.002;
    this.img.y = PHONE_Y + Math.sin(this.bob) * 6;
    this.img.setAngle(Math.sin(this.bob * 3.1) * 4); // дёргается — требует внимания
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
      this.ctx.sayOnce('phone_zone', 'одну минутку, только гляну...', 2400);
      if (this.drain > 2300) {
        this.drain = 0;
        this.ctx.damage(this.img.x);
        this.ctx.sayOnce('phone_drain', '...два часа?! куда они делись?', 2800);
      }
    } else this.drain = Math.max(0, this.drain - dt * 1.5);
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
    const dx = this.img.x - p.x;
    if (dx * dir > -12 && Math.abs(dx) < range && Math.abs(this.img.y - (p.y - 20)) < 110) {
      this.alive = false;
      this.ctx.hitstop(60); audio.hit();
      this.ctx.burst(this.img.x, this.img.y, 0x9fd0ff, 12, 150);
      this.glow.clear(); this.glow.destroy();
      this.ctx.scene.tweens.add({ targets: this.img, alpha: 0, angle: 70, y: GROUND_Y - 10, duration: 360, onComplete: () => this.img.destroy() });
      this.ctx.sayOnce('phone_break', 'выключил... до следующего «дзынь».', 2600);
      return true;
    }
    return false;
  }
}

// ── Раздражение — вспышка; лопается, но возвращается меньше ─────────────────
export class Irritation implements HomeMob {
  alive = true;
  private img: Phaser.GameObjects.Image;
  private state: 'chase' | 'tired' | 'gone' = 'chase';
  private lives = 3;
  private size = 1;
  private t = 0;
  private cd = 0;
  private jit = Math.random() * 6;
  private vx = 0; private vy = 0;

  constructor(private ctx: MobCtx, x: number) {
    this.img = ctx.scene.add.image(x, GROUND_Y - 50, 'irritmob').setDepth(6);
  }

  update(dt: number) {
    if (!this.alive) return;
    const p = this.ctx.player();
    const px = p.x, py = p.y - 24;
    this.jit += dt * 0.03; this.cd -= dt; this.t += dt;
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
          if (this.ctx.frozen()) this.ctx.sayOnce('irrit_freeze', 'замер — а оно всё равно жжёт!', 2800);
          else this.ctx.sayOnce('irrit_burn', 'жжётся! откуда столько злости?', 2600);
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
          this.ctx.sayOnce('irrit_back', 'опять?! я же только что выдохнул...', 2600);
        }
        break;
      }
    }
    this.img.x += this.vx * dt / 1000; this.img.y += this.vy * dt / 1000;
    this.vx *= 0.96; this.vy *= 0.97;
    this.img.y = Math.min(this.img.y, GROUND_Y - 18);
  }

  tryHit(dir: number, range: number): boolean {
    if (!this.alive || this.state === 'gone') return false;
    const p = this.ctx.player();
    const dx = this.img.x - p.x;
    if (dx * dir > -12 && Math.abs(dx) < range && Math.abs(this.img.y - (p.y - 22)) < 54) {
      this.ctx.hitstop(55); audio.hit();
      this.ctx.burst(this.img.x, this.img.y, 0xff7733, 10, 140);
      this.lives -= 1;
      if (this.lives <= 0) {
        this.alive = false;
        this.ctx.scene.tweens.add({ targets: this.img, alpha: 0, scale: 0, duration: 220, onComplete: () => this.img.destroy() });
        this.ctx.sayOnce('irrit_dead', 'выдохся... отпустило. до следующего раза.', 2600);
      } else {
        this.size *= 0.78;
        this.state = 'gone'; this.t = 0;
        this.img.setVisible(false);
        this.ctx.sayOnce('irrit_pop', 'выпустил пар! ...надолго ли?', 2400);
      }
      return true;
    }
    return false;
  }
}
