// @vitest-environment jsdom
// useMapKeys — горячие клавиши редактора карты. Здесь — ⌘A / Ctrl+A «выделить
// всё» и его границы: не в полях ввода и не под открытым диалогом (там клавиша
// правит текст или принадлежит окну). Остальные клавиши — ModeMapEditor.test.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, fireEvent, cleanup, act } from '@testing-library/react';
import { useNodesState, useEdgesState } from '@xyflow/react';
import { useMapKeys, selectAllNodes } from './useMapKeys';
import type { FlowNode, FlowEdge } from '../modeMapFlow';

afterEach(() => { cleanup(); document.body.innerHTML = ''; });

const node = (id: string): FlowNode => ({ id, type: 'trigger', position: { x: 0, y: 0 }, data: { label: id } });

function setup(initial: FlowNode[] = [node('a'), node('b')]) {
  const pushHistory = vi.fn(), scheduleSave = vi.fn();
  const { result } = renderHook(() => {
    const [nodes, setNodes] = useNodesState<FlowNode>(initial);
    const [edges, setEdges] = useEdgesState<FlowEdge>([]);
    useMapKeys({ nodes, edges, selectedNodeId: null, selectedEdgeId: null, setNodes, setEdges,
      setSelectedNodeId: vi.fn(), setSelectedEdgeId: vi.fn(), scheduleSave, pushHistory, undo: vi.fn(), redo: vi.fn() });
    return nodes;
  });
  const selected = () => result.current.filter(n => n.selected).map(n => n.id);
  return { selected, pushHistory, scheduleSave };
}

function press(target: EventTarget, init: KeyboardEventInit) {
  act(() => { fireEvent.keyDown(target, init); });
}

describe('useMapKeys — ⌘A выделяет все фигуры', () => {
  it('⌘A на холсте выделяет все фигуры, не трогая историю и сохранение', () => {
    const { selected, pushHistory, scheduleSave } = setup();
    press(window, { key: 'a', metaKey: true });
    expect(selected()).toEqual(['a', 'b']);
    expect(pushHistory).not.toHaveBeenCalled();
    expect(scheduleSave).not.toHaveBeenCalled();
  });

  it('Ctrl+A (Windows, Linux) работает так же', () => {
    const { selected } = setup();
    press(window, { key: 'A', ctrlKey: true });
    expect(selected()).toEqual(['a', 'b']);
  });

  it('буква «a» без модификатора ничего не выделяет', () => {
    const { selected } = setup();
    press(window, { key: 'a' });
    expect(selected()).toEqual([]);
  });

  it.each(['input', 'textarea', 'select'])('⌘A в поле %s не выделяет фигуры (выделяет текст поля)', (tag) => {
    const { selected } = setup();
    const field = document.body.appendChild(document.createElement(tag));
    press(field, { key: 'a', metaKey: true });
    expect(selected()).toEqual([]);
  });

  it('под открытым диалогом ⌘A не трогает карту за ним', () => {
    const { selected } = setup();
    const dialog = document.body.appendChild(document.createElement('div'));
    dialog.setAttribute('role', 'dialog');
    const btn = dialog.appendChild(document.createElement('button'));
    press(btn, { key: 'a', metaKey: true });
    expect(selected()).toEqual([]);
  });
});

describe('selectAllNodes', () => {
  it('ставит selected всем фигурам и не меняет остальное', () => {
    const out = selectAllNodes([node('a'), { ...node('b'), selected: false }]);
    expect(out.map(n => n.selected)).toEqual([true, true]);
    expect(out[0].data).toEqual({ label: 'a' });
  });
});
