import Phaser from 'phaser';
import { GROUND_Y, W } from './constants';
import { ChapterConfig } from './chapters';
import { placeProp } from './props';

// ════════════════════════════════════════════════════════════════════════════
//  Декорации — характер уровня. Глава 1 — вечерняя улица (дома, фонари),
//  глава 2 — комната (обои, окна, диван, телевизор, торшер). Всё процедурно.
// ════════════════════════════════════════════════════════════════════════════

export function buildDecor(scene: Phaser.Scene, ch: ChapterConfig) {
  if (ch.theme === 'room') buildRoom(scene, ch);
  else buildStreet(scene, ch);
}

// ── Улица: силуэты домов с окнами + фонари вдоль дороги ─────────────────────
function buildStreet(scene: Phaser.Scene, ch: ChapterConfig) {
  const far = scene.add.container(0, 0).setScrollFactor(0.25).setDepth(-7);
  const farW = ch.arenaW * 0.25 + W + 200;
  let x = -80;
  while (x < farW) {
    const h = Phaser.Math.Between(110, 250), bw = Phaser.Math.Between(90, 160);
    const g = scene.add.graphics();
    g.fillStyle(0x251c3c, 1); g.fillRect(x, GROUND_Y - h, bw, h);
    g.fillStyle(0x2e2348, 1); g.fillRect(x, GROUND_Y - h, bw, 6);
    g.fillStyle(0xffd080, 0.45);
    for (let wy = GROUND_Y - h + 16; wy < GROUND_Y - 24; wy += 30)
      for (let wx = x + 12; wx < x + bw - 16; wx += 26)
        if (Math.random() < 0.38) g.fillRect(wx, wy, 9, 12);
    far.add(g);
    x += bw + Phaser.Math.Between(24, 80);
  }
  // фонари — настоящий спрайт + тёплый островок света
  for (let lx = 330; lx < ch.arenaW - 200; lx += 540) {
    placeProp(scene, 'prop_streetlamp', lx, GROUND_Y, 46, 4);
    const g = scene.add.graphics().setDepth(3);
    g.fillStyle(0xffd9a0, 0.07);
    g.fillTriangle(lx - 10, GROUND_Y - 150, lx + 10, GROUND_Y - 150, lx + 56, GROUND_Y);
    g.fillTriangle(lx - 10, GROUND_Y - 150, lx + 10, GROUND_Y - 150, lx - 56, GROUND_Y);
    g.fillStyle(0xffd9a0, 0.10); g.fillEllipse(lx, GROUND_Y - 2, 124, 16);
  }
  // дорожная разметка-бордюр
  const curb = scene.add.graphics().setDepth(3);
  curb.fillStyle(0xb8a8d0, 0.18);
  for (let cx = 0; cx < ch.arenaW; cx += 64) curb.fillRect(cx, GROUND_Y - 2, 34, 2);
}

// ── Комната: обои, окна с ночью, диван, ТВ, торшер ──────────────────────────
function buildRoom(scene: Phaser.Scene, ch: ChapterConfig) {
  const wall = scene.add.graphics().setDepth(-6);
  // полосы обоев + плинтус
  wall.fillStyle(0xffffff, 0.03);
  for (let x = 30; x < ch.arenaW; x += 96) wall.fillRect(x, 50, 30, GROUND_Y - 60);
  wall.fillStyle(0x39415c, 1); wall.fillRect(0, GROUND_Y - 11, ch.arenaW, 11);
  wall.fillStyle(0x4a5470, 0.8); wall.fillRect(0, GROUND_Y - 11, ch.arenaW, 2);

  let moon = true;
  for (let wx = 560; wx < ch.arenaW - 280; wx += 1150) { windowFrame(scene, wx, moon); moon = false; }
  // фоновая мебель — в ПРОСВЕТАХ между платформами и не над ямами (иначе
  // платформы «закрывают» интерьер). Координаты подобраны под раскладку главы 2.
  const furniture: [string, number, number][] = [
    ['prop_bookshelf', 545, 96], ['prop_plant', 1115, 70], ['prop_bookshelf', 2690, 96],
    ['prop_plant', 3580, 70], ['prop_bookshelf', 4010, 96],
  ];
  for (const [key, fx, w] of furniture) if (fx < ch.arenaW - 80) placeProp(scene, key, fx, GROUND_Y, w, 1);

  const d = ch.decor ?? {};
  if (d.couch) couch(scene, d.couch);
  if (d.tv) tv(scene, d.tv);
  for (const lx of d.lamps ?? []) lamp(scene, lx);
}

function windowFrame(scene: Phaser.Scene, x: number, moon: boolean) {
  const g = scene.add.graphics().setDepth(-5);
  const top = GROUND_Y - 282, h = 178, w = 132;
  g.fillStyle(0x0a1226, 1); g.fillRect(x - w / 2, top, w, h);
  g.fillStyle(0xfff6e0, 0.85);
  for (let i = 0; i < 9; i++)
    g.fillRect(x - w / 2 + 8 + ((i * 37) % (w - 14)), top + 10 + ((i * 53) % (h - 20)), 2, 2);
  if (moon) { g.fillStyle(0xfff2cc, 0.95); g.fillCircle(x + 28, top + 44, 17); g.fillStyle(0x0a1226, 1); g.fillCircle(x + 35, top + 39, 13); }
  g.lineStyle(7, 0x39415c, 1); g.strokeRect(x - w / 2, top, w, h);
  g.lineStyle(4, 0x39415c, 1);
  g.lineBetween(x, top, x, top + h);
  g.lineBetween(x - w / 2, top + h / 2, x + w / 2, top + h / 2);
  // подоконник + лунная дорожка на пол
  g.fillStyle(0x444e6e, 1); g.fillRect(x - w / 2 - 8, top + h, w + 16, 7);
  g.fillStyle(0x9fb6e0, 0.05); g.fillTriangle(x - w / 2, top + h, x + w / 2, top + h, x, GROUND_Y);
}

function couch(scene: Phaser.Scene, x: number) {
  const g = scene.add.graphics().setDepth(3);
  g.fillStyle(0x6a3a50, 0.35); g.fillEllipse(x, GROUND_Y - 4, 300, 22);             // ковёр под диваном
  placeProp(scene, 'prop_couch', x, GROUND_Y, 210, 4);
}

function tv(scene: Phaser.Scene, x: number) {
  placeProp(scene, 'prop_tv', x, GROUND_Y, 140, 4);
  // мерцание экрана + отблеск на пол — поверх спрайта
  const screen = scene.add.rectangle(x, GROUND_Y - 64, 64, 38, 0x9fd0ff, 0.4).setDepth(4);
  scene.tweens.add({ targets: screen, alpha: { from: 0.18, to: 0.42 }, duration: 380, yoyo: true, repeat: -1 });
  const glow = scene.add.graphics().setDepth(3);
  glow.fillStyle(0x9fd0ff, 0.06); glow.fillTriangle(x - 44, GROUND_Y - 64, x + 44, GROUND_Y - 64, x, GROUND_Y + 40);
}

function lamp(scene: Phaser.Scene, x: number) {
  placeProp(scene, 'prop_lamp', x, GROUND_Y, 56, 4);
  // тёплый ореол от абажура
  const g = scene.add.graphics().setDepth(3);
  g.fillStyle(0xffd9a0, 0.08); g.fillTriangle(x - 16, GROUND_Y - 150, x + 16, GROUND_Y - 150, x, GROUND_Y);
  g.fillStyle(0xffd9a0, 0.10); g.fillEllipse(x, GROUND_Y - 2, 110, 14);
}
