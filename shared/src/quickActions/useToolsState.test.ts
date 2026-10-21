// @vitest-environment jsdom
// «Инструменты»: скрытие и порядок пишутся в ключи поверхности 'tools',
// каждая запись зовёт onChanged (мини-апп/сайт шлют настройки на сервер),
// а следующий рендер видит записанное (read-after-write).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useToolsState } from './useToolsState';
import { TOOLS_ACTIONS_HIDDEN_KEY } from './quickActionPrefs';
import { TOOLS_ACTIONS_ORDER_KEY } from './quickActionOrder';

const PROPS = {
  tasksCount: 2,
  practiceCount: null,
  planCount: null,
  childhoodDone: false,
};

beforeEach(() => localStorage.clear());

describe('useToolsState', () => {
  it('без настроек: десять пунктов в порядке мини-аппа, все показаны', () => {
    const { result } = renderHook(() => useToolsState(PROPS));
    expect(result.current.rows.map((r) => r.id)).toEqual([
      'phrase_check',
      'tasks',
      'practices',
      'plans',
      'belief_check',
      'safe_place',
      'letter_to_self',
      'flashcard',
      'childhood_wheel',
      'warm_words',
    ]);
    expect(result.current.hidden).toEqual([]);
    expect(result.current.isShown('tasks')).toBe(true);
  });

  it('toggle скрывает пункт, пишет ключ и зовёт onChanged', () => {
    const onChanged = vi.fn();
    const { result } = renderHook(() => useToolsState(PROPS, onChanged));
    act(() => result.current.toggle('plans', true));
    expect(result.current.isShown('plans')).toBe(false);
    expect(JSON.parse(localStorage.getItem(TOOLS_ACTIONS_HIDDEN_KEY)!)).toEqual(
      ['plans'],
    );
    expect(onChanged).toHaveBeenCalledTimes(1);
    act(() => result.current.toggle('plans', false));
    expect(result.current.isShown('plans')).toBe(true);
    expect(onChanged).toHaveBeenCalledTimes(2);
  });

  it('скрытый пункт остаётся в rows (лист настройки показывает его выключенным)', () => {
    const { result } = renderHook(() => useToolsState(PROPS));
    act(() => result.current.toggle('flashcard', true));
    expect(result.current.rows.some((r) => r.id === 'flashcard')).toBe(true);
  });

  it('onReorder переставляет пункт, пишет ключ порядка, возвращает направление и зовёт onChanged', () => {
    const onChanged = vi.fn();
    const { result } = renderHook(() => useToolsState(PROPS, onChanged));
    let dir: 'up' | 'down' | false = false;
    act(() => {
      dir = result.current.onReorder('warm_words', 0);
    });
    expect(dir).toBe('up');
    expect(result.current.rows[0].id).toBe('warm_words');
    expect(localStorage.getItem(TOOLS_ACTIONS_ORDER_KEY)).toContain(
      'warm_words',
    );
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('перестановка на то же место — false, onChanged не зовётся', () => {
    const onChanged = vi.fn();
    const { result } = renderHook(() => useToolsState(PROPS, onChanged));
    let dir: 'up' | 'down' | false = 'up';
    act(() => {
      dir = result.current.onReorder('phrase_check', 0);
    });
    expect(dir).toBe(false);
    expect(onChanged).not.toHaveBeenCalled();
  });

  describe('orderable (сайт: переставляются только карточки)', () => {
    const CARDS = ['belief_check', 'warm_words'] as const;

    it('две группы: переставляемые и остальные', () => {
      const { result } = renderHook(() =>
        useToolsState(PROPS, undefined, CARDS),
      );
      expect(result.current.groups[0].map((r) => r.id)).toEqual([
        'belief_check',
        'warm_words',
      ]);
      expect(result.current.groups[1]).toHaveLength(8);
      expect(result.current.rows).toHaveLength(10);
    });

    it('индекс перестановки — внутри группы карточек, остальные не двигаются', () => {
      const { result } = renderHook(() =>
        useToolsState(PROPS, undefined, CARDS),
      );
      act(() => {
        result.current.onReorder('warm_words', 0);
      });
      expect(result.current.groups[0].map((r) => r.id)).toEqual([
        'warm_words',
        'belief_check',
      ]);
      expect(result.current.groups[1].map((r) => r.id)).toEqual([
        'phrase_check',
        'tasks',
        'practices',
        'plans',
        'safe_place',
        'letter_to_self',
        'flashcard',
        'childhood_wheel',
      ]);
    });

    it('порядок переживает новый рендер (читается из хранилища)', () => {
      const first = renderHook(() => useToolsState(PROPS, undefined, CARDS));
      act(() => {
        first.result.current.onReorder('warm_words', 0);
      });
      const again = renderHook(() => useToolsState(PROPS, undefined, CARDS));
      expect(again.result.current.groups[0][0].id).toBe('warm_words');
    });
  });
});
