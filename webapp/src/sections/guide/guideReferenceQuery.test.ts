// Разбор запроса «Справочника» и выдача на настоящих текстах: вопрос человека ставит лист схемы или режима первым.
import { describe, it, expect } from 'vitest';
import * as guide from '../../../../shared/src/schemaTherapy/guide';
import { buildReference } from './guideReferenceModel';
import { buildReferenceBody } from './guideReferenceBody';
import { searchReference } from './guideReferenceSearch';
import { findTerm, parseReferenceQuery, stemRu } from './guideReferenceQuery';

const stems = (query: string) => parseReferenceQuery(query).map((t) => t.stem);

describe('parseReferenceQuery', () => {
  it('служебные и родовые слова выпадают в любой форме; запрос только из них — пусто', () => {
    expect(stems('Как работать со схемой покинутости?')).toEqual(['покинутост']);
    expect(stems('что делать, если клиент в режиме Критика')).toEqual(['критик']);
    expect(stems('как работать со схемами и режимами')).toEqual([]);
    expect(stems('   ')).toEqual([]);
  });

  it('падежи одного слова дают один стем; «ё» и регистр не важны; повтор слова — один термин', () => {
    for (const form of ['покинутость', 'покинутости', 'покинутостью']) expect(stemRu(form)).toBe('покинутост');
    for (const form of ['ребенок', 'ребенка', 'ребенку', 'ребенком']) expect(stemRu(form)).toBe('ребенк');
    for (const form of ['карающий', 'карающего', 'карающим']) expect(stemRu(form)).toBe('карающ');
    expect(stems('Ребёнок ребёнка РЕБЕНКУ')).toEqual(['ребенк']);
  });

  it('короткое слово не срезается до огрызка', () => {
    expect(stemRu('гнев')).toBe('гнев');
    expect(stemRu('вина')).toBe('вин');
    expect(stemRu('ов')).toBe('ов');
  });
});

describe('findTerm', () => {
  const [term] = parseReferenceQuery('стыдом');

  it('находит слово текста в другом падеже и отдаёт его как есть — для куска абзаца', () => {
    expect(findTerm('Клиент говорит о Стыде и молчит.', term)).toBe('стыде');
    expect(findTerm('Гнев — сигнал.', term)).toBeNull();
  });

  it('недописанное слово находит по началу; подстрока в середине слова — только в нестрогом режиме', () => {
    expect(findTerm('Карающий Критик', parseReferenceQuery('крит')[0])).toBe('критик');
    expect(findTerm('Здоровый Взрослый', parseReferenceQuery('ослы')[0])).toBe('ослы');
    expect(findTerm('Здоровый Взрослый', parseReferenceQuery('ослы')[0], false)).toBeNull();
  });
});

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
