// Фон главы по её месту: офис хука, вечерняя квартира «Среды», квартира друзей «Пятницы» или пустая своя — «Воскресенья».
import type Phaser from 'phaser';
import type { Chapter } from './chapter';
import { WeekBackdrop } from './backdrop';
import { FlatBackdrop, PARTY, QUIET } from './flatBackdrop';

export interface Backdrop {
  /** glitch — сколько сбоя сейчас (0..1). */
  update(scrollX: number, glitch: number): void;
  /** Сбой назван, цель в nearSteps: фон встаёт под неё; возвращает x, над которым звучит последняя реплика. */
  settle(doorX: number): number;
}

export function makeBackdrop(scene: Phaser.Scene, ch: Chapter): Backdrop {
  if (ch.scenery === 'flat') return new FlatBackdrop(scene);
  if (ch.scenery === 'party') return new FlatBackdrop(scene, PARTY);
  if (ch.scenery === 'quiet') return new FlatBackdrop(scene, QUIET);
  return new WeekBackdrop(scene, ch.beats[0].x, ch.beats[1].x - 60, ch.hallX ?? ch.worldW, ch.worldW);
}
