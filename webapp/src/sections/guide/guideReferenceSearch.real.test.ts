// Выдача «Справочника» на настоящих текстах: вопрос человека ставит лист схемы или режима первым.
import { describe, it, expect } from 'vitest';
import * as guide from '../../../../shared/src/schemaTherapy/guide';
import { buildReference } from './guideReferenceModel';
import { buildReferenceBody } from './guideReferenceBody';
import { searchReference } from './guideReferenceSearch';

describe('поиск на настоящих текстах справочника', () => {
  const tr = (ty: string) => ty;
  const ref = buildReference(guide, tr);
  const body = buildReferenceBody(guide, tr);
  const names = (query: string) => searchReference(ref, query, body).flatMap((g) => g.items.map((i) => i.name));

  it.each([
    ['как работать со схемой покинутости', 'Покинутость / Нестабильность'],
    ['покинутостью', 'Покинутость / Нестабильность'],
    ['схемой уязвимости', 'Уязвимость'],
    ['что делать с карающим критиком', 'Карающий Критик'],
    ['как работать с уязвимым ребёнком', 'Уязвимый Ребёнок'],
    ['работа со стульями', 'Работа со стульями'],
  ])('«%s» → первым идёт лист «%s»', (query, first) => {
    expect(names(query)[0]).toBe(first);
  });

  it('слово из названия в любом падеже ставит листы с ним в названии выше остальных, в порядке реестра', () => {
    expect(names('критика').slice(0, 3)).toEqual(['Требовательный Критик', 'Карающий Критик', 'Внушающий Вину Критик']);
    expect(names('критик').slice(0, 3)).toEqual(names('критика').slice(0, 3));
  });

  it('запрос из одних служебных слов — пусто, а не всё подряд', () => {
    expect(names('как работать со схемой')).toEqual([]);
    expect(names('что делать с этим режимом')).toEqual([]);
  });

  it('ключи листов выдачи уникальны, даже когда группа встречается дважды', () => {
    const keys = searchReference(ref, 'уязвимого ребёнка', body).map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
