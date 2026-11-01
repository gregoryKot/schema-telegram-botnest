// @vitest-environment jsdom
// Шов (правило №14): мокается только глобальный fetch. Дальше всё настоящее:
// api.getBookingByToken → get/cachedGet → authedFetch → apiError/readJsonBody →
// useBookingByToken → BookingPaidPage. Так проверяется то, чего не видит мок
// '../api': что HTML окна деплоя действительно бросает (SyntaxError из
// readJsonBody), а не возвращает null, и что 404 доезжает как ApiError.status.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BookingPaidPage } from './BookingPaidPage';
import { api } from '../api';
import { clearApiCache } from '../../../shared/src/api/apiCache';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  clearApiCache();
  vi.stubGlobal('fetch', fetchMock);
  window.history.pushState({}, '', '/booking/paid?token=abc');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/booking/paid');
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const byTokenCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/booking/by-token/'));

describe('BookingPaidPage на шве fetch → api → хук → страница', () => {
  it('maintenance-HTML со статусом 200 — «не удалось проверить», не «Оплата принята»', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('/api/booking/by-token/') ? new Response('<html>maintenance</html>', { status: 200 }) : json(200, {}));
    render(<BookingPaidPage />);
    expect(await screen.findByText('Не удалось проверить оплату')).toBeTruthy();
    expect(screen.queryByText('Оплата принята')).toBeNull();
    expect(screen.getByText('Обновить')).toBeTruthy();
  });

  it('503 с пустым телом — «не удалось проверить»', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('/api/booking/by-token/') ? new Response('', { status: 503 }) : json(200, {}));
    render(<BookingPaidPage />);
    expect(await screen.findByText('Не удалось проверить оплату')).toBeTruthy();
    expect(screen.queryByText('Оплата принята')).toBeNull();
  });

  it('404 с JSON-телом — «запись не найдена», повтор не предлагается', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('/api/booking/by-token/') ? json(404, { message: 'Booking not found' }) : json(200, {}));
    render(<BookingPaidPage />);
    expect(await screen.findByText('Запись по этой ссылке не найдена')).toBeTruthy();
    expect(screen.queryByText('Обновить')).toBeNull();
    expect(byTokenCalls()).toHaveLength(1);
  });

  it('обрыв сети (fetch бросает TypeError) — «не удалось проверить»', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/api/booking/by-token/')) throw new TypeError('Failed to fetch');
      return json(200, {});
    });
    render(<BookingPaidPage />);
    expect(await screen.findByText('Не удалось проверить оплату')).toBeTruthy();
  });

  it('контрольный: нормальный ответ рисует бронь', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('/api/booking/by-token/')
        ? json(200, { status: 'CONFIRMED', paid: true, type: 'SESSION_50', startsAt: '2099-08-10T10:00:00Z', endsAt: '2099-08-10T10:50:00Z', durationMin: 50 })
        : json(200, {}));
    render(<BookingPaidPage />);
    expect(await screen.findByText('Оплата прошла')).toBeTruthy();
  });
});

// Опрос статуса брони идёт через настоящий get → cachedGet: при кеше второй
// запрос в окне 15 с отдавал прежний HELD, хотя вебхук уже перевёл бронь в
// CONFIRMED (аудит 2026-10), и «Проверить ещё раз» не доходило до сервера.
describe('api.getBookingByToken на шве с настоящим cachedGet', () => {
  const booking = (status: string) =>
    ({ status, paid: status === 'CONFIRMED', type: 'SESSION_50', startsAt: '2099-08-10T10:00:00Z', endsAt: '2099-08-10T10:50:00Z', durationMin: 50 });

  it('повторный запрос идёт в сеть и видит новый статус', async () => {
    const statuses = ['HELD', 'CONFIRMED'];
    fetchMock.mockImplementation(async () => json(200, booking(statuses.shift() ?? 'CONFIRMED')));
    expect((await api.getBookingByToken('abc')).status).toBe('HELD');
    expect((await api.getBookingByToken('abc')).status).toBe('CONFIRMED');
    expect(byTokenCalls()).toHaveLength(2);
  });

  it('контрольный: обычный GET в том же окне берётся из кеша', async () => {
    fetchMock.mockImplementation(async () => json(200, { text: 'фраза' }));
    await api.getHealthyPhrase();
    await api.getHealthyPhrase();
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/healthy-phrase'))).toHaveLength(1);
  });
});
