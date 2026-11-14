import Phaser from 'phaser';
import { W, H } from '../constants';
import { IS_TOUCH } from '../controls';
import { placeProp, FLOORLAMP_W } from '../props';

// Титул: тёплая комната вечером — торшер, диван и спящий на нём Мистер.
// Только имеющийся реквизит; спрайт сна догружается в фоне — до него кот сидит.
export function drawStartArt(scene: Phaser.Scene): Phaser.GameObjects.Sprite {
  const k = IS_TOUCH ? 0.68 : 1;
  const floorY = H - (IS_TOUCH ? 52 : 78);
  const g = scene.add.graphics();
  g.fillGradientStyle(0x1c1428, 0x1c1428, 0x3a2c3c, 0x3a2c3c, 1, 1, 1, 1);
  g.fillRect(0, 0, W, floorY);
  g.fillStyle(0x2a1d16, 1);
  g.fillRect(0, floorY, W, H - floorY);
  g.fillStyle(0x4a3426, 1);
  g.fillRect(0, floorY, W, 3);
  g.fillStyle(0x39304a, 1);
  g.fillRect(0, floorY - 10, W, 10); // плинтус

  const couchX = W * 0.56;
  const lampX = couchX + 200 * k; // торшер у дивана — свет падает на спящего кота
  placeProp(scene, 'prop_lamp', lampX, floorY, FLOORLAMP_W * k, 2); // ореол и пятно — в спрайте

  const couch = placeProp(scene, 'prop_couch', couchX, floorY, 280 * k, 2);
  const seatY = couch ? floorY - couch.displayHeight * 0.4 : floorY;
  const cat = scene.add
    .sprite(couchX + 60 * k, seatY, 'cat_idle', 0)
    .setOrigin(0.5, 1)
    .setDepth(3);
  const sleep = () => {
    if (scene.textures.exists('cat_sleep'))
      cat.setTexture('cat_sleep', 5).setScale(1.5 * k);
  };
  if (scene.textures.exists('cat_sleep')) sleep();
  else {
    cat.setScale(1.5 * k);
    scene.textures.once(Phaser.Textures.Events.ADD_KEY + 'cat_sleep', () => {
      if (cat.active) sleep();
    });
  }
  return cat;
}
