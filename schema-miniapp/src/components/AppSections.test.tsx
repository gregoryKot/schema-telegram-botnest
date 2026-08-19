// @vitest-environment jsdom
// AppSections — переключатель 4 главных экранов (0% покрытия), вынесен из
// App.tsx. Сами секции (TodaySection и т.п.) — самостоятельные файлы под
// своими тестами; здесь мокаем их и проверяем ТОЛЬКО маршрутизацию:
// therapistMode прячет все секции, section выбирает ровно одну, и КАЖДЫЙ
// инлайн-колбэк (их тут ~15) реально дёргает правильный sheets.open/close —
// непроверенный колбэк остаётся мёртвым кодом до первого клика в проде.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { AppSections } from './AppSections';
import type { UseSheetsReturn } from '../hooks/useSheets';
import { api } from '../api';

type Cb = () => void;

vi.mock('../sections/TodaySection', () => ({
  TodaySection: (p: {
    onOpenSchema: (o?: unknown) => void;
    onOpenAdvanced: Cb;
    onOpenTracker: Cb;
    onOpenTrackerAt: (id: string) => void;
    onOpenTrackerHistory: Cb;
    onOpenDiaries: Cb;
    onOpenChildhoodWheel: Cb;
    onOpenTherapistCabinet: Cb;
  }) => (
    <div>
      <span>TodaySection</span>
      <button
        onClick={() =>
          p.onOpenSchema({ startTest: true, tab: 'modes', highlight: 'x' })
        }
      >
        today-open-schema
      </button>
      <button onClick={p.onOpenAdvanced}>today-open-advanced</button>
      <button onClick={p.onOpenTracker}>today-open-tracker</button>
      <button onClick={() => p.onOpenTrackerAt('safety')}>
        today-open-tracker-at
      </button>
      <button onClick={p.onOpenTrackerHistory}>
        today-open-tracker-history
      </button>
      <button onClick={p.onOpenDiaries}>today-open-diaries</button>
      <button onClick={p.onOpenChildhoodWheel}>today-open-wheel</button>
      <button onClick={p.onOpenTherapistCabinet}>today-open-cabinet</button>
    </div>
  ),
}));
vi.mock('../sections/SchemasSection', () => ({
  SchemasSection: (p: {
    onOpenSchema: (o?: unknown) => void;
    onOpenChildhoodWheel: Cb;
    onOpenDiaries: Cb;
  }) => (
    <div>
      <span>SchemasSection</span>
      <button onClick={() => p.onOpenSchema()}>schemas-open-schema</button>
      <button onClick={p.onOpenChildhoodWheel}>schemas-open-wheel</button>
      <button onClick={p.onOpenDiaries}>schemas-open-diaries</button>
    </div>
  ),
}));
vi.mock('../sections/HelpSection', () => ({
  HelpSection: (p: {
    onOpenChildhoodWheel: Cb;
    onOpenPractices: Cb;
    onOpenPlans: Cb;
    onOpenTracker: Cb;
    onOpenDiaries: Cb;
    onTasksChanged: Cb;
    onOpenTherapistCabinet: Cb;
  }) => (
    <div>
      <span>HelpSection</span>
      <button onClick={p.onOpenChildhoodWheel}>help-open-wheel</button>
      <button onClick={p.onOpenPractices}>help-open-practices</button>
      <button onClick={p.onOpenPlans}>help-open-plans</button>
      <button onClick={p.onOpenTracker}>help-open-tracker</button>
      <button onClick={p.onOpenDiaries}>help-open-diaries</button>
      <button onClick={p.onTasksChanged}>help-tasks-changed</button>
      <button onClick={p.onOpenTherapistCabinet}>help-open-cabinet</button>
    </div>
  ),
}));
vi.mock('../sections/ProfileSection', () => ({
  ProfileSection: (p: { onOpenSettings: Cb; onOpenTracker: Cb }) => (
    <div>
      <span>ProfileSection</span>
      <button onClick={p.onOpenSettings}>profile-open-settings</button>
      <button onClick={p.onOpenTracker}>profile-open-tracker</button>
    </div>
  ),
}));
vi.mock('../api', () => ({ api: { getTasks: vi.fn().mockResolvedValue([]) } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeSheets(open = vi.fn()): UseSheetsReturn {
  return {
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
    open,
    close: vi.fn(),
  };
}

function baseProps(overrides: Partial<Parameters<typeof AppSections>[0]> = {}) {
  return {
    therapistMode: false,
    section: 'today' as const,
    needs: [],
    ratings: {},
    yesterdayRatings: {},
    sheets: makeSheets(),
    todayRefreshKey: 0,
    userRole: 'CLIENT' as const,
    setCabinetView: vi.fn(),
    switchTherapistMode: vi.fn(),
    childhoodRatings: {},
    helpPracticeCount: null,
    helpPlanCount: null,
    helpTasks: null,
    helpTasksKey: 0,
    setHelpTasks: vi.fn(),
    setHelpTasksKey: vi.fn(),
    profileRefreshKey: 0,
    displayName: null,
    onNewDiaryEntry: vi.fn(),
    patternsTab: 'schemas' as const,
    onOpenPatterns: vi.fn(),
    ...overrides,
  };
}

describe('AppSections — маршрутизация по section', () => {
  it.each([
    ['today', 'TodaySection'],
    ['schemas', 'SchemasSection'],
    ['help', 'HelpSection'],
    ['profile', 'ProfileSection'],
  ] as const)('section=%s рендерит только %s', (section, expected) => {
    render(<AppSections {...baseProps({ section })} />);
    expect(screen.getByText(expected)).toBeTruthy();
    for (const other of [
      'TodaySection',
      'SchemasSection',
      'HelpSection',
      'ProfileSection',
    ]) {
      if (other !== expected) expect(screen.queryByText(other)).toBeNull();
    }
  });

  it('therapistMode=true — ни одна секция не рендерится', () => {
    render(<AppSections {...baseProps({ therapistMode: true })} />);
    expect(screen.queryByText('TodaySection')).toBeNull();
  });
});

describe('AppSections — колбэки TodaySection', () => {
  it.each([
    ['today-open-advanced', 'settings', undefined],
    ['today-open-tracker', 'trackerOverlay', { trackerNeedId: null }],
    ['today-open-tracker-at', 'trackerOverlay', { trackerNeedId: 'safety' }],
    ['today-open-tracker-history', 'tracker', { trackerTab: 'history' }],
    ['today-open-diaries', 'diaries', undefined],
    ['today-open-wheel', 'childhoodWheel', undefined],
  ] as const)('%s → open(%s, %j)', (btn, key, payload) => {
    const open = vi.fn();
    render(<AppSections {...baseProps({ sheets: makeSheets(open) })} />);
    fireEvent.click(screen.getByText(btn));
    if (payload === undefined) expect(open).toHaveBeenCalledWith(key);
    else expect(open).toHaveBeenCalledWith(key, payload);
  });

  it('onOpenSchema прокидывает opts.startTest/tab/highlight в schemaInfo-пейлоад', () => {
    const open = vi.fn();
    render(<AppSections {...baseProps({ sheets: makeSheets(open) })} />);
    fireEvent.click(screen.getByText('today-open-schema'));
    expect(open).toHaveBeenCalledWith('schemaInfo', {
      schemaAutoStartTest: true,
      schemaInitialTab: 'modes',
      schemaHighlight: 'x',
    });
  });

  it('onOpenTherapistCabinet — переключает вид кабинета и режим терапевта', () => {
    const setCabinetView = vi.fn();
    const switchTherapistMode = vi.fn();
    render(
      <AppSections {...baseProps({ setCabinetView, switchTherapistMode })} />,
    );
    fireEvent.click(screen.getByText('today-open-cabinet'));
    expect(setCabinetView).toHaveBeenCalledWith('list');
    expect(switchTherapistMode).toHaveBeenCalledWith(true);
  });
});

describe('AppSections — колбэки SchemasSection/HelpSection/ProfileSection', () => {
  it('SchemasSection: onOpenSchema/onOpenChildhoodWheel/onOpenDiaries', () => {
    const open = vi.fn();
    render(
      <AppSections
        {...baseProps({ section: 'schemas', sheets: makeSheets(open) })}
      />,
    );
    fireEvent.click(screen.getByText('schemas-open-schema'));
    fireEvent.click(screen.getByText('schemas-open-wheel'));
    fireEvent.click(screen.getByText('schemas-open-diaries'));
    expect(open).toHaveBeenCalledWith('schemaInfo', {
      schemaAutoStartTest: false,
      schemaInitialTab: 'needs',
      schemaHighlight: undefined,
    });
    expect(open).toHaveBeenCalledWith('childhoodWheel');
    expect(open).toHaveBeenCalledWith('diaries');
  });

  it('HelpSection: колбэки открытия и onTasksChanged (перезагружает задачи через api)', async () => {
    const open = vi.fn();
    const setHelpTasks = vi.fn();
    const setHelpTasksKey = vi.fn();
    render(
      <AppSections
        {...baseProps({
          section: 'help',
          sheets: makeSheets(open),
          setHelpTasks,
          setHelpTasksKey,
        })}
      />,
    );
    fireEvent.click(screen.getByText('help-open-wheel'));
    expect(open).toHaveBeenCalledWith('childhoodWheel');
    fireEvent.click(screen.getByText('help-open-practices'));
    expect(open).toHaveBeenCalledWith('practices');
    fireEvent.click(screen.getByText('help-open-plans'));
    expect(open).toHaveBeenCalledWith('plans');
    fireEvent.click(screen.getByText('help-open-tracker'));
    expect(open).toHaveBeenCalledWith('trackerOverlay', {
      trackerNeedId: null,
    });
    fireEvent.click(screen.getByText('help-open-diaries'));
    expect(open).toHaveBeenCalledWith('diaries');
    fireEvent.click(screen.getByText('help-tasks-changed'));
    await waitFor(() => expect(api.getTasks).toHaveBeenCalled());
    await waitFor(() => expect(setHelpTasks).toHaveBeenCalledWith([]));
    expect(setHelpTasksKey).toHaveBeenCalled();
  });

  it('ProfileSection: onOpenSettings/onOpenTracker', () => {
    const open = vi.fn();
    render(
      <AppSections
        {...baseProps({ section: 'profile', sheets: makeSheets(open) })}
      />,
    );
    fireEvent.click(screen.getByText('profile-open-settings'));
    expect(open).toHaveBeenCalledWith('settings');
    fireEvent.click(screen.getByText('profile-open-tracker'));
    expect(open).toHaveBeenCalledWith('trackerOverlay', {
      trackerNeedId: null,
    });
  });
});
