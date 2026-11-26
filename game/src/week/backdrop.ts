// Фон «Понедельника»: город вдали едет медленнее мира; квартира — улица — опенспейс — коридор стоят в мире,
// сбой проявляется поверх офиса, кабинет начальницы встаёт в стену коридора, когда сбой назван.
import Phaser from 'phaser';
import { GROUND_Y, W } from '../constants';
import { GRID } from '../gridScale';
import { zoneOnScreen } from './look';

const FEET = 215, TILE_H = 270;           // строка стоп и высота плитки фона, px арта (game/art/week_office.py)
const CALM = 0xffffff, VIOLET = 0x8a5cff;
const PERIOD = 480 * GRID, ROOM_DOOR = 25 * GRID, ROOM_BOSS = 176 * GRID; // плитка коридора; дверь и начальница во вставке кабинета
type Tile = Phaser.GameObjects.TileSprite;

export class WeekBackdrop {
  private city: Tile; private street: Tile; private office: Tile; private glitch: Tile; private hall: Tile; private hallGlitch: Tile;
  private arch: Phaser.GameObjects.Image; private room: Phaser.GameObjects.Image;
  private level = 0; private phase = 0;
  /** streetX, officeX, hallX — где в мире кончается квартира, начинается опенспейс и где он переходит в коридор. */
  constructor(scene: Phaser.Scene, private streetX: number, private officeX: number, private hallX: number, private worldW: number) {
    const top = GROUND_Y - FEET * GRID;
    const tile = (key: string, h: number, depth: number) =>
      scene.add.tileSprite(0, top, W / GRID, h, key).setOrigin(0, 0).setScale(GRID).setScrollFactor(0).setDepth(depth);
    this.city = tile('bg_wk_city', 200, -30);
    scene.add.image(0, top, 'bg_wk_home').setOrigin(0, 0).setScale(GRID).setDepth(-20);
    this.street = tile('bg_wk_street', TILE_H, -21);
    this.office = tile('bg_wk_office', TILE_H, -20);
    this.glitch = tile('bg_wk_office_glitch', TILE_H, -19).setAlpha(0);
    this.hall = tile('bg_wk_corridor', TILE_H, -20);
    this.hallGlitch = tile('bg_wk_corridor_glitch', TILE_H, -19).setAlpha(0);
    this.room = scene.add.image(0, top, 'bg_wk_boss_room').setOrigin(0, 0).setScale(GRID).setDepth(-18).setVisible(false);
    this.arch = scene.add.image(hallX, GROUND_Y, 'wk_arch').setOrigin(0.5, 1).setScale(GRID).setDepth(-17); // торец перегородки закрывает стык плиток
  }

  /** Сбой назван: кабинет встаёт так, чтобы его дверь совпала с дверью мира; плитка коридора сдвигается под него. Возвращает x начальницы. */
  settle(doorX: number): number {
    const x = doorX - ROOM_DOOR;
    this.phase = (((this.hallX - x) % PERIOD) + PERIOD) % PERIOD;
    this.room.setX(x).setVisible(true);
    return x + ROOM_BOSS;
  }

  private place(t: Tile, from: number, to: number, scrollX: number, phase = 0) {
    const z = zoneOnScreen(from, to, scrollX, W);
    t.setVisible(!!z);
    if (!z) return;
    t.setX(z.left); t.width = z.width / GRID; t.tilePositionX = z.tileX + phase / GRID;
  }

  /** glitch — сколько сбоя сейчас (0..1): офис уходит в индиго плавно, город за окнами темнеет вместе с ним. */
  update(scrollX: number, glitch: number) {
    this.level += ((glitch > 0.02 ? 0.72 + 0.28 * glitch : 0) - this.level) * 0.08;
    this.city.tilePositionX = scrollX * 0.25 / GRID;
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(CALM), Phaser.Display.Color.ValueToColor(VIOLET), 100, Math.round(this.level * 100));
    const tint = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    this.city.setTint(tint); this.arch.setTint(tint);
    this.place(this.street, this.streetX - 4 * GRID, this.officeX, scrollX); // нахлёст под стену квартиры: шва не видно
    this.place(this.office, this.officeX, this.hallX, scrollX);
    this.place(this.glitch, this.officeX, this.hallX, scrollX);
    this.place(this.hall, this.hallX, this.worldW, scrollX, this.phase);
    this.place(this.hallGlitch, this.hallX, this.worldW, scrollX, this.phase);
    this.glitch.setAlpha(this.level); this.hallGlitch.setAlpha(this.level);
  }
}
