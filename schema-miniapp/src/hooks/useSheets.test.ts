// @vitest-environment jsdom
// Тест единого реестра видимости оверлеев/шитов App.tsx (этап 3 REMEDIATION_PLAN).
// Логика — open/close reducer с мёрджем payload и мемоизацией — раньше была
// набором отдельных useState на каждый showX; здесь фиксируем инварианты,
// которые легко сломать при рефакторинге: открытие одного шита не задевает
// остальные, payload мёрджится в состояние, close сбрасывает флаг.
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSheets } from './useSheets';

describe('useSheets — open/close', () => {
  it('изначально все шиты закрыты', () => {
    const { result } = renderHook(() => useSheets());
    expect(result.current.about).toBe(false);
    expect(result.current.settings).toBe(false);
    expect(result.current.tracker).toBe(false);
  });

  it('open() открывает только указанный шит, остальные не трогает', () => {
    const { result } = renderHook(() => useSheets());
    act(() => {
      result.current.open('about');
    });
    expect(result.current.about).toBe(true);
    expect(result.current.settings).toBe(false);
    expect(result.current.tracker).toBe(false);
  });

  it('close() закрывает шит', () => {
    const { result } = renderHook(() => useSheets());
    act(() => {
      result.current.open('settings');
    });
    expect(result.current.settings).toBe(true);
    act(() => {
      result.current.close('settings');
    });
    expect(result.current.settings).toBe(false);
  });

  it('open() с payload мёрджит дополнительные поля состояния (напр. открытие схемы с вкладкой/хайлайтом)', () => {
    const { result } = renderHook(() => useSheets());
    act(() => {
      result.current.open('schemaInfo', {
        schemaInitialTab: 'modes',
        schemaHighlight: 'punitive',
        schemaAutoStartTest: true,
      });
    });
    expect(result.current.schemaInfo).toBe(true);
    expect(result.current.schemaInitialTab).toBe('modes');
    expect(result.current.schemaHighlight).toBe('punitive');
    expect(result.current.schemaAutoStartTest).toBe(true);
  });

  it('close() с payload может одновременно сбросить сопутствующее поле (напр. trackerNeedId при закрытии оверлея)', () => {
    const { result } = renderHook(() => useSheets());
    act(() => {
      result.current.open('trackerOverlay', { trackerNeedId: 'safety' });
    });
    expect(result.current.trackerOverlay).toBe(true);
    expect(result.current.trackerNeedId).toBe('safety');

    act(() => {
      result.current.close('trackerOverlay', { trackerNeedId: null });
    });
    expect(result.current.trackerOverlay).toBe(false);
    expect(result.current.trackerNeedId).toBeNull();
  });

  it('несколько независимых open() не сбрасывают друг друга', () => {
    const { result } = renderHook(() => useSheets());
    act(() => {
      result.current.open('practices');
    });
    act(() => {
      result.current.open('plans');
    });
    expect(result.current.practices).toBe(true);
    expect(result.current.plans).toBe(true);
  });

  it('open/close сохраняют идентичность функций между рендерами (стабильны для deps-массивов)', () => {
    const { result, rerender } = renderHook(() => useSheets());
    const openBefore = result.current.open;
    const closeBefore = result.current.close;
    rerender();
    expect(result.current.open).toBe(openBefore);
    expect(result.current.close).toBe(closeBefore);
  });

  it('идентичность возвращаемого объекта не меняется без реального open/close (мемоизация)', () => {
    const { result, rerender } = renderHook(() => useSheets());
    const before = result.current;
    rerender();
    expect(result.current).toBe(before);
  });
});
