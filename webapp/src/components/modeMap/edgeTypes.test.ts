import { describe, it, expect } from 'vitest';
import { EDGE_TYPE_LABELS, EDGE_TYPE_MARK, EDGE_TYPE_STYLE, pickPhrases } from './edgeTypes';

// Линии к потребностям: то, что рисует схема случая, теперь проводится и руками.
describe('edgeTypes — ✗ блокирует и ✓ заботится', () => {
  it('в выборе типа связи есть обе линии к потребности', () => {
    expect(EDGE_TYPE_LABELS.blocks).toBe('блокирует потребность');
    expect(EDGE_TYPE_LABELS.meets).toBe('заботится о потребности');
    expect(EDGE_TYPE_MARK).toEqual({ blocks: '✗', meets: '✓' });
  });

  it('подписи ✗ и ✓ начинаются со своего знака', () => {
    for (const p of pickPhrases('blocks', 10)) expect(p.startsWith('✗')).toBe(true);
    for (const p of pickPhrases('meets', 10)) expect(p.startsWith('✓')).toBe(true);
    expect(pickPhrases('no_such_type', 3)).toEqual([]);
  });

  it('выбор типа сразу даёт вид линии схемы случая: красный пунктир ✗, зелёная ✓', () => {
    expect(EDGE_TYPE_STYLE.blocks).toEqual({ color: 'var(--accent-red)', lineStyle: 'dashed' });
    expect(EDGE_TYPE_STYLE.meets).toEqual({ color: 'var(--accent-green)' });
    expect(EDGE_TYPE_STYLE.activates).toBeUndefined(); // у прочих типов цвет выбирает терапевт
  });
});
