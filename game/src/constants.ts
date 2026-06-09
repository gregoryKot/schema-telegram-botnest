export const W = 960;
export const H = 540;
export const GROUND_Y = H - 110; // 430  — персонаж ~12% высоты как Марио
export const S = 2; // pixel art scale

// World width for level 1.1
export const LEVEL_W = 7000;

// Colours (0xRRGGBB for Phaser) — morning / warm sunrise theme
export const C = {
  sky1:     0x2a6fa8,   // morning blue top
  sky2:     0xffa040,   // sunrise orange horizon
  ground:   0x6b3a1e,   // warm earth
  groundH:  0xb06030,   // bright earth edge
  plat:     0xcc6622,   // terracotta platform
  platH:    0xffaa44,   // bright top edge
  player:   0xfff0d8,
  shirt:    0xff5533,   // red-orange accent
  shoes:    0x442211,
  hair:     0x8b4010,
  eye:      0x220800,
  anxiety:  0xff6b6b,
  anxDark:  0xcc2222,
  phone:    0x6a9aff,
  phoneDk:  0x3a5acc,
  irritate: 0xff9a4a,
  irritDk:  0xcc5500,
  sage:     0xffd080,   // warm gold sage
  sageDk:   0xcc8830,
  sweat:    0xffcc88,
  star:     0xffffff,
  vignette: 0x1a0800,
};

export const PHYS = {
  gravity:      900,   // чуть сильнее для чёткого ощущения веса
  jumpVel:     -480,   // px/s
  playerSpeed:  260,   // px/s
  enemyPatrol:  100,   // px either side of base
  enemySpeed:    70,   // px/s
  respawnDelay: 3500,  // ms
};
