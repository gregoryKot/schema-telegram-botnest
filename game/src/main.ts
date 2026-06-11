import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { StartScene } from './scenes/StartScene';
import { IntroScene } from './scenes/IntroScene';
import { GameScene } from './scenes/GameScene';
import { CemeteryScene } from './scenes/CemeteryScene';
import { DungeonScene } from './scenes/DungeonScene';
import { Level1Scene } from './scenes/Level1Scene';
import { setupMenu } from './menu';
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
  scene: [BootScene, StartScene, IntroScene, GameScene, CemeteryScene, DungeonScene, Level1Scene],
};

const game = new Phaser.Game(config);
(window as any).__game = game;
setupMenu(game);
