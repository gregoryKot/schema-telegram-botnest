// modeMapFlow.ts — 0% покрытия. Преобразования между API-формой карты
// (ModeMapNode/Edge) и формой @xyflow/react (FlowNode/Edge), плюс стили рёбер.
import { describe, it, expect } from 'vitest';
import { MarkerType } from '@xyflow/react';
import {
  edgeColor, makeMarker, edgeStyle, toFlowEdges, toFlowNodes, fromFlowNodes, fromFlowEdges,
  EDGE_WIDTH_PX,
} from './modeMapFlow';
import type { ModeMapEdge, ModeMapNode } from '../api';

describe('edgeColor', () => {
  it('возвращает явный цвет из data.color', () => {
    expect(edgeColor({ color: '#ff0000' })).toBe('#ff0000');
  });
  it('без data возвращает нейтральный серый по умолчанию', () => {
    expect(edgeColor(undefined)).toBe('rgba(var(--fg-rgb),0.55)');
  });
  it('data без color тоже даёт цвет по умолчанию', () => {
    expect(edgeColor({ edgeType: 'activates' })).toBe('rgba(var(--fg-rgb),0.55)');
  });
});

describe('makeMarker', () => {
  it('normal/по умолчанию — ширина 8.5 + 2.25*1.1', () => {
    const m = makeMarker('#000');
    expect(m.width).toBeCloseTo(8.5 + 2.25 * 1.1, 5);
    expect(m.height).toBe(m.width);
    expect(m.type).toBe(MarkerType.ArrowClosed);
    expect(m.color).toBe('#000');
  });
  it('bold толще thin', () => {
    const thin = makeMarker('#000', 'thin');
    const bold = makeMarker('#000', 'bold');
    expect(bold.width).toBeGreaterThan(thin.width);
  });
  it('неизвестный ключ ширины падает на normal (2.25)', () => {
    const unknown = makeMarker('#000', 'huge');
    const normal = makeMarker('#000', 'normal');
    expect(unknown.width).toBe(normal.width);
  });
});

describe('edgeStyle', () => {
  it('dashed даёт strokeDasharray "7 5"', () => {
    expect(edgeStyle('#111', 'dashed').strokeDasharray).toBe('7 5');
  });
  it('dotted даёт strokeDasharray "1.5 5"', () => {
    expect(edgeStyle('#111', 'dotted').strokeDasharray).toBe('1.5 5');
  });
  it('solid/undefined — без strokeDasharray', () => {
    expect(edgeStyle('#111', 'solid').strokeDasharray).toBeUndefined();
    expect(edgeStyle('#111', undefined).strokeDasharray).toBeUndefined();
  });
  it('ширина линии берётся из EDGE_WIDTH_PX, дефолт совпадает с ключом normal', () => {
    expect(edgeStyle('#111', undefined, 'bold').strokeWidth).toBe(EDGE_WIDTH_PX.bold);
    expect(edgeStyle('#111', undefined, undefined).strokeWidth).toBe(EDGE_WIDTH_PX.normal);
  });
});

function apiNode(overrides: Partial<ModeMapNode> = {}): ModeMapNode {
  return { id: 'n1', type: 'trigger', position: { x: 10, y: 20 }, data: { label: 'Триггер' }, ...overrides };
}
function apiEdge(overrides: Partial<ModeMapEdge> = {}): ModeMapEdge {
  return { id: 'e1', source: 'a', target: 'b', ...overrides };
}

describe('toFlowNodes / fromFlowNodes', () => {
  it('toFlowNodes переносит id/type/position/data без width/height', () => {
    const [flow] = toFlowNodes([apiNode()]);
    expect(flow).toEqual({ id: 'n1', type: 'trigger', position: { x: 10, y: 20 }, data: { label: 'Триггер' } });
  });

  it('старые width/height узла игнорируются (авторазмер по контенту)', () => {
    const [flow] = toFlowNodes([apiNode({ width: 999, height: 999 } as ModeMapNode)]);
    expect(flow).not.toHaveProperty('width');
    expect(flow).not.toHaveProperty('height');
  });

  it('round-trip toFlowNodes → fromFlowNodes восстанавливает исходный узел', () => {
    const original = apiNode();
    const back = fromFlowNodes(toFlowNodes([original]));
    expect(back).toEqual([original]);
  });

  it('пустой массив узлов даёт пустой массив в обе стороны', () => {
    expect(toFlowNodes([])).toEqual([]);
    expect(fromFlowNodes([])).toEqual([]);
  });
});

describe('toFlowEdges', () => {
  it('простое ребро без data получает тип floating и дефолтные маркер/цвет', () => {
    const [flow] = toFlowEdges([apiEdge()]);
    expect(flow.type).toBe('floating');
    expect(flow.source).toBe('a');
    expect(flow.target).toBe('b');
    expect(flow.markerStart).toBeUndefined();
    expect((flow.style as { stroke: string }).stroke).toBe('rgba(var(--fg-rgb),0.55)');
  });

  it('bidirectional-ребро получает markerStart наравне с markerEnd', () => {
    const [flow] = toFlowEdges([apiEdge({ data: { bidirectional: true } })]);
    expect(flow.markerStart).toBeDefined();
    expect(flow.markerEnd).toBeDefined();
  });

  it('sourceHandle/targetHandle null превращаются в undefined', () => {
    const [flow] = toFlowEdges([apiEdge({ sourceHandle: null, targetHandle: null })]);
    expect(flow.sourceHandle).toBeUndefined();
    expect(flow.targetHandle).toBeUndefined();
  });

  it('непустой label добавляет labelStyle/labelBgStyle, пустой — нет', () => {
    const [withLabel] = toFlowEdges([apiEdge({ label: 'давит' })]);
    const [withoutLabel] = toFlowEdges([apiEdge({ label: '' })]);
    expect(withLabel.label).toBe('давит');
    expect(withLabel.labelStyle).toBeDefined();
    expect(withoutLabel.label).toBeUndefined();
    expect(withoutLabel.labelStyle).toBeUndefined();
  });

  it('пустой массив даёт пустой массив', () => {
    expect(toFlowEdges([])).toEqual([]);
  });
});

describe('fromFlowEdges', () => {
  it('отсутствующий sourceHandle/targetHandle становится null (не undefined)', () => {
    const [back] = fromFlowEdges([{ id: 'e1', source: 'a', target: 'b' }]);
    expect(back.sourceHandle).toBeNull();
    expect(back.targetHandle).toBeNull();
  });

  it('round-trip fromFlowEdges(toFlowEdges(e)) сохраняет source/target/data/непустой label', () => {
    const original = apiEdge({ data: { edgeType: 'protects', color: '#abcdef', width: 'bold' }, label: 'защищает' });
    const [back] = fromFlowEdges(toFlowEdges([original]));
    expect(back.source).toBe(original.source);
    expect(back.target).toBe(original.target);
    expect(back.label).toBe('защищает');
    expect(back.data).toEqual(original.data);
  });

  it('пустой label ("") на round-trip теряется и становится undefined', () => {
    // Задокументированное поведение: `label: e.label || undefined` в toFlowEdges
    // трактует пустую строку как «нет подписи».
    const original = apiEdge({ label: '' });
    const [back] = fromFlowEdges(toFlowEdges([original]));
    expect(back.label).toBeUndefined();
  });
});
