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
// от state признак встречи в календаре). День 2 — единственная ячейка прошедшая:
// день целиком в прошлом (dayStatus → «прошло»), день-действия быть не должно
// (past не трогается «Закрыть/Открыть день»). День 3 — «сегодня» (2026-09-20,
// воскресенье инцидента 2026-09-20 — см. calendarModel.ts): одна будущая
// off-ячейка, проверяет заголовок «Сегодня · …» на карточке дня.
// Время каждого дня НАРОЧНО не повторяется (день1: 07–12 UTC, день2: 06 UTC,
// день3: 05 UTC) — иначе aria-label «HH:MM — состояние» совпал бы у чипов
// разных дней и запросы по label стали бы неоднозначными.
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
          { startsAt: '2026-09-21T08:00:00.000Z', durationMin: 50, state: 'busy', busy: true, past: false, busyTitle: 'Супервизия' },
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
      {
        date: '2026-09-20',
        cells: [
          { startsAt: '2026-09-20T05:00:00.000Z', durationMin: 50, state: 'off', busy: false, past: false },
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
    // Прошедшая ячейка второго дня — тоже видна, просто не нажимается, и её
    // подпись — факт «прошло», а не бывшее состояние (правило CLAUDE.md про
    // прошедшие ячейки, инцидент 2026-09-20).
    const pastChip = screen.getByLabelText('09:00 — прошло') as HTMLButtonElement;
    expect(pastChip).toBeTruthy();
    expect(pastChip.disabled).toBe(true);
  });

  it('счётчик дня считает и free, и открытые вручную (extra); прошедшие — нет', async () => {
    render(<CalendarWeek adminKey="k" />);
    await screen.findByLabelText('10:00 — свободно');
    // День 1: free (10:00) + extra (14:00) = 2; busy/booked/blocked/off не в счёт.
    expect(screen.getByText('2 свободно')).toBeTruthy();
    // День 2: единственная ячейка — и та прошедшая, день целиком в прошлом.
    expect(screen.getByText('прошло')).toBeTruthy();
  });

  it('busy показывает, ЧЕМ занято: название события из календаря в чипе и в подсказке', async () => {
    render(<CalendarWeek adminKey="k" />);
    const chip = await screen.findByLabelText('11:00 — встреча в календаре');
    expect(chip.textContent).toBe('11:00 · Супервизия');
    expect(chip.getAttribute('title')).toContain('Супервизия');
  });

  it('busy без названия (событие без SUMMARY) — только время, подсказка общая', async () => {
    const fx = weekFixture();
    delete (fx.days[0].cells[1] as Record<string, unknown>).busyTitle;
    mockApi.adminCalendar.mockResolvedValue(fx);
    render(<CalendarWeek adminKey="k" />);
    const chip = await screen.findByLabelText('11:00 — встреча в календаре');
    expect(chip.textContent).toBe('11:00');
    expect(chip.getAttribute('title')).toBe('Занято по календарю — нажмите, чтобы закрыть насовсем');
  });

  it('открытая ячейка с встречей в календаре (блокировка выключена): точка называет событие', async () => {
    const fx = weekFixture({ calendarBlocking: false });
    Object.assign(fx.days[0].cells[0], { busy: true, busyTitle: 'Зубной' });
    mockApi.adminCalendar.mockResolvedValue(fx);
    render(<CalendarWeek adminKey="k" />);
    const chip = await screen.findByLabelText('10:00 — свободно');
    expect(chip.textContent).toBe('10:00'); // название — в подсказке точки, чип остаётся «свободно»
    const dot = chip.querySelector('span[title]');
    expect(dot?.getAttribute('title')).toContain('«Зубной»');
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
    fireEvent.click(screen.getByLabelText('09:00 — прошло')); // прошедшая ячейка дня 2

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

// Инцидент 2026-09-20: владелец открыл календарь в воскресенье и увидел
// Пн 14 сен – Вс 20 сен (весь диапазон — прошлое, «сегодня» спрятана в
// хвосте). Окно теперь считается от сегодняшнего дня, поэтому «сегодня»
// обязана быть первой картой в ЛЮБОЙ день недели открытия — фиксируем это
// под фейковым временем, а не полагаемся на реальную дату прогона теста.
describe('CalendarWeek — окно от сегодня (не от понедельника недели)', () => {
  beforeEach(() => {
    // shouldAdvanceTime — иначе findBy*/waitFor (ждут через setTimeout) виснут:
    // таймеры застывают вместе с системным временем.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-20T10:00:00.000Z')); // воскресенье
  });
  afterEach(() => vi.useRealTimers());

  it('открыт в воскресенье — первый запрос от сегодня (2026-09-20), а не от понедельника прошлой недели', async () => {
    render(<CalendarWeek adminKey="k" />);
    await waitFor(() => expect(mockApi.adminCalendar).toHaveBeenCalled());

    const [, from, to] = mockApi.adminCalendar.mock.calls[0];
    expect(from).toBe('2026-09-20');
    expect(to).toBe('2026-09-26');
  });

  it('карточка сегодняшнего дня озаглавлена «Сегодня · Вс 20 сен»', async () => {
    render(<CalendarWeek adminKey="k" />);
    expect(await screen.findByText(/^Сегодня · /)).toBeTruthy();
  });
});
