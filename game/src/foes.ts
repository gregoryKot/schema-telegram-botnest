import Phaser from 'phaser';
import anxUrl from './assets/enemy_anx.png';
import criticIdleUrl from './assets/critic_idle.png';
import criticRunUrl from './assets/critic_run.png';
import spikesUrl from './assets/spr_spikes.png';
import procUrl from './assets/enemy_proc.png';
import phoneUrl from './assets/enemy_phone.png';
import workUrl from './assets/prop_workload.png';
import { anxTier } from './gridScale';

// Листы game/art/foes.py, home_foes.py и pickups.py: нарисованы в сетке ×2, в игре — setScale(GRID) без дробей.
export const FOE_SHEETS: Record<string, { url: string; fw: number; fh: number; frames: number }> = {
  anxmob: { url: anxUrl, fw: 60, fh: 50, frames: 9 }, // три размера по три кадра: m, s, l
  critic_idle: { url: criticIdleUrl, fw: 36, fh: 36, frames: 12 }, // Самокритик — риг кота в холоде
  critic_run: { url: criticRunUrl, fw: 36, fh: 36, frames: 6 },
  spikes: { url: spikesUrl, fw: 8, fh: 12, frames: 3 },
  procmob: { url: procUrl, fw: 96, fh: 46, frames: 9 }, // три размера по три кадра, как у Тревоги
  phonemob: { url: phoneUrl, fw: 26, fh: 30, frames: 3 },
  workload: { url: workUrl, fw: 44, fh: 48, frames: 4 },
};

const ANIMS: [key: string, sheet: string, start: number, end: number, fps: number][] = [
  ['anx-fly-m', 'anxmob', 0, 2, 5],
  ['anx-fly-s', 'anxmob', 3, 5, 5],
  ['anx-fly-l', 'anxmob', 6, 8, 5],
  ['c-idle', 'critic_idle', 0, 11, 8],
  ['c-walk', 'critic_run', 0, 5, 16],
  ['proc-idle-m', 'procmob', 0, 2, 3],
  ['proc-idle-s', 'procmob', 3, 5, 3],
  ['proc-idle-l', 'procmob', 6, 8, 3],
  ['phone-walk', 'phonemob', 0, 2, 6],
  ['workload-wobble', 'workload', 0, 3, 6],
];

export function ensureFoeAnims(scene: Phaser.Scene) {
  for (const [key, sheet, start, end, frameRate] of ANIMS)
    if (!scene.anims.exists(key) && scene.textures.exists(sheet))
      scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(sheet, { start, end }), frameRate, repeat: -1 });
}

export const anxAnim = (size: number) => `anx-fly-${anxTier(size)}`;
export const procAnim = (size: number) => `proc-idle-${anxTier(size)}`;
// Точка привязки Прокрастинации — 10 строк арта над низом лужи (PROC_FLOOR в home_foes.py)
export const PROC_ORIGIN_Y = 1 - 10 / 46;
