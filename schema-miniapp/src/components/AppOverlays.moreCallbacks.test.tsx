// @vitest-environment jsdom
// AppOverlays — продолжение AppOverlays.test.tsx (лимит ~300 строк/файл):
// там — правило видимости и самые частые цепочки, здесь — оставшиеся
// инлайн-колбэки (TrackerOverlay.onClose/onOpenNote/onOpenGoal, все колбэки
// SettingsSheet, Practices/Plans/About/ChildhoodWheel/PairSheet). Непроверенный
// колбэк = мёртвый код до первого клика в проде (см. соседний файл).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { AppOverlays } from './AppOverlays';
import type { UseSheetsReturn } from '../hooks/useSheets';
import { api } from '../api';

type Cb = () => void;

vi.mock('./TrackerOverlay', () => ({
  TrackerOverlay: (p: { onClose: Cb; onOpenNote: Cb; onOpenGoal: Cb }) => (
    <div>
      <span>TrackerOverlay</span>
      <button onClick={p.onClose}>tracker-close</button>
      <button onClick={p.onOpenNote}>tracker-open-note</button>
      <button onClick={p.onOpenGoal}>tracker-open-goal</button>
    </div>
  ),
}));
vi.mock('./SettingsSheet', () => ({
  SettingsSheet: (p: {
    onClose: Cb;
    onNameChanged: (n: string) => void;
    onOpenTherapistCabinet: Cb;
    onToggleTherapistMode: Cb;
    onResignTherapist: Cb;
  }) => (
    <div>
      <span>SettingsSheet</span>
      <button onClick={p.onClose}>settings-close</button>
      <button onClick={() => p.onNameChanged('Аня')}>
        settings-name-changed
      </button>
      <button onClick={p.onOpenTherapistCabinet}>settings-open-cabinet</button>
      <button onClick={p.onToggleTherapistMode}>
        settings-toggle-therapist
      </button>
      <button onClick={p.onResignTherapist}>settings-resign</button>
    </div>
  ),
}));
vi.mock('./PracticesScreen', () => ({
  PracticesScreen: (p: { onClose: Cb; onOpenTracker: Cb }) => (
    <div>
      <span>PracticesScreen</span>
      <button onClick={p.onClose}>practices-close</button>
      <button onClick={p.onOpenTracker}>practices-open-tracker</button>
    </div>
  ),
}));
vi.mock('./PlansScreen', () => ({
  PlansScreen: (p: { onClose: Cb; onOpenTracker: Cb }) => (
    <div>
      <span>PlansScreen</span>
      <button onClick={p.onClose}>plans-close</button>
      <button onClick={p.onOpenTracker}>plans-open-tracker</button>
    </div>
  ),
}));
vi.mock('./AboutSheet', () => ({
  AboutSheet: (p: { onClose: Cb; onOpenSchemaInfo: Cb }) => (
    <div>
      <span>AboutSheet</span>
      <button onClick={p.onClose}>about-close</button>
      <button onClick={p.onOpenSchemaInfo}>about-open-schema</button>
    </div>
  ),
}));
vi.mock('./ChildhoodWheelSheet', () => ({
  ChildhoodWheelSheet: (p: {
    onClose: Cb;
    onOpenSchemas: Cb;
    onSaved: (r: Record<string, number>) => void;
  }) => (
    <div>
      <span>ChildhoodWheelSheet</span>
      <button onClick={p.onClose}>wheel-close</button>
      <button onClick={p.onOpenSchemas}>wheel-open-schemas</button>
      <button onClick={() => p.onSaved({ attachment: 7 })}>wheel-saved</button>
    </div>
  ),
}));
vi.mock('./PairSheet', () => ({
  PairSheet: (p: { onClose: Cb }) => (
    <div>
      <span>PairSheet</span>
      <button onClick={p.onClose}>pair-close</button>
    </div>
  ),
}));
vi.mock('./SchemaInfoSheet', () => ({
  SchemaInfoSheet: (p: { onClose: Cb }) => (
    <div>
      <span>SchemaInfoSheet</span>
      <button onClick={p.onClose}>schema-info-close</button>
    </div>
  ),
}));
vi.mock('../sections/DiarySection', () => ({ DiarySection: () => <div /> }));
vi.mock('./Disclaimer', () => ({ Disclaimer: () => <div /> }));
vi.mock('./AddressFormPicker', () => ({ AddressFormPicker: () => <div /> }));
vi.mock('./DonateNudge', () => ({ DonateNudge: () => <div /> }));
vi.mock('./Celebration', () => ({ Celebration: () => <div /> }));
vi.mock('./NoteSheet', () => ({ NoteSheet: () => <div /> }));
vi.mock('./TaskCreateSheet', () => ({ TaskCreateSheet: () => <div /> }));
vi.mock('../api', () => ({
  api: { getPair: vi.fn().mockResolvedValue({ id: 1 }) },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeSheets(overrides: Partial<UseSheetsReturn> = {}): UseSheetsReturn {
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
    open: vi.fn(),
    close: vi.fn(),
    ...overrides,
  };
}

function baseProps(overrides: Partial<Parameters<typeof AppOverlays>[0]> = {}) {
  return {
    sheets: makeSheets(),
    needs: [],
    ratings: {},
    saved: {},
    isOffline: false,
    onChange: vi.fn(),
    onSaved: vi.fn(),
    yesterdayRatings: {},
    showOnboarding: false,
    onAddressPickerDone: vi.fn(),
    consentGiven: false,
    onConsentDisclaimer: vi.fn(),
    onAcceptDisclaimer: vi.fn(),
    celebrationStreak: null,
    setCelebrationStreak: vi.fn(),
    childhoodWheelPending: false,
    setChildhoodWheelPending: vi.fn(),
    setChildhoodRatings: vi.fn(),
    setPairData: vi.fn(),
    userRole: 'CLIENT' as const,
    displayName: null,
    setDisplayName: vi.fn(),
    therapistMode: false,
    switchTherapistMode: vi.fn(),
    onResignTherapist: vi.fn(),
    diaryActiveSchemaIds: undefined,
    newDiaryEntry: null,
    setNewDiaryEntry: vi.fn(),
    section: 'today' as const,
    setSection: vi.fn(),
    ...overrides,
  };
}

describe('AppOverlays — TrackerOverlay: остальные колбэки', () => {
  it('onClose закрывает trackerOverlay c trackerNeedId=null', () => {
    const close = vi.fn();
    render(
      <AppOverlays
        {...baseProps({ sheets: makeSheets({ trackerOverlay: true, close }) })}
      />,
    );
    fireEvent.click(screen.getByText('tracker-close'));
    expect(close).toHaveBeenCalledWith('trackerOverlay', {
      trackerNeedId: null,
    });
  });

  it('onOpenNote/onOpenGoal открывают соответствующие шиты', () => {
    const open = vi.fn();
    render(
      <AppOverlays
        {...baseProps({ sheets: makeSheets({ trackerOverlay: true, open }) })}
      />,
    );
    fireEvent.click(screen.getByText('tracker-open-note'));
    expect(open).toHaveBeenCalledWith('todayNote');
    fireEvent.click(screen.getByText('tracker-open-goal'));
    expect(open).toHaveBeenCalledWith('trackerGoal');
  });
});

describe('AppOverlays — SettingsSheet', () => {
  it('onClose/onNameChanged/onOpenTherapistCabinet/onToggleTherapistMode', () => {
    const close = vi.fn();
    const setDisplayName = vi.fn();
    const switchTherapistMode = vi.fn();
    render(
      <AppOverlays
        {...baseProps({
          sheets: makeSheets({ settings: true, close }),
          setDisplayName,
          switchTherapistMode,
          therapistMode: false,
        })}
      />,
    );
    fireEvent.click(screen.getByText('settings-close'));
    expect(close).toHaveBeenCalledWith('settings');
    fireEvent.click(screen.getByText('settings-name-changed'));
    expect(setDisplayName).toHaveBeenCalledWith('Аня');
    fireEvent.click(screen.getByText('settings-open-cabinet'));
    expect(switchTherapistMode).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByText('settings-toggle-therapist'));
    expect(switchTherapistMode).toHaveBeenCalledWith(true); // !false
  });
});

describe('AppOverlays — Practices/Plans/About/ChildhoodWheel/Pair/SchemaInfo', () => {
  it('PracticesScreen: close/openTracker', () => {
    const close = vi.fn();
    const open = vi.fn();
    render(
      <AppOverlays
        {...baseProps({ sheets: makeSheets({ practices: true, close, open }) })}
      />,
    );
    fireEvent.click(screen.getByText('practices-close'));
    expect(close).toHaveBeenCalledWith('practices');
    fireEvent.click(screen.getByText('practices-open-tracker'));
    expect(close).toHaveBeenCalledWith('practices');
    expect(open).toHaveBeenCalledWith('trackerOverlay', {
      trackerNeedId: null,
    });
  });

  it('PlansScreen: close/openTracker', () => {
    const close = vi.fn();
    const open = vi.fn();
    render(
      <AppOverlays
        {...baseProps({ sheets: makeSheets({ plans: true, close, open }) })}
      />,
    );
    fireEvent.click(screen.getByText('plans-open-tracker'));
    expect(close).toHaveBeenCalledWith('plans');
    expect(open).toHaveBeenCalledWith('trackerOverlay', {
      trackerNeedId: null,
    });
  });

  it('AboutSheet: close/openSchemaInfo', () => {
    const close = vi.fn();
    const open = vi.fn();
    render(
      <AppOverlays
        {...baseProps({ sheets: makeSheets({ about: true, close, open }) })}
      />,
    );
    fireEvent.click(screen.getByText('about-open-schema'));
    expect(close).toHaveBeenCalledWith('about');
    expect(open).toHaveBeenCalledWith('schemaInfo');
  });

  it('ChildhoodWheelSheet: close/openSchemas/onSaved пробрасывает оценки', () => {
    const close = vi.fn();
    const open = vi.fn();
    const setChildhoodRatings = vi.fn();
    render(
      <AppOverlays
        {...baseProps({
          sheets: makeSheets({ childhoodWheel: true, close, open }),
          setChildhoodRatings,
        })}
      />,
    );
    fireEvent.click(screen.getByText('wheel-open-schemas'));
    expect(close).toHaveBeenCalledWith('childhoodWheel');
    expect(open).toHaveBeenCalledWith('schemaInfo');
    fireEvent.click(screen.getByText('wheel-saved'));
    expect(setChildhoodRatings).toHaveBeenCalledWith({ attachment: 7 });
  });

  it('PairSheet: close перезагружает пару через api.getPair', async () => {
    const close = vi.fn();
    const setPairData = vi.fn();
    render(
      <AppOverlays
        {...baseProps({
          sheets: makeSheets({ pairSheet: true, close }),
          setPairData,
        })}
      />,
    );
    fireEvent.click(screen.getByText('pair-close'));
    expect(close).toHaveBeenCalledWith('pairSheet');
    await waitFor(() => expect(api.getPair).toHaveBeenCalled());
    await waitFor(() => expect(setPairData).toHaveBeenCalledWith({ id: 1 }));
  });

  it('SchemaInfoSheet: close сбрасывает autoStartTest/highlight', () => {
    const close = vi.fn();
    render(
      <AppOverlays
        {...baseProps({ sheets: makeSheets({ schemaInfo: true, close }) })}
      />,
    );
    fireEvent.click(screen.getByText('schema-info-close'));
    expect(close).toHaveBeenCalledWith('schemaInfo', {
      schemaAutoStartTest: false,
      schemaHighlight: undefined,
    });
  });
});
