import Phaser from 'phaser';
import { GROUND_Y, S } from '../constants';
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
  private relief = 0; // любой копинг копит передышку; ловушка — залипание

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
          // ЗАЛИПАНИЕ — ловушка: вязнешь глубже, передышка тает
          this.frozenT += dt;
          this.size = Math.min(2.0, this.size + dt * 0.0004);
          this.relief = Math.max(0, this.relief - dt * 0.0004);
          if (this.frozenT > 1100) { this.frozenT = 0; this.ctx.sayOnce('proc_freeze', 'залип ещё глубже — вот что её кормит.', 2800); }
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
    if (this.relief >= 1) this.standDown('оторвался. но лень ещё вернётся.');
    else this.ctx.sayOnce('proc_dash', 'рывок — и отлипло. на чуть-чуть.', 2400);
  }

  // отступает «на время» — не убита; гейт откроется, но она вернётся позже
  private standDown(line: string) {
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
      if (this.relief >= 1) this.standDown('оторвался. но лень ещё вернётся.');
      else this.ctx.sayOnce('proc_hit', 'лупишь по ней — чуть отпускает. себя же бьёшь.', 2600);
      return true;
    }
    const dx = this.img.x - p.x;
    if (dx * dir > -12 && Math.abs(dx) < range && Math.abs(this.img.y - (p.y - 20)) < 56) {
      this.img.x += dir * 16;
      this.ctx.burst(this.img.x, this.img.y, 0x4a5a3a, 4, 60);
      this.ctx.sayOnce('proc_soft', 'мягкая... удар вязнет. лучше движение.', 2400);
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
  private relief = 0; // удар выключает быстро, рывок из зоны — средне; ловушка — залипнуть в зоне

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
      this.relief = Math.max(0, this.relief - dt * 0.0003); // в зоне передышка тает — ловушка
      this.ctx.sayOnce('phone_zone', 'одну минутку, только гляну...', 2400);
      if (this.drain > 2300) {
        this.drain = 0;
        this.ctx.damage(this.img.x);
        this.ctx.sayOnce('phone_drain', '...два часа?! куда они делись?', 2800);
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
    const dx = this.img.x - p.x;
    if (dx * dir > -12 && Math.abs(dx) < range && Math.abs(this.img.y - (p.y - 20)) < 110) {
      this.ctx.hitstop(60); audio.hit();
      this.ctx.burst(this.img.x, this.img.y, 0x9fd0ff, 8, 130);
      this.relief += 0.55;                                  // удар — выключить, крупная передышка
      if (this.relief >= 1) {
        this.alive = false;
        this.glow.clear(); this.glow.destroy();
        this.ctx.scene.tweens.add({ targets: this.img, alpha: 0, angle: 70, y: GROUND_Y - 10, duration: 360, onComplete: () => this.img.destroy() });
        this.ctx.sayOnce('phone_break', 'выключил... до следующего «дзынь».', 2600);
      } else {
        this.img.setAngle(40); this.ctx.scene.tweens.add({ targets: this.img, angle: 0, duration: 250 });
        this.ctx.sayOnce('phone_hit', 'погас... и снова загорелся. рука сама тянется.', 2600);
      }
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
  private relief = 0; // удар выпускает пар (но вспыхивает), рывок прочь и игнор — тоже передышка
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

  // выдохся «на время» — не убит, вернётся позже (общий закон главы)
  private standDown() {
    this.alive = false;
    this.ctx.scene.tweens.add({ targets: this.img, alpha: 0, scale: 0, duration: 260, onComplete: () => this.img.destroy() });
    this.ctx.sayOnce('irrit_dead', 'выдохся... отпустило. до следующего раза.', 2600);
  }

  tryHit(dir: number, range: number): boolean {
    if (!this.alive || this.state === 'gone') return false;
    const p = this.ctx.player();
    const dx = this.img.x - p.x;
    if (dx * dir > -12 && Math.abs(dx) < range && Math.abs(this.img.y - (p.y - 22)) < 54) {
      this.ctx.hitstop(55); audio.hit();
      this.ctx.burst(this.img.x, this.img.y, 0xff7733, 10, 140);
      this.relief += 0.34;                                  // выпустил пар — передышка
      if (this.relief >= 1) { this.standDown(); }
      else {
        // вспыхивает обратно (возвращается) — текстура злости
        this.size = Math.max(0.6, this.size * 0.82);
        this.state = 'gone'; this.t = 0;
        this.img.setVisible(false);
        this.ctx.sayOnce('irrit_pop', 'выпустил пар! ...а оно снова вскипает.', 2400);
      }
      return true;
    }
    return false;
  }
}
