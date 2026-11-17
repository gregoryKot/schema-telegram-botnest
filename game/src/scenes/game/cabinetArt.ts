// Кабинет гл.4 на рассвете: фон-текстура 480×270 (game/art/cabinet.py), якорь — низ по центру,
// мебель и герои — смещением от центра в пикселях арта: на таче виден центр 320×180.
import Phaser from 'phaser';
import { W, H } from '../../constants';
import { GRID } from '../../gridScale';
import { placeGrid } from '../../gridProp';
import { addTherapist } from './therapist';
import { CAB } from './cabinetLayout';
import type { GameScene } from '../GameScene';


// Тексты на светлой стене — тёмные, со светлой обводкой: читаются и поверх окна.
export const CAB_INK = { say: '#2c3a52', warm: '#7a4226', doc: '#14664e', meet: '#8a2f52', calm: '#0f6a50' };
export const CAB_STROKE = { stroke: '#fff8e0', strokeThickness: 6 };
export const CAB_VEIL = 0xfff4e0;          // финальная CTA — на светлой вуали, а не на затемнении

export interface Cabinet {
  objs: Phaser.GameObjects.GameObject[];
  doc: Phaser.GameObjects.Sprite;
  floorY: number;
}

export function buildCabinet(s: GameScene, depth: number): Cabinet {
  const floorY = H - CAB.floor * GRID;
  const at = (artX: number) => W / 2 + (artX - CAB.center) * GRID;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.Image>(o: T | null, d = depth + 2) => {
    if (o) objs.push(o.setScrollFactor(0).setDepth(d).setAlpha(0));
    return o;
  };
  if (s.textures.exists('bg_cabinet'))
    add(s.add.image(W / 2, H, 'bg_cabinet').setOrigin(0.5, 1).setScale(GRID), depth + 1);
  add(placeGrid(s, 'prop_bookshelf', at(CAB.shelf), floorY, 0));
  for (const x of CAB.plants) add(placeGrid(s, 'prop_plant', at(x), floorY, 0));
  const couch = add(placeGrid(s, 'prop_couch', at(CAB.couch), floorY, 0));
  // Мистер и терапевт — просто сидят. никого не надо бить.
  const seat = couch ? Math.round(couch.height * 0.4) * GRID : 0;
  add(s.add.sprite(at(CAB.couch - 10), floorY - seat, 'cat_idle').setOrigin(0.5, 1).setScale(GRID).play('p-idle'), depth + 3);
  const doc = addTherapist(s, at(CAB.chair), floorY - CAB.seat * GRID, depth + 3);
  objs.push(doc);
  return { objs, doc, floorY };
}
