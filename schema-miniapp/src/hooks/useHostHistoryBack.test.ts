// @vitest-environment jsdom
// Web-хост мини-аппа (своей кнопки «Назад» нет, её роль играет история
// браузера) и локальные слои «Назад» (находка ревью 2026-10). Запись истории
// была одна на «есть что закрывать»: чек-ин поверх справочника схем первое
// «Назад» закрывало, запись снималась, а второе уходило со страницы при
// открытом справочнике. Теперь каждая ступень — лист и каждый слой над ним —
// держит свою запись.
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useHostBackButton } from './useHostBackButton';
import { pushBackLayer } from './backLayers';
import { initialState, type UseSheetsReturn } from './useSheets';

vi.mock('../api', () => ({ api: { getPair: vi.fn() } }));

function sheetsWith(open: boolean): UseSheetsReturn {
  return {
    ...initialState,
    schemaInfo: open,
    openOrder: open ? ['schemaInfo'] : [],
    open: vi.fn(),
    close: vi.fn(),
  };
}

function args(sheets: UseSheetsReturn) {
  return {
    sheets,
    newDiaryEntry: null,
    setNewDiaryEntry: vi.fn(),
    therapistMode: false,
    cabinetView: 'list' as const,
    therapistBackHandlerRef: { current: vi.fn() },
    setPairData: vi.fn(),
    childhoodWheelPending: false,
    setChildhoodWheelPending: vi.fn(),
    onAddressPickerDone: vi.fn(),
  };
}

const popstate = () =>
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

let pushSpy: ReturnType<typeof vi.spyOn>;
let backSpy: ReturnType<typeof vi.spyOn>;
let goSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  window.Telegram = undefined;
  pushSpy = vi.spyOn(window.history, 'pushState');
  // back()/go() как в жизни: снимают записи и шлют popstate.
  backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  goSpy = vi.spyOn(window.history, 'go').mockImplementation(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
});
afterEach(() => vi.restoreAllMocks());

it('слой поверх листа заводит свою запись: «Назад» закрывает слой, запись листа остаётся под вторым «Назад»', () => {
  const sheets = sheetsWith(true);
  renderHook(() => useHostBackButton(args(sheets)));
  expect(pushSpy).toHaveBeenCalledTimes(1);

  const layerClose = vi.fn();
  let drop = () => {};
  act(() => {
    drop = pushBackLayer(layerClose);
  });
  expect(pushSpy).toHaveBeenCalledTimes(2);

  popstate();
  expect(layerClose).toHaveBeenCalledTimes(1);
  act(() => drop());
  // Запись слоя снял браузер — своей уборки нет, запись листа на месте.
  expect(backSpy).not.toHaveBeenCalled();
  expect(goSpy).not.toHaveBeenCalled();

  popstate();
  expect(vi.mocked(sheets.close).mock.calls[0]?.[0]).toBe('schemaInfo');
});

it('слой закрыт своей кнопкой — его запись снимаем сами, «Назад» этого не видит', () => {
  const sheets = sheetsWith(true);
  renderHook(() => useHostBackButton(args(sheets)));
  let drop = () => {};
  act(() => {
    drop = pushBackLayer(vi.fn());
  });

  act(() => drop());

  expect(backSpy).toHaveBeenCalledTimes(1);
  // popstate от нашего же back() — не нажатие пользователя: лист не закрыт.
  expect(sheets.close).not.toHaveBeenCalled();
});

it('лист закрыт крестиком вместе со слоем — обе записи снимаются одним переходом', () => {
  const { rerender } = renderHook((p) => useHostBackButton(p), {
    initialProps: args(sheetsWith(true)),
  });
  let drop = () => {};
  act(() => {
    drop = pushBackLayer(vi.fn());
  });

  const closed = args(sheetsWith(false));
  act(() => {
    drop();
    rerender(closed);
  });

  expect(goSpy).toHaveBeenCalledWith(-2);
  expect(backSpy).not.toHaveBeenCalled();
  expect(closed.sheets.close).not.toHaveBeenCalled();
});
