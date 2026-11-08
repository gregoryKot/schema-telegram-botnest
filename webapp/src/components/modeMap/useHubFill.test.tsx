// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHubFill } from './useHubFill';
import { hubNeedNodes } from './hubFill';
import { HUB_DIAMETER } from './hubGeometry';
import type { FlowNode } from '../modeMapFlow';

// Круг, поставленный до того, как палитра стала приносить его заполненным
// (скриншот владельца 2026-11-08: пустой круг и вопрос «как его заполнять?»).
const hub: FlowNode = { id: 'h', type: 'needs', position: { x: 0, y: 0 }, data: { label: 'К', diameter: HUB_DIAMETER } };
const measured = { width: 112, height: 36 };

function setup(nodes: FlowNode[]) {
  const setNodes = vi.fn();
  const scheduleSave = vi.fn();
  const pushHistory = vi.fn();
  const { result } = renderHook(() => useHubFill({ nodes, edges: [], setNodes, scheduleSave, pushHistory }));
  return { fill: result.current(hub), setNodes, scheduleSave, pushHistory };
}

describe('useHubFill', () => {
  it('пустой круг: не хватает пяти; кнопка ставит их внутрь одним шагом истории и сохраняет', () => {
    const { fill, setNodes, scheduleSave, pushHistory } = setup([hub]);
    expect(fill.missing).toBe(5);
    act(() => fill.fill());
    expect(pushHistory).toHaveBeenCalledTimes(1);
    const saved = scheduleSave.mock.calls[0][0] as FlowNode[];
    expect(saved).toHaveLength(6);
    expect(saved.filter(n => n.type === 'need').map(n => (n.data as { needId: string }).needId))
      .toEqual(['attachment', 'autonomy', 'expression', 'play', 'limits']);
    expect(setNodes).toHaveBeenCalledWith(saved);
  });

  it('стоят три — достраиваются две, уже стоящие не дублируются', () => {
    const have = hubNeedNodes('h', hub.position, HUB_DIAMETER, new Set(['play', 'limits']), 1).map(n => ({ ...n, measured } as FlowNode));
    const { fill, scheduleSave } = setup([hub, ...have]);
    expect(fill.missing).toBe(2);
    act(() => fill.fill());
    const added = (scheduleSave.mock.calls[0][0] as FlowNode[]).slice(4);
    expect(added.map(n => (n.data as { needId: string }).needId)).toEqual(['play', 'limits']);
  });

  it('полный круг — нечего ставить, история не трогается', () => {
    const all = hubNeedNodes('h', hub.position, HUB_DIAMETER, new Set(), 1).map(n => ({ ...n, measured } as FlowNode));
    const { fill, pushHistory, setNodes } = setup([hub, ...all]);
    expect(fill.missing).toBe(0);
    act(() => fill.fill());
    expect(pushHistory).not.toHaveBeenCalled();
    expect(setNodes).not.toHaveBeenCalled();
  });
});
