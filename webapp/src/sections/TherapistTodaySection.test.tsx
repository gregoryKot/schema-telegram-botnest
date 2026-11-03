// @vitest-environment jsdom
// Компонентные тесты TherapistTodaySection (кабинет терапевта, главный
// экран). Покрывает: пустое состояние (чистый аккаунт — CLAUDE.md
// «никаких хардкод-заглушек»), реальные данные из api.getTherapyClients,
// сортировку сессий сегодня, «требуют внимания» (3+ дня без активности),
// приветствие по времени суток, клики по клиентам.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { TherapistTodaySection } from './TherapistTodaySection';
import { localDateStr } from '../../../shared/src/utils/format';
import { forEachTimeZoneAsync, withTimeZone } from '../../../shared/src/utils/timeZone.test-helpers';

vi.mock('../api', () => ({
  api: {
    getTherapyClients: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as { getTherapyClients: ReturnType<typeof vi.fn> };

/** Последняя оценка N дней назад по календарю клиента — так её отдаёт
 *  сервер (daysSinceActive); дата для показа — любая прошедшая. */
const activeDaysAgo = (n: number) => ({ lastActiveDate: '2026-08-01', daysSinceActive: n });

function client(overrides: Partial<{
  telegramId: number; name: string | null; clientAlias: string | null;
  streak: number; lastActiveDate: string | null; daysSinceActive: number | null;
  todayIndex: number | null; nextSession: string | null; meetingDays: number[];
}> = {}) {
  return {
    telegramId: 1, name: 'Иван', clientAlias: null, streak: 0,
    lastActiveDate: null, todayIndex: null, recentIndexHistory: [],
    relationCreatedAt: '2026-01-01T00:00:00Z', therapyStartDate: null,
    nextSession: null, meetingDays: [], schemaIds: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('TherapistTodaySection — пустой аккаунт (без хардкод-заглушек)', () => {
  it('на пустом списке клиентов показывает реальные пустые состояния, а не выдуманные цифры', async () => {
    mockApi.getTherapyClients.mockResolvedValue([]);
    render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Сессий не запланировано')).toBeTruthy());
    expect(screen.getByText('Нет клиентов')).toBeTruthy();
    // Пустые состояния — общий ds-empty (#906), не курсив в пунктирной рамке.
    expect(screen.getByText('Сессий не запланировано').classList.contains('ds-empty')).toBe(true);
    expect(screen.getByText('Нет клиентов').classList.contains('ds-empty')).toBe(true);
    // Блок сводной статистики скрыт вовсе на пустом списке — не «0/0».
    expect(screen.queryByText('Активны сегодня')).toBeNull();
  });

  it('ошибка api.getTherapyClients не роняет экран — остаётся пустое состояние', async () => {
    mockApi.getTherapyClients.mockRejectedValue(new Error('network down'));
    render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Нет клиентов')).toBeTruthy());
  });
});

describe('TherapistTodaySection — реальные данные клиентов', () => {
  it('показывает клиентов из api, точку "заполнил" для тех, у кого есть todayIndex сегодня', async () => {
    mockApi.getTherapyClients.mockResolvedValue([
      client({ telegramId: 1, name: 'Иван', todayIndex: 7.2 }),
      // Давность — по календарю клиента от сервера (daysSinceActive), а не
      // пересчёт от «сейчас»: так тест не стареет и не зависит от зоны.
      client({ telegramId: 2, name: 'Мария', todayIndex: null, ...activeDaysAgo(1) }),
    ]);
    render(<TherapistTodaySection displayName="Терапевт" onOpenClient={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByText('Иван').length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText('Мария')).toBeTruthy();
    expect(screen.getByText('7.2')).toBeTruthy();
    expect(screen.getByText('активность сегодня')).toBeTruthy();
    expect(screen.getByText('активность вчера')).toBeTruthy();
    // Счётчики — ds-card--row с подписью ds-label (#906), без своего радиуса;
    // список активности — та же карточка-строка, радиус не инлайном.
    const counter = screen.getByText('Активны сегодня');
    expect(counter.classList.contains('ds-label')).toBe(true);
    expect(counter.closest('.ds-card')!.classList.contains('ds-card--row')).toBe(true);
    const list = screen.getByText('Активность клиентов').parentElement!.querySelector('.ds-card--flush')!;
    expect(list.classList.contains('ds-card--row')).toBe(true);
    expect(list.getAttribute('style')).toBeNull();
  });

  it('клиентов без clientAlias/name показывает как "#telegramId" — не пустую строку', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 555, name: null, clientAlias: null })]);
    render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByText('#555').length).toBeGreaterThanOrEqual(1));
  });

  // QA 2026-11: имя в сетке строки — в колонке .tt-who (min-width: 0,
  // therapist-today.css), иначе одна строка с многоточием распирает трек.
  it('имя в строках «Сессии» и «Активность» лежит в колонке .tt-who', async () => {
    const today = localDateStr(new Date());
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name: 'Вера', nextSession: `${today}T14:30` })]);
    render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByText('Вера').length).toBeGreaterThanOrEqual(2));
    const names = [...document.querySelectorAll('.tt-session .tt-name, .tt-act .tt-act-name')];
    expect(names).toHaveLength(2);
    for (const n of names) expect(n.parentElement?.className).toBe('tt-who');
  });

  it('клик по клиенту вызывает onOpenClient с его telegramId', async () => {
    const onOpenClient = vi.fn();
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 42, name: 'Пётр' })]);
    render(<TherapistTodaySection displayName={null} onOpenClient={onOpenClient} />);

    await waitFor(() => expect(screen.getAllByText('Пётр').length).toBeGreaterThanOrEqual(1));
    const [row] = screen.getAllByText('Пётр');
    fireEvent.click(row);
    expect(onOpenClient).toHaveBeenCalledWith(42);
  });
});

describe('TherapistTodaySection — сессии сегодня', () => {
  it('сессия с nextSession = сегодня показывается во "Сессии сегодня" с временем', async () => {
    const today = localDateStr(new Date()); // встреча — стенные часы терапевта
    mockApi.getTherapyClients.mockResolvedValue([
      client({ telegramId: 1, name: 'Клиент А', nextSession: `${today}T14:30` }),
    ]);
    render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByText('Клиент А').length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText('14:30')).toBeTruthy();
  });

  it('nextSession в будущем НЕ показывает клиента в "Сессии сегодня", даже если meetingDays совпадает', async () => {
    const future = new Date(Date.now() + 5 * 86400000).toISOString();
    mockApi.getTherapyClients.mockResolvedValue([
      client({ telegramId: 1, name: 'Клиент Б', nextSession: future, meetingDays: [0, 1, 2, 3, 4, 5, 6] }),
    ]);
    render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Сессий не запланировано')).toBeTruthy());
  });

  it('без явного nextSession, но с meetingDays на сегодня — клиент в "Сессии сегодня"', async () => {
    // День встреч — местный день терапевта, как в модели (встреча — момент).
    const todayDow = new Date().getDay();
    mockApi.getTherapyClients.mockResolvedValue([
      client({ telegramId: 1, name: 'Клиент В', nextSession: null, meetingDays: [todayDow] }),
    ]);
    render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByText('Клиент В').length).toBeGreaterThanOrEqual(1));
    expect(screen.queryByText('Сессий не запланировано')).toBeNull();
  });

  // РЕГРЕССИЯ (TZ-класс): встреча — стенные часы терапевта (datetime-local без
  // зоны), «сегодня» — его местный день. До 2026-11 модель сверяла день с UTC,
  // и в МСК с 00:00 до 03:00 «Сессии сегодня» показывали вчерашние встречи.
  // Моменты — там, где зоны заведомо расходятся с UTC; каждая зона — свой
  // рендер с загрузкой (forEachTimeZoneAsync держит зону через await).
  it('встреча на местное «сегодня» — в "Сессии сегодня" в любой зоне, вчерашняя — нет', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      for (const moment of ['2026-09-18T23:30:00Z', '2026-09-19T00:30:00Z']) {
        await forEachTimeZoneAsync(async (tz) => {
          vi.setSystemTime(new Date(moment));
          const day = (back: number) => localDateStr(new Date(Date.now() - back * 86_400_000));
          mockApi.getTherapyClients.mockResolvedValue([
            client({ telegramId: 1, name: 'Клиент А', nextSession: `${day(0)}T14:30` }),
            client({ telegramId: 2, name: 'Клиент Б', nextSession: `${day(1)}T23:00` }),
          ]);
          const { unmount } = render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);
          await waitFor(() => expect(screen.getByText('14:30')).toBeTruthy());
          expect(screen.queryByText('23:00'), tz).toBeNull();
          expect(screen.queryByText('Сессий не запланировано'), tz).toBeNull();
          unmount();
        });
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('00:10 по Москве: встреча 27-го в 15:00 — сегодня, вчерашняя 23:00 — нет', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T21:10:00Z'));
    const prevTz = process.env.TZ;
    process.env.TZ = 'Europe/Moscow';
    try {
      mockApi.getTherapyClients.mockResolvedValue([
        client({ telegramId: 1, name: 'Сегодняшняя', nextSession: '2026-10-27T15:00' }),
        client({ telegramId: 2, name: 'Вчерашняя', nextSession: '2026-10-26T23:00' }),
      ]);
      render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);
      await waitFor(() => expect(screen.getByText('15:00')).toBeTruthy());
      expect(screen.queryByText('23:00')).toBeNull();
      expect(screen.getByText('вторник, 27 октября')).toBeTruthy();
    } finally {
      if (prevTz === undefined) delete process.env.TZ;
      else process.env.TZ = prevTz;
      vi.useRealTimers();
    }
  });
});

describe('TherapistTodaySection — требуют внимания', () => {
  it('клиент без активности 3+ дня и без todayIndex попадает в "Требуют внимания"', async () => {
    mockApi.getTherapyClients.mockResolvedValue([
      client({ telegramId: 9, name: 'Забытый клиент', ...activeDaysAgo(4), todayIndex: null }),
    ]);
    render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);

    await screen.findByRole('heading', { name: 'Требуют внимания' });
    // Имя встречается и в общем списке активности, и в разделе "Требуют внимания".
    expect(screen.getAllByText('Забытый клиент').length).toBeGreaterThanOrEqual(1);
  });

  it('клиент без единой записи (lastActiveDate = null) тоже требует внимания', async () => {
    mockApi.getTherapyClients.mockResolvedValue([
      client({ telegramId: 10, name: 'Новый клиент', lastActiveDate: null, todayIndex: null }),
    ]);
    render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);

    await screen.findByRole('heading', { name: 'Требуют внимания' });
    expect(screen.getAllByText('нет данных').length).toBeGreaterThanOrEqual(1);
  });

  it('активный сегодня клиент НЕ попадает в "Требуют внимания"', async () => {
    mockApi.getTherapyClients.mockResolvedValue([
      client({ telegramId: 11, name: 'Активный', todayIndex: 5 }),
    ]);
    render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByText('Активный').length).toBeGreaterThanOrEqual(1));
    expect(screen.queryByRole('heading', { name: 'Требуют внимания' })).toBeNull();
  });
});

// QA 2026-10-26: в 00:05 кабинет терапевта говорил «Доброе утро» (h < 12),
// а клиентский «Сегодня» того же человека в ту же минуту — «Доброй ночи».
// Теперь оба экрана берут одну функцию (today/helpers.homeGreeting): с #872
// приветствие без времени суток — ошибиться часом ему не в чем.
describe('TherapistTodaySection — приветствие и дата, как у клиентского «Сегодня»', () => {
  afterEach(() => vi.useRealTimers());

  for (const local of ['2026-10-27T00:05:00', '2026-10-27T05:00:00', '2026-10-27T12:00:00', '2026-10-27T23:00:00']) {
    it(`${local.slice(11, 16)} — «Привет, Анна», без времени суток`, async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(local)); // без Z — местное время процесса
      mockApi.getTherapyClients.mockResolvedValue([]);
      render(<TherapistTodaySection displayName="Анна" onOpenClient={vi.fn()} />);
      await waitFor(() => expect(mockApi.getTherapyClients).toHaveBeenCalled());
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Привет, Анна');
    });
  }

  it('00:05 по Москве при 21:05 UTC — дата местного дня, а не дня UTC', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T21:05:00Z'));
    mockApi.getTherapyClients.mockResolvedValue([]);
    await withTimeZone('Europe/Moscow', async () => {
      render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Привет');
      expect(screen.getByText('вторник, 27 октября')).toBeTruthy();
      await waitFor(() => expect(mockApi.getTherapyClients).toHaveBeenCalled());
    });
  });
});

describe('TherapistTodaySection — приветствие', () => {
  it('с displayName показывает приветствие с именем, без — только приветствие', async () => {
    mockApi.getTherapyClients.mockResolvedValue([]);
    render(<TherapistTodaySection displayName="Анна" onOpenClient={vi.fn()} />);

    await waitFor(() => expect(mockApi.getTherapyClients).toHaveBeenCalled());
    expect(screen.getByText(/Анна/)).toBeTruthy();
  });
});
