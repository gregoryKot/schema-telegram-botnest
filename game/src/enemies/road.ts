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
      this.ctx.sayOnce('soothe_zone', 'm_it_s_all_fine_others_have', 2800);
      if (this.ctx.frozen()) {                      // залип = засыпаешь (ловушка)
        this.sleep += dt;
        this.relief = Math.max(0, this.relief - dt * 0.0006);
        if (this.sleep > 1500) { this.sleep = 0; this.ctx.damage(this.img.x); this.ctx.sayOnce('soothe_sleep', 'm_dozed_off_and_the_day_was', 2800); }
      } else {
        this.sleep = Math.max(0, this.sleep - dt);
      }
    } else {
      this.relief += dt * 0.0009;                   // не слушал, прошёл мимо → отступает
      if (this.relief >= 1) this.standDown();
    }
  }

  tryHit(): boolean {
    this.ctx.sayOnce('soothe_hit', 'm_you_can_t_hit_it_it', 2400);
    return true;
  }

  private standDown() {
    this.alive = false;
    audio.freeze();
    this.dim.clear(); this.dim.destroy();
    this.ctx.sayOnce('soothe_off', 'm_walked_past_didn_t_fall_asleep', 2600);
    this.ctx.scene.tweens.add({ targets: this.img, alpha: 0, scale: 0, duration: 420, onComplete: () => this.img.destroy() });
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Кривое зеркало («не настолько плохо, у других хуже»). Показывает приукрашенного
//  тебя и шепчет «да всё норм». ПЕРЕГОРАЖИВАЕТ путь. Пройти можно только ЗАМЕРЕВ
//  перед ним — посмотреть честно: зеркало трескается. Здесь ЗАМРИ = смелость, а
//  не бегство (поворотная точка к терапии). Удар/рывок — не работают.
// ════════════════════════════════════════════════════════════════════════════

export class CrookedMirror implements HomeMob {
  alive = true;
  private frame: Phaser.GameObjects.Image;
  private fake: Phaser.GameObjects.Sprite;
  private bar: Phaser.GameObjects.Graphics;
  private barrier: Phaser.GameObjects.Rectangle;
  private look = 0;

  constructor(private ctx: MobCtx, private x: number) {
    const s = ctx.scene;
    // временный визуал: дверь-спрайт как «рама» + приукрашенный двойник внутри
    this.frame = s.add.image(x, GROUND_Y, 'prop_door').setOrigin(0.5, 1).setScale(0.85).setTint(0x9fd8ff).setDepth(6);
    this.fake = s.add.sprite(x, GROUND_Y - 26, 'cat_idle').setOrigin(0.5, 1).setScale(1.2).setTint(0xe6ccff).setAlpha(0.85).setDepth(7);
    if (s.anims.exists('p-idle')) this.fake.play('p-idle');
    this.bar = s.add.graphics().setDepth(46);
    // барьер: дальше нельзя, пока не посмотрел честно
    this.barrier = s.add.rectangle(x, GROUND_Y / 2, 14, GROUND_Y + 40, 0, 0);
    s.physics.add.existing(this.barrier, true);
    s.physics.add.collider(ctx.player(), this.barrier, () =>
      this.ctx.sayOnce('mirror_block', 'm_can_t_get_past_freeze_hold', 2800));
  }

  update(dt: number) {
    if (!this.alive) return;
    this.fake.x = this.x; // двойник «отражает» — стоит в раме
    const p = this.ctx.player();
    const d = Math.abs(p.x - this.x);
    this.bar.clear();
    if (d < 170) {
      this.ctx.sayOnce('mirror_zone', 'm_come_on_it_s_fine_you', 2800);
      if (this.ctx.frozen()) {
        this.look += dt;
        const k = Math.min(1, this.look / 1700);
        // явный прогресс «честного взгляда»
        this.bar.fillStyle(0x0a0814, 0.7); this.bar.fillRect(this.x - 34, GROUND_Y - 156, 68, 12);
        this.bar.fillStyle(0x88ffcc, 1);   this.bar.fillRect(this.x - 31, GROUND_Y - 153, 62 * k, 6);
        this.bar.fillStyle(0xffffff, 0.9); this.bar.fillRect(this.x - 31, GROUND_Y - 145, 62, 2);
        this.ctx.sayOnce('mirror_look', 'm_looking_honestly_and_it_s_really', 2400);
        if (this.look >= 1700) this.crack();
      } else {
        this.look = Math.max(0, this.look - dt * 0.6);
        if (this.ctx.dashing()) this.ctx.sayOnce('mirror_dash', 'm_turned_away_and_believed_again_it', 2600);
      }
    }
  }

  tryHit(): boolean {
    this.ctx.sayOnce('mirror_hit', 'm_smash_the_mirror_you_ll_keep', 2400);
    return true;
  }

  private crack() {
    this.alive = false;
    audio.split();
    this.barrier.destroy();
    this.bar.clear(); this.bar.destroy();
    this.ctx.burst(this.x, GROUND_Y - 80, 0x9fd8ff, 14, 140);
    this.ctx.sayOnce('mirror_crack', 'm_saw_it_honestly_to_stop_and', 3600);
    const s = this.ctx.scene;
    s.tweens.add({ targets: [this.frame, this.fake], alpha: 0, y: '+=12', angle: 4, duration: 650, onComplete: () => { this.frame.destroy(); this.fake.destroy(); } });
  }
}
