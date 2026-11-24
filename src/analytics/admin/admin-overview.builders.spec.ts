import {
  bucketByDay,
  buildDaily,
  buildFeatures,
  windowDates,
} from './admin-overview.builders';

describe('windowDates', () => {
  it('days дней без пропусков, последний — сегодня', () => {
    const d = windowDates(7, '2026-03-02');
    expect(d).toHaveLength(7);
    expect(d[0]).toBe('2026-02-24');
    expect(d[6]).toBe('2026-03-02');
  });
});

describe('bucketByDay', () => {
  it('считает по дням МСК: 21:30 UTC уже следующий день', () => {
    const dates = windowDates(3, '2026-06-10');
    const out = bucketByDay(dates, [
      new Date('2026-06-09T21:30:00Z'), // 10-е по Москве
      new Date('2026-06-10T08:00:00Z'),
      new Date('2026-06-01T00:00:00Z'), // вне окна
    ]);
    expect(out).toEqual([0, 0, 2]);
  });

  it('пустой вход — нули', () => {
    expect(bucketByDay(windowDates(3, '2026-06-10'), [])).toEqual([0, 0, 0]);
  });
});

describe('buildDaily', () => {
  it('пустая база: длина = days, везде нули', () => {
    const dates = windowDates(30, '2026-06-10');
    const daily = buildDaily(dates, {
      active: new Map(),
      newUsers: bucketByDay(dates, []),
      events: new Map(),
    });
    expect(daily).toHaveLength(30);
    expect(daily.every((p) => p.active + p.newUsers + p.events === 0)).toBe(
      true,
    );
  });

  it('подставляет значения по дате', () => {
    const dates = windowDates(2, '2026-06-10');
    const daily = buildDaily(dates, {
      active: new Map([['2026-06-10', 5]]),
      newUsers: [1, 2],
      events: new Map([['2026-06-09', 7]]),
    });
    expect(daily).toEqual([
      { date: '2026-06-09', active: 0, newUsers: 1, events: 7 },
      { date: '2026-06-10', active: 5, newUsers: 2, events: 0 },
    ]);
  });
});

describe('buildFeatures', () => {
  it('склеивает события одной фичи, люди — разные, анонимные без людей', () => {
    const rows = [
      { name: 'share_card', userId: 1n, count: 3 },
      { name: 'share_result', userId: 1n, count: 1 },
      { name: 'share_result', userId: 2n, count: 1 },
      { name: 'crisis_card_shown', userId: null, count: 9 },
      { name: 'client_error', userId: 3n, count: 2 },
    ];
    expect(buildFeatures(rows)).toEqual([
      { id: 'crisis', title: 'Кризисная карточка', events: 9, users: 0 },
      { id: 'share', title: 'Поделиться карточкой', events: 5, users: 2 },
      { id: 'other', title: 'Другое', events: 2, users: 1 },
    ]);
  });

  it('пустая база — пусто', () => {
    expect(buildFeatures([])).toEqual([]);
  });
});
