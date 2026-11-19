// Фон квартиры («Среда», «Пятница»): вечерний город за окнами едет медленнее мира, комната тянется плиткой без конца;
// сбой проявляется поверх (индиго), город за окнами темнеет вместе с ним; в «Пятнице» пол в сбое едет к выходу.
import Phaser from 'phaser';
import { GROUND_Y, W } from '../constants';
import { GRID } from '../gridScale';
import { audio } from '../audio';
import type { Backdrop } from './scenery';

const FEET = 215, TILE_H = 270; // строка стоп и высота плитки, px арта (game/art/week_wed.py)
const CALM = 0xffffff, VIOLET = 0x8a5cff;
type Tile = Phaser.GameObjects.TileSprite;

/** Какими листами рисуется комната; floor — полоса пола, которая в сбое едет к выходу (назад). */
export interface FlatArt { city: string; room: string; glitch: string; floor?: string }
const WED: FlatArt = { city: 'bg_wk_city_eve', room: 'bg_wk_flat', glitch: 'bg_wk_flat_glitch' };
export const PARTY: FlatArt = { city: 'bg_wk_city_eve', room: 'bg_wk_party', glitch: 'bg_wk_party_glitch', floor: 'bg_wk_exit_floor' };
const FLOOR_TOP = 219, FLOOR_H = 48, FLOOR_PX_MS = 0.06; // строка и высота полосы пола, px арта; скорость — px арта в мс

export class FlatBackdrop implements Backdrop {
  private city: Tile; private flat: Tile; private glitch: Tile; private floor?: Tile;
  private level = 0; private dull = 0;

  constructor(private scene: Phaser.Scene, art: FlatArt = WED) {
    const top = GROUND_Y - FEET * GRID;
    const tile = (key: string, h: number, depth: number) =>
      scene.add.tileSprite(0, top, W / GRID, h, key).setOrigin(0, 0).setScale(GRID).setScrollFactor(0).setDepth(depth);
    this.city = tile(art.city, 200, -30);
    this.flat = tile(art.room, TILE_H, -20);
    this.glitch = tile(art.glitch, TILE_H, -19).setAlpha(0);
    if (art.floor) this.floor = tile(art.floor, FLOOR_H, -18).setY(top + FLOOR_TOP * GRID).setAlpha(0);
  }

  /** Цель — сам телефон с мамой или Женя с тортом: реплика звучит над ней. */
  settle(doorX: number): number { return doorX; }

  update(scrollX: number, glitch: number) {
    this.level += ((glitch > 0.02 ? 0.72 + 0.28 * glitch : 0) - this.level) * 0.08;
    this.city.tilePositionX = scrollX * 0.25 / GRID;
    this.flat.tilePositionX = this.glitch.tilePositionX = scrollX / GRID;
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(CALM), Phaser.Display.Color.ValueToColor(VIOLET), 100, Math.round(this.level * 100));
    this.city.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
    this.glitch.setAlpha(this.level);
    if (!this.floor) return;
    this.floor.setAlpha(this.level).setTilePosition(scrollX / GRID + this.scene.time.now * FLOOR_PX_MS, 0);
    const dull = Math.round(this.level * 10) / 10; // в сбое вечеринки музыка глохнет
    if (dull !== this.dull) audio.setIntensity(-(this.dull = dull));
  }
}
