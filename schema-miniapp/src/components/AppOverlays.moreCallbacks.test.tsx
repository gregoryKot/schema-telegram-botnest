// @vitest-environment jsdom
// AppOverlays — продолжение AppOverlays.test.tsx (лимит ~300 строк/файл):
// там — правило видимости и самые частые цепочки, здесь — оставшиеся
// инлайн-колбэки (TrackerOverlay.onClose/onOpenNote/onOpenGoal, SettingsSheet,
// Practices/Plans/About/ChildhoodWheel/PairSheet/SchemaInfoSheet).
// Непроверенный колбэк = мёртвый код до первого клика в проде.
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
  }) => (
    <div>
      <button onClick={p.onClose}>settings-close</button>
      <button onClick={() => p.onNameChanged('Аня')}>settings-name</button>
      <button onClick={p.onOpenTherapistCabinet}>settings-cabinet</button>
      <button onClick={p.onToggleTherapistMode}>settings-toggle</button>
    </div>
  ),
}));
vi.mock('./PracticesScreen', () => ({
  PracticesScreen: (p: { onClose: Cb; onOpenTracker: Cb }) => (
    <div>
      <button onClick={p.onClose}>practices-close</button>
      <button onClick={p.onOpenTracker}>practices-tracker</button>
    </div>
  ),
}));
vi.mock('./PlansScreen', () => ({
  PlansScreen: (p: { onClose: Cb; onOpenTracker: Cb }) => (
    <div>
      <button onClick={p.onClose}>plans-close</button>
      <button onClick={p.onOpenTracker}>plans-tracker</button>
    </div>
  ),
}));
vi.mock('./AboutSheet', () => ({
  AboutSheet: (p: { onClose: Cb; onOpenSchemaInfo: Cb }) => (
    <button onClick={p.onOpenSchemaInfo}>about-open-schema</button>
  ),
}));
vi.mock('./ChildhoodWheelSheet', () => ({
  ChildhoodWheelSheet: (p: {
    onOpenSchemas: Cb;
    onSaved: (r: Record<string, number>) => void;
  }) => (
    <div>
      <button onClick={p.onOpenSchemas}>wheel-open-schemas</button>
      <button onClick={() => p.onSaved({ attachment: 7 })}>wheel-saved</button>
    </div>
  ),
}));
vi.mock('./PairSheet', () => ({
  PairSheet: (p: { onClose: Cb }) => (
    <button onClick={p.onClose}>pair-close</button>
  ),
}));
vi.mock('./SchemaInfoSheet', () => ({
  SchemaInfoSheet: (p: { onClose: Cb }) => (
    <button onClick={p.onClose}>schema-info-close</button>
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

function renderOverlays(
  overrides: Partial<Parameters<typeof AppOverlays>[0]> = {},
) {
  return render(<AppOverlays {...baseProps(overrides)} />);
}

describe('AppOverlays — TrackerOverlay: остальные колбэки', () => {
  it('onClose/onOpenNote/onOpenGoal', () => {
    const close = vi.fn();
    const open = vi.fn();
    renderOverlays({
      sheets: makeSheets({ trackerOverlay: true, close, open }),
    });
    fireEvent.click(screen.getByText('tracker-close'));
    expect(close).toHaveBeenCalledWith('trackerOverlay', {
      trackerNeedId: null,
    });
    fireEvent.click(screen.getByText('tracker-open-note'));
    expect(open).toHaveBeenCalledWith('todayNote');
    fireEvent.click(screen.getByText('tracker-open-goal'));
    expect(open).toHaveBeenCalledWith('trackerGoal');
  });
});

describe('AppOverlays — SettingsSheet', () => {
  it('close/onNameChanged/openTherapistCabinet/toggleTherapistMode', () => {
    const close = vi.fn();
    const setDisplayName = vi.fn();
    const switchTherapistMode = vi.fn();
    renderOverlays({
      sheets: makeSheets({ settings: true, close }),
      setDisplayName,
      switchTherapistMode,
    });
    fireEvent.click(screen.getByText('settings-close'));
    expect(close).toHaveBeenCalledWith('settings');
    fireEvent.click(screen.getByText('settings-name'));
    expect(setDisplayName).toHaveBeenCalledWith('Аня');
    fireEvent.click(screen.getByText('settings-cabinet'));
    expect(switchTherapistMode).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByText('settings-toggle'));
    expect(switchTherapistMode).toHaveBeenCalledWith(true); // !false
  });
});

describe('AppOverlays — Practices/Plans: close + openTracker', () => {
  it.each([
    ['practices', 'practices-close', 'practices-tracker'],
    ['plans', 'plans-close', 'plans-tracker'],
  ] as const)(
    '%s: закрывает себя и открывает трекер',
    (flag, closeBtn, trackerBtn) => {
      const close = vi.fn();
      const open = vi.fn();
      renderOverlays({ sheets: makeSheets({ [flag]: true, close, open }) });
      fireEvent.click(screen.getByText(closeBtn));
      expect(close).toHaveBeenCalledWith(flag);
      fireEvent.click(screen.getByText(trackerBtn));
      expect(open).toHaveBeenCalledWith('trackerOverlay', {
        trackerNeedId: null,
      });
    },
  );
});

describe('AppOverlays — About/ChildhoodWheel/Pair/SchemaInfo', () => {
  it('AboutSheet: openSchemaInfo закрывает about и открывает schemaInfo', () => {
    const close = vi.fn();
    const open = vi.fn();
    renderOverlays({ sheets: makeSheets({ about: true, close, open }) });
    fireEvent.click(screen.getByText('about-open-schema'));
    expect(close).toHaveBeenCalledWith('about');
    expect(open).toHaveBeenCalledWith('schemaInfo');
  });

  it('ChildhoodWheelSheet: openSchemas переключает шиты, onSaved пробрасывает оценки', () => {
    const close = vi.fn();
    const open = vi.fn();
    const setChildhoodRatings = vi.fn();
    renderOverlays({
      sheets: makeSheets({ childhoodWheel: true, close, open }),
      setChildhoodRatings,
    });
    fireEvent.click(screen.getByText('wheel-open-schemas'));
    expect(close).toHaveBeenCalledWith('childhoodWheel');
    expect(open).toHaveBeenCalledWith('schemaInfo');
    fireEvent.click(screen.getByText('wheel-saved'));
    expect(setChildhoodRatings).toHaveBeenCalledWith({ attachment: 7 });
  });

  it('PairSheet: close перезагружает пару через api.getPair', async () => {
    const close = vi.fn();
    const setPairData = vi.fn();
    renderOverlays({
      sheets: makeSheets({ pairSheet: true, close }),
      setPairData,
    });
    fireEvent.click(screen.getByText('pair-close'));
    expect(close).toHaveBeenCalledWith('pairSheet');
    await waitFor(() => expect(setPairData).toHaveBeenCalledWith({ id: 1 }));
    expect(api.getPair).toHaveBeenCalled();
  });

  it('SchemaInfoSheet: close сбрасывает autoStartTest/highlight', () => {
    const close = vi.fn();
    renderOverlays({ sheets: makeSheets({ schemaInfo: true, close }) });
    fireEvent.click(screen.getByText('schema-info-close'));
    expect(close).toHaveBeenCalledWith('schemaInfo', {
      schemaAutoStartTest: false,
      schemaHighlight: undefined,
    });
  });
});
