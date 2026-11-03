// @vitest-environment jsdom
// Счётчик активных заданий в шапке блока «Задания» на «Сегодня»: форма слова
// по числу (1 активная / 2 активные / 5 активных). До 2026-11 вторая форма
// была «активных», и экран писал «2 активных».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PracticesBlock } from './PracticesBlock';
import type { UserTask } from '../../api';

afterEach(() => cleanup());

const task = (id: number, done: boolean | null = null) =>
  ({
    id, userId: 1, assignedBy: null, type: 'custom', text: `Задача ${id}`,
    targetDays: null, needId: null, dueDate: null, done,
    completedAt: null, createdAt: '2026-08-01T00:00:00Z', doneToday: false,
  }) as unknown as UserTask;

function renderBlock(tasks: UserTask[]) {
  return render(
    <PracticesBlock title="Задания" tasks={tasks} taskError={false}
      onStart={vi.fn()} onComplete={vi.fn()} onShowAll={vi.fn()} onAddGoal={vi.fn()} />,
  );
}

describe('PracticesBlock — счётчик активных', () => {
  it.each([
    [1, '1 активная'],
    [2, '2 активные'],
    [4, '4 активные'],
    [5, '5 активных'],
    [11, '11 активных'],
    [22, '22 активные'],
  ])('%i → «%s»', (n, text) => {
    renderBlock(Array.from({ length: n }, (_, i) => task(i + 1)));
    expect(screen.getByText(text)).toBeTruthy();
  });

  it('выполненные не считаются; активных нет — счётчика нет', () => {
    renderBlock([task(1, true), task(2, true)]);
    expect(screen.queryByText(/активн/)).toBeNull();
  });
});
