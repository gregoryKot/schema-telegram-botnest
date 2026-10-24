// @vitest-environment jsdom
// runQuickAction — единственный вход «+» и ⌘K: трекер идёт своим флагом,
// оверлейные действия — через quickAction, инструменты (вне «плюса») игнорируются.
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useOverlays } from './useOverlays';

describe('useOverlays.runQuickAction', () => {
  it('tracker открывает оверлей трекера без выбранной потребности', () => {
    const { result } = renderHook(() => useOverlays());
    act(() => result.current.setTrackerNeedId('safety'));
    act(() => result.current.runQuickAction('tracker'));
    expect(result.current.showTrackerOverlay).toBe(true);
    expect(result.current.trackerNeedId).toBeNull();
    expect(result.current.quickAction).toBeNull();
  });

  it('оверлейное действие попадает в quickAction', () => {
    const { result } = renderHook(() => useOverlays());
    act(() => result.current.runQuickAction('diary_mode'));
    expect(result.current.quickAction).toBe('diary_mode');
    expect(result.current.showTrackerOverlay).toBe(false);
  });

  it('действие «Инструментов» ничего не открывает', () => {
    const { result } = renderHook(() => useOverlays());
    act(() => result.current.runQuickAction('belief_check'));
    expect(result.current.quickAction).toBeNull();
    expect(result.current.showTrackerOverlay).toBe(false);
  });

  it('openSchema выставляет вкладку, подсветку и автозапуск теста', () => {
    const { result } = renderHook(() => useOverlays());
    act(() => result.current.openSchema({ startTest: true, tab: 'modes', highlight: 'x' }));
    expect(result.current.showSchemaInfo).toBe(true);
    expect(result.current.schemaAutoStartTest).toBe(true);
    expect(result.current.schemaInitialTab).toBe('modes');
    expect(result.current.schemaHighlight).toBe('x');
    act(() => result.current.openSchema());
    expect(result.current.schemaInitialTab).toBe('needs');
    expect(result.current.schemaAutoStartTest).toBe(false);
  });
});
