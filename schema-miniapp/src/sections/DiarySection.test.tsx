// @vitest-environment jsdom
// Компонентные тесты DiarySection (miniapp) — доверительный путь дневников:
// загрузка, пустое состояние, сохранение записи (read-after-write, CLAUDE.md
// «Тесты» — сохранил → нашёл в списке), ошибка API при сохранении. Кризисная
// детекция уже покрыта GratitudeEntrySheet.test.tsx/SchemaEntrySheet.test.tsx/
// ModeEntrySheet.test.tsx — здесь её не дублируем.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { DiarySection } from './DiarySection';

vi.mock('../api', () => ({
  api: {
    getSchemaDiary: vi.fn(),
    getModeDiary: vi.fn(),
    getGratitudeDiary: vi.fn(),
    getProfile: vi.fn(),
    createSchemaDiary: vi.fn(),
    createModeDiary: vi.fn(),
    createGratitudeDiary: vi.fn(),
    deleteSchemaDiary: vi.fn(),
    deleteModeDiary: vi.fn(),
    deleteGratitudeDiary: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const PROFILE = {
  name: 'Аня',
  role: 'CLIENT' as const,
  ysq: { completedAt: null, activeSchemaIds: [] },
  notifications: {
    enabled: false,
    reminderEnabled: false,
    timezone: 'Europe/Moscow',
    localHour: 21,
  },
  streak: 0,
  lastActivity: {
    needsTracker: null,
    schemaDiary: null,
    modeDiary: null,
    gratitudeDiary: null,
  },
  mySchemaIds: [],
  myModeIds: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  // Черновики автосохраняются в localStorage на каждое изменение поля
  // (GratitudeEntrySheet) — без очистки черновик из одного теста протекает
  // в следующий как DraftCard.
  localStorage.clear();
  mockApi.getSchemaDiary.mockResolvedValue([]);
  mockApi.getModeDiary.mockResolvedValue([]);
  mockApi.getGratitudeDiary.mockResolvedValue([]);
  mockApi.getProfile.mockResolvedValue(PROFILE);
});

afterEach(() => {
  cleanup();
});

async function renderLoaded() {
  const utils = render(<DiarySection />);
  // Дожидаемся первой загрузки (useEffect -> Promise.all с api.get*Diary).
  await screen.findByText('Мои дневники');
  return utils;
}

describe('DiarySection — загрузка и пустое состояние', () => {
  it('на чистом аккаунте (все дневники пустые) счётчики записей не рисуются', async () => {
    await renderLoaded();
    // DiaryCard рисует "N записей"/"N записи" только при count > 0 — на
    // пустом аккаунте таких строк быть не должно (правило «никаких
    // хардкод-заглушек вместо реальных данных»). Якорим ^, чтобы не
    // словить случайное число внутри объясняющего текста дневника.
    expect(screen.queryByText(/^\d+\s+запис/)).toBeNull();
  });

  it('открыв пустой дневник благодарности, видим объясняющий пустое состояние блок, а не список', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText('Дневник благодарности'));
    await screen.findByText('Первая запись — кнопка внизу, пара минут.');
  });

  it('с реальными записями счётчик показывает их число', async () => {
    mockApi.getGratitudeDiary.mockResolvedValue([
      {
        id: 1,
        date: '2026-08-01',
        items: ['гуляла'],
        createdAt: '2026-08-01T10:00:00.000Z',
      },
      {
        id: 2,
        date: '2026-08-02',
        items: ['выспалась'],
        createdAt: '2026-08-02T10:00:00.000Z',
      },
    ]);
    await renderLoaded();
    expect(screen.getByText(/2 записи/)).toBeTruthy();
  });
});

describe('DiarySection — сохранение записи благодарности (read-after-write)', () => {
  it('после сохранения новая запись сразу видна в списке дневника', async () => {
    mockApi.createGratitudeDiary.mockResolvedValue({
      id: 42,
      date: '2026-08-03',
      items: ['сегодня было солнечно'],
      createdAt: '2026-08-03T12:00:00.000Z',
    });
    await renderLoaded();

    // Открываем дневник благодарности и создаём новую запись через FAB.
    fireEvent.click(screen.getByText('Дневник благодарности'));
    await screen.findByText('+ Записать');
    fireEvent.click(screen.getByText('+ Записать'));

    const first = await screen.findByPlaceholderText(
      'Что-то хорошее, что произошло сегодня...',
    );
    fireEvent.change(first, { target: { value: 'сегодня было солнечно' } });
    fireEvent.click(screen.getByText('Сохранить'));

    await waitFor(() =>
      expect(mockApi.createGratitudeDiary).toHaveBeenCalledWith('2026-08-03', [
        'сегодня было солнечно',
      ]),
    );

    // Лист закрылся, мы обратно на списке дневника — запись должна быть видна.
    await screen.findByText('сегодня было солнечно');
  });

  it('ошибка api.createGratitudeDiary НЕ добавляет запись в раздел сохранённых (не выдаёт черновик за сохранённую запись)', async () => {
    mockApi.createGratitudeDiary.mockRejectedValue(new Error('network down'));
    await renderLoaded();

    fireEvent.click(screen.getByText('Дневник благодарности'));
    await screen.findByText('+ Записать');
    fireEvent.click(screen.getByText('+ Записать'));

    const first = await screen.findByPlaceholderText(
      'Что-то хорошее, что произошло сегодня...',
    );
    fireEvent.change(first, {
      target: { value: 'запись, которая не сохранится' },
    });
    fireEvent.click(screen.getByText('Сохранить'));

    await waitFor(() =>
      expect(mockApi.createGratitudeDiary).toHaveBeenCalledTimes(1),
    );
    await act(async () => {});

    // Поведение после фикса (аудит доверия, п.3): лист НЕ закрывается и
    // показывает причину отказа. Раньше он закрывался, а единственным
    // сигналом провала была вибрация haptic.error() — на десктопе её нет
    // вовсе, и человек считал запись сохранённой.
    expect(screen.getByText(/Не удалось сохранить/i)).toBeTruthy();
    // Введённый текст на месте — его не потеряли.
    expect(
      screen.getByPlaceholderText('Что-то хорошее, что произошло сегодня...')
        .value,
    ).toBe('запись, которая не сохранится');
    // И в сохранённые запись не попала: счётчика записей нет.
    expect(screen.queryByText(/\d+\s+запис/)).toBeNull();
  });
});

describe('DiarySection — удаление записи', () => {
  it('удаление вызывает api.deleteGratitudeDiary и убирает запись из списка', async () => {
    mockApi.getGratitudeDiary.mockResolvedValue([
      {
        id: 7,
        date: '2026-08-01',
        items: ['первая запись'],
        createdAt: '2026-08-01T10:00:00.000Z',
      },
    ]);
    mockApi.deleteGratitudeDiary.mockResolvedValue(undefined);
    await renderLoaded();

    fireEvent.click(screen.getByText('Дневник благодарности'));
    const entryPreview = await screen.findByText('первая запись');

    // Карточка сворачивает детали до тапа — кнопка удаления появляется
    // только после раскрытия, и удаление требует явного подтверждения
    // (два тапа: «Удалить» → «Удалить навсегда»), чтобы случайный тап не стёр запись.
    fireEvent.click(entryPreview);
    fireEvent.click(screen.getByText('Удалить'));
    fireEvent.click(screen.getByText('Удалить навсегда'));

    await waitFor(() =>
      expect(mockApi.deleteGratitudeDiary).toHaveBeenCalledWith(7),
    );
    await waitFor(() => expect(screen.queryByText('первая запись')).toBeNull());
  });
});
