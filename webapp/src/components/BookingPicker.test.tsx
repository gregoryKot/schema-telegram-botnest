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
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../api';
import { ApiError } from '../apiClient';
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
  // Метрика (lib/metrika) грузится реально, не мокается — тесты ниже читают
  // очередь window.ym.a напрямую.
  sessionStorage.clear();
  delete (window as unknown as { __ym_loaded?: boolean }).__ym_loaded;
  delete (window as unknown as { ym?: unknown }).ym;
  document.querySelectorAll('script[src*="mc.yandex.ru"]').forEach((s) => s.remove());
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

  // Сбой ≠ пусто: без options не собирается цена/тип сессии — раньше
  // .catch(() => setOptions([])) тихо ломал форму (слоты грузились, а форма
  // записи — нет). Теперь отказ getBookingOptions переиспользует ту же
  // ветку loadFailed, что уже была у слотов.
  it('при ошибке загрузки опций сессии тоже рендерит fallback, а не сломанную форму', async () => {
    mockApi.getBookingOptions.mockRejectedValue(new Error('network'));
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

    await screen.findByText('Время зарезервировано');
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

  it('слот, который заняли параллельно (409), показывает «выберите другое» и не роняет форму', async () => {
    mockApi.bookSlot.mockRejectedValue(new ApiError(409, 'Slot already taken'));
    await fillAndSelectSlot();
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));

    await screen.findByText(/возможно, его только что заняли/);
    // Форма остаётся на экране — можно попробовать снова, не всё потеряно.
    expect(screen.getByLabelText('Имя *')).toBeTruthy();
    expect(reportClientError).not.toHaveBeenCalled();
  });

  // Инцидент 2026-09-13: сервер падал на каждой попытке, а текст под формой
  // говорил «время заняли, обновите страницу» — человек нажал семь раз.
  it('сбой сервера (500) — честный текст «заявка не сохранилась» без призыва повторить, ссылка на Telegram и отчёт наверх', async () => {
    mockApi.bookSlot.mockRejectedValue(new ApiError(500, 'Internal server error'));
    await fillAndSelectSlot();
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));

    await screen.findByText(/Заявка не сохранилась/);
    expect(screen.queryByText(/только что заняли/)).toBeNull();
    expect(screen.queryByText(/Обновите страницу/)).toBeNull();
    expect(screen.getByRole('link', { name: '@kotlarewski' }).getAttribute('href')).toBe('https://t.me/kotlarewski');
    expect(reportClientError).toHaveBeenCalledWith({ message: 'booking submit failed: HTTP 500', section: 'booking' });
  });
});

// Продуктовые цели лендинга (Яндекс.Метрика) — trackGoalOnce/trackBookingSubmit
// не мокаются, тесты читают реальную очередь window.ym.a напрямую (единый
// приём с LandingPage.test.tsx).
describe('BookingPicker — цели Метрики', () => {
  function ymQueue(): unknown[][] {
    return (window as unknown as { ym?: { a?: unknown[][] } }).ym?.a ?? [];
  }
  function goalHits(name: string) {
    return ymQueue().filter((c) => c[1] === 'reachGoal' && c[2] === name);
  }

  it('клик по чипу дня шлёт booking_start', async () => {
    await renderLoaded();
    // День — первая кнопка в DOM-порядке: формат-селектор скрыт при одной
    // опции (SLOTS/OPTIONS выше), кнопка сабмита появляется только после
    // выбора слота.
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(goalHits('booking_start').length).toBe(1);
  });

  it('клик по чипу времени шлёт booking_start', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(timeLabel(SLOT_A.startsAt)));
    expect(goalHits('booking_start').length).toBe(1);
  });

  it('успешная запись (дефолтный тип INTRO_15) шлёт booking_submit и booking_intro', async () => {
    mockApi.bookSlot.mockResolvedValue({ id: 1, cancelToken: 'tok1', heldUntil: null, status: 'confirmed', paymentUrl: null, meetingUrl: null });
    await fillAndSelectSlot();
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));
    await act(async () => {});
    expect(goalHits('booking_submit').length).toBe(1);
    expect(goalHits('booking_intro').length).toBe(1);
  });

  it('успешная запись с выбранным SESSION_50 шлёт booking_submit и booking_session', async () => {
    mockApi.getBookingOptions.mockResolvedValue([
      { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0, note: '' },
      { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 3000, note: '' },
    ]);
    mockApi.bookSlot.mockResolvedValue({ id: 2, cancelToken: 'tok2', heldUntil: null, status: 'confirmed', paymentUrl: null, meetingUrl: null });
    await renderLoaded();
    fireEvent.click(screen.getByText(timeLabel(SLOT_A.startsAt)));
    fireEvent.click(screen.getByRole('button', { name: /Сессия/ }));
    fireEvent.change(screen.getByLabelText('Имя *'), { target: { value: 'Аня' } });
    fireEvent.change(screen.getByLabelText('Telegram / телефон *'), { target: { value: '@anya' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /оферты/ }));
    fireEvent.click(screen.getByRole('button', { name: /Записаться на|Оплатить/ }));
    await act(async () => {});
    expect(goalHits('booking_submit').length).toBe(1);
    expect(goalHits('booking_session').length).toBe(1);
  });
});
