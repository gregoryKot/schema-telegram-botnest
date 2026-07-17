// Тест на computeTaskProgress — вычисление прогресса стрик-задачи, общее
// для HelpSection и TodaySection (свип дублей 2026-07, «виджет задач»).
import { describe, it, expect } from 'vitest';
import { computeTaskProgress } from './TaskProgressBar';
import { UserTask } from '../../api';

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
