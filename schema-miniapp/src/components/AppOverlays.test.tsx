// @vitest-environment jsdom
// AppOverlays — оркестратор оверлеев/шитов, не относящихся к главным экранам
// (0% покрытия), вынесен из App.tsx. Все дочерние шиты — самостоятельные
// компоненты со своими тестами; здесь мокаем их и проверяем ТОЛЬКО правило
// видимости (какой sheets.* флаг показывает какой оверлей) и связки колбэков
// между шитами (например: закрыл NoteSheet с childhoodWheelPending → тут же
// открылось колесо детства — цепочка, которую легко сломать при рефакторинге).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AppOverlays } from './AppOverlays';
import type { UseSheetsReturn } from '../hooks/useSheets';

vi.mock('../sections/DiarySection', () => ({
  DiarySection: (p: { onClose: () => void }) => (
    <div>
      <span>DiarySection</span>
      <button onClick={p.onClose}>close-diaries</button>
    </div>
  ),
}));
vi.mock('./TrackerOverlay', () => ({
  TrackerOverlay: (p: { onOpenHistory: () => void }) => (
    <div>
      <span>TrackerOverlay</span>
      <button onClick={p.onOpenHistory}>tracker-open-history</button>
    </div>
  ),
}));
vi.mock('./Disclaimer', () => ({ Disclaimer: () => <div>Disclaimer</div> }));
vi.mock('./SettingsSheet', () => ({
  SettingsSheet: () => <div>SettingsSheet</div>,
}));
vi.mock('./AddressFormPicker', () => ({
  AddressFormPicker: (p: { onDone: () => void }) => (
    <div>
      <span>AddressFormPicker</span>
      <button onClick={p.onDone}>address-done</button>
    </div>
  ),
}));
vi.mock('./DonateNudge', () => ({ DonateNudge: () => <div>DonateNudge</div> }));
vi.mock('./PracticesScreen', () => ({
  PracticesScreen: () => <div>PracticesScreen</div>,
}));
vi.mock('./PlansScreen', () => ({ PlansScreen: () => <div>PlansScreen</div> }));
vi.mock('./Celebration', () => ({
  Celebration: (p: { onDone: () => void }) => (
    <div>
      <span>Celebration</span>
      <button onClick={p.onDone}>celebration-done</button>
    </div>
  ),
}));
vi.mock('./NoteSheet', () => ({
  NoteSheet: (p: { onClose: () => void }) => (
    <div>
      <span>NoteSheet</span>
      <button onClick={p.onClose}>note-close</button>
    </div>
  ),
}));
vi.mock('./SchemaInfoSheet', () => ({
  SchemaInfoSheet: () => <div>SchemaInfoSheet</div>,
}));
vi.mock('./PairSheet', () => ({ PairSheet: () => <div>PairSheet</div> }));
vi.mock('./ChildhoodWheelSheet', () => ({
  ChildhoodWheelSheet: () => <div>ChildhoodWheelSheet</div>,
}));
vi.mock('./TaskCreateSheet', () => ({
  TaskCreateSheet: () => <div>TaskCreateSheet</div>,
}));
vi.mock('./AboutSheet', () => ({ AboutSheet: () => <div>AboutSheet</div> }));
vi.mock('../api', () => ({ api: { getPair: vi.fn().mockResolvedValue({}) } }));

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

describe('AppOverlays — видимость по sheets.*', () => {
  it.each([
    ['trackerOverlay', 'TrackerOverlay'],
    ['diaries', 'DiarySection'],
    ['trackerGoal', 'TaskCreateSheet'],
    ['childhoodWheel', 'ChildhoodWheelSheet'],
    ['pairSheet', 'PairSheet'],
    ['about', 'AboutSheet'],
    ['settings', 'SettingsSheet'],
    ['addressPicker', 'AddressFormPicker'],
    ['practices', 'PracticesScreen'],
    ['plans', 'PlansScreen'],
    ['schemaInfo', 'SchemaInfoSheet'],
    ['todayNote', 'NoteSheet'],
  ] as const)('sheets.%s=true показывает %s', (flag, label) => {
    render(
      <AppOverlays {...baseProps({ sheets: makeSheets({ [flag]: true }) })} />,
    );
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('ничего не открыто — ни один шит не рендерится (кроме постоянного DonateNudge)', () => {
    render(<AppOverlays {...baseProps()} />);
    expect(screen.getByText('DonateNudge')).toBeTruthy();
    expect(screen.queryByText('TrackerOverlay')).toBeNull();
    expect(screen.queryByText('SettingsSheet')).toBeNull();
  });

  it('celebrationStreak != null — показывает Celebration', () => {
    render(<AppOverlays {...baseProps({ celebrationStreak: 4 })} />);
    expect(screen.getByText('Celebration')).toBeTruthy();
  });
});

describe('AppOverlays — цепочки колбэков между шитами', () => {
  it('Celebration.onDone сбрасывает стрик и открывает заметку дня', () => {
    const setCelebrationStreak = vi.fn();
    const open = vi.fn();
    render(
      <AppOverlays
        {...baseProps({
          celebrationStreak: 4,
          setCelebrationStreak,
          sheets: makeSheets({ open }),
        })}
      />,
    );
    fireEvent.click(screen.getByText('celebration-done'));
    expect(setCelebrationStreak).toHaveBeenCalledWith(null);
    expect(open).toHaveBeenCalledWith('todayNote');
  });

  it('NoteSheet.onClose с childhoodWheelPending=true — открывает колесо детства', () => {
    const setChildhoodWheelPending = vi.fn();
    const open = vi.fn();
    render(
      <AppOverlays
        {...baseProps({
          childhoodWheelPending: true,
          setChildhoodWheelPending,
          sheets: makeSheets({ todayNote: true, open }),
        })}
      />,
    );
    fireEvent.click(screen.getByText('note-close'));
    expect(setChildhoodWheelPending).toHaveBeenCalledWith(false);
    expect(open).toHaveBeenCalledWith('childhoodWheel');
  });

  it('NoteSheet.onClose без childhoodWheelPending — колесо детства не открывается', () => {
    const open = vi.fn();
    render(
      <AppOverlays
        {...baseProps({
          childhoodWheelPending: false,
          sheets: makeSheets({ todayNote: true, open }),
        })}
      />,
    );
    fireEvent.click(screen.getByText('note-close'));
    expect(open).not.toHaveBeenCalledWith('childhoodWheel');
  });

  it('TrackerOverlay.onOpenHistory закрывает трекер и открывает историю', () => {
    const close = vi.fn();
    const open = vi.fn();
    render(
      <AppOverlays
        {...baseProps({
          sheets: makeSheets({ trackerOverlay: true, close, open }),
        })}
      />,
    );
    fireEvent.click(screen.getByText('tracker-open-history'));
    expect(close).toHaveBeenCalledWith('trackerOverlay', {
      trackerNeedId: null,
    });
    expect(open).toHaveBeenCalledWith('tracker', { trackerTab: 'history' });
  });

  it('AddressFormPicker.onDone помечает addr_form_asked и зовёт onAddressPickerDone', () => {
    sessionStorage.clear();
    const onAddressPickerDone = vi.fn();
    const close = vi.fn();
    render(
      <AppOverlays
        {...baseProps({
          sheets: makeSheets({ addressPicker: true, close }),
          onAddressPickerDone,
        })}
      />,
    );
    fireEvent.click(screen.getByText('address-done'));
    // Метка — время в localStorage: переживает вкладку (регресс 2026-08-21)
    expect(Number(localStorage.getItem('addr_form_asked'))).toBeGreaterThan(0);
    expect(close).toHaveBeenCalledWith('addressPicker');
    expect(onAddressPickerDone).toHaveBeenCalled();
  });
});
