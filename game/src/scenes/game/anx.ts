// Тучи тревоги: появление, погоня, удар (делится) и успокоение.
import Phaser from 'phaser';
import { GROUND_Y } from '../../constants';
import { audio } from '../../audio';
import type { GameScene } from '../GameScene';

const ANX_SCALE = 0.42;  // спрайт тучи широкий — ужимаем до размера как в обучении

type AnxState = 'chase' | 'windup' | 'lunge' | 'calm';
export interface Anx {
  img: Phaser.GameObjects.Image; halo: Phaser.GameObjects.Ellipse;
  state: AnxState; t: number; size: number;
  vx: number; vy: number; jit: number; calm: number; cd: number; alive: boolean;
}

export function spawnAnx(s: GameScene, x: number, size: number) {
  const s2 = size * (1 + s.exhaustion * 0.3); // спираль: чем выжатее — тем крупнее возвращается
  // ореол позади — отделяет тёмную тучу от чёрного кота и «дышит»
  const halo = s.add.ellipse(x, GROUND_Y - 44, 104, 78, 0x9a5ad0, 0.22).setDepth(5);
  const img = s.add.sprite(x, GROUND_Y - 44, 'anxmob').setDepth(6).setScale(s2 * ANX_SCALE).play('anx-fly');
  s.anx.push({ img, halo, state: 'chase', t: 0, size: s2, vx: 0, vy: 0, jit: Math.random()*6, calm: 0, cd: 0, alive: true });
}

// ── Anxiety: бить = их только больше; растворяет лишь спокойствие ──────────
export function hitAnx(s: GameScene, m: Anx, dir: number) {
  m.vx = dir * 300; m.vy = -140; m.state = 'chase'; m.cd = 600;
  s.doHitstop(55); s.cameras.main.shake(70, 0.005); audio.hit();
  s.burst(m.img.x, m.img.y, 0xaa55cc, 8, 130);
  const aliveCount = s.anx.filter(a => a.alive).length;
  if (aliveCount < 7 && m.size > 0.6) {
    // удар по тревоге — она делится (хуже). Ловушка.
    m.size = Math.max(0.6, m.size * 0.85); m.img.setScale(m.size * ANX_SCALE);
    spawnAnx(s, m.img.x, m.size);
    const nb = s.anx[s.anx.length - 1]; nb.vx = -dir * 220; nb.vy = -110;
    s.adoptIntoGate(m, nb);
    audio.split();
    s.sayOnce('hit', 'm_hitting_is_useless_there_s_only', 2600);
  } else {
    // делиться больше некуда — измотал, оседает (но любой способ это лишь оттянет)
    m.calm += 600;
    s.sayOnce('hit_many', 'm_worn_out_it_settles_but_not', 2800);
  }
}

export function updateAnx(s: GameScene, dt: number) {
  const px = s.player.x, py = s.player.y - 24;
  for (const m of s.anx) {
    if (!m.alive) continue;
    m.jit += dt * 0.02; m.cd -= dt;
    // критик рядом — тревога подпитывается и растёт (мысли громче под его голос)
    if (s.critic?.alive && m.state !== 'calm'
      && Phaser.Math.Distance.Between(m.img.x, m.img.y, s.critic.img.x, s.critic.img.y) < 220) {
      m.size = Math.min(2.0, m.size + dt * 0.0002); m.img.setScale(m.size * ANX_SCALE);
    }
    const dist = Phaser.Math.Distance.Between(m.img.x, m.img.y, px, py);
    // любой копинг копит «передышку»: залипание рядом — быстрее всего,
    // проскок рывком сквозь неё — чуть-чуть. Накопил — отступает (на время).
    if (s.frozen && dist < 240) m.calm += dt;
    else if (s.dashing && dist < 64) m.calm += dt * 2;
    else if (m.state !== 'calm') m.calm = Math.max(0, m.calm - dt * 0.3);
    if (m.calm > 800 && m.state !== 'calm') { m.state = 'calm'; m.t = 0; s.sayOnce('freeze', 'm_it_backs_off_but_it_will', 2600); }

    switch (m.state) {
      case 'chase': {
        m.vx += Math.sign(px - m.img.x) * 14; m.vx = Phaser.Math.Clamp(m.vx, -155, 155);
        const ty = GROUND_Y - 48 + Math.sin(m.jit) * 9; m.vy += (ty - m.img.y) * 0.04; m.vy = Phaser.Math.Clamp(m.vy, -130, 130);
        if (dist < 155 && m.cd <= 0) { m.state = 'windup'; m.t = 0; m.vx *= 0.2; }
        break;
      }
      case 'windup': {
        m.t += dt; m.vx *= 0.85; m.vy *= 0.85;
        m.img.setTint(m.t % 150 < 75 ? 0xff4466 : 0xffffff);
        m.img.setScale(m.size * ANX_SCALE * (1 + Math.sin(m.t * 0.04) * 0.12));
        if (m.t > 460) { m.state = 'lunge'; m.t = 0; m.img.clearTint().setScale(m.size * ANX_SCALE); audio.anx();
          const a = Math.atan2(py - m.img.y, px - m.img.x); m.vx = Math.cos(a) * 450; m.vy = Math.sin(a) * 450; }
        break;
      }
      case 'lunge': {
        m.t += dt; if (m.t > 270) { m.state = 'chase'; m.cd = 680; }
        if (dist < 30 && s.invuln <= 0) s.damage(m.img.x);
        break;
      }
      case 'calm': {
        m.t += dt; m.vx += Math.sign(m.img.x - px) * 8; m.vy -= 2;
        m.size = Math.max(0.2, m.size - dt * 0.0004); m.img.setScale(m.size * ANX_SCALE).setAlpha(0.6);
        if (!s.frozen && dist > 360) { m.state = 'chase'; m.calm = 0; m.img.setAlpha(1); }
        if (m.size <= 0.2) { m.alive = false; s.tweens.add({ targets: [m.img, m.halo], alpha: 0, duration: 350, onComplete: () => m.img.destroy() }); }
        break;
      }
    }
    m.img.x += m.vx * dt / 1000; m.img.y += m.vy * dt / 1000; m.vx *= 0.96; m.vy *= 0.98;
    m.img.x += Math.sin(m.jit * 3) * 0.8; m.img.y += Math.cos(m.jit * 4) * 0.8;
    m.img.y = Math.min(m.img.y, GROUND_Y - 12);
    // ореол следует и пульсирует (ярче на замахе)
    m.halo.setPosition(m.img.x, m.img.y).setScale(m.size * (1 + Math.sin(m.jit * 2) * 0.12))
      .setAlpha((m.state === 'calm' ? 0.1 : 0.22) + (m.state === 'windup' ? 0.18 : 0));
  }
  s.anx = s.anx.filter(m => {
    if (!m.alive && !m.img.active) { m.halo.destroy(); return false; }
    return true;
  });
}
