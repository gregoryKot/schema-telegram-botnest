import Phaser from 'phaser';
import { SCENES } from './scenes';
import { setupMenu } from './menu';
import { initTouchControls } from './controls';
import { initAnalytics } from './analytics';
import { audio } from './audio';
import { pauseInPortrait } from './rotate';
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
  scene: SCENES,
};

// Стартуем после загрузки пиксельного шрифта — иначе Phaser отрендерит
// тексты системным. Страховка по таймауту: без шрифта, но не висим.
let started = false;
function start() {
  if (started) return;
  started = true;
  const game = new Phaser.Game(config);
  (window as unknown as { __game: Phaser.Game }).__game = game;
  setupMenu(game);
  initTouchControls();
  pauseInPortrait(game);
  initAnalytics();
  audio.unlockOnFirstGesture(); // тач-кнопки — HTML вне канваса; ловим жест на документе
}

Promise.all([
  document.fonts.load('16px "Press Start 2P"', 'Йо'),
  document.fonts.load('16px "Press Start 2P"', 'RUN'),
  document.fonts.load('500 16px "Handjet"', 'Йо'),
  document.fonts.load('700 16px "Handjet"', 'Йо'),
]).then(start, start);
setTimeout(start, 2000);
