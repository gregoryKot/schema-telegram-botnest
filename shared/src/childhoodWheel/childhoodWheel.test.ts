import { describe, it, expect } from 'vitest';
import { NEED_ORDER } from '../needs/types';
import { ALL_SCHEMAS } from '../schemaTherapy/schemaTherapyData';
import {
  CHILDHOOD_SCHEMA_HINTS,
  childhoodAverage,
  defaultChildhoodRatings,
  exampleTone,
  hintSchemas,
  lowNeedIds,
  readSavedRatings,
} from './childhoodWheel';
import { CHILDHOOD_EXAMPLES } from './childhoodExamples';

describe('readSavedRatings', () => {
  it('пустой ответ сервера — «ещё не проходили», а не пятёрки по всем', () => {
    expect(readSavedRatings({})).toEqual({
      ratings: defaultChildhoodRatings(),
      hasSaved: false,
    });
    expect(readSavedRatings(null).hasSaved).toBe(false);
  });

  it('сохранённые значения перекрывают дефолт, недостающие остаются серединой', () => {
    const { ratings, hasSaved } = readSavedRatings({
      attachment: 2,
      limits: 9,
    });
    expect(hasSaved).toBe(true);
    expect(ratings).toEqual({
      attachment: 2,
      autonomy: 5,
      expression: 5,
      play: 5,
      limits: 9,
    });
  });

  it('мусор (вне 0–10, не число) не считается сохранённым', () => {
    const { ratings, hasSaved } = readSavedRatings({
      attachment: 42,
      autonomy: NaN,
      play: -1,
    });
    expect(hasSaved).toBe(false);
    expect(ratings).toEqual(defaultChildhoodRatings());
  });

  it('ноль — валидная оценка («почти не было»)', () => {
    const { ratings, hasSaved } = readSavedRatings({ play: 0 });
    expect(hasSaved).toBe(true);
    expect(ratings.play).toBe(0);
  });
});

describe('lowNeedIds / childhoodAverage', () => {
  it('порог: 4 — ещё дефицит, 5 — уже нет', () => {
    const r = {
      ...defaultChildhoodRatings(),
      attachment: 4,
      play: 5,
      limits: 0,
    };
    expect(lowNeedIds(r)).toEqual(['attachment', 'limits']);
  });

  it('среднее округляется до десятых', () => {
    expect(
      childhoodAverage({
        attachment: 1,
        autonomy: 2,
        expression: 2,
        play: 2,
        limits: 2,
      }),
    ).toBe(1.8);
  });
});

describe('exampleTone', () => {
  it('границы бейджей: 3 — дефицит, 4–7 — середина, 8 — насыщение', () => {
    expect(exampleTone(3)).toBe('low');
    expect(exampleTone(4)).toBe('mid');
    expect(exampleTone(7)).toBe('mid');
    expect(exampleTone(8)).toBe('high');
  });
});

describe('сверка реестров (правило №4)', () => {
  it('каждая схема из подсказок существует в справочнике схем', () => {
    for (const id of NEED_ORDER) {
      const { schemaIds } = CHILDHOOD_SCHEMA_HINTS[id];
      expect(hintSchemas(id).map((s) => s.id)).toEqual(schemaIds);
      for (const sid of schemaIds)
        expect(ALL_SCHEMAS.some((s) => s.id === sid)).toBe(true);
    }
  });

  it('у каждой потребности четыре примера с возрастающей оценкой', () => {
    for (const id of NEED_ORDER) {
      const scores = CHILDHOOD_EXAMPLES[id].map((e) => e.score);
      expect(scores).toHaveLength(4);
      expect([...scores].sort((a, b) => a - b)).toEqual(scores);
    }
  });
});
