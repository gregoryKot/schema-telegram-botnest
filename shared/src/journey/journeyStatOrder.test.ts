import { describe, it, expect } from 'vitest';
import { MIN_NEIGHBOR_GAP, spreadStatTiles } from './journeyStatOrder';

const gap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
/** Соседи в сетке 2 и 3 колонки. */
const closeNeighbors = (hues: number[]) => {
  let close = 0;
  for (const cols of [2, 3])
    hues.forEach((h, i) => {
      if ((i + 1) % cols && i + 1 < hues.length && gap(h, hues[i + 1]) < MIN_NEIGHBOR_GAP) close++;
      if (i + cols < hues.length && gap(h, hues[i + cols]) < MIN_NEIGHBOR_GAP) close++;
    });
  return close;
};

describe('spreadStatTiles', () => {
  it('профиль с ревью: трекер 70, заметки 45, практики 145/135, дыхание 195, письмо 290 — соседи ≥40°', () => {
    const tiles = [70, 45, 145, 135, 195, 290];
    const out = spreadStatTiles(tiles, (h) => h);
    expect([...out].sort()).toEqual([...tiles].sort());
    expect(closeNeighbors(out)).toBe(0);
  });

  it('уже разведённый порядок не трогает: самое частое остаётся первым', () => {
    const tiles = [70, 240, 135, 310, 28, 195];
    expect(spreadStatTiles(tiles, (h) => h)).toEqual(tiles);
  });

  it('развести нельзя (все одного оттенка) — порядок по числу как был', () => {
    expect(spreadStatTiles([70, 70, 70], (h) => h)).toEqual([70, 70, 70]);
  });

  it('без оттенка — соседство не считается; одна плитка и пусто — как есть', () => {
    expect(spreadStatTiles(['a', 'b'], () => undefined)).toEqual(['a', 'b']);
    expect(spreadStatTiles([1], (h) => h)).toEqual([1]);
    expect(spreadStatTiles([], () => 0)).toEqual([]);
  });
});
