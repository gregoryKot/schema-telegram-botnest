// Мир «Понедельника» на серых блоках: пол, утро, преграды, люди, дверь. Арта нет — только прямоугольники.
import Phaser from 'phaser';
import { GROUND_Y, H } from '../constants';
import type { Chapter, Gate } from './monday';

type Rect = Phaser.GameObjects.Rectangle;
export interface GateObj extends Gate { open: boolean; rect: Rect; face?: Rect }
export interface World {
  solids: Phaser.Physics.Arcade.StaticGroup;
  gates: GateObj[];
  door: Rect;
  faces: Rect[]; // лица людей: видны, только пока сбоя нет
}

const C = { floor: 0x4a4a52, block: 0x6e6e78, pile: 0x8a8a94, noise: 0x5c6a86, person: 0x9a9aa4, face: 0xe6d6c4,
  door: 0x7a5c3a, cat: 0x101014, sill: 0x8c7a5c, puddle: 0x44607c, desk: 0x5a5a64 };

const solid = (scene: Phaser.Scene, solids: World['solids'], x: number, w: number, h: number, color: number): Rect => {
  const r = scene.add.rectangle(x, GROUND_Y - h / 2, w, h, color);
  solids.add(r);
  return r;
};

const person = (scene: Phaser.Scene, x: number, faces: Rect[]): Rect => {
  const face = scene.add.rectangle(x, GROUND_Y - 80, 12, 6, C.face).setDepth(6).setVisible(false);
  faces.push(face);
  return face;
};

export function addGate(scene: Phaser.Scene, w: World, g: Gate): GateObj {
  const width = g.kind === 'noise' ? 70 : g.kind === 'person' ? 30 : 40;
  const h = g.kind === 'person' ? 96 : g.h;
  const rect = solid(scene, w.solids, g.x, width, h, C[g.kind]).setDepth(5);
  if (g.kind === 'noise') rect.setAlpha(0.75);
  const obj: GateObj = { ...g, open: false, rect };
  if (g.kind === 'person') obj.face = person(scene, g.x, w.faces);
  w.gates.push(obj);
  return obj;
}

/** Преграда убрана: столкновения нет сразу, блок гаснет; человек остаётся стоять в стороне. */
export function openGate(scene: Phaser.Scene, g: GateObj) {
  if (g.open) return;
  g.open = true;
  (g.rect.body as Phaser.Physics.Arcade.StaticBody).enable = false;
  if (g.kind === 'person') { g.rect.setAlpha(0.45).setDepth(1); return; }
  scene.tweens.add({ targets: g.rect, alpha: 0, duration: 260, onComplete: () => g.rect.destroy() });
}

/** Стопка без столкновений — то, что выросло за спиной от переработки. */
export function addDecorPile(scene: Phaser.Scene, x: number, h: number) {
  scene.add.rectangle(x, GROUND_Y - h / 2, 34, h, C.pile).setAlpha(0.55).setDepth(1);
}

export function buildWorld(scene: Phaser.Scene, ch: Chapter): World {
  const solids = scene.physics.add.staticGroup();
  const floor = scene.add.rectangle(ch.worldW / 2, GROUND_Y + (H - GROUND_Y) / 2, ch.worldW, H - GROUND_Y, C.floor);
  solids.add(floor);
  const w: World = { solids, gates: [], door: null as unknown as Rect, faces: [] };

  // утро: подоконник с Мистером, лужа, бордюр и ступени
  scene.add.rectangle(ch.catX, GROUND_Y - 70, 70, 8, C.sill);
  scene.add.rectangle(ch.catX, GROUND_Y - 84, 26, 20, C.cat);
  scene.add.rectangle(ch.puddleX, GROUND_Y + 3, 90, 6, C.puddle);
  for (const b of ch.blocks) solid(scene, solids, b.x, b.w, b.h, C.block);
  scene.add.rectangle(ch.deskX, GROUND_Y - 22, 90, 44, C.desk).setDepth(1);

  for (const x of ch.people) {
    scene.add.rectangle(x, GROUND_Y - 48, 30, 96, C.person).setAlpha(0.45).setDepth(1);
    person(scene, x, w.faces);
  }
  for (const g of ch.gates) addGate(scene, w, g);
  w.door = scene.add.rectangle(ch.door.x, GROUND_Y, 56, 110, C.door).setOrigin(0.5, 1).setDepth(2);
  return w;
}
