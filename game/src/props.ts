import Phaser from 'phaser';
import alarmUrl from './assets/prop_alarm.png';
import bedUrl   from './assets/prop_bed.png';
import deskUrl  from './assets/prop_desk.png';
import doorUrl  from './assets/prop_door.png';
import couchUrl from './assets/prop_couch.png';
import tvUrl    from './assets/prop_tv.png';
import lampUrl  from './assets/prop_lamp.png';
import shelfUrl from './assets/prop_bookshelf.png';
import plantUrl from './assets/prop_plant.png';
import slampUrl from './assets/prop_streetlamp.png';
import heartUrl from './assets/spr_heart.png';
import irritUrl from './assets/enemy_irrit.png';
import memUrl    from './assets/spr_memory.png';
import lStreetUrl from './assets/ledge_street.png';
import lRoomUrl   from './assets/ledge_room.png';
import { FOE_SHEETS, ensureFoeAnims } from './foes';
import { loadRoom } from './room';
import { ROAD_IMAGES, HAWKER_ANIMS, HAWKER_SHEETS } from './roadArt';

// Пиксель-арт спрайты: файлы мелкие → Vite инлайнит data-URI в бандл, грузит BootScene.preload.
export const PROP_IMAGES: Record<string, string> = {
  prop_alarm: alarmUrl, prop_bed: bedUrl, prop_desk: deskUrl, prop_door: doorUrl,
  prop_couch: couchUrl, prop_tv: tvUrl, prop_lamp: lampUrl,
  prop_bookshelf: shelfUrl, prop_plant: plantUrl, prop_streetlamp: slampUrl,
  heartpk: heartUrl,
  ledge_street: lStreetUrl, ledge_room: lRoomUrl, ...ROAD_IMAGES,
};

// Свет — внутри спрайта: фонарь 32x100 и торшер 44x92, оба в сетке ×2.
export const LAMP_W = 32 * 2;
export const FLOORLAMP_W = 44 * 2;

// Карнизы-платформы для NineSlice: ключ + ширина торца (px текстуры, не растягивается)
export const LEDGE: Record<string, { key: string; cap: number }> = {
  street: { key: 'ledge_street', cap: 16 },
  room:   { key: 'ledge_room',   cap: 16 },
  road:   { key: 'ledge_road',   cap: 16 },
};

// Анимированные враги: спрайт-лист → ключ текстуры + размеры кадра.
const ENEMY_SHEETS: Record<string, { url: string; fw: number; fh: number; frames: number }> = {
  ...FOE_SHEETS,
  irritmob: { url: irritUrl, fw: 30,  fh: 30, frames: 4 },
  memory:   { url: memUrl,   fw: 15,  fh: 15, frames: 4 },
  ...HAWKER_SHEETS,
};

export function loadProps(scene: Phaser.Scene) {
  loadRoom(scene);
  for (const [k, u] of Object.entries(PROP_IMAGES))
    if (!scene.textures.exists(k)) scene.load.image(k, u);
  for (const [k, s] of Object.entries(ENEMY_SHEETS))
    if (!scene.textures.exists(k)) scene.load.spritesheet(k, s.url, { frameWidth: s.fw, frameHeight: s.fh });
}

// Зацикленные idle-анимации врагов (создаём один раз — менеджер анимаций общий).
export function ensureEnemyAnims(scene: Phaser.Scene) {
  const mk = (key: string, sheet: string, fps: number) => {
    if (scene.anims.exists(key) || !scene.textures.exists(sheet)) return;
    const end = (ENEMY_SHEETS[sheet]?.frames ?? 3) - 1;
    scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(sheet, { start: 0, end }), frameRate: fps, repeat: -1 });
  };
  ensureFoeAnims(scene);
  mk('irrit-flicker', 'irritmob', 8);
  mk('memory-twinkle', 'memory', 7);
  for (const [sheet, key, fps] of HAWKER_ANIMS) mk(key, sheet, fps);
}

// Поставить реквизит на пол: origin (0.5, 1) в точке (x, groundY), масштаб — по
// целевой ширине. Если текстура не доехала — вернёт null (сцена остаётся целой).
export function placeProp(
  scene: Phaser.Scene, key: string, x: number, groundY: number, targetW: number, depth = 4,
): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(key)) return null;
  const img = scene.add.image(x, groundY, key).setOrigin(0.5, 1).setDepth(depth);
  img.setScale(targetW / img.width);
  // утопить низ в пол на целое число пикселей арта — иначе предмет висит
  img.y = groundY + Math.round(Math.min(10, img.displayHeight * 0.05) / 2) * 2;
  return img;
}
