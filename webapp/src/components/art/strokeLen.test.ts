// Одна шкала «оценка → длина полоски» на знак Strokes values и сегодняшний лист SceneCheckIn values (ревью g2 r5:
// у сцены была своя шкала и свой «пенёк» для неоценённой — цветной и ниже оценки 1).
import { describe, expect, it } from 'vitest';
import { CHECK_IN_GEOM, EMPTY_SHARE, STROKES_GEOM, strokeLen } from './strokeLen';

describe('strokeLen — оценка → длина полоски', () => {
  it('знак Strokes: от кружка 16 до 84, пустое место 72 — как было', () => {
    expect([0, 1, 5, 10, 12].map((v) => strokeLen(v, STROKES_GEOM))).toEqual([16, 23, 50, 84, 84]);
    expect(strokeLen(null, STROKES_GEOM)).toBe(72);
  });

  it('сегодняшний лист сцены: та же доля в своём холсте; пустое место — та же доля, выше оценки 1', () => {
    expect([1, 5, 10].map((v) => strokeLen(v, CHECK_IN_GEOM))).toEqual([31, 75, 130]);
    const empty = strokeLen(null, CHECK_IN_GEOM);
    expect(empty).toBe(CHECK_IN_GEOM.min + Math.round(EMPTY_SHARE * (CHECK_IN_GEOM.max - CHECK_IN_GEOM.min)));
    expect(empty).toBeGreaterThan(strokeLen(1, CHECK_IN_GEOM));
  });
});
