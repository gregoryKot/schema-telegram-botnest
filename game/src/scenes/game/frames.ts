// Стоп-кадры посреди главы: ставят игру на паузу, лишние ждут в очереди.
import Phaser from 'phaser';
import { W, H } from '../../constants';
import { IS_TOUCH } from '../../controls';
import { t, type MsgKey } from '../../i18n';
import type { GameScene } from '../GameScene';

// Стоп-кадр посреди главы: пауза, затемнение, текст, продолжение по тапу
export function storyFrame(s: GameScene, title: MsgKey, text: MsgKey) {
  // Кадр уже открыт (два триггера в одном рывке): не рисовать поверх, а показать следом
  if (s.hitstop > 1e8) {
    s.frameQueue.push([title, text]);
    return;
  }
  s.hitstop = 9e9; // update() стоит, пока не отпустим
  s.dropTitleCard(); // титул главы иначе просвечивает сквозь затемнение и ложится на текст кадра
  // update стоит, но физика Phaser — нет: тормозим игрока, иначе он улетает
  const pb = s.player.body as Phaser.Physics.Arcade.Body;
  pb.setVelocity(0, 0);
  pb.setAllowGravity(false);
  pb.moves = false;
  const deep = 130;
  const dim = s.add
    .rectangle(W / 2, H / 2, W, H, 0x06040e, 0.78)
    .setScrollFactor(0)
    .setDepth(deep);
  const t1 = s.add
    .text(W / 2, 120, t(title), {
      fontFamily: '"Press Start 2P", "Courier New", monospace',
      fontSize: '18px',
      color: '#ff8aa6',
      align: 'center',
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(deep + 1);
  const t2 = s.add
    .text(W / 2, 175, t(text), {
      fontFamily: '"Press Start 2P", "Courier New", monospace',
      fontSize: '11px',
      color: '#d8c8ec',
      align: 'center',
      lineSpacing: 10,
    })
    .setOrigin(0.5, 0)
    .setScrollFactor(0)
    .setDepth(deep + 1);
  const hint = s.add
    .text(W / 2, H - 60, t(IS_TOUCH ? 'm_tap_next' : 'm_any_key_next'), {
      fontFamily: '"Press Start 2P", "Courier New", monospace',
      fontSize: '11px',
      color: '#88ffcc',
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(deep + 1)
    .setAlpha(0);
  s.tweens.add({ targets: hint, alpha: 0.9, duration: 400, delay: 800 });
  s.time.delayedCall(700, () => {
    const go = () => {
      s.input.keyboard!.off('keydown', go);
      s.input.off('pointerdown', go); // иначе второй висит и оживляет игру под следующим кадром
      s.hitstop = 0;
      pb.setAllowGravity(true);
      pb.moves = true;
      [dim, t1, t2, hint].forEach((o) => o.destroy());
      const next = s.frameQueue.shift();
      if (next) storyFrame(s, next[0], next[1]);
    };
    s.input.keyboard!.once('keydown', go);
    s.input.once('pointerdown', go);
  });
}

// Стоп-кадры знакомства с врагами — один раз на игрока, а не на главу: живут вне
// сцены и в localStorage, иначе каждая глава и каждый рестарт «представляли» заново.
const INTRO_KEY = 'rtym_intro';
const introduced = new Set<string>();
try { for (const k of JSON.parse(localStorage.getItem(INTRO_KEY) ?? '[]') as unknown[]) introduced.add(String(k)); } catch { /* приватный режим — без памяти */ }
function markIntroduced(key: string) {
  introduced.add(key);
  try { localStorage.setItem(INTRO_KEY, JSON.stringify([...introduced])); } catch { /* ок */ }
}

// «привет, это —» : представляем врага стоп-кадром при первой встрече
export function introOnce(s: GameScene, key: string, name: MsgKey, line: MsgKey) {
  if (introduced.has(key)) return;
  markIntroduced(key);
  storyFrame(s, name, line);
}
