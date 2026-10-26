// @vitest-environment jsdom
// helpers.ts экрана «Сегодня»: чистые функции приветствия/даты/маркера
// статуса задач, вынесенные из TodaySection.tsx (правило №10). До этого теста — 0% покрытия.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  greeting,
  formatHeaderDate,
  readLocalIds,
  taskStatusMark,
} from './helpers';

afterEach(() => {
  vi.useRealTimers();
});

function setHour(h: number) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 15, h, 0, 0));
}

describe('greeting', () => {
  it('ночь до 5 утра — «Доброй ночи»', () => {
    setHour(3);
    expect(greeting()).toBe('Доброй ночи');
  });

  it('нижняя граница утра (5) — «Доброе утро»', () => {
    setHour(5);
    expect(greeting()).toBe('Доброе утро');
  });

  it('верхняя граница утра (11) — «Доброе утро»', () => {
    setHour(11);
    expect(greeting()).toBe('Доброе утро');
  });

  it('нижняя граница дня (12) — «Добрый день»', () => {
    setHour(12);
    expect(greeting()).toBe('Добрый день');
  });

  it('верхняя граница дня (17) — «Добрый день»', () => {
    setHour(17);
    expect(greeting()).toBe('Добрый день');
  });

  it('нижняя граница вечера (18) — «Добрый вечер»', () => {
    setHour(18);
    expect(greeting()).toBe('Добрый вечер');
  });

  it('верхняя граница вечера (22) — «Добрый вечер»', () => {
    setHour(22);
    expect(greeting()).toBe('Добрый вечер');
  });

  it('ночь с 23 — «Доброй ночи»', () => {
    setHour(23);
    expect(greeting()).toBe('Доброй ночи');
  });
});

describe('formatHeaderDate', () => {
  it('возвращает "<День недели с заглавной>, <число месяц>"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 4)); // 4 августа 2026, вторник
    const result = formatHeaderDate();
    expect(result).toMatch(/^[А-ЯЁ][а-яё]+, \d{1,2} [а-яё]+$/);
  });
});

describe('readLocalIds', () => {
  it('нет ключа в localStorage — пустой массив', () => {
    localStorage.clear();
    expect(readLocalIds('missing_key')).toEqual([]);
  });

  it('валидный JSON-массив — парсится как есть', () => {
    localStorage.setItem('ids_key', JSON.stringify(['a', 'b']));
    expect(readLocalIds('ids_key')).toEqual(['a', 'b']);
  });

  it('битый JSON — не падает, возвращает пустой массив', () => {
    localStorage.setItem('broken_key', '{not json');
    expect(readLocalIds('broken_key')).toEqual([]);
  });
});

describe('taskStatusMark', () => {
  it('done: true — ✓', () => {
    expect(taskStatusMark(true)).toBe('✓');
  });

  it('done: false — ×', () => {
    expect(taskStatusMark(false)).toBe('×');
  });

  it('done: null — · (ещё не решено)', () => {
    expect(taskStatusMark(null)).toBe('·');
  });
});
