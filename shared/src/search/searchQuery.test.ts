// Разбор запроса поиска: служебные слова, стемы, поиск слова в тексте (палитра ⌘K и «Справочник» терапевта).
import { describe, it, expect } from 'vitest';
import { findTerm, parseSearchQuery, stemRu } from './searchQuery';

const stems = (query: string) => parseSearchQuery(query).map((t) => t.stem);

describe('parseSearchQuery', () => {
  it('служебные и родовые слова выпадают в любой форме; запрос только из них — пусто', () => {
    expect(stems('Как работать со схемой покинутости?')).toEqual([
      'покинутост',
    ]);
    expect(stems('что делать, если клиент в режиме Критика')).toEqual([
      'критик',
    ]);
    expect(stems('как работать со схемами и режимами')).toEqual([]);
    expect(stems('   ')).toEqual([]);
  });

  it('падежи одного слова дают один стем; «ё» и регистр не важны; повтор слова — один термин', () => {
    for (const form of ['покинутость', 'покинутости', 'покинутостью'])
      expect(stemRu(form)).toBe('покинутост');
    for (const form of ['ребенок', 'ребенка', 'ребенку', 'ребенком'])
      expect(stemRu(form)).toBe('ребенк');
    for (const form of ['карающий', 'карающего', 'карающим'])
      expect(stemRu(form)).toBe('карающ');
    expect(stems('Ребёнок ребёнка РЕБЕНКУ')).toEqual(['ребенк']);
  });

  it('короткое слово не срезается до огрызка', () => {
    expect(stemRu('гнев')).toBe('гнев');
    expect(stemRu('вина')).toBe('вин');
    expect(stemRu('ов')).toBe('ов');
  });
});

describe('findTerm', () => {
  const [term] = parseSearchQuery('стыдом');

  it('находит слово текста в другом падеже и отдаёт его как есть — для куска абзаца', () => {
    expect(findTerm('Клиент говорит о Стыде и молчит.', term)).toBe('стыде');
    expect(findTerm('Гнев — сигнал.', term)).toBeNull();
  });

  it('недописанное слово находит по началу; подстрока в середине слова — только в нестрогом режиме', () => {
    expect(findTerm('Карающий Критик', parseSearchQuery('крит')[0])).toBe(
      'критик',
    );
    expect(findTerm('Здоровый Взрослый', parseSearchQuery('ослы')[0])).toBe(
      'ослы',
    );
    expect(
      findTerm('Здоровый Взрослый', parseSearchQuery('ослы')[0], false),
    ).toBeNull();
  });
});
