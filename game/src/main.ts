import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { StartScene } from './scenes/StartScene';
import { IntroScene } from './scenes/IntroScene';
import { GameScene } from './scenes/GameScene';
import { W, H, PHYS } from './constants';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game-container',
  pixelArt: true,
  backgroundColor: '#1a0800',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: PHYS.gravity },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.EXPAND,
    width: W,
    height: H,
  },
  scene: [BootScene, StartScene, IntroScene, GameScene],
};

new Phaser.Game(config);
