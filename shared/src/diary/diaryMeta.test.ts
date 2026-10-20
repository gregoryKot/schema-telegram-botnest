import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { diaryRowMeta, trackerRowMeta } from './diaryMeta';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('diaryRowMeta', () => {
  it('пустой дневник: «Пока пусто», без цифр', () => {
    expect(diaryRowMeta(0)).toBe('Пока пусто');
    expect(diaryRowMeta(0, '2026-10-20T10:00:00Z')).toBe('Пока пусто');
  });

  it('склоняет «запись» и добавляет давность последней', () => {
    expect(diaryRowMeta(1, '2026-10-20T10:00:00Z')).toBe('1 запись · сегодня');
    expect(diaryRowMeta(3, '2026-10-19T10:00:00Z')).toBe('3 записи · вчера');
    expect(diaryRowMeta(12, '2026-10-17T10:00:00Z')).toBe(
      '12 записей · 3 дн. назад',
    );
    expect(diaryRowMeta(11)).toBe('11 записей');
  });
});

describe('момент из будущего (часы клиента отстают)', () => {
  it('не даёт «-1 дн. назад», а считается как «сегодня»', () => {
    expect(diaryRowMeta(1, '2026-10-20T15:00:00Z')).toBe('1 запись · сегодня');
    expect(trackerRowMeta('2026-10-21T01:00:00Z')).toBe(
      'Последняя отметка · сегодня',
    );
  });
});

describe('trackerRowMeta', () => {
  it('нет отметок — «Пока пусто», есть — давность', () => {
    expect(trackerRowMeta()).toBe('Пока пусто');
    expect(trackerRowMeta(null)).toBe('Пока пусто');
    expect(trackerRowMeta('2026-10-19T10:00:00Z')).toBe(
      'Последняя отметка · вчера',
    );
  });
});
