// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  CONCEPT_GRAPH_OPEN_EVENT,
  CONCEPT_MODE_LINKED_EVENT,
} from '../../share/analytics';
import { useConceptGraphTracking } from './useConceptGraphTracking';

describe('useConceptGraphTracking', () => {
  it('имена событий в хуке совпадают с константами контракта (analytics.ts)', () => {
    const track = vi.fn();
    const { result } = renderHook(() => useConceptGraphTracking(track));
    result.current.markLinked('m');
    expect(track.mock.calls.map((c) => c[0])).toEqual([
      CONCEPT_GRAPH_OPEN_EVENT,
      CONCEPT_MODE_LINKED_EVENT,
    ]);
  });

  it('concept_graph_open — один раз на монтирование, даже при перерисовках', () => {
    const track = vi.fn();
    const { rerender } = renderHook(() => useConceptGraphTracking(track));
    rerender();
    rerender();
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(CONCEPT_GRAPH_OPEN_EVENT);
  });

  it('concept_mode_linked — один раз на режим за монтирование, без меты', () => {
    const track = vi.fn();
    const { result } = renderHook(() => useConceptGraphTracking(track));
    track.mockClear();
    result.current.markLinked('punitive_critic');
    result.current.markLinked('punitive_critic');
    result.current.markLinked('vulnerable_child');
    result.current.markLinked('punitive_critic');
    expect(track).toHaveBeenCalledTimes(2);
    for (const call of track.mock.calls) {
      expect(call).toEqual([CONCEPT_MODE_LINKED_EVENT]);
    }
  });

  it('новое монтирование считает заново', () => {
    const track = vi.fn();
    const first = renderHook(() => useConceptGraphTracking(track));
    first.result.current.markLinked('m');
    first.unmount();
    track.mockClear();
    const second = renderHook(() => useConceptGraphTracking(track));
    second.result.current.markLinked('m');
    expect(track).toHaveBeenCalledTimes(2);
  });
});
