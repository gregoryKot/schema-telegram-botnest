import Phaser from 'phaser';
import { S } from './constants';

// Общие процедурные текстуры. Вызывается из BootScene, чтобы текстуры
// существовали в любой сцене (пролог запускается раньше глав).
export function makeCommonTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists('anxmob')) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const u = S, R = 11;
    g.fillStyle(0x6a2a8a, 0.35); g.fillCircle(R * u, R * u, R * u);
    g.fillStyle(0x3a1050, 1);    g.fillCircle(R * u, R * u, (R - 2) * u);
    g.fillStyle(0x551a78, 1);    g.fillCircle(R * u, (R - 1.5) * u, (R - 4) * u);
    g.fillStyle(0xffe066, 1);    g.fillCircle((R - 3) * u, R * u, 2 * u); g.fillCircle((R + 3) * u, R * u, 2 * u);
    g.fillStyle(0x1a0010, 1);    g.fillCircle((R - 3) * u, R * u, 1 * u); g.fillCircle((R + 3) * u, R * u, 1 * u);
    g.generateTexture('anxmob', R * 2 * u, R * 2 * u); g.destroy();
  }
  // 'alarm' теперь настоящий спрайт prop_alarm (см. props.ts)
  if (!scene.textures.exists('heartpk')) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const u = S;
    g.fillStyle(0xff5577, 0.25); g.fillCircle(7 * u, 7 * u, 8 * u);
    g.fillStyle(0xff3366, 1);
    g.fillCircle(4.5 * u, 5 * u, 3 * u); g.fillCircle(9.5 * u, 5 * u, 3 * u);
    g.fillTriangle(1.5 * u, 6 * u, 12.5 * u, 6 * u, 7 * u, 12.5 * u);
    g.fillStyle(0xffaacc, 0.9); g.fillCircle(5 * u, 4.5 * u, 1.2 * u);
    g.generateTexture('heartpk', 14 * u, 14 * u); g.destroy();
  }
}
