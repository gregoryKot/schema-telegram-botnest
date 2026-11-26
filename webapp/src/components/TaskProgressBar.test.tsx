// @vitest-environment jsdom
// Прогресс стрик-цели на сайте (паритет с мини-аппом, этап 3). Числа считает
// shared/computeTaskProgress (свой тест там), здесь — что они дошли до экрана.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TaskProgressBar } from './TaskProgressBar';
import type { UserTask } from '../api';

afterEach(cleanup);

const task = (o: Partial<UserTask>): UserTask => ({
  id: 1, userId: 1, assignedBy: null, type: 'diary_streak', text: '', targetDays: 7,
  needId: null, dueDate: null, done: null, completedAt: null, createdAt: '2026-07-01T00:00:00.000Z', ...o,
} as UserTask);

describe('TaskProgressBar', () => {
  it('стрик-цель: показывает серверный прогресс «3/7»', () => {
    render(<TaskProgressBar task={task({ progress: 3 })} />);
    expect(screen.getByText('3/7')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('3');
  });

  it('прогресс больше цели обрезается до цели', () => {
    render(<TaskProgressBar task={task({ progress: 10 })} />);
    expect(screen.getByText('7/7')).toBeTruthy();
  });

  it('обычная задача без targetDays — ничего не рисует', () => {
    const { container } = render(<TaskProgressBar task={task({ type: 'custom', targetDays: null })} />);
    expect(container.textContent).toBe('');
  });
});
