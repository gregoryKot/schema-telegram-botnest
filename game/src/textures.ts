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
  if (!scene.textures.exists('dog_col')) {
    // пёс-коллега: рыжий, крупный, вислые уши — точно не второй Йоська
    const g = scene.make.graphics({ x: 0, y: 0 });
    const u = S;
    g.fillStyle(0xc87f3a, 1); g.fillRoundedRect(2 * u, 12 * u, 22 * u, 13 * u, 4 * u);   // корпус
    g.fillStyle(0xc87f3a, 1); g.fillRoundedRect(16 * u, 2 * u, 11 * u, 11 * u, 3 * u);   // голова
    g.fillStyle(0xe8b87a, 1); g.fillRoundedRect(21 * u, 6 * u, 7 * u, 6 * u, 2 * u);     // морда
    g.fillStyle(0x1a0e06, 1); g.fillRect(26 * u, 7 * u, 2 * u, 2 * u);                   // нос
    g.fillStyle(0x9a5a22, 1); g.fillRoundedRect(15 * u, 1 * u, 4 * u, 9 * u, 2 * u);     // ухо вислое
    g.fillStyle(0x1a0e06, 1); g.fillRect(22 * u, 4.5 * u, 1.6 * u, 1.6 * u);             // глаз
    g.fillStyle(0xb06a28, 1);                                                            // лапы
    g.fillRect(4 * u, 24 * u, 4 * u, 4 * u); g.fillRect(18 * u, 24 * u, 4 * u, 4 * u);
    g.fillStyle(0xc87f3a, 1); g.fillRoundedRect(0, 10 * u, 4 * u, 8 * u, 2 * u);         // хвост
    g.generateTexture('dog_col', 28 * u, 28 * u); g.destroy();
  }
  if (!scene.textures.exists('cat_nei')) {
    // соседка: серая кошка с белой грудкой и розовым платком
    const g = scene.make.graphics({ x: 0, y: 0 });
    const u = S;
    g.fillStyle(0x9a9aa8, 1); g.fillRoundedRect(2 * u, 12 * u, 18 * u, 12 * u, 4 * u);   // корпус
    g.fillStyle(0xf0f0f0, 1); g.fillEllipse(7 * u, 18 * u, 7 * u, 8 * u);                // грудка
    g.fillStyle(0x9a9aa8, 1); g.fillRoundedRect(12 * u, 2 * u, 10 * u, 10 * u, 3 * u);   // голова
    g.fillStyle(0xd06a8a, 1);                                                            // платок
    g.fillTriangle(11 * u, 6 * u, 23 * u, 6 * u, 17 * u, 0);
    g.fillRect(11 * u, 5 * u, 12 * u, 2.4 * u);
    g.fillStyle(0x1a0e06, 1); g.fillRect(18.5 * u, 6.5 * u, 1.6 * u, 1.6 * u);           // глаз
    g.fillStyle(0xd08a9a, 1); g.fillRect(21.5 * u, 8 * u, 1.4 * u, 1 * u);               // носик
    g.fillStyle(0x8a8a98, 1);                                                            // лапы
    g.fillRect(4 * u, 23 * u, 3.4 * u, 4 * u); g.fillRect(14 * u, 23 * u, 3.4 * u, 4 * u);
    g.fillStyle(0x9a9aa8, 1); g.fillRoundedRect(0, 8 * u, 3.4 * u, 10 * u, 2 * u);       // хвост
    g.generateTexture('cat_nei', 24 * u, 27 * u); g.destroy();
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
