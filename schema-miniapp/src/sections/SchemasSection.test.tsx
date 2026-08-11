// @vitest-environment jsdom
// SchemasSection — экран «Паттерны» (0% покрытия): переключатель трёх вкладок
// (Схемы/Режимы/Потребности), четыре параллельные загрузки профиля/дневников/
// YSQ-прогресса, открытие модалок выбора схем/режимов и скрываемые блоки
// heroes/ysq_status (useScreenBlocks — реальный хук, не мок, чтобы проверить
// read-after-write). Вкладки (SchemasTab/ModesTab/NeedsTab) — реальные, у них
// свои тесты; тяжёлые модалки мокаем.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from '@testing-library/react';
import { SchemasSection } from './SchemasSection';

vi.mock('../api', () => ({
  api: {
    getProfile: vi.fn(),
    getSchemaDiary: vi.fn(),
    getModeDiary: vi.fn(),
    getYsqProgress: vi.fn(),
    getSchemaNotes: vi.fn(),
    getModeNotes: vi.fn(),
    updateSettings: vi.fn().mockResolvedValue(undefined),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('../components/SchemaPickerSheet', () => ({
  SchemaPickerSheet: ({
    onSave,
    onClose,
  }: {
    onSave: (ids: string[]) => void;
    onClose: () => void;
  }) => (
    <div data-testid="schema-picker">
      <button onClick={() => onSave(['abandonment'])}>picker-save</button>
      <button onClick={onClose}>picker-close</button>
    </div>
  ),
}));
vi.mock('./schemas/ModePickerSheet', () => ({
  ModePickerSheet: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="mode-picker">
      <button onClick={onClose}>mode-picker-close</button>
    </div>
  ),
}));
vi.mock('../components/ModeIntroSheet', () => ({
  ModeIntroSheet: () => <div data-testid="mode-intro" />,
}));
vi.mock('../components/SchemaIntroSheet', () => ({
  SchemaIntroSheet: () => <div data-testid="schema-intro" />,
}));
vi.mock('../components/NeedDetailSheet', () => ({
  NeedDetailSheet: () => <div data-testid="need-detail" />,
}));

const PROFILE = {
  name: 'Аня',
  role: 'CLIENT' as const,
  ysq: { completedAt: null, activeSchemaIds: [] as string[] },
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
  mySchemaIds: [] as string[],
  myModeIds: [] as string[],
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getProfile.mockResolvedValue(PROFILE);
  mockApi.getSchemaDiary.mockResolvedValue([]);
  mockApi.getModeDiary.mockResolvedValue([]);
  mockApi.getYsqProgress.mockResolvedValue({ answers: [] });
  mockApi.getSchemaNotes.mockResolvedValue([]);
  mockApi.getModeNotes.mockResolvedValue([]);
});
afterEach(cleanup);

function baseProps() {
  return {
    onOpenSchema: vi.fn(),
    onOpenChildhoodWheel: vi.fn(),
    onOpenDiaries: vi.fn(),
  };
}

async function renderReady(
  props: Partial<Parameters<typeof SchemasSection>[0]> = {},
) {
  const utils = render(<SchemasSection {...baseProps()} {...props} />);
  // Ждём не факт вызова (он происходит синхронно, до того как стейт доедет до
  // DOM), а разрешение самого промиса — иначе под нагрузкой проверка попадает
  // в скелетон загрузки (красный webapp-двойник на #269, 2026-08).
  await act(async () => {
    await mockApi.getProfile.mock.results[0]?.value;
  });
  return utils;
}

describe('SchemasSection — переключение вкладок', () => {
  it('по умолчанию открыта вкладка «Схемы» (hero-приглашение пройти тест)', async () => {
    await renderReady();
    expect(screen.getByText('Узнать свои схемы')).toBeTruthy();
  });

  it('клик по «Режимы» переключает на вкладку режимов', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Режимы'));
    expect(screen.getByText('Встретить своего Критика')).toBeTruthy();
  });

  it('клик по «Потребности» переключает на список пяти потребностей', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Потребности'));
    expect(screen.getByText('Привязанность')).toBeTruthy();
  });
});

describe('SchemasSection — загрузка профиля объединяет YSQ и ручной выбор схем', () => {
  it('на чистом аккаунте (нет режимов нигде) — приглашение отметить свои, а не пустой список', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Режимы'));
    expect(screen.getByText('Отметить свои')).toBeTruthy();
  });

  it('схемы из YSQ реально попадают в общий список (без хардкода)', async () => {
    mockApi.getProfile.mockResolvedValue({
      ...PROFILE,
      ysq: { completedAt: null, activeSchemaIds: ['abandonment'] },
    });
    await renderReady();
    // Тест на схемы теперь виден: hasSchemas стал true из реальных данных.
    await waitFor(() => expect(screen.getByText('Тест на схемы')).toBeTruthy());
  });
});

describe('SchemasSection — сохранение выбора схем (read-after-write)', () => {
  it('picker.onSave обновляет localStorage и отправляет на сервер', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Собрать вручную'));
    fireEvent.click(screen.getByText('picker-save'));

    expect(JSON.parse(localStorage.getItem('my_schema_ids') ?? '[]')).toEqual([
      'abandonment',
    ]);
    expect(mockApi.updateSettings).toHaveBeenCalledWith({
      mySchemaIds: ['abandonment'],
    });
  });
});

describe('SchemasSection — открытие библиотеки схема-терапии', () => {
  it('клик по кнопке 📖 вызывает onOpenSchema без параметров', async () => {
    const onOpenSchema = vi.fn();
    await renderReady({ onOpenSchema });
    fireEvent.click(screen.getByLabelText('Библиотека схема-терапии'));
    expect(onOpenSchema).toHaveBeenCalledWith();
  });
});

describe('SchemasSection — скрываемые блоки (useScreenBlocks)', () => {
  it('клик по шестерёнке в шапке открывает лист «Настроить экран»', async () => {
    await renderReady();
    fireEvent.click(screen.getByLabelText('Настроить экран'));
    expect(await screen.findByText('Настроить экран')).toBeTruthy();
  });

  it('тумблер скрывает Hero (heroes): шлёт screen_block_toggle, пишет localStorage, и после закрытия Hero не рендерится (read-after-write)', async () => {
    await renderReady();
    fireEvent.click(screen.getByLabelText('Настроить экран'));
    fireEvent.click(await screen.findByText('Подсказка сверху'));
    expect(mockApi.trackEvent).toHaveBeenCalledWith('screen_block_toggle', {
      screen: 'patterns',
      block: 'heroes',
      hidden: true,
    });
    expect(localStorage.getItem('screen_hidden_patterns')).toBe('["heroes"]');
    fireEvent.click(screen.getByText('Готово'));
    expect(screen.queryByText('Узнать свои схемы')).toBeNull();
  });

  it('скрытый heroes прячет Hero и на вкладке «Режимы» (общий тумблер)', async () => {
    localStorage.setItem('screen_hidden_patterns', JSON.stringify(['heroes']));
    await renderReady();
    fireEvent.click(screen.getByText('Режимы'));
    expect(screen.queryByText('Встретить своего Критика')).toBeNull();
  });

  it('скрытая ysq_status: карточка теста не рендерится, а список схем на месте', async () => {
    localStorage.setItem(
      'screen_hidden_patterns',
      JSON.stringify(['ysq_status']),
    );
    mockApi.getProfile.mockResolvedValue({
      ...PROFILE,
      ysq: { completedAt: null, activeSchemaIds: ['abandonment'] },
    });
    await renderReady();
    await waitFor(() =>
      expect(screen.getByText('+ Добавить схему')).toBeTruthy(),
    );
    expect(screen.queryByText('Тест на схемы')).toBeNull();
  });

  it('долгое нажатие на Hero открывает лист с via=longpress', async () => {
    await renderReady();
    const holdWrapper = screen.getByTestId('hold-heroes');
    vi.useFakeTimers();
    fireEvent.pointerDown(holdWrapper, {
      button: 0,
      isPrimary: true,
      clientX: 0,
      clientY: 0,
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();
    expect(mockApi.trackEvent).toHaveBeenCalledWith('screen_customize_open', {
      screen: 'patterns',
      via: 'longpress',
    });
    expect(await screen.findByText('Настроить экран')).toBeTruthy();
  });
});

describe('SchemasSection — порядок стопки hero/тест на схемы (useScreenBlockOrder)', () => {
  it('сохранённый порядок из localStorage переставляет стопку (read-after-write)', async () => {
    localStorage.setItem(
      'screen_order_patterns',
      JSON.stringify(['ysq_status', 'heroes']),
    );
    mockApi.getProfile.mockResolvedValue({
      ...PROFILE,
      ysq: { completedAt: null, activeSchemaIds: ['abandonment'] },
    });
    await renderReady();
    const hero = await screen.findByTestId('hold-heroes');
    const ysq = screen.getByTestId('hold-ysq_status');
    // hero идёт ПОСЛЕ ysq в DOM (DOCUMENT_POSITION_FOLLOWING со стороны ysq).
    expect(
      ysq.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('ArrowDown на ручке строки «Подсказка сверху» переставляет, шлёт screen_block_move и персистит', async () => {
    await renderReady();
    fireEvent.click(screen.getByLabelText('Настроить экран'));
    await screen.findByText('Настроить экран');
    // Порядок листа по умолчанию: Подсказка сверху, Тест на схемы.
    fireEvent.keyDown(screen.getByLabelText('Переставить: Подсказка сверху'), {
      key: 'ArrowDown',
    });
    expect(mockApi.trackEvent).toHaveBeenCalledWith('screen_block_move', {
      screen: 'patterns',
      block: 'heroes',
      dir: 'down',
    });
    expect(localStorage.getItem('screen_order_patterns')).toBe(
      JSON.stringify(['ysq_status', 'heroes']),
    );
  });

  it('ArrowUp на ручке первой строки (край) — no-op', async () => {
    await renderReady();
    fireEvent.click(screen.getByLabelText('Настроить экран'));
    await screen.findByText('Настроить экран');
    fireEvent.keyDown(screen.getByLabelText('Переставить: Подсказка сверху'), {
      key: 'ArrowUp',
    });
    expect(mockApi.trackEvent).not.toHaveBeenCalledWith(
      'screen_block_move',
      expect.anything(),
    );
    expect(localStorage.getItem('screen_order_patterns')).toBeNull();
  });
});
