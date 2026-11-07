// @vitest-environment jsdom
// Свёрнутое боковое меню: один ключ localStorage (удобство устройства), все читатели
// (меню, силуэт загрузки) узнают о переключении сразу, соседняя вкладка — из storage,
// без хранилища переключатель всё равно работает.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { SIDEBAR_COLLAPSED_KEY, readSidebarCollapsed, setSidebarCollapsed, useSidebarCollapsed } from './sidebarCollapse';

afterEach(() => { cleanup(); setSidebarCollapsed(false); localStorage.clear(); vi.restoreAllMocks(); });

describe('sidebarCollapse', () => {
  it('по умолчанию развёрнуто; свернуть — ключ "1", развернуть — ключа нет', () => {
    expect(readSidebarCollapsed()).toBe(false);
    setSidebarCollapsed(true);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('1');
    expect(readSidebarCollapsed()).toBe(true);
    setSidebarCollapsed(false);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBeNull();
    expect(readSidebarCollapsed()).toBe(false);
  });

  it('после перезагрузки свёрнуто с первого кадра (модуль читает хранилище заново)', async () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1');
    vi.resetModules();
    const fresh = await import('./sidebarCollapse');
    expect(renderHook(() => fresh.useSidebarCollapsed()).result.current).toBe(true);
  });

  it('переключение сразу видят все читатели — меню и силуэт загрузки не расходятся', () => {
    const menu = renderHook(() => useSidebarCollapsed());
    const skeleton = renderHook(() => useSidebarCollapsed());
    act(() => setSidebarCollapsed(true));
    expect([menu.result.current, skeleton.result.current]).toEqual([true, true]);
    act(() => setSidebarCollapsed(false));
    expect([menu.result.current, skeleton.result.current]).toEqual([false, false]);
  });

  it('свернули в соседней вкладке — доходит через storage; чужой ключ хук не трогает', () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1'); // так выглядит запись из другой вкладки
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'app_theme' })); });
    expect(result.current).toBe(false);
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: SIDEBAR_COLLAPSED_KEY })); });
    expect(result.current).toBe(true);
  });

  it('хранилище недоступно (приватный режим) — не падает, переключатель работает до перезагрузки', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(() => act(() => setSidebarCollapsed(true))).not.toThrow();
    expect(result.current).toBe(true);
  });
});
