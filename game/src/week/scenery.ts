// Фон главы по её месту: офис хука, вечерняя квартира «Среды», квартира друзей «Пятницы», пустая своя — «Воскресенья» или кабинет эпилога.
import type Phaser from 'phaser';
import type { Chapter } from './chapter';
import { WeekBackdrop } from './backdrop';
import { CABINET, FlatBackdrop, PARTY, QUIET, WED } from './flatBackdrop';

export interface Backdrop {
  /** glitch — сколько сбоя сейчас (0..1). */
  update(scrollX: number, glitch: number): void;
  /** Сбой назван, цель в nearSteps: фон встаёт под неё; возвращает x, над которым звучит последняя реплика. */
  settle(doorX: number): number;
}

export function makeBackdrop(scene: Phaser.Scene, ch: Chapter): Backdrop {
  const flat = { flat: WED, party: PARTY, quiet: QUIET, cabinet: CABINET, office: undefined }[ch.scenery];
  if (flat) return new FlatBackdrop(scene, flat);
  return new WeekBackdrop(scene, ch.beats[0].x, ch.beats[1].x - 60, ch.hallX ?? ch.worldW, ch.worldW);
}
