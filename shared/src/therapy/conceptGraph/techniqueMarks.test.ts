// Отметки «Делали сегодня» (#995): нормализация, переключение в тот же день,
// потолок DTO и строка «делали …». День — календарный, показывается как есть:
// зона машины на подпись не влияет.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONCEPT_TECHNIQUE_MARKS_MAX } from '../../limits/textLimits';
import { forEachTimeZone } from '../../utils/timeZone.test-helpers';
import {
  type MarkedLink,
  isMarkedOn,
  normalizeTechniqueMarks,
  techniqueMarkHistory,
  techniqueMarkLabel,
  toggleLinkMark,
} from './techniqueMarks';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-07T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

const mark = (techniqueId: string, day: string) => ({ techniqueId, day });

describe('normalizeTechniqueMarks', () => {
  it('не массив — пусто; битые элементы и повтор того же дня выбрасываются', () => {
    expect(normalizeTechniqueMarks(undefined)).toEqual([]);
    expect(normalizeTechniqueMarks('x')).toEqual([]);
    expect(
      normalizeTechniqueMarks([
        null,
        'chairwork',
        { techniqueId: '', day: '2026-11-05' },
        { techniqueId: 'chairwork', day: '05.11.2026' },
        { techniqueId: 'chairwork', day: '2026-11-05T10:00:00Z' },
        { techniqueId: 1, day: '2026-11-05' },
        { techniqueId: 'chairwork', day: '2026-11-05', note: 'лишнее' },
        { techniqueId: 'chairwork', day: '2026-11-05' },
      ]),
    ).toEqual([mark('chairwork', '2026-11-05')]);
  });

  it('больше потолка DTO — остаются последние', () => {
    const many = Array.from(
      { length: CONCEPT_TECHNIQUE_MARKS_MAX + 5 },
      (_, i) => mark(`t${i}`, '2026-11-05'),
    );
    const out = normalizeTechniqueMarks(many);
    expect(out).toHaveLength(CONCEPT_TECHNIQUE_MARKS_MAX);
    expect(out[0].techniqueId).toBe('t5');
  });
});

describe('toggleLinkMark — «Делали сегодня» и повторный тап', () => {
  const link: MarkedLink & { modeId: string; alias: string } = {
    modeId: 'vulnerable_child',
    alias: 'Маленькая',
  };

  it('отметки дня нет — ставится, остальные поля связи на месте', () => {
    const r = toggleLinkMark(link, 'chairwork', '2026-11-07');
    expect(r.added).toBe(true);
    expect(r.link).toEqual({
      ...link,
      done: [mark('chairwork', '2026-11-07')],
    });
    expect(link).not.toHaveProperty('done');
  });

  it('тот же день — снимается только сегодняшняя, прошлые остаются', () => {
    const marked = {
      ...link,
      done: [mark('chairwork', '2026-11-05'), mark('chairwork', '2026-11-07')],
    };
    const r = toggleLinkMark(marked, 'chairwork', '2026-11-07');
    expect(r.added).toBe(false);
    expect(r.link.done).toEqual([mark('chairwork', '2026-11-05')]);
  });

  it('другая техника в тот же день — своя отметка', () => {
    const marked = { ...link, done: [mark('chairwork', '2026-11-07')] };
    const r = toggleLinkMark(marked, 'imagery_rescripting', '2026-11-07');
    expect(r.added).toBe(true);
    expect(isMarkedOn(r.link.done, 'chairwork', '2026-11-07')).toBe(true);
    expect(isMarkedOn(r.link.done, 'imagery_rescripting', '2026-11-07')).toBe(
      true,
    );
    expect(isMarkedOn(r.link.done, 'imagery_rescripting', '2026-11-06')).toBe(
      false,
    );
  });

  it('у полной связи новая отметка вытесняет самую старую, а не роняет сохранение', () => {
    const full = {
      done: Array.from({ length: CONCEPT_TECHNIQUE_MARKS_MAX }, (_, i) =>
        mark(`t${i}`, '2026-11-01'),
      ),
    };
    const r = toggleLinkMark(full, 'chairwork', '2026-11-07');
    expect(r.link.done).toHaveLength(CONCEPT_TECHNIQUE_MARKS_MAX);
    expect(r.link.done[0].techniqueId).toBe('t1');
    expect(r.link.done.at(-1)).toEqual(mark('chairwork', '2026-11-07'));
  });
});

describe('techniqueMarkHistory / techniqueMarkLabel', () => {
  const marks = [
    mark('chairwork', '2026-11-05'),
    mark('imagery_rescripting', '2026-10-01'),
    mark('chairwork', '2026-10-20'),
  ];

  it('ни разу — null; считается только своя техника, последний — самый поздний день', () => {
    expect(techniqueMarkHistory(undefined, 'chairwork')).toBeNull();
    expect(techniqueMarkHistory(marks, 'flashcards')).toBeNull();
    expect(techniqueMarkHistory(marks, 'chairwork')).toEqual({
      count: 2,
      lastDay: '2026-11-05',
    });
  });

  it('один раз — день; несколько — «N раз(а), последний …»', () => {
    expect(techniqueMarkLabel({ count: 1, lastDay: '2026-11-05' })).toBe(
      'делали 5 ноя',
    );
    expect(techniqueMarkLabel({ count: 2, lastDay: '2026-11-05' })).toBe(
      'делали 2 раза, последний 5 ноя',
    );
    expect(techniqueMarkLabel({ count: 5, lastDay: '2025-12-30' })).toBe(
      'делали 5 раз, последний 30 дек 2025',
    );
  });

  it('день отметки показывается как есть в любой зоне', () => {
    forEachTimeZone((tz) => {
      expect([
        tz,
        techniqueMarkLabel({ count: 1, lastDay: '2026-11-01' }),
      ]).toEqual([tz, 'делали 1 ноя']);
    });
  });
});
