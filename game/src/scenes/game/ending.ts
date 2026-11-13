// Развязка главы: накрывает с головой → затемнение → осознание.
import Phaser from 'phaser';
import { W, H } from '../../constants';
import { audio } from '../../audio';
import { CHAPTERS } from '../../chapters';
import { IS_TOUCH } from '../../controls';
import { t, type MsgKey } from '../../i18n';
import { unlockChapter } from '../../progress';
import { trackEvent } from '../../analytics';
import type { GameScene } from '../GameScene';

export function beginOverwhelm(s: GameScene) {
  s.overwhelmed = true;
  audio.setIntensity(1);
  for (let i = 0; i < s.chapter.overwhelmAnx; i++)
    s.spawnAnx(s.player.x + (i - 1) * 200 + Phaser.Math.Between(-40, 40), 1);
  s.say(s.chapter.overwhelmSay, 3200);
  // The day collapses → the realization
  s.time.delayedCall(3600, () => {
    if (s.dead) return;
    s.cameras.main.fade(1400, 8, 6, 16);
    s.time.delayedCall(1500, () => showRealization(s));
  });
}

function showRealization(s: GameScene) {
  s.dead = true;
  trackEvent('game_chapter_done', { chapter: s.chapter.id });
  if (s.chapter.next) unlockChapter(s.chapter.next);
  audio.stopMusic();
  audio.toll();
  s.cameras.main.resetFX();
  s.add
    .rectangle(W / 2, H / 2, W, H, 0x06040e)
    .setScrollFactor(0)
    .setDepth(150);

  const ky = H / 540; // y развязок написаны под десктопную высоту
  const lines: Phaser.GameObjects.Text[] = [];
  const revealed: boolean[] = [];
  const timers: Phaser.Time.TimerEvent[] = [];
  let lastShow = 0,
    finished = false;
  const show = (i: number, fast: boolean) => {
    if (revealed[i]) return;
    revealed[i] = true;
    lastShow = s.time.now;
    s.tweens.add({ targets: lines[i], alpha: 1, duration: fast ? 350 : 900 });
  };
  const line = (
    text: MsgKey,
    y: number,
    color: string,
    size: number,
    delay: number,
  ) => {
    const ln = s.add
      .text(W / 2, y * ky, t(text), {
        fontFamily: '"Press Start 2P", "Courier New", monospace',
        fontSize: `${size}px`,
        color,
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(151)
      .setAlpha(0);
    const i = lines.push(ln) - 1;
    revealed.push(false);
    timers.push(s.time.delayedCall(delay, () => show(i, false)));
  };

  // What just happened — supplied by the chapter (cat's reckoning).
  for (const l of s.chapter.ending) line(l.text, l.y, l.color, l.size, l.delay);
  s.time.delayedCall(10600, () => audio.toll());

  // Дальше — развилка или следующая глава. БЕЗ абстрактного «повернуться»:
  // контакт/ВСТРЕТИТЬ принадлежит Акту III (терапевт открывает его), а на конце
  // Акта I он только путал.
  const next = () => {
    const branch = s.chapter.branch,
      nxt = s.chapter.next;
    if (branch && CHAPTERS[branch]) {
      s.showBranch(branch); // конец Акта I — развилка: терапия ИЛИ дальше
    } else if (nxt && CHAPTERS[nxt]) {
      const act = IS_TOUCH ? t('m_tap') : t('m_press_any_key');
      const title = t(CHAPTERS[nxt].title);
      const hint = s.add
        .text(W / 2, H - 28, t('m_next_chapter', { title, act }), {
          fontFamily: '"Press Start 2P", "Courier New", monospace',
          fontSize: '11px',
          color: '#5a4f7a',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(160)
        .setAlpha(0);
      s.tweens.add({ targets: hint, alpha: 0.8, duration: 800 });
      const go = () => s.scene.restart({ chapter: nxt });
      s.input.keyboard!.once('keydown', go);
      s.input.once('pointerdown', go);
    } else {
      s.showCta();
    }
  };
  // Развязка идёт по таймеру, но её можно листать: тап/клавиша показывает следующую
  // строку (не раньше чем через 1,5 с после предыдущей), а после последней — ведёт
  // дальше сразу. Раньше 19 секунд текста нельзя было пропустить. Сначала ГАСИМ текст.
  const finish = () => {
    if (finished) return;
    finished = true;
    s.input.keyboard!.off('keydown', onInput);
    s.input.off('pointerdown', onInput);
    timers.forEach((tm) => tm.remove(false));
    s.tweens.add({
      targets: lines,
      alpha: 0,
      duration: 700,
      onComplete: () => lines.forEach((l) => l.destroy()),
    });
    s.time.delayedCall(800, next);
  };
  const onInput = () => {
    if (finished) return;
    const i = revealed.indexOf(false);
    if (i === -1) {
      finish();
      return;
    }
    if (s.time.now - lastShow >= 1500) show(i, true);
  };
  s.time.delayedCall(600, () => {
    s.input.keyboard!.on('keydown', onInput);
    s.input.on('pointerdown', onInput);
  });
  s.time.delayedCall(13200, finish);
}
