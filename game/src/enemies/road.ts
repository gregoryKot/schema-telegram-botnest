import Phaser from 'phaser';
import { GROUND_Y } from '../constants';
import { audio } from '../audio';
import { MobCtx, HomeMob } from './home';

// ════════════════════════════════════════════════════════════════════════════
//  Акт II «Выбор». У неверных дверей стоят ЗАЗЫВАЛЫ — не враги, а продавцы
//  неверных выборов. Урона не наносят, победить их нельзя и не нужно:
//  бить/избегать/уступать отговорке бессмысленно (реплики это показывают).
//  Настоящее препятствие главы — сама ДВЕРЬ, то есть выбор игрока.
// ════════════════════════════════════════════════════════════════════════════

// ── «Само-Пройдёт» — призрак-колыбельная у двери «Домой» ────────────────────
export class SelfSoothe implements HomeMob {
  alive = true;
  private img: Phaser.GameObjects.Sprite;
  private bob = Math.random() * 6;

  constructor(private ctx: MobCtx, x: number) {
    const s = ctx.scene;
    this.img = s.add.sprite(x, GROUND_Y - 52, 'soothe').setScale(0.82).setDepth(6);
    if (s.anims.exists('soothe-idle')) this.img.play('soothe-idle');
  }

  update(dt: number) {
    this.bob += dt * 0.004;
    this.img.y = GROUND_Y - 52 + Math.sin(this.bob) * 5;
    const p = this.ctx.player();
    if (Math.abs(p.x - this.img.x) < 210)
      this.ctx.sayOnce('soothe_zone', 'm_it_s_all_fine_others_have', 2800);
  }

  tryHit(): boolean {
    this.ctx.sayOnce('soothe_hit', 'm_you_can_t_hit_it_it', 2400);
    return true;
  }
}

// ── «Кривое зеркало» — у двери «Домой»: показывает «ты в порядке» ────────────
export class CrookedMirror implements HomeMob {
  alive = true;
  private frame: Phaser.GameObjects.Sprite;

  constructor(private ctx: MobCtx, private x: number) {
    const s = ctx.scene;
    this.frame = s.add.sprite(x, GROUND_Y, 'crookedmirror').setOrigin(0.5, 1).setScale(0.92).setDepth(6);
    if (s.anims.exists('mirror-shimmer')) this.frame.play('mirror-shimmer');
  }

  update(_dt: number) {
    const p = this.ctx.player();
    if (Math.abs(p.x - this.x) < 170)
      this.ctx.sayOnce('mirror_zone', 'm_come_on_it_s_fine_you', 2800);
  }

  tryHit(): boolean {
    this.ctx.sayOnce('mirror_hit', 'm_smash_the_mirror_you_ll_keep', 2400);
    return true;
  }
}

// ── «Это-Дорого» — торгаш-зазывала у «Гуру-Экспресс» ────────────────────────
// Швыряет ценники (безвредные — это реклама, не снаряды). Ударишь — ДОРОЖАЕТ:
// споришь о цене — сам себя убеждаешь, что дело в цене.
export class Bargainer implements HomeMob {
  alive = true;
  private img: Phaser.GameObjects.Sprite;
  private base = 0.82;
  private size = 1;
  private throwT = 0;
  private tags: Phaser.GameObjects.Text[] = [];

  constructor(private ctx: MobCtx, private x: number) {
    const s = ctx.scene;
    this.img = s.add.sprite(x, GROUND_Y, 'bargainer').setOrigin(0.5, 1).setScale(this.base).setDepth(6);
    if (s.anims.exists('bargainer-idle')) this.img.play('bargainer-idle');
  }

  update(dt: number) {
    const p = this.ctx.player();
    for (const g of this.tags) {
      if (!g.active) continue;
      g.x += (g.getData('vx') as number) * dt / 1000;
      g.y -= dt * 0.02; g.angle += dt * 0.25;
      g.setAlpha(Math.max(0, (g.alpha ?? 1) - dt * 0.0006)); // тают как конфетти
    }
    this.tags = this.tags.filter(g => g.active && g.alpha > 0.05 && Math.abs(g.x - this.x) < 420);
    if (Math.abs(p.x - this.x) < 200) {
      this.ctx.sayOnce('barg_zone', 'm_barg_zone', 2600);
      this.throwT += dt;
      if (this.throwT > 1600) { this.throwT = 0; this.throwTag(p.x); }
    }
  }

  private throwTag(px: number) {
    const s = this.ctx.scene;
    const dir = Math.sign(px - this.x) || 1;
    const g = s.add.text(this.x + dir * 22, GROUND_Y - 52, '₽', {
      fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '13px', color: '#ffe08a',
      backgroundColor: '#5a3a12', padding: { x: 4, y: 3 },
    }).setOrigin(0.5).setDepth(7);
    g.setData('vx', dir * 170);
    this.tags.push(g);
    audio.split();
  }

  tryHit(): boolean {
    this.size = Math.min(1.6, this.size + 0.12); this.img.setScale(this.base * this.size);
    this.ctx.hitstop(40); this.ctx.burst(this.img.x, GROUND_Y - 30, 0xffd86a, 6, 90);
    this.ctx.sayOnce('barg_hit', 'm_barg_hit', 2600);
    return true;
  }
}
