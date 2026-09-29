// @vitest-environment jsdom
// Компонентные тесты BookingPicker (webapp) — денежный путь записи к
// терапевту: выбор слота, обязательное согласие с офертой, сабмит,
// платный/бесплатный формат, занятый слот (CLIENT_NOT_FOUND / общая ошибка).
// Образец сетапа: DonatePage.test.tsx, SubscribePage.test.tsx (мок '../api').
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
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

// Пояс посетителя мокается — иначе тесты зависели бы от TZ раннера. Дефолт
// «Москва» сохраняет старое поведение (время слотов совпадает с прежними
// ожиданиями); часовой-поясный блок ниже подменяет его на Бангкок.
vi.mock('./booking/useClientTimeZone', () => ({ useClientTimeZone: vi.fn() }));
import { useClientTimeZone } from './booking/useClientTimeZone';
const mockUseClientTimeZone = useClientTimeZone as unknown as ReturnType<typeof vi.fn>;

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
  mockUseClientTimeZone.mockReturnValue(['Europe/Moscow', vi.fn()]);
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
  tickConfirmNotice();
  fireEvent.click(screen.getByRole('checkbox', { name: /оферты/ }));
}

/** Галочка «Понятно…» есть только у знакомства (INTRO_15) — у платного формата её нет. */
function tickConfirmNotice() {
  const box = screen.queryByRole('checkbox', { name: /Понятно: встреча состоится только после подтверждения/ });
  if (box) fireEvent.click(box);
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

  // Инцидент 2026-09-28 (проверка на проде): кнопка была задизейблена, пока
  // форма не заполнена — клик по отключённой кнопке в браузере ничего не
  // делает, и цели Метрики booking_submit_click/booking_error(validation) не
  // срабатывали НИКОГДА. Кнопка теперь отключена только во время отправки —
  // клик по незаполненной форме должен реально дойти до обработчика.
  it('кнопка сабмита нажимаема даже без заполненных полей (не задизейблена)', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(timeLabel(SLOT_A.startsAt)));
    const btn = screen.getByRole('button', { name: /Записаться на/ });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('после заполнения имени, контакта и согласия кнопка по-прежнему активна', async () => {
    await fillAndSelectSlot();
    const btn = screen.getByRole('button', { name: /Записаться на/ });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('клик по кнопке при незаполненной форме показывает подсказку у первого поля и ставит на него фокус', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(timeLabel(SLOT_A.startsAt)));
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));

    const nameInput = screen.getByLabelText('Имя *');
    await screen.findByText('Как к вам обращаться?');
    expect(nameInput).toBe(document.activeElement);
    expect(nameInput.getAttribute('aria-invalid')).toBe('true');
    expect(nameInput.getAttribute('aria-describedby')).toBe('bp-name-hint');
    expect(mockApi.bookSlot).not.toHaveBeenCalled();
  });

  it('подсказка про контакт появляется, когда заполнено только имя', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(timeLabel(SLOT_A.startsAt)));
    fireEvent.change(screen.getByLabelText('Имя *'), { target: { value: 'Аня' } });
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));

    const contactInput = screen.getByLabelText('Telegram / телефон *');
    await screen.findByText('Оставьте Telegram или телефон — пришлю подтверждение');
    expect(contactInput).toBe(document.activeElement);
  });

  it('подсказка про согласие появляется, когда имя и контакт заполнены', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(timeLabel(SLOT_A.startsAt)));
    fireEvent.change(screen.getByLabelText('Имя *'), { target: { value: 'Аня' } });
    fireEvent.change(screen.getByLabelText('Telegram / телефон *'), { target: { value: '@anya' } });
    tickConfirmNotice();
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));

    await screen.findByText('Нужно согласие на обработку данных');
    expect(mockApi.bookSlot).not.toHaveBeenCalled();
  });

  // Вебвизор (визитка kotlarewski.gr, metrika.ts shouldRecordSession) не должен
  // записывать ввод в полях с личными данными клиента — метка ym-disable-keys.
  it('поля имени/контакта/сообщения несут ym-disable-keys', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(timeLabel(SLOT_A.startsAt)));
    expect(screen.getByLabelText('Имя *').className).toContain('ym-disable-keys');
    expect(screen.getByLabelText('Telegram / телефон *').className).toContain('ym-disable-keys');
    expect(screen.getByPlaceholderText('Пара слов о том, с чем хотите разобраться').className).toContain('ym-disable-keys');
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
        clientTimeZone: 'Europe/Moscow',
      }),
    );
  });

  it('успешная бесплатная запись (INTRO_15) без paymentUrl показывает «Заявка принята»', async () => {
    mockApi.bookSlot.mockResolvedValue({ id: 1, cancelToken: 'tok1', heldUntil: null, status: 'confirmed', paymentUrl: null, meetingUrl: null });
    await fillAndSelectSlot();
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));

    await screen.findByText('Заявка принята');
    expect(screen.queryByText('Время забронировано')).toBeNull();
  });

  // PR C: знакомство подтверждается лично, поэтому DoneScreen для INTRO_15
  // заголовок и текст-предупреждение отличаются от оплаченной сессии.
  it('«Заявка принята» (INTRO_15) — под временем текст про личное подтверждение со ссылкой на @kotlarewski', async () => {
    mockApi.bookSlot.mockResolvedValue({ id: 1, cancelToken: 'tok1', heldUntil: null, status: 'confirmed', paymentUrl: null, meetingUrl: null });
    await fillAndSelectSlot();
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));

    await screen.findByText('Заявка принята');
    const note = screen.getByText(/Напишу вам, чтобы подтвердить встречу/);
    expect(note).toBeTruthy();
    const link = within(note).getByRole('link', { name: '@kotlarewski' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://t.me/kotlarewski');
  });

  it('SESSION_50 — «Время забронировано», без текста про личное подтверждение', async () => {
    mockApi.getBookingOptions.mockResolvedValue([
      { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0, note: '' },
      { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 0, note: '' },
    ]);
    mockApi.bookSlot.mockResolvedValue({ id: 3, cancelToken: 'tok3', heldUntil: null, status: 'confirmed', paymentUrl: null, meetingUrl: null });
    await renderLoaded();
    fireEvent.click(screen.getByText(timeLabel(SLOT_A.startsAt)));
    fireEvent.click(screen.getByRole('button', { name: /Сессия/ }));
    fireEvent.change(screen.getByLabelText('Имя *'), { target: { value: 'Аня' } });
    fireEvent.change(screen.getByLabelText('Telegram / телефон *'), { target: { value: '@anya' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /оферты/ }));
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));

    await screen.findByText('Время забронировано');
    expect(screen.queryByText(/Напишу вам, чтобы подтвердить встречу/)).toBeNull();
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

const TWO_OPTIONS = [
  { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0, note: '' },
  { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 0, note: '' },
];
const RETURNING_BOX = /повторная встреча/;

describe('BookingPicker — галочка «повторная встреча»', () => {
  const OK = { id: 1, cancelToken: 't', heldUntil: null, status: 'confirmed', paymentUrl: null, meetingUrl: null };

  it('у знакомства (INTRO_15) галочки и пояснения про комнату нет, returning=false', async () => {
    mockApi.bookSlot.mockResolvedValue(OK);
    await fillAndSelectSlot();
    expect(screen.queryByRole('checkbox', { name: RETURNING_BOX })).toBeNull();
    expect(screen.queryByText(/персональную комнату/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));
    await screen.findByText('Заявка принята');
    expect(mockApi.bookSlot).toHaveBeenCalledWith(expect.objectContaining({ type: 'INTRO_15', returning: false }));
  });

  it('у сессии (SESSION_50) галочка есть, отмеченная уходит returning=true', async () => {
    mockApi.getBookingOptions.mockResolvedValue(TWO_OPTIONS);
    mockApi.bookSlot.mockResolvedValue(OK);
    await fillAndSelectSlot();
    fireEvent.click(screen.getByRole('button', { name: /Сессия/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: RETURNING_BOX }));
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));
    await screen.findByText('Время забронировано');
    expect(mockApi.bookSlot).toHaveBeenCalledWith(expect.objectContaining({ type: 'SESSION_50', returning: true }));
  });

  it('SESSION_50 (отмечено) → INTRO_15: галочка пропадает, уходит returning=false', async () => {
    mockApi.getBookingOptions.mockResolvedValue(TWO_OPTIONS);
    mockApi.bookSlot.mockResolvedValue(OK);
    await fillAndSelectSlot();
    fireEvent.click(screen.getByRole('button', { name: /Сессия/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: RETURNING_BOX }));
    fireEvent.click(screen.getByRole('button', { name: /Знакомство/ }));
    expect(screen.queryByRole('checkbox', { name: RETURNING_BOX })).toBeNull(); // плашка «Понятно» уже отмечена до переключения
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));
    await screen.findByText('Заявка принята');
    expect(mockApi.bookSlot).toHaveBeenCalledWith(expect.objectContaining({ type: 'INTRO_15', returning: false }));
  });
});

describe('BookingPicker — занятый слот и ошибки API', () => {
  it('ошибка CLIENT_NOT_FOUND (не найден контакт «повторной» записи) показывает объяснение, а не общую ошибку', async () => {
    mockApi.bookSlot.mockRejectedValue(new Error('CLIENT_NOT_FOUND'));
    mockApi.getBookingOptions.mockResolvedValue(TWO_OPTIONS);
    await fillAndSelectSlot();
    fireEvent.click(screen.getByRole('button', { name: /Сессия/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /повторная встреча/ }));
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

    const errorNote = await screen.findByText(/Заявка не сохранилась/);
    expect(screen.queryByText(/только что заняли/)).toBeNull();
    expect(screen.queryByText(/Обновите страницу/)).toBeNull();
    // Форма для INTRO_15 несёт свою ссылку на @kotlarewski (PR C) — берём
    // ссылку именно из текста ошибки, не первую попавшуюся на странице.
    expect(within(errorNote).getByRole('link', { name: '@kotlarewski' }).getAttribute('href')).toBe('https://t.me/kotlarewski');
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

  it('выбор формата встречи шлёт booking_format с {format: "session"}', async () => {
    mockApi.getBookingOptions.mockResolvedValue([
      { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0, note: '' },
      { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 3000, note: '' },
    ]);
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: /Сессия/ }));
    const call = ymQueue().find((c) => c[1] === 'reachGoal' && c[2] === 'booking_format');
    expect(call?.[3]).toEqual({ format: 'session' });
  });

  it('первый фокус в поле «Имя» шлёт booking_form_focus один раз', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(timeLabel(SLOT_A.startsAt)));
    fireEvent.focus(screen.getByLabelText('Имя *'));
    fireEvent.focus(screen.getByLabelText('Telegram / телефон *'));
    expect(goalHits('booking_form_focus').length).toBe(1);
  });

  it('клик по кнопке отправки шлёт booking_submit_click', async () => {
    mockApi.bookSlot.mockResolvedValue({ id: 1, cancelToken: 'tok1', heldUntil: null, status: 'confirmed', paymentUrl: null, meetingUrl: null });
    await fillAndSelectSlot();
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));
    await act(async () => {});
    expect(goalHits('booking_submit_click').length).toBe(1);
  });

  it('незаполненная форма (submit до валидации) — booking_submit_click ДО booking_error(validation)', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(timeLabel(SLOT_A.startsAt)));
    // Кнопка задизейблена без имени/контакта/согласия — сабмитим форму напрямую,
    // как сделал бы Enter в поле: обработчик обязан отработать «до валидации».
    const form = screen.getByRole('button', { name: /Записаться на/ }).closest('form')!;
    fireEvent.submit(form);
    const clickIdx = ymQueue().findIndex((c) => c[1] === 'reachGoal' && c[2] === 'booking_submit_click');
    const errorIdx = ymQueue().findIndex((c) => c[1] === 'reachGoal' && c[2] === 'booking_error');
    expect(clickIdx).toBeGreaterThanOrEqual(0);
    expect(errorIdx).toBeGreaterThan(clickIdx);
    const errorCall = ymQueue().find((c) => c[1] === 'reachGoal' && c[2] === 'booking_error');
    expect(errorCall?.[3]).toEqual({ reason: 'validation', field: 'name' });
    expect(mockApi.bookSlot).not.toHaveBeenCalled();
  });

  it('booking_error может уходить многократно (не trackGoalOnce)', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(timeLabel(SLOT_A.startsAt)));
    const form = screen.getByRole('button', { name: /Записаться на/ }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(goalHits('booking_error').length).toBe(2);
  });

  it('сбой сервера (500) шлёт booking_error с {reason: "server"}, без поля', async () => {
    mockApi.bookSlot.mockRejectedValue(new ApiError(500, 'Internal server error'));
    await fillAndSelectSlot();
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));
    await screen.findByText(/Заявка не сохранилась/);
    const call = ymQueue().find((c) => c[1] === 'reachGoal' && c[2] === 'booking_error');
    expect(call?.[3]).toEqual({ reason: 'server' });
  });
});

// PR C: знакомство (INTRO_15) — бесплатное, подтверждается лично автором, а
// не автоматически; форма предупреждает об этом заранее, ещё до отправки.
describe('BookingPicker — предупреждение о личном подтверждении (только INTRO_15)', () => {
  const TEXT = /каждую запись подтверждаю лично/;

  it('видно, пока выбран формат «Знакомство» (дефолт)', async () => {
    await fillAndSelectSlot();
    expect(screen.getByText(TEXT)).toBeTruthy();
    const link = screen.getByRole('link', { name: '@kotlarewski' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://t.me/kotlarewski');
  });

  it('не видно для оплаченной сессии SESSION_50', async () => {
    mockApi.getBookingOptions.mockResolvedValue([
      { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0, note: '' },
      { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 3000, note: '' },
    ]);
    await renderLoaded();
    fireEvent.click(screen.getByText(timeLabel(SLOT_A.startsAt)));
    fireEvent.click(screen.getByRole('button', { name: /Сессия/ }));
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it('переключение обратно на «Знакомство» возвращает текст', async () => {
    mockApi.getBookingOptions.mockResolvedValue([
      { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0, note: '' },
      { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 3000, note: '' },
    ]);
    await renderLoaded();
    fireEvent.click(screen.getByText(timeLabel(SLOT_A.startsAt)));
    fireEvent.click(screen.getByRole('button', { name: /Сессия/ }));
    expect(screen.queryByText(TEXT)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Знакомство/ }));
    expect(screen.getByText(TEXT)).toBeTruthy();
  });
});

describe('BookingPicker — часовой пояс посетителя', () => {
  it('слот показывается в поясе посетителя, не в МСК', async () => {
    mockUseClientTimeZone.mockReturnValue(['Asia/Bangkok', vi.fn()]);
    render(<BookingPicker />);
    // SLOT_A = 09:00 UTC = 12:00 МСК = 16:00 в Бангкоке.
    await screen.findByText('16:00');
    expect(screen.queryByText(timeLabel(SLOT_A.startsAt))).toBeNull();
  });

  it('отправка брони несёт фактически используемый пояс', async () => {
    mockUseClientTimeZone.mockReturnValue(['Asia/Bangkok', vi.fn()]);
    mockApi.bookSlot.mockResolvedValue({ id: 1, cancelToken: 'tok1', heldUntil: null, status: 'confirmed', paymentUrl: null, meetingUrl: null });
    render(<BookingPicker />);
    fireEvent.click(await screen.findByText('16:00'));
    fireEvent.change(screen.getByLabelText('Имя *'), { target: { value: 'Аня' } });
    fireEvent.change(screen.getByLabelText('Telegram / телефон *'), { target: { value: '@anya' } });
    tickConfirmNotice();
    fireEvent.click(screen.getByRole('checkbox', { name: /оферты/ }));
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));
    await act(async () => {});
    expect(mockApi.bookSlot).toHaveBeenCalledWith(
      expect.objectContaining({ clientTimeZone: 'Asia/Bangkok' }),
    );
  });
});

// Проверка на проде нашла: у платной сессии на кнопке не было времени слота
// вообще (только «Оплатить N ₽ и записаться →») — человек не видел, на какое
// время записывается, пока не открывал оплату. Строка с датой/временем
// вынесена мелким текстом над кнопкой (см. PR-описание почему не инлайн).
describe('BookingPicker — время слота у платной сессии', () => {
  it('над кнопкой оплаты показано время слота в поясе посетителя', async () => {
    mockApi.getBookingOptions.mockResolvedValue([
      { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0, note: '' },
      { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 3000, note: '' },
    ]);
    await renderLoaded();
    fireEvent.click(screen.getByText(timeLabel(SLOT_A.startsAt)));
    fireEvent.click(screen.getByRole('button', { name: /Сессия/ }));

    const btn = screen.getByRole('button', { name: /Оплатить/ });
    expect(btn.textContent).toContain(`Оплатить ${(3000).toLocaleString('ru-RU')} ₽ и записаться →`);
    // Дата/время — отдельной строкой перед кнопкой (маркер «МСК» встречается
    // только там: в тексте кнопки его больше нет, а чип времени показывает
    // голое «12:00» без суффикса).
    const mskMentions = screen.getAllByText(/МСК/);
    expect(mskMentions.length).toBe(1);
    expect(mskMentions[0].tagName.toLowerCase()).toBe('p');
    expect(mskMentions[0].textContent).toContain(timeLabel(SLOT_A.startsAt));
  });
});

// Инцидент 2026-09-29: сервер отдал каждый слот дважды — в форме «13:00, 13:00».
describe('BookingPicker — дубли startsAt в ответе сервера', () => {
  beforeEach(() => {
    resetLocation();
    mockUseClientTimeZone.mockReturnValue(['Europe/Moscow', vi.fn()]);
    mockApi.getBookingOptions.mockResolvedValue(OPTIONS);
  });
  afterEach(() => cleanup());

  it('одинаковый слот показывается один раз', async () => {
    mockApi.getSlots.mockResolvedValue([SLOT_A, SLOT_A, SLOT_B, SLOT_B]);
    render(<BookingPicker fallback={<div />} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getAllByText(timeLabel(SLOT_A.startsAt))).toHaveLength(1);
    expect(screen.getAllByText(timeLabel(SLOT_B.startsAt))).toHaveLength(1);
  });
});

// Знакомство подтверждается лично, поэтому перед отправкой нужна галочка
// «Понятно: встреча состоится только после подтверждения» (только INTRO_15).
describe('BookingPicker — галочка «понятно про подтверждение» (INTRO_15)', () => {
  const NOTICE = /Понятно: встреча состоится только после подтверждения/;
  const TWO_OPTIONS = [
    { type: 'INTRO_15' as const, label: 'Знакомство', durationMin: 15, price: 0, note: '' },
    { type: 'SESSION_50' as const, label: 'Сессия', durationMin: 50, price: 3000, note: '' },
  ];

  async function fillEverythingButNotice() {
    await renderLoaded();
    fireEvent.click(screen.getByText(timeLabel(SLOT_A.startsAt)));
    fireEvent.change(screen.getByLabelText('Имя *'), { target: { value: 'Аня' } });
    fireEvent.change(screen.getByLabelText('Telegram / телефон *'), { target: { value: '@anya' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /оферты/ }));
  }

  it('без галочки: booking_error validation/confirmNotice, фокус на галочку, запроса нет', async () => {
    mockApi.getBookingOptions.mockResolvedValue(TWO_OPTIONS);
    await fillEverythingButNotice();
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));

    const box = screen.getByRole('checkbox', { name: NOTICE });
    await screen.findByText('Отметьте, что прочитали про подтверждение');
    expect(box).toBe(document.activeElement);
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(box.getAttribute('aria-describedby')).toBe('bp-confirm-hint');
    expect(mockApi.bookSlot).not.toHaveBeenCalled();
    const calls = JSON.stringify((window as unknown as { ym?: { a?: unknown[] } }).ym?.a ?? []);
    expect(calls).toContain('booking_error');
    expect(calls).toContain('confirmNotice');
  });

  it('с галочкой запрос уходит', async () => {
    mockApi.getBookingOptions.mockResolvedValue(TWO_OPTIONS);
    mockApi.bookSlot.mockResolvedValue({ id: 1, cancelToken: 't', heldUntil: null, status: 'confirmed', paymentUrl: null, meetingUrl: null });
    await fillEverythingButNotice();
    fireEvent.click(screen.getByRole('checkbox', { name: NOTICE }));
    fireEvent.click(screen.getByRole('button', { name: /Записаться на/ }));
    await act(async () => {});
    expect(mockApi.bookSlot).toHaveBeenCalledWith(expect.objectContaining({ type: 'INTRO_15' }));
  });

  it('у SESSION_50 галочки нет и она не требуется', async () => {
    mockApi.getBookingOptions.mockResolvedValue(TWO_OPTIONS);
    mockApi.bookSlot.mockResolvedValue({ id: 1, cancelToken: 't', heldUntil: null, status: 'held', paymentUrl: null, meetingUrl: null });
    await fillEverythingButNotice();
    fireEvent.click(screen.getByRole('button', { name: /Сессия/ }));
    expect(screen.queryByRole('checkbox', { name: NOTICE })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Оплатить/ }));
    await act(async () => {});
    expect(mockApi.bookSlot).toHaveBeenCalledWith(expect.objectContaining({ type: 'SESSION_50' }));
  });

  it('отметка сохраняется при возврате на «Знакомство» (ответ на тот же текст)', async () => {
    mockApi.getBookingOptions.mockResolvedValue(TWO_OPTIONS);
    await fillEverythingButNotice();
    fireEvent.click(screen.getByRole('checkbox', { name: NOTICE }));
    fireEvent.click(screen.getByRole('button', { name: /Сессия/ }));
    fireEvent.click(screen.getByRole('button', { name: /Знакомство/ }));
    expect((screen.getByRole('checkbox', { name: NOTICE }) as HTMLInputElement).checked).toBe(true);
  });
});
