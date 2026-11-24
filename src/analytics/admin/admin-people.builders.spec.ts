import {
  NO_NAME,
  buildPeopleRows,
  resolveName,
  topPeople,
} from './admin-people.builders';

describe('resolveName', () => {
  it('заявка, затем имя, затем заглушка', () => {
    expect(resolveName('Анна Иванова', 'Аня')).toBe('Анна Иванова');
    expect(resolveName(null, ' Аня ')).toBe('Аня');
    expect(resolveName('  ', null)).toBe(NO_NAME);
    expect(resolveName(undefined, undefined)).toBe(NO_NAME);
  });
});

describe('topPeople', () => {
  const rows = [
    { name: 'share_card', userId: 1n, count: 2 },
    { name: 'warm_words_open', userId: 1n, count: 5 },
    { name: 'breath_start', userId: 1n, count: 1 },
    { name: 'journey_open', userId: 1n, count: 1 },
    { name: 'share_card', userId: 2n, count: 20 },
    { name: 'crisis_card_shown', userId: null, count: 99 },
  ];

  it('сортирует по числу действий, берёт три фичи, анонимных пропускает', () => {
    const top = topPeople(rows);
    expect(top.map((p) => p.userId)).toEqual([2n, 1n]);
    expect(top[1].events).toBe(9);
    expect(top[1].top).toEqual([
      { title: 'Тёплые слова', count: 5 },
      { title: 'Поделиться карточкой', count: 2 },
      { title: 'Дыхание и «Стоп»', count: 1 },
    ]);
  });

  it('обрезает по лимиту; пусто — пусто', () => {
    expect(topPeople(rows, 1)).toHaveLength(1);
    expect(topPeople([])).toEqual([]);
  });
});

describe('buildPeopleRows', () => {
  it('без сведений о человеке — безымянный клиент без заходов', () => {
    const top = topPeople([{ name: 'share_card', userId: 7n, count: 1 }]);
    expect(buildPeopleRows(top, new Map())[0]).toMatchObject({
      id: '7',
      name: NO_NAME,
      role: 'CLIENT',
      activeDays: 0,
      lastActive: null,
      events: 1,
    });
  });
});
