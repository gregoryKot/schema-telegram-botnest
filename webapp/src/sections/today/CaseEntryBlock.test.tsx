// @vitest-environment jsdom
// CaseEntryBlock — точка входа «Что это было» на /today + условный показ
// онбординга «С чего начать» (только после первого разбора, правило CLAUDE.md
// «одно очевидное действие на экран у новичка»).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CaseEntryBlock } from './CaseEntryBlock';
import type { UserProfile } from '../../types';

vi.mock('../../api', () => ({
  api: {
    getModeDiary: vi.fn(),
    getModeNotes: vi.fn().mockResolvedValue([]),
    getProfile: vi.fn(),
    createModeDiary: vi.fn().mockResolvedValue({}),
    saveModeNote: vi.fn().mockResolvedValue(undefined),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function profile(): UserProfile {
  return {
    name: null,
    role: 'CLIENT',
    ysq: { completedAt: null, activeSchemaIds: [] },
    notifications: { enabled: false, reminderEnabled: false, timezone: 'UTC', localHour: 9 },
    streak: 0,
    lastActivity: { needsTracker: null, schemaDiary: null, modeDiary: null, gratitudeDiary: null },
    mySchemaIds: [],
    myModeIds: [],
  };
}

function noopProps() {
  return {
    profile: profile(),
    hasSchemas: false,
    onOpenSchema: vi.fn(),
    onOpenAdvanced: vi.fn(),
    onOpenTracker: vi.fn(),
    onOpenDiaries: vi.fn(),
    onOpenChildhoodWheel: vi.fn(),
  };
}

function renderBlock(overrides: Partial<ReturnType<typeof noopProps>> = {}) {
  return render(
    <MemoryRouter>
      <CaseEntryBlock {...noopProps()} {...overrides} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(() => cleanup());

describe('CaseEntryBlock — у новичка одно главное действие, без чеклиста', () => {
  it('caseCount=0: карточка "Что это было", онбординг-чеклист не показан', async () => {
    mockApi.getModeDiary.mockResolvedValue([]);
    renderBlock();

    await screen.findByText('Что это было');
    expect(screen.getByText('Разобрать · ≈ 3 мин')).toBeTruthy();
    expect(screen.getByText('Ровный день')).toBeTruthy();
    expect(screen.queryByText('С чего начать')).toBeNull();
    expect(screen.queryByText(/Карта себя/)).toBeNull();
  });
});

describe('CaseEntryBlock — после первого разбора чеклист появляется', () => {
  it('caseCount>0: карточка меняет текст, показывает карту, онбординг виден', async () => {
    mockApi.getModeDiary.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    renderBlock();

    await screen.findByText('Что сегодня зацепило?');
    await screen.findByText(/Карта себя · 2 разбора/);
    await screen.findByText('С чего начать');
  });
});

describe('CaseEntryBlock — кнопки', () => {
  it('«Разобрать · ≈ 3 мин» открывает поток разбора', async () => {
    mockApi.getModeDiary.mockResolvedValue([]);
    renderBlock();
    await screen.findByText('Что это было');

    fireEvent.click(screen.getByText('Разобрать · ≈ 3 мин'));
    await waitFor(() => expect(screen.getByText('Что сегодня зацепило?')).toBeTruthy());
  });

  it('«Ровный день» вызывает onOpenTracker напрямую, не открывая поток', async () => {
    const onOpenTracker = vi.fn();
    mockApi.getModeDiary.mockResolvedValue([]);
    renderBlock({ onOpenTracker });
    await screen.findByText('Что это было');

    fireEvent.click(screen.getByText('Ровный день'));
    expect(onOpenTracker).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Что сегодня зацепило?')).toBeNull();
  });
});
