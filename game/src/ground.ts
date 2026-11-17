import Phaser from 'phaser';
import { GROUND_Y } from './constants';
import streetUrl from './assets/ground_street.png';
import roomUrl from './assets/ground_room.png';
import roadUrl from './assets/ground_road.png';

// Пол — листы game/art/ground.py: столбы 16×64 на всю толщу до низа кадра (0 левый край,
// 1/3/4 середины, 2 правый край, 5 — темнота ямы, если тема её рисует), показ ×2.
export const GROUND_SHEETS: Record<string, string> = {
  ground_street: streetUrl,
  ground_room: roomUrl,
  ground_road: roadUrl,
};
const T = 16,
  DEEP = 64,
  K = 2,
  TW = T * K,
  MID = [1, 1, 4, 3];

export function loadGround(scene: Phaser.Scene) {
  for (const [k, u] of Object.entries(GROUND_SHEETS))
    if (!scene.textures.exists(k))
      scene.load.spritesheet(k, u, { frameWidth: T, frameHeight: DEEP });
}

export const groundKey = (theme: string) => `ground_${theme}`;

// Полоса пола [sx, ex]: края у ям (edges=false — без торцов, пол до краёв экрана).
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
  const put = (x: number, frame: number) =>
    scene.add.image(x, GROUND_Y, key, frame).setOrigin(0, 0).setScale(K).setDepth(depth);
  for (let i = 0; i < n; i++)
    put(sx + i * TW, edges && i === 0 ? 0 : edges && i === n - 1 && w - n * TW < 1 ? 2 : MID[i % 4]);
  // остаток не кратен тайлу — правый край прижат к ex
  if (w - n * TW >= 1) put(ex - TW, edges ? 2 : 1);
}

// Темнота ям: одна лента под полом на всю арену — видна только там, где пола нет.
export function buildPits(scene: Phaser.Scene, key: string, arenaW: number, depth: number) {
  if (!scene.textures.get(key).has('5')) return;
  scene.add.tileSprite(0, GROUND_Y, arenaW / K, DEEP, key, 5).setOrigin(0, 0).setScale(K).setDepth(depth);
}
