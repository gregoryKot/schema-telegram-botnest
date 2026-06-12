import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { StartScene } from './scenes/StartScene';
import { IntroScene } from './scenes/IntroScene';
import { TutorialScene } from './scenes/TutorialScene';
import { GameScene } from './scenes/GameScene';
import { setupMenu } from './menu';
import { initTouchControls } from './controls';
import { initAnalytics } from './analytics';
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
}

Promise.all([
  document.fonts.load('16px "Press Start 2P"', 'Йо'),
  document.fonts.load('16px "Press Start 2P"', 'RUN'),
]).then(start, start);
setTimeout(start, 2000);
