import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { StartScene } from './scenes/StartScene';
import { IntroScene } from './scenes/IntroScene';
import { TutorialScene } from './scenes/TutorialScene';
import { GameScene } from './scenes/GameScene';
import { setupMenu } from './menu';
import { initTouchControls } from './controls';
import { initAnalytics } from './analytics';
import { audio } from './audio';
import { W, H, PHYS } from './constants';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game-container',
  pixelArt: true,
  backgroundColor: '#0a0a14',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: PHYS.gravity },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H,
  },
  scene: [BootScene, StartScene, IntroScene, TutorialScene, GameScene],
};

// Стартуем после загрузки пиксельного шрифта — иначе Phaser отрендерит
// тексты системным. Страховка по таймауту: без шрифта, но не висим.
let started = false;
function start() {
  if (started) return;
  started = true;
  const game = new Phaser.Game(config);
  (window as any).__game = game;
  setupMenu(game);
  initTouchControls();
  initAnalytics();
  audio.unlockOnFirstGesture(); // тач-кнопки — HTML вне канваса; ловим жест на документе
  loadHeavySprites(game);       // тяжёлые спрайты — в фоне, не блокируя меню
}

// Догружаем тяжёлые спрайты отдельным чанком, пока пользователь в меню/интро.
// Кладём прямо в глобальный TextureManager (общий для всех сцен). Сцены, если
// спрайт ещё не доехал, создают анимацию при первом использовании (safeAnim).
function loadHeavySprites(game: Phaser.Game) {
  import('./sprites-heavy')
    .then(({ HEAVY_SHEETS }) => {
      for (const [key, s] of Object.entries(HEAVY_SHEETS)) {
        if (game.textures.exists(key)) continue;
        const img = new Image();
        img.onload = () => {
          if (!game.textures.exists(key))
            game.textures.addSpriteSheet(key, img, { frameWidth: s.fw, frameHeight: s.fh });
        };
        img.src = s.url; // data-URI из чанка — без сетевого запроса
      }
    })
    .catch(() => { /* чанк не доехал — safeAnim guard'ы покроют */ });
}

Promise.all([
  document.fonts.load('16px "Press Start 2P"', 'Йо'),
  document.fonts.load('16px "Press Start 2P"', 'RUN'),
]).then(start, start);
setTimeout(start, 2000);
