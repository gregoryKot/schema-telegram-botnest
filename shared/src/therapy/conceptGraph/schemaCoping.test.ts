import { describe, expect, it } from 'vitest';
import { markCoping, normalizeCoping, unmarkCoping } from './schemaCoping';
import { normalizeSchemaLinks } from './schemaLinks';

const link = { schemaId: 'subjugation', belief: 'b', origin: '', needIds: [] };

describe('стили копинга схемы', () => {
  it('нормализация: порядок справочника, без дублей и чужих строк', () => {
    expect(
      normalizeCoping(['overcompensation', 'x', 'surrender', 'surrender']),
    ).toEqual(['surrender', 'overcompensation']);
    expect(normalizeCoping('surrender')).toEqual([]);
  });

  it('normalizeSchemaLinks сохраняет стили и заметки только отмеченных стилей', () => {
    const [l] = normalizeSchemaLinks([
      {
        ...link,
        coping: ['avoidance'],
        copingNotes: {
          avoidance: 'молчит',
          surrender: 'лишнее',
          overcompensation: 5,
        },
      },
    ]);
    expect(l.coping).toEqual(['avoidance']);
    expect(l.copingNotes).toEqual({ avoidance: 'молчит' });
    expect(normalizeSchemaLinks([link])[0]).not.toHaveProperty('coping');
  });

  it('отметка схемы, которой нет в схеме случая, добавляет её; повтор — правка заметки, не дубль', () => {
    const first = markCoping(
      { schemaIds: [], schemaLinks: [] },
      'subjugation',
      'surrender',
      ' уступает ',
    );
    expect(first).toMatchObject({ addedSchema: true, addedStyle: true });
    expect(first.link).toMatchObject({
      schemaId: 'subjugation',
      coping: ['surrender'],
      copingNotes: { surrender: 'уступает' },
    });
    const again = markCoping(
      { schemaIds: ['subjugation'], schemaLinks: [first.link] },
      'subjugation',
      'surrender',
      '',
    );
    expect(again).toMatchObject({ addedSchema: false, addedStyle: false });
    expect(again.link.coping).toEqual(['surrender']);
    expect(again.link).not.toHaveProperty('copingNotes');
  });

  it('снятие убирает стиль и его заметку, тексты схемы остаются', () => {
    const marked = {
      ...link,
      coping: ['surrender', 'avoidance'] as const,
      copingNotes: { surrender: 'да' },
    };
    const one = unmarkCoping(
      [{ ...marked, coping: [...marked.coping] }],
      'subjugation',
      'surrender',
    );
    expect(one).toMatchObject({ belief: 'b', coping: ['avoidance'] });
    expect(one).not.toHaveProperty('copingNotes');
    expect(unmarkCoping([one], 'subjugation', 'avoidance')).not.toHaveProperty(
      'coping',
    );
  });
});
