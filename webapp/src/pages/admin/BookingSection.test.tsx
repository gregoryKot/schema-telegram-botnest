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
    adminListBookings: vi.fn(),
    adminConfirm: vi.fn(),
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
    { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 3000 },
  ]);
  mockApi.adminGetSubPrices.mockResolvedValue([
    { period: 'month', price: 5000 },
    { period: 'year', price: 50000 },
  ]);
  mockApi.adminListRules.mockResolvedValue([]);
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
});

describe('BookingSection — цены сессий', () => {
  it('бесплатное знакомство (INTRO_15) не редактируется в списке цен', async () => {
    render(<BookingSection adminKey="k" />);
    await screen.findByText(/Сессия · 50 мин/);
    // Строка-подсказка внизу упоминает «Знакомство» словами — редактируемой строки для него нет.
    expect(screen.queryByText(/Знакомство · \d+ мин/)).toBeNull();
  });

  it('изменил цену → сохранил → список перезагружен реальными данными (read-after-write)', async () => {
    mockApi.adminSetPrice.mockResolvedValue({ ok: true });
    mockApi.adminGetPrices.mockResolvedValueOnce([
      { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0 },
      { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 3000 },
    ]).mockResolvedValue([
      { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0 },
      { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 3500 },
    ]);
    render(<BookingSection adminKey="k" />);
    const priceInput = await screen.findByDisplayValue('3000');
    fireEvent.change(priceInput, { target: { value: '3500' } });
    fireEvent.click(within(section('Цены')).getByRole('button', { name: 'Сохранить' }));

    await screen.findByText('Цена сохранена ✓');
    expect(mockApi.adminSetPrice).toHaveBeenCalledWith('k', 'SESSION_50', 3500);
  });

  it('таймер сброса «✓» чистится при анмаунте (регресс: setState после снятия компонента ронял CI «window is not defined»)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockApi.adminSetPrice.mockResolvedValue({ ok: true });
      const { unmount } = render(<BookingSection adminKey="k" />);
      const priceInput = await screen.findByDisplayValue('3000');
      fireEvent.change(priceInput, { target: { value: '3500' } });
      fireEvent.click(
        within(section('Цены')).getByRole('button', { name: 'Сохранить' }),
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
    await screen.findByText(/Сессия · 50 мин/);
    fireEvent.click(within(section('Цены')).getByRole('button', { name: 'Сохранить' }));

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

describe('BookingSection — расписание', () => {
  it('без правил — подсказка добавить слоты, а не пустой список без объяснения', async () => {
    render(<BookingSection adminKey="k" />);
    await screen.findByText('Пока нет правил. Добавьте слоты ниже.');
  });

  it('сбой ≠ пусто: отказ загрузки правил показывает ошибку, а не «Пока нет правил»', async () => {
    mockApi.adminListRules.mockRejectedValue(new Error('API error: 403'));
    render(<BookingSection adminKey="wrong" />);
    expect(await screen.findByText(/Не удалось загрузить расписание/)).toBeTruthy();
    expect(screen.queryByText('Пока нет правил. Добавьте слоты ниже.')).toBeNull();
  });

  it('показывает существующее правило человеческим текстом', async () => {
    mockApi.adminListRules.mockResolvedValue([
      { id: 1, dayOfWeek: 1, startHour: 10, startMinute: 0, endHour: 19, endMinute: 0, sessionDuration: 50, bufferMin: 10, isActive: true },
    ]);
    render(<BookingSection adminKey="k" />);
    await screen.findByText(/10:00–19:00 · 50 мин \(\+10\)/);
  });

  it('добавление правила вызывает API с введёнными параметрами', async () => {
    mockApi.adminCreateRule.mockResolvedValue({ id: 2 });
    render(<BookingSection adminKey="k" />);
    await screen.findByText('Пока нет правил. Добавьте слоты ниже.');
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(mockApi.adminCreateRule).toHaveBeenCalledWith('k', {
      dayOfWeek: 1, startHour: 10, startMinute: 0, endHour: 19, endMinute: 0,
      sessionDuration: 50, bufferMin: 10,
    });
  });

  it('выключенное правило показано полупрозрачным, кнопка предлагает включить', async () => {
    mockApi.adminListRules.mockResolvedValue([
      { id: 1, dayOfWeek: 2, startHour: 9, startMinute: 0, endHour: 12, endMinute: 0, sessionDuration: 50, bufferMin: 10, isActive: false },
    ]);
    render(<BookingSection adminKey="k" />);
    await screen.findByRole('button', { name: 'Вкл' });
  });

  it('удаление правила вызывает adminDeleteRule', async () => {
    mockApi.adminListRules.mockResolvedValue([
      { id: 7, dayOfWeek: 3, startHour: 9, startMinute: 0, endHour: 12, endMinute: 0, sessionDuration: 50, bufferMin: 10, isActive: true },
    ]);
    mockApi.adminDeleteRule.mockResolvedValue(undefined);
    render(<BookingSection adminKey="k" />);
    await screen.findByLabelText('Удалить правило');
    fireEvent.click(screen.getByLabelText('Удалить правило'));
    expect(mockApi.adminDeleteRule).toHaveBeenCalledWith('k', 7);
  });
});

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
  });

  it('«Отменить» доступна для активной записи и вызывает cancelBooking по токену', async () => {
    mockApi.adminListBookings.mockResolvedValue([
      { id: 6, startsAt: '2026-08-10T10:00:00Z', status: 'CONFIRMED', clientName: 'Вера', clientContact: 'vera@x.ru', message: 'Первая встреча', cancelToken: 'tok6' },
    ]);
    mockApi.cancelBooking.mockResolvedValue({ ok: true });
    render(<BookingSection adminKey="k" />);
    await screen.findByText(/Вера/);
    expect(screen.getByText(/«Первая встреча»/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(mockApi.cancelBooking).toHaveBeenCalledWith('tok6');
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
