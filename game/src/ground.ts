import Phaser from 'phaser';
import { GROUND_Y, H } from './constants';
import streetUrl from './assets/ground_street.png';
import roomUrl from './assets/ground_room.png';
import roadUrl from './assets/ground_road.png';

// Пол — листы game/art/ground.py: кадры 16×16 (0 левый край, 1 середина,
// 2 правый край, 3 толща, 4 вторая середина), показ ×2 — плотность пикселя как у мира.
export const GROUND_SHEETS: Record<string, string> = {
  ground_street: streetUrl,
  ground_room: roomUrl,
  ground_road: roadUrl,
};
const T = 16,
  K = 2,
  TW = T * K;

export function loadGround(scene: Phaser.Scene) {
  for (const [k, u] of Object.entries(GROUND_SHEETS))
    if (!scene.textures.exists(k))
      scene.load.spritesheet(k, u, { frameWidth: T, frameHeight: T });
}

export const groundKey = (theme: string) => `ground_${theme}`;

// Полоса пола [sx, ex]: кромка с краями у ям (edges=false — без торцов, пол до краёв
// экрана) и толща до низа кадра.
export function buildGroundStrip(
  scene: Phaser.Scene,
  key: string,
  sx: number,
  ex: number,
  depth: number,
  edges = true,
) {
  const w = ex - sx,
    n = Math.max(1, Math.floor(w / TW));
  for (let i = 0; i < n; i++) {
    const frame =
      edges && i === 0
        ? 0
        : edges && i === n - 1 && w - n * TW < 1
          ? 2
          : i % 3 === 2
            ? 4
            : 1;
    scene.add
      .image(sx + i * TW, GROUND_Y, key, frame)
      .setOrigin(0, 0)
      .setScale(K)
      .setDepth(depth);
  }
  if (w - n * TW >= 1)
    // остаток не кратен тайлу — правый край прижат к ex
    scene.add
      .image(ex - TW, GROUND_Y, key, edges ? 2 : 1)
      .setOrigin(0, 0)
      .setScale(K)
      .setDepth(depth);
  const deep = Math.ceil((H - GROUND_Y - TW) / TW) + 1; // +1 ряд — запас под тряску камеры
  scene.add
    .tileSprite(sx, GROUND_Y + TW, w / K, deep * T, key, 3)
    .setOrigin(0, 0)
    .setScale(K)
    .setDepth(depth);
}
