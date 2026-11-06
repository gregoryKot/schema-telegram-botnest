// @vitest-environment jsdom
// Одна залитая кнопка на экран (docs/open/frontend-ux.md, раскатка #921): на
// компьютере вкладку «Задания» уже несёт залитое «+ Задание» шапки карточки,
// и «Назначить первое задание» пустой вкладки было второй залитой кнопкой.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClientTasksTab } from './ClientTasksTab';
import type { ClientDetail } from './clientSheetTypes';

vi.mock('../../api', () => ({ api: {} }));
const phone = vi.hoisted(() => ({ value: false }));
vi.mock('../useIsMobile', () => ({ useIsMobile: () => phone.value }));

afterEach(cleanup);

const detail = { clientTasks: [], setClientTasks: vi.fn(), selectedClient: { telegramId: 7 } } as unknown as ClientDetail;
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
