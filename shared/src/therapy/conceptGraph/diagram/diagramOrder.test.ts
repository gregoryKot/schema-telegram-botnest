import { describe, it, expect } from 'vitest';
import { buildConceptGraph } from '../conceptGraphModel';
import { mode, source } from './diagram.test-helpers';
import { orderColumns } from './diagramOrder';

const order = (patch: Parameters<typeof source>[0]) =>
  orderColumns(buildConceptGraph(source(patch), (ty) => ty));

describe('orderColumns', () => {
  it('режимы: критики, детские, копинги; здоровые сюда не входят', () => {
    const o = order({
      modeIds: [
        'healthy_adult',
        'detached_protector',
        'vulnerable_child',
        'punitive_critic',
      ],
    });
    expect(o.modes.map((m) => m.modeId)).toEqual([
      'punitive_critic',
      'vulnerable_child',
      'detached_protector',
    ]);
  });

  it('схемы без режимов идут по доменам, после тех, на кого ссылаются режимы', () => {
    const o = order({
      modeIds: ['punitive_critic'],
      schemaIds: ['abandonment', 'failure', 'entitlement'],
      modeLinks: [mode('punitive_critic', { schemaIds: ['entitlement'] })],
    });
    expect(o.schemas.map((s) => s.id)).toEqual([
      'entitlement',
      'abandonment',
      'failure',
    ]);
  });

  it('схема, на которую ссылаются два режима, встаёт между ними по среднему', () => {
    const o = order({
      modeIds: ['demanding_critic', 'punitive_critic', 'vulnerable_child'],
      schemaIds: ['abandonment', 'unrelenting_standards', 'mistrust'],
      modeLinks: [
        mode('demanding_critic', { schemaIds: ['unrelenting_standards'] }),
        mode('punitive_critic', { schemaIds: ['mistrust'] }),
        mode('vulnerable_child', { schemaIds: ['abandonment'] }),
      ],
    });
    // критики по порядку реестра: требовательный, карающий; затем ребёнок
    expect(o.schemas.map((s) => s.id)).toEqual([
      'unrelenting_standards',
      'mistrust',
      'abandonment',
    ]);
  });

  it('пустой граф — пустые колонки', () => {
    const o = order({});
    expect(o.modes).toEqual([]);
    expect(o.schemas).toEqual([]);
  });
});
