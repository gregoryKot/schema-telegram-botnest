// Полка книг: каждая метка в тексте справочника ведёт на книгу из GUIDE_SOURCES.
import { describe, it, expect } from 'vitest';
import {
  buildConcernGuides,
  buildModeGuides,
  buildPhaseGuides,
  buildSchemaDomainGuides,
  buildTechniqueGuides,
  needGuides,
  practiceNotes,
} from './index';
import {
  citationLabels,
  citedSources,
  GUIDE_SOURCES,
  sourceLine,
} from './sources';
import type { Tr } from './types';

const ty: Tr = (t) => t;
const strings = (v: unknown): string[] =>
  typeof v === 'string'
    ? [v]
    : v && typeof v === 'object'
      ? Object.values(v).flatMap(strings)
      : [];
const allText = strings([
  buildModeGuides(ty),
  buildSchemaDomainGuides(ty),
  buildTechniqueGuides(ty),
  practiceNotes(ty),
  buildConcernGuides(ty),
  buildPhaseGuides(ty),
  needGuides(),
]).join('\n');

describe('полка книг справочника', () => {
  it('каждая метка в текстах есть на полке', () => {
    const known = new Set(
      GUIDE_SOURCES.flatMap((s) => [s.key, ...(s.aliases ?? [])]),
    );
    expect(citationLabels(allText).filter((l) => !known.has(l))).toEqual([]);
  });

  it('метки и написания на полке не повторяются', () => {
    const labels = GUIDE_SOURCES.flatMap((s) => [s.key, ...(s.aliases ?? [])]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('разбирает метки: несколько через «;», ссылка с годом пропускается, повтор — один раз', () => {
    expect(
      citationLabels(
        '[Рёдигер, гл. 7; Кембридж, гл. 1], [Янг, 2003; Арнц и Якоб], [Хис, гл. 14, Бехари], [Рёдигер, гл. 9]',
      ),
    ).toEqual(['Рёдигер', 'Кембридж', 'Арнц и Якоб', 'Хис']);
    expect(citationLabels('[Янг, Клоско, Вайсхаар, табл. 1.2]')).toEqual([
      'Янг, Клоско, Вайсхаар',
    ]);
    expect(citationLabels('без ссылок')).toEqual([]);
    expect(citationLabels('[Янг, Клоско, Вайсхаарова]')).toEqual(['Янг']);
  });

  it('другое написание ведёт на ту же книгу, незнакомая метка пропускается', () => {
    const keys = citedSources(
      '[Арнтц, 6.2], [Арнц и Якоб, гл. 2], [Нет такой]',
    ).map((s) => s.key);
    expect(keys).toEqual(['Арнтц']);
  });

  it('строка расшифровки: автор и название; без них — нет строки', () => {
    expect(
      sourceLine({ key: 'К', author: 'А. Б.', title: 'Книга, 2020' }),
    ).toBe('К — А. Б., «Книга, 2020»');
    expect(sourceLine({ key: 'К', author: 'А. Б.' })).toBe('К — А. Б.');
    expect(sourceLine({ key: 'К' })).toBeNull();
  });
});
