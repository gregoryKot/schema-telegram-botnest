// @vitest-environment jsdom
// modeMapActions.ts — контекст действий над узлом карты (дублировать/удалить/
// редактировать/переименовать/патчить data), который ModeMapNodes.tsx читает
// через useNodeActions(). 0% покрытия: фиксируем, что без провайдера хук
// отдаёт null (узел-компонент не должен упасть на отсутствии меню), а с
// провайдером — ровно те функции, что туда положили, без подмены/потери.
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NodeActionsContext, useNodeActions, type NodeActions } from './modeMapActions';

function makeActions(): NodeActions {
  return {
    duplicate: vi.fn(),
    remove: vi.fn(),
    edit: vi.fn(),
    rename: vi.fn(),
    patchData: vi.fn(),
  };
}

describe('useNodeActions', () => {
  it('без Provider возвращает null', () => {
    const { result } = renderHook(() => useNodeActions());
    expect(result.current).toBeNull();
  });

  it('внутри Provider возвращает ровно тот объект действий, что передан value', () => {
    const actions = makeActions();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NodeActionsContext.Provider value={actions}>{children}</NodeActionsContext.Provider>
    );
    const { result } = renderHook(() => useNodeActions(), { wrapper });
    expect(result.current).toBe(actions);
  });

  it('вызов метода из контекста доходит до переданной функции с теми же аргументами', () => {
    const actions = makeActions();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NodeActionsContext.Provider value={actions}>{children}</NodeActionsContext.Provider>
    );
    const { result } = renderHook(() => useNodeActions(), { wrapper });
    result.current!.rename('node-1', 'Новое имя');
    result.current!.patchData('node-1', { fillFull: true });

    expect(actions.rename).toHaveBeenCalledWith('node-1', 'Новое имя');
    expect(actions.patchData).toHaveBeenCalledWith('node-1', { fillFull: true });
  });

  it('вложенный Provider с value=null возвращает null, а не действия внешнего провайдера', () => {
    const outer = makeActions();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NodeActionsContext.Provider value={outer}>
        <NodeActionsContext.Provider value={null}>{children}</NodeActionsContext.Provider>
      </NodeActionsContext.Provider>
    );
    const { result } = renderHook(() => useNodeActions(), { wrapper });
    expect(result.current).toBeNull();
  });
});
