import Phaser from 'phaser';
import { W, H } from '../../constants';
import { IS_TOUCH } from '../../controls';
import { GRID } from '../../gridScale';
import { placeGrid } from '../../gridProp';
import { floorStrip } from '../../backdrop';

// «Плохо» — не чернота, а холод: штора экрана смерти — остывшие сумерки, улица выцвела.
export const DEATH_DUSK = 0x2c3558;
const COLD = 0x7a8ec4, FAR_COLD = 0x5468a4; // тинт мостовой и домов: тепло заката ушло

// Экран смерти: под фонарём свернулся Мистер — свет фонаря остаётся тёплым. Только имеющийся
// реквизит в сетке ×2; всё появляется вместе со шторой и уходит вместе с оверлеем.
export function drawDeathArt(
  s: Phaser.Scene,
  depth: number,
): Phaser.GameObjects.GameObject[] {
  const floorY = H - (IS_TOUCH ? 50 : 76);
  const lampX = W * (IS_TOUCH ? 0.86 : 0.82);
  const objs: Phaser.GameObjects.GameObject[] = floorStrip(s, 'ground_street', floorY, depth).map(t => t.setTint(COLD));
  if (s.textures.exists('bg_street_mid')) {
    const src = s.textures.get('bg_street_mid').getSourceImage();
    objs.unshift(s.add.tileSprite(0, floorY, W / GRID, src.height, 'bg_street_mid').setOrigin(0, 1).setScale(GRID).setTint(FAR_COLD));
  }
  const lamp = placeGrid(s, 'prop_streetlamp', lampX, floorY, depth); // свет — в спрайте
  if (lamp) objs.push(lamp);
  const sleeping = s.textures.exists('cat_sleep');
  const cat = s.add
    .sprite(lampX - 36, floorY, sleeping ? 'cat_sleep' : 'cat_idle', sleeping ? 5 : 0)
    .setOrigin(0.5, 1)
    .setScale(GRID) // поза в кадре 36, как у кота
    .setFlipX(true);
  objs.push(cat);
  for (const o of objs) {
    const go = o as Phaser.GameObjects.Image;
    go.setScrollFactor(0).setDepth(depth).setAlpha(0);
    s.tweens.add({ targets: go, alpha: 1, duration: 900, delay: 300 });
  }
  return objs;
}
