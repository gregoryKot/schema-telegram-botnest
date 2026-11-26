import { describe, it, expect } from 'vitest';
import { connectEdge } from './connectEdge';

const nodes = [
  { id: 'w', type: 'needs' }, { id: 's', type: 'schema' }, { id: 'h', type: 'healthy' }, { id: 'c', type: 'child' },
];
const conn = (source: string, target: string, sourceHandle: string | null = 'b', targetHandle: string | null = 'c') =>
  ({ source, target, sourceHandle, targetHandle });

describe('connectEdge — новая линия на холсте', () => {
  it('от схемы к сектору колеса — сразу «✗ блокирует»: красный пунктир с подписью ✗', () => {
    const e = connectEdge(conn('s', 'w', 'b', 'need:attachment'), nodes, 1);
    expect(e).toMatchObject({ source: 's', target: 'w', targetHandle: 'need:attachment', label: '✗', type: 'floating' });
    expect(e.data).toEqual({ edgeType: 'blocks', color: 'var(--accent-red)', lineStyle: 'dashed' });
    expect(e.style?.stroke).toBe('var(--accent-red)');
  });

  it('от здорового режима — «✓ заботится», зелёная; линия, начатая у сектора, — так же', () => {
    expect(connectEdge(conn('h', 'w', 'b', 'need:play'), nodes, 1)).toMatchObject({ label: '✓', data: { edgeType: 'meets' } });
    expect(connectEdge(conn('w', 's', 'need:play', 'c'), nodes, 1)).toMatchObject({ label: '✗', data: { edgeType: 'blocks' } });
  });

  it('прочие линии — «активирует» без подписи и нейтральным цветом, как раньше', () => {
    for (const e of [connectEdge(conn('c', 'w', 'b', 'need:play'), nodes, 1), connectEdge(conn('s', 'c'), nodes, 1)]) {
      expect(e.data).toEqual({ edgeType: 'activates' });
      expect(e.label).toBeUndefined();
    }
  });
});
