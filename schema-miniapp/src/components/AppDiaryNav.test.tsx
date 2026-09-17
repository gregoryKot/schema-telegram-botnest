// @vitest-environment jsdom
// AppDiaryNav — переключатель видимости FloatingPill/BottomNav и дневниковых
// шитов (0% покрытия), вынесен из App.tsx. Сами дневниковые шиты (SchemaEntrySheet
// и т.п.) уже тестируются отдельно — здесь мокаем их и проверяем ТОЛЬКО
// правило видимости: любой открытый оверлей (sheets.*) прячет пилюлю/нав,
// открытие/закрытие карточки записи через onSave зовёт правильный api.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { AppDiaryNav } from './AppDiaryNav';
import type { UseSheetsReturn } from '../hooks/useSheets';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    createSchemaDiary: vi.fn().mockResolvedValue(undefined),
    createModeDiary: vi.fn().mockResolvedValue(undefined),
    createGratitudeDiary: vi.fn().mockResolvedValue(undefined),
    trackEvent: vi.fn(),
  },
}));
vi.mock('./diary/SchemaEntrySheet', () => ({
  SchemaEntrySheet: ({
    onSave,
    onClose,
  }: {
    onSave: (d: unknown) => void;
    onClose: () => void;
  }) => (
    <div>
      <span>SchemaEntrySheet</span>
      <button onClick={() => onSave({ trigger: 't' })}>save-schema</button>
      <button onClick={onClose}>close-schema</button>
    </div>
  ),
}));
vi.mock('./diary/ModeEntrySheet', () => ({
  ModeEntrySheet: ({
    onSave,
    onClose,
  }: {
    onSave: (d: unknown) => void;
    onClose: () => void;
  }) => (
    <div>
      <span>ModeEntrySheet</span>
      <button onClick={() => onSave({ modeId: 'x' })}>save-mode</button>
      <button onClick={onClose}>close-mode</button>
    </div>
  ),
}));
vi.mock('./diary/GratitudeEntrySheet', () => ({
  GratitudeEntrySheet: ({
    onSave,
    onClose,
  }: {
    onSave: (date: string, items: string[]) => void;
    onClose: () => void;
  }) => (
    <div>
      <span>GratitudeEntrySheet</span>
      <button onClick={() => onSave('2026-08-03', ['a'])}>
        save-gratitude
      </button>
      <button onClick={onClose}>close-gratitude</button>
    </div>
  ),
}));
// Реальные оверлеи (BeliefCheck и т.п.) уже под своими тестами — здесь важна
// только диспетчеризация id → активный оверлей (см. QuickActionOverlays.test.tsx
// для проверки самой маршрутизации).
vi.mock('./plusMenu/QuickActionOverlays', () => ({
  QuickActionOverlays: ({
    active,
    onClose,
  }: {
    active: string | null;
    onClose: () => void;
  }) =>
    active ? (
      <div>
        <span>QuickActionOverlays:{active}</span>
        <button onClick={onClose}>close-overlay</button>
      </div>
    ) : null,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  localStorage.clear();
});

const emptySheets: UseSheetsReturn = {
  about: false,
  schemaInfo: false,
  schemaAutoStartTest: false,
  schemaInitialTab: 'needs',
  schemaHighlight: undefined,
  settings: false,
  practices: false,
  plans: false,
  todayNote: false,
  pairSheet: false,
  childhoodWheel: false,
  tracker: false,
  trackerTab: 'today',
  trackerOverlay: false,
  trackerNeedId: null,
  trackerGoal: false,
  diaries: false,
  addressPicker: false,
  open: vi.fn(),
  close: vi.fn(),
};

// Тесты видимости пилюли/нава используют section='help' исторически (при
// Ж3 «Сегодня» была особым случаем; с 2026-08-25 — нет, см. describe ниже).
function baseProps(overrides: Partial<UseSheetsReturn> = {}) {
  return {
    sheets: { ...emptySheets, ...overrides },
    therapistMode: false,
    newDiaryEntry: null as 'schema' | 'mode' | 'gratitude' | null,
    setNewDiaryEntry: vi.fn(),
    diaryActiveSchemaIds: undefined,
    section: 'help' as const,
    setSection: vi.fn(),
    userRole: 'CLIENT' as const,
  };
}

describe('AppDiaryNav — видимость пилюли/нава', () => {
  it('ничего не открыто, не терапевт-режим — пилюля и нав видны', () => {
    render(<AppDiaryNav {...baseProps()} />);
    expect(screen.getByLabelText('Быстрое действие')).toBeTruthy();
    expect(screen.getByText('Сегодня')).toBeTruthy();
  });

  it('therapistMode=true — пилюля и нав скрыты', () => {
    render(<AppDiaryNav {...baseProps()} therapistMode />);
    expect(screen.queryByLabelText('Быстрое действие')).toBeNull();
    expect(screen.queryByText('Сегодня')).toBeNull();
  });

  it.each([
    'tracker',
    'diaries',
    'schemaInfo',
    'settings',
    'practices',
    'plans',
    'childhoodWheel',
  ] as const)('sheets.%s=true — пилюля и нав скрыты', (key) => {
    render(<AppDiaryNav {...baseProps({ [key]: true })} />);
    expect(screen.queryByLabelText('Быстрое действие')).toBeNull();
    expect(screen.queryByText('Сегодня')).toBeNull();
  });
});

// Ж3 (аудит 2026-08, #405) прятала «+» на «Сегодня»; владелец откатил
// решение 2026-08-25 — пропажа привычной кнопки с главного экрана читалась
// как поломка. Теперь «+» видна на всех четырёх экранах.
describe('AppDiaryNav — «+» видна на всех экранах, включая «Сегодня»', () => {
  it.each(['today', 'help', 'schemas', 'profile'] as const)(
    'section=%s — пилюля видна',
    (section) => {
      render(<AppDiaryNav {...baseProps()} section={section} />);
      expect(screen.getByLabelText('Быстрое действие')).toBeTruthy();
    },
  );
});

describe('AppDiaryNav — сохранение записей дневника', () => {
  it('newDiaryEntry=schema — рендерит SchemaEntrySheet, onSave зовёт createSchemaDiary', async () => {
    const setNewDiaryEntry = vi.fn();
    render(
      <AppDiaryNav
        {...baseProps()}
        newDiaryEntry="schema"
        setNewDiaryEntry={setNewDiaryEntry}
      />,
    );
    // Шит теперь ленивый (LazyDiarySheets) — ждём появления, не берём синхронно.
    expect(await screen.findByText('SchemaEntrySheet')).toBeTruthy();
    fireEvent.click(screen.getByText('save-schema'));
    await waitFor(() =>
      expect(api.createSchemaDiary).toHaveBeenCalledWith({ trigger: 't' }),
    );
  });

  it('newDiaryEntry=mode — onSave зовёт createModeDiary', async () => {
    render(<AppDiaryNav {...baseProps()} newDiaryEntry="mode" />);
    fireEvent.click(await screen.findByText('save-mode'));
    await waitFor(() =>
      expect(api.createModeDiary).toHaveBeenCalledWith({ modeId: 'x' }),
    );
  });

  it('newDiaryEntry=gratitude — onSave зовёт createGratitudeDiary(date, items)', async () => {
    render(<AppDiaryNav {...baseProps()} newDiaryEntry="gratitude" />);
    fireEvent.click(await screen.findByText('save-gratitude'));
    await waitFor(() =>
      expect(api.createGratitudeDiary).toHaveBeenCalledWith('2026-08-03', [
        'a',
      ]),
    );
  });

  it('закрытие карточки схемы зовёт setNewDiaryEntry(null)', async () => {
    const setNewDiaryEntry = vi.fn();
    render(
      <AppDiaryNav
        {...baseProps()}
        newDiaryEntry="schema"
        setNewDiaryEntry={setNewDiaryEntry}
      />,
    );
    fireEvent.click(await screen.findByText('close-schema'));
    expect(setNewDiaryEntry).toHaveBeenCalledWith(null);
  });
});

describe('AppDiaryNav — открытие пилюлей', () => {
  it('«Трекер потребностей» в пилюле открывает trackerOverlay с trackerNeedId=null', () => {
    const open = vi.fn();
    render(<AppDiaryNav {...baseProps({ open })} />);
    fireEvent.click(screen.getByLabelText('Быстрое действие'));
    fireEvent.click(screen.getByText('Трекер потребностей'));
    expect(open).toHaveBeenCalledWith('trackerOverlay', {
      trackerNeedId: null,
    });
  });

  it("пункт «Схема» в пилюле зовёт setNewDiaryEntry('schema')", () => {
    const setNewDiaryEntry = vi.fn();
    render(
      <AppDiaryNav {...baseProps()} setNewDiaryEntry={setNewDiaryEntry} />,
    );
    fireEvent.click(screen.getByLabelText('Быстрое действие'));
    fireEvent.click(screen.getByText('Схема'));
    expect(setNewDiaryEntry).toHaveBeenCalledWith('schema');
  });

  it('пункт «Техника «Стоп»» открывает QuickActionOverlays и прячет пилюлю/нав', () => {
    render(<AppDiaryNav {...baseProps()} />);
    fireEvent.click(screen.getByLabelText('Быстрое действие'));
    fireEvent.click(screen.getByText('Техника «Стоп»'));
    expect(screen.getByText('QuickActionOverlays:stop')).toBeTruthy();
    expect(screen.queryByLabelText('Быстрое действие')).toBeNull();
    expect(screen.queryByText('Сегодня')).toBeNull();
  });

  it('закрытие оверлея возвращает пилюлю и нав', () => {
    render(<AppDiaryNav {...baseProps()} />);
    fireEvent.click(screen.getByLabelText('Быстрое действие'));
    fireEvent.click(screen.getByText('Техника «Стоп»'));
    fireEvent.click(screen.getByText('close-overlay'));
    expect(screen.queryByText('QuickActionOverlays:stop')).toBeNull();
    expect(screen.getByLabelText('Быстрое действие')).toBeTruthy();
  });

  it('«Схема включилась» больше не в «плюсе» (переехала в «Инструменты», один дом на действие)', () => {
    render(<AppDiaryNav {...baseProps()} />);
    fireEvent.click(screen.getByLabelText('Быстрое действие'));
    expect(screen.queryByText('Схема включилась')).toBeNull();
  });

  it('пункт «Что это было» открывает разбор случая через sheets.open("caseFlow")', () => {
    const open = vi.fn();
    render(<AppDiaryNav {...baseProps({ open })} />);
    fireEvent.click(screen.getByLabelText('Быстрое действие'));
    fireEvent.click(screen.getByText('Что это было'));
    expect(open).toHaveBeenCalledWith('caseFlow');
  });
});
