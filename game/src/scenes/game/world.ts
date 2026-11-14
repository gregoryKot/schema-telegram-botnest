// Мир вокруг кота: спираль истощения, шипы, подбор сердец и воспоминаний, падение в яму.
import Phaser from 'phaser';
import { W, H, GROUND_Y } from '../../constants';
import { audio } from '../../audio';
import type { GameScene } from '../GameScene';

// ── СПИРАЛЬ (не цикл): копинг и время копят истощение → мир враждебнее ──────
export function updateSpiral(s: GameScene, dt: number) {
  const coping = s.frozen || s.dashing || s.attacking;
  s.exhaustion = Math.min(1, s.exhaustion + dt * (coping ? 0.00011 : 0.000022));
  audio.setDetune(1 - s.exhaustion * 0.06); // музыка чуть ниже = «расстроеннее»
  // виньетка темнеет к краям
  const g = s.exhaustOverlay; g.clear();
  const a = s.exhaustion;
  if (a > 0.02) {
    const band = 24 + 70 * a, t = 0.5 * a;
    g.fillStyle(0x080510, t);
    g.fillRect(0, 0, W, band); g.fillRect(0, H - band, W, band);
    g.fillRect(0, 0, band * 0.7, H); g.fillRect(W - band * 0.7, 0, band * 0.7, H);
  }
  // состояние пальцами: рядом угрозы — экран подрагивает (п.4)
  let threats = s.anx.filter(a2 => a2.alive && Phaser.Math.Distance.Between(a2.img.x, a2.img.y, s.player.x, s.player.y) < 150).length;
  if (s.critic?.alive && Phaser.Math.Distance.Between(s.critic.img.x, s.critic.img.y, s.player.x, s.player.y) < 150) threats++;
  if (threats > 0 && !s.dashing) s.cameras.main.shake(50, 0.0012 * Math.min(threats, 3), false);
}

export function updateHazards(s: GameScene) {
  const px = s.player.x, py = s.player.y;
  // spikes — touching the ground band over a spike strip costs a heart
  if (s.invuln <= 0 && py > GROUND_Y - 26) {
    for (const sp of s.spikeRects) {
      if (px > sp.x && px < sp.x + sp.w) { s.damage(px); break; }
    }
  }
  // heart pickups
  for (const h of s.heartPickups) {
    if (!h.active) continue;
    if (Phaser.Math.Distance.Between(px, py - 22, h.x, h.y) < 32) {
      h.destroy();
      if (s.hearts < s.MAX_HEARTS) { s.hearts++; s.updateHearts(); }
      audio.pickup();
      s.burst(h.x, h.y, 0xff6688, 8, 110);
    }
  }
  // тёплые воспоминания
  for (const m of s.memories) {
    if (!m.active) continue;
    if (Phaser.Math.Distance.Between(px, py - 22, m.x, m.y) < 34) {
      collectMemory(s, m);
    }
  }
}

function collectMemory(s: GameScene, m: Phaser.GameObjects.Sprite) {
  m.setActive(false); // сразу снимаем с учёта — иначе твин-исчезновение даёт двойной счёт
  s.memGot++;
  audio.pickup();
  s.burst(m.x, m.y, 0xffd870, 10, 120);
  s.tweens.add({ targets: m, y: m.y - 24, alpha: 0, scale: 1.6, duration: 380, onComplete: () => m.destroy() });
  s.memText?.setText(`✦ ${s.memGot}/${s.memTotal}`);
  if (s.memGot >= s.memTotal && s.memTotal > 0) {
    // все собраны — награда: тёплая строка + полное здоровье
    s.hearts = s.MAX_HEARTS; s.updateHearts();
    s.cameras.main.flash(300, 80, 70, 30);
    s.say('m_every_warm_thought_is_with_you', 3200);
  } else {
    s.sayOnce('mem_first', 'm_warm_good_things_exist_too_gather', 2400);
  }
}

export function fallRespawn(s: GameScene) {
  const cp = [...s.chapter.checkpoints].reverse().find(c => c <= s.player.x) ?? 100;
  const b = s.player.body as Phaser.Physics.Arcade.Body;
  b.reset(cp, GROUND_Y - 60); b.setVelocity(0, 0);
  s.cameras.main.shake(160, 0.008);
  s.player.setAlpha(0.35);
  s.tweens.add({ targets: s.player, alpha: 1, duration: 450 });
  // падение в пропасть — реальная потеря: минус жизнь (i-кадры от двойного списания)
  if (s.assistInvuln || s.invuln > 0) return;
  s.invuln = 900;
  s.hearts -= 1; s.updateHearts();
  audio.hurt(); // звук падения — раньше его не было
  s.cameras.main.flash(120, 80, 20, 40);
  s.say('m_fell_1_life', 1800);
  if (s.hearts <= 0) s.gameOver();
}
