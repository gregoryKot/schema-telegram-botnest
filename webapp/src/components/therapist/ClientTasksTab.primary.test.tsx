// @vitest-environment jsdom
// Одна залитая кнопка на экран (docs/open/frontend-ux.md, раскатка #921): на
// компьютере вкладку «Задания» уже несёт залитое «+ Задание» шапки карточки,
// и «Назначить первое задание» пустой вкладки было второй залитой кнопкой.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClientTasksTab } from './ClientTasksTab';
import { makeClient, makeClientDetail } from './clientDetail.test-helpers';

vi.mock('../../api', () => ({ api: { getGuideMarks: () => Promise.resolve({ marks: [] }) } }));
const phone = vi.hoisted(() => ({ value: false }));
vi.mock('../useIsMobile', () => ({ useIsMobile: () => phone.value }));

afterEach(cleanup);

const detail = makeClientDetail({ selectedClient: makeClient({ telegramId: 7 }) });
const firstTask = () => {
  render(<MemoryRouter><ClientTasksTab detail={detail} onAssign={vi.fn()} /></MemoryRouter>);
  return screen.getByRole('button', { name: 'Назначить первое задание' }).className;
};

describe('ClientTasksTab — «Назначить первое задание»', () => {
  it('на компьютере вторичная: главное — «+ Задание» в шапке', () => {
    phone.value = false;
    expect(firstTask()).toContain('ds-btn--secondary');
  });

  it('на телефоне залитая: шапка «+ Задание» не несёт', () => {
    phone.value = true;
    expect(firstTask()).not.toContain('ds-btn--secondary');
  });
});

// Одна кнопка назначения на вкладке (К25): пустой список — «Назначить первое задание», есть задания — «+ Назначить».
describe('ClientTasksTab — одна кнопка назначения', () => {
  const task = { id: 1, userId: '7', assignedBy: '2', type: 'custom', text: 'Прогулка', targetDays: null, needId: null, dueDate: '2099-01-10', done: null, completedAt: null, createdAt: '2026-11-01T09:00:00.000Z' };
  const assignButtons = (clientTasks: unknown[]) => {
    const d = makeClientDetail({ selectedClient: makeClient({ telegramId: 7 }), clientTasks: clientTasks as never });
    render(<MemoryRouter><ClientTasksTab detail={d} onAssign={vi.fn()} /></MemoryRouter>);
    return screen.queryAllByRole('button', { name: /Назначить/ }).map((b) => b.textContent);
  };

  it.each([true, false])('пусто — только «Назначить первое задание» (телефон: %s)', (isPhone) => {
    phone.value = isPhone;
    expect(assignButtons([])).toEqual(['Назначить первое задание']);
  });

  it('есть задания — только «+ Назначить»', () => {
    phone.value = true;
    expect(assignButtons([task])).toEqual(['+ Назначить']);
  });
});
