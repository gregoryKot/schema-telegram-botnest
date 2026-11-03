// @vitest-environment jsdom
// TasksSheet — лист заданий клиента в кабинете терапевта (0% покрытия).
// Проверяет: пустой список — реальное «Нет назначенных заданий», а не
// пустой прямоугольник (правило CLAUDE.md против хардкод-заглушек); статус
// задания (aria-label «Выполнено»/«Не вышло»/«Ожидает выполнения») по
// трём независимым полям задания; прогресс серии «N из M дней» виден только
// когда заданы И progress, И targetDays — иначе он был бы выдуманным нулём.
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
  // У выполненного — дата выполнения, а не срок (QA 2026-10-26: «до …»
  // у сделанного путало).
  it('done=true — статус «Выполнено», подпись — дата выполнения, не срок', () => {
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
              completedAt: '2026-08-05T12:00:00.000Z',
              createdAt: '2026-08-01T00:00:00.000Z',
            },
          ] as unknown as ClientDetail['clientTasks'],
        })}
      />,
    );
    expect(screen.getByLabelText('Выполнено')).toBeTruthy();
    expect(screen.getByText('Дневник схем')).toBeTruthy();
    expect(screen.getByText('выполнено 5 авг')).toBeTruthy();
    expect(screen.queryByText(/до 10 авг/)).toBeNull();
  });

  // «Не вышло» — тот же статус, что на доске сайта (shared/taskStatus).
  it('done=false — статус «Не вышло»', () => {
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
    expect(screen.getByLabelText('Не вышло')).toBeTruthy();
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

  it('заданы progress и targetDays — прогресс серии «N из M дней»', () => {
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
    expect(screen.getByText(/3 из 5 дней/)).toBeTruthy();
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
    expect(screen.queryByText(/из/)).toBeNull();
  });
});

describe('TasksSheet — название задания', () => {
  // Регрессия: терапевт видел сырой id режима «invincible_oc» вместо
  // названия — лист рисовал task.text как есть.
  it('mode_intro — название режима, сырой id не виден', () => {
    render(
      <TasksSheet
        detail={makeDetail({
          clientTasks: [
            {
              id: 7,
              type: 'mode_intro',
              text: 'invincible_oc',
              done: null,
              doneToday: false,
              dueDate: null,
              createdAt: '2026-08-01T00:00:00.000Z',
            },
          ] as unknown as ClientDetail['clientTasks'],
        })}
      />,
    );
    expect(
      screen.getByText('Карточка режима: Неуязвимый Гиперконтролёр'),
    ).toBeTruthy();
    expect(screen.queryByText(/invincible_oc/)).toBeNull();
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
