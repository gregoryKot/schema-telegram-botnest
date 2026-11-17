import Phaser from 'phaser';
import { GRID } from './gridScale';

// Реквизит в сетке ×2 (game/art/furniture.py, bedroom.py, room.py): низ спрайта — линия пола, масштаб целый.
export function placeGrid(
  scene: Phaser.Scene, key: string, x: number, floorY: number, depth: number, frame?: number,
): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(key)) return null;
  return scene.add.image(Math.round(x / GRID) * GRID, floorY, key, frame).setOrigin(0.5, 1).setScale(GRID).setDepth(depth);
}
