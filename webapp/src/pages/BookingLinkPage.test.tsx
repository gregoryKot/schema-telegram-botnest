// @vitest-environment jsdom
// /book — постоянная ссылка для клиентов практики: расписание открыто сразу
// (без формы «напишите мне» и кнопки «Открыть расписание»), формат один —
// сессия 50 минут без переключателя, цель booking_link_open уходит один раз,
// страница закрыта от поиска.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { BookingLinkPage } from './BookingLinkPage';

vi.mock('../api', () => ({
  api: { getSlots: vi.fn(), getBookingOptions: vi.fn(), bookSlot: vi.fn(), cancelBooking: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

// Пояс посетителя мокается — иначе время слотов зависело бы от TZ раннера.
vi.mock('../components/booking/useClientTimeZone', () => ({ useClientTimeZone: vi.fn() }));
import { useClientTimeZone } from '../components/booking/useClientTimeZone';

import { setMetrikaSessionPossible } from '../lib/metrikaGate';
setMetrikaSessionPossible(false);

const SLOTS = [
  { startsAt: '2026-09-10T09:00:00.000Z', endsAt: '2026-09-10T09:50:00.000Z', durationMin: 50 },
  { startsAt: '2026-09-10T12:00:00.000Z', endsAt: '2026-09-10T12:50:00.000Z', durationMin: 50 },
];
const OPTIONS = [
  { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0, note: '' },
  { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 3000, note: '' },
];

const goals = () =>
  ((window as unknown as { ym?: { a?: unknown[][] } }).ym?.a ?? [])
    .filter((c) => c[1] === 'reachGoal')
    .map((c) => c[2]);

const setUrl = (search: string) => window.history.pushState({}, '', `/book${search}`);

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getSlots.mockResolvedValue(SLOTS);
  mockApi.getBookingOptions.mockResolvedValue(OPTIONS);
  (useClientTimeZone as unknown as ReturnType<typeof vi.fn>).mockReturnValue(['Europe/Moscow', vi.fn()]);
  Element.prototype.scrollIntoView = vi.fn();
  // trackGoalOnce дедуплицирует через sessionStorage; Метрика грузится реально.
  sessionStorage.clear();
  delete (window as unknown as { __ym_loaded?: boolean }).__ym_loaded;
  delete (window as unknown as { ym?: unknown }).ym;
  document.querySelectorAll('script[src*="mc.yandex.ru"]').forEach((s) => s.remove());
  setUrl('');
});
afterEach(() => { cleanup(); setUrl(''); });

describe('BookingLinkPage — расписание сразу', () => {
  it('грузит слоты без клика; формы «Написать →» и «Открыть расписание» нет', async () => {
    render(<BookingLinkPage />);
    await screen.findByText('Выберите день');
    expect(mockApi.getSlots).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Открыть расписание/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Написать/ })).toBeNull();
    expect(screen.queryByLabelText('Где вам удобнее отвечать *')).toBeNull(); // форма — только после выбора слота
  });

  it('под слотами — ссылка в Telegram, не переключение на форму', async () => {
    render(<BookingLinkPage />);
    await screen.findByText('Выберите день');
    const link = screen.getByRole('link', { name: 'Напишите мне в Telegram' });
    expect(link.getAttribute('href')).toBe('https://t.me/kotlarewski');
  });

  it('при пустом расписании — та же ссылка в Telegram вместо формы', async () => {
    mockApi.getSlots.mockResolvedValue([]);
    render(<BookingLinkPage />);
    await screen.findByText(/Открытого времени сейчас нет/);
    expect(screen.getAllByRole('link', { name: 'Напишите мне в Telegram' }).length).toBe(2);
    expect(screen.queryByRole('button', { name: /Написать/ })).toBeNull();
  });
});

describe('BookingLinkPage — только сессия 50 минут', () => {
  it('переключателя форматов нет, даже когда бэкенд отдаёт два формата', async () => {
    render(<BookingLinkPage />);
    await screen.findByText('Выберите день');
    expect(screen.queryByText('Формат встречи')).toBeNull();
    expect(screen.queryByRole('button', { name: /Знакомство/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Сессия/ })).toBeNull();
  });

  it('бронь идёт как платная сессия: кнопка «Оплатить … и записаться», без галочки знакомства', async () => {
    render(<BookingLinkPage />);
    await screen.findByText('Выберите день');
    fireEvent.click(screen.getByText('12:00'));
    expect(screen.getByRole('button', { name: /Оплатить .* и записаться/ })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /Напишу вам/ })).toBeNull();
    expect(screen.getByRole('checkbox', { name: /повторная встреча/i })).toBeTruthy();
  });

  it('?type=intro больше не переключает на знакомство', async () => {
    setUrl('?type=intro');
    render(<BookingLinkPage />);
    await screen.findByText('Выберите день');
    fireEvent.click(screen.getByText('12:00'));
    expect(screen.getByRole('button', { name: /Оплатить/ })).toBeTruthy();
  });
});

describe('BookingLinkPage — метрика и поиск', () => {
  it('цель booking_link_open уходит один раз за сессию, даже при повторном открытии', async () => {
    const first = render(<BookingLinkPage />);
    await screen.findByText('Выберите день');
    first.unmount();
    render(<BookingLinkPage />);
    await screen.findByText('Выберите день');
    expect(goals().filter((g) => g === 'booking_link_open').length).toBe(1);
  });

  it('пока страница открыта — meta robots = noindex; заголовок вкладки свой', async () => {
    const { unmount } = render(<BookingLinkPage />);
    await screen.findByText('Выберите день');
    expect(document.head.querySelector("meta[name='robots']")?.getAttribute('content')).toBe('noindex, nofollow');
    expect(document.title).toContain('Выберите удобное время');
    unmount();
    expect(document.head.querySelector("meta[name='robots']")).toBeNull();
  });
});
