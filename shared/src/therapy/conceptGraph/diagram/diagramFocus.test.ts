import { describe, it, expect } from 'vitest';
import { RICH, layoutOf, node } from './diagram.test-helpers';
import {
  DIM_EDGE,
  DIM_NODE,
  edgeOpacity,
  nodeOpacity,
  resolveFocus,
} from './diagramFocus';

const l = layoutOf(RICH, 1200);
const edge = (id: string) => l.edges.find((e) => e.id === id)!;
const opacityOf = (id: string, focus: string | null) =>
  nodeOpacity(node(l, id), focus, l.edges);

describe('фокус', () => {
  it('без фокуса линии прежней непрозрачности, фигуры целые', () => {
    for (const e of l.edges) expect(edgeOpacity(e, null)).toBe(e.opacity);
    for (const n of l.nodes) expect(nodeOpacity(n, null, l.edges)).toBe(1);
  });

  it('потребность в фокусе: её ✗ и ✓ яркие, остальные линии приглушены', () => {
    const focus = 'need:expression';
    expect(
      edgeOpacity(
        edge('blocks:schema:emotional_deprivation>need:expression'),
        focus,
      ),
    ).toBe(1);
    expect(
      edgeOpacity(
        edge('blocks:schema:emotional_inhibition>need:expression'),
        focus,
      ),
    ).toBe(1);
    expect(
      edgeOpacity(
        edge('blocks:schema:emotional_deprivation>need:attachment'),
        focus,
      ),
    ).toBe(DIM_EDGE);
    expect(edgeOpacity(edge('meets:mode:healthy_adult>need:play'), focus)).toBe(
      DIM_EDGE,
    );
  });

  it('потребность с ✓ в фокусе: здоровый режим яркий, не связанные схемы приглушены', () => {
    const focus = 'need:play';
    expect(edgeOpacity(edge('meets:mode:healthy_adult>need:play'), focus)).toBe(
      1,
    );
    expect(opacityOf('mode:healthy_adult', focus)).toBe(1);
    expect(opacityOf('schema:emotional_deprivation', focus)).toBe(DIM_NODE);
  });

  it('схема в фокусе: линии к режимам, опыту и потребностям яркие, чужие приглушены', () => {
    const focus = 'schema:emotional_deprivation';
    expect(
      edgeOpacity(
        edge('link:mode:guilt_critic>schema:emotional_deprivation'),
        focus,
      ),
    ).toBe(1);
    expect(
      edgeOpacity(
        edge(
          'origin:origin:emotional_deprivation>schema:emotional_deprivation',
        ),
        focus,
      ),
    ).toBe(1);
    expect(
      edgeOpacity(
        edge('blocks:schema:emotional_deprivation>need:attachment'),
        focus,
      ),
    ).toBe(1);
    expect(
      edgeOpacity(
        edge('link:mode:detached_protector>schema:emotional_inhibition'),
        focus,
      ),
    ).toBe(DIM_EDGE);
    expect(opacityOf('origin:emotional_deprivation', focus)).toBe(1);
    expect(opacityOf('need:attachment', focus)).toBe(1);
    expect(opacityOf('need:play', focus)).toBe(DIM_NODE);
    expect(opacityOf('mode:detached_protector', focus)).toBe(DIM_NODE);
  });

  it('режим в фокусе: его схемы яркие, чужие потребности и здоровые приглушены', () => {
    const focus = 'mode:detached_protector';
    expect(opacityOf('schema:emotional_inhibition', focus)).toBe(1);
    expect(opacityOf('schema:emotional_deprivation', focus)).toBe(DIM_NODE);
    expect(opacityOf('mode:healthy_adult', focus)).toBe(DIM_NODE);
  });

  it('resolveFocus: нажатое важнее открытого, устаревший id сбрасывается', () => {
    expect(resolveFocus(l, 'need:play', 'mode:guilt_critic')).toBe('need:play');
    expect(resolveFocus(l, null, 'schema:emotional_deprivation')).toBe(
      'schema:emotional_deprivation',
    );
    expect(resolveFocus(l, null, null)).toBeNull();
    expect(resolveFocus(l, 'need:ghost', null)).toBeNull();
    expect(resolveFocus(l, null, 'mode:removed')).toBeNull();
  });
});
