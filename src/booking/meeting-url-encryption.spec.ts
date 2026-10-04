// D-9 (аудит 2026-10): Booking.meetingUrl и ClientMeeting.meetingUrl лежат в БД
// зашифрованными — Zoom-ссылка несёт `?pwd=`, по ней входят в комнату клиента.
// Проверяем связку запись → чтение (CLAUDE.md «read-after-write»): что реально
// уходит в БД, и что на каждом читателе (создание встречи, публичная проекция,
// .ics, админский список) человек/клиент получает рабочую ссылку.
//
// crypto.ts читает ENCRYPTION_KEY на загрузке, поэтому модули подгружаются
// через resetModules+require ПОСЛЕ установки ключа (как в волнах дошифровки) —
// иначе encrypt() был бы identity и тест ничего не доказывал.
import type { ConfigService } from '@nestjs/config';

const ZOOM = 'https://us02web.zoom.us/j/123456789?pwd=SECRETPWD';
const JITSI = 'https://meet.jit.si/schemehappens-abcdef123456';

/* eslint-disable @typescript-eslint/no-require-imports */
let crypto: typeof import('../utils/crypto');
let MeetingService: typeof import('./meeting.service').MeetingService;
let BookingNotifyService: typeof import('./booking-notify.service').BookingNotifyService;
let queries: typeof import('./booking.queries');
let ics: typeof import('./booking-ics');
let BOOKING_SCHEMA: typeof import('./booking.schema').BOOKING_SCHEMA;

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'cd'.repeat(32);
  process.env.NODE_ENV = 'test';
  jest.resetModules();
  crypto = require('../utils/crypto');
  MeetingService = require('./meeting.service').MeetingService;
  BookingNotifyService =
    require('./booking-notify.service').BookingNotifyService;
  queries = require('./booking.queries');
  ics = require('./booking-ics');
  BOOKING_SCHEMA = require('./booking.schema').BOOKING_SCHEMA;
});
/* eslint-enable @typescript-eslint/no-require-imports */

const TARGET = {
  id: 1,
  startsAt: new Date('2026-07-13T17:00:00Z'),
  durationMin: 50,
  type: 'SESSION_50' as const,
  clientName: 'Мария',
  clientContact: '@maria',
};

function meetingService(env: Record<string, string> = {}) {
  const store = new Map<string, Record<string, unknown>>();
  const prisma = {
    clientMeeting: {
      findUnique: jest.fn(({ where }: { where: { clientKey: string } }) =>
        Promise.resolve(store.get(where.clientKey) ?? null),
      ),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        store.set(data.clientKey as string, { ...data });
        return Promise.resolve(data);
      }),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { clientKey: string };
          data: Record<string, unknown>;
        }) => {
          Object.assign(store.get(where.clientKey)!, data);
          return Promise.resolve(data);
        },
      ),
    },
  };
  const config = { get: (k: string) => env[k] } as unknown as ConfigService;
  return {
    service: new MeetingService(prisma as never, config),
    prisma,
    store,
  };
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('MeetingService: ClientMeeting.meetingUrl зашифрован', () => {
  it('новая встреча: в БД шифротекст, клиенту возвращается рабочая ссылка', async () => {
    const { service, store } = meetingService();
    const url = await service.createMeeting(TARGET);

    expect(url).toMatch(/^https:\/\/meet\.jit\.si\//);
    const stored = [...store.values()][0].meetingUrl as string;
    expect(stored).not.toContain('meet.jit.si');
    expect(crypto.decrypt(stored)).toBe(url);
  });

  it('повторная сессия: ссылка читается из зашифрованной строки и совпадает', async () => {
    const { service, store } = meetingService();
    const first = await service.createMeeting(TARGET);
    expect([...store.values()][0].meetingUrl).not.toBe(first);

    expect(await service.createMeeting(TARGET)).toBe(first);
  });

  it('старая строка с открытой ссылкой (до волны 3) читается как есть', async () => {
    const { service, store } = meetingService();
    await service.createMeeting(TARGET);
    const row = [...store.values()][0];
    row.meetingUrl = ZOOM; // legacy plaintext
    row.zoomMeetingId = '123456789';

    expect(await service.createMeeting(TARGET)).toBe(ZOOM);
  });

  it('апгрейд Jitsi → Zoom находит Jitsi в ЗАШИФРОВАННОЙ строке и пишет новую ссылку зашифрованной', async () => {
    const { service, store } = meetingService();
    await service.createMeeting(TARGET); // Jitsi, без Zoom-конфига
    const key = [...store.keys()][0];
    const zoomOn = meetingService({
      ZOOM_ACCOUNT_ID: 'a',
      ZOOM_CLIENT_ID: 'b',
      ZOOM_CLIENT_SECRET: 'c',
    });
    zoomOn.store.set(key, store.get(key)!); // та же строка в БД
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 't' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ join_url: ZOOM, id: 123456789 }),
      }) as unknown as typeof fetch;

    expect(await zoomOn.service.createMeeting(TARGET)).toBe(ZOOM);
    const stored = zoomOn.store.get(key)!.meetingUrl as string;
    expect(stored).not.toContain('pwd=');
    expect(crypto.decrypt(stored)).toBe(ZOOM);
  });
});

describe('Booking.meetingUrl: запись и каждый читатель', () => {
  function encryptedBookingRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 5,
      status: 'CONFIRMED',
      type: 'SESSION_50',
      startsAt: new Date('2026-07-13T17:00:00Z'),
      durationMin: 50,
      cancelToken: 'tok',
      clientName: crypto.encrypt('Мария'),
      clientContact: crypto.encrypt('@maria'),
      message: null,
      meetingUrl: crypto.encrypt(ZOOM),
      ...overrides,
    };
  }

  it('BOOKING_SCHEMA шифрует meetingUrl', () => {
    expect(BOOKING_SCHEMA.strings).toContain('meetingUrl');
  });

  it('onConfirmed пишет в БД зашифрованную ссылку, а календарь и админ получают рабочую', async () => {
    const prisma = {
      booking: {
        update: jest.fn(() => Promise.resolve({})),
      },
    };
    const calDav = {
      enabled: true,
      pushEvent: jest.fn(() => Promise.resolve('uid-1')),
    };
    const meeting = { createMeeting: jest.fn(() => Promise.resolve(ZOOM)) };
    const telegram = { notifyAdmin: jest.fn(() => Promise.resolve(true)) };
    const email = { sendAdminNotification: jest.fn(() => Promise.resolve()) };
    const svc = new BookingNotifyService(
      prisma as never,
      telegram as never,
      calDav as never,
      meeting as never,
      email as never,
      { get: () => undefined } as unknown as ConfigService,
      { claimRun: jest.fn() } as never,
    );

    await svc.onConfirmed({
      id: 5,
      startsAt: new Date('2026-07-13T17:00:00Z'),
      durationMin: 50,
      type: 'SESSION_50',
      clientName: 'Мария',
      clientContact: '@maria',
      message: null,
      meetingUrl: null,
      cancelToken: 'tok',
    });

    const saved = (
      prisma.booking.update.mock.calls[0] as unknown as [
        { data: { meetingUrl: string } },
      ]
    )[0].data.meetingUrl;
    expect(saved).not.toContain('pwd=');
    expect(crypto.decrypt(saved)).toBe(ZOOM);
    expect(calDav.pushEvent.mock.calls[0]).toEqual([
      expect.objectContaining({ location: ZOOM }),
    ]);
    expect(telegram.notifyAdmin.mock.calls[0][0]).toContain(ZOOM);
  });

  it('публичная проекция по cancel-токену отдаёт расшифрованную ссылку', async () => {
    const prisma = {
      booking: {
        findUnique: jest.fn(() => Promise.resolve(encryptedBookingRow())),
      },
    };
    const view = await queries.getPublicBookingByToken(prisma as never, 'tok');
    expect(view.meetingUrl).toBe(ZOOM);
  });

  it('.ics для клиента несёт рабочую ссылку, а не шифротекст', async () => {
    const row = encryptedBookingRow();
    const prisma = {
      booking: { findUnique: jest.fn(() => Promise.resolve(row)) },
    };
    const text = await ics.buildBookingIcsText(
      prisma as never,
      'tok',
      'https://schemehappens.ru',
    );
    expect(text).toContain('SECRETPWD');
    expect(text).not.toContain(row.meetingUrl as string);
  });

  it('админский список и getBookingById расшифровывают meetingUrl', async () => {
    const prisma = {
      booking: {
        findMany: jest.fn(() => Promise.resolve([encryptedBookingRow()])),
        findUnique: jest.fn(() => Promise.resolve(encryptedBookingRow())),
      },
    };
    const [listed] = await queries.listBookings(
      prisma as never,
      BOOKING_SCHEMA,
      'all',
    );
    expect(listed.meetingUrl).toBe(ZOOM);
    const one = await queries.getBookingById(
      prisma as never,
      BOOKING_SCHEMA,
      5,
    );
    expect(one.meetingUrl).toBe(ZOOM);
  });

  it('старая строка с открытой ссылкой читается везде как есть (до дошифровки)', async () => {
    const prisma = {
      booking: {
        findUnique: jest.fn(() =>
          Promise.resolve(encryptedBookingRow({ meetingUrl: ZOOM })),
        ),
      },
    };
    expect(
      (await queries.getPublicBookingByToken(prisma as never, 'tok'))
        .meetingUrl,
    ).toBe(ZOOM);
  });
});
