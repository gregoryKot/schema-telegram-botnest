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

// Одна кнопка назначения (К25, К31): на компьютере — только «+ Задание» шапки карточки, на вкладке своей нет;
// на телефоне шапка её не несёт — пустой список «Назначить первое задание» (залитая), есть задания — «+ Назначить».
describe('ClientTasksTab — одна кнопка назначения', () => {
  const task = { id: 1, userId: '7', assignedBy: '2', type: 'custom', text: 'Прогулка', targetDays: null, needId: null, dueDate: '2099-01-10', done: null, completedAt: null, createdAt: '2026-11-01T09:00:00.000Z' };
  const assignButtons = (clientTasks: unknown[]) => {
    const d = makeClientDetail({ selectedClient: makeClient({ telegramId: 7 }), clientTasks: clientTasks as never });
    render(<MemoryRouter><ClientTasksTab detail={d} onAssign={vi.fn()} /></MemoryRouter>);
    return screen.queryAllByRole('button', { name: /Назначить/ });
  };

  it('на компьютере на вкладке кнопки назначения нет ни пустой, ни с заданиями', () => {
    phone.value = false;
    expect(assignButtons([])).toHaveLength(0);
    cleanup();
    expect(assignButtons([task])).toHaveLength(0);
  });

  it('телефон, пусто — одна залитая «Назначить первое задание»', () => {
    phone.value = true;
    const b = assignButtons([]);
    expect(b.map((x) => x.textContent)).toEqual(['Назначить первое задание']);
    expect(b[0].className).not.toContain('ds-btn--secondary');
  });

  it('телефон, есть задания — только «+ Назначить»', () => {
    phone.value = true;
    expect(assignButtons([task]).map((x) => x.textContent)).toEqual(['+ Назначить']);
  });
});
