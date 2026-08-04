// @vitest-environment jsdom
// AppDiaryNav — переключатель видимости FloatingPill/BottomNav и дневниковых
// шитов (0% покрытия), вынесен из App.tsx. Сами дневниковые шиты (SchemaEntrySheet
// и т.п.) уже тестируются отдельно — здесь мокаем их и проверяем ТОЛЬКО
// правило видимости: любой открытый оверлей (sheets.*) прячет пилюлю/нав,
// открытие/закрытие карточки записи через onSave зовёт правильный api.
import { describe, it, expect, vi, afterEach } from 'vitest';
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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

function baseProps(overrides: Partial<UseSheetsReturn> = {}) {
  return {
    sheets: { ...emptySheets, ...overrides },
    therapistMode: false,
    newDiaryEntry: null as 'schema' | 'mode' | 'gratitude' | null,
    setNewDiaryEntry: vi.fn(),
    diaryActiveSchemaIds: undefined,
    section: 'today' as const,
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
    expect(screen.getByText('SchemaEntrySheet')).toBeTruthy();
    fireEvent.click(screen.getByText('save-schema'));
    await waitFor(() =>
      expect(api.createSchemaDiary).toHaveBeenCalledWith({ trigger: 't' }),
    );
  });

  it('newDiaryEntry=mode — onSave зовёт createModeDiary', async () => {
    render(<AppDiaryNav {...baseProps()} newDiaryEntry="mode" />);
    fireEvent.click(screen.getByText('save-mode'));
    await waitFor(() =>
      expect(api.createModeDiary).toHaveBeenCalledWith({ modeId: 'x' }),
    );
  });

  it('newDiaryEntry=gratitude — onSave зовёт createGratitudeDiary(date, items)', async () => {
    render(<AppDiaryNav {...baseProps()} newDiaryEntry="gratitude" />);
    fireEvent.click(screen.getByText('save-gratitude'));
    await waitFor(() =>
      expect(api.createGratitudeDiary).toHaveBeenCalledWith('2026-08-03', [
        'a',
      ]),
    );
  });

  it('закрытие карточки схемы зовёт setNewDiaryEntry(null)', () => {
    const setNewDiaryEntry = vi.fn();
    render(
      <AppDiaryNav
        {...baseProps()}
        newDiaryEntry="schema"
        setNewDiaryEntry={setNewDiaryEntry}
      />,
    );
    fireEvent.click(screen.getByText('close-schema'));
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
});
