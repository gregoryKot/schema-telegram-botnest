// @vitest-environment jsdom
// security#15 (аудит 2026-10-11): экран возврата с оплаты рисовал «Встреча
// подтверждена» для любой брони, кроме CANCELLED, — в том числе для HELD, когда
// вебхук Robokassa ещё не пришёл или отказал. Здесь: ветвление по статусу,
// автоповтор запроса, честный таймаут и тест на КЛАСС — по всем значениям enum
// BookingStatus из Prisma, не по ручному списку.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { BookingStatus } from '@prisma/client';
import { BookingPaidPage } from './BookingPaidPage';
import { POLL_INTERVAL_MS, POLL_LIMIT_MS, paidPhase, type PaidPhase } from '../components/booking/paidPageModel';

const getBookingByToken = vi.fn();
const reportClientError = vi.fn();
vi.mock('../api', () => ({
  api: { getBookingByToken: (...a: unknown[]) => getBookingByToken(...a), cancelBooking: vi.fn() },
  reportClientError: (...a: unknown[]) => reportClientError(...a),
}));

const booking = (over: Record<string, unknown> = {}) => ({
  status: 'CONFIRMED', paid: true, type: 'SESSION_50' as const,
  startsAt: '2099-08-10T10:00:00Z', endsAt: '2099-08-10T10:50:00Z',
  durationMin: 50, meetingUrl: 'https://meet.example/xyz', ...over,
});

const CONFIRMED_TEXT = /Встреча подтверждена/;

beforeEach(() => {
  vi.clearAllMocks();
  window.history.pushState({}, '', '/booking/paid?token=abc');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.pushState({}, '', '/booking/paid');
});

// Прокрутить таймеры и дать промисам отработать.
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('BookingPaidPage — HELD: оплата принята, запись ещё не подтверждена', () => {
  it('не говорит «подтверждена», показывает «Оплата принята» и «подтверждаем запись»', async () => {
    getBookingByToken.mockResolvedValue(booking({ status: 'HELD', paid: false, meetingUrl: null }));
    render(<BookingPaidPage />);
    expect(await screen.findByText('Оплата принята')).toBeTruthy();
    expect(screen.getByText(/Подтверждаем запись/)).toBeTruthy();
    expect(screen.queryByText(CONFIRMED_TEXT)).toBeNull();
    // Отмена и «в календарь» до подтверждения не предлагаются.
    expect(screen.queryByText('Отменить запись')).toBeNull();
  });

  it('HELD → поллинг → CONFIRMED: страница сама переходит в подтверждённую ветку', async () => {
    vi.useFakeTimers();
    getBookingByToken
      .mockResolvedValueOnce(booking({ status: 'HELD', paid: false, meetingUrl: null }))
      .mockResolvedValueOnce(booking({ status: 'HELD', paid: false, meetingUrl: null }))
      .mockResolvedValue(booking());
    render(<BookingPaidPage />);
    await tick(0);
    expect(screen.queryByText(CONFIRMED_TEXT)).toBeNull();
    await tick(POLL_INTERVAL_MS);
    expect(screen.queryByText(CONFIRMED_TEXT)).toBeNull();
    await tick(POLL_INTERVAL_MS);
    expect(screen.getByText(CONFIRMED_TEXT)).toBeTruthy();
    expect(getBookingByToken).toHaveBeenCalledTimes(3);
    // В подтверждённой ветке поллинг прекращается.
    await tick(POLL_INTERVAL_MS * 3);
    expect(getBookingByToken).toHaveBeenCalledTimes(3);
  });

  it('HELD → таймаут: честный текст, контакт, отчёт наверх, поллинг остановлен', async () => {
    vi.useFakeTimers();
    getBookingByToken.mockResolvedValue(booking({ status: 'HELD', paid: false, meetingUrl: null }));
    render(<BookingPaidPage />);
    await tick(POLL_LIMIT_MS + POLL_INTERVAL_MS);
    expect(screen.getByText('Подтверждение задерживается')).toBeTruthy();
    expect(screen.queryByText(CONFIRMED_TEXT)).toBeNull();
    const tg = screen.getByText('@kotlarewski') as HTMLAnchorElement;
    expect(tg.getAttribute('href')).toBe('https://t.me/kotlarewski');
    expect(reportClientError).toHaveBeenCalledTimes(1);
    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({ section: 'booking', message: expect.stringContaining('HELD') }));
    const calls = getBookingByToken.mock.calls.length;
    await tick(POLL_INTERVAL_MS * 4);
    expect(getBookingByToken.mock.calls.length).toBe(calls);
  });

  it('«Проверить ещё раз» после таймаута запускает новый цикл и подхватывает CONFIRMED', async () => {
    vi.useFakeTimers();
    getBookingByToken.mockResolvedValue(booking({ status: 'HELD', paid: false, meetingUrl: null }));
    render(<BookingPaidPage />);
    await tick(POLL_LIMIT_MS + POLL_INTERVAL_MS);
    getBookingByToken.mockResolvedValue(booking());
    await act(async () => { fireEvent.click(screen.getByText('Проверить ещё раз')); });
    await tick(0);
    expect(screen.getByText(CONFIRMED_TEXT)).toBeTruthy();
  });

  it('сбой сети посреди ожидания не стирает бронь и не обрывает поллинг', async () => {
    vi.useFakeTimers();
    getBookingByToken
      .mockResolvedValueOnce(booking({ status: 'HELD', paid: false, meetingUrl: null }))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(booking());
    render(<BookingPaidPage />);
    await tick(0);
    await tick(POLL_INTERVAL_MS);
    expect(screen.getByText('Оплата принята')).toBeTruthy();
    await tick(POLL_INTERVAL_MS);
    expect(screen.getByText(CONFIRMED_TEXT)).toBeTruthy();
  });
});

describe('BookingPaidPage — CANCELLED и неизвестный статус', () => {
  it('CANCELLED без оплаты — «Запись отменена», условная формулировка про возврат', async () => {
    getBookingByToken.mockResolvedValue(booking({ status: 'CANCELLED', paid: false }));
    render(<BookingPaidPage />);
    expect(await screen.findByText('Запись отменена')).toBeTruthy();
    expect(screen.getByText(/Если оплата уже прошла/)).toBeTruthy();
    expect(screen.queryByText(CONFIRMED_TEXT)).toBeNull();
  });

  it('CANCELLED + paid — деньги получены, а брони нет: прямо говорим про возврат и даём контакт', async () => {
    getBookingByToken.mockResolvedValue(booking({ status: 'CANCELLED', paid: true }));
    render(<BookingPaidPage />);
    expect(await screen.findByText('Запись отменена')).toBeTruthy();
    expect(screen.getByText(/Оплата получена/)).toBeTruthy();
    expect(screen.queryByText(/Если оплата уже прошла/)).toBeNull();
    expect((screen.getByText('@kotlarewski') as HTMLAnchorElement).getAttribute('href')).toBe('https://t.me/kotlarewski');
  });

  it('неизвестный статус — нейтральное «Оплата принята», без «подтверждена»', async () => {
    getBookingByToken.mockResolvedValue(booking({ status: 'SOMETHING_NEW' }));
    render(<BookingPaidPage />);
    expect(await screen.findByText('Оплата принята')).toBeTruthy();
    expect(screen.queryByText(CONFIRMED_TEXT)).toBeNull();
    expect(getBookingByToken).toHaveBeenCalledTimes(1);
  });
});

describe('FailURL', () => {
  it('не обещает, что время ещё держится (токена нет — срок холда проверить нечем)', () => {
    window.history.pushState({}, '', '/booking/paid?fail=1');
    render(<BookingPaidPage />);
    expect(screen.getByText('Оплата не прошла')).toBeTruthy();
    expect(screen.queryByText(/держится/)).toBeNull();
    expect(screen.getByText(/попробуйте ещё раз/)).toBeTruthy();
  });
});

// Класс: каждое значение enum BookingStatus обязано иметь решённую ветку.
// Новый статус в schema.prisma без записи здесь роняет тест — и заставляет
// решить, что страница о нём говорит (по умолчанию она нейтральна, не «подтверждена»).
describe('BookingPaidPage — все значения BookingStatus', () => {
  const EXPECTED: Record<BookingStatus, PaidPhase> = {
    HELD: 'pending',
    CONFIRMED: 'confirmed',
    CANCELLED: 'cancelled',
    COMPLETED: 'unknown',
  };
  const statuses = Object.values(BookingStatus);

  it('у каждого статуса из Prisma есть решённая ветка', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...statuses].sort());
  });

  it.each(statuses)('%s: модель отдаёт ожидаемую фазу', (status) => {
    expect(paidPhase(status)).toBe(EXPECTED[status]);
  });

  it.each(statuses)('%s: «Встреча подтверждена» только у CONFIRMED', async (status) => {
    getBookingByToken.mockResolvedValue(booking({ status, paid: status === 'CANCELLED' || status === 'COMPLETED' }));
    render(<BookingPaidPage />);
    // Дождаться конца загрузки: скелетон сменяется любым из заголовков.
    await screen.findByRole('heading');
    const shown = screen.queryByText(CONFIRMED_TEXT) !== null;
    expect(shown).toBe(status === BookingStatus.CONFIRMED);
  });
});
