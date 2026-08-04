// @vitest-environment jsdom
// helpers.ts экрана «Сегодня»: чистые функции приветствия/даты/резолва задач,
// вынесенные из TodaySection.tsx (правило №10). До этого теста — 0% покрытия.
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { UserTask } from '../../api.types';
import {
  greeting,
  formatHeaderDate,
  readLocalIds,
  resolveTaskText,
  resolveTaskEmoji,
  TASK_EMOJI,
} from './helpers';

afterEach(() => {
  vi.useRealTimers();
});

function setHour(h: number) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 15, h, 0, 0));
}

function makeTask(overrides: Partial<UserTask> = {}): UserTask {
  return {
    id: 1,
    userId: 1,
    assignedBy: null,
    type: 'custom',
    text: 'что-то сделать',
    targetDays: null,
    needId: null,
    dueDate: null,
    done: null,
    completedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
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

describe('resolveTaskText', () => {
  it('schema_intro — текст из getTaskDisplayText (display ≠ raw text, внешний if false)', () => {
    const task = makeTask({ type: 'schema_intro', text: 'abandonment' });
    expect(resolveTaskText(task)).toBe('Карточка схемы: Покинутость / Нестабильность');
  });

  it('нераспознанный type, text — валидный id схемы (легаси-задача без typed schema_intro)', () => {
    const task = makeTask({ type: 'custom', text: 'abandonment' });
    expect(resolveTaskText(task)).toBe('Покинутость / Нестабильность');
  });

  it('нераспознанный type, text — валидный id режима', () => {
    const task = makeTask({ type: 'custom', text: 'vulnerable_child' });
    expect(resolveTaskText(task)).toBe('Уязвимый Ребёнок');
  });

  it('нераспознанный type, text — не схема и не режим — возвращает text как есть', () => {
    const task = makeTask({ type: 'custom', text: 'обычный текст задачи' });
    expect(resolveTaskText(task)).toBe('обычный текст задачи');
  });
});

describe('resolveTaskEmoji', () => {
  it('известный type из TASK_EMOJI — берёт эмодзи из карты', () => {
    const task = makeTask({ type: 'diary_streak', text: 'x' });
    expect(resolveTaskEmoji(task)).toBe(TASK_EMOJI.diary_streak);
  });

  it('type не в карте, text — id схемы — 🧩', () => {
    const task = makeTask({ type: 'unknown_type', text: 'abandonment' });
    expect(resolveTaskEmoji(task)).toBe('🧩');
  });

  it('type не в карте, text — id режима — 🔄', () => {
    const task = makeTask({ type: 'unknown_type', text: 'vulnerable_child' });
    expect(resolveTaskEmoji(task)).toBe('🔄');
  });

  it('ничего не совпало — фолбэк 🎯', () => {
    const task = makeTask({ type: 'unknown_type', text: 'что-то произвольное' });
    expect(resolveTaskEmoji(task)).toBe('🎯');
  });
});
