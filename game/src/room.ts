import Phaser from 'phaser';
import { GROUND_Y, W } from './constants';
import type { ChapterConfig } from './chapters';
import { GRID } from './gridScale';
import { placeGrid } from './gridProp';
import { addGlow } from './look';
import { ROOM, glowLeft, onFloor } from './roomLayout';
import wallUrl from './assets/bg_room_wall.png';
import glowUrl from './assets/room_glow.png';
import windowUrl from './assets/prop_window.png';
import rugUrl from './assets/prop_rug.png';
import pictureUrl from './assets/prop_picture.png';

// Комната гл.2 — тёплый вечер (game/art/room.py, furniture.py): стена-тайл, пятна света у торшеров,
// окна с сумерками, мебель в сетке ×2.
const IMAGES: Record<string, string> = {
  bg_room_wall: wallUrl, room_glow: glowUrl, prop_window: windowUrl, prop_rug: rugUrl,
};
const WINDOW_SILL = 88; // подоконник над полом, px: выше спинки дивана
const PICTURE_Y = 192;

export function loadRoom(scene: Phaser.Scene) { // data-URI, грузит BootScene
  for (const [k, u] of Object.entries(IMAGES)) if (!scene.textures.exists(k)) scene.load.image(k, u);
  if (!scene.textures.exists('prop_picture')) scene.load.spritesheet('prop_picture', pictureUrl, { frameWidth: 24, frameHeight: 20 });
}

export function buildRoom(scene: Phaser.Scene, ch: ChapterConfig) {
  const G = GROUND_Y, d = ch.decor ?? {};
  if (scene.textures.exists('bg_room_wall')) {
    const src = scene.textures.get('bg_room_wall').getSourceImage();
    scene.add.tileSprite(-64, G, (ch.arenaW + 128) / GRID, src.height, 'bg_room_wall').setOrigin(0, 1).setScale(GRID).setDepth(-6);
  }
  for (const lx of d.lamps ?? []) { // стена вокруг торшера светлее: та же стена в тёплых тонах, край — дизером
    if (scene.textures.exists('room_glow'))
      scene.add.image(glowLeft(lx), G, 'room_glow').setOrigin(0, 1).setScale(GRID).setDepth(-5.5);
  }
  for (const wx of ROOM.windows) if (wx < ch.arenaW - 280) placeGrid(scene, 'prop_window', wx, G - WINDOW_SILL, -5);
  for (const [px, frame] of ROOM.pictures) if (px < ch.arenaW - 80) placeGrid(scene, 'prop_picture', px, G - PICTURE_Y, -5, frame);

  const floor = (xs: number[], halfW: number) => onFloor(xs, halfW, ch.arenaW, ch.pits);
  for (const x of floor([ROOM.door], 46)) placeGrid(scene, 'prop_door', x, G, 1);
  for (const x of floor(ROOM.shelves, 48)) placeGrid(scene, 'prop_bookshelf', x, G, 1);
  for (const x of floor(ROOM.plants, 34)) placeGrid(scene, 'prop_plant', x, G, 1);
  for (const x of floor([ROOM.desk], 92)) placeGrid(scene, 'prop_desk', x, G, 1);

  if (d.couch) { placeGrid(scene, 'prop_rug', d.couch, G, 3); placeGrid(scene, 'prop_couch', d.couch, G, 4); }
  if (d.tv) tv(scene, d.tv);
  for (const lx of d.lamps ?? []) placeGrid(scene, 'prop_lamp', lx, G, 4); // ореол и пятно на полу — в спрайте
}

// Экран — единственный холодный свет в комнате: мерцает и чуть синит стену вокруг.
function tv(scene: Phaser.Scene, x: number) {
  placeGrid(scene, 'prop_tv', x, GROUND_Y, 4);
  const flick = scene.add.rectangle(x - 8, GROUND_Y - 76, 74, 52, 0xeaf6ff, 0.3).setDepth(4);
  scene.tweens.add({ targets: flick, alpha: { from: 0, to: 0.3 }, duration: 380, yoyo: true, repeat: -1 });
  addGlow(scene, x - 8, GROUND_Y - 76, Math.min(W, 420), 300, 0x7fb6e8, 0.16, -5.2);
}
