// Вкладка «Запросы и расстройства»: статьи собираются в обеих формах обращения, ссылки на режимы,
// схемы и техники ведут на существующие записи, у каждой статьи есть источник с книги на полке.
import { describe, it, expect } from 'vitest';
import { getModeById, getSchemaById } from '../../schemaTherapyData';
import { buildConcernGuides, buildTechniqueGuides } from '../index';
import { citedSources } from '../sources';
import type { Tr } from '../types';

const ty: Tr = (t) => t;
const vy: Tr = (_t, v) => v;

describe.each([
  ['ты', ty],
  ['вы', vy],
])('статьи «Запросов», форма «%s»', (_name, tr) => {
  const concerns = buildConcernGuides(tr);
  const techniqueIds = new Set(buildTechniqueGuides(tr).map((t) => t.id));

  it('ключи уникальны, обязательные поля заполнены', () => {
    expect(concerns.length).toBeGreaterThan(0);
    expect(new Set(concerns.map((c) => c.id)).size).toBe(concerns.length);
    for (const c of concerns) {
      expect(c.id).toMatch(/^[a-z][a-z0-9_]*$/);
      for (const text of [c.name, c.goal, c.essence])
        expect(text.trim()).not.toBe('');
      expect(citedSources(c.sources).length).toBeGreaterThan(0);
    }
  });

  it('режимы, схемы и техники статей существуют', () => {
    for (const c of concerns) {
      for (const id of c.modeIds ?? [])
        expect(getModeById(id), id).toBeTruthy();
      for (const id of c.schemaIds ?? [])
        expect(getSchemaById(id), id).toBeTruthy();
      for (const id of c.techniques ?? [])
        expect(techniqueIds.has(id), id).toBe(true);
    }
  });
});
