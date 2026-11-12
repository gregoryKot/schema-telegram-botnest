// Сцен-скрипт экрана смерти и возврата на чекпоинт.
import { W, H, GROUND_Y } from '../../constants';
import { audio } from '../../audio';
import { IS_TOUCH } from '../../controls';
import { t } from '../../i18n';
import { getAssist, setAssist } from '../../assist';
import { trackEvent } from '../../analytics';
import type { GameScene } from '../GameScene';
import { addCrisisLine } from './cta';

export function gameOver(s: GameScene) {
  if (s.dead) return;            // не запускать дважды
  s.dead = true; s.deathsInChapter += 1;
  // кота, отброшенного ударом, останавливаем: физика под экраном смерти живёт, и он уезжал на прошлый чекпоинт
  const pb = s.player.body as Phaser.Physics.Arcade.Body;
  pb.setVelocity(0, 0); pb.moves = false;
  s.deathX = s.player.x;
  trackEvent('game_over', { chapter: s.chapter.id });
  audio.stopMusic();
  // сразу гасим хаос (огромные тучи и пр.) чёрной шторой — иначе он лезет в кадр
  const cover = s.add.rectangle(W / 2, H / 2, W, H, 0x06040e).setScrollFactor(0).setDepth(150).setAlpha(0);
  s.tweens.add({ targets: cover, alpha: 1, duration: 700 });
  const font = '"Press Start 2P", "Courier New", monospace';
  const txt = s.add.text(W / 2, H / 2 - 16, t('m_this_can_t_go_on'), { fontFamily: font, fontSize: '20px', color: '#ff7799', letterSpacing: 2 })
    .setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);
  s.tweens.add({ targets: txt, alpha: 1, duration: 800, delay: 400 });
  // простой, понятный ретрай — без абстрактной сцены «повернуться» (она только в финале главы)
  s.time.delayedCall(1900, () => {
    const t2 = s.add.text(W / 2, H / 2 + 26, t('m_but_it_s_only_a_try'), { fontFamily: font, fontSize: '12px', color: '#a8e8d0' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);
    const hint = s.add.text(W / 2, H - 56, t(IS_TOUCH ? 'm_tap_try_again' : 'm_key_click_try_again'), { fontFamily: font, fontSize: '11px', color: '#88ffcc' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);
    s.tweens.add({ targets: [t2, hint], alpha: 0.9, duration: 600 });
    const overlay: Phaser.GameObjects.GameObject[] = [cover, txt, t2, hint, addCrisisLine(s, H - 28, 200)];
    // после второй смерти в главе ассист предлагается прямо здесь — спрятанный в меню
    // тумблер для новичка не существует (правило онбординга CLAUDE.md)
    if (s.deathsInChapter >= 2 && !s.assistInvuln) {
      const noDmg = s.add.text(W / 2, H / 2 + 64, t('m_continue_no_damage'), { fontFamily: font, fontSize: '11px', color: '#ffd86a',
        backgroundColor: 'rgba(70,50,12,0.75)', padding: { x: 10, y: 6 } })
        .setOrigin(0.5).setScrollFactor(0).setDepth(201).setAlpha(0).setInteractive({ useHandCursor: true });
      s.tweens.add({ targets: noDmg, alpha: 0.95, duration: 600, delay: 300 });
      noDmg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: { stopPropagation(): void }) => {
        ev.stopPropagation();
        setAssist('invuln', true); s.assistInvuln = true;
        cleanup(); respawnAtCheckpoint(s);
      });
      overlay.push(noDmg);
    }
    const cleanup = () => { s.input.keyboard!.off('keydown', go); s.input.off('pointerdown', go); overlay.forEach(o => o.destroy()); };
    const go = () => { cleanup(); respawnAtCheckpoint(s); };
    s.input.keyboard!.once('keydown', go);
    s.input.once('pointerdown', go);
  });
}

// Смерть — не вся глава заново: возвращаемся на последний чекпоинт, а открытые
// гейты, собранные ✦ и ответы отговоркам остаются (раньше scene.restart с x=100 —
// для ЦА в дистрессе самая дорогая потеря в игре).
export function respawnAtCheckpoint(s: GameScene) {
  s.dead = false;
  s.hearts = getAssist().extraLives ? s.MAX_HEARTS : 3; s.updateHearts();
  s.invuln = 1500; s.hitstop = 0; s.frozen = false; s.dashing = false; s.attacking = false;
  s.hidePlay();
  const cp = [...s.chapter.checkpoints].reverse().find(c => c <= s.deathX) ?? 100;
  const b = s.player.body as Phaser.Physics.Arcade.Body;
  b.reset(cp, GROUND_Y - 60); b.setVelocity(0, 0); b.setAllowGravity(true); b.moves = true;
  s.player.setVisible(true).setAlpha(0.35);
  s.tweens.add({ targets: s.player, alpha: 1, duration: 450 });
  // врагов рядом отбросить — иначе убьют на месте
  for (const m of s.anx) if (m.alive) { m.vx = Math.sign(m.img.x - s.player.x || 1) * 320; m.vy = -120; m.cd = 2600; m.calm += 1000; }
  if (s.critic?.alive) s.critic.struck = 3000;
  s.cameras.main.resetFX();
  audio.setMode(s.chapter.music); audio.startMusic();
}
