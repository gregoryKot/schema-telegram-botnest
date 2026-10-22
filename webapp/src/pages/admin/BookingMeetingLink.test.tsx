// @vitest-environment jsdom
// Ревью починки утечки ссылки на встречу (аудит 2026-10): клиент ссылку на
// экране больше не видит, её пересылает владелец. Если DM потерялся, ссылка
// обязана находиться в админке — в строке брони, со «Скопировать ссылку».
// Тест бьёт по настоящему списку записей (BookingsManager), а не только по
// подкомпоненту: поле meetingUrl было в типе AdminBooking и раньше, но экран
// его не рисовал.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

vi.mock('../../api', () => ({
  api: { adminListBookings: vi.fn(), adminConfirm: vi.fn(), adminCancel: vi.fn() },
}));
import { api } from '../../api';
import { BookingsManager } from './BookingsManager';
import { BookingMeetingLink } from './BookingMeetingLink';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const ZOOM = 'https://us06web.zoom.us/j/81234567890?pwd=SeCrEt';
const row = (id: number, meetingUrl: string | null, status = 'CONFIRMED') => ({
  id, startsAt: '2095-03-07T10:00:00.000Z', durationMin: 50, type: 'SESSION_50', status,
  clientName: `Клиент ${id}`, clientContact: `c${id}@example.com`, message: null, cancelToken: `t${id}`, meetingUrl,
});
const mockClipboard = (writeText: (t: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

describe('BookingsManager: ссылка на встречу в строке брони', () => {
  it('у брони со ссылкой — ссылка и «Скопировать ссылку», у брони без ссылки — ничего', async () => {
    vi.mocked(api.adminListBookings).mockResolvedValue([row(1, ZOOM), row(2, null, 'HELD')] as never);
    render(<BookingsManager adminKey="k" />);
    await screen.findByText(/Клиент 1/);

    const link = screen.getByRole('link', { name: ZOOM });
    expect(link.getAttribute('href')).toBe(ZOOM);
    expect(link.closest('.ym-hide-content')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: 'Скопировать ссылку' })).toHaveLength(1);
    // строка второй брони (HELD, ссылки ещё нет) — без подписи «Ссылка на встречу»
    const second = screen.getByText(/Клиент 2/).parentElement as HTMLElement;
    expect(within(second).queryByText('Ссылка на встречу:')).toBeNull();
    expect(screen.getAllByText('Ссылка на встречу:')).toHaveLength(1);
  });
});

describe('BookingMeetingLink', () => {
  it('«Скопировать ссылку» кладёт в буфер именно ссылку этой брони', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    render(<BookingMeetingLink meetingUrl={ZOOM} />);
    fireEvent.click(screen.getByRole('button', { name: 'Скопировать ссылку' }));
    await screen.findByText('Скопировано ✓');
    expect(writeText).toHaveBeenCalledWith(ZOOM);
  });

  it('отказ буфера — честное «не скопировалось», не галочка', async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    render(<BookingMeetingLink meetingUrl={ZOOM} />);
    fireEvent.click(screen.getByRole('button', { name: 'Скопировать ссылку' }));
    await screen.findByText(/Не скопировалось/);
    expect(screen.queryByText('Скопировано ✓')).toBeNull();
  });

  it('без ссылки не рендерит ничего', () => {
    const { container } = render(<BookingMeetingLink meetingUrl={null} />);
    expect(container.innerHTML).toBe('');
  });
});
