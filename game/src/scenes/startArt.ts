import Phaser from 'phaser';
import { W, H } from '../constants';
import { IS_TOUCH } from '../controls';
import { GRID } from '../gridScale';
import { placeGrid } from '../gridProp';
import { floorStrip, roomWall } from '../backdrop';

const COUCH = 10, LAMP = 125, SHELF = -125, PLANT = -72; // смещения от центра кадра в px арта

// Титул: дом тёплым вечером из арта гл.2 — торшер, диван и спящий на нём Мистер; отсюда путь к рассвету.
// Спрайт сна догружается в фоне — до него кот сидит.
export function drawStartArt(scene: Phaser.Scene): Phaser.GameObjects.Sprite {
  const floorY = H - (IS_TOUCH ? 52 : 78);
  const at = (dx: number) => W / 2 + dx * GRID;
  scene.cameras.main.setBackgroundColor('#a8676a'); // верх стены уходит в ту же вечернюю тень
  roomWall(scene, floorY, -6);
  if (scene.textures.exists('room_glow'))
    scene.add.image(at(LAMP), floorY, 'room_glow').setOrigin(0.5, 1).setScale(GRID).setDepth(-5);
  floorStrip(scene, 'ground_room', floorY, -4);
  placeGrid(scene, 'prop_bookshelf', at(SHELF), floorY, -3);
  placeGrid(scene, 'prop_plant', at(PLANT), floorY, -3);
  placeGrid(scene, 'prop_rug', at(COUCH), floorY, -3);
  placeGrid(scene, 'prop_lamp', at(LAMP), floorY, -2); // ореол и пятно — в спрайте
  const couch = placeGrid(scene, 'prop_couch', at(COUCH), floorY, -2);
  const seatY = couch ? floorY - Math.round(couch.height * 0.4) * GRID : floorY;
  const cat = scene.add.sprite(at(COUCH + 28), seatY, 'cat_idle', 0).setOrigin(0.5, 1).setScale(GRID).setDepth(-1);
  const sleep = () => cat.setTexture('cat_sleep', 5);
  if (scene.textures.exists('cat_sleep')) sleep();
  else
    scene.textures.once(Phaser.Textures.Events.ADD_KEY + 'cat_sleep', () => {
      if (cat.active) sleep();
    });
  return cat;
}
