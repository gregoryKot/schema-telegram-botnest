// @vitest-environment jsdom
// Недельный календарь слотов внутри «Расписания». Мокаем api по образцу
// BookingSection.test.tsx: ошибка сохранения/загрузки обязана быть видна,
// а не тонуть молча (тот же класс бага, что там уже ловили трижды).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { CalendarWeek } from './CalendarWeek';

vi.mock('../../../api', () => ({
  api: {
    adminCalendar: vi.fn(),
    adminSetOverrides: vi.fn(),
  },
}));
import { api } from '../../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

// День 1 — по одной ячейке каждого состояния (+ busy-флаг на free — независимый
// от state признак встречи в календаре). День 2 — единственная ячейка прошедшая,
// день-действия быть не должно (past не трогается «Закрыть/Открыть день»).
// Время дня 2 (09:00 МСК) НАРОЧНО отличается от всех времён дня 1 — иначе
// aria-label «10:00 — свободно» совпал бы у обоих чипов и запросы по label
// стали бы неоднозначными.
function weekFixture(overrides: Record<string, unknown> = {}) {
  return {
    timezone: 'Europe/Moscow',
    calendarConnected: true,
    calendarBlocking: true,
    calendarReadError: null,
    days: [
      {
        date: '2026-09-21',
        cells: [
          { startsAt: '2026-09-21T07:00:00.000Z', durationMin: 50, state: 'free', busy: false, past: false },
          { startsAt: '2026-09-21T08:00:00.000Z', durationMin: 50, state: 'busy', busy: true, past: false },
          { startsAt: '2026-09-21T09:00:00.000Z', durationMin: 50, state: 'booked', busy: false, past: false, booking: { id: 1, clientName: 'Аня', status: 'CONFIRMED' } },
          { startsAt: '2026-09-21T10:00:00.000Z', durationMin: 50, state: 'blocked', busy: false, past: false },
          { startsAt: '2026-09-21T11:00:00.000Z', durationMin: 50, state: 'extra', busy: false, past: false },
          { startsAt: '2026-09-21T12:00:00.000Z', durationMin: 50, state: 'off', busy: false, past: false },
        ],
      },
      {
        date: '2026-09-22',
        cells: [
          { startsAt: '2026-09-22T06:00:00.000Z', durationMin: 50, state: 'free', busy: false, past: true },
        ],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.adminCalendar.mockResolvedValue(weekFixture());
  mockApi.adminSetOverrides.mockResolvedValue({ ok: true });
});

afterEach(() => cleanup());

describe('CalendarWeek — рендер состояний', () => {
  it('каждое состояние ячейки видно со своим aria-label', async () => {
    render(<CalendarWeek adminKey="k" />);
    await screen.findByLabelText('10:00 — свободно');
    expect(screen.getByLabelText('11:00 — встреча в календаре')).toBeTruthy();
    expect(screen.getByLabelText('12:00 — бронь')).toBeTruthy();
    expect(screen.getByLabelText('13:00 — закрыто вручную')).toBeTruthy();
    expect(screen.getByLabelText('14:00 — открыто вручную')).toBeTruthy();
    expect(screen.getByLabelText('15:00 — вне расписания')).toBeTruthy();
    // Прошедшая ячейка второго дня — тоже видна, просто не нажимается.
    const pastChip = screen.getByLabelText('09:00 — свободно') as HTMLButtonElement;
    expect(pastChip).toBeTruthy();
    expect(pastChip.disabled).toBe(true);
  });

  it('счётчик дня считает и free, и открытые вручную (extra); прошедшие — нет', async () => {
    render(<CalendarWeek adminKey="k" />);
    await screen.findByLabelText('10:00 — свободно');
    // День 1: free (10:00) + extra (14:00) = 2; busy/booked/blocked/off не в счёт.
    expect(screen.getByText('2 свободно')).toBeTruthy();
    // День 2: единственная free-ячейка прошедшая — для клиента её нет.
    expect(screen.getByText('свободных нет')).toBeTruthy();
  });

  it('booked показывает время и имя клиента в самом чипе', async () => {
    render(<CalendarWeek adminKey="k" />);
    const chip = await screen.findByLabelText('12:00 — бронь');
    expect(chip.textContent).toBe('12:00 · Аня');
  });
});

describe('CalendarWeek — нажатия переключают ручной слой', () => {
  it('free → set BLOCK, после сохранения календарь перезапрошен', async () => {
    render(<CalendarWeek adminKey="k" />);
    fireEvent.click(await screen.findByLabelText('10:00 — свободно'));

    await waitFor(() => expect(mockApi.adminSetOverrides).toHaveBeenCalledWith('k', {
      set: [{ startsAt: '2026-09-21T07:00:00.000Z', durationMin: 50, kind: 'BLOCK' }],
    }));
    await waitFor(() => expect(mockApi.adminCalendar).toHaveBeenCalledTimes(2)); // начальная загрузка + reload после мутации
  });

  it('blocked → clear', async () => {
    render(<CalendarWeek adminKey="k" />);
    fireEvent.click(await screen.findByLabelText('13:00 — закрыто вручную'));

    await waitFor(() => expect(mockApi.adminSetOverrides).toHaveBeenCalledWith('k', {
      clear: ['2026-09-21T10:00:00.000Z'],
    }));
  });

  it('off → set OPEN', async () => {
    render(<CalendarWeek adminKey="k" />);
    fireEvent.click(await screen.findByLabelText('15:00 — вне расписания'));

    await waitFor(() => expect(mockApi.adminSetOverrides).toHaveBeenCalledWith('k', {
      set: [{ startsAt: '2026-09-21T12:00:00.000Z', durationMin: 50, kind: 'OPEN' }],
    }));
  });

  it('booked и прошедшая ячейка не вызывают api', async () => {
    render(<CalendarWeek adminKey="k" />);
    fireEvent.click(await screen.findByLabelText('12:00 — бронь'));
    fireEvent.click(screen.getByLabelText('09:00 — свободно')); // прошедшая ячейка дня 2

    expect(mockApi.adminSetOverrides).not.toHaveBeenCalled();
  });

  it('«Закрыть день» — один вызов с полным patch (BLOCK для free/busy, clear для extra)', async () => {
    render(<CalendarWeek adminKey="k" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Закрыть день' }));

    await waitFor(() => expect(mockApi.adminSetOverrides).toHaveBeenCalledTimes(1));
    expect(mockApi.adminSetOverrides).toHaveBeenCalledWith('k', {
      set: expect.arrayContaining([
        { startsAt: '2026-09-21T07:00:00.000Z', durationMin: 50, kind: 'BLOCK' },
        { startsAt: '2026-09-21T08:00:00.000Z', durationMin: 50, kind: 'BLOCK' },
      ]),
      clear: ['2026-09-21T11:00:00.000Z'],
    });
  });

  it('день из одних booked/past (второй день фикстуры) не предлагает день-действие', async () => {
    render(<CalendarWeek adminKey="k" />);
    await screen.findByLabelText('10:00 — свободно');
    expect(screen.getAllByRole('button', { name: 'Закрыть день' })).toHaveLength(1); // только у первого дня
    expect(screen.queryByRole('button', { name: 'Открыть день' })).toBeNull();
  });
});

describe('CalendarWeek — обратная связь и предупреждения', () => {
  it('ошибка мутации видна, а не тонет молча', async () => {
    mockApi.adminSetOverrides.mockRejectedValue(new Error('Сервер недоступен'));
    render(<CalendarWeek adminKey="k" />);
    fireEvent.click(await screen.findByLabelText('10:00 — свободно'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Не удалось сохранить: Сервер недоступен');
  });

  it('calendarReadError — видимое предупреждение с текстом ошибки', async () => {
    mockApi.adminCalendar.mockResolvedValue(weekFixture({ calendarReadError: 'REPORT 403' }));
    render(<CalendarWeek adminKey="k" />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Занятость из календаря не прочиталась: REPORT 403/);
  });

  it('подсказка про CALENDAR_BLOCK_SLOTS видна только при connected && !blocking', async () => {
    mockApi.adminCalendar.mockResolvedValue(weekFixture({ calendarBlocking: false }));
    render(<CalendarWeek adminKey="k" />);
    await screen.findByText(/CALENDAR_BLOCK_SLOTS/);
  });

  it('подсказка про CALENDAR_BLOCK_SLOTS скрыта, когда блокировка уже включена', async () => {
    render(<CalendarWeek adminKey="k" />); // фикстура по умолчанию: calendarBlocking: true
    await screen.findByLabelText('10:00 — свободно');
    expect(screen.queryByText(/CALENDAR_BLOCK_SLOTS/)).toBeNull();
  });

  it('подсказка про CALENDAR_BLOCK_SLOTS скрыта, когда календарь не подключён', async () => {
    mockApi.adminCalendar.mockResolvedValue(weekFixture({ calendarConnected: false, calendarBlocking: false }));
    render(<CalendarWeek adminKey="k" />);
    await screen.findByLabelText('10:00 — свободно');
    expect(screen.queryByText(/CALENDAR_BLOCK_SLOTS/)).toBeNull();
  });

  it('сбой загрузки — сообщение, а не пустая неделя', async () => {
    mockApi.adminCalendar.mockRejectedValue(new Error('API error: 403'));
    render(<CalendarWeek adminKey="k" />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Не удалось загрузить календарь/);
    expect(screen.queryByLabelText(/свободно/)).toBeNull();
  });

  it('загрузка — скелетон по форме (7 плашек-дней), ни одного чипа', async () => {
    mockApi.adminCalendar.mockReturnValue(new Promise(() => {})); // висит вечно
    const { container } = render(<CalendarWeek adminKey="k" />);
    expect(container.querySelectorAll('.skel').length).toBeGreaterThan(0);
    // Только 3 навигационные кнопки (‹ / Сегодня / ›) — ни одного чипа/день-кнопки.
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});

describe('CalendarWeek — навигация по неделям', () => {
  it('«Следующая неделя» перезапрашивает календарь со сдвигом ровно на 7 дней', async () => {
    render(<CalendarWeek adminKey="k" />);
    await screen.findByLabelText('10:00 — свободно');
    const [, firstFrom, firstTo] = mockApi.adminCalendar.mock.calls[0];

    fireEvent.click(screen.getByRole('button', { name: 'Следующая неделя' }));
    await waitFor(() => expect(mockApi.adminCalendar).toHaveBeenCalledTimes(2));
    const [, nextFrom, nextTo] = mockApi.adminCalendar.mock.calls[1];

    const DAY_MS = 24 * 60 * 60 * 1000;
    expect(Date.parse(`${nextFrom}T00:00:00Z`) - Date.parse(`${firstFrom}T00:00:00Z`)).toBe(7 * DAY_MS);
    expect(Date.parse(`${nextTo}T00:00:00Z`) - Date.parse(`${firstTo}T00:00:00Z`)).toBe(7 * DAY_MS);
  });
});
