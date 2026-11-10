import { fmtIndex } from './dayIndex';

/**
 * Знак отличия индекса — по показанному (округлённому до десятых) числу: −0,04 показывается «+0,0»,
 * значит и знак +1. Один источник на текст (fmtIndexDelta) и на цвет рядом с ним (ClientIndexCard):
 * плюс красным не бывает (ревью g2 r5).
 */
export const deltaSign = (delta: number): 1 | -1 =>
  delta < 0 && fmtIndex(-delta) !== '0,0' ? -1 : 1;

/** Отличие индекса со знаком: «+2,0», «−1,5» (типографский минус); знак — deltaSign, без «−0,0». */
export const fmtIndexDelta = (delta: number): string =>
  `${deltaSign(delta) < 0 ? '−' : '+'}${fmtIndex(Math.abs(delta))}`;
