import Phaser from 'phaser';
import { audio } from './audio';

// Портрета нет (решение 5 в #1087): пока телефон стоит вертикально, поверх —
// экран «поверни телефон» (CSS в index.html), а сцены и звук стоят на паузе.
export function pauseInPortrait(game: Phaser.Game) {
  const mq = matchMedia('(orientation: portrait) and (pointer: coarse)');
  const apply = () => {
    if (mq.matches) {
      game.loop.sleep();
      audio.pause(true);
    } else {
      game.loop.wake();
      audio.pause(false);
    }
  };
  mq.addEventListener('change', apply);
  game.events.once(Phaser.Core.Events.POST_STEP, apply); // после первого кадра: цикл уже запущен
}
