// Враги главы: туча тревоги и тень-критик — спавн, удары, поведение.
import { GROUND_Y } from '../../constants';
import { audio } from '../../audio';
import { t, type MsgKey } from '../../i18n';
import type { GameScene, Anx } from '../GameScene';
import { adoptIntoGate } from './road';

const ANX_SCALE = 0.42;  // спрайт тучи широкий — ужимаем до размера как в обучении
// тень-критик выкрикивает это постоянно (голос Карающего Критика)
const CRITIC_LINES: MsgKey[] = [
  'm_you_failed_again', 'm_everyone_managed_except_you', 'm_told_you_it_won_t_work',
  'm_every_single_time', 'm_pull_yourself_together', 'm_who_needs_you_like_this',
  'm_ruined_it_again', 'm_you_should_be_ashamed',
];

// ── Spawns ───────────────────────────────────────────────────────────────--
export function spawnAnx(s: GameScene, x: number, size: number) {
  const s2 = size * (1 + s.exhaustion * 0.3); // спираль: чем выжатее — тем крупнее возвращается
  // ореол позади — отделяет тёмную тучу от чёрного кота и «дышит»
  const halo = s.add.ellipse(x, GROUND_Y - 44, 104, 78, 0x9a5ad0, 0.22).setDepth(5);
  const img = s.add.sprite(x, GROUND_Y - 44, 'anxmob').setDepth(6).setScale(s2 * ANX_SCALE).play('anx-fly');
  s.anx.push({ img, halo, state: 'chase', t: 0, size: s2, vx: 0, vy: 0, jit: Math.random()*6, calm: 0, cd: 0, alive: true });
}

export function spawnCritic(s: GameScene) {
  if (s.critic) return;
  const img = s.add.sprite(s.player.x - 200, s.player.y, 'cat_idle')
    .setOrigin(0.5, 1).setScale(1.5).setDepth(9).setTint(0x1a0030).setAlpha(0).play('p-walk');
  s.tweens.add({ targets: img, alpha: 0.82, duration: 600 });
  s.critic = { img, size: 1, struck: 0, alive: true };
  // тень постоянно выкрикивает упрёки — её не заткнуть
  s.criticBubble = s.add.text(0, 0, '', {
    fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '8px',
    color: '#ff8aa6', backgroundColor: 'rgba(18,6,18,0.72)', padding: { x: 6, y: 4 }, align: 'center',
  }).setOrigin(0.5, 1).setDepth(46).setAlpha(0);
  s.criticSayT = 2200; // первый упрёк почти сразу
  // важный новый враг — представляем стоп-кадром один раз на игрока, иначе «просто какой-то кот»
  s.introOnce('critic', 'm_the_inner_critic', 'm_critic_story');
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
    adoptIntoGate(s, m, nb);
    audio.split();
    s.sayOnce('hit', 'm_hitting_is_useless_there_s_only', 2600);
  } else {
    // делиться больше некуда — измотал, оседает (но любой способ это лишь оттянет)
    m.calm += 600;
    s.sayOnce('hit_many', 'm_worn_out_it_settles_but_not', 2800);
  }
}

// ── Self-critic: его не победить. Рявкнул — притих на миг и вырос. Он же ты.
export function hitCritic(s: GameScene) {
  const c = s.critic;
  if (!c) return;
  s.doHitstop(50); s.cameras.main.shake(90, 0.006); audio.hit();
  s.burst(c.img.x, c.img.y - 20, 0x6a2a8a, 8, 110);
  c.struck = 1600;                              // огрызнулся — притих на секунду
  c.size = Math.min(2.4, c.size + 0.18);        // ...и в ответ стал больше
  c.img.setScale(1.5 * c.size);
  s.sayOnce('critic_hit', 'm_snapped_it_hushed_then_grew_louder', 3200);
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

// Критик ходит тенью за тобой. Бег от него и клубок его КОРМЯТ.
export function updateCritic(s: GameScene, dt: number) {
  const c = s.critic; if (!c || !c.alive) return;
  // уступка прогнала его — стоит вдалеке, выцветший, и ждёт своего часа
  if (c.struck > 1500) {
    c.struck -= dt;
    c.img.setAlpha(0.22);
    c.img.play('p-idle', true);
    s.criticBubble?.setAlpha(0); // притих, пока выцветший
    if (c.struck <= 1500) s.sayOnce('critic_back', 'm_it_came_back_they_always_come', 2800);
    return;
  }
  // постоянный поток упрёков над тенью — её не заткнуть
  if (s.criticBubble) {
    s.criticSayT += dt;
    s.criticBubble.x = c.img.x;
    s.criticBubble.y = c.img.y - 66 * c.size;
    if (s.criticSayT > 2300) {
      s.criticSayT = 0;
      s.criticBubble.setText(t(CRITIC_LINES[s.criticLine++ % CRITIC_LINES.length])).setAlpha(0).setScale(0.85);
      s.tweens.add({ targets: s.criticBubble, alpha: 0.95, scale: 1, duration: 260, ease: 'Back.Out' });
    }
  }
  c.img.setAlpha(0.82);
  const target = s.trail[0];   // oldest = ~1.5s behind
  if (target) {
    c.img.x += (target.x - c.img.x) * 0.12;
    c.img.y += (target.y - c.img.y) * 0.18;
    c.img.setFlipX(target.flip);
    c.img.play(Math.abs(target.x - c.img.x) > 4 ? 'p-walk' : 'p-idle', true);
  }
  const dist = Phaser.Math.Distance.Between(c.img.x, c.img.y - 20, s.player.x, s.player.y - 20);
  // убегаешь — он растёт за спиной
  if (s.dashing || dist > 320) {
    c.size = Math.min(2.4, c.size + dt * 0.00012);
    if (c.size > 1.6) s.sayOnce('critic_grow', 'm_i_run_and_behind_me_it', 2800);
  }
  // отвлёкся на клубок при нём — кормишь его ещё быстрее
  if (s.frozen && dist < 300) {
    c.size = Math.min(2.4, c.size + dt * 0.0005);
    s.sayOnce('critic_frz', 'm_the_yarn_it_s_right_behind', 2800);
  }
  c.img.setScale(1.5 * c.size);
  c.struck -= dt;
  if (dist < 34 && s.invuln <= 0 && c.struck <= 0 && !s.finalApproach) {
    c.struck = 1200; s.damage(c.img.x);
    s.sayOnce('critic_catch', 'm_you_failed_again_whatever_you_do', 3000);
  }
}
