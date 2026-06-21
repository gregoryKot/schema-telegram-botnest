import Phaser from 'phaser';
import { GROUND_Y, W, H } from '../constants';
import { audio } from '../audio';
import { MobCtx, HomeMob } from './home';

// ════════════════════════════════════════════════════════════════════════════
//  Акт II «Дорога в терапию». Враги тут не нападают — ОТГОВАРИВАЮТ идти.
//  Само-Пройдёт — сирена-колыбельная: рядом экран мягко темнеет и всё замедляется,
//  шепчет «да всё норм». ЗАЛИПНЕШЬ (ИЗБЕГАЙ-удержание) = уснёшь, −сердце (ловушка).
//  Верное: не слушать, пройти мимо (выйти из зоны) → отступает.
// ════════════════════════════════════════════════════════════════════════════

const ZONE = 210; // радиус «уюта»

export class SelfSoothe implements HomeMob {
  alive = true;
  private img: Phaser.GameObjects.Sprite;
  private dim: Phaser.GameObjects.Graphics;
  private sleep = 0;
  private bob = Math.random() * 6;
  private relief = 0; // прошёл мимо, не слушал → передышка → отступает

  constructor(private ctx: MobCtx, x: number) {
    const s = ctx.scene;
    // временный визуал: бледный светящийся шар (заменим сгенерённым спрайтом)
    this.img = s.add.sprite(x, GROUND_Y - 46, 'memory').setScale(2.4).setTint(0xbfe0ff).setDepth(6);
    if (s.anims.exists('memory-twinkle')) this.img.play('memory-twinkle');
    this.dim = s.add.graphics().setScrollFactor(0).setDepth(40);
  }

  update(dt: number) {
    if (!this.alive) return;
    this.bob += dt * 0.004;
    this.img.y = GROUND_Y - 46 + Math.sin(this.bob) * 5;
    const p = this.ctx.player();
    const d = Phaser.Math.Distance.Between(this.img.x, this.img.y, p.x, p.y - 20);
    const inZone = d < ZONE;

    this.dim.clear();
    if (inZone) {
      const k = 1 - d / ZONE;                       // ближе — глубже дрёма
      this.dim.fillStyle(0x0a0a16, 0.5 * k); this.dim.fillRect(0, 0, W, H);
      this.ctx.slow(0.55);                          // всё вязнет, тянет постоять
      this.ctx.sayOnce('soothe_zone', 'да всё нормально... у других хуже.', 2800);
      if (this.ctx.frozen()) {                      // залип = засыпаешь (ловушка)
        this.sleep += dt;
        this.relief = Math.max(0, this.relief - dt * 0.0006);
        if (this.sleep > 1500) { this.sleep = 0; this.ctx.damage(this.img.x); this.ctx.sayOnce('soothe_sleep', '...задремал. и день прошёл.', 2800); }
      } else {
        this.sleep = Math.max(0, this.sleep - dt);
      }
    } else {
      this.relief += dt * 0.0009;                   // не слушал, прошёл мимо → отступает
      if (this.relief >= 1) this.standDown();
    }
  }

  tryHit(): boolean {
    this.ctx.sayOnce('soothe_hit', 'по ней не ударишь — она просто баюкает.', 2400);
    return true;
  }

  private standDown() {
    this.alive = false;
    audio.freeze();
    this.dim.clear(); this.dim.destroy();
    this.ctx.sayOnce('soothe_off', 'прошёл мимо, не уснул. идём дальше.', 2600);
    this.ctx.scene.tweens.add({ targets: this.img, alpha: 0, scale: 0, duration: 420, onComplete: () => this.img.destroy() });
  }
}
