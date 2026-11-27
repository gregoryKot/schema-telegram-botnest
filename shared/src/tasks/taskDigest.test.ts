import { describe, expect, it } from 'vitest';
import { rosterTasksMark, sessionTasksLine, taskDigest } from './taskDigest';

const TODAY = '2026-11-27'; // пятница
const task = (
  done: boolean | null,
  completedAt: string | null = null,
  dueDate: string | null = null,
) => ({ done, completedAt, dueDate });

describe('taskDigest', () => {
  const client = { nextSession: '2026-11-27T10:00', meetingDays: [5] };
  it('выполненное считается с прошлой встречи, ждущее — всё открытое', () => {
    const d = taskDigest(
      [
        task(true, '2026-11-22T09:00:00Z'), // после встречи 20-го
        task(true, '2026-11-15T09:00:00Z'), // до неё — уже обсудили
        task(null), // в работе
        task(null, null, '2026-11-01'), // просрочено — тоже ждёт
        task(false, '2026-11-25T09:00:00Z'), // «не вышло» — не ждёт и не выполнено
      ],
      client,
      TODAY,
    );
    expect(d).toEqual({ done: 1, waiting: 2, sinceSession: true });
  });
  it('прошлой встречи не знаем — выполненное за последнюю неделю', () => {
    const d = taskDigest(
      [task(true, '2026-11-22T09:00:00Z'), task(true, '2026-11-10T09:00:00Z')],
      { nextSession: null, meetingDays: [] },
      TODAY,
    );
    expect(d).toEqual({ done: 1, waiting: 0, sinceSession: false });
  });
});

describe('подписи', () => {
  it('строка сессии: оба числа; нечего сказать — строки нет', () => {
    expect(sessionTasksLine({ done: 2, waiting: 1, sinceSession: true })).toBe(
      'задания: 2 выполнено · 1 ждёт',
    );
    expect(sessionTasksLine({ done: 0, waiting: 3, sinceSession: false })).toBe(
      'задания: 0 выполнено · 3 ждёт',
    );
    expect(
      sessionTasksLine({ done: 0, waiting: 0, sinceSession: true }),
    ).toBeNull();
  });
  it('отметка списка — только при выполненных, с честным отсчётом', () => {
    expect(rosterTasksMark({ done: 2, waiting: 0, sinceSession: true })).toBe(
      'выполнено с прошлой встречи: 2',
    );
    expect(rosterTasksMark({ done: 1, waiting: 0, sinceSession: false })).toBe(
      'выполнено за неделю: 1',
    );
    expect(
      rosterTasksMark({ done: 0, waiting: 4, sinceSession: true }),
    ).toBeNull();
  });
});
