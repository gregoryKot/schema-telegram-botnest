import Phaser from 'phaser';
import { W, H } from '../../constants';
import { IS_TOUCH } from '../../controls';
import { addGlow } from '../../look';
import { placeProp } from '../../props';

// Экран смерти: ночная улица, под фонарём свернулся Мистер. Только имеющийся
// реквизит; всё появляется вместе со шторой и уходит вместе с оверлеем.
export function drawDeathArt(s: Phaser.Scene, depth: number): Phaser.GameObjects.GameObject[] {
  const k = IS_TOUCH ? 0.7 : 1;
  const floorY = H - (IS_TOUCH ? 50 : 76);
  const lampX = W * (IS_TOUCH ? 0.86 : 0.82);
  const g = s.add.graphics();
  g.fillStyle(0x110c1c, 1); g.fillRect(0, floorY, W, H - floorY);
  g.fillStyle(0x2a2240, 1); g.fillRect(0, floorY, W, 2);
  const objs: Phaser.GameObjects.GameObject[] = [g];
  const lamp = placeProp(s, 'prop_streetlamp', lampX, floorY, 46 * k, depth);
  if (lamp) objs.push(lamp);
  const headY = lamp ? lamp.y - lamp.displayHeight * 0.86 : floorY - 160 * k;
  objs.push(addGlow(s, lampX, headY, 140 * k, 140 * k, 0xffd080, 0.24, depth));
  objs.push(addGlow(s, lampX - 30 * k, floorY - 6, 280 * k, 70 * k, 0xffd9a0, 0.32, depth));
  const sleeping = s.textures.exists('cat_sleep');
  const cat = s.add.sprite(lampX - 36 * k, floorY + 2, sleeping ? 'cat_sleep' : 'cat_idle', sleeping ? 5 : 0)
    .setOrigin(0.5, 1).setScale(sleeping ? k : 1.5 * k).setFlipX(true);
  objs.push(cat);
  for (const o of objs) {
    const go = o as Phaser.GameObjects.Image;
    const alpha = go.alpha; // у света своя яркость — проявляем до неё
    go.setScrollFactor(0).setDepth(depth).setAlpha(0);
    s.tweens.add({ targets: go, alpha, duration: 900, delay: 300 });
  }
  return objs;
}
