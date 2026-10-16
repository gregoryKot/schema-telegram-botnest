import { describe, it, expect } from 'vitest';
import { buildNoteItems, filterNotes, countByFilter, type SchemaNoteData } from './notesModel';
import { ALL_SCHEMAS } from '../../../../shared/src/schemaTherapy/schemaTherapyData';

const sid = ALL_SCHEMAS[0].id;
const empty = { triggers: '', feelings: '', thoughts: '', origins: '', reality: '', healthyView: '', behavior: '' };
const schemaNote: SchemaNoteData = { schemaId: sid, ...empty, triggers: 'упрёк', thoughts: '  ' };

describe('notesModel', () => {
  const items = buildNoteItems(
    [
      { type: 'schema', date: '2026-10-01', schemaIds: [sid, 'x', 'y'], excerpt: 'a' },
      { type: 'gratitude', date: '2026-10-02', excerpt: 'b' },
    ],
    [schemaNote],
    [],
  );

  it('порядок: дневник, затем карточки; заголовок с «+N»', () => {
    expect(items.map(i => i.kind)).toEqual(['schema', 'gratitude', 'schema']);
    expect(items[0].title).toBe(`${ALL_SCHEMAS[0].name} +2`);
    expect(items[1].typeLabel).toBe('Дневник благодарности');
  });
  it('в карточке только заполненные поля, даты нет', () => {
    expect(items[2].fields).toEqual([{ label: 'Триггеры', val: 'упрёк' }]);
    expect(items[2].date).toBeNull();
  });
  it('фильтр и счётчики', () => {
    expect(filterNotes(items, 'schema')).toHaveLength(2);
    expect(filterNotes(items, 'all')).toHaveLength(3);
    expect(countByFilter(items)).toEqual({ all: 3, schema: 2, mode: 0, gratitude: 1 });
  });
});
