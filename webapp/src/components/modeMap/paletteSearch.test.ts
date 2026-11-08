import { describe, it, expect } from 'vitest';
import { MODE_GROUPS, SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { matchCustomModes, matchDomainSchemas, matchGroupItems, matchesWords, normalizeQuery } from './paletteSearch';

describe('paletteSearch', () => {
  it('normalizeQuery: обрезает и приводит к нижнему регистру', () => {
    expect(normalizeQuery('  ПоКиНу ')).toBe('покину');
  });

  it('пустой запрос возвращает всё', () => {
    expect(matchGroupItems(MODE_GROUPS[0], '')).toBe(MODE_GROUPS[0].items);
    expect(matchDomainSchemas(SCHEMA_DOMAINS[0], '')).toBe(SCHEMA_DOMAINS[0].schemas);
    const list = [{ name: 'A' }];
    expect(matchCustomModes(list, '')).toBe(list);
  });

  it('схемы ищутся по названию без регистра', () => {
    const names = SCHEMA_DOMAINS.flatMap(d => matchDomainSchemas(d, 'покину')).map(s => s.name);
    expect(names).toEqual(['Покинутость / Нестабильность']);
  });

  it('домен без совпадений даёт пустой список', () => {
    expect(matchDomainSchemas(SCHEMA_DOMAINS[1], 'покину')).toEqual([]);
  });

  it('режимы ищутся по названию', () => {
    const found = MODE_GROUPS.flatMap(g => matchGroupItems(g, 'упрямый')).map(i => i.name);
    expect(found).toContain('Упрямый Ребёнок');
    expect(found).not.toContain('Одинокий Ребёнок');
  });

  it('свои режимы — по названию без регистра', () => {
    expect(matchCustomModes([{ name: 'Особый' }, { name: 'Другой' }], 'осо')).toEqual([{ name: 'Особый' }]);
  });

  it('фигуры ищутся по ключевым словам', () => {
    expect(matchesWords('триггер ситуация', 'ситуац')).toBe(true);
    expect(matchesWords('триггер ситуация', 'поведен')).toBe(false);
    expect(matchesWords('поведение последствие', 'последств')).toBe(true);
    expect(matchesWords('поведение последствие', '')).toBe(true);
  });
});
