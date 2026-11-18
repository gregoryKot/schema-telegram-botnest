// @vitest-environment jsdom
// Запрос «открыть «Настройки» на разделе»: открывает лист, раздел забирается один раз, закрытие его сбрасывает.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { requestSettingsOpen, useSettingsOpen, useSettingsScroll } from './settingsLaunch';

const scrollIntoView = vi.fn();
function section(id: string) {
  const el = document.createElement('div');
  el.id = id;
  el.scrollIntoView = scrollIntoView;
  document.body.append(el);
}
const scrolledTo = () => scrollIntoView.mock.contexts.map((el) => (el as Element).id);

beforeEach(() => { vi.clearAllMocks(); section('s-data'); section('s-address'); });
afterEach(() => { cleanup(); document.body.replaceChildren(); });

describe('settingsLaunch', () => {
  it('запрос снаружи открывает лист; раздел забирается, когда лист готов, и только один раз', () => {
    const open = renderHook(() => useSettingsOpen());
    expect(open.result.current[0]).toBe(false);
    act(() => requestSettingsOpen('s-data'));
    expect(open.result.current[0]).toBe(true);

    const scroll = renderHook(({ ready }) => useSettingsScroll(ready), { initialProps: { ready: false } });
    expect(scrolledTo()).toEqual([]); // настройки ещё грузятся
    scroll.rerender({ ready: true });
    expect(scrolledTo()).toEqual(['s-data']);
    scroll.rerender({ ready: false });
    scroll.rerender({ ready: true });
    expect(scrolledTo()).toEqual(['s-data']);
  });

  it('лист уже открыт — запрос прокручивает сразу; запрос без раздела не прокручивает', () => {
    renderHook(() => useSettingsScroll(true));
    act(() => requestSettingsOpen('s-address'));
    act(() => requestSettingsOpen(null));
    expect(scrolledTo()).toEqual(['s-address']);
  });

  it('закрытие листа сбрасывает ожидающий раздел', () => {
    const open = renderHook(() => useSettingsOpen());
    act(() => requestSettingsOpen('s-data'));
    act(() => open.result.current[1](false));
    expect(open.result.current[0]).toBe(false);
    renderHook(() => useSettingsScroll(true));
    expect(scrolledTo()).toEqual([]);
  });

  it('оглавление листа прокручивает к разделу той же функцией', () => {
    const { result } = renderHook(() => useSettingsScroll(true));
    result.current('s-address');
    expect(scrolledTo()).toEqual(['s-address']);
  });
});
