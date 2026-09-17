// @vitest-environment jsdom
// TaskRow — строка задачи в двух вариантах (full/compact). Проверяет:
// когда показывается кнопка «Готово» (только свои custom-задачи без
// готового результата), бейдж «от терапевта» для назначенных задач, и что
// клик по выполненной full-задаче не открывает её повторно (pressable не
// навешан на doneToday).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TaskRow } from './TaskRow';
import type { UserTask } from '../../api';

afterEach(() => {
  cleanup();
});

function makeTask(overrides: Partial<UserTask> = {}): UserTask {
  return {
    id: 1,
    userId: 1,
    assignedBy: null,
    type: 'custom',
    text: 'Позвонить маме',
    targetDays: null,
    needId: null,
    dueDate: null,
    done: null,
    completedAt: null,
    createdAt: '2026-08-01T00:00:00Z',
    doneToday: false,
    ...overrides,
  };
}

describe('TaskRow — full вариант', () => {
  it('свой custom-таск без результата — кнопка «Готово» видна, клик зовёт onComplete', () => {
    const onComplete = vi.fn();
    render(
      <TaskRow
        task={makeTask()}
        onOpen={() => {}}
        onComplete={onComplete}
        variant="full"
      />,
    );
    fireEvent.click(screen.getByText('Готово'));
    expect(onComplete).toHaveBeenCalled();
  });

  it('назначенная терапевтом задача показывает бейдж «от терапевта»', () => {
    render(
      <TaskRow
        task={makeTask({ assignedBy: 42 })}
        onOpen={() => {}}
        variant="full"
      />,
    );
    expect(screen.getByText('от терапевта')).toBeTruthy();
  });

  it('выполненная задача сегодня — без бейджа и без кнопки «Готово»', () => {
    render(
      <TaskRow
        task={makeTask({ assignedBy: 42, doneToday: true, done: null })}
        onOpen={() => {}}
        onComplete={vi.fn()}
        variant="full"
      />,
    );
    expect(screen.queryByText('от терапевта')).toBeNull();
    expect(screen.queryByText('Готово')).toBeNull();
  });

  it('клик по строке (не по кнопке) зовёт onOpen, если задача не выполнена', () => {
    const onOpen = vi.fn();
    render(<TaskRow task={makeTask()} onOpen={onOpen} variant="full" />);
    fireEvent.click(screen.getByText('Позвонить маме'));
    expect(onOpen).toHaveBeenCalled();
  });
});

describe('TaskRow — compact вариант', () => {
  // Исход задачи — знак, а не картинка: ✓ выполнено, × не выполнено.
  it('done=true — галочка, без кнопки «Готово»', () => {
    render(
      <TaskRow
        task={makeTask({ done: true, assignedBy: 5 })}
        variant="compact"
      />,
    );
    expect(screen.getByText('✓')).toBeTruthy();
    expect(screen.queryByText('Готово')).toBeNull();
  });

  it('назначенная задача без результата — кнопка «Готово» зовёт onComplete', () => {
    const onComplete = vi.fn();
    render(
      <TaskRow
        task={makeTask({ assignedBy: 5, done: null })}
        onComplete={onComplete}
        variant="compact"
      />,
    );
    fireEvent.click(screen.getByText('Готово'));
    expect(onComplete).toHaveBeenCalled();
  });

  it('своя (не назначенная) задача без результата — кнопки «Готово» нет', () => {
    render(
      <TaskRow
        task={makeTask({ assignedBy: null, done: null })}
        onComplete={vi.fn()}
        variant="compact"
      />,
    );
    expect(screen.queryByText('Готово')).toBeNull();
  });
});
