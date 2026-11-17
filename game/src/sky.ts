import Phaser from 'phaser';
import { GROUND_Y, W } from './constants';
import streetUrl from './assets/bg_street_sky.png';
import streetTouchUrl from './assets/bg_street_sky_touch.png';

// Небо-текстура главы (game/art/sky.py), показ ×2, с камерой не едет. Низ текстуры — на 8 px
// арта ниже земли: горизонт стоит на полу в любом кадре. У тач-кадра свой лист (`_touch`):
// над землёй там меньше места, полосы заката плотнее, солнце в кадре.
const SKIES: Record<string, string> = { bg_street_sky: streetUrl, bg_street_sky_touch: streetTouchUrl };
const DESK_W = 960;

export function loadSkies(scene: Phaser.Scene) {
  for (const [k, u] of Object.entries(SKIES)) if (!scene.textures.exists(k)) scene.load.image(k, u);
}

export function addSky(scene: Phaser.Scene, key: string) {
  const k = W < DESK_W && scene.textures.exists(`${key}_touch`) ? `${key}_touch` : key;
  return scene.add.image(0, GROUND_Y + 16, k).setOrigin(0, 1).setScale(2).setScrollFactor(0).setDepth(-9);
}
