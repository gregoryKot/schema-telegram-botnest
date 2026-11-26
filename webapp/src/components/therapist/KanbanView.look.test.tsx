// @vitest-environment jsdom
// Вид доски «Задания» (b29): колонка — бумага своего статуса, знак Check — только у «Выполнено»;
// у карточки — знак типа задания (TaskSign, как у клиента), Talk на каждой карточке больше нет;
// сбой — PaperAlert с «Попробовать ещё раз», пусто — знак и строка без сцены.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { UserTask } from '../../api';
import { KanbanView } from './KanbanView';
import { paperSignName } from '../../test-support/paperSign';

afterEach(cleanup);

const task = (id: number, over: Record<string, unknown>) => ({
  id, userId: 1, assignedBy: 2, type: 'custom', text: `задание ${id}`, targetDays: null, needId: null,
  dueDate: null, done: null, completedAt: null, createdAt: '2026-10-01T10:00:00Z', ...over,
}) as unknown as UserTask;
const board = (tasks: UserTask[]) => [{ clientId: 1, clientName: 'Анна', tasks }];
const view = (allTasks: ReturnType<typeof board> | null, failed = false, onRetry = vi.fn()) =>
  render(<KanbanView allTasks={allTasks} loading={false} loadFailed={failed} onRetry={onRetry} onOpenClient={vi.fn()} />);

describe('KanbanView — вид', () => {
  it('колонки — бумага 70 / 135 / 45; Check только у «Выполнено»; на карточке знак типа, а не Talk', () => {
    const { container } = view(board([
      task(1, { type: 'tracker_streak', text: 'трекер' }),
      task(2, { text: 'сделано', done: true, completedAt: '2026-10-05T12:00:00Z' }),
    ]));
    const cols = [...container.querySelectorAll<HTMLElement>('.tc-kcol')];
    expect(cols.map((c) => c.style.getPropertyValue('--h'))).toEqual(['70', '135', '45']);
    expect(cols.map((c) => c.querySelector('.tc-kcol-sign') !== null)).toEqual([false, true, false]);
    const signs = [...container.querySelectorAll('.tc-task-sign svg')].map(paperSignName);
    expect(signs).toEqual(['Strokes', 'Check']);
    expect([...container.querySelectorAll('svg')].map(paperSignName)).not.toContain('Talk');
  });

  it('сбой — лист с «Попробовать ещё раз», пусто — знак и строка', () => {
    const onRetry = vi.fn();
    view(null, true, onRetry);
    expect(screen.getByRole('alert').classList.contains('pa-alert')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Попробовать ещё раз' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    cleanup();
    const { container } = view(board([]));
    expect(screen.getByText('Назначенных заданий пока нет')).toBeTruthy();
    expect(container.querySelector('svg.scn')).toBeNull();
    expect(paperSignName(container.querySelector('.tc-board-empty svg'))).toBe('Check');
  });
});
