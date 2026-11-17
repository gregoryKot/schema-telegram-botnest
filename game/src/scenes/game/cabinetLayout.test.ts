import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAB } from './cabinetLayout';

// Шов «арт ↔ игра»: кресло нарисовано в фоне, терапевта на него сажает код — числа обязаны совпадать.
const art = (name: string) => readFileSync(new URL(`../../../art/${name}`, import.meta.url), 'utf8');
const nums = (src: string, re: RegExp) => (re.exec(src) ?? []).slice(1).map(Number);

describe('раскладка кабинета гл.4 совпадает с артом', () => {
  it('пол, кресло и сиденье — как в game/art/cabinet.py', () => {
    const py = art('cabinet.py');
    expect(nums(py, /^W, H, FLOOR = (\d+), (\d+), (\d+)/m)).toEqual([CAB.center * 2, 270, CAB.floor]);
    expect(nums(py, /^CHAIR_X, SEAT = (\d+), (\d+)/m)).toEqual([CAB.chair, CAB.seat]);
  });

  it('диван, растение и полка — как в макете ref/cabinet_scene.py', () => {
    expect(nums(art('ref/cabinet_scene.py'), /^COUCH_X, PLANT_X, SHELF_X = (\d+), (\d+), (\d+)/m))
      .toEqual([CAB.couch, CAB.plants[0], CAB.shelf]);
  });

  it('на таче (виден центр 320 px) в кадре и диван с Мистером, и кресло терапевта', () => {
    for (const x of [CAB.couch, CAB.chair]) expect(Math.abs(x - CAB.center)).toBeLessThan(160 - 24);
  });
});
