// Фон «Понедельника»: город вдали едет медленнее мира, квартира — улица — офис стоят в мире, сбой проявляется поверх офиса.
import Phaser from 'phaser';
import { GROUND_Y, W } from '../constants';
import { GRID } from '../gridScale';
import { zoneOnScreen } from './look';

const FEET = 215, TILE_H = 270;           // строка стоп и высота плитки фона, px арта (game/art/week_office.py)
const CALM = 0xffffff, VIOLET = 0x8a5cff;
type Tile = Phaser.GameObjects.TileSprite;

export class WeekBackdrop {
  private city: Tile; private street: Tile; private office: Tile; private glitch: Tile;
  private level = 0;
  /** streetX, officeX — где в мире кончается квартира и где начинается офис. */
  constructor(scene: Phaser.Scene, private streetX: number, private officeX: number, private worldW: number) {
    const top = GROUND_Y - FEET * GRID;
    const tile = (key: string, h: number, depth: number) =>
      scene.add.tileSprite(0, top, W / GRID, h, key).setOrigin(0, 0).setScale(GRID).setScrollFactor(0).setDepth(depth);
    this.city = tile('bg_wk_city', 200, -30);
    scene.add.image(0, top, 'bg_wk_home').setOrigin(0, 0).setScale(GRID).setDepth(-20);
    this.street = tile('bg_wk_street', TILE_H, -21);
    this.office = tile('bg_wk_office', TILE_H, -20);
    this.glitch = tile('bg_wk_office_glitch', TILE_H, -19).setAlpha(0);
  }

  private place(t: Tile, from: number, to: number, scrollX: number) {
    const z = zoneOnScreen(from, to, scrollX, W);
    t.setVisible(!!z);
    if (!z) return;
    t.setX(z.left); t.width = z.width / GRID; t.tilePositionX = z.tileX;
  }

  /** glitch — сколько сбоя сейчас (0..1): офис уходит в индиго плавно, город за окнами темнеет вместе с ним. */
  update(scrollX: number, glitch: number) {
    this.level += ((glitch > 0.02 ? 0.72 + 0.28 * glitch : 0) - this.level) * 0.08;
    this.city.tilePositionX = scrollX * 0.25 / GRID;
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(CALM), Phaser.Display.Color.ValueToColor(VIOLET), 100, Math.round(this.level * 100));
    this.city.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
    this.place(this.street, this.streetX - 4 * GRID, this.officeX, scrollX); // нахлёст под стену квартиры: шва не видно
    this.place(this.office, this.officeX, this.worldW, scrollX);
    this.place(this.glitch, this.officeX, this.worldW, scrollX);
    this.glitch.setAlpha(this.level);
  }
}
