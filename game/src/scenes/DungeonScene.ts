import Phaser from 'phaser';
import { W, H, GROUND_Y } from '../constants';
import { BaseLevelScene, LevelConfig } from './BaseLevelScene';

// Dungeon tile dimensions (actual PNG sizes)
const GND_W = 48, GND_H = 48;
const PLT_W = 48;

// Hardest layout — 5 gaps, tighter jumps
const GROUND_GAPS = [
  { start: 1200, end: 1430 },    // 230 px
  { start: 2350, end: 2590 },    // 240 px
  { start: 3300, end: 3580 },    // 280 px — double-platform crossing
  { start: 4300, end: 4580 },    // 280 px
  { start: 5300, end: 5570 },    // 270 px
];

const PLATFORMS = [
  // Tunnel start
  { x: 240,  w: 144, y: GROUND_Y - 80  },
  { x: 480,  w: 96,  y: GROUND_Y - 120 },
  { x: 680,  w: 96,  y: GROUND_Y - 80  },

  // Anxiety zone (x=850)
  { x: 860,  w: 96,  y: GROUND_Y - 112 },
  { x: 1010, w: 144, y: GROUND_Y - 64  }, // launch to gap 1

  // After gap 1 → procrastination (x=1600)
  { x: 1430, w: 144, y: GROUND_Y - 64  }, // landing
  { x: 1650, w: 96,  y: GROUND_Y - 96  },
  { x: 1820, w: 96,  y: GROUND_Y - 128 },
  { x: 2000, w: 144, y: GROUND_Y - 80  },
  { x: 2170, w: 192, y: GROUND_Y - 64  }, // launch to gap 2

  // After gap 2 → phone (x=2750)
  { x: 2590, w: 144, y: GROUND_Y - 64  }, // landing
  { x: 2800, w: 96,  y: GROUND_Y - 96  },
  { x: 2970, w: 96,  y: GROUND_Y - 128 },
  { x: 3120, w: 192, y: GROUND_Y - 64  }, // launch to gap 3

  // Gap 3 is 280px — needs mid-air stepping stone
  { x: 3420, w: 96,  y: GROUND_Y - 80  }, // mid-gap platform! (inside gap at x=3420)
  // After gap 3 → irritation (x=3750)
  { x: 3580, w: 144, y: GROUND_Y - 64  }, // landing
  { x: 3800, w: 96,  y: GROUND_Y - 96  },
  { x: 3980, w: 96,  y: GROUND_Y - 128 },
  { x: 4130, w: 192, y: GROUND_Y - 64  }, // launch to gap 4

  // After gap 4 → selfcritic (x=4750)
  { x: 4580, w: 144, y: GROUND_Y - 64  }, // landing
  { x: 4790, w: 96,  y: GROUND_Y - 96  },
  { x: 4960, w: 96,  y: GROUND_Y - 80  },
  { x: 5130, w: 192, y: GROUND_Y - 64  }, // launch to gap 5

  // Gap 5 is 270px — mid stepping stone
  { x: 5420, w: 96,  y: GROUND_Y - 80  }, // mid-gap (inside gap x=5420)
  // After gap 5 → sage
  { x: 5570, w: 144, y: GROUND_Y - 64  }, // landing
  { x: 5800, w: 128, y: GROUND_Y - 96  },
  { x: 6050, w: 160, y: GROUND_Y - 72  },
  { x: 6300, w: 160, y: GROUND_Y - 48  },
];

export class DungeonScene extends BaseLevelScene {
  private torches: Array<{ x: number; y: number; gfx: Phaser.GameObjects.Graphics }> = [];

  constructor() { super('Dungeon'); }

  getLevelConfig(): LevelConfig {
    return {
      levelTitle: 'ГЛАВА 3',
      levelWidth: 9000,
      groundGaps: GROUND_GAPS,
      platforms: PLATFORMS,
      enemyDefs: [
        { id: 'anxiety',         x: 850,   angle: -10 },
        { id: 'procrastination', x: 1750,  angle:  20 },
        { id: 'phone',           x: 2870,  angle:  -8 },
        { id: 'irritation',      x: 3870,  angle:  25 },
        { id: 'selfcritic',      x: 4900,  angle: -12 },
      ],
      sageX: 6900,
      doorX: 7900,
      nextScene: null,   // Последняя глава
      groundTileKey: 'dun_ground',
      groundTileW: GND_W,
      groundTileH: GND_H,
      platTileKey: 'dun_wall',
      platTileW: PLT_W,
    };
  }

  buildBackground() {
    // Solid dark background
    this.add.rectangle(W / 2, H / 2, W, H, 0x050508).setScrollFactor(0).setDepth(-6);

    // Dungeon wall tiles tiled as background (slow parallax)
    this.bgScrollLayer = this.add.tileSprite(W / 2, GROUND_Y / 2, W, GROUND_Y, 'dun_wall')
      .setScrollFactor(0).setDepth(-5).setAlpha(0.35).setTint(0x334466);

    // Dark dungeon room texture strip
    this.add.tileSprite(W / 2, 48, W, 96, 'dun_room')
      .setScrollFactor(0.05).setDepth(-4).setAlpha(0.5).setTint(0x223355);

    // Ceiling strip
    const ceil = this.add.graphics().setScrollFactor(0).setDepth(-3);
    ceil.fillStyle(0x0a0a14, 1);
    ceil.fillRect(0, 0, W, 40);
    // Dripping stalactites hint
    ceil.fillStyle(0x111122, 1);
    for (let x = 30; x < W; x += 60)
      ceil.fillTriangle(x, 40, x + 10, 40, x + 5, 40 + Phaser.Math.Between(8, 22));

    // Floor fill — extends far down for any screen size
    const flr = this.add.graphics().setScrollFactor(0).setDepth(-1);
    flr.fillStyle(0x05050a, 1);
    flr.fillRect(0, GROUND_Y - 4, W, H * 2);

    // Torches — glowing spots in world space
    const torchXs = [400, 900, 1500, 2100, 2700, 3200, 3900, 4400, 5000, 5600, 6200, 6800, 7400];
    for (const tx of torchXs) this.addTorch(tx, GROUND_Y - 60);

    // Ambient vignette
    const vig = this.add.graphics().setScrollFactor(0).setDepth(50).setAlpha(0.4);
    vig.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.9, 0.9, 0, 0);
    vig.fillRect(0, 0, 80, H);
    vig.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.9, 0.9);
    vig.fillRect(W - 80, 0, 80, H);
  }

  private addTorch(worldX: number, worldY: number) {
    // Draw torch glow in world space (scrolls with camera)
    const gfx = this.add.graphics().setDepth(3);

    // Outer glow (large soft radius)
    gfx.fillStyle(0xff6600, 0.04); gfx.fillCircle(worldX, worldY, 90);
    gfx.fillStyle(0xff8800, 0.08); gfx.fillCircle(worldX, worldY, 55);
    gfx.fillStyle(0xffaa44, 0.15); gfx.fillCircle(worldX, worldY, 30);

    // Torch body
    gfx.fillStyle(0x884400, 1); gfx.fillRect(worldX - 3, worldY, 6, 18);
    // Flame core
    gfx.fillStyle(0xffdd00, 0.9); gfx.fillTriangle(worldX, worldY - 14, worldX - 5, worldY, worldX + 5, worldY);
    gfx.fillStyle(0xff8800, 0.7); gfx.fillTriangle(worldX, worldY - 20, worldX - 4, worldY - 6, worldX + 4, worldY - 6);

    // Animate flicker
    this.tweens.add({
      targets: gfx, alpha: 0.75, scaleX: 0.95, scaleY: 1.05,
      duration: 120 + Phaser.Math.Between(0, 80),
      yoyo: true, repeat: -1, ease: 'Sine.InOut',
    });

    this.torches.push({ x: worldX, y: worldY, gfx });
  }
}
