import { describe, it, expect } from 'vitest';
import { buildConceptGraph } from '../conceptGraphModel';
import { emptyModeLink } from '../modeLinks';
import {
  DIM_EDGE,
  DIM_NODE,
  edgeOpacity,
  nodeOpacity,
  resolveFocus,
} from './diagramFocus';
import { layoutConceptDiagram } from './diagramLayout';

const l = layoutConceptDiagram(
  buildConceptGraph(
    {
      modeIds: ['vulnerable_child', 'punitive_critic', 'detached_protector'],
      schemaIds: ['abandonment', 'defectiveness'],
      modeLinks: [
        {
          ...emptyModeLink('vulnerable_child'),
          schemaIds: ['abandonment'],
          needIds: ['limits'],
        },
        { ...emptyModeLink('punitive_critic'), schemaIds: ['defectiveness'] },
      ],
    },
    (ty) => ty,
  ),
  1000,
);
const edge = (kind: string, to?: string) =>
  l.edges.find((e) => e.kind === kind && (!to || e.to === to))!;
const node = (id: string) => l.nodes.find((n) => n.id === id)!;

describe('фокус', () => {
  it('без фокуса линии такой же непрозрачности, как заданы раскладкой, фигуры целые', () => {
    for (const e of l.edges) expect(edgeOpacity(e, null)).toBe(e.opacity);
    for (const n of l.nodes) expect(nodeOpacity(n, null, l.edges)).toBe(1);
  });

  it('схема в фокусе: её линия 100%, остальные приглушены', () => {
    const focus = 'schema:abandonment';
    expect(edgeOpacity(edge('feeds', 'mode:vulnerable_child'), focus)).toBe(1);
    expect(edgeOpacity(edge('feeds', 'mode:punitive_critic'), focus)).toBe(
      DIM_EDGE,
    );
    expect(edgeOpacity(edge('need'), focus)).toBe(DIM_EDGE);
  });

  it('стрелки между кластерами не принадлежат фигуре: при фокусе они приглушены', () => {
    const presses = edge('presses');
    expect(edgeOpacity(presses, presses.from)).toBe(DIM_EDGE);
    expect(edgeOpacity(presses, presses.to)).toBe(DIM_EDGE);
  });

  it('фигуры: сама, связанные с ней — целые, прочие 35%', () => {
    const focus = 'schema:abandonment';
    expect(nodeOpacity(node('schema:abandonment'), focus, l.edges)).toBe(1);
    expect(nodeOpacity(node('mode:vulnerable_child'), focus, l.edges)).toBe(1);
    expect(nodeOpacity(node('mode:punitive_critic'), focus, l.edges)).toBe(
      DIM_NODE,
    );
    expect(nodeOpacity(node('schema:defectiveness'), focus, l.edges)).toBe(
      DIM_NODE,
    );
  });

  it('открытый режим фокусирует свои линии, нажатая схема сильнее открытого режима', () => {
    expect(resolveFocus(l, null, 'vulnerable_child')).toBe(
      'mode:vulnerable_child',
    );
    expect(resolveFocus(l, 'schema:defectiveness', 'vulnerable_child')).toBe(
      'schema:defectiveness',
    );
    expect(resolveFocus(l, null, null)).toBeNull();
  });

  it('устаревший id (фигуры больше нет) фокуса не создаёт и схему не гасит', () => {
    expect(resolveFocus(l, 'schema:failure', null)).toBeNull();
    expect(resolveFocus(l, null, 'lonely_child')).toBeNull();
  });
});
