// @vitest-environment jsdom
// «Назад» хоста и реестр оверлеев (аудит 2026-10, frontends#8). Четыре листа
// (addressPicker, caseFlow, selfMap, trackerGoal) жили в OVERLAY_SHEET_KEYS, но
// не в ручной лесенке хука: кнопка «Назад» для них не показывалась, а поверх
// них закрывала нижний лист. Тест идёт ПО РЕЕСТРУ (правило №4): новый ключ без
// поддержки «Назад» роняет его, а не ждёт, пока заметит пользователь.
// Вложенность проверяется через настоящий useSheets: порядок открытия в проде
// создаёт редьюсер, ручная фикстура этого предусловия не воспроизводит (№14).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useHostBackButton } from './useHostBackButton';
import { ADDRESS_FORM_ASKED_KEY } from '../../../shared/src/settings/addressFormPrompt';
import { OVERLAY_SHEET_KEYS } from './anyOverlayOpen';
import type { OverlaySheetKey } from './sheetsStack';
import { initialState, useSheets, type UseSheetsReturn } from './useSheets';

vi.mock('../api', () => ({ api: { getPair: vi.fn() } }));
import { api } from '../api';
const mockApi = api as unknown as { getPair: ReturnType<typeof vi.fn> };

function makeBackButton() {
  return {
    isVisible: false,
    show: vi.fn(),
    hide: vi.fn(),
    onClick: vi.fn(),
    offClick: vi.fn(),
  };
}
const getBB = () =>
  window.Telegram!.WebApp.BackButton as unknown as ReturnType<
    typeof makeBackButton
  >;
const pressBack = () => {
  const call = getBB().onClick.mock.calls[0] as [() => void];
  act(() => call[0]());
};

const setNewDiaryEntry = vi.fn();
const therapistBackHandlerRef = { current: vi.fn() };
const setPairData = vi.fn();
const setChildhoodWheelPending = vi.fn();
const onAddressPickerDone = vi.fn();

function args(sheets: UseSheetsReturn, childhoodWheelPending = false) {
  return {
    sheets,
    newDiaryEntry: null,
    setNewDiaryEntry,
    therapistMode: false,
    cabinetView: 'list' as const,
    therapistBackHandlerRef,
    setPairData,
    childhoodWheelPending,
    setChildhoodWheelPending,
    onAddressPickerDone,
  };
}

function fixture(key: OverlaySheetKey): UseSheetsReturn {
  return {
    ...initialState,
    [key]: true,
    openOrder: [key],
    open: vi.fn(),
    close: vi.fn(),
  };
}

// useSheets + хук вместе, как в App.tsx.
function mountWithRealSheets(childhoodWheelPending = false) {
  return renderHook(() => {
    const sheets = useSheets();
    useHostBackButton(args(sheets, childhoodWheelPending));
    return sheets;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.Telegram = {
    WebApp: { platform: 'ios', BackButton: makeBackButton() },
  } as unknown as Window['Telegram'];
  mockApi.getPair.mockResolvedValue({});
});

describe('«Назад» хоста знает каждый ключ реестра оверлеев', () => {
  it.each(OVERLAY_SHEET_KEYS)(
    'Telegram: открыт %s -> кнопка показана',
    (key) => {
      renderHook(() => useHostBackButton(args(fixture(key))));
      expect(getBB().show).toHaveBeenCalled();
      expect(getBB().hide).not.toHaveBeenCalled();
    },
  );

  it.each(OVERLAY_SHEET_KEYS)(
    'Telegram: «Назад» закрывает именно %s',
    (key) => {
      const sheets = fixture(key);
      renderHook(() => useHostBackButton(args(sheets)));
      pressBack();
      expect(sheets.close).toHaveBeenCalledTimes(1);
      expect((sheets.close as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
        key,
      );
    },
  );

  it.each(OVERLAY_SHEET_KEYS)(
    'web-хост: открыт %s -> заведена запись истории',
    (key) => {
      window.Telegram = undefined;
      const pushSpy = vi.spyOn(window.history, 'pushState');
      const { rerender } = renderHook((p) => useHostBackButton(p), {
        initialProps: args({ ...fixture(key), [key]: false, openOrder: [] }),
      });
      expect(pushSpy).not.toHaveBeenCalled();
      rerender(args(fixture(key)));
      expect(pushSpy).toHaveBeenCalledTimes(1);
      pushSpy.mockRestore();
    },
  );
});

describe('«Назад» закрывает верхний лист — последний открытый', () => {
  it.each([
    ['trackerGoal', 'trackerOverlay'],
    ['todayNote', 'trackerOverlay'],
    ['schemaInfo', 'tracker'],
    ['childhoodWheel', 'tracker'],
  ] as const)(
    '%s поверх %s: закрывается верхний, нижний остаётся',
    (top, below) => {
      const { result } = mountWithRealSheets();
      act(() => result.current.open(below));
      act(() => result.current.open(top));

      pressBack();
      expect(result.current[top]).toBe(false);
      expect(result.current[below]).toBe(true);

      pressBack();
      expect(result.current[below]).toBe(false);
    },
  );

  it('повторное открытие нижнего листа переносит его наверх', () => {
    const { result } = mountWithRealSheets();
    act(() => result.current.open('tracker'));
    act(() => result.current.open('schemaInfo'));
    act(() => result.current.open('tracker'));
    pressBack();
    expect(result.current.tracker).toBe(false);
    expect(result.current.schemaInfo).toBe(true);
  });

  it.each(['addressPicker', 'joinConfirm'] as const)(
    'экран согласия %s закрывается первым, даже если лист открыт позже',
    (modal) => {
      const { result } = mountWithRealSheets();
      act(() => result.current.open(modal));
      act(() => result.current.open('trackerOverlay'));
      pressBack();
      expect(result.current[modal]).toBe(false);
      expect(result.current.trackerOverlay).toBe(true);
    },
  );

  it('Назад на последнем листе скрывает кнопку', () => {
    const { result } = mountWithRealSheets();
    act(() => result.current.open('selfMap'));
    pressBack();
    expect(result.current.selfMap).toBe(false);
    expect(getBB().hide).toHaveBeenCalled();
  });
});

// «Назад» ≡ крестик: побочные эффекты закрытия живут в одном реестре
// (overlayClosers), поэтому кнопка хоста их не теряет.
describe('«Назад» повторяет побочные эффекты крестика', () => {
  it('todayNote с отложенным колесом детства -> колесо открывается', () => {
    const { result } = mountWithRealSheets(true);
    act(() => result.current.open('todayNote'));
    pressBack();
    expect(result.current.todayNote).toBe(false);
    expect(result.current.childhoodWheel).toBe(true);
    expect(setChildhoodWheelPending).toHaveBeenCalledWith(false);
  });

  it('todayNote без отложенного колеса -> колесо не открывается', () => {
    const { result } = mountWithRealSheets(false);
    act(() => result.current.open('todayNote'));
    pressBack();
    expect(result.current.childhoodWheel).toBe(false);
    expect(setChildhoodWheelPending).not.toHaveBeenCalled();
  });

  it('schemaInfo -> сброшены подсветка схемы и автозапуск теста', () => {
    const { result } = mountWithRealSheets();
    act(() =>
      result.current.open('schemaInfo', {
        schemaHighlight: 'abandonment',
        schemaAutoStartTest: true,
      }),
    );
    pressBack();
    expect(result.current.schemaInfo).toBe(false);
    expect(result.current.schemaHighlight).toBeUndefined();
    expect(result.current.schemaAutoStartTest).toBe(false);
  });

  it('addressPicker -> путь «Позже»: вопрос отложен и онбординг продолжен', () => {
    const { result } = mountWithRealSheets();
    act(() => result.current.open('addressPicker'));
    expect(localStorage.getItem(ADDRESS_FORM_ASKED_KEY)).toBeNull();
    pressBack();
    expect(result.current.addressPicker).toBe(false);
    expect(localStorage.getItem(ADDRESS_FORM_ASKED_KEY)).not.toBeNull();
    expect(onAddressPickerDone).toHaveBeenCalledTimes(1);
  });

  it('joinConfirm -> сброшены joinKind и joinCode', () => {
    const { result } = mountWithRealSheets();
    act(() =>
      result.current.open('joinConfirm', { joinKind: 'pair', joinCode: 'X' }),
    );
    pressBack();
    expect(result.current.joinConfirm).toBe(false);
    expect(result.current.joinKind).toBeNull();
    expect(result.current.joinCode).toBeNull();
  });

  it('pairSheet -> пара перезапрошена', async () => {
    const { result } = mountWithRealSheets();
    act(() => result.current.open('pairSheet'));
    pressBack();
    expect(result.current.pairSheet).toBe(false);
    await vi.waitFor(() => expect(setPairData).toHaveBeenCalled());
  });
});
