// @vitest-environment jsdom
// Правило №7 для второго входа в форму записи — слоты (BookingPicker →
// RequestField), аудит 2026-10, frontends#5. Простая заявка (BookingForm)
// покрыта в pages/landing/BookingForm.crisis.test.tsx; здесь — поле «Запрос»
// пикера и оба терминальных экрана, на которых оно может оказаться.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BookingPicker } from './BookingPicker';

vi.mock('../api', () => ({
  api: { getSlots: vi.fn(), getBookingOptions: vi.fn(), bookSlot: vi.fn(), cancelBooking: vi.fn(), trackPublicEvent: vi.fn(), trackEvent: vi.fn() },
  reportClientError: vi.fn(),
}));
vi.mock('./booking/useClientTimeZone', () => ({ useClientTimeZone: () => ['Europe/Moscow', vi.fn()] }));
import { api } from '../api';
import { setMetrikaSessionPossible } from '../lib/metrikaGate';
setMetrikaSessionPossible(false);
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const HOTLINE = '8-800-100-49-94';
const SLOT = { startsAt: '2026-09-10T09:00:00.000Z', endsAt: '2026-09-10T09:50:00.000Z', durationMin: 50 };
const timeLabel = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }).format(new Date(SLOT.startsAt));
const INTRO = [{ type: 'INTRO_15' as const, label: 'Знакомство', durationMin: 15, price: 0, note: '' }];
const PAID = [{ type: 'SESSION_50' as const, label: 'Сессия', durationMin: 50, price: 3000, note: '' }];

async function fillAndSubmit(text: string) {
  render(<BookingPicker />);
  fireEvent.click(await screen.findByText(timeLabel));
  fireEvent.change(screen.getByLabelText('Имя *'), { target: { value: 'Аня' } });
  fireEvent.change(screen.getByLabelText('Где вам удобнее отвечать *'), { target: { value: '@anya' } });
  fireEvent.change(screen.getByLabelText(/Запрос/), { target: { value: text } });
  const notice = screen.queryByRole('checkbox', { name: /Понятно: встреча состоится только после подтверждения/ });
  if (notice) fireEvent.click(notice);
  fireEvent.click(screen.getByRole('checkbox', { name: /оферты/ }));
  fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.pushState({}, '', '/');
  Element.prototype.scrollIntoView = vi.fn();
  mockApi.getSlots.mockResolvedValue([SLOT]);
  mockApi.getBookingOptions.mockResolvedValue(INTRO);
  mockApi.bookSlot.mockResolvedValue({ id: 1, cancelToken: 't', heldUntil: null, status: 'confirmed', paymentUrl: null });
});
afterEach(() => cleanup());

describe('BookingPicker — кризисный путь поля «Запрос»', () => {
  it('кризисный текст: карточка до отправки, текст уходит как есть, на «Заявка принята» карточка остаётся', async () => {
    render(<BookingPicker />);
    fireEvent.click(await screen.findByText(timeLabel));
    expect(screen.queryByText(HOTLINE)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Запрос/), { target: { value: 'не вижу смысла жить дальше' } });
    expect(screen.getByText(HOTLINE)).toBeTruthy();
    cleanup();

    await fillAndSubmit('не хочу больше жить');
    await screen.findByText('Заявка принята');
    expect(mockApi.bookSlot).toHaveBeenCalledWith(expect.objectContaining({ message: 'не хочу больше жить' }));
    expect(screen.getByText(HOTLINE)).toBeTruthy();
  });

  it('экран ожидания оплаты (платная сессия): карточка тоже на месте', async () => {
    mockApi.getBookingOptions.mockResolvedValue(PAID);
    mockApi.bookSlot.mockResolvedValue({ id: 2, cancelToken: 't2', heldUntil: null, status: 'pending', paymentUrl: 'https://pay.example/x' });
    await fillAndSubmit('не хочу больше жить');
    await screen.findByText('Время зарезервировано');
    expect(screen.getByText(HOTLINE)).toBeTruthy();
  });

  it('контроль: обычный запрос — карточки нет ни в поле, ни на экране результата, событий нет', async () => {
    await fillAndSubmit('тревога на работе');
    await screen.findByText('Заявка принята');
    expect(screen.queryByText(HOTLINE)).toBeNull();
    expect(document.body.textContent).not.toMatch(/телефон доверия/i);
    expect(mockApi.trackPublicEvent).not.toHaveBeenCalled();
  });

  it('показ карточки в пикере уходит анонимным путём с surface=booking', async () => {
    render(<BookingPicker />);
    fireEvent.click(await screen.findByText(timeLabel));
    fireEvent.change(screen.getByLabelText(/Запрос/), { target: { value: 'не хочу больше жить' } });
    expect(mockApi.trackPublicEvent).toHaveBeenCalledWith('crisis_card_shown', { surface: 'booking' });
  });
});
