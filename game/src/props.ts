import Phaser from 'phaser';
import alarmUrl from './assets/prop_alarm.png';
import bedUrl   from './assets/prop_bed.png';
import deskUrl  from './assets/prop_desk.png';
import doorUrl  from './assets/prop_door.png';
import couchUrl from './assets/prop_couch.png';
import tvUrl    from './assets/prop_tv.png';
import lampUrl  from './assets/prop_lamp.png';

// Настоящие пиксель-арт спрайты реквизита (заменили код-рисованные прямоугольники).
// Файлы < 130 КБ → Vite инлайнит их data-URI в бандл: грузятся мгновенно, упасть
// по сети не могут (см. BootScene — грузим прямо в preload).
export const PROPS: Record<string, string> = {
  prop_alarm: alarmUrl, prop_bed: bedUrl, prop_desk: deskUrl,
  prop_door: doorUrl, prop_couch: couchUrl, prop_tv: tvUrl, prop_lamp: lampUrl,
};

export function loadProps(scene: Phaser.Scene) {
  for (const [k, u] of Object.entries(PROPS))
    if (!scene.textures.exists(k)) scene.load.image(k, u);
}

// Поставить реквизит на пол: origin (0.5, 1) в точке (x, groundY), масштаб — по
// целевой ширине. Если текстура не доехала — вернёт null (сцена остаётся целой).
export function placeProp(
  scene: Phaser.Scene, key: string, x: number, groundY: number, targetW: number, depth = 4,
): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(key)) return null;
  const img = scene.add.image(x, groundY, key).setOrigin(0.5, 1).setDepth(depth);
  img.setScale(targetW / img.width);
  return img;
}
