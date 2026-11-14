import Phaser from 'phaser';
import { W, H } from '../../constants';
import { IS_TOUCH } from '../../controls';
import { placeProp, LAMP_W } from '../../props';

// Экран смерти: ночная улица, под фонарём свернулся Мистер. Только имеющийся
// реквизит; всё появляется вместе со шторой и уходит вместе с оверлеем.
export function drawDeathArt(
  s: Phaser.Scene,
  depth: number,
): Phaser.GameObjects.GameObject[] {
  const k = IS_TOUCH ? 0.7 : 1;
  const floorY = H - (IS_TOUCH ? 50 : 76);
  const lampX = W * (IS_TOUCH ? 0.86 : 0.82);
  const g = s.add.graphics();
  g.fillStyle(0x110c1c, 1);
  g.fillRect(0, floorY, W, H - floorY);
  g.fillStyle(0x2a2240, 1);
  g.fillRect(0, floorY, W, 2);
  const objs: Phaser.GameObjects.GameObject[] = [g];
  const lamp = placeProp(s, 'prop_streetlamp', lampX, floorY, LAMP_W * k, depth); // свет — в спрайте
  if (lamp) objs.push(lamp);
  const sleeping = s.textures.exists('cat_sleep');
  const cat = s.add
    .sprite(
      lampX - 36 * k,
      floorY + 2,
      sleeping ? 'cat_sleep' : 'cat_idle',
      sleeping ? 5 : 0,
    )
    .setOrigin(0.5, 1)
    .setScale(1.5 * k) // поза в кадре 48, как у кота
    .setFlipX(true);
  objs.push(cat);
  for (const o of objs) {
    const go = o as Phaser.GameObjects.Image;
    go.setScrollFactor(0).setDepth(depth).setAlpha(0);
    s.tweens.add({ targets: go, alpha: 1, duration: 900, delay: 300 });
  }
  return objs;
}
