import Phaser from 'phaser';
import { GROUND_Y, W } from './constants';

// Небо-текстура главы (game/art/sky.py, road.py), показ ×2, с камерой не едет. Низ текстуры — на 8 px
// арта ниже земли: горизонт стоит на полу в любом кадре. У тач-кадра свой лист (`_touch`):
// над землёй там меньше места, полосы неба плотнее, солнце в кадре. Ключ — имя файла без .png.
const FILES = import.meta.glob<string>('./assets/bg_*_sky*.png', { eager: true, query: '?url', import: 'default' });
const SKIES = Object.entries(FILES).map(([p, u]) => [p.slice(p.lastIndexOf('/') + 1, -4), u] as const);
const DESK_W = 960;

export function loadSkies(scene: Phaser.Scene) {
  for (const [k, u] of SKIES) if (!scene.textures.exists(k)) scene.load.image(k, u);
}

export function addSky(scene: Phaser.Scene, key: string) {
  const k = W < DESK_W && scene.textures.exists(`${key}_touch`) ? `${key}_touch` : key;
  return scene.add.image(0, GROUND_Y + 16, k).setOrigin(0, 1).setScale(2).setScrollFactor(0).setDepth(-9);
}
