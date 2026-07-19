// @vitest-environment jsdom
// Бутстрап тестов miniapp (TEST_COVERAGE_PLAN.md, этап 2 п.9): аналог
// webapp-хука useHistorySheet — задокументированный в CLAUDE.md класс багов
// «кнопка Назад уводит из приложения». Здесь Назад — Telegram BackButton,
// а не браузерная история, но инвариант тот же: одно нажатие обязано
// закрыть ровно верхний по приоритету открытый оверлей, а не два разом
// и не браузерный выход из мини-аппа.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTelegramBackButton } from './useTelegramBackButton';
import type { UseSheetsReturn } from './useSheets';

vi.mock('../api', () => ({
  api: { getPair: vi.fn() },
}));

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
    practicesOnboarding: false,
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

function makeArgs(
  overrides: Partial<Parameters<typeof useTelegramBackButton>[0]> = {},
) {
  return {
    sheets: makeSheets(),
    newDiaryEntry: null,
    setNewDiaryEntry: vi.fn(),
    therapistMode: false,
    cabinetView: 'list' as const,
    therapistBackHandlerRef: { current: vi.fn() },
    setPairData: vi.fn(),
    ...overrides,
  };
}

// Достаём хендлер, который тест-хук зарегистрировал через bb.onClick(fn).
function registeredHandler(bb: ReturnType<typeof makeBackButton>): () => void {
  const call = bb.onClick.mock.calls[0] as [() => void] | undefined;
  if (!call) throw new Error('bb.onClick не был вызван');
  return call[0];
}

// window.Telegram типизирован в telegram.d.ts обычными функциями (не Mock) —
// достаём мок обратно приведением типа один раз, чтобы не кастовать в каждом тесте.
function getBB() {
  return window.Telegram!.WebApp.BackButton as unknown as ReturnType<
    typeof makeBackButton
  >;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.Telegram = {
    WebApp: { BackButton: makeBackButton() },
  } as unknown as Window['Telegram'];
  mockApi.getPair.mockResolvedValue({});
});

describe('useTelegramBackButton — без window.Telegram (не в мини-аппе)', () => {
  it('не падает, если window.Telegram отсутствует', () => {
    window.Telegram = undefined;
    expect(() =>
      renderHook(() => useTelegramBackButton(makeArgs())),
    ).not.toThrow();
  });
});

describe('useTelegramBackButton — видимость кнопки', () => {
  it('ни один оверлей не открыт -> BackButton скрыт', () => {
    renderHook(() => useTelegramBackButton(makeArgs()));
    const bb = getBB();
    expect(bb.hide).toHaveBeenCalled();
    expect(bb.show).not.toHaveBeenCalled();
  });

  it('открыт settings -> BackButton показан', () => {
    renderHook(() =>
      useTelegramBackButton(
        makeArgs({ sheets: makeSheets({ settings: true }) }),
      ),
    );
    const bb = getBB();
    expect(bb.show).toHaveBeenCalled();
  });

  it('открыт newDiaryEntry -> BackButton показан', () => {
    renderHook(() =>
      useTelegramBackButton(makeArgs({ newDiaryEntry: 'gratitude' })),
    );
    const bb = getBB();
    expect(bb.show).toHaveBeenCalled();
  });

  it('therapistMode + cabinetView=client без открытых оверлеев -> BackButton показан', () => {
    renderHook(() =>
      useTelegramBackButton(
        makeArgs({ therapistMode: true, cabinetView: 'client' }),
      ),
    );
    const bb = getBB();
    expect(bb.show).toHaveBeenCalled();
  });

  it('therapistMode=true, но cabinetView=list -> BackButton скрыт (условие составное)', () => {
    renderHook(() =>
      useTelegramBackButton(
        makeArgs({ therapistMode: true, cabinetView: 'list' }),
      ),
    );
    const bb = getBB();
    expect(bb.hide).toHaveBeenCalled();
    expect(bb.show).not.toHaveBeenCalled();
  });
});

describe('useTelegramBackButton — нажатие Назад закрывает верхний оверлей', () => {
  it('ничего не открыто -> нажатие Назад не вызывает никаких колбэков', () => {
    const args = makeArgs();
    renderHook(() => useTelegramBackButton(args));
    const bb = getBB();
    registeredHandler(bb)();
    expect(args.sheets.close).not.toHaveBeenCalled();
    expect(args.setNewDiaryEntry).not.toHaveBeenCalled();
  });

  it('открыт settings -> Назад закрывает settings через sheets.close', () => {
    const args = makeArgs({ sheets: makeSheets({ settings: true }) });
    renderHook(() => useTelegramBackButton(args));
    const bb = getBB();
    registeredHandler(bb)();
    expect(args.sheets.close).toHaveBeenCalledWith('settings');
  });

  it('открыт tracker -> Назад закрывает его и возвращает trackerTab на today', () => {
    const args = makeArgs({
      sheets: makeSheets({ tracker: true, trackerTab: 'history' }),
    });
    renderHook(() => useTelegramBackButton(args));
    const bb = getBB();
    registeredHandler(bb)();
    expect(args.sheets.close).toHaveBeenCalledWith('tracker', {
      trackerTab: 'today',
    });
  });

  it('открыт pairSheet -> Назад закрывает его и перезапрашивает пару через api.getPair', async () => {
    const args = makeArgs({ sheets: makeSheets({ pairSheet: true }) });
    renderHook(() => useTelegramBackButton(args));
    const bb = getBB();
    registeredHandler(bb)();
    expect(args.sheets.close).toHaveBeenCalledWith('pairSheet');
    expect(mockApi.getPair).toHaveBeenCalled();
    await vi.waitFor(() => expect(args.setPairData).toHaveBeenCalled());
  });

  it('newDiaryEntry открыт -> Назад сбрасывает его через setNewDiaryEntry(null), не трогая sheets', () => {
    const args = makeArgs({
      newDiaryEntry: 'schema',
      sheets: makeSheets({ settings: true }), // одновременно открыт другой оверлей
    });
    renderHook(() => useTelegramBackButton(args));
    const bb = getBB();
    registeredHandler(bb)();
    expect(args.setNewDiaryEntry).toHaveBeenCalledWith(null);
    expect(args.sheets.close).not.toHaveBeenCalled();
  });

  it('несколько оверлеев разом -> Назад закрывает только более приоритетный (trackerOverlay раньше tracker)', () => {
    const args = makeArgs({
      sheets: makeSheets({
        trackerOverlay: true,
        tracker: true,
        trackerNeedId: 'safety',
      }),
    });
    renderHook(() => useTelegramBackButton(args));
    const bb = getBB();
    registeredHandler(bb)();
    expect(args.sheets.close).toHaveBeenCalledWith('trackerOverlay', {
      trackerNeedId: null,
    });
    expect(args.sheets.close).toHaveBeenCalledTimes(1);
  });

  it('therapistMode/cabinetView=client как крайний приоритет -> вызывает therapistBackHandlerRef.current()', () => {
    const args = makeArgs({ therapistMode: true, cabinetView: 'client' });
    renderHook(() => useTelegramBackButton(args));
    const bb = getBB();
    registeredHandler(bb)();
    expect(args.therapistBackHandlerRef.current).toHaveBeenCalled();
    expect(args.sheets.close).not.toHaveBeenCalled();
  });
});

describe('useTelegramBackButton — регистрация обработчика Назад', () => {
  it('onClick регистрируется один раз на монтировании и не перерегистрируется при смене sheets', () => {
    const args = makeArgs();
    const { rerender } = renderHook((props) => useTelegramBackButton(props), {
      initialProps: args,
    });
    const bb = getBB();
    expect(bb.onClick).toHaveBeenCalledTimes(1);

    rerender({ ...args, sheets: makeSheets({ settings: true }) });
    expect(bb.onClick).toHaveBeenCalledTimes(1);
    expect(bb.offClick).not.toHaveBeenCalled();
  });

  it('приоритет пересчитывается на лету без перерегистрации: тот же handler теперь закрывает settings', () => {
    const args = makeArgs();
    const { rerender } = renderHook((props) => useTelegramBackButton(props), {
      initialProps: args,
    });
    const bb = getBB();
    const handlerBefore = registeredHandler(bb);

    const argsWithSettings = {
      ...args,
      sheets: makeSheets({ settings: true }),
    };
    rerender(argsWithSettings);

    // Тот же зарегистрированный колбэк — просто ref внутри хука обновился.
    expect(registeredHandler(bb)).toBe(handlerBefore);
    handlerBefore();
    expect(argsWithSettings.sheets.close).toHaveBeenCalledWith('settings');
  });

  it('unmount отписывает обработчик через offClick с той же функцией, что была передана в onClick', () => {
    const { unmount } = renderHook(() => useTelegramBackButton(makeArgs()));
    const bb = getBB();
    const handler = registeredHandler(bb);

    unmount();

    expect(bb.offClick).toHaveBeenCalledTimes(1);
    expect(bb.offClick).toHaveBeenCalledWith(handler);
  });
});
