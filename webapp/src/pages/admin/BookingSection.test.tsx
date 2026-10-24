// @vitest-environment jsdom
// Админ-вкладка «Букинг»: 5 независимых блоков (интеграции, цены, подписка,
// расписание, записи), все читают/пишут через api. Каждый блок тестируется
// своим describe — ошибка сохранения обязана быть видна пользователю, а не
// выглядеть как успех (класс бага, который в проекте находили трижды).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { BookingSection } from './BookingSection';

vi.mock('../../api', () => ({
  api: {
    adminStatus: vi.fn(),
    adminGetPrices: vi.fn(),
    adminSetPrice: vi.fn(),
    adminGetSubPrices: vi.fn(),
    adminSetSubPrice: vi.fn(),
    adminListRules: vi.fn(),
    adminCreateRule: vi.fn(),
    adminToggleRule: vi.fn(),
    adminDeleteRule: vi.fn(),
    // ScheduleSection (замена ScheduleManager) рендерит CalendarWeek безусловно —
    // без мока адрес useAsyncData внутри падает на undefined.then(). Детальные
    // тесты самого календаря — в calendar/CalendarWeek.test.tsx.
    adminCalendar: vi.fn(),
    adminSetOverrides: vi.fn(),
    adminListBookings: vi.fn(),
    adminConfirm: vi.fn(),
    adminCancel: vi.fn(),
    cancelBooking: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function statusFixture(overrides: Record<string, unknown> = {}) {
  return {
    zoom: true,
    zoomVars: { accountId: true, clientId: true, clientSecret: true },
    robokassa: true,
    robokassaTest: false,
    appleCalendar: false,
    calendarBusyCount: 0,
    calendarNames: [],
    calendarReadError: null,
    calendarBlocking: false,
    emailFallback: true,
    siteUrl: 'https://schemehappens.ru',
    appUrl: 'https://schemehappens.ru/app',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.adminStatus.mockResolvedValue(statusFixture());
  mockApi.adminGetPrices.mockResolvedValue([
    { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0 },
    { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 3000, prices: { RUB: 3000, ILS: 150, EUR: 50, USD: 55 } },
  ]);
  mockApi.adminGetSubPrices.mockResolvedValue([
    { period: 'month', price: 5000 },
    { period: 'year', price: 50000 },
  ]);
  mockApi.adminListRules.mockResolvedValue([]);
  mockApi.adminCalendar.mockResolvedValue({
    timezone: 'Europe/Moscow', calendarConnected: false, calendarBlocking: false, calendarReadError: null, days: [],
  });
  mockApi.adminListBookings.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

function section(heading: string) {
  return screen.getByText(heading).closest('section')!;
}

describe('BookingSection — статус интеграций', () => {
  it('ничего не рендерит, пока статус не загружен (не 0/NaN-заглушка)', () => {
    mockApi.adminStatus.mockReturnValue(new Promise(() => {})); // висит вечно
    render(<BookingSection adminKey="k" />);
    expect(screen.queryByText('Интеграции')).toBeNull();
  });

  it('Zoom выключен — показывает какие переменные отсутствуют', async () => {
    mockApi.adminStatus.mockResolvedValue(statusFixture({
      zoom: false,
      zoomVars: { accountId: true, clientId: false, clientSecret: false },
    }));
    render(<BookingSection adminKey="k" />);
    await screen.findByText(/ACCOUNT_ID ✓ · CLIENT_ID ✗ · CLIENT_SECRET ✗/);
  });

  it('Apple Calendar включён без блокировки слотов — предупреждение о том, что слоты НЕ блокируются', async () => {
    mockApi.adminStatus.mockResolvedValue(statusFixture({
      appleCalendar: true, calendarBusyCount: 4, calendarBlocking: false, calendarNames: ['Work'],
    }));
    render(<BookingSection adminKey="k" />);
    await screen.findByText(/НЕ блокируются/);
    expect(screen.getByText(/Календари в скане: Work/)).toBeTruthy();
  });

  it('Apple Calendar с блокировкой слотов — подтверждающий текст, не предупреждение', async () => {
    mockApi.adminStatus.mockResolvedValue(statusFixture({
      appleCalendar: true, calendarBusyCount: 4, calendarBlocking: true,
    }));
    render(<BookingSection adminKey="k" />);
    await screen.findByText('Блокировка слотов по календарю включена — занятое время скрывается из записи.');
  });

  // Регресс 2026-09-13: appleCalendar:true читался как «связь есть», хотя
  // чтение занятости падало — слоты шли поверх личных встреч молча.
  it('calendarReadError — красная пометка «чтение не работает», а не «вкл · занято»', async () => {
    mockApi.adminStatus.mockResolvedValue(statusFixture({
      appleCalendar: true, calendarBusyCount: 4, calendarBlocking: true,
      calendarReadError: 'REPORT 403 for https://x/calendars/',
    }));
    render(<BookingSection adminKey="k" />);
    await screen.findByText(/чтение не работает: REPORT 403 for/);
    expect(screen.queryByText(/вкл · занято: 4/)).toBeNull();
  });

  it('без calendarReadError — обычный статус «вкл · занято», без красной пометки', async () => {
    mockApi.adminStatus.mockResolvedValue(statusFixture({
      appleCalendar: true, calendarBusyCount: 4, calendarBlocking: true,
      calendarReadError: null,
    }));
    render(<BookingSection adminKey="k" />);
    await screen.findByText(/вкл · занято: 4/);
    expect(screen.queryByText(/чтение не работает/)).toBeNull();
  });
});

describe('BookingSection — цены сессий', () => {
  it('бесплатное знакомство (INTRO_15) не редактируется в списке цен', async () => {
    render(<BookingSection adminKey="k" />);
    await screen.findAllByText(/Сессия · 50 мин/); // по строке на валюту
    // Строка-подсказка внизу упоминает «Знакомство» словами — редактируемой строки для него нет.
    expect(screen.queryByText(/Знакомство · \d+ мин/)).toBeNull();
  });

  it('изменил цену → сохранил → список перезагружен реальными данными (read-after-write)', async () => {
    mockApi.adminSetPrice.mockResolvedValue({ ok: true });
    mockApi.adminGetPrices.mockResolvedValueOnce([
      { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0 },
      { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 3000, prices: { RUB: 3000, ILS: 150, EUR: 50, USD: 55 } },
    ]).mockResolvedValue([
      { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0 },
      { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 3500, prices: { RUB: 3500, ILS: 150, EUR: 50, USD: 55 } },
    ]);
    render(<BookingSection adminKey="k" />);
    const priceInput = await screen.findByDisplayValue('3000');
    fireEvent.change(priceInput, { target: { value: '3500' } });
    fireEvent.click(within(section('Цены')).getAllByRole('button', { name: 'Сохранить' })[0]);

    await screen.findByText('Цена сохранена ✓');
    expect(mockApi.adminSetPrice).toHaveBeenCalledWith('k', 'SESSION_50', 3500, 'RUB');
  });

  // Аудит 2026-10-11: очищенное поле превращалось в Math.max(0, Math.round(Number('')))
  // = 0 и уходило на сервер — платная сессия за 0 ₽.
  it.each(['', '0', '-5', '1e22'])('поле цены сессии = "%s": «Сохранить» неактивна, adminSetPrice не вызывается', async (typed) => {
    render(<BookingSection adminKey="k" />);
    fireEvent.change(await screen.findByDisplayValue('3000'), { target: { value: typed } });
    const save = within(section('Цены')).getAllByRole('button', { name: 'Сохранить' })[0] as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(mockApi.adminSetPrice).not.toHaveBeenCalled();
    expect(within(section('Цены')).getByText(/Сумма — от 1 до/)).toBeTruthy();
  });

  it('контроль: после исправления поля кнопка снова работает и шлёт введённую сумму', async () => {
    mockApi.adminSetPrice.mockResolvedValue({ ok: true });
    render(<BookingSection adminKey="k" />);
    const field = await screen.findByDisplayValue('3000');
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.change(field, { target: { value: '1' } });
    const save = within(section('Цены')).getAllByRole('button', { name: 'Сохранить' })[0] as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await screen.findByText('Цена сохранена ✓');
    expect(mockApi.adminSetPrice).toHaveBeenCalledWith('k', 'SESSION_50', 1, 'RUB');
  });

  it('таймер сброса «✓» чистится при анмаунте (регресс: setState после снятия компонента ронял CI «window is not defined»)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockApi.adminSetPrice.mockResolvedValue({ ok: true });
      const { unmount } = render(<BookingSection adminKey="k" />);
      const priceInput = await screen.findByDisplayValue('3000');
      fireEvent.change(priceInput, { target: { value: '3500' } });
      fireEvent.click(
        within(section('Цены')).getAllByRole('button', { name: 'Сохранить' })[0],
      );
      await screen.findByText('Цена сохранена ✓');

      unmount();
      // Утёкший таймер = setState по снятому компоненту через 1.5с.
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ошибка сохранения цены сессии — видна, «сохранена» не показывается (тот же класс бага, что и в подписке)', async () => {
    mockApi.adminSetPrice.mockRejectedValue(new Error('Не удалось сохранить цену'));
    render(<BookingSection adminKey="k" />);
    await screen.findAllByText(/Сессия · 50 мин/); // по строке на валюту
    fireEvent.click(within(section('Цены')).getAllByRole('button', { name: 'Сохранить' })[0]);

    await within(section('Цены')).findByText('Не удалось сохранить цену');
    expect(screen.queryByText('Цена сохранена ✓')).toBeNull();
  });
});

describe('BookingSection — цены подписки', () => {
  it('показывает месяц и год реальными числами из API', async () => {
    render(<BookingSection adminKey="k" />);
    await screen.findByDisplayValue('5000');
    expect(screen.getByDisplayValue('50000')).toBeTruthy();
  });

  // Раньше из пустого поля подписка сохранялась за 1 ₽ (Math.max(1, …)).
  it.each(['', '0', '1e22'])('поле цены подписки = "%s": «Сохранить» неактивна, adminSetSubPrice не вызывается', async (typed) => {
    render(<BookingSection adminKey="k" />);
    fireEvent.change(await screen.findByDisplayValue('5000'), { target: { value: typed } });
    const [save] = within(section('Подписка')).getAllByRole('button', { name: 'Сохранить' }) as HTMLButtonElement[];
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(mockApi.adminSetSubPrice).not.toHaveBeenCalled();
  });

  it('контроль: корректная сумма подписки уходит как есть', async () => {
    mockApi.adminSetSubPrice.mockResolvedValue({ ok: true });
    render(<BookingSection adminKey="k" />);
    fireEvent.change(await screen.findByDisplayValue('5000'), { target: { value: '600' } });
    fireEvent.click(within(section('Подписка')).getAllByRole('button', { name: 'Сохранить' })[0]);
    await screen.findByText('Цена сохранена ✓');
    expect(mockApi.adminSetSubPrice).toHaveBeenCalledWith('k', 'month', 600);
  });

  it('ошибка сохранения подписки — видна, «сохранена» не показывается (регресс: раньше save() был без try/catch — необработанный промис, ноль обратной связи)', async () => {
    mockApi.adminSetSubPrice.mockRejectedValue(new Error('Сервер недоступен'));
    render(<BookingSection adminKey="k" />);
    await screen.findByDisplayValue('5000');
    const subSection = section('Подписка');
    fireEvent.click(within(subSection).getAllByRole('button', { name: 'Сохранить' })[0]);

    await within(subSection).findByText('Сервер недоступен');
    expect(screen.queryByText('Цена сохранена ✓')).toBeNull();
  });
});

// Тесты недельных правил переехали в ScheduleSection.test.tsx вместе с
// ScheduleManager (правило №10 CLAUDE.md — BookingSection.tsx упирался в
// потолок размера файла). CalendarWeek внутри ScheduleSection — там же.

describe('BookingSection — записи', () => {
  it('без записей в выбранном фильтре — явный текст «Записей нет», не пусто', async () => {
    render(<BookingSection adminKey="k" />);
    await screen.findByText('Записей нет.');
  });

  // Сбой ≠ пусто: «Записей нет.» на отказе (неверный ключ/сеть) читается как
  // «записей правда нет» — терапевт может решить, что записей никогда не было.
  it('сбой ≠ пусто: отказ adminListBookings показывает ошибку, а не «Записей нет»', async () => {
    mockApi.adminListBookings.mockRejectedValue(new Error('API error: 403'));
    render(<BookingSection adminKey="wrong" />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Не удалось загрузить записи/);
    expect(screen.queryByText('Записей нет.')).toBeNull();
  });

  it('смена фильтра после сбоя сбрасывает ошибку на успешном ответе', async () => {
    mockApi.adminListBookings.mockRejectedValueOnce(new Error('network'));
    render(<BookingSection adminKey="k" />);
    await screen.findByRole('alert');

    mockApi.adminListBookings.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: 'Отменённые' }));

    await screen.findByText('Записей нет.');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('показывает реальную запись клиента с именем и контактом', async () => {
    mockApi.adminListBookings.mockResolvedValue([
      { id: 1, startsAt: '2026-08-10T10:00:00Z', status: 'HELD', clientName: 'Анна', clientContact: '@anna', message: null, cancelToken: 'tok1' },
    ]);
    render(<BookingSection adminKey="k" />);
    await screen.findByText(/Анна · @anna/);
    expect(screen.getByText('Ожидает')).toBeTruthy();
  });

  it('переключение фильтра перезапрашивает список с нужным статусом', async () => {
    render(<BookingSection adminKey="k" />);
    await screen.findByText('Записей нет.');
    fireEvent.click(screen.getByRole('button', { name: 'Отменённые' }));
    expect(mockApi.adminListBookings).toHaveBeenLastCalledWith('k', 'cancelled');
  });

  it('«Подтвердить» у записи HELD вызывает adminConfirm и перезагружает список', async () => {
    mockApi.adminListBookings.mockResolvedValue([
      { id: 5, startsAt: '2026-08-10T10:00:00Z', status: 'HELD', clientName: 'Борис', clientContact: 'boris@x.ru', message: null, cancelToken: 'tok5' },
    ]);
    mockApi.adminConfirm.mockResolvedValue({ ok: true });
    render(<BookingSection adminKey="k" />);
    await screen.findByText(/Борис/);
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
    expect(mockApi.adminConfirm).toHaveBeenCalledWith('k', 5);
    await screen.findByText('Готово ✓');
  });

  // security#22: админка жала публичный cancel/:token с клиентским cutoff 24 ч
  // и без catch — за сутки до встречи ответ 400 уходил в unhandledRejection.
  it('«Отменить» зовёт админский adminCancel по id (не публичный cancelBooking) и обновляет строку', async () => {
    const row = { id: 6, startsAt: '2026-08-10T10:00:00Z', status: 'CONFIRMED', clientName: 'Вера', clientContact: 'vera@x.ru', message: 'Первая встреча', cancelToken: 'tok6' };
    mockApi.adminListBookings.mockResolvedValueOnce([row]).mockResolvedValue([{ ...row, status: 'CANCELLED' }]);
    mockApi.adminCancel.mockResolvedValue({ ok: true });
    render(<BookingSection adminKey="k" />);
    await screen.findByText(/Вера/);
    expect(screen.getByText(/«Первая встреча»/)).toBeTruthy();
    expect(screen.getByText('Подтверждена')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    await screen.findByText('Отменена');
    expect(mockApi.adminCancel).toHaveBeenCalledWith('k', 6);
    expect(mockApi.cancelBooking).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Отменить' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('отказ сервера при «Отменить» виден текстом, строка не меняется, список не перезапрашивается', async () => {
    mockApi.adminListBookings.mockResolvedValue([
      { id: 6, startsAt: '2026-08-10T10:00:00Z', status: 'CONFIRMED', clientName: 'Вера', clientContact: 'vera@x.ru', message: null, cancelToken: 'tok6' },
    ]);
    mockApi.adminCancel.mockRejectedValue(new Error('Cannot cancel completed session'));
    render(<BookingSection adminKey="k" />);
    await screen.findByText(/Вера/);
    const loads = mockApi.adminListBookings.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Не удалось отменить запись: Cannot cancel completed session');
    expect(screen.getByText('Подтверждена')).toBeTruthy();
    expect(mockApi.adminListBookings.mock.calls.length).toBe(loads);
  });

  it('отказ при «Подтвердить» виден текстом, а следующее удачное действие его убирает', async () => {
    const row = { id: 5, startsAt: '2026-08-10T10:00:00Z', status: 'HELD', clientName: 'Борис', clientContact: 'boris@x.ru', message: null, cancelToken: 'tok5' };
    mockApi.adminListBookings.mockResolvedValue([row]);
    mockApi.adminConfirm.mockRejectedValueOnce(new Error('Cannot confirm booking in status CANCELLED'));
    render(<BookingSection adminKey="k" />);
    await screen.findByText(/Борис/);
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Не удалось подтвердить запись: Cannot confirm booking in status CANCELLED');

    mockApi.adminConfirm.mockResolvedValueOnce({ ok: true });
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
    await screen.findByText('Готово ✓');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('завершённая запись не предлагает «Отменить»', async () => {
    mockApi.adminListBookings.mockResolvedValue([
      { id: 7, startsAt: '2026-08-10T10:00:00Z', status: 'COMPLETED', clientName: 'Глеб', clientContact: 'gleb@x.ru', message: null, cancelToken: 'tok7' },
    ]);
    render(<BookingSection adminKey="k" />);
    await screen.findByText(/Глеб/);
    expect(screen.queryByRole('button', { name: 'Отменить' })).toBeNull();
  });
});
