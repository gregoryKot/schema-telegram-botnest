// @vitest-environment jsdom
// Цена в форме записи по стране посетителя (решение владельца 2026-10-20):
// Россия — рубли и онлайн-оплата (Robokassa), Израиль/Европа/мир — шекели,
// евро, доллары, и бронь платной сессии подтверждается сразу, без оплаты
// онлайн. Страна = часовой пояс из useClientTimeZone — тот же, что уходит в
// BookDto.clientTimeZone, поэтому показанная цена совпадает с серверной.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { BookingPicker } from './BookingPicker';
import { localTimeLabel } from '../../../shared/src/booking/clientTimeZone';

vi.mock('../api', () => ({
  api: { getSlots: vi.fn(), getBookingOptions: vi.fn(), bookSlot: vi.fn(), cancelBooking: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('./booking/useClientTimeZone', () => ({ useClientTimeZone: vi.fn() }));
import { useClientTimeZone } from './booking/useClientTimeZone';
const mockTz = useClientTimeZone as unknown as ReturnType<typeof vi.fn>;

import { setMetrikaSessionPossible } from '../lib/metrikaGate';
setMetrikaSessionPossible(false);

const SLOT = { startsAt: '2026-09-10T09:00:00.000Z', endsAt: '2026-09-10T09:50:00.000Z', durationMin: 50 };
const OPTIONS = [
  { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0, prices: { RUB: 0, ILS: 0, EUR: 0, USD: 0 }, note: '' },
  { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 4000, prices: { RUB: 4000, ILS: 200, EUR: 65, USD: 70 }, note: '' },
];
const RUB_4000 = (4000).toLocaleString('ru-RU') + ' ₽';
// getByText/accessible name сворачивают пробельные символы — неразрывный пробел разрядов тоже.
const flat = (s: string) => s.replace(/\s+/g, ' ');

beforeEach(() => {
  vi.clearAllMocks();
  window.history.pushState({}, '', '/');
  sessionStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  mockApi.getSlots.mockResolvedValue([SLOT]);
  mockApi.getBookingOptions.mockResolvedValue(OPTIONS);
});
afterEach(() => cleanup());

/** Открывает форму: слот выбран, поля заполнены, формат «Сессия» (платный). */
async function openSessionForm(tz: string) {
  mockTz.mockReturnValue([tz, vi.fn()]);
  render(<BookingPicker />);
  const time = await screen.findByText(localTimeLabel(SLOT.startsAt, tz));
  fireEvent.click(time);
  fireEvent.click(screen.getByRole('button', { name: /^Сессия/ }));
  fireEvent.change(screen.getByLabelText('Имя *'), { target: { value: 'Аня' } });
  fireEvent.change(screen.getByLabelText('Где вам удобнее отвечать *'), { target: { value: '@anya' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /оферты/ }));
}

describe('BookingPicker — цена в валюте посетителя', () => {
  it.each([
    ['Europe/Moscow', RUB_4000],
    ['Asia/Jerusalem', '200 ₪'],
    ['Europe/Berlin', '65 €'],
    ['America/New_York', '70 $'],
  ])('пояс %s: на кнопке формата «Сессия · %s», у знакомства — «бесплатно»', async (tz, text) => {
    mockTz.mockReturnValue([tz, vi.fn()]);
    render(<BookingPicker />);
    await screen.findByText(localTimeLabel(SLOT.startsAt, tz));
    expect(screen.getByRole('button', { name: (n) => flat(n) === `Сессия · ${flat(text)}` })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Знакомство · бесплатно/ })).toBeTruthy();
  });

  it('рубли: «Оплатить 4 000 ₽ и записаться →», пояснение про Robokassa, запись ведёт к оплате', async () => {
    await openSessionForm('Europe/Moscow');
    const btn = screen.getByRole('button', { name: /Оплатить/ });
    expect(flat(btn.textContent ?? '')).toContain(`Оплатить ${flat(RUB_4000)} и записаться →`);
    expect(screen.getByText('Оплата картой или СБП через Robokassa. Чек придёт автоматически.')).toBeTruthy();

    mockApi.bookSlot.mockResolvedValue({ id: 2, cancelToken: 't', heldUntil: null, status: 'pending', paymentUrl: 'https://pay.example/x', meetingUrl: null });
    fireEvent.click(btn);
    await screen.findByText('Время зарезервировано');
    expect(flat(screen.getByText(/Для подтверждения нужна оплата/).textContent ?? '')).toBe(`Для подтверждения нужна оплата ${flat(RUB_4000)}.`);
  });

  it('доллары: кнопка как у бесплатной, пояснение про договорённость, нет Robokassa', async () => {
    await openSessionForm('America/New_York');
    expect(screen.queryByRole('button', { name: /Оплатить/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Записаться на/ })).toBeTruthy();
    expect(screen.getByText('Сессия – 70 $. Об оплате договоримся после записи.')).toBeTruthy();
    expect(screen.queryByText(/Robokassa/)).toBeNull();
  });

  it('доллары: бронь подтверждается сразу (paymentUrl: null), запрос несёт пояс, экран «забронировано» со стоимостью', async () => {
    await openSessionForm('America/New_York');
    mockApi.bookSlot.mockResolvedValue({ id: 3, cancelToken: 't3', heldUntil: null, status: 'confirmed', paymentUrl: null, meetingUrl: null });
    fireEvent.click(screen.getByRole('button', { name: /^Записаться на/ }));
    await screen.findByText('Время забронировано');
    expect(mockApi.bookSlot).toHaveBeenCalledWith(expect.objectContaining({ type: 'SESSION_50', clientTimeZone: 'America/New_York' }));
    expect(screen.getByText('Стоимость сессии – 70 $. Об оплате напишу вам перед встречей.')).toBeTruthy();
  });

  it('рубли с сервером без paymentUrl — строки про стоимость на экране «забронировано» нет', async () => {
    await openSessionForm('Europe/Moscow');
    mockApi.bookSlot.mockResolvedValue({ id: 4, cancelToken: 't4', heldUntil: null, status: 'confirmed', paymentUrl: null, meetingUrl: null });
    fireEvent.click(screen.getByRole('button', { name: /Оплатить/ }));
    await screen.findByText('Время забронировано');
    expect(screen.queryByText(/Стоимость сессии/)).toBeNull();
  });

  it('знакомство вне рублей — только бесплатный текст, без стоимости', async () => {
    mockTz.mockReturnValue(['America/New_York', vi.fn()]);
    mockApi.bookSlot.mockResolvedValue({ id: 5, cancelToken: 't5', heldUntil: null, status: 'confirmed', paymentUrl: null, meetingUrl: null });
    render(<BookingPicker />);
    fireEvent.click(await screen.findByText(localTimeLabel(SLOT.startsAt, 'America/New_York')));
    expect(screen.getByText('Первая встреча 15 минут — бесплатно. Никаких обязательств.')).toBeTruthy();
    expect(screen.queryByText(/Стоимость сессии/)).toBeNull();
    await act(async () => {});
  });

  it('старый сервер без prices: даже в «зарубежном» поясе показываются рубли из price', async () => {
    mockApi.getBookingOptions.mockResolvedValue([
      { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0, note: '' },
      { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 3000, note: '' },
    ]);
    await openSessionForm('America/New_York');
    expect(flat(screen.getByRole('button', { name: /Оплатить/ }).textContent ?? '')).toContain(`Оплатить ${flat((3000).toLocaleString('ru-RU'))} ₽`);
  });
});
