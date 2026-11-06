// @vitest-environment jsdom
// «Показ экрана» в кабинете: один ключ localStorage, все читатели (сайдбар, «Перейти к…»)
// узнают о переключении сразу, соседняя вкладка — из события storage.
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { SCREEN_SHARE_KEY, readScreenShare, setScreenShare, useScreenShare } from './screenShareMode';

afterEach(() => { cleanup(); localStorage.clear(); });

describe('screenShareMode', () => {
  it('по умолчанию выключен; включение пишет ключ, выключение удаляет его', () => {
    expect(readScreenShare()).toBe(false);
    setScreenShare(true);
    expect(localStorage.getItem(SCREEN_SHARE_KEY)).toBe('1');
    expect(readScreenShare()).toBe(true);
    setScreenShare(false);
    expect(localStorage.getItem(SCREEN_SHARE_KEY)).toBeNull();
    expect(readScreenShare()).toBe(false);
  });

  it('после перезагрузки режим включён с первого кадра', () => {
    localStorage.setItem(SCREEN_SHARE_KEY, '1');
    expect(renderHook(() => useScreenShare()).result.current).toBe(true);
  });

  it('переключение сразу видят все читатели — сайдбар и палитра не расходятся', () => {
    const sidebar = renderHook(() => useScreenShare());
    const palette = renderHook(() => useScreenShare());
    act(() => setScreenShare(true));
    expect([sidebar.result.current, palette.result.current]).toEqual([true, true]);
    act(() => setScreenShare(false));
    expect([sidebar.result.current, palette.result.current]).toEqual([false, false]);
  });

  it('включение в соседней вкладке доходит через storage; событие чужого ключа хук не трогает', () => {
    const { result } = renderHook(() => useScreenShare());
    localStorage.setItem(SCREEN_SHARE_KEY, '1'); // так выглядит запись из другой вкладки
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'app_theme' })); });
    expect(result.current).toBe(false);
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: SCREEN_SHARE_KEY })); });
    expect(result.current).toBe(true);
  });
});
