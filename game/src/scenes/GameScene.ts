import Phaser from 'phaser';
import { W, H, GROUND_Y, S, LEVEL_W } from '../constants';
import { BaseLevelScene, LevelConfig, MovePlatDef, GateDef } from './BaseLevelScene';

const G = GROUND_Y;

// Pits — only in the first half, each crossed via a platform/mover (Mario-style).
// The second half is solid so the "irritation" fling stays survivable.
const GROUND_GAPS = [
  { start: 1160, end: 1380 },   // crossed via high island
  { start: 1980, end: 2180 },   // crossed via horizontal mover
  { start: 2900, end: 3080 },   // crossed via vertical elevator
];

const PLATFORMS = [
  // ── Morning — gentle intro, learn the jump ──────────────────────
  { x: 320,  w: 96,  y: G - 58  },
  { x: 470,  w: 96,  y: G - 98  },

  // ── After anxiety gate (700): staircase UP ──────────────────────
  { x: 820,  w: 80,  y: G - 70  },
  { x: 940,  w: 80,  y: G - 118 },
  { x: 1060, w: 80,  y: G - 166 },
  // High island crossing pit 1 (1160-1380)
  { x: 1250, w: 130, y: G - 150 },
  { x: 1450, w: 110, y: G - 64  },

  // ── After procrastination gate (1750): floating islands ─────────
  { x: 2240, w: 100, y: G - 110 },
  { x: 2400, w: 100, y: G - 160 },
  { x: 2560, w: 110, y: G - 80  },

  // ── After phone gate (2700): descent + steps ────────────────────
  { x: 3180, w: 110, y: G - 60  },
  { x: 3340, w: 130, y: G - 90  },

  // ── Irritation corridor (3650) is flat & safe ───────────────────
  { x: 4150, w: 110, y: G - 64  },

  // ── Late game: decorative platforms on solid ground ─────────────
  { x: 3900, w: 110, y: G - 100 },
  { x: 4300, w: 110, y: G - 70  },
];

const MOVE_PLATS: MovePlatDef[] = [
  // Horizontal mover bridging pit 2
  { x: 1980, w: 96, y: G - 80, axis: 'x', range: 90, speed: 1.3 },
  // Vertical elevator over pit 3
  { x: 2940, w: 96, y: G - 50, axis: 'y', range: 70, speed: 1.0 },
];

// Modes are UNAVOIDABLE. They come back faster near the end — escalation.
// "irritation" is last: it flings you, out of control, straight into the sage.
const MODE_GATES: GateDef[] = [
  { id: 'anxiety',         x: 700  },
  { id: 'procrastination', x: 1750 },
  { id: 'phone',           x: 2700 },
  { id: 'selfcritic',      x: 3350 },
  // they keep coming back, closer together now:
  { id: 'anxiety',         x: 3950 },
  { id: 'procrastination', x: 4450 },
  { id: 'irritation',      x: 4950 },  // → carries you into the realization
];

export class GameScene extends BaseLevelScene {
  constructor() { super('Game'); }

  getLevelConfig(): LevelConfig {
    return {
      levelTitle: 'ОБЫЧНЫЙ ДЕНЬ',
      levelWidth: LEVEL_W,
      groundGaps: GROUND_GAPS,
      platforms: PLATFORMS,
      movePlats: MOVE_PLATS,
      modeGates: MODE_GATES,
      enemyDefs: [],          // no more dodgeable pills
      darkenOnProgress: true, // morning → night as the day grinds on
      sageX: 5650,
      doorX: 6200,
      nextScene: 'Cemetery',
      groundTileKey: 'ground',
      groundTileW: 16 * S,
      groundTileH: 16 * S,
      platTileKey: 'plat',
      platTileW: 16 * S,
    };
  }

  buildBackground() {
    // ── Sky ──────────────────────────────────────────────────────────
    const skyTop = this.add.graphics().setScrollFactor(0).setDepth(-8);
    skyTop.fillGradientStyle(0x0d1b3e, 0x0d1b3e, 0x1a3a6c, 0x1a3a6c, 1, 1, 1, 1);
    skyTop.fillRect(0, 0, W, G * 0.45);
    const skyBot = this.add.graphics().setScrollFactor(0).setDepth(-8);
    skyBot.fillGradientStyle(0x1a3a6c, 0x1a3a6c, 0xff8833, 0xff8833, 1, 1, 1, 1);
    skyBot.fillRect(0, G * 0.45, W, G * 0.55 + 4);

    // ── Sun ───────────────────────────────────────────────────────────
    const sun = this.add.graphics().setScrollFactor(0).setDepth(-7);
    const sx = W * 0.72, sy = G - 105;
    sun.fillStyle(0xffffff, 0.04); sun.fillCircle(sx, sy, 100);
    sun.fillStyle(0xffee88, 0.09); sun.fillCircle(sx, sy, 75);
    sun.fillStyle(0xffcc44, 0.18); sun.fillCircle(sx, sy, 52);
    sun.fillStyle(0xffdd00, 0.65); sun.fillCircle(sx, sy, 30);
    sun.fillStyle(0xffffff, 1);    sun.fillCircle(sx, sy, 18);

    // ── Clouds ────────────────────────────────────────────────────────
    const drawCloud = (g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, a: number) => {
      g.fillStyle(0xffeedd, a);
      g.fillEllipse(cx, cy, r * 2.2, r * 0.9);
      g.fillEllipse(cx - r*0.5, cy + r*0.15, r * 1.3, r * 0.7);
      g.fillEllipse(cx + r*0.5, cy + r*0.1, r * 1.4, r * 0.65);
      g.fillEllipse(cx, cy - r*0.3, r * 1.0, r * 0.6);
    };
    const c1 = this.add.graphics().setScrollFactor(0.015).setDepth(-6);
    drawCloud(c1, 140, 60, 42, 0.50); drawCloud(c1, 680, 80, 55, 0.40); drawCloud(c1, 900, 35, 35, 0.45);

    // ── Birds ─────────────────────────────────────────────────────────
    const birds = this.add.graphics().setScrollFactor(0.04).setDepth(-5);
    birds.fillStyle(0x2a1000, 0.75);
    for (const [bx, by] of [[180,105],[205,96],[560,72],[580,65],[880,115],[902,106]] as number[][])
      birds.fillTriangle(bx, by, bx+9, by-6, bx+18, by);

    // ── Mountains ─────────────────────────────────────────────────────
    const mtn1 = this.add.graphics().setScrollFactor(0.06).setDepth(-5);
    mtn1.fillStyle(0x2a3d55, 0.7);
    const farPeaks = [[-20,160],[80,240],[180,195],[290,255],[420,185],[550,240],[660,195],[780,250],[900,180],[1000,235],[1060,200]];
    for (let i = 0; i < farPeaks.length - 1; i++) {
      const [ax, ah] = farPeaks[i], [bx, bh] = farPeaks[i+1];
      mtn1.fillTriangle(ax, G, bx, G, (ax+bx)/2, G - Math.max(ah, bh));
    }
    mtn1.fillStyle(0xeef4ff, 0.55);
    for (let i = 0; i < farPeaks.length - 1; i++) {
      const mx = (farPeaks[i][0]+farPeaks[i+1][0])/2, mh = Math.max(farPeaks[i][1], farPeaks[i+1][1]);
      const ty = G - mh, sz = 18;
      mtn1.fillTriangle(mx, ty, mx - sz, ty + sz*1.2, mx + sz, ty + sz*1.2);
    }
    const mtn2 = this.add.graphics().setScrollFactor(0.15).setDepth(-4);
    mtn2.fillStyle(0x3a5020, 0.75);
    const nearPeaks = [[-20,110],[100,160],[220,130],[360,170],[500,120],[640,165],[780,140],[920,160],[1060,115]];
    for (let i = 0; i < nearPeaks.length - 1; i++) {
      const [ax, ah] = nearPeaks[i], [bx, bh] = nearPeaks[i+1];
      mtn2.fillTriangle(ax, G, bx, G, (ax+bx)/2, G - Math.max(ah, bh));
    }

    // ── Horizon haze ─────────────────────────────────────────────────
    const haze = this.add.graphics().setScrollFactor(0).setDepth(-3);
    haze.fillGradientStyle(0xff9944, 0xff9944, 0xaa5522, 0xaa5522, 0.28, 0.28, 0, 0);
    haze.fillRect(0, G - 100, W, 70);

    // ── Trees ─────────────────────────────────────────────────────────
    const trees = this.add.graphics().setScrollFactor(0.55).setDepth(-2);
    const drawTree = (tx: number, h: number, col: number) => {
      trees.fillStyle(0x2a1006, 1); trees.fillRect(tx - 4, G - h*0.38, 8, h*0.38);
      trees.fillStyle(col, 1);
      trees.fillTriangle(tx, G - h, tx - h*0.42, G - h*0.38, tx + h*0.42, G - h*0.38);
      trees.fillTriangle(tx, G - h*0.75, tx - h*0.48, G - h*0.3, tx + h*0.48, G - h*0.3);
      trees.fillStyle(0x000000, 0.18);
      trees.fillTriangle(tx + h*0.08, G-h, tx + h*0.42, G-h*0.38, tx + h*0.42, G-h*0.65);
    };
    for (const [tx, th, col] of [[75,88,0x1d5c0a],[195,108,0x226611],[435,93,0x1a5208],[595,118,0x265c0d],[748,84,0x1e5a0b],[916,102,0x1d5210]] as [number,number,number][])
      drawTree(tx, th, col);

    // ── Ground fill ──────────────────────────────────────────────────
    const gnd = this.add.graphics().setScrollFactor(0).setDepth(-1);
    gnd.fillGradientStyle(0x3a7a18, 0x3a7a18, 0x5a2a12, 0x5a2a12, 0.6, 0.6, 0, 0);
    gnd.fillRect(0, G - 4, W, 14);
    gnd.fillStyle(0x3d1a08, 1);
    gnd.fillRect(0, G + 10, W, H * 2);
  }
}
