// Разовая чистка iCloud и Zoom (запрос РКН №08-1063539). Шов: настоящие
// ForeignScrubCommand + CalDavService + MeetingService, подменён fetch (и
// поддельная Prisma вместо базы). В запросах нет данных клиента; повтор безопасен.
import { ConfigService } from '@nestjs/config';
import { BookingStatus, SessionType } from '@prisma/client';
import { CalDavService } from './caldav.service';
import { MeetingService, ZOOM_TOPIC } from './meeting.service';
import { ForeignScrubCommand } from './foreign-scrub.command';
import type { PrismaService } from '../prisma/prisma.service';

const SECRETS = ['Евлампия Маркерова', '+79991234567', 'тревога-маркер'];
const NOW = new Date('2026-11-13T10:00:00Z');
const CAL = 'https://p1.icloud.com/cal/';

const ENV: Record<string, string> = {
  APPLE_ID: 'x@icloud.com',
  APPLE_APP_PASSWORD: 'pw',
  APPLE_CALDAV_URL: CAL,
  ZOOM_ACCOUNT_ID: 'acc',
  ZOOM_CLIENT_ID: 'cid',
  ZOOM_CLIENT_SECRET: 'sec',
};

// В брони лежат данные клиента — поддельная Prisma отдаёт их и в select мимо:
// так тест ловит утечку, даже если код начнёт брать лишнее.
const row = (id: number, startsAt: string, status: BookingStatus) => ({
  id,
  startsAt: new Date(startsAt),
  durationMin: 50,
  type: SessionType.SESSION_50,
  status,
  calDavUid: `booking-${id}@schemehappens.ru`,
  clientName: SECRETS[0],
  clientContact: SECRETS[1],
  message: SECRETS[2],
});
const BOOKINGS = [
  row(1, '2026-12-01T17:00:00Z', BookingStatus.CONFIRMED), // будущая — PUT
  row(2, '2026-03-01T17:00:00Z', BookingStatus.COMPLETED), // в сроке — PUT
  row(3, '2025-06-01T17:00:00Z', BookingStatus.COMPLETED), // старше 12 мес — DELETE
  row(4, '2026-12-05T17:00:00Z', BookingStatus.CANCELLED), // отменена — DELETE
];

const prisma = {
  booking: { findMany: jest.fn(async () => BOOKINGS) },
  clientMeeting: {
    findMany: jest.fn(async () => [
      { zoomMeetingId: '111' },
      { zoomMeetingId: '222' },
      { zoomMeetingId: '333' },
      { zoomMeetingId: '111' }, // дубль комнаты — один запрос
    ]),
  },
} as unknown as PrismaService;

// Поддельные площадки: iCloud хранит события, Zoom — названия комнат.
let events: Map<string, string>;
let topics: Map<string, string>;
let calls: { url: string; method: string; body: string }[];

function fakeFetch(url: string, init: RequestInit = {}) {
  const method = init.method ?? 'GET';
  const body = typeof init.body === 'string' ? init.body : '';
  calls.push({ url, method, body });
  const res = (status: number, json: unknown = {}) =>
    Promise.resolve({
      ok: status < 300,
      status,
      json: () => Promise.resolve(json),
      text: () => Promise.resolve(''),
    });
  if (url.startsWith('https://zoom.us/oauth/token'))
    return res(200, { access_token: 't' });
  if (url.startsWith(CAL)) {
    const key = url.slice(CAL.length);
    if (method === 'PUT') return (events.set(key, body), res(201));
    if (method === 'DELETE') return res(events.delete(key) ? 204 : 404);
  }
  const zoom = /\/v2\/meetings\/(\d+)$/.exec(url);
  if (zoom) {
    const id = zoom[1];
    if (!topics.has(id)) return res(404);
    if (method === 'GET') return res(200, { topic: topics.get(id) });
    if (method === 'PATCH') {
      topics.set(id, (JSON.parse(body) as { topic: string }).topic);
      return res(204);
    }
  }
  return res(500);
}

const config = { get: (k: string) => ENV[k] } as unknown as ConfigService;
function makeCommand() {
  const cmd = new ForeignScrubCommand(
    null,
    prisma,
    new CalDavService(config),
    new MeetingService(prisma, config),
  );
  cmd.pauseMs = 0;
  return cmd;
}

const originalFetch = global.fetch;
beforeEach(() => {
  events = new Map(
    BOOKINGS.slice(0, 3).map((b) => [
      `${b.calDavUid}.ics`,
      `SUMMARY:${SECRETS[0]}`,
    ]),
  );
  topics = new Map([
    ['111', `Сессии — ${SECRETS[0]}`],
    ['222', ZOOM_TOPIC],
  ]); // 333 удалена в Zoom
  calls = [];
  global.fetch = jest.fn(fakeFetch);
});
afterEach(() => {
  global.fetch = originalFetch;
});

describe('ForeignScrubCommand: разовая чистка iCloud и Zoom', () => {
  it('сухой прогон: только счётчики, ничего не пишет', async () => {
    const text = await makeCommand().report(false, NOW);
    expect(
      calls.filter((c) => c.method !== 'GET' && !c.url.includes('oauth')),
    ).toEqual([]);
    expect(text).toContain('будет перезаписано 2, будет удалено 2');
    expect(text).toContain(
      'будет переименовано 1, уже без имени 1, комнаты нет 1',
    );
    expect(text).toContain('/scrub_foreign go');
  });

  it('боевой: перезапись по тому же UID, удаление старых и отменённых, переименование', async () => {
    const text = await makeCommand().report(true, NOW);
    expect(text).toContain(
      'перезаписано 2, удалено 1, уже не было 1, ошибок 0',
    );
    expect(text).toContain(
      'переименовано 1, уже без имени 1, комнаты нет 1, ошибок 0',
    );
    expect([...events.keys()].sort()).toEqual([
      'booking-1@schemehappens.ru.ics',
      'booking-2@schemehappens.ru.ics',
    ]);
    expect(events.get('booking-1@schemehappens.ru.ics')).toContain(
      'SUMMARY:Сессия (50 мин)',
    );
    expect([...topics.values()]).toEqual([ZOOM_TOPIC, ZOOM_TOPIC]);
    // Ни адрес, ни тело ни одного запроса не несут данных клиента.
    const sent = JSON.stringify(calls);
    for (const s of SECRETS) expect(sent).not.toContain(s);
  });

  it('повторный запуск безопасен: ничего не воскрешает и не переименовывает заново', async () => {
    await makeCommand().report(true, NOW);
    calls = [];
    const text = await makeCommand().report(true, NOW);
    expect(text).toContain(
      'перезаписано 2, удалено 0, уже не было 2, ошибок 0',
    );
    expect(text).toContain('переименовано 0, уже без имени 2, комнаты нет 1');
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
    expect(events.size).toBe(2);
  });

  it('лимит Zoom (429): проход по Zoom останавливается, отчёт зовёт повторить', async () => {
    global.fetch = jest.fn((url: string, init?: RequestInit) =>
      init?.method === 'PATCH'
        ? Promise.resolve({
            ok: false,
            status: 429,
            text: () => Promise.resolve(''),
          })
        : fakeFetch(url, init),
    );
    const text = await makeCommand().report(true, NOW);
    expect(text).toContain('лимит запросов');
    expect(topics.get('111')).not.toBe(ZOOM_TOPIC);
  });

  it('команду запускает только ADMIN_ID: чужому — отказ и ни одного запроса', async () => {
    const prev = process.env.ADMIN_ID;
    process.env.ADMIN_ID = '1';
    let handler: (ctx: unknown) => Promise<void> = async () => undefined;
    const bot = { command: (_: string, h: typeof handler) => (handler = h) };
    const cmd = new ForeignScrubCommand(
      bot as never,
      prisma,
      new CalDavService(config),
      new MeetingService(prisma, config),
    );
    cmd.pauseMs = 0;
    cmd.onModuleInit();
    const replies: string[] = [];
    const ctx = (id: number) => ({
      from: { id },
      message: { text: '/scrub_foreign go' },
      reply: async (t: string) => void replies.push(t),
    });
    await handler(ctx(2));
    expect(replies).toEqual(['⛔ Нет доступа']);
    expect(calls).toEqual([]);
    await handler(ctx(1)); // контроль: владелец запускает
    expect(replies[1]).toContain('Запущено');
    if (prev === undefined) delete process.env.ADMIN_ID;
    else process.env.ADMIN_ID = prev;
  });
});
