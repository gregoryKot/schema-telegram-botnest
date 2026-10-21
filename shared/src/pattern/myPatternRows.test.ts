import { describe, it, expect } from 'vitest';
import { buildMyPatternRows } from './myPatternRows';

describe('buildMyPatternRows', () => {
  const ids = ['abandonment', 'mistrust', 'defectiveness'];

  it('сначала частые за неделю', () => {
    const rows = buildMyPatternRows(
      'schema',
      ids,
      { mistrust: 3, abandonment: 1 },
      new Set(),
    );
    expect(rows.map((r) => r.id).slice(0, 2)).toEqual([
      'mistrust',
      'abandonment',
    ]);
  });

  it('при равной частоте — с заполненной карточкой выше', () => {
    const rows = buildMyPatternRows(
      'schema',
      ids,
      {},
      new Set(['defectiveness']),
    );
    expect(rows[0].id).toBe('defectiveness');
  });

  it('при полном равенстве — по алфавиту названий', () => {
    const rows = buildMyPatternRows('schema', ids, {}, new Set());
    const names = rows.map((r) => r.meta.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ru')));
  });

  it('неизвестный id не попадает в список, limit режет сверху', () => {
    const rows = buildMyPatternRows(
      'schema',
      [...ids, 'no-such'],
      {},
      new Set(),
      2,
    );
    expect(rows).toHaveLength(2);
    expect(buildMyPatternRows('schema', ['no-such'], {}, new Set())).toEqual(
      [],
    );
  });

  it('режимы резолвятся как режимы', () => {
    const rows = buildMyPatternRows(
      'mode',
      ['vulnerable_child'],
      {},
      new Set(),
    );
    expect(rows).toHaveLength(1);
  });
});
