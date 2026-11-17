// Задник экранов вне глав (титул, обучение, экран смерти): стена и пол из арта глав в сетке ×2 —
// целый масштаб и на десктопе, и на таче, без дробного «k».
import Phaser from 'phaser';
import { W } from './constants';
import { GRID } from './gridScale';

const TILE = 16, MID = [1, 1, 4, 3]; // столбы пола без торцов (game/art/ground.py)

/** Стена комнаты гл.2 на всю ширину кадра, низом на линии пола. */
export function roomWall(scene: Phaser.Scene, floorY: number, depth: number): Phaser.GameObjects.TileSprite | null {
  if (!scene.textures.exists('bg_room_wall')) return null;
  const src = scene.textures.get('bg_room_wall').getSourceImage();
  return scene.add.tileSprite(0, floorY, W / GRID, src.height, 'bg_room_wall').setOrigin(0, 1).setScale(GRID).setDepth(depth);
}

/** Полоса пола от края до края кадра; key — лист `ground_*`. */
export function floorStrip(scene: Phaser.Scene, key: string, floorY: number, depth: number): Phaser.GameObjects.Image[] {
  if (!scene.textures.exists(key)) return [];
  const out: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i * TILE * GRID < W; i++)
    out.push(scene.add.image(i * TILE * GRID, floorY, key, MID[i % 4]).setOrigin(0, 0).setScale(GRID).setDepth(depth));
  return out;
}
