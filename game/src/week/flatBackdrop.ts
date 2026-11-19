// Фон «Среды»: вечерний город за окнами едет медленнее мира, квартира тянется плиткой без конца;
// сбой проявляется поверх (индиго, экраны звонка), город за окнами темнеет вместе с ним.
import Phaser from 'phaser';
import { GROUND_Y, W } from '../constants';
import { GRID } from '../gridScale';
import type { Backdrop } from './scenery';

const FEET = 215, TILE_H = 270; // строка стоп и высота плитки, px арта (game/art/week_wed.py)
const CALM = 0xffffff, VIOLET = 0x8a5cff;
type Tile = Phaser.GameObjects.TileSprite;

export class FlatBackdrop implements Backdrop {
  private city: Tile; private flat: Tile; private glitch: Tile;
  private level = 0;

  constructor(scene: Phaser.Scene) {
    const top = GROUND_Y - FEET * GRID;
    const tile = (key: string, h: number, depth: number) =>
      scene.add.tileSprite(0, top, W / GRID, h, key).setOrigin(0, 0).setScale(GRID).setScrollFactor(0).setDepth(depth);
    this.city = tile('bg_wk_city_eve', 200, -30);
    this.flat = tile('bg_wk_flat', TILE_H, -20);
    this.glitch = tile('bg_wk_flat_glitch', TILE_H, -19).setAlpha(0);
  }

  /** Цель «Среды» — сам телефон: реплика звучит над ним. */
  settle(doorX: number): number { return doorX; }

  update(scrollX: number, glitch: number) {
    this.level += ((glitch > 0.02 ? 0.72 + 0.28 * glitch : 0) - this.level) * 0.08;
    this.city.tilePositionX = scrollX * 0.25 / GRID;
    this.flat.tilePositionX = this.glitch.tilePositionX = scrollX / GRID;
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(CALM), Phaser.Display.Color.ValueToColor(VIOLET), 100, Math.round(this.level * 100));
    this.city.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
    this.glitch.setAlpha(this.level);
  }
}
