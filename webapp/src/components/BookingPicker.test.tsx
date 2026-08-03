// @vitest-environment jsdom
// Компонентные тесты BookingPicker (webapp) — денежный путь записи к
// терапевту: выбор слота, обязательное согласие с офертой, сабмит,
// платный/бесплатный формат, занятый слот (CLIENT_NOT_FOUND / общая ошибка).
// Образец сетапа: DonatePage.test.tsx, SubscribePage.test.tsx (мок '../api').
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { BookingPicker } from './BookingPicker';

vi.mock('../api', () => ({
  api: {
    getSlots: vi.fn(),
    getBookingOptions: vi.fn(),
    bookSlot: vi.fn(),
    cancelBooking: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const timeLabelFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' });
const timeLabel = (iso: string) => timeLabelFmt.format(new Date(iso));

const SLOT_A = { startsAt: '2026-09-10T09:00:00.000Z', endsAt: '2026-09-10T09:50:00.000Z', durationMin: 50 };
const SLOT_B = { startsAt: '2026-09-10T12:00:00.000Z', endsAt: '2026-09-10T12:50:00.000Z', durationMin: 50 };
const SLOTS = [SLOT_A, SLOT_B];
const OPTIONS = [{ type: 'SESSION_50' as const, label: 'Сессия 50 мин', durationMin: 50, price: 3000, note: 'Полная сессия' }];

function resetLocation() {
  window.history.pushState({}, '', '/booking');
}

beforeEach(() => {
  vi.clearAllMocks();
  resetLocation();
  mockApi.getSlots.mockResolvedValue(SLOTS);
  mockApi.getBookingOptions.mockResolvedValue(OPTIONS);
  // jsdom не реализует scrollIntoView (компонент скроллит результат в
  // видимую область на терминальных экранах) — без стаба падает с TypeError.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  resetLocation();
});

async function renderLoaded() {
  render(<BookingPicker />);
  // Дожидаемся загрузки слотов (useEffect -> api.getSlots).
  await screen.findByText(timeLabel(SLOT_A.startsAt));
}

async function fillAndSelectSlot() {
  await renderLoaded();
  fireEvent.click(screen.getByText(timeLabel(SLOT_A.startsAt)));
  fireEvent.change(screen.getByLabelText('Имя *'), { target: { value: 'Аня' } });
  fireEvent.change(screen.getByLabelText('Telegram / телефон *'), { target: { value: '@anya' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /оферты/ }));
}

describe('BookingPicker — загрузка и пустое состояние', () => {
  it('пока слоты грузятся, показывает индикатор загрузки', () => {
    mockApi.getSlots.mockReturnValue(new Promise(() => {})); // никогда не резолвится
    render(<BookingPicker />);
    expect(screen.getByText('Загружаю свободное время…')).toBeTruthy();
  });

  it('когда слотов нет — рендерит fallback вместо формы', async () => {
    mockApi.getSlots.mockResolvedValue([]);
    render(<BookingPicker fallback={<div>Нет свободного времени, напишите в Telegram</div>} />);
    await screen.findByText('Нет свободного времени, напишите в Telegram');
  });

  it('при ошибке загрузки слотов тоже рендерит fallback', async () => {
    mockApi.getSlots.mockRejectedValue(new Error('network'));
    render(<BookingPicker fallback={<div>Запасной вариант связи</div>} />);
    await screen.findByText('Запасной вариант связи');
  });
});

describe('BookingPicker — выбор слота и обязательные поля', () => {
  it('показывает доступные времена дня после загрузки', async () => {
    await renderLoaded();
    expect(screen.getByText(timeLabel(SLOT_A.startsAt))).toBeTruthy();
    expect(screen.getByText(timeLabel(SLOT_B.startsAt))).toBeTruthy();
  });

  it('до выбора слота поля имени/контакта не показаны', async () => {
    await renderLoaded();
    expect(screen.queryByLabelText('Имя *')).toBeNull();
  });

  it('кнопка сабмита задизейблена, пока не заполнены имя, контакт и согласие', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(timeLabel(SLOT_A.startsAt)));
    const btn = screen.getByRole('button', { name: /Записаться на/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('после заполнения имени, контакта и согласия кнопка активна', async () => {
    await fillAndSelectSlot();
    const btn = screen.getByRole('button', { name: /Записаться на/ });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('BookingPicker — сабмит записи', () => {
  it('вызывает api.bookSlot с выбранным временем, именем, контактом и acceptedOffer=true', async () => {
    mockApi.bookSlot.mockResolvedValue({ id: 1, cancelToken: 'tok1', heldUntil: null, status: 'confirmed', paymentUrl: null, meetingUrl: null });
    await fillAndSelectSlot();
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));

    await act(async () => {});

    expect(mockApi.bookSlot).toHaveBeenCalledWith(
      expect.objectContaining({
        startsAt: SLOT_A.startsAt,
        durationMin: SLOT_A.durationMin,
        clientName: 'Аня',
        clientContact: '@anya',
        acceptedOffer: true,
        website: '',
      }),
    );
  });

  it('успешная бесплатная запись без paymentUrl показывает «Время забронировано»', async () => {
    mockApi.bookSlot.mockResolvedValue({ id: 1, cancelToken: 'tok1', heldUntil: null, status: 'confirmed', paymentUrl: null, meetingUrl: null });
    await fillAndSelectSlot();
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));

    await screen.findByText('Время забронировано');
  });

  it('запись с paymentUrl уводит на экран ожидания оплаты, а не сразу «забронировано»', async () => {
    mockApi.bookSlot.mockResolvedValue({ id: 2, cancelToken: 'tok2', heldUntil: null, status: 'pending', paymentUrl: 'https://pay.example/x', meetingUrl: null });
    await fillAndSelectSlot();
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));

    await screen.findByText('Слот зарезервирован');
    expect(screen.queryByText('Время забронировано')).toBeNull();
    expect(screen.getByRole('link', { name: /Перейти к оплате/ }).getAttribute('href')).toBe('https://pay.example/x');
  });
});

describe('BookingPicker — занятый слот и ошибки API', () => {
  it('ошибка CLIENT_NOT_FOUND (не найден контакт «повторной» записи) показывает объяснение, а не общую ошибку', async () => {
    mockApi.bookSlot.mockRejectedValue(new Error('CLIENT_NOT_FOUND'));
    await fillAndSelectSlot();
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));

    await screen.findByText(/Не нашёл вас по этому контакту/);
  });

  it('слот, который заняли параллельно (общая ошибка бронирования), показывает сообщение и не роняет форму', async () => {
    mockApi.bookSlot.mockRejectedValue(new Error('SLOT_TAKEN'));
    await fillAndSelectSlot();
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));

    await screen.findByText(/возможно, время только что заняли/);
    // Форма остаётся на экране — можно попробовать снова, не всё потеряно.
    expect(screen.getByLabelText('Имя *')).toBeTruthy();
  });
});
