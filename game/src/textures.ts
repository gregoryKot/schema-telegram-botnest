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
  if (!scene.textures.exists('alarm')) {
    // будильник: латунный корпус, два колокольчика, молоточек, циферблат, ножки
    const g = scene.make.graphics({ x: 0, y: 0 });
    const u = S;
    g.fillStyle(0x1a0e06, 1);                                   // ножки
    g.fillRect(5 * u, 26 * u, 3 * u, 4 * u); g.fillRect(20 * u, 26 * u, 3 * u, 4 * u);
    g.fillStyle(0xd8a020, 1); g.fillCircle(14 * u, 16 * u, 11 * u);  // корпус
    g.fillStyle(0xb07a10, 1); g.fillCircle(14 * u, 16 * u, 11 * u); g.fillCircle(14 * u, 16 * u, 9.5 * u);
    g.fillStyle(0xf0e8d0, 1); g.fillCircle(14 * u, 16 * u, 8 * u);   // циферблат
    g.fillStyle(0x2a1d10, 1);                                        // стрелки
    g.fillRect(13.2 * u, 10 * u, 1.6 * u, 7 * u); g.fillRect(14 * u, 15 * u, 5 * u, 1.6 * u);
    g.fillStyle(0x2a1d10, 1); g.fillCircle(14 * u, 16 * u, 1.2 * u);
    g.fillStyle(0xd8a020, 1);                                        // колокольчики
    g.fillCircle(6 * u, 5 * u, 4 * u); g.fillCircle(22 * u, 5 * u, 4 * u);
    g.fillStyle(0xf0d870, 1); g.fillCircle(5 * u, 4 * u, 1.4 * u); g.fillCircle(21 * u, 4 * u, 1.4 * u);
    g.fillStyle(0x1a0e06, 1); g.fillRect(13 * u, 1 * u, 2 * u, 4 * u); // молоточек
    g.generateTexture('alarm', 28 * u, 32 * u); g.destroy();
  }
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
