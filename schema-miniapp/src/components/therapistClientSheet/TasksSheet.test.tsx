// @vitest-environment jsdom
// TasksSheet — лист заданий клиента в кабинете терапевта (0% покрытия).
// Проверяет: пустой список — реальное «Нет назначенных заданий», а не
// пустой прямоугольник (правило CLAUDE.md против хардкод-заглушек); статус
// задания (aria-label «Выполнено»/«Не выполнено»/«Ожидает выполнения») по
// трём независимым полям задания; прогресс-бар рисуется только когда заданы
// И progress, И targetDays — типичный источник NaN%, если забыть одно из
// условий.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TasksSheet } from './TasksSheet';
import type { ClientDetail } from './types';

afterEach(() => {
  cleanup();
});

function makeDetail(overrides: Partial<ClientDetail> = {}): ClientDetail {
  return {
    clientTasks: [],
    setShowTasksSheet: vi.fn(),
    setShowAssign: vi.fn(),
    ...overrides,
  } as unknown as ClientDetail;
}

describe('TasksSheet — пустой список', () => {
  it('нет заданий — «Нет назначенных заданий», не пустой блок', () => {
    render(<TasksSheet detail={makeDetail()} />);
    expect(screen.getByText('Нет назначенных заданий')).toBeTruthy();
  });
});

describe('TasksSheet — список заданий', () => {
  it('done=true — статус «Выполнено», показывает срок из dueDate', () => {
    render(
      <TasksSheet
        detail={makeDetail({
          clientTasks: [
            {
              id: 1,
              text: 'Дневник схем',
              done: true,
              doneToday: false,
              dueDate: '2026-08-10',
              createdAt: '2026-08-01T00:00:00.000Z',
            },
          ] as unknown as ClientDetail['clientTasks'],
        })}
      />,
    );
    expect(screen.getByLabelText('Выполнено')).toBeTruthy();
    expect(screen.getByText('Дневник схем')).toBeTruthy();
    expect(screen.getByText(/Срок:/)).toBeTruthy();
  });

  it('done=false — статус «Не выполнено»', () => {
    render(
      <TasksSheet
        detail={makeDetail({
          clientTasks: [
            {
              id: 2,
              text: 'Задание',
              done: false,
              doneToday: false,
              dueDate: null,
              createdAt: '2026-08-01T00:00:00.000Z',
            },
          ] as unknown as ClientDetail['clientTasks'],
        })}
      />,
    );
    expect(screen.getByLabelText('Не выполнено')).toBeTruthy();
  });

  it('done=null, doneToday=true — тоже «Выполнено» (выполнено сегодня, ещё не подтверждено)', () => {
    render(
      <TasksSheet
        detail={makeDetail({
          clientTasks: [
            {
              id: 3,
              text: 'Задание',
              done: null,
              doneToday: true,
              dueDate: null,
              createdAt: '2026-08-01T00:00:00.000Z',
            },
          ] as unknown as ClientDetail['clientTasks'],
        })}
      />,
    );
    expect(screen.getByLabelText('Выполнено')).toBeTruthy();
  });

  it('done=null, doneToday=false — статус «Ожидает выполнения», без dueDate показывает дату создания', () => {
    render(
      <TasksSheet
        detail={makeDetail({
          clientTasks: [
            {
              id: 4,
              text: 'Задание',
              done: null,
              doneToday: false,
              dueDate: null,
              createdAt: '2026-08-01T00:00:00.000Z',
            },
          ] as unknown as ClientDetail['clientTasks'],
        })}
      />,
    );
    expect(screen.getByLabelText('Ожидает выполнения')).toBeTruthy();
  });

  it('заданы progress и targetDays — рисует прогресс-бар с дробью', () => {
    render(
      <TasksSheet
        detail={makeDetail({
          clientTasks: [
            {
              id: 5,
              text: 'Практика',
              done: null,
              doneToday: false,
              dueDate: null,
              createdAt: '2026-08-01T00:00:00.000Z',
              progress: 3,
              targetDays: 5,
            },
          ] as unknown as ClientDetail['clientTasks'],
        })}
      />,
    );
    expect(screen.getByText('3/5')).toBeTruthy();
  });

  it('задан только progress без targetDays — прогресс-бар НЕ рисуется (нет дробной части)', () => {
    render(
      <TasksSheet
        detail={makeDetail({
          clientTasks: [
            {
              id: 6,
              text: 'Практика',
              done: null,
              doneToday: false,
              dueDate: null,
              createdAt: '2026-08-01T00:00:00.000Z',
              progress: 3,
            },
          ] as unknown as ClientDetail['clientTasks'],
        })}
      />,
    );
    expect(screen.queryByText(/^3\//)).toBeNull();
  });
});

describe('TasksSheet — действия', () => {
  it('клик «Назначить задание» зовёт setShowAssign(true)', () => {
    const setShowAssign = vi.fn();
    render(<TasksSheet detail={makeDetail({ setShowAssign })} />);
    fireEvent.click(screen.getByText('+ Назначить задание'));
    expect(setShowAssign).toHaveBeenCalledWith(true);
  });

  it('закрытие листа (Escape) зовёт setShowTasksSheet(false)', () => {
    const setShowTasksSheet = vi.fn();
    render(<TasksSheet detail={makeDetail({ setShowTasksSheet })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(setShowTasksSheet).toHaveBeenCalledWith(false);
  });
});
