import Phaser from 'phaser';
import { GROUND_Y, W } from './constants';
import { ChapterConfig } from './chapters';

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
  // фонари — тёплые островки света на тёмной улице
  for (let lx = 330; lx < ch.arenaW - 200; lx += 540) {
    const g = scene.add.graphics().setDepth(4);
    g.fillStyle(0x3a3052, 1);
    g.fillRect(lx - 3, GROUND_Y - 152, 6, 152);
    g.fillRect(lx - 17, GROUND_Y - 154, 34, 7);
    g.fillStyle(0xffd9a0, 1); g.fillEllipse(lx, GROUND_Y - 142, 18, 11);
    g.fillStyle(0xffd9a0, 0.07);
    g.fillTriangle(lx - 10, GROUND_Y - 138, lx + 10, GROUND_Y - 138, lx + 56, GROUND_Y);
    g.fillTriangle(lx - 10, GROUND_Y - 138, lx + 10, GROUND_Y - 138, lx - 56, GROUND_Y);
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
  for (let px = 980; px < ch.arenaW - 300; px += 1700) picture(scene, px);

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

function picture(scene: Phaser.Scene, x: number) {
  const g = scene.add.graphics().setDepth(-5);
  g.fillStyle(0x1a2236, 1); g.fillRect(x - 26, GROUND_Y - 248, 52, 40);
  g.lineStyle(4, 0x4a3a28, 1); g.strokeRect(x - 26, GROUND_Y - 248, 52, 40);
  g.fillStyle(0x6a7a9a, 0.8); g.fillTriangle(x - 18, GROUND_Y - 216, x - 2, GROUND_Y - 236, x + 12, GROUND_Y - 216); // «горы»
  g.fillStyle(0xfff2cc, 0.7); g.fillCircle(x + 14, GROUND_Y - 240, 4);
}

function couch(scene: Phaser.Scene, x: number) {
  const g = scene.add.graphics().setDepth(4);
  // ковёр
  g.fillStyle(0x6a3a50, 0.35); g.fillEllipse(x, GROUND_Y - 4, 300, 22);
  // спинка → сиденье → подлокотники → подушки
  g.fillStyle(0x4a2f4e, 1); g.fillRoundedRect(x - 88, GROUND_Y - 100, 176, 56, 10);
  g.fillStyle(0x5a3a5e, 1); g.fillRoundedRect(x - 88, GROUND_Y - 56, 176, 56, 8);
  g.fillStyle(0x6a466e, 1);
  g.fillRoundedRect(x - 104, GROUND_Y - 76, 26, 76, 9);
  g.fillRoundedRect(x + 78, GROUND_Y - 76, 26, 76, 9);
  g.fillStyle(0x66406a, 1);
  g.fillRoundedRect(x - 76, GROUND_Y - 60, 72, 18, 6);
  g.fillRoundedRect(x + 4, GROUND_Y - 60, 72, 18, 6);
  g.fillStyle(0x2e1d33, 1); g.fillRect(x - 80, GROUND_Y - 6, 10, 6); g.fillRect(x + 70, GROUND_Y - 6, 10, 6);
}

function tv(scene: Phaser.Scene, x: number) {
  const g = scene.add.graphics().setDepth(4);
  g.fillStyle(0x2a2030, 1); g.fillRect(x - 56, GROUND_Y - 46, 112, 46);            // тумба
  g.fillStyle(0x14101c, 1); g.fillRect(x - 50, GROUND_Y - 118, 100, 66);           // корпус
  const screen = scene.add.rectangle(x, GROUND_Y - 85, 88, 54, 0x9fd0ff, 0.55).setDepth(4);
  scene.tweens.add({ targets: screen, alpha: { from: 0.35, to: 0.65 }, duration: 380, yoyo: true, repeat: -1 });
  const glow = scene.add.graphics().setDepth(3);
  glow.fillStyle(0x9fd0ff, 0.06); glow.fillTriangle(x - 44, GROUND_Y - 85, x + 44, GROUND_Y - 85, x, GROUND_Y + 40);
}

function lamp(scene: Phaser.Scene, x: number) {
  const g = scene.add.graphics().setDepth(4);
  g.fillStyle(0x3a3052, 1); g.fillRect(x - 3, GROUND_Y - 138, 6, 138);
  g.fillStyle(0xffc878, 1); g.fillTriangle(x - 22, GROUND_Y - 132, x + 22, GROUND_Y - 132, x, GROUND_Y - 168);
  g.fillStyle(0xffd9a0, 0.08); g.fillTriangle(x - 14, GROUND_Y - 130, x + 14, GROUND_Y - 130, x, GROUND_Y);
  g.fillStyle(0xffd9a0, 0.10); g.fillEllipse(x, GROUND_Y - 2, 110, 14);
}
