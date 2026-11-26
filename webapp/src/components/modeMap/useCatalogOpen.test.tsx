// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCatalogOpen } from './useCatalogOpen';

beforeEach(() => localStorage.clear());

describe('useCatalogOpen — каталог «Все режимы и схемы»', () => {
  it('по умолчанию закрыт; раскрытие запоминается на устройстве', () => {
    const { result } = renderHook(() => useCatalogOpen(false));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem('modemap_catalog')).toBe('1');
    expect(renderHook(() => useCatalogOpen(false)).result.current[0]).toBe(true);
  });

  it('у клиента без концептуализации открыт, даже если терапевт закрывал его у другого клиента', () => {
    localStorage.setItem('modemap_catalog', '0');
    const { result } = renderHook(() => useCatalogOpen(true));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem('modemap_catalog')).toBe('0');
  });

  it('концептуализация догрузилась пустой — каталог раскрывается сам', () => {
    const { result, rerender } = renderHook(({ empty }) => useCatalogOpen(empty), { initialProps: { empty: false } });
    expect(result.current[0]).toBe(false);
    rerender({ empty: true });
    expect(result.current[0]).toBe(true);
  });
});
