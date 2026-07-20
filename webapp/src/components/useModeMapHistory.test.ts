// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModeMapHistory } from './useModeMapHistory';
import type { FlowNode, FlowEdge } from './modeMapFlow';

const node = (id: string): FlowNode => ({ id, position: { x: 0, y: 0 }, data: {} });
const edge = (id: string): FlowEdge => ({ id, source: 'a', target: 'b' });

function setup(initial: FlowNode[] = [node('a')]) {
  const nodesRef = { current: initial };
  const edgesRef = { current: [] as FlowEdge[] };
  const setNodes = vi.fn<(ns: FlowNode[]) => void>();
  const setEdges = vi.fn<(es: FlowEdge[]) => void>();
  const scheduleSave = vi.fn<(ns: FlowNode[], es: FlowEdge[]) => void>();
  const clearSelection = vi.fn();

  // Редактор пишет рефы в эффекте после коммита — в тесте делаем это вручную,
  // чтобы снимок следующего шага брался с «уже применённого» холста.
  setNodes.mockImplementation(ns => { nodesRef.current = ns; });
  setEdges.mockImplementation(es => { edgesRef.current = es; });

  const { result } = renderHook(() => useModeMapHistory({
    nodesRef, edgesRef, setNodes, setEdges, scheduleSave, clearSelection,
  }));
  const editTo = (ns: FlowNode[], es: FlowEdge[] = edgesRef.current) =>
    act(() => { nodesRef.current = ns; edgesRef.current = es; });
  return { result, nodesRef, edgesRef, setNodes, setEdges, scheduleSave, clearSelection, editTo };
}

describe('useModeMapHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('на старте отменять и возвращать нечего', () => {
    const { result } = setup();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('pushHistory включает «Отменить»', () => {
    const { result } = setup();
    act(() => result.current.pushHistory());
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo восстанавливает предыдущий снапшот и включает «Вернуть»', () => {
    const { result, setNodes, setEdges, scheduleSave, clearSelection, editTo } = setup([node('a')]);
    act(() => result.current.pushHistory());
    editTo([node('a'), node('b')], [edge('e1')]);

    act(() => result.current.undo());

    expect(setNodes).toHaveBeenCalledWith([node('a')]);
    expect(setEdges).toHaveBeenCalledWith([]);
    expect(scheduleSave).toHaveBeenCalledWith([node('a')], []);
    expect(clearSelection).toHaveBeenCalledTimes(1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('redo возвращает состояние вперёд', () => {
    const { result, setNodes, setEdges, editTo } = setup([node('a')]);
    act(() => result.current.pushHistory());
    editTo([node('a'), node('b')], [edge('e1')]);
    act(() => result.current.undo());

    act(() => result.current.redo());

    expect(setNodes).toHaveBeenLastCalledWith([node('a'), node('b')]);
    expect(setEdges).toHaveBeenLastCalledWith([edge('e1')]);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('новое действие после отмены обнуляет «Вернуть»', () => {
    const { result, editTo } = setup([node('a')]);
    act(() => result.current.pushHistory());
    editTo([node('a'), node('b')]);
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.pushHistory());

    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);
  });

  it('глубина истории ограничена 60 шагами — самый старый снапшот вытесняется', () => {
    const { result, setNodes, editTo } = setup([node('n0')]);
    // 61 снимок: n0…n60. Первый (n0) должен выпасть из стека.
    for (let i = 1; i <= 61; i++) {
      act(() => result.current.pushHistory());
      editTo([node(`n${i}`)]);
    }

    for (let i = 0; i < 60; i++) act(() => result.current.undo());

    // Дошли до n1, а не до n0 — и отменять больше нечего.
    expect(setNodes).toHaveBeenLastCalledWith([node('n1')]);
    expect(result.current.canUndo).toBe(false);
  });

  it('undo и redo на пустых стеках ничего не делают', () => {
    const { result, setNodes, setEdges, scheduleSave, clearSelection } = setup();
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(setNodes).not.toHaveBeenCalled();
    expect(setEdges).not.toHaveBeenCalled();
    expect(scheduleSave).not.toHaveBeenCalled();
    expect(clearSelection).not.toHaveBeenCalled();
  });
});
