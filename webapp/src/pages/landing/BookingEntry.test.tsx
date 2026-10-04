// @vitest-environment jsdom
// BookingEntry (визитка): по умолчанию — простая форма «напишите мне», слоты
// не запрашиваются и не видны, пока посетитель сам не откроет расписание;
// из расписания есть возврат к форме (под слотами и при пустом расписании).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BookingEntry } from './BookingEntry';

vi.mock('../../api', () => ({
  api: {
    submitBooking: vi.fn(),
    getSlots: vi.fn(),
    getBookingOptions: vi.fn(),
    bookSlot: vi.fn(),
    cancelBooking: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

// Пояс посетителя мокается — иначе время слотов зависело бы от TZ раннера.
vi.mock('../../components/booking/useClientTimeZone', () => ({ useClientTimeZone: vi.fn() }));
import { useClientTimeZone } from '../../components/booking/useClientTimeZone';

import { setMetrikaSessionPossible } from '../../lib/metrikaGate';
setMetrikaSessionPossible(false);

const SLOTS = [
  { startsAt: '2026-09-10T09:00:00.000Z', endsAt: '2026-09-10T09:50:00.000Z', durationMin: 50 },
  { startsAt: '2026-09-10T12:00:00.000Z', endsAt: '2026-09-10T12:50:00.000Z', durationMin: 50 },
];

const goals = () =>
  ((window as unknown as { ym?: { a?: unknown[][] } }).ym?.a ?? [])
    .filter((c) => c[1] === 'reachGoal')
    .map((c) => c[2]);

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getSlots.mockResolvedValue(SLOTS);
  mockApi.getBookingOptions.mockResolvedValue([]);
  (useClientTimeZone as unknown as ReturnType<typeof vi.fn>).mockReturnValue(['Europe/Moscow', vi.fn()]);
  Element.prototype.scrollIntoView = vi.fn();
  // trackGoalOnce дедуплицирует через sessionStorage; Метрика грузится реально.
  sessionStorage.clear();
  delete (window as unknown as { __ym_loaded?: boolean }).__ym_loaded;
  delete (window as unknown as { ym?: unknown }).ym;
  document.querySelectorAll('script[src*="mc.yandex.ru"]').forEach((s) => s.remove());
});
afterEach(() => cleanup());

describe('BookingEntry — по умолчанию простая форма', () => {
  it('показывает форму «Написать →», прямые ссылки и не запрашивает слоты', () => {
    render(<BookingEntry />);
    expect(screen.getByRole('button', { name: /Написать/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: '@kotlarewski' })).toBeTruthy();
    expect(screen.queryByText('Выберите день')).toBeNull();
    expect(mockApi.getSlots).not.toHaveBeenCalled();
  });

  it('ссылка на почту ведёт на mailto:', () => {
    render(<BookingEntry />);
    const mail = screen.getAllByRole('link').find((a) => a.getAttribute('href')?.startsWith('mailto:'));
    expect(mail).toBeTruthy();
  });
});

describe('BookingEntry — расписание по ссылке', () => {
  it('«Открыть расписание» монтирует выбор слотов и шлёт booking_schedule_open', async () => {
    render(<BookingEntry />);
    fireEvent.click(screen.getByRole('button', { name: /Открыть расписание/ }));

    await screen.findByText('Выберите день');
    expect(mockApi.getSlots).toHaveBeenCalledTimes(1);
    expect(goals()).toContain('booking_schedule_open');
    expect(screen.queryByRole('button', { name: /^Написать →$/ })).toBeNull();
  });

  it('под слотами «Напишите мне» возвращает к форме и шлёт booking_write_instead', async () => {
    render(<BookingEntry />);
    fireEvent.click(screen.getByRole('button', { name: /Открыть расписание/ }));
    await screen.findByText('Выберите день');

    fireEvent.click(screen.getByRole('button', { name: 'Напишите мне' }));

    expect(screen.getByRole('button', { name: /^Написать →$/ })).toBeTruthy();
    expect(screen.queryByText('Выберите день')).toBeNull();
    expect(goals()).toContain('booking_write_instead');
  });

  it('при пустом расписании показывает заметку, а её «Написать →» возвращает к форме', async () => {
    mockApi.getSlots.mockResolvedValue([]);
    render(<BookingEntry />);
    fireEvent.click(screen.getByRole('button', { name: /Открыть расписание/ }));

    await screen.findByText(/Открытого времени сейчас нет/);
    fireEvent.click(screen.getByRole('button', { name: 'Написать →' }));

    expect(screen.getByLabelText('Как с вами связаться *')).toBeTruthy();
    expect(screen.queryByText(/Открытого времени сейчас нет/)).toBeNull();
  });
});
