// Арт «Понедельника» (game/art/week*.py): загрузка листов и анимации Саши. Кадры выбирает week/look.ts.
import Phaser from 'phaser';
import city from '../assets/bg_wk_city.png';
import home from '../assets/bg_wk_home.png';
import street from '../assets/bg_wk_street.png';
import office from '../assets/bg_wk_office.png';
import officeGlitch from '../assets/bg_wk_office_glitch.png';
import corridor from '../assets/bg_wk_corridor.png';
import corridorGlitch from '../assets/bg_wk_corridor_glitch.png';
import bossRoom from '../assets/bg_wk_boss_room.png';
import arch from '../assets/wk_arch.png';
import notifWall from '../assets/wk_notif_wall.png';
import curb from '../assets/wk_curb.png';
import step from '../assets/wk_step.png';
import stepHi from '../assets/wk_step_hi.png';
import puddle from '../assets/wk_puddle.png';
import piles from '../assets/wk_piles.png';
import door from '../assets/wk_door.png';
import mister from '../assets/wk_mister.png';
import colA from '../assets/wk_colleague_a.png';
import colB from '../assets/wk_colleague_b.png';
import colC from '../assets/wk_colleague_c.png';
import colBox from '../assets/wk_colleague_box.png';

const sasha = import.meta.glob<string>('../assets/wk_sasha_*.png', { eager: true, import: 'default' });
const IMAGES = { bg_wk_city: city, bg_wk_home: home, bg_wk_street: street, bg_wk_office: office, bg_wk_office_glitch: officeGlitch,
  bg_wk_corridor: corridor, bg_wk_corridor_glitch: corridorGlitch, bg_wk_boss_room: bossRoom, wk_arch: arch,
  wk_notif_wall: notifWall, wk_curb: curb, wk_step: step, wk_step_hi: stepHi, wk_puddle: puddle };
const SHEETS: Record<string, [url: string, fw: number, fh: number]> = {
  wk_piles: [piles, 26, 88], wk_door: [door, 34, 62], wk_mister: [mister, 36, 36],
  wk_colleague_a: [colA, 40, 60], wk_colleague_b: [colB, 40, 60], wk_colleague_c: [colC, 40, 60], wk_colleague_box: [colBox, 40, 60],
};
for (const [path, url] of Object.entries(sasha)) SHEETS[path.slice(path.lastIndexOf('/') + 1, -4)] = [url, 40, 60];

// анимация -> лист, кадры, скорость
const ANIMS: [name: string, sheet: string, from: number, to: number, rate: number][] = [
  ['idle', 'idle', 0, 3, 3], ['walk', 'walk', 0, 5, 9], ['run', 'run', 0, 7, 14], ['phone', 'phone', 0, 7, 14],
  ['dash', 'dash', 0, 1, 14], ['trudge', 'still', 2, 7, 5],
];

export function preloadWeekArt(scene: Phaser.Scene) {
  for (const [key, url] of Object.entries(IMAGES)) if (!scene.textures.exists(key)) scene.load.image(key, url);
  for (const [key, [url, fw, fh]] of Object.entries(SHEETS))
    if (!scene.textures.exists(key)) scene.load.spritesheet(key, url, { frameWidth: fw, frameHeight: fh });
}

export function makeWeekAnims(scene: Phaser.Scene) {
  const add = (key: string, sheet: string, start: number, end: number, frameRate: number) => {
    if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(sheet, { start, end }), frameRate, repeat: -1 });
  };
  for (const heavy of ['', '_heavy'])
    for (const [name, sheet, from, to, rate] of ANIMS) add(`wk-${name}${heavy}`, `wk_sasha_${sheet}${heavy}`, from, to, rate);
  add('wk-mister', 'wk_mister', 0, 2, 2);
}
