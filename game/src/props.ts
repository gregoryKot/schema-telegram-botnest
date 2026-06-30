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
import irritUrl from './assets/enemy_irrit.png';
import workUrl  from './assets/prop_workload.png';
import memUrl    from './assets/spr_memory.png';
import lStreetUrl from './assets/ledge_street.png';
import lRoomUrl   from './assets/ledge_room.png';
import lStageUrl  from './assets/ledge_stage.png';
import lGlassUrl  from './assets/ledge_glass.png';
import sootheUrl from './assets/enemy_soothe.png';
import bargUrl   from './assets/enemy_bargainer.png';
import mirrorUrl from './assets/enemy_mirror.png';

// Настоящие пиксель-арт спрайты (заменили код-рисованные прямоугольники/кружки).
// Файлы мелкие → Vite инлайнит data-URI в бандл: грузятся мгновенно, упасть
// по сети не могут (грузим прямо в BootScene.preload).
export const PROP_IMAGES: Record<string, string> = {
  prop_alarm: alarmUrl, prop_bed: bedUrl, prop_desk: deskUrl, prop_door: doorUrl,
  prop_couch: couchUrl, prop_tv: tvUrl, prop_lamp: lampUrl,
  prop_bookshelf: shelfUrl, prop_plant: plantUrl, prop_streetlamp: slampUrl,
  heartpk: heartUrl,
  ledge_street: lStreetUrl, ledge_room: lRoomUrl, ledge_stage: lStageUrl, ledge_glass: lGlassUrl,
};

// Карнизы-платформы для NineSlice: ключ + ширина торца (px текстуры, не растягивается)
export const LEDGE: Record<string, { key: string; cap: number }> = {
  street: { key: 'ledge_street', cap: 34 },
  room:   { key: 'ledge_room',   cap: 30 },
  stage:  { key: 'ledge_stage',  cap: 30 },
  glass:  { key: 'ledge_glass',  cap: 34 },
};

// Анимированные враги: спрайт-лист → ключ текстуры + размеры кадра.
export const ENEMY_SHEETS: Record<string, { url: string; fw: number; fh: number; frames: number }> = {
  anxmob:   { url: anxUrl,   fw: 124, fh: 64, frames: 3 },
  procmob:  { url: procUrl,  fw: 110, fh: 56, frames: 3 },
  phonemob: { url: phoneUrl, fw: 79,  fh: 60, frames: 3 },
  irritmob: { url: irritUrl, fw: 59,  fh: 60, frames: 4 },
  workload: { url: workUrl,  fw: 86,  fh: 96, frames: 4 },
  memory:   { url: memUrl,   fw: 30,  fh: 30, frames: 4 },
  soothe:   { url: sootheUrl, fw: 66, fh: 64, frames: 4 },
  bargainer:{ url: bargUrl,   fw: 70, fh: 70, frames: 4 },
  crookedmirror:{ url: mirrorUrl, fw: 170, fh: 98, frames: 4 },
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
    const end = (ENEMY_SHEETS[sheet]?.frames ?? 3) - 1;
    scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(sheet, { start: 0, end }), frameRate: fps, repeat: -1 });
  };
  mk('anx-fly', 'anxmob', 5);
  mk('proc-idle', 'procmob', 4);
  mk('phone-walk', 'phonemob', 6);
  mk('irrit-flicker', 'irritmob', 8);
  mk('workload-wobble', 'workload', 6);
  mk('memory-twinkle', 'memory', 7);
  mk('soothe-idle', 'soothe', 5);
  mk('bargainer-idle', 'bargainer', 6);
  mk('mirror-shimmer', 'crookedmirror', 5);
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
