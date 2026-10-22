// @vitest-environment jsdom
// useHubDrag — перетаскивание круга потребностей двигает его потребности.
// Проверяем итоговые позиции в состоянии, а не вызовы setNodes.
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import type { FlowNode } from '../modeMapFlow';
import { useHubDrag } from './useHubDrag';

const flow = (id: string, type: string, x: number, y: number, diameter?: number): FlowNode => ({
  id, type, position: { x, y }, data: diameter ? { diameter } : {}, measured: { width: 100, height: 40 },
});
const START = [
  flow('hub', 'needs', 0, 0, 400),
  flow('in1', 'need', 100, 150),     // центр (150, 170) — внутри круга радиуса 200
  flow('in2', 'need', 150, 250),
  flow('out', 'schema', 900, 150),
];
const evt = {} as never;

function setup(nodes: FlowNode[] = START) {
  return renderHook(() => {
    const [state, setState] = useState(nodes);
    const ref = useRef(state);
    ref.current = state;
    const drag = useHubDrag({ nodesRef: ref, setNodes: setState as never });
    return { state, ...drag };
  });
}
const pos = (r: ReturnType<typeof setup>, id: string) => r.result.current.state.find((n) => n.id === id)!.position;
const hubAt = (x: number, y: number) => ({ ...START[0], position: { x, y } });

describe('useHubDrag', () => {
  it('потребности внутри круга едут вместе с ним, ноды снаружи стоят', () => {
    const r = setup();
    act(() => r.result.current.onNodeDragStart(evt, START[0], [START[0]]));
    act(() => r.result.current.onNodeDrag(evt, hubAt(30, -20), [START[0]]));
    expect(pos(r, 'in1')).toEqual({ x: 130, y: 130 });
    expect(pos(r, 'in2')).toEqual({ x: 180, y: 230 });
    expect(pos(r, 'out')).toEqual({ x: 900, y: 150 });
  });

  it('сдвиг считается от старта: серия кадров не накапливает погрешность', () => {
    const r = setup();
    act(() => r.result.current.onNodeDragStart(evt, START[0], [START[0]]));
    for (const x of [10, 25, 60, 100]) act(() => r.result.current.onNodeDrag(evt, hubAt(x, 0), [START[0]]));
    expect(pos(r, 'in1')).toEqual({ x: 200, y: 150 });
  });

  it('состав берётся в момент начала: нода, оказавшаяся под кругом позже, не прилипает', () => {
    const r = setup();
    act(() => r.result.current.onNodeDragStart(evt, START[0], [START[0]]));
    act(() => r.result.current.onNodeDrag(evt, hubAt(800, 0), [START[0]]));
    expect(pos(r, 'out')).toEqual({ x: 900, y: 150 });
  });

  it('перетаскивание обычной ноды ничего вокруг не двигает', () => {
    const r = setup();
    act(() => r.result.current.onNodeDragStart(evt, START[1], [START[1]]));
    act(() => r.result.current.onNodeDrag(evt, { ...START[1], position: { x: 500, y: 500 } }, [START[1]]));
    expect(r.result.current.state.map((n) => n.position)).toEqual(START.map((n) => n.position));
  });

  it('нода, которую xyflow тащит вместе с кругом (выделена), не двигается второй раз', () => {
    const r = setup();
    act(() => r.result.current.onNodeDragStart(evt, START[0], [START[0], START[1]]));
    act(() => r.result.current.onNodeDrag(evt, hubAt(50, 0), [START[0], START[1]]));
    expect(pos(r, 'in1')).toEqual({ x: 100, y: 150 });
    expect(pos(r, 'in2')).toEqual({ x: 200, y: 250 });
  });

  it('новый драг обычной ноды сбрасывает состояние прошлого драга круга', () => {
    const r = setup();
    act(() => r.result.current.onNodeDragStart(evt, START[0], [START[0]]));
    act(() => r.result.current.onNodeDragStart(evt, START[3], [START[3]]));
    act(() => r.result.current.onNodeDrag(evt, hubAt(70, 70), [START[0]]));
    expect(pos(r, 'in1')).toEqual({ x: 100, y: 150 });
  });
});
