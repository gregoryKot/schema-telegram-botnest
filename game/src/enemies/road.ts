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
    this.img = s.add.sprite(x, GROUND_Y - 46, 'soothe').setScale(1.1).setDepth(6);
    if (s.anims.exists('soothe-idle')) this.img.play('soothe-idle');
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
  private frame: Phaser.GameObjects.Sprite;
  private bar: Phaser.GameObjects.Graphics;
  private barrier: Phaser.GameObjects.Rectangle;
  private look = 0;

  constructor(private ctx: MobCtx, private x: number) {
    const s = ctx.scene;
    this.frame = s.add.sprite(x, GROUND_Y, 'crookedmirror').setOrigin(0.5, 1).setScale(0.95).setDepth(6);
    if (s.anims.exists('mirror-shimmer')) this.frame.play('mirror-shimmer');
    this.bar = s.add.graphics().setDepth(46);
    // барьер: дальше нельзя, пока не посмотрел честно
    this.barrier = s.add.rectangle(x, GROUND_Y / 2, 14, GROUND_Y + 40, 0, 0);
    s.physics.add.existing(this.barrier, true);
    s.physics.add.collider(ctx.player(), this.barrier, () =>
      this.ctx.sayOnce('mirror_block', 'm_can_t_get_past_freeze_hold', 2800));
  }

  update(dt: number) {
    if (!this.alive) return;
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
    s.tweens.add({ targets: this.frame, alpha: 0, y: '+=12', angle: 4, duration: 650, onComplete: () => this.frame.destroy() });
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Это-Дорого («это слишком дорого, может потом»). Торгаш с весами: швыряет
//  ценники-снаряды. Бьёшь — он только ДОРОЖАЕТ (растёт). Уйти — рывком мимо
//  (выйти из зоны → отступает). Торговаться бесполезно.
// ════════════════════════════════════════════════════════════════════════════

const BARG_ZONE = 200;

export class Bargainer implements HomeMob {
  alive = true;
  private img: Phaser.GameObjects.Sprite;
  private size = 1;
  private relief = 0;
  private throwT = 0;
  private tags: Phaser.GameObjects.Text[] = [];

  constructor(private ctx: MobCtx, private x: number) {
    const s = ctx.scene;
    this.img = s.add.sprite(x, GROUND_Y, 'bargainer').setOrigin(0.5, 1).setScale(1).setDepth(6);
    if (s.anims.exists('bargainer-idle')) this.img.play('bargainer-idle');
  }

  update(dt: number) {
    if (!this.alive) return;
    const p = this.ctx.player();
    const d = Math.abs(p.x - this.x);
    // летящие ценники — урон, если не в рывке
    for (const g of this.tags) {
      if (!g.active) continue;
      g.x += (g.getData('vx') as number) * dt / 1000; g.angle += dt * 0.25;
      if (!this.ctx.dashing() && Math.abs(g.x - p.x) < 26 && Math.abs(g.y - (p.y - 22)) < 32) {
        this.ctx.damage(g.x); g.destroy();
      }
    }
    this.tags = this.tags.filter(g => g.active && Math.abs(g.x - this.x) < 420);
    if (d < BARG_ZONE) {
      this.ctx.sayOnce('barg_zone', 'm_barg_zone', 2600);
      this.throwT += dt;
      if (this.throwT > 1500) { this.throwT = 0; this.throwTag(p.x); }
      this.relief = Math.max(0, this.relief - dt * 0.0004);
    } else {
      this.relief += dt * 0.0009;
      if (this.relief >= 1) this.standDown();
    }
  }

  private throwTag(px: number) {
    const s = this.ctx.scene;
    const dir = Math.sign(px - this.x) || 1;
    const g = s.add.text(this.x + dir * 22, GROUND_Y - 52, '₽', {
      fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '13px', color: '#ffe08a',
      backgroundColor: '#5a3a12', padding: { x: 4, y: 3 },
    }).setOrigin(0.5).setDepth(7);
    g.setData('vx', dir * 230);
    this.tags.push(g);
    audio.split();
  }

  tryHit(): boolean {
    this.size = Math.min(1.6, this.size + 0.12); this.img.setScale(this.size);
    this.relief = Math.max(0, this.relief - 0.3);
    this.ctx.hitstop(40); this.ctx.burst(this.img.x, GROUND_Y - 30, 0xffd86a, 6, 90);
    this.ctx.sayOnce('barg_hit', 'm_barg_hit', 2600);
    return true;
  }

  private standDown() {
    this.alive = false;
    audio.freeze();
    this.tags.forEach(g => g.destroy());
    this.ctx.sayOnce('barg_off', 'm_barg_off', 2600);
    this.ctx.scene.tweens.add({ targets: this.img, alpha: 0, scale: 0, duration: 380, onComplete: () => this.img.destroy() });
  }
}
