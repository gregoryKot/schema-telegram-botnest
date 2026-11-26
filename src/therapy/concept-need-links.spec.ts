// Нормализация колеса потребностей (concept-need-links.ts) — одна на запись и
// на чтение: только потребности из NEED_IDS, без дублей, оценки — целые 0–10,
// заметки — строки. Чтение колонки не падает ни на строке без поля, ни на
// битом значении: пустое колесо, а не 500 на GET концептуализации.
import { NEED_IDS } from '../bot/bot.service';
import { loadWithKeys } from '../test-support/load-with-keys';
import { NEED_PERIODS, normalizeNeedLinks } from './concept-need-links';

describe('normalizeNeedLinks', () => {
  it('полная запись проходит как есть', () => {
    const link = {
      needId: 'autonomy',
      ratings: { child: 0, teen: 5, now: 10 },
      notes: { child: 'решали за меня', teen: 'бунт', now: 'выбираю сама' },
    };
    expect(normalizeNeedLinks([link])).toEqual([link]);
  });

  it('неизвестная потребность и запись без needId отброшены', () => {
    expect(
      normalizeNeedLinks([
        { needId: 'safety', ratings: { now: 5 } },
        { ratings: { now: 5 } },
        { needId: 'limits', ratings: { now: 5 } },
      ]),
    ).toEqual([{ needId: 'limits', ratings: { now: 5 }, notes: {} }]);
  });

  it('дубль — остаётся первая запись; порядок — как в NEED_IDS', () => {
    const out = normalizeNeedLinks([
      { needId: 'limits', ratings: { now: 1 } },
      { needId: 'attachment', ratings: { now: 2 } },
      { needId: 'limits', ratings: { now: 9 }, notes: { now: 'вторая' } },
    ]);
    expect(out).toEqual([
      { needId: 'attachment', ratings: { now: 2 }, notes: {} },
      { needId: 'limits', ratings: { now: 1 }, notes: {} },
    ]);
  });

  it('оценка — только целое 0–10: 11, −1, 7.5, строка и null не проходят', () => {
    const bad = [11, -1, 7.5, '7', null, NaN, true];
    for (const v of bad)
      expect(
        normalizeNeedLinks([{ needId: 'play', ratings: { child: v, now: 3 } }]),
      ).toEqual([{ needId: 'play', ratings: { now: 3 }, notes: {} }]);
    // Ноль — оценка, а не «не оценено».
    expect(
      normalizeNeedLinks([{ needId: 'play', ratings: { now: 0 } }]),
    ).toEqual([{ needId: 'play', ratings: { now: 0 }, notes: {} }]);
  });

  it('заметка — только непустая строка; чужой период отброшен', () => {
    expect(
      normalizeNeedLinks([
        {
          needId: 'expression',
          ratings: { adult: 5 },
          notes: { child: 'молчала', teen: '', now: 42, adult: 'лишнее' },
        },
      ]),
    ).toEqual([
      { needId: 'expression', ratings: {}, notes: { child: 'молчала' } },
    ]);
  });

  it('потребность без единой оценки и заметки в колесо не попадает', () => {
    expect(
      normalizeNeedLinks([
        { needId: 'play', ratings: {}, notes: {} },
        { needId: 'limits' },
        { needId: 'autonomy', ratings: null, notes: 'не объект' },
      ]),
    ).toEqual([]);
  });

  it('не массив и мусор в элементах — пустое колесо', () => {
    for (const raw of [undefined, null, 'x', 7, {}, [null, 'x', 1, []]])
      expect(normalizeNeedLinks(raw)).toEqual([]);
  });

  it('периодов три, потребностей пять — колесо не больше пяти записей', () => {
    expect([...NEED_PERIODS]).toEqual(['child', 'teen', 'now']);
    const all = NEED_IDS.map((needId) => ({ needId, ratings: { now: 5 } }));
    expect(normalizeNeedLinks([...all, ...all])).toHaveLength(5);
  });
});

// Под настоящим ключом: без него encrypt() — identity и «расшифровал» ничего
// бы не доказывало.
describe('readNeedLinks / encryptNeedLinks — значение колонки', () => {
  const { readNeedLinks, encryptNeedLinks, crypto } = loadWithKeys(
    { key: 'ab'.repeat(32) },
    () => ({
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ...(require('./concept-need-links') as typeof import('./concept-need-links')),
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      crypto: require('../utils/crypto') as typeof import('../utils/crypto'),
    }),
  );
  const WHEEL = [
    { needId: 'attachment', ratings: { child: 3 }, notes: { child: 'одна' } },
  ];

  it('шифротекст → колесо; в шифротексте нет открытого текста', () => {
    const stored = encryptNeedLinks(WHEEL);
    expect(stored).not.toContain('одна');
    expect(stored).not.toContain('attachment');
    expect(crypto.tryDecrypt(stored).ok).toBe(true);
    expect(readNeedLinks(stored)).toEqual(WHEEL);
  });

  it('строка без поля, дефолт колонки и null — пустое колесо', () => {
    for (const stored of [undefined, null, []])
      expect(readNeedLinks(stored)).toEqual([]);
  });

  it('битое значение — пустое колесо, а не исключение', () => {
    const notArray = crypto.encryptJson({ needId: 'play' });
    for (const stored of ['не json', '{"a":1}', notArray, 42, { a: 1 }])
      expect(readNeedLinks(stored)).toEqual([]);
  });

  it('значение, лежащее массивом (без шифрования), нормализуется так же', () => {
    const dirty = [...WHEEL, { needId: 'safety', ratings: { now: 1 } }];
    expect(readNeedLinks(dirty)).toEqual(WHEEL);
    expect(readNeedLinks(JSON.stringify(dirty))).toEqual(WHEEL);
  });
});
