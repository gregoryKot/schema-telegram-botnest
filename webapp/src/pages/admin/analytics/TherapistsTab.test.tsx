// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import type { AdminTherapistRow } from '../../../../../shared/src/analytics/adminAnalytics';
import { TherapistsTab } from './TherapistsTab';

vi.mock('./analyticsApi', () => ({ analyticsApi: { therapists: vi.fn() } }));
import { analyticsApi } from './analyticsApi';
const therapists = analyticsApi.therapists as unknown as ReturnType<typeof vi.fn>;

const zero = { notes: 0, tasks: 0, planItems: 0, guideMarks: 0, conceptualizations: 0, customModes: 0, invites: 0 };
const mk = (id: string, name: string, o: Partial<AdminTherapistRow>): AdminTherapistRow => ({
  id, name, lastActive: null, activeDays: 0, clients: { active: 0, pending: 0, ended: 0, virtual: 0 }, actions: zero, total: 0, daily: [], ...o,
});
const ROWS = [
  mk('1', 'Анна', { total: 4, actions: { ...zero, notes: 4 }, activeDays: 3, lastActive: new Date().toISOString(), daily: [0, 4], clients: { active: 1, pending: 0, ended: 0, virtual: 0 } }),
  mk('2', 'Борис', {}),
  mk('3', 'Вера', { total: 9, actions: { ...zero, tasks: 9 }, activeDays: 5, lastActive: new Date().toISOString(), daily: [9, 0], clients: { active: 5, pending: 1, ended: 0, virtual: 0 } }),
];

beforeEach(() => therapists.mockReset());
afterEach(cleanup);

describe('TherapistsTab', () => {
  it('сводка, карточки по активности, тихий — «действий нет», нулевые виды скрыты', async () => {
    therapists.mockResolvedValue(ROWS);
    const { container } = render(<TherapistsTab adminKey="k" days={30} />);
    expect(container.querySelector('.skel')).toBeTruthy();
    expect(await screen.findByText('3 терапевта, из них 2 что-то делали за период')).toBeTruthy();
    const names = screen.getAllByText(/^(Анна|Борис|Вера)$/).map((n) => n.textContent);
    expect(names).toEqual(['Вера', 'Анна', 'Борис']);
    expect(screen.getByText('За период действий нет')).toBeTruthy();
    expect(screen.getByText('заходов не было')).toBeTruthy();
    expect(screen.queryByText('Свои режимы')).toBeNull();
    expect(screen.getByText('Задания клиентам')).toBeTruthy();
  });
  it('сортировка по давности переставляет карточки', async () => {
    therapists.mockResolvedValue([ROWS[0], { ...ROWS[2], lastActive: '2020-01-01T00:00:00Z' }]);
    render(<TherapistsTab adminKey="k" days={30} />);
    await screen.findByText(/2 терапевта/);
    fireEvent.click(screen.getByRole('button', { name: 'По давности захода' }));
    expect(screen.getAllByText(/^(Анна|Вера)$/).map((n) => n.textContent)).toEqual(['Анна', 'Вера']);
  });
  it('пустой список и ошибка', async () => {
    therapists.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Не удалось загрузить данные'));
    const { unmount } = render(<TherapistsTab adminKey="k" days={30} />);
    expect(await screen.findByText('Терапевтов пока нет')).toBeTruthy();
    unmount();
    const r = render(<TherapistsTab adminKey="k" days={30} />);
    expect(await within(r.container).findByRole('button', { name: 'Повторить' })).toBeTruthy();
  });
});
