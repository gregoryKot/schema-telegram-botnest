// Тест на computeTaskProgress — вычисление прогресса стрик-задачи, общее
// для HelpSection и TodaySection (свип дублей 2026-07, «виджет задач»).
import { describe, it, expect } from 'vitest';
import { computeTaskProgress, taskProgressLabel } from './taskProgress';
import type { UserTask } from '../apiTypes';

// QA 2026-10-26: терапевт видел у серии только «В работе», клиент — «1/7».
describe('taskProgressLabel', () => {
  it('серия с прогрессом с сервера — «N из M дней»', () => {
    expect(taskProgressLabel(makeTask({ progress: 1, targetDays: 7 }))).toBe(
      '1 из 7 дней',
    );
    expect(taskProgressLabel(makeTask({ progress: 3, targetDays: 3 }))).toBe(
      '3 из 3 дней',
    );
    expect(taskProgressLabel(makeTask({ progress: 0, targetDays: 21 }))).toBe(
      '0 из 21 дня',
    );
  });

  it('прогресс больше цели не выходит за цель', () => {
    expect(taskProgressLabel(makeTask({ progress: 9, targetDays: 7 }))).toBe(
      '7 из 7 дней',
    );
  });

  it('без прогресса с сервера и у не-серий — null, а не выдуманный ноль', () => {
    expect(taskProgressLabel(makeTask({ targetDays: 7 }))).toBeNull();
    expect(
      taskProgressLabel(makeTask({ type: 'custom', progress: 1 })),
    ).toBeNull();
    expect(
      taskProgressLabel(makeTask({ targetDays: null, progress: 1 })),
    ).toBeNull();
  });
});

function makeTask(overrides: Partial<UserTask> = {}): UserTask {
  return {
    id: 1,
    userId: 1,
    assignedBy: null,
    type: 'diary_streak',
    text: '',
    targetDays: 7,
    needId: null,
    dueDate: null,
    done: null,
    completedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeTaskProgress', () => {
  it('custom-задача — прогресса нет (null)', () => {
    expect(computeTaskProgress(makeTask({ type: 'custom' }))).toBeNull();
  });

  it('нет targetDays — прогресса нет (null)', () => {
    expect(computeTaskProgress(makeTask({ targetDays: null }))).toBeNull();
  });

  it('progress не задан сервером — 0 из target', () => {
    const p = computeTaskProgress(makeTask({ progress: undefined }));
    expect(p).toEqual({ progress: 0, target: 7, pct: 0 });
  });

  it('обычный прогресс — доля посчитана верно', () => {
    const p = computeTaskProgress(makeTask({ progress: 3, targetDays: 7 }));
    expect(p).toEqual({ progress: 3, target: 7, pct: (3 / 7) * 100 });
  });

  it('server progress больше target (гонка/задержка) — обрезается до target', () => {
    const p = computeTaskProgress(makeTask({ progress: 10, targetDays: 7 }));
    expect(p).toEqual({ progress: 7, target: 7, pct: 100 });
  });
});
