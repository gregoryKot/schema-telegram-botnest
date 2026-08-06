// @vitest-environment jsdom
// SchemasSection — экран «Паттерны» (0% покрытия): переключатель трёх вкладок
// (Схемы/Режимы/Потребности), четыре параллельные загрузки профиля/дневников/
// YSQ-прогресса и открытие модалок выбора схем/режимов. Вкладки (SchemasTab/
// ModesTab/NeedsTab) — реальные, у них свои тесты; тяжёлые модалки мокаем.
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
