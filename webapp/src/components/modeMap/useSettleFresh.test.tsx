// @vitest-environment jsdom
// useSettleFresh — осадка свежей схемы после первого замера. Хук не знает про
// React Flow: он смотрит на `measured` в нодах, поэтому замер здесь — это просто
// новый массив нод, как его отдаёт useNodesState после onNodesChange.
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Node } from '@xyflow/react';
import type { FlowEdge } from '../modeMapFlow';
import { useSettleFresh } from './useSettleFresh';

type FlowNode = Node<Record<string, unknown>>;

const node = (id: string, y: number, h: number | undefined, settle = true): FlowNode => ({
  id, type: 'schema', position: { x: 0, y }, data: settle ? { settle: true } : {},
  ...(h === undefined ? {} : { measured: { width: 250, height: h } }),
});
const EDGES: FlowEdge[] = [{ id: 'e', source: 'a', target: 'b', data: {} }];

function setup(initial: FlowNode[]) {
  const setNodes = vi.fn();
  const scheduleSave = vi.fn();
  const edgesRef = { current: EDGES };
  const view = renderHook(
    ({ nodes }) => useSettleFresh({ nodes, edgesRef, setNodes, scheduleSave }),
    { initialProps: { nodes: initial } },
  );
  return { setNodes, scheduleSave, ...view };
}

describe('useSettleFresh', () => {
  it('до замера ничего не делает', () => {
    const { setNodes, scheduleSave } = setup([node('a', 0, undefined), node('b', 200, undefined)]);
    expect(setNodes).not.toHaveBeenCalled();
    expect(scheduleSave).not.toHaveBeenCalled();
  });

  it('измерена не каждая нода с флагом — тоже ждёт', () => {
    const { setNodes, scheduleSave, rerender } = setup([node('a', 0, 400), node('b', 200, undefined)]);
    rerender({ nodes: [node('a', 0, 400), node('b', 200, undefined)] });
    expect(setNodes).not.toHaveBeenCalled();
    expect(scheduleSave).not.toHaveBeenCalled();
  });

  it('после замера всех — один setNodes и один scheduleSave с осевшими нодами и текущими связями', () => {
    const { setNodes, scheduleSave, rerender } = setup([node('a', 0, undefined), node('b', 200, undefined)]);
    rerender({ nodes: [node('a', 0, 400), node('b', 200, 100)] });

    expect(setNodes).toHaveBeenCalledTimes(1);
    expect(scheduleSave).toHaveBeenCalledTimes(1);
    const settled = setNodes.mock.calls[0][0] as FlowNode[];
    expect(settled.map((n) => n.position.y)).toEqual([0, 424]);
    expect(settled.every((n) => !('settle' in n.data))).toBe(true);
    expect(scheduleSave).toHaveBeenCalledWith(settled, EDGES);
  });

  it('второй раз не срабатывает: флаг снят, повторные рендеры ничего не шлют', () => {
    const { setNodes, scheduleSave, rerender } = setup([node('a', 0, 400), node('b', 200, 100)]);
    expect(setNodes).toHaveBeenCalledTimes(1);
    const settled = setNodes.mock.calls[0][0] as FlowNode[];
    rerender({ nodes: settled });
    rerender({ nodes: [...settled] });
    expect(setNodes).toHaveBeenCalledTimes(1);
    expect(scheduleSave).toHaveBeenCalledTimes(1);
  });

  it('контроль: карта без флагов не трогается вовсе (обычная правка терапевта не вызывает осадку)', () => {
    const { setNodes, scheduleSave } = setup([node('a', 0, 400, false), node('b', 200, 100, false)]);
    expect(setNodes).not.toHaveBeenCalled();
    expect(scheduleSave).not.toHaveBeenCalled();
  });

  it('наползания нет — всё равно сохраняет: флаг должен уйти из сохранённой карты', () => {
    const { setNodes, scheduleSave } = setup([node('a', 0, 100), node('b', 300, 100)]);
    expect(setNodes).toHaveBeenCalledTimes(1);
    expect(scheduleSave).toHaveBeenCalledTimes(1);
    expect((setNodes.mock.calls[0][0] as FlowNode[]).map((n) => n.position.y)).toEqual([0, 300]);
  });
});
