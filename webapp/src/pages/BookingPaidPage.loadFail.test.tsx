// @vitest-environment jsdom
// Аудит 2026-10-11: при любом отказе загрузки брони страница после оплаты
// рисовала «Оплата принята» (404, 5xx, сеть, HTML окна деплоя) и молчала
// наверх. Здесь: каждый вид отказа даёт честный экран и один отчёт без токена;
// «Обновить» восстанавливает; уже показанная бронь не стирается отказом
// повторной проверки.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { BookingPaidPage } from './BookingPaidPage';
import { ApiError } from '../apiClient';
import { POLL_LIMIT_MS, POLL_INTERVAL_MS } from '../components/booking/paidPageModel';

const getBookingByToken = vi.fn();
const reportClientError = vi.fn();
vi.mock('../api', () => ({
  api: { getBookingByToken: (...a: unknown[]) => getBookingByToken(...a), cancelBooking: vi.fn() },
  reportClientError: (...a: unknown[]) => reportClientError(...a),
}));

const TOKEN = 'secret-token-123';
const booking = (over: Record<string, unknown> = {}) => ({
  status: 'CONFIRMED', paid: true, type: 'SESSION_50' as const,
  startsAt: '2099-08-10T10:00:00Z', endsAt: '2099-08-10T10:50:00Z',
  durationMin: 50, ...over,
});
const held = () => booking({ status: 'HELD', paid: false });

beforeEach(() => {
  vi.clearAllMocks();
  window.history.pushState({}, '', `/booking/paid?token=${TOKEN}`);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.pushState({}, '', '/booking/paid');
});

const NOT_FOUND = 'Запись по этой ссылке не найдена';
const CHECK_FAILED = 'Не удалось проверить оплату';
const REFRESH_FAILED = /Не удалось обновить статус записи/;

describe('BookingPaidPage — отказ загрузки брони по виду ошибки', () => {
  const cases: Array<[string, () => unknown, string]> = [
    ['404', () => new ApiError(404, 'Not Found'), NOT_FOUND],
    ['500', () => new ApiError(500, 'Internal'), CHECK_FAILED],
    ['503', () => new ApiError(503, 'Unavailable'), CHECK_FAILED],
    ['429', () => new ApiError(429, 'Too Many'), CHECK_FAILED],
    ['сеть (TypeError)', () => new TypeError('Failed to fetch'), CHECK_FAILED],
    ['HTML вместо JSON (SyntaxError)', () => new SyntaxError('Unexpected token <'), CHECK_FAILED],
  ];

  it.each(cases)('%s: не «Оплата принята», отчёт наверх без токена', async (_name, makeErr, heading) => {
    getBookingByToken.mockRejectedValue(makeErr());
    render(<BookingPaidPage />);
    expect(await screen.findByText(heading)).toBeTruthy();
    expect(screen.queryByText('Оплата принята')).toBeNull();
    expect(screen.queryByText(/подтверждена/)).toBeNull();
    expect(reportClientError).toHaveBeenCalledTimes(1);
    const arg = reportClientError.mock.calls[0][0] as { section: string; message: string };
    expect(arg.section).toBe('booking');
    expect(arg.message).not.toContain(TOKEN);
  });

  it('404 и сбой рисуют разные экраны: у «не найдена» нет «Обновить», у сбоя есть', async () => {
    getBookingByToken.mockRejectedValue(new ApiError(404, 'Not Found'));
    const first = render(<BookingPaidPage />);
    await screen.findByText(NOT_FOUND);
    expect(screen.queryByText('Обновить')).toBeNull();
    expect((screen.getByText('@kotlarewski') as HTMLAnchorElement).getAttribute('href')).toBe('https://t.me/kotlarewski');
    first.unmount();

    window.history.pushState({}, '', `/booking/paid?token=${TOKEN}`);
    getBookingByToken.mockRejectedValue(new ApiError(500, 'Internal'));
    render(<BookingPaidPage />);
    await screen.findByText(CHECK_FAILED);
    expect(screen.getByText('Обновить')).toBeTruthy();
    expect(screen.queryByText(NOT_FOUND)).toBeNull();
  });

  it('в отчёте — статус или текст ошибки, чтобы отличить 5xx от сети', async () => {
    getBookingByToken.mockRejectedValue(new ApiError(502, 'Bad Gateway'));
    render(<BookingPaidPage />);
    await screen.findByText(CHECK_FAILED);
    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('HTTP 502') }));
  });
});

describe('BookingPaidPage — ссылка управления записью (/booking/manage)', () => {
  beforeEach(() => window.history.pushState({}, '', `/booking/manage?token=${TOKEN}`));

  it('сбой говорит о записи, а не об оплате; «Обновить» есть', async () => {
    getBookingByToken.mockRejectedValue(new ApiError(500, 'Internal'));
    render(<BookingPaidPage />);
    expect(await screen.findByText('Не удалось загрузить запись')).toBeTruthy();
    expect(screen.queryByText(CHECK_FAILED)).toBeNull();
    expect(screen.queryByText(/деньги/i)).toBeNull();
    expect(screen.getByText('Обновить')).toBeTruthy();
  });

  it('404 — тот же экран «не найдена», что и на возврате с оплаты', async () => {
    getBookingByToken.mockRejectedValue(new ApiError(404, 'Not Found'));
    render(<BookingPaidPage />);
    expect(await screen.findByText(NOT_FOUND)).toBeTruthy();
    expect(screen.queryByText('Оплата принята')).toBeNull();
  });
});

describe('BookingPaidPage — «Обновить» после отказа', () => {
  it('повторный запрос идёт в сеть и при успехе показывает бронь', async () => {
    getBookingByToken.mockRejectedValueOnce(new ApiError(500, 'Internal')).mockResolvedValue(booking());
    render(<BookingPaidPage />);
    await screen.findByText(CHECK_FAILED);
    fireEvent.click(screen.getByText('Обновить'));
    expect(await screen.findByText('Оплата прошла')).toBeTruthy();
    expect(getBookingByToken).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(CHECK_FAILED)).toBeNull();
  });

  it('повторный отказ остаётся экраном отказа и не шлёт второй отчёт', async () => {
    getBookingByToken.mockRejectedValue(new ApiError(503, 'Unavailable'));
    render(<BookingPaidPage />);
    await screen.findByText(CHECK_FAILED);
    fireEvent.click(screen.getByText('Обновить'));
    await screen.findByText(CHECK_FAILED);
    await screen.findByText('Обновить');
    expect(getBookingByToken).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Оплата принята')).toBeNull();
    expect(reportClientError).toHaveBeenCalledTimes(1);
  });

  it('пока идёт повторный запрос — скелетон, а не «Оплата принята»', async () => {
    getBookingByToken.mockRejectedValueOnce(new ApiError(500, 'Internal')).mockReturnValue(new Promise(() => {}));
    const { container } = render(<BookingPaidPage />);
    await screen.findByText(CHECK_FAILED);
    fireEvent.click(screen.getByText('Обновить'));
    expect(container.querySelectorAll('.skel').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText('Оплата принята')).toBeNull();
    expect(screen.queryByText(CHECK_FAILED)).toBeNull();
  });
});

describe('BookingPaidPage — отказ повторной проверки не стирает бронь', () => {
  const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

  it('HELD → таймаут → «Проверить ещё раз» → 500: карточка брони на месте, «Оплата принята» нет', async () => {
    vi.useFakeTimers();
    getBookingByToken.mockResolvedValue(held());
    render(<BookingPaidPage />);
    await tick(POLL_LIMIT_MS + POLL_INTERVAL_MS);
    expect(screen.getByText('Подтверждение задерживается')).toBeTruthy();
    getBookingByToken.mockRejectedValue(new ApiError(500, 'Internal'));
    await act(async () => { fireEvent.click(screen.getByText('Проверить ещё раз')); });
    await tick(0);
    expect(screen.queryByText(CHECK_FAILED)).toBeNull();
    // Бронь жива: экран ожидания с карточкой встречи, а не «принята без деталей».
    expect(screen.getByText(/Подтверждаю запись|Подтверждение задерживается/)).toBeTruthy();
    expect(screen.getByText(/50/)).toBeTruthy();
    // Цикл ожидания продолжается и дотягивает до честного таймаута.
    await tick(POLL_LIMIT_MS + POLL_INTERVAL_MS);
    expect(screen.getByText('Подтверждение задерживается')).toBeTruthy();
  });

  // Аудит 2026-10: отказ повтора при показанной брони проходил молча — ни
  // отчёта наверх, ни видимой реакции на «Проверить ещё раз».
  it('отказ повтора виден строкой «не удалось обновить» и шлёт один отчёт без токена', async () => {
    vi.useFakeTimers();
    getBookingByToken.mockResolvedValue(held());
    render(<BookingPaidPage />);
    await tick(POLL_LIMIT_MS + POLL_INTERVAL_MS);
    expect(screen.queryByText(REFRESH_FAILED)).toBeNull();
    getBookingByToken.mockRejectedValue(new ApiError(500, 'Internal'));
    await act(async () => { fireEvent.click(screen.getByText('Проверить ещё раз')); });
    await tick(0);
    expect(screen.getByText(REFRESH_FAILED)).toBeTruthy();
    await tick(POLL_INTERVAL_MS * 3);
    const reports = reportClientError.mock.calls.map(([a]) => a as { message: string; section: string });
    const refreshReports = reports.filter((r) => r.message.includes('обновить'));
    expect(refreshReports).toHaveLength(1);
    expect(refreshReports[0].section).toBe('booking');
    expect(refreshReports[0].message).toContain('HTTP 500');
    expect(refreshReports[0].message).not.toContain(TOKEN);
  });

  it('«Повторить» после отказа: удачный ответ убирает строку и показывает подтверждение', async () => {
    vi.useFakeTimers();
    getBookingByToken.mockResolvedValueOnce(held()).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<BookingPaidPage />);
    await tick(0);
    await tick(POLL_INTERVAL_MS);
    expect(screen.getByText(REFRESH_FAILED)).toBeTruthy();
    getBookingByToken.mockResolvedValue(booking());
    await act(async () => { fireEvent.click(screen.getByText('Повторить')); });
    await tick(0);
    expect(screen.getByText('Оплата прошла')).toBeTruthy();
    expect(screen.queryByText(REFRESH_FAILED)).toBeNull();
  });

  it('контрольный: удачные повторы строку не рисуют и отчётов не шлют', async () => {
    vi.useFakeTimers();
    getBookingByToken.mockResolvedValue(held());
    render(<BookingPaidPage />);
    await tick(POLL_INTERVAL_MS * 3);
    expect(screen.queryByText(REFRESH_FAILED)).toBeNull();
    expect(reportClientError).not.toHaveBeenCalled();
  });
});
