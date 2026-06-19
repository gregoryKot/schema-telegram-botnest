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
import anxUrl   from './assets/enemy_anx.png';
import procUrl  from './assets/enemy_proc.png';
import phoneUrl from './assets/enemy_phone.png';

// Настоящие пиксель-арт спрайты (заменили код-рисованные прямоугольники/кружки).
// Файлы мелкие → Vite инлайнит data-URI в бандл: грузятся мгновенно, упасть
// по сети не могут (грузим прямо в BootScene.preload).
export const PROP_IMAGES: Record<string, string> = {
  prop_alarm: alarmUrl, prop_bed: bedUrl, prop_desk: deskUrl, prop_door: doorUrl,
  prop_couch: couchUrl, prop_tv: tvUrl, prop_lamp: lampUrl,
  prop_bookshelf: shelfUrl, prop_plant: plantUrl, prop_streetlamp: slampUrl,
  heartpk: heartUrl,
};

// Анимированные враги: спрайт-лист → ключ текстуры + размеры кадра.
export const ENEMY_SHEETS: Record<string, { url: string; fw: number; fh: number }> = {
  anxmob:   { url: anxUrl,   fw: 124, fh: 64 },
  procmob:  { url: procUrl,  fw: 110, fh: 56 },
  phonemob: { url: phoneUrl, fw: 79,  fh: 60 },
};

export function loadProps(scene: Phaser.Scene) {
  for (const [k, u] of Object.entries(PROP_IMAGES))
    if (!scene.textures.exists(k)) scene.load.image(k, u);
  for (const [k, s] of Object.entries(ENEMY_SHEETS))
    if (!scene.textures.exists(k)) scene.load.spritesheet(k, s.url, { frameWidth: s.fw, frameHeight: s.fh });
}

// Зацикленные idle-анимации врагов (создаём один раз — менеджер анимаций общий).
export function ensureEnemyAnims(scene: Phaser.Scene) {
  const mk = (key: string, sheet: string, fps: number) => {
    if (scene.anims.exists(key) || !scene.textures.exists(sheet)) return;
    scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(sheet, { start: 0, end: 2 }), frameRate: fps, repeat: -1 });
  };
  mk('anx-fly', 'anxmob', 5);
  mk('proc-idle', 'procmob', 4);
  mk('phone-walk', 'phonemob', 6);
}

// Поставить реквизит на пол: origin (0.5, 1) в точке (x, groundY), масштаб — по
// целевой ширине. Если текстура не доехала — вернёт null (сцена остаётся целой).
export function placeProp(
  scene: Phaser.Scene, key: string, x: number, groundY: number, targetW: number, depth = 4,
): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(key)) return null;
  const img = scene.add.image(x, groundY, key).setOrigin(0.5, 1).setDepth(depth);
  img.setScale(targetW / img.width);
  // утопить «ножки» в пол: у спрайтов снизу мягкая тень-поля — иначе предмет висит
  img.y = groundY + Math.min(10, img.displayHeight * 0.05);
  return img;
}
