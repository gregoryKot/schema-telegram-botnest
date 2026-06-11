import Phaser from 'phaser';
import { W, H, GROUND_Y } from '../constants';
import { BaseLevelScene, LevelConfig } from './BaseLevelScene';

const GND_W = 32, GND_H = 64;
const PLT_W = 32;

const GROUND_GAPS = [
  { start: 1360, end: 1580 },
  { start: 2440, end: 2680 },
  { start: 3400, end: 3660 },
  { start: 4420, end: 4690 },
];

const PLATFORMS = [
  { x: 280,  w: 128, y: GROUND_Y - 72  },
  { x: 520,  w: 96,  y: GROUND_Y - 96  },
  { x: 740,  w: 96,  y: GROUND_Y - 112 },
  { x: 900,  w: 96,  y: GROUND_Y - 144 },
  { x: 1060, w: 96,  y: GROUND_Y - 96  },
  { x: 1200, w: 160, y: GROUND_Y - 64  },
  { x: 1580, w: 160, y: GROUND_Y - 64  },
  { x: 1810, w: 128, y: GROUND_Y - 96  },
  { x: 2000, w: 128, y: GROUND_Y - 128 },
  { x: 2160, w: 192, y: GROUND_Y - 64  },
  { x: 2680, w: 160, y: GROUND_Y - 64  },
  { x: 2880, w: 128, y: GROUND_Y - 96  },
  { x: 3050, w: 128, y: GROUND_Y - 80  },
  { x: 3220, w: 192, y: GROUND_Y - 64  },
  { x: 3660, w: 160, y: GROUND_Y - 64  },
  { x: 3870, w: 128, y: GROUND_Y - 112 },
  { x: 4060, w: 128, y: GROUND_Y - 80  },
  { x: 4240, w: 192, y: GROUND_Y - 64  },
  { x: 4690, w: 160, y: GROUND_Y - 64  },
  { x: 4900, w: 128, y: GROUND_Y - 96  },
  { x: 5100, w: 128, y: GROUND_Y - 64  },
  { x: 5350, w: 160, y: GROUND_Y - 96  },
  { x: 5600, w: 160, y: GROUND_Y - 72  },
  { x: 5850, w: 128, y: GROUND_Y - 48  },
];

export class CemeteryScene extends BaseLevelScene {
  constructor() { super('Cemetery'); }

  getLevelConfig(): LevelConfig {
    return {
      levelTitle: 'ГЛАВА 2',
      levelWidth: 8000,
      groundGaps: GROUND_GAPS,
      platforms: PLATFORMS,
      enemyDefs: [
        { id: 'anxiety',         x: 900,  angle:  12 },
        // procrastination on high platform — must jump up
        { id: 'procrastination', x: 2000, angle: -18, y: GROUND_Y - 128 - 20 },
        { id: 'phone',           x: 2880, angle:   8, y: GROUND_Y - 96 - 20 },
        { id: 'irritation',      x: 3900, angle:  22 },
        // selfcritic on platform
        { id: 'selfcritic',      x: 4900, angle: -10, y: GROUND_Y - 96 - 20 },
      ],
      sageX: 6200,
      doorX: 7100,
      nextScene: 'Dungeon',
      groundTileKey: 'cem_ground',
      groundTileW: GND_W,
      groundTileH: GND_H,
      platTileKey: 'cem_wall',
      platTileW: PLT_W,
    };
  }

  buildBackground() {
    // ── Night sky — fills entire screen ──────────────────────────────
    this.add.tileSprite(W / 2, H / 2, W, H + 200, 'bg_night_sky')
      .setScrollFactor(0).setDepth(-6);

    // ── Cemetery buildings — bottom edge AT ground level ──────────────
    // Moved DOWN so buildings appear around the player, not above them
    this.bgScrollLayer = this.add.tileSprite(W / 2, GROUND_Y + 8, W, 480, 'bg_cemetery_mid')
      .setOrigin(0.5, 1).setScrollFactor(0).setDepth(-5);

    // ── Graves layers — also at ground level ──────────────────────────
    this.add.tileSprite(W / 4,     GROUND_Y + 8, W / 2, 360, 'bg_graves1')
      .setOrigin(0.5, 1).setScrollFactor(0.12).setDepth(-4);
    this.add.tileSprite(W * 3 / 4, GROUND_Y + 8, W / 2, 360, 'bg_graves2')
      .setOrigin(0.5, 1).setScrollFactor(0.12).setDepth(-4);

    // ── Foreground bushes (world-space) ───────────────────────────────
    const bushXs = [220, 580, 1200, 1750, 2550, 3100, 3750, 4300, 5050, 5750, 6400];
    for (const bx of bushXs) {
      this.add.image(bx, GROUND_Y, 'cem_bush')
        .setOrigin(0.5, 1).setDepth(1)
        .setScale(Phaser.Math.FloatBetween(0.5, 0.8))
        .setTint(0x4a5533)
        .setCrop(0, 96, 224, 96);
    }

    // ── Statue near sage ──────────────────────────────────────────────
    this.add.image(6050, GROUND_Y, 'cem_statue')
      .setOrigin(0.5, 1).setDepth(3).setScale(1.4).setTint(0x7799aa);

    // ── Ground fog — atmospheric transition ───────────────────────────
    const fog = this.add.graphics().setScrollFactor(0).setDepth(-2);
    fog.fillGradientStyle(0x050818, 0x050818, 0x050818, 0x050818, 0, 0, 0.6, 0.6);
    fog.fillRect(0, GROUND_Y - 90, W, 95);

    // ── Ground fill — extends far down ───────────────────────────────
    const gnd = this.add.graphics().setScrollFactor(0).setDepth(-1);
    gnd.fillStyle(0x080d14, 1);
    gnd.fillRect(0, GROUND_Y - 4, W, H * 2);
  }
}
