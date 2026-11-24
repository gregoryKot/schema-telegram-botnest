// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { OverviewTab } from './OverviewTab';

vi.mock('./analyticsApi', () => ({ analyticsApi: { overview: vi.fn() } }));
import { analyticsApi } from './analyticsApi';
const overview = analyticsApi.overview as unknown as ReturnType<typeof vi.fn>;

const DATA = {
  days: 30,
  totals: { users: 120, therapists: 6, clientsInTherapy: 14, activeToday: 9, active7: 40, active30: 80, newInPeriod: 17 },
  daily: [{ date: '2026-11-22', active: 3, newUsers: 1, events: 10 }, { date: '2026-11-23', active: 5, newUsers: 0, events: 22 }],
  features: [{ id: 'diary', title: 'Дневник', events: 30, users: 12 }],
};

beforeEach(() => overview.mockReset());
afterEach(cleanup);

describe('OverviewTab', () => {
  it('скелетон, затем плитки, график и фичи', async () => {
    overview.mockResolvedValue(DATA);
    const { container } = render(<OverviewTab adminKey="k" days={30} />);
    expect(container.querySelector('.skel')).toBeTruthy();
    expect(await screen.findByText('Сегодня заходили')).toBeTruthy();
    expect(overview).toHaveBeenCalledWith('k', 30);
    expect(screen.getByText('120')).toBeTruthy();
    expect(screen.getByText(/заходили 5/)).toBeTruthy();
    expect(screen.getByText('30 раз · 12 человек')).toBeTruthy();
  });
  it('переключатель ряда меняет подпись дня; стрелка выбирает другой день', async () => {
    overview.mockResolvedValue(DATA);
    render(<OverviewTab adminKey="k" days={30} />);
    await screen.findByText('Сегодня заходили');
    fireEvent.click(screen.getByRole('button', { name: 'Действия' }));
    expect(screen.getByText(/действий 22/)).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowLeft' });
    expect(screen.getByText(/действий 10/)).toBeTruthy();
  });
  it('пустой ответ — «Пока нет данных», без выдуманных цифр', async () => {
    overview.mockResolvedValue({ ...DATA, daily: [], features: [] });
    render(<OverviewTab adminKey="k" days={7} />);
    await screen.findByText('Сегодня заходили');
    expect(screen.getAllByText('Пока нет данных')).toHaveLength(2);
  });
  it('ошибка — сообщение и «Повторить» перезапрашивает', async () => {
    overview.mockRejectedValueOnce(new Error('Не удалось загрузить данные')).mockResolvedValue(DATA);
    render(<OverviewTab adminKey="k" days={30} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(screen.getByText('Сегодня заходили')).toBeTruthy());
    expect(overview).toHaveBeenCalledTimes(2);
  });
});
