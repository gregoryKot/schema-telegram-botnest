// Перевод строк ClientMeeting на HMAC-ключ (аудит 2026-10). Шов с настоящей
// базой — test/booking-client-key.e2e-spec.ts; здесь ветки прохода: перенос,
// склейка ящиков, строка под новым ключом уже есть, сироты старого формата.
// Ключи читаются при загрузке модулей — грузим под ключом (loadWithKeys).
import { loadWithKeys } from '../test-support/load-with-keys';

type Svc = typeof import('./client-key-rekey.service');
type Keys = typeof import('./client-key');
const { mod, keys } = loadWithKeys({ key: 'ab'.repeat(32) }, () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod: require('./client-key-rekey.service') as Svc,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  keys: require('./client-key') as Keys,
}));
afterAll(() => delete process.env.ENCRYPTION_KEY);

const NOW = new Date('2026-10-22T12:00:00Z');
const OLD_ROW = new Date('2026-10-01T00:00:00Z');
const ROOM = 'enc-room-1';

interface B {
  id: number;
  createdAt: Date;
  clientContact: string;
  meetingUrl: string | null;
  anonymizedAt: Date | null;
}
interface R {
  clientKey: string;
  meetingUrl: string;
  createdAt: Date;
}
const booking = (id: number, contact: string, extra: Partial<B> = {}): B => ({
  id,
  createdAt: new Date(Date.UTC(2026, 0, id)),
  clientContact: contact, // plaintext: decrypt отдаёт как есть
  meetingUrl: ROOM,
  anonymizedAt: null,
  ...extra,
});

function setup(bookings: B[], rows: R[]) {
  const has = (k: string) => rows.some((r) => r.clientKey === k);
  const hit = (where: any) => (r: R) =>
    (where.clientKey?.in
      ? where.clientKey.in.includes(r.clientKey)
      : r.clientKey === where.clientKey) &&
    (where.meetingUrl === undefined || r.meetingUrl === where.meetingUrl) &&
    (where.createdAt === undefined || r.createdAt < where.createdAt.lt);
  const prisma = {
    booking: {
      findMany: jest.fn(({ where, take }: any) =>
        Promise.resolve(
          bookings
            // фильтр — по переданному where, а не копия фильтра сервиса:
            // иначе снятый в сервисе фильтр не заметил бы ни один тест
            .filter(
              (b) =>
                b.id > where.id.gt &&
                (!('anonymizedAt' in where) ||
                  b.anonymizedAt === where.anonymizedAt) &&
                (where.meetingUrl?.not !== null || b.meetingUrl !== null),
            )
            .sort((a, b) => a.id - b.id) // orderBy: { id: 'asc' }
            .slice(0, take),
        ),
      ),
    },
    clientMeeting: {
      findMany: jest.fn(() => Promise.resolve(rows.map((r) => ({ ...r })))),
      updateMany: jest.fn(({ where, data }: any) => {
        const found = rows.filter(hit(where));
        if (found.length && has(data.clientKey))
          return Promise.reject(
            Object.assign(new Error('dup'), { code: 'P2002' }),
          );
        found.forEach((r) => (r.clientKey = data.clientKey));
        return Promise.resolve({ count: found.length });
      }),
      deleteMany: jest.fn(({ where }: any) => {
        const gone = rows.filter(hit(where));
        gone.forEach((g) => rows.splice(rows.indexOf(g), 1));
        return Promise.resolve({ count: gone.length });
      }),
    },
  };
  const telegram = { notifyAdmin: jest.fn(() => Promise.resolve(true)) };
  const service = new mod.ClientKeyRekeyService(prisma as any, telegram as any);
  return { service, prisma, telegram, rows };
}

describe('ClientKeyRekeyService.run', () => {
  it('строка старого формата переезжает на новый ключ; повторный прогон ничего не меняет', async () => {
    const C = '+7 (999) 123-45-67';
    const { service, rows, telegram } = setup(
      [booking(1, C)],
      [
        {
          clientKey: keys.legacyClientKey(C),
          meetingUrl: ROOM,
          createdAt: OLD_ROW,
        },
      ],
    );
    expect(await service.run(NOW)).toMatchObject({
      moved: 1,
      dropped: 0,
      purged: 0,
    });
    expect(rows).toEqual([
      { clientKey: keys.clientKey(C), meetingUrl: ROOM, createdAt: OLD_ROW },
    ]);
    expect(await service.run(NOW)).toEqual({
      moved: 0,
      dropped: 0,
      purged: 0,
      shared: [],
      stale: [],
    });
    expect(telegram.notifyAdmin.mock.calls).toEqual([]);
  });

  it('склейка ящиков: комната остаётся за ранней бронью, владельцу — одно сообщение с номером поздней', async () => {
    const A = 'ivan-petrov@x.ru';
    const B2 = 'ivanpetrov@x.ru';
    expect(keys.legacyClientKey(A)).toBe(keys.legacyClientKey(B2));
    const { service, rows, telegram } = setup(
      [
        booking(7, B2, { createdAt: new Date('2026-05-02') }),
        booking(3, A, { createdAt: new Date('2026-05-01') }),
      ],
      [
        {
          clientKey: keys.legacyClientKey(A),
          meetingUrl: ROOM,
          createdAt: OLD_ROW,
        },
      ],
    );
    const stats = await service.run(NOW);
    expect(stats).toMatchObject({ moved: 1, shared: [7], stale: [] });
    expect(rows.map((r) => r.clientKey)).toEqual([keys.clientKey(A)]);
    expect(telegram.notifyAdmin.mock.calls).toHaveLength(1);
    expect(telegram.notifyAdmin.mock.calls[0]).toEqual([
      expect.stringContaining('№7'),
    ]);
    expect(String(telegram.notifyAdmin.mock.calls[0])).not.toContain('№3');
  });

  it('под новым ключом строка уже есть: она остаётся, старая снимается, брони — владельцу', async () => {
    const C = '@ivan_p';
    const fresh = {
      clientKey: keys.clientKey(C),
      meetingUrl: 'enc-room-2',
      createdAt: NOW,
    };
    const { service, rows, telegram } = setup(
      [booking(4, C)],
      [
        {
          clientKey: keys.legacyClientKey(C),
          meetingUrl: ROOM,
          createdAt: OLD_ROW,
        },
        fresh,
      ],
    );
    expect(await service.run(NOW)).toMatchObject({
      moved: 0,
      dropped: 1,
      stale: [4],
    });
    expect(rows).toEqual([fresh]);
    expect(telegram.notifyAdmin.mock.calls[0]).toEqual([
      expect.stringContaining('№4'),
    ]);
  });

  it('сироты: старый формат старше часа удаляется; моложе часа, новый формат и чужие ключи — нет', async () => {
    const legacyOld = {
      clientKey: keys.legacyClientKey('gone@x.ru'),
      meetingUrl: ROOM,
      createdAt: OLD_ROW,
    };
    const legacyFresh = {
      clientKey: keys.legacyClientKey('just@x.ru'),
      meetingUrl: ROOM,
      createdAt: new Date(NOW.getTime() - 60_000),
    };
    const prefixed = {
      clientKey: keys.clientKey('anon@x.ru'),
      meetingUrl: ROOM,
      createdAt: OLD_ROW,
    };
    const fixture = {
      clientKey: 'rot-e2e-client',
      meetingUrl: ROOM,
      createdAt: OLD_ROW,
    };
    const { service, rows } = setup(
      // обезличенная бронь и бронь без ссылки претендентами не считаются
      [
        booking(1, 'gone@x.ru', { anonymizedAt: OLD_ROW }),
        booking(2, 'gone@x.ru', { meetingUrl: null }),
      ],
      [legacyOld, legacyFresh, prefixed, fixture],
    );
    expect(await service.run(NOW)).toMatchObject({ purged: 1, moved: 0 });
    expect(rows).toEqual([legacyFresh, prefixed, fixture]);
  });

  it('HELD-бронь без ссылки от склеенного ящика — не претендент: строка удалена как сирота, сообщения нет', async () => {
    const VICTIM = 'ivan-petrov@x.ru';
    const GLUED = 'ivanpetrov@x.ru';
    const { service, prisma, rows, telegram } = setup(
      [booking(9, GLUED, { meetingUrl: null })],
      [
        {
          clientKey: keys.legacyClientKey(VICTIM),
          meetingUrl: ROOM,
          createdAt: OLD_ROW,
        },
      ],
    );
    expect(await service.run(NOW)).toEqual({
      moved: 0,
      dropped: 0,
      purged: 1,
      shared: [],
      stale: [],
    });
    expect(rows).toEqual([]);
    expect(telegram.notifyAdmin.mock.calls).toEqual([]);
    // сужение чтения на стороне БД: без него HELD-брони шли бы в расшифровку
    expect(prisma.booking.findMany.mock.calls[0][0].where).toEqual({
      id: { gt: 0 },
      anonymizedAt: null,
      meetingUrl: { not: null },
    });
  });

  it('бронь со ссылкой на другую комнату — не претендент: строку решает бронь с её ссылкой', async () => {
    const A = 'a@my-site.ru';
    const B2 = 'a@mysite.ru';
    // ранняя бронь A — со ссылкой из другой эпохи (статичный MEETING_URL),
    // комнату строки держит только поздняя бронь B2
    const { service, rows, telegram } = setup(
      [
        booking(1, A, { meetingUrl: 'enc-static', createdAt: OLD_ROW }),
        booking(2, B2, { createdAt: NOW }),
      ],
      [
        {
          clientKey: keys.legacyClientKey(A),
          meetingUrl: ROOM,
          createdAt: OLD_ROW,
        },
      ],
    );
    expect(await service.run(NOW)).toMatchObject({ moved: 1, shared: [] });
    expect(rows.map((r) => r.clientKey)).toEqual([keys.clientKey(B2)]);
    expect(telegram.notifyAdmin.mock.calls).toEqual([]);
  });

  it('под новым ключом строка уже есть: в сообщение идут только брони со ссылкой снятой строки', async () => {
    const C = 'both@x.ru';
    const { service, rows, telegram } = setup(
      [booking(5, C), booking(6, C, { meetingUrl: 'enc-room-2' })],
      [
        {
          clientKey: keys.legacyClientKey(C),
          meetingUrl: ROOM,
          createdAt: OLD_ROW,
        },
        {
          clientKey: keys.clientKey(C),
          meetingUrl: 'enc-room-2',
          createdAt: NOW,
        },
      ],
    );
    expect(await service.run(NOW)).toMatchObject({ dropped: 1, stale: [5] });
    expect(rows.map((r) => r.meetingUrl)).toEqual(['enc-room-2']);
    expect(String(telegram.notifyAdmin.mock.calls[0])).not.toContain('№6');
  });

  it('строку изменили между чтением и записью (count 0) — не тронута, сообщения нет', async () => {
    const C = 'late@x.ru';
    const { service, prisma, telegram } = setup(
      [booking(1, C)],
      [
        {
          clientKey: keys.legacyClientKey(C),
          meetingUrl: ROOM,
          createdAt: OLD_ROW,
        },
      ],
    );
    prisma.clientMeeting.updateMany.mockImplementationOnce(() =>
      Promise.resolve({ count: 0 }),
    );
    expect(await service.run(NOW)).toMatchObject({ moved: 0, dropped: 0 });
    expect(telegram.notifyAdmin.mock.calls).toEqual([]);
  });

  it('пачки броней читаются курсором по id до пустой страницы', async () => {
    const many = Array.from({ length: 501 }, (_, i) =>
      booking(i + 1, `c${i}@x.ru`),
    );
    const { service, prisma } = setup(many, []);
    await service.run(NOW);
    expect(
      prisma.booking.findMany.mock.calls.map((c: any[]) => c[0].where.id.gt),
    ).toEqual([0, 500, 501]);
  });
});

describe('ClientKeyRekeyService.onApplicationBootstrap', () => {
  it('ошибка прохода не роняет бут — уходит в лог error', async () => {
    const { service, prisma } = setup([], []);
    prisma.booking.findMany.mockImplementationOnce(() =>
      Promise.reject(new Error('db down')),
    );
    const error = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => undefined);
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(error.mock.calls[0][0]).toContain('db down');
  });
});
