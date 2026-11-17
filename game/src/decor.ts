import Phaser from 'phaser';
import { GROUND_Y, W } from './constants';
import { ChapterConfig } from './chapters';
import { placeProp, LAMP_W } from './props';
import { buildRoom } from './room';
import { addGlow } from './look';
import { loadSkies } from './sky';
import { lampSpots } from './lampSpots';
import farUrl from './assets/bg_street_far.png';
import midUrl from './assets/bg_street_mid.png';
import nearUrl from './assets/bg_street_near.png';

// Декорации — характер уровня: гл.1 — улица на закате (слои пиксель-арта, фонари), гл.2 — комната.
export function buildDecor(scene: Phaser.Scene, ch: ChapterConfig) {
  if (ch.theme === 'room') buildRoom(scene, ch);
  else if (ch.theme === 'road') buildRoad(scene, ch);
  else buildStreet(scene, ch);
}

// ── Дорога в терапию: город остаётся позади, впереди — открытая трасса к светлому
// горизонту: указатели, столбы, редкие деревья. Не как глава 1 — тут простор и путь.
function buildRoad(scene: Phaser.Scene, ch: ChapterConfig) {
  // светлая полоса рассвета у горизонта впереди — «есть куда идти»
  addGlow(scene, W * 0.78, GROUND_Y - 40, W * 1.1, 220, 0xffe6b0, 0.16, -8.5).setScrollFactor(0);

  // город позади — далёкие мелкие силуэты, РЕДЕЮТ к правому краю (уходим из него)
  const far = scene.add.container(0, 0).setScrollFactor(0.18).setDepth(-7);
  const farW = ch.arenaW * 0.18 + W;
  let x = -60;
  while (x < farW) {
    const t = x / farW;                                   // 0 слева (плотно) → 1 справа (пусто)
    if (Math.random() > t * 0.9) {                        // правее — реже
      const h = Phaser.Math.Between(50, 130) * (1 - t * 0.5), bw = Phaser.Math.Between(40, 80);
      const g = scene.add.graphics();
      g.fillStyle(0x2a2444, 0.8); g.fillRect(x, GROUND_Y - h, bw, h);
      far.add(g);
    }
    x += Phaser.Math.Between(60, 150);
  }

  // телеграфные столбы вдоль дороги — уходят вдаль (паралакс ближе)
  const poles = scene.add.container(0, 0).setScrollFactor(0.6).setDepth(-3);
  for (let px = 200; px < ch.arenaW * 0.6; px += 360) {
    const g = scene.add.graphics();
    g.fillStyle(0x3a3052, 1); g.fillRect(px, GROUND_Y - 150, 6, 150);
    g.fillRect(px - 18, GROUND_Y - 142, 42, 6);           // перекладина
    g.lineStyle(1, 0x5a4a72, 0.5); g.lineBetween(px + 3, GROUND_Y - 139, px + 360, GROUND_Y - 139); // провод
    poles.add(g);
  }

  // указатели «вперёд» + редкие деревья на земле
  for (let sx = 480; sx < ch.arenaW - 200; sx += 700) {
    signpost(scene, sx);
    tree(scene, sx + 320);
  }

  // дорожная разметка — пунктир по центру (иначе чем бордюр главы 1)
  const road = scene.add.graphics().setDepth(3);
  road.fillStyle(0xd8c8a0, 0.16);
  for (let cx = 0; cx < ch.arenaW; cx += 96) road.fillRect(cx, GROUND_Y - 3, 52, 3);
}

// столб-указатель со стрелкой вперёд (путь к терапии)
function signpost(scene: Phaser.Scene, x: number) {
  const g = scene.add.graphics().setDepth(4);
  g.fillStyle(0x4a3a2a, 1); g.fillRect(x, GROUND_Y - 120, 7, 120);          // столб
  g.fillStyle(0x3a6a8a, 1);                                                 // табличка
  g.fillRect(x - 38, GROUND_Y - 122, 56, 24);
  g.fillTriangle(x + 18, GROUND_Y - 122, x + 18, GROUND_Y - 98, x + 40, GROUND_Y - 110); // стрелка →
  g.fillStyle(0x9fd8ff, 0.9); g.fillRect(x - 30, GROUND_Y - 112, 38, 4);    // «текст»
}

// простое дерево-силуэт у обочины
function tree(scene: Phaser.Scene, x: number) {
  const g = scene.add.graphics().setDepth(2);
  g.fillStyle(0x2e2a1e, 1); g.fillRect(x - 4, GROUND_Y - 56, 8, 56);        // ствол
  g.fillStyle(0x35422e, 1); g.fillCircle(x, GROUND_Y - 64, 28);            // крона
  g.fillStyle(0x3f5036, 1); g.fillCircle(x - 12, GROUND_Y - 60, 18); g.fillCircle(x + 14, GROUND_Y - 58, 16);
}

// ── Улица: три слоя пиксель-арта (game/art/street.py, near.py) + фонари вдоль дороги ──
const STREET_LAYERS: [string, string, number, number][] = [
  ['bg_street_far', farUrl, 0.15, -7], ['bg_street_mid', midUrl, 0.4, -6], ['bg_street_near', nearUrl, 0.75, -4],
];
export function loadStreetLayers(scene: Phaser.Scene) { // data-URI, грузит BootScene
  for (const [key, url] of STREET_LAYERS) if (!scene.textures.exists(key)) scene.load.image(key, url);
  loadSkies(scene);
}
function buildStreet(scene: Phaser.Scene, ch: ChapterConfig) {
  for (const [key, , sf, depth] of STREET_LAYERS) {
    if (!scene.textures.exists(key)) continue;
    const src = scene.textures.get(key).getSourceImage();
    const w = (ch.arenaW * sf + W + 64) / 2; // ширина в пикселях текстуры, показ ×2
    scene.add.tileSprite(-32, GROUND_Y, w, src.height, key).setOrigin(0, 1).setScale(2)
      .setScrollFactor(sf, 1).setDepth(depth); // по вертикали слой стоит на земле
  }
  // фонари: свет — в спрайте (game/art/light.py)
  for (const lx of lampSpots(ch.arenaW, ch.pits)) placeProp(scene, 'prop_streetlamp', lx, GROUND_Y, LAMP_W, 4);
}
