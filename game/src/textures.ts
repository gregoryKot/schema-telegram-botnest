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
  if (!scene.textures.exists('yarn')) {
    // клубок — Йоська отвлекается игрой, и мысли теряют к нему интерес
    const g = scene.make.graphics({ x: 0, y: 0 });
    const u = S, R = 6;
    g.fillStyle(0xff8aa6, 1); g.fillCircle(R * u, R * u, R * u);
    g.lineStyle(1.5, 0xd05a78, 1);
    g.beginPath(); g.arc(R * u, R * u, R * u * 0.65, 0.4, 2.6); g.strokePath();
    g.beginPath(); g.arc(R * u, R * u, R * u * 0.8, 3.4, 5.6); g.strokePath();
    g.beginPath(); g.arc(R * u * 1.2, R * u * 0.8, R * u * 0.5, 1.2, 3.6); g.strokePath();
    g.fillStyle(0xffc8d6, 1); g.fillCircle(R * u * 0.7, R * u * 0.7, 1.4 * u);
    g.generateTexture('yarn', R * 2 * u, R * 2 * u); g.destroy();
  }
  // Позы Йоськи, которых нет в спрайт-листах: сидит и играет лапой (2 кадра)
  // и понурая поза для «уступил». Рисуем в 48×48, низ как у cat_idle.
  const BLACK = 0x141418, EYE = 0xffaa33;
  const drawSitCat = (g: Phaser.GameObjects.Graphics, pawDown: boolean) => {
    g.fillStyle(BLACK, 1);
    g.fillEllipse(17, 36, 17, 19);                 // задняя часть, сидит
    g.fillEllipse(25, 28, 12, 16);                 // грудь, корпус приподнят
    g.fillCircle(29, 16, 7);                       // голова
    g.fillTriangle(23, 12, 27, 3, 29, 11);         // ухо
    g.fillTriangle(30, 11, 34, 4, 35, 13);         // ухо
    g.fillRect(14, 32, 5, 14);                     // задняя лапа
    g.fillRect(22, 34, 4, 12);                     // опорная передняя
    // хвост обёрнут вокруг
    g.fillEllipse(8, 43, 12, 5); g.fillEllipse(5, 40, 5, 8);
    // играющая лапа
    if (pawDown) { g.fillRect(30, 32, 4, 13); g.fillEllipse(33, 44, 6, 4); }
    else { g.fillEllipse(34, 27, 10, 4); g.fillEllipse(38, 26, 5, 5); }
    g.fillStyle(EYE, 1); g.fillRect(31, 14, 3, 3); // глаз — смотрит на клубок
    g.fillStyle(BLACK, 1); g.fillRect(32, 15, 1.6, 1.6);
  };
  if (!scene.textures.exists('cat_play0')) {
    let g = scene.make.graphics({ x: 0, y: 0 });
    drawSitCat(g, false); g.generateTexture('cat_play0', 48, 48); g.destroy();
    g = scene.make.graphics({ x: 0, y: 0 });
    drawSitCat(g, true); g.generateTexture('cat_play1', 48, 48); g.destroy();
  }
  if (!scene.textures.exists('cat_droop')) {
    // понуро: корпус низкий, голова опущена ниже плеч, уши прижаты, хвост висит
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(BLACK, 1);
    g.fillEllipse(22, 36, 26, 13);                 // низкий корпус
    g.fillCircle(34, 38, 6.4);                     // голова опущена
    g.fillTriangle(29, 35, 30, 30, 33, 33);        // прижатое ухо
    g.fillTriangle(35, 32, 38, 30, 38, 35);
    g.fillRect(13, 40, 4, 7); g.fillRect(29, 41, 4, 6); // лапы
    g.fillEllipse(8, 41, 10, 4);                   // хвост лежит
    g.fillStyle(EYE, 0.8); g.fillRect(36, 37, 2.4, 2); // полузакрытый глаз
    g.generateTexture('cat_droop', 48, 48); g.destroy();
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
