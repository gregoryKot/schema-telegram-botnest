// Последние тики расписания — основа пробы аренд (cron-lease-verdict.ts).
// Зонно-независимо (правило №25): CI гоняет jest под UTC и под
// TZ=Australia/Sydney, поэтому ожидания для кронов без `timeZone` считаются
// через локальный конструктор Date, а для кронов с явной зоной — моментами UTC.
import { latestTicks } from './cron-ticks';

const iso = (ds: Date[] | null) => ds?.map((d) => d.toISOString()) ?? null;
const local = (...a: [number, number, number, number, number]) =>
  new Date(...a).toISOString();

describe('latestTicks — явная зона Europe/Moscow (кроны канала)', () => {
  const MORNING = '*/5 9,10 * * *';

  it('до окна — два последних тика вчерашнего окна (10:55 и 10:50 МСК)', () => {
    const at = new Date('2026-10-18T04:43:00Z'); // 07:43 МСК
    expect(iso(latestTicks(MORNING, at, 'Europe/Moscow'))).toEqual([
      '2026-10-17T07:55:00.000Z',
      '2026-10-17T07:50:00.000Z',
    ]);
  });

  it('внутри окна — тики этого окна', () => {
    const at = new Date('2026-10-18T06:12:30Z'); // 09:12:30 МСК
    expect(iso(latestTicks(MORNING, at, 'Europe/Moscow'))).toEqual([
      '2026-10-18T06:10:00.000Z',
      '2026-10-18T06:05:00.000Z',
    ]);
  });

  it('ровно в момент тика — тик уже считается', () => {
    const at = new Date('2026-10-18T06:00:00Z'); // 09:00 МСК, первый тик
    expect(iso(latestTicks(MORNING, at, 'Europe/Moscow'))).toEqual([
      '2026-10-18T06:00:00.000Z',
      '2026-10-17T07:55:00.000Z',
    ]);
  });

  it('вечернее окно: после полуночи UTC — тики вчерашнего вечера', () => {
    const at = new Date('2026-10-18T04:43:00Z');
    expect(iso(latestTicks('*/5 18,19 * * *', at, 'Europe/Moscow'))).toEqual([
      '2026-10-17T16:55:00.000Z',
      '2026-10-17T16:50:00.000Z',
    ]);
  });

  it('count — сколько тиков вернуть', () => {
    const at = new Date('2026-10-18T06:12:30Z');
    expect(iso(latestTicks(MORNING, at, 'Europe/Moscow', 3))).toEqual([
      '2026-10-18T06:10:00.000Z',
      '2026-10-18T06:05:00.000Z',
      '2026-10-18T06:00:00.000Z',
    ]);
  });
});

describe('latestTicks — без зоны: локальное время процесса, как у @Cron без timeZone', () => {
  it('* * * * * — две последние целые минуты', () => {
    const at = new Date(2026, 9, 18, 12, 34, 56);
    expect(iso(latestTicks('* * * * *', at))).toEqual([
      local(2026, 9, 18, 12, 34),
      local(2026, 9, 18, 12, 33),
    ]);
  });

  it('7 * * * * — седьмая минута двух последних часов', () => {
    const at = new Date(2026, 9, 18, 12, 5);
    expect(iso(latestTicks('7 * * * *', at))).toEqual([
      local(2026, 9, 18, 11, 7),
      local(2026, 9, 18, 10, 7),
    ]);
  });

  it('0 0 * * * — две последние полуночи, через границу месяца', () => {
    const at = new Date(2026, 10, 1, 0, 0, 30);
    expect(iso(latestTicks('0 0 * * *', at))).toEqual([
      local(2026, 10, 1, 0, 0),
      local(2026, 9, 31, 0, 0),
    ]);
  });

  it('17 3 * * * до тика — вчера и позавчера', () => {
    const at = new Date(2026, 9, 18, 2, 0);
    expect(iso(latestTicks('17 3 * * *', at))).toEqual([
      local(2026, 9, 17, 3, 17),
      local(2026, 9, 16, 3, 17),
    ]);
  });
});

describe('latestTicks — зоны с переходом на летнее время', () => {
  it('Australia/Sydney: тики по обе стороны перехода AEST→AEDT (2026-10-04) — разное смещение', () => {
    const at = new Date('2026-10-04T00:00:00Z'); // 11:00 AEDT 4 октября
    expect(iso(latestTicks('0 9 * * *', at, 'Australia/Sydney'))).toEqual([
      '2026-10-03T22:00:00.000Z', // 09:00 AEDT (+11)
      '2026-10-02T23:00:00.000Z', // 09:00 AEST (+10)
    ]);
  });

  it('Europe/Berlin: полдень по обе стороны перехода CEST→CET (2026-10-25)', () => {
    const at = new Date('2026-10-25T12:00:00Z');
    expect(iso(latestTicks('0 12 * * *', at, 'Europe/Berlin'))).toEqual([
      '2026-10-25T11:00:00.000Z', // 12:00 CET (+1)
      '2026-10-24T10:00:00.000Z', // 12:00 CEST (+2)
    ]);
  });

  // Осознанное поведение в минуту перехода (см. шапку cron-ticks.ts): не
  // точная модель планировщика, а предсказуемый ответ, ошибающийся не больше
  // чем на один тик.
  it('весной несуществующая 02:30 уезжает на час вперёд (03:30 CEST)', () => {
    const at = new Date('2026-03-29T12:00:00Z');
    expect(iso(latestTicks('30 2 * * *', at, 'Europe/Berlin'))).toEqual([
      '2026-03-29T01:30:00.000Z', // 03:30 CEST
      '2026-03-28T01:30:00.000Z', // 02:30 CET
    ]);
  });

  it('осенью двойная 02:30 даёт один момент — второй, уже по CET', () => {
    const at = new Date('2026-10-25T12:00:00Z');
    expect(iso(latestTicks('30 2 * * *', at, 'Europe/Berlin'))).toEqual([
      '2026-10-25T01:30:00.000Z', // 02:30 CET
      '2026-10-24T00:30:00.000Z', // 02:30 CEST
    ]);
  });
});

describe('latestTicks — расписание не суточное', () => {
  it.each(['0 0 1 * *', '0 0 * 1 *', '0 9 * * 1', '0 0 * *'])(
    '«%s» → null (вызывающий судит по возрасту аренды)',
    (expr) => {
      expect(latestTicks(expr, new Date('2026-10-18T00:00:00Z'))).toBeNull();
    },
  );
});
