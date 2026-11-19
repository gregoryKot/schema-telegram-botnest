// Мир «Понедельника»: пол, утро, преграды, люди, дверь. Столкновения держат невидимые блоки, поверх — арт из game/art/week*.py.
import Phaser from 'phaser';
import { GROUND_Y, H } from '../constants';
import { GRID } from '../gridScale';
import type { Chapter, Gate } from './monday';
import { pileFrame } from './look';
type Rect = Phaser.GameObjects.Rectangle;
type Sprite = Phaser.GameObjects.Sprite;
export interface GateObj extends Gate { open: boolean; rect: Rect; art: Sprite }
export interface World {
  solids: Phaser.Physics.Arcade.StaticGroup;
  gates: GateObj[];
  door: Sprite;
  people: Sprite[]; // кадр 0 — с лицом, кадр 1 — без: лица видны, только пока сбоя нет
}
const BLOCK_ART: Record<number, string> = { 22: 'wk_curb', 30: 'wk_step', 60: 'wk_step_hi' };
const WALKERS = ['wk_colleague_c', 'wk_colleague_b', 'wk_colleague_a'];
const solid = (scene: Phaser.Scene, solids: World['solids'], x: number, w: number, h: number): Rect => {
  const r = scene.add.rectangle(x, GROUND_Y - h / 2, w, h, 0, 0);
  solids.add(r);
  return r;
};
const stand = (scene: Phaser.Scene, key: string, x: number, frame = 0): Sprite =>
  scene.add.sprite(x, GROUND_Y + GRID, key, frame).setOrigin(0.5, 1).setScale(GRID);
export function addGate(scene: Phaser.Scene, w: World, g: Gate): GateObj {
  const width = g.kind === 'noise' ? 70 : g.kind === 'person' ? 30 : 40;
  const rect = solid(scene, w.solids, g.x, width, g.kind === 'person' ? 96 : g.h);
  // арт сдвинут вперёд от блока: Саша упирается в преграду, а не стоит внутри неё
  const art = g.kind === 'pile' ? stand(scene, 'wk_piles', g.x + 8, pileFrame(g.h))
    : g.kind === 'noise' ? stand(scene, 'wk_notif_wall', g.x + 8)
    : stand(scene, 'wk_colleague_box', g.x + 30, 1).setFlipX(true);
  art.setDepth(5);
  const obj: GateObj = { ...g, open: false, rect, art };
  if (g.kind === 'person') w.people.push(art);
  w.gates.push(obj);
  return obj;
}
/** Преграда убрана: столкновения нет сразу, арт гаснет; человек отдал коробку и остаётся стоять в стороне. */
export function openGate(scene: Phaser.Scene, w: World, g: GateObj) {
  if (g.open) return;
  g.open = true;
  (g.rect.body as Phaser.Physics.Arcade.StaticBody).enable = false;
  if (g.kind === 'person') {
    w.people = w.people.filter(p => p !== g.art);
    g.art.setFrame(2).setDepth(1);
    return;
  }
  scene.tweens.add({ targets: g.art, alpha: 0, y: g.art.y + 8, duration: 260, onComplete: () => g.art.destroy() });
}
export function buildWorld(scene: Phaser.Scene, ch: Chapter): World {
  const solids = scene.physics.add.staticGroup();
  solids.add(scene.add.rectangle(ch.worldW / 2, GROUND_Y + (H - GROUND_Y) / 2, ch.worldW, H - GROUND_Y, 0, 0));
  // утро: Мистер на подоконнике, лужа, бордюр и ступени
  scene.add.sprite(ch.catX, GROUND_Y - 70 + GRID, 'wk_mister').setOrigin(0.5, 1).setScale(GRID).play('wk-mister');
  scene.add.image(ch.puddleX, GROUND_Y + 10, 'wk_puddle').setScale(GRID);
  for (const b of ch.blocks) {
    solid(scene, solids, b.x, b.w, b.h);
    scene.add.image(b.x, GROUND_Y, BLOCK_ART[b.h]).setOrigin(0.5, 1).setScale(GRID).setDepth(2);
  }
  const people = ch.people.map((x, i) => stand(scene, WALKERS[i % WALKERS.length], x).setFlipX(i % 2 === 0).setDepth(1));
  const door = stand(scene, 'wk_door', ch.door.x).setDepth(2);
  const w: World = { solids, gates: [], door, people };
  for (const g of ch.gates) addGate(scene, w, g);
  return w;
}
