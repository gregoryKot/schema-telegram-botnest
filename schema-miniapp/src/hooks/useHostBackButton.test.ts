// @vitest-environment jsdom
// Бутстрап тестов miniapp (TEST_COVERAGE_PLAN.md, этап 2 п.9): аналог
// webapp-хука useHistorySheet — задокументированный в CLAUDE.md класс багов
// «кнопка Назад уводит из приложения». В хосте с своей кнопкой (Telegram/
// MAX) это BackButton, в браузере (MULTI_HOST_PLAN.md, шаг 2) — история
// браузера: инвариант тот же — одно нажатие обязано закрыть ровно верхний по
// приоритету открытый оверлей, а не два разом и не увести из приложения.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHostBackButton } from './useHostBackButton';
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
  overrides: Partial<Parameters<typeof useHostBackButton>[0]> = {},
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

describe('useHostBackButton — хост с собственной кнопкой (Telegram)', () => {
  it('не падает, если window.Telegram отсутствует (браузер без своей кнопки)', () => {
    window.Telegram = undefined;
    expect(() => renderHook(() => useHostBackButton(makeArgs()))).not.toThrow();
  });

  it('ни один оверлей не открыт -> BackButton скрыт', () => {
    renderHook(() => useHostBackButton(makeArgs()));
    const bb = getBB();
    expect(bb.hide).toHaveBeenCalled();
    expect(bb.show).not.toHaveBeenCalled();
  });

  it('открыт settings -> BackButton показан', () => {
    renderHook(() =>
      useHostBackButton(makeArgs({ sheets: makeSheets({ settings: true }) })),
    );
    const bb = getBB();
    expect(bb.show).toHaveBeenCalled();
  });

  it('открыт newDiaryEntry -> BackButton показан', () => {
    renderHook(() =>
      useHostBackButton(makeArgs({ newDiaryEntry: 'gratitude' })),
    );
    const bb = getBB();
    expect(bb.show).toHaveBeenCalled();
  });

  it('therapistMode + cabinetView=client без открытых оверлеев -> BackButton показан', () => {
    renderHook(() =>
      useHostBackButton(
        makeArgs({ therapistMode: true, cabinetView: 'client' }),
      ),
    );
    const bb = getBB();
    expect(bb.show).toHaveBeenCalled();
  });

  it('therapistMode=true, но cabinetView=list -> BackButton скрыт (условие составное)', () => {
    renderHook(() =>
      useHostBackButton(makeArgs({ therapistMode: true, cabinetView: 'list' })),
    );
    const bb = getBB();
    expect(bb.hide).toHaveBeenCalled();
    expect(bb.show).not.toHaveBeenCalled();
  });

  it('ничего не открыто -> нажатие Назад не вызывает никаких колбэков', () => {
    const args = makeArgs();
    renderHook(() => useHostBackButton(args));
    const bb = getBB();
    registeredHandler(bb)();
    expect(args.sheets.close).not.toHaveBeenCalled();
    expect(args.setNewDiaryEntry).not.toHaveBeenCalled();
  });

  it('открыт settings -> Назад закрывает settings через sheets.close', () => {
    const args = makeArgs({ sheets: makeSheets({ settings: true }) });
    renderHook(() => useHostBackButton(args));
    const bb = getBB();
    registeredHandler(bb)();
    expect(args.sheets.close).toHaveBeenCalledWith('settings');
  });

  it('открыт tracker -> Назад закрывает его и возвращает trackerTab на today', () => {
    const args = makeArgs({
      sheets: makeSheets({ tracker: true, trackerTab: 'history' }),
    });
    renderHook(() => useHostBackButton(args));
    const bb = getBB();
    registeredHandler(bb)();
    expect(args.sheets.close).toHaveBeenCalledWith('tracker', {
      trackerTab: 'today',
    });
  });

  it('открыт pairSheet -> Назад закрывает его и перезапрашивает пару через api.getPair', async () => {
    const args = makeArgs({ sheets: makeSheets({ pairSheet: true }) });
    renderHook(() => useHostBackButton(args));
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
    renderHook(() => useHostBackButton(args));
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
    renderHook(() => useHostBackButton(args));
    const bb = getBB();
    registeredHandler(bb)();
    expect(args.sheets.close).toHaveBeenCalledWith('trackerOverlay', {
      trackerNeedId: null,
    });
    expect(args.sheets.close).toHaveBeenCalledTimes(1);
  });

  it('therapistMode/cabinetView=client как крайний приоритет -> вызывает therapistBackHandlerRef.current()', () => {
    const args = makeArgs({ therapistMode: true, cabinetView: 'client' });
    renderHook(() => useHostBackButton(args));
    const bb = getBB();
    registeredHandler(bb)();
    expect(args.therapistBackHandlerRef.current).toHaveBeenCalled();
    expect(args.sheets.close).not.toHaveBeenCalled();
  });

  it('onClick регистрируется один раз на монтировании и не перерегистрируется при смене sheets', () => {
    const args = makeArgs();
    const { rerender } = renderHook((props) => useHostBackButton(props), {
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
    const { rerender } = renderHook((props) => useHostBackButton(props), {
      initialProps: args,
    });
    const bb = getBB();
    const handlerBefore = registeredHandler(bb);

    const argsWithSettings = {
      ...args,
      sheets: makeSheets({ settings: true }),
    };
    rerender(argsWithSettings);

    expect(registeredHandler(bb)).toBe(handlerBefore);
    handlerBefore();
    expect(argsWithSettings.sheets.close).toHaveBeenCalledWith('settings');
  });

  it('unmount отписывает обработчик через offClick с той же функцией, что была передана в onClick', () => {
    const { unmount } = renderHook(() => useHostBackButton(makeArgs()));
    const bb = getBB();
    const handler = registeredHandler(bb);

    unmount();

    expect(bb.offClick).toHaveBeenCalledTimes(1);
    expect(bb.offClick).toHaveBeenCalledWith(handler);
  });
});

describe('useHostBackButton — хост без своей кнопки (браузер): история', () => {
  beforeEach(() => {
    window.Telegram = undefined;
  });

  it('открытие оверлея заводит запись истории (pushState)', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const { rerender } = renderHook((props) => useHostBackButton(props), {
      initialProps: makeArgs(),
    });
    expect(pushSpy).not.toHaveBeenCalled();

    rerender(makeArgs({ sheets: makeSheets({ settings: true }) }));
    expect(pushSpy).toHaveBeenCalledTimes(1);
    pushSpy.mockRestore();
  });

  it('popstate (нажатие «Назад» браузера) закрывает открытый лист', () => {
    const args = makeArgs({ sheets: makeSheets({ settings: true }) });
    renderHook((props) => useHostBackButton(props), { initialProps: args });

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(args.sheets.close).toHaveBeenCalledWith('settings');
  });

  it('закрытие не через «Назад» (крестиком) подчищает историю через history.back()', () => {
    const backSpy = vi
      .spyOn(window.history, 'back')
      .mockImplementation(() => {});
    const { rerender } = renderHook((props) => useHostBackButton(props), {
      initialProps: makeArgs({ sheets: makeSheets({ settings: true }) }),
    });

    rerender(makeArgs({ sheets: makeSheets({ settings: false }) }));

    expect(backSpy).toHaveBeenCalledTimes(1);
    backSpy.mockRestore();
  });

  it('закрытие ЧЕРЕЗ popstate не вызывает повторный history.back() (нет лишней записи)', () => {
    const backSpy = vi
      .spyOn(window.history, 'back')
      .mockImplementation(() => {});
    const args = makeArgs({ sheets: makeSheets({ settings: true }) });
    const { rerender } = renderHook((props) => useHostBackButton(props), {
      initialProps: args,
    });

    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(args.sheets.close).toHaveBeenCalledWith('settings');
    // Родитель убирает лист из дерева (как sheets.close реально делает) — имитируем.
    rerender(makeArgs({ sheets: makeSheets({ settings: false }) }));

    expect(backSpy).not.toHaveBeenCalled();
    backSpy.mockRestore();
  });

  // Регрессия: наш собственный history.back() в НАСТОЯЩЕМ браузере тоже
  // стреляет popstate — раньше тесты мокали back() пустышкой, и это скрывало
  // рассинхрон флага. Симптом у пользователя: открыл-закрыл крестиком дважды,
  // и одно нажатие «Назад» уходит впустую (лишняя запись в истории).
  it('крестик → открыть снова → «Назад» закрывает лист, а не тратится впустую', () => {
    // back() как в жизни: снимает запись и синхронно шлёт popstate.
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const { rerender } = renderHook((props) => useHostBackButton(props), {
      initialProps: makeArgs(),
    });

    // Цикл 1: открыли и закрыли крестиком — свою запись убрали.
    rerender(makeArgs({ sheets: makeSheets({ settings: true }) }));
    rerender(makeArgs({ sheets: makeSheets({ settings: false }) }));
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(backSpy).toHaveBeenCalledTimes(1);

    // Цикл 2: то же самое ещё раз. Каждому pushState обязан отвечать свой
    // back() — иначе запись остаётся висеть. Именно здесь ломалась старая
    // версия: popstate от НАШЕГО же back() выставлял флаг «ушли через Назад»,
    // и второй крестик уборку пропускал.
    rerender(makeArgs({ sheets: makeSheets({ settings: true }) }));
    rerender(makeArgs({ sheets: makeSheets({ settings: false }) }));
    expect(pushSpy).toHaveBeenCalledTimes(2);
    expect(backSpy).toHaveBeenCalledTimes(2);

    // Лишних записей не осталось → «Назад» не тратится вхолостую.
    const args = makeArgs({ sheets: makeSheets({ settings: true }) });
    rerender(args);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(args.sheets.close).toHaveBeenCalledWith('settings');
    // Через «Назад» запись снял браузер — второй раз её снимать не надо.
    rerender(makeArgs({ sheets: makeSheets({ settings: false }) }));
    expect(backSpy).toHaveBeenCalledTimes(2);

    backSpy.mockRestore();
    pushSpy.mockRestore();
  });

  it('в MAX (нет window.Telegram, но есть window.WebApp) история не трогается — своя кнопка есть', () => {
    (globalThis as { WebApp?: unknown }).WebApp = {
      initData: 'a=b',
      BackButton: makeBackButton(),
    };
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const { rerender } = renderHook((props) => useHostBackButton(props), {
      initialProps: makeArgs(),
    });
    rerender(makeArgs({ sheets: makeSheets({ settings: true }) }));

    expect(pushSpy).not.toHaveBeenCalled();
    pushSpy.mockRestore();
    delete (globalThis as { WebApp?: unknown }).WebApp;
  });
});
