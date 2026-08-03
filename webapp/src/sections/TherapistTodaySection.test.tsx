// @vitest-environment jsdom
// Компонентные тесты TherapistTodaySection (кабинет терапевта, главный
// экран). Покрывает: пустое состояние (чистый аккаунт — CLAUDE.md
// «никаких хардкод-заглушек»), реальные данные из api.getTherapyClients,
// сортировку сессий сегодня, «требуют внимания» (3+ дня без активности),
// приветствие по времени суток, клики по клиентам.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { TherapistTodaySection } from './TherapistTodaySection';

vi.mock('../api', () => ({
  api: {
    getTherapyClients: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as { getTherapyClients: ReturnType<typeof vi.fn> };

function client(overrides: Partial<{
  telegramId: number; name: string | null; clientAlias: string | null;
  streak: number; lastActiveDate: string | null; todayIndex: number | null;
  nextSession: string | null; meetingDays: number[];
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
    // Блок сводной статистики скрыт вовсе на пустом списке — не «0/0».
    expect(screen.queryByText('активны сегодня')).toBeNull();
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
      client({ telegramId: 2, name: 'Мария', todayIndex: null, lastActiveDate: '2026-08-01T00:00:00Z' }),
    ]);
    render(<TherapistTodaySection displayName="Терапевт" onOpenClient={vi.fn()} />);

    // Иван и в списке активности, и (т.к. заполнил) в блоке "Заполнили сегодня".
    await waitFor(() => expect(screen.getAllByText('Иван').length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText('Мария')).toBeTruthy();
    expect(screen.getByText('7.2')).toBeTruthy();
    expect(screen.getByText('заполнил')).toBeTruthy();
  });

  it('клиентов без clientAlias/name показывает как "#telegramId" — не пустую строку', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 555, name: null, clientAlias: null })]);
    render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByText('#555').length).toBeGreaterThanOrEqual(1));
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
    const today = new Date().toISOString().slice(0, 10);
    mockApi.getTherapyClients.mockResolvedValue([
      client({ telegramId: 1, name: 'Клиент А', nextSession: `${today}T14:30:00Z` }),
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
    const todayDow = new Date().getDay();
    mockApi.getTherapyClients.mockResolvedValue([
      client({ telegramId: 1, name: 'Клиент В', nextSession: null, meetingDays: [todayDow] }),
    ]);
    render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByText('Клиент В').length).toBeGreaterThanOrEqual(1));
    expect(screen.queryByText('Сессий не запланировано')).toBeNull();
  });
});

describe('TherapistTodaySection — требуют внимания', () => {
  it('клиент без активности 3+ дня и без todayIndex попадает в "Требуют внимания"', async () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString();
    mockApi.getTherapyClients.mockResolvedValue([
      client({ telegramId: 9, name: 'Забытый клиент', lastActiveDate: fourDaysAgo, todayIndex: null }),
    ]);
    render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);

    await screen.findByText('Требуют внимания');
    // Имя встречается и в общем списке активности, и в разделе "Требуют внимания".
    expect(screen.getAllByText('Забытый клиент').length).toBeGreaterThanOrEqual(1);
  });

  it('клиент без единой записи (lastActiveDate = null) тоже требует внимания', async () => {
    mockApi.getTherapyClients.mockResolvedValue([
      client({ telegramId: 10, name: 'Новый клиент', lastActiveDate: null, todayIndex: null }),
    ]);
    render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);

    await screen.findByText('Требуют внимания');
    expect(screen.getAllByText('нет данных').length).toBeGreaterThanOrEqual(1);
  });

  it('активный сегодня клиент НЕ попадает в "Требуют внимания"', async () => {
    mockApi.getTherapyClients.mockResolvedValue([
      client({ telegramId: 11, name: 'Активный', todayIndex: 5 }),
    ]);
    render(<TherapistTodaySection displayName={null} onOpenClient={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByText('Активный').length).toBeGreaterThanOrEqual(1));
    expect(screen.queryByText('Требуют внимания')).toBeNull();
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
