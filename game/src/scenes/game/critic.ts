// Тень-критик: ходит следом, выкрикивает упрёки, растёт от бегства и удара.
import Phaser from 'phaser';
import { audio } from '../../audio';
import { t, type MsgKey } from '../../i18n';
import type { GameScene } from '../GameScene';
import { introOnce } from './frames';

// тень-критик выкрикивает это постоянно (голос Карающего Критика)
const CRITIC_LINES: MsgKey[] = [
  'm_you_failed_again', 'm_everyone_managed_except_you', 'm_told_you_it_won_t_work',
  'm_every_single_time', 'm_pull_yourself_together', 'm_who_needs_you_like_this',
  'm_ruined_it_again', 'm_you_should_be_ashamed',
];

export interface Critic {
  img: Phaser.GameObjects.Sprite; size: number; struck: number; alive: boolean;
}

export function spawnCritic(s: GameScene) {
  if (s.critic) return;
  const img = s.add.sprite(s.player.x - 200, s.player.y, 'cat_idle')
    .setOrigin(0.5, 1).setScale(1.5).setDepth(9).setTint(0x1a0030).setAlpha(0).play('p-walk');
  s.tweens.add({ targets: img, alpha: 0.82, duration: 600 });
  s.critic = { img, size: 1, struck: 0, alive: true };
  // тень постоянно выкрикивает упрёки — её не заткнуть
  s.criticBubble = s.add.text(0, 0, '', {
    fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '11px',
    color: '#ff8aa6', backgroundColor: 'rgba(18,6,18,0.72)', padding: { x: 6, y: 4 }, align: 'center',
  }).setOrigin(0.5, 1).setDepth(46).setAlpha(0);
  s.criticSayT = 2200; // первый упрёк почти сразу
  // важный новый враг — представляем стоп-кадром один раз на игрока, иначе «просто какой-то кот»
  introOnce(s, 'critic', 'm_the_inner_critic', 'm_critic_story');
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
