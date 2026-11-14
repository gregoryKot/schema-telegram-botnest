// Удар-аура и уступка (fawn) — копинги «бей» и «уступи».
import Phaser from 'phaser';
import { audio } from '../../audio';
import type { GameScene } from '../GameScene';
import { hitAnx } from './anx';
import { hitCritic } from './critic';

export const ATTACK_MS = 170;
export const ATTACK_CD = 300;
const ATTACK_AURA = 104; // радиус удара вокруг кота — бьёт всё рядом, не только спереди

export function updateAttack(s: GameScene, dt: number) {
  if (s.attackCd > 0) s.attackCd -= dt;
  s.slash.clear();
  if (!s.attacking) return;
  s.attackT -= dt;
  const dir = s.player.flipX ? -1 : 1;
  const prog = 1 - s.attackT / ATTACK_MS;
  // выпад с красными штрихами (спрайт), на время атаки прячем обычного кота.
  // спрайт грузится в фоне; нет — атакуем обычным котом, видны только штрихи.
  s.safeAnim('p-lunge', 'cat_dash', 1, 5, 24, 0);
  if (s.anims.exists('p-lunge')) {
    if (!s.lungeSprite.visible) { s.lungeSprite.setVisible(true).play('p-lunge'); s.player.setVisible(false); }
    s.lungeSprite.setPosition(s.player.x, s.player.y).setFlipX(dir < 0);
  }
  // следы когтей поверх — продают удар
  const cx = s.player.x + dir * 30, cy = s.player.y - 34;
  const len = 34 * Math.min(1, prog * 1.6);
  const a = 1 - Math.max(0, prog - 0.45) * 1.8;
  for (let i = 0; i < 3; i++) {
    const ox = i * 7 * dir, oy = i * 9 - 6;
    s.slash.lineStyle(3, i === 1 ? 0xff4455 : 0xd92b3d, Math.max(0, a));
    s.slash.lineBetween(cx + ox, cy + oy, cx + ox + len * dir, cy + oy + len * 0.55);
  }
  if (prog > 0.4 && prog < 0.6) s.burst(cx + len * dir * 0.7, cy + 12, 0xff4455, 2, 60);
  // ударная волна — кольцо ауры вокруг кота (бьёт во все стороны)
  s.slash.lineStyle(3, 0xff5566, Math.max(0, 1 - prog) * 0.7);
  s.slash.strokeCircle(s.player.x, s.player.y - 22, ATTACK_AURA * (0.45 + prog * 0.6));

  // удар — аура вокруг кота: задевает всё в радиусе, не только спереди
  const px = s.player.x, py = s.player.y - 22;
  for (const m of s.anx) {
    if (!m.alive || s.attackHit.has(m)) continue;
    if (Math.hypot(m.img.x - px, m.img.y - py) < ATTACK_AURA) { s.attackHit.add(m); hitAnx(s, m, dir); }
  }
  for (const m of s.homeMobs) {
    if (!m.alive || s.attackHit.has(m)) continue;
    if (m.tryHit(dir, ATTACK_AURA)) s.attackHit.add(m);
  }
  if (s.critic && s.critic.alive && !s.attackHit.has(s.critic)) {
    if (Math.hypot(s.critic.img.x - px, s.critic.img.y - py) < ATTACK_AURA + 20) {
      s.attackHit.add(s.critic); hitCritic(s);
    }
  }
  if (s.attackT <= 0) {
    s.attacking = false;
    s.lungeSprite.setVisible(false); s.player.setVisible(true);
  }
}

// ── УСТУПИ (fawn): купить мир ценой себя — враги отстают, сердце уходит ────
export function doFawn(s: GameScene) {
  if (s.invuln > 0) return; // не спамить
  // уступать только когда есть кому — иначе V «внезапно» съедал сердце впустую
  const nearThreat =
    s.anx.some(m => m.alive && Phaser.Math.Distance.Between(m.img.x, m.img.y, s.player.x, s.player.y) < 260) ||
    (s.critic?.alive && Phaser.Math.Distance.Between(s.critic.img.x, s.critic.img.y, s.player.x, s.player.y) < 280) ||
    s.homeMobs.some(m => m.alive);
  if (!nearThreat) { s.sayOnce('fawn_none', 'm_surrender_but_there_s_no_one', 1600); return; }
  s.hidePlay();
  // уступка стоит сил, но не жизни: с ассистом «без урона» — бесплатно, иначе не ниже одного сердца
  if (!s.assistInvuln) s.hearts = Math.max(1, s.hearts - 1);
  s.updateHearts();
  s.invuln = 3500;
  audio.freeze();
  s.cameras.main.flash(160, 80, 50, 110);
  s.burst(s.player.x, s.player.y - 24, 0xb08fd0, 12, 150);
  curlUp(s); // свернулся калачиком, сдался — вздох
  for (const m of s.anx) { if (m.alive) { m.vx = Math.sign(m.img.x - s.player.x) * 320; m.vy = -120; m.cd = 2600; m.calm += 1000; } }
  if (s.critic?.alive) {
    // уступка — единственное, что прогоняет тень… временно
    s.critic.struck = 8000;
    s.say('m_gave_in_and_the_shadow_backed', 3000);
  } else {
    s.sayOnce('fawn', 'm_fine_fine_whatever_you_say_and', 3400);
  }
}

// Мистер сворачивается калачиком (сдался), держит позу, потом встаёт
function curlUp(s: GameScene) {
  s.safeAnim('p-sleep', 'cat_sleep', 0, 5, 6, 0); // спрайт грузится в фоне — создаём при первом использовании
  if (!s.anims.exists('p-sleep')) return; // спрайт «сна» не доехал — без позы, кот остаётся стоять
  s.player.setVisible(false);
  s.sleepSprite.setVisible(true).setPosition(s.player.x, s.player.y)
    .setFlipX(s.player.flipX).play('p-sleep');
  const sigh = s.add.text(s.player.x, s.player.y - 30, '...',
    { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '12px', color: '#8a8a98' })
    .setOrigin(0.5).setDepth(46);
  s.tweens.add({ targets: sigh, y: sigh.y - 16, alpha: 0, duration: 1600, onComplete: () => sigh.destroy() });
  s.time.delayedCall(1500, () => {
    if (s.dead) return;
    s.sleepSprite.setVisible(false);
    s.player.setVisible(true);
  });
}
