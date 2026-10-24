// @vitest-environment jsdom
// Общее состояние меню «плюс»: скрытие и порядок читаются из тех же ключей
// localStorage, что и у настройки мини-аппа (настройка не теряется при
// переезде на сайт), и сразу отражаются в видимых группах (read-after-write).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePlusMenuState } from './usePlusMenuState';
import { PLUS_ACTIONS_HIDDEN_KEY } from './quickActionPrefs';
import { PLUS_ACTIONS_ORDER_KEY } from './quickActionOrder';

const tr = (ty: string) => ty;
const ids = (r: ReturnType<typeof usePlusMenuState>) =>
  r.visibleGroups.flatMap((g) => g.actions.map((a) => a.id));

beforeEach(() => localStorage.clear());

describe('usePlusMenuState', () => {
  it('по умолчанию видны все пункты «плюса» в порядке реестра', () => {
    const { result } = renderHook(() => usePlusMenuState(tr));
    expect(ids(result.current)).toEqual([
      'case',
      'diary_schema',
      'diary_mode',
      'diary_gratitude',
      'tracker',
      'breathing',
      'grounding',
      'stop',
    ]);
  });

  it('читает скрытые пункты, записанные мини-аппом, и убирает опустевшую группу', () => {
    localStorage.setItem(PLUS_ACTIONS_HIDDEN_KEY, '["case","tracker"]');
    const { result } = renderHook(() => usePlusMenuState(tr));
    expect(ids(result.current)).not.toContain('case');
    expect(result.current.visibleGroups.map((g) => g.id)).toEqual([
      'capture',
      'calm',
    ]);
    // скрытые остаются в orderedGroups: лист настройки показывает всё
    expect(result.current.orderedGroups.flatMap((g) => g.actions)).toHaveLength(
      8,
    );
  });

  it('читает порядок внутри группы', () => {
    localStorage.setItem(PLUS_ACTIONS_ORDER_KEY, '["stop","breathing"]');
    const { result } = renderHook(() => usePlusMenuState(tr));
    const calm = result.current.visibleGroups.find((g) => g.id === 'calm')!;
    expect(calm.actions.map((a) => a.id)).toEqual([
      'stop',
      'breathing',
      'grounding',
    ]);
  });

  it('toggle скрывает пункт сразу и зовёт onChanged', () => {
    const onChanged = vi.fn();
    const { result } = renderHook(() => usePlusMenuState(tr, onChanged));
    act(() => result.current.toggle('stop', true));
    expect(ids(result.current)).not.toContain('stop');
    expect(localStorage.getItem(PLUS_ACTIONS_HIDDEN_KEY)).toBe('["stop"]');
    expect(onChanged).toHaveBeenCalled();
  });

  it('подпись трекера идёт по форме обращения', () => {
    const vy = (_ty: string, v: string) => v;
    const { result } = renderHook(() => usePlusMenuState(vy));
    const tracker = result.current.visibleGroups
      .flatMap((g) => g.actions)
      .find((a) => a.id === 'tracker')!;
    expect(tracker.sub).toBe('Оцените день по пяти шкалам');
  });
});
