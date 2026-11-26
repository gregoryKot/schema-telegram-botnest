// /reissue_icloud на РЕАЛЬНОМ Postgres: юнит-спек гоняет выборку и CAS на
// where-матчере в памяти, а здесь окно срока хранения, четыре признака события
// и условие CAS считает СУБД. iCloud — подменённый fetch.
// Изоляция: «сейчас» — 2201 год, в окно попадают только фикстуры этого спека
// (startsAt с 2200-06-15); метка и чистка — по префиксу cancelToken.
import { ConfigService } from '@nestjs/config';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { CalDavService } from '../src/booking/caldav.service';
import { bookingEventUid } from '../src/booking/caldav-owner-event';
import { LegacyUidReissueCommand } from '../src/booking/legacy-uid-reissue.command';
import { legacyEventUid } from '../src/booking/legacy-uid-reissue';

const MARK = 'e2e-legacy-uid-';
const NOW = new Date('2201-06-15T10:00:00.000Z');
const CAL = 'https://p1.icloud.com/cal/';
const ENV: Record<string, string> = {
  APPLE_ID: 'x@icloud.com',
  APPLE_APP_PASSWORD: 'pw',
  APPLE_CALDAV_URL: CAL,
};
const { CONFIRMED, COMPLETED, CANCELLED } = BookingStatus;
const ics = (uid: string) => `${uid}.ics`;

type Extra = { paidAt?: Date; meetingUrl?: string };
// [метка, начало, статус, старый UID записан в брони, прочие признаки события]
const FIXTURES: [string, string, BookingStatus, boolean, Extra?][] = [
  ['future', '2201-07-01T17:00:00Z', CONFIRMED, true], // перевыпуск
  ['past', '2201-03-01T17:00:00Z', COMPLETED, true], // в сроке — перевыпуск
  ['expired', '2200-01-15T17:00:00Z', COMPLETED, true], // старше срока — мимо
  ['cancelled', '2201-07-05T17:00:00Z', CANCELLED, true], // признак: uid
  ['refused', '2201-07-10T17:00:00Z', CONFIRMED, false], // признак: статус
  ['paid', '2201-07-12T17:00:00Z', CANCELLED, false, { paidAt: NOW }],
  ['linked', '2201-07-14T17:00:00Z', CANCELLED, false, { meetingUrl: 'enc:x' }],
  ['abandoned', '2201-07-16T17:00:00Z', CANCELLED, false], // события не было
];

describe('/reissue_icloud на реальном Postgres: выборка броней и CAS uid', () => {
  let prisma: PrismaService;
  const ids: Record<string, number> = {};
  const events = new Set<string>();
  let calls: { method: string; key: string }[] = [];
  let onPut: (key: string) => Promise<void> = async () => undefined;
  const originalFetch = global.fetch;

  async function fakeFetch(url: string, init: RequestInit = {}) {
    const method = init.method ?? 'GET';
    const key = url.slice(CAL.length);
    calls.push({ method, key });
    let status = 500;
    if (method === 'PUT') {
      await onPut(key);
      events.add(key);
      status = 201;
    } else if (method === 'DELETE') status = events.delete(key) ? 204 : 404;
    return { ok: status < 300, status, text: () => Promise.resolve('') };
  }

  async function createBooking([
    tag,
    startsAt,
    status,
    legacy,
    extra,
  ]: (typeof FIXTURES)[number]): Promise<number> {
    const { id } = await prisma.booking.create({
      data: {
        startsAt: new Date(startsAt),
        durationMin: 50,
        status,
        clientName: 'e2e',
        clientContact: 'e2e',
        cancelToken: MARK + tag,
        ...extra,
      },
      select: { id: true },
    });
    if (legacy) {
      await prisma.booking.update({
        where: { id },
        data: { calDavUid: legacyEventUid(id) },
      });
      events.add(ics(legacyEventUid(id)));
    }
    return (ids[tag] = id);
  }

  const run = (live: boolean) => {
    const config = { get: (k: string) => ENV[k] } as unknown as ConfigService;
    const cmd = new LegacyUidReissueCommand(
      prisma,
      new CalDavService(config),
      null,
    );
    cmd.pauseMs = 0;
    return cmd.report(live, NOW);
  };
  /** Метки броней, по адресу которых ушёл запрос `method`. */
  const hit = (method: string, uid: (id: number) => string) =>
    Object.keys(ids)
      .filter((t) =>
        calls.some((c) => c.method === method && c.key === ics(uid(ids[t]))),
      )
      .sort();
  const uidsByTag = async () => {
    const rows = await prisma.booking.findMany({
      where: { cancelToken: { startsWith: MARK } },
      select: { cancelToken: true, calDavUid: true },
    });
    return Object.fromEntries(
      rows.map((r) => [r.cancelToken.slice(MARK.length), r.calDavUid]),
    );
  };
  const cleanup = () =>
    prisma.booking.deleteMany({ where: { cancelToken: { startsWith: MARK } } });

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await cleanup();
    for (const f of FIXTURES) await createBooking(f);
    global.fetch = jest.fn(fakeFetch);
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await cleanup();
    await prisma.$disconnect();
  });

  it('боевой: СУБД берёт брони в сроке по четырём признакам, CAS пишет новый uid', async () => {
    const text = await run(true);
    expect(text).toContain(
      'перевыпущено 2, снято старых без замены 1, по старому адресу пусто 3, ошибок 0',
    );
    expect(text).toContain('событий с номером брони в UID осталось 0');
    expect(hit('PUT', bookingEventUid)).toEqual(['future', 'past']);
    expect(hit('DELETE', legacyEventUid)).toEqual(
      ['cancelled', 'future', 'linked', 'paid', 'past', 'refused'].sort(),
    );
    expect(await uidsByTag()).toEqual({
      future: bookingEventUid(ids.future),
      past: bookingEventUid(ids.past),
      expired: legacyEventUid(ids.expired),
      cancelled: legacyEventUid(ids.cancelled),
      refused: null,
      paid: null,
      linked: null,
      abandoned: null,
    });
  });

  it('сохранил → нашёл: выборка читает записанный uid, перевыпускать нечего', async () => {
    calls = [];
    const text = await run(false);
    expect(text).toContain(
      'будет перевыпущено 0, будет проверено старых адресов 6',
    );
    expect(calls).toEqual([]);
  });

  it('CAS: бронь отменили, пока шёл PUT, — uid в базе прежний, новое событие снято', async () => {
    const id = await createBooking([
      'race',
      '2201-07-20T17:00:00Z',
      CONFIRMED,
      true,
    ]);
    onPut = async (key) => {
      if (key === ics(bookingEventUid(id)))
        await prisma.booking.update({
          where: { id },
          data: { status: CANCELLED },
        });
    };
    const text = await run(true);
    expect(text).toContain('перевыпущено 0');
    expect(text).toContain('ошибок 1');
    expect(text).toContain('с номером брони в UID осталось не больше 1');
    expect((await uidsByTag()).race).toBe(legacyEventUid(id));
    expect(events.has(ics(bookingEventUid(id)))).toBe(false);
  });
});
