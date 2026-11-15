// Разовая чистка iCloud и Zoom (запрос РКН №08-1063539). Шов: настоящие
// ForeignScrubCommand + CalDavService + MeetingService, подменён fetch (и
// поддельная Prisma вместо базы). В запросах нет данных клиента; повтор безопасен.
// Комнаты Zoom без строки ClientMeeting находятся по списку встреч (zoom-orphans.ts).
import { ConfigService } from '@nestjs/config';
import { BookingStatus, SessionType } from '@prisma/client';
import { CalDavService } from './caldav.service';
import { MeetingService, ZOOM_TOPIC } from './meeting.service';
import { ForeignScrubCommand } from './foreign-scrub.command';
import type { PrismaService } from '../prisma/prisma.service';
import { loadRecordedFixture } from '../test-support/recorded-fixture';

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

// Живая бронь держит комнату 555 вне базы (ссылка — в meetingUrl).
const LIVE = [
  {
    meetingUrl: 'https://us02web.zoom.us/j/555?pwd=room',
    clientName: SECRETS[0],
    clientContact: SECRETS[1],
  },
];

const prisma = {
  booking: {
    findMany: jest.fn(async (q: { where: object }) =>
      'anonymizedAt' in q.where ? LIVE : BOOKINGS,
    ),
  },
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
let listStatus: number;
let deleteStatus: number;

// Список встреч: первая страница — записанный ответ Zoom как есть (встреча
// владельца, type 2), её next_page_token ведёт к комнатам, по две на страницу.
const LIST = 'https://api.zoom.us/v2/users/me/meetings?';
const DOC = JSON.parse(loadRecordedFixture('zoom-list-meetings.json')) as {
  next_page_token: string;
  meetings: object[];
};
function listPage(url: string) {
  const token = new URLSearchParams(url.slice(LIST.length)).get(
    'next_page_token',
  );
  if (!token) return DOC;
  const from = token === DOC.next_page_token ? 0 : Number(token.slice(1));
  const rooms = [...topics].map(([id, topic]) => ({
    ...DOC.meetings[0],
    id: Number(id),
    topic,
    type: 3,
  }));
  const next = from + 2 < rooms.length ? `p${from + 2}` : '';
  return {
    ...DOC,
    meetings: rooms.slice(from, from + 2),
    next_page_token: next,
  };
}

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
  if (url.startsWith(LIST))
    return listStatus === 200 ? res(200, listPage(url)) : res(listStatus);
  const zoom = /\/v2\/meetings\/(\d+)(\?.*)?$/.exec(url);
  if (zoom) {
    const id = zoom[1];
    if (!topics.has(id)) return res(404);
    if (method === 'GET') return res(200, { topic: topics.get(id) });
    if (method === 'PATCH') {
      topics.set(id, (JSON.parse(body) as { topic: string }).topic);
      return res(204);
    }
    if (method === 'DELETE') {
      if (deleteStatus === 204) topics.delete(id);
      return res(deleteStatus);
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
  listStatus = 200;
  deleteStatus = 204;
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
    // Записанный UID старой схемы: событие обновлено на месте, без второго (HMAC).
    expect(events.get('booking-1@schemehappens.ru.ics')).toContain(
      'UID:booking-1@schemehappens.ru\r\n',
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
    // Контроль: владелец, сухой прогон с ожиданием итога — боевой не уходит в фон.
    const owner = ctx(1);
    owner.message.text = '/scrub_foreign';
    await handler(owner);
    for (let i = 0; i < 20 && replies.length < 3; i++)
      await new Promise((r) => setTimeout(r, 0));
    expect(replies[1]).toContain('Запущено');
    expect(replies[2]).toContain('будет перезаписано');
    if (prev === undefined) delete process.env.ADMIN_ID;
    else process.env.ADMIN_ID = prev;
  });
});

describe('ForeignScrubCommand: комнаты Zoom вне базы', () => {
  const NAMED = `Сессии — ${SECRETS[0]}`;
  const sent = (method: string) =>
    calls.filter((c) => c.method === method && c.url.includes('api.zoom.us'));
  beforeEach(() => {
    // Строк ClientMeeting у них нет: 444 и 666 — без брони, 555 держит живая
    // бронь, 777 — своя комната владельца с другой темой.
    topics.set('444', NAMED);
    topics.set('555', NAMED);
    topics.set('666', ZOOM_TOPIC);
    topics.set('777', 'Супервизия');
  });

  it('боевой: без брони — удалена, со ссылкой в живой брони — только переименована', async () => {
    const text = await makeCommand().report(true, NOW);
    expect(text).toContain(
      'Комнаты Zoom вне базы: 3 — удалено 2, переименовано 1, оставлено из-за брони 1, ошибок 0',
    );
    expect(sent('DELETE').map((c) => c.url)).toEqual([
      'https://api.zoom.us/v2/meetings/444?schedule_for_reminder=false',
      'https://api.zoom.us/v2/meetings/666?schedule_for_reminder=false',
    ]);
    expect([...topics]).toEqual([
      ['111', ZOOM_TOPIC],
      ['222', ZOOM_TOPIC],
      ['555', ZOOM_TOPIC],
      ['777', 'Супервизия'],
    ]);
    // Встреча из записанного ответа (type 2) и 777 — не комнаты клиентов.
    expect(text).toContain('Других встреч в Zoom: 2 — не комнаты клиентов');
  });

  it('сухой прогон: только счёт — ни PATCH, ни DELETE', async () => {
    const text = await makeCommand().report(false, NOW);
    expect([...sent('PATCH'), ...sent('DELETE')]).toEqual([]);
    expect(text).toContain(
      'Комнаты Zoom вне базы: 3 — будет удалено 2, будет переименовано 1, оставлено из-за брони 1',
    );
    expect(topics.get('444')).toBe(NAMED);
  });

  it('список постранично: next_page_token ответа уходит в следующий запрос', async () => {
    await makeCommand().report(true, NOW);
    const tokens = calls
      .filter((c) => c.url.startsWith(LIST))
      .map((c) => new URLSearchParams(c.url.slice(LIST.length)));
    expect(tokens.map((q) => q.get('next_page_token'))).toEqual([
      null,
      DOC.next_page_token,
      'p2',
      'p4',
    ]);
    expect(tokens[0].get('page_size')).toBe('300');
    expect(topics.has('666')).toBe(false); // комната с последней страницы
  });

  it('403 на удаление: только переименование и строка «удалить вручную»', async () => {
    deleteStatus = 403;
    const text = await makeCommand().report(true, NOW);
    // 555 держит бронь — в списке «вручную» её нет.
    expect(text).toContain(
      'права на удаление встреч — удалить вручную в кабинете Zoom: 444, 666.',
    );
    expect(text).toContain(
      'удалено 0, переименовано 2, оставлено из-за брони 1',
    );
    expect(sent('DELETE')).toHaveLength(1); // после первого отказа не пробует
    expect(topics.get('444')).toBe(ZOOM_TOPIC);
  });

  it('403 на список: отчёт без падения, комнаты вне базы не тронуты', async () => {
    listStatus = 403;
    const text = await makeCommand().report(true, NOW);
    expect(text).toContain(
      'Комнаты Zoom вне базы: не проверены — нет права читать список встреч (403)',
    );
    expect(text).toContain('переименовано 1, уже без имени 1'); // комнаты из базы
    expect(sent('DELETE')).toEqual([]);
    expect(topics.get('444')).toBe(NAMED);
  });

  it('прочий отказ списка: в отчёте статус и код ошибки Zoom, повтор безопасен', async () => {
    // 400 с кодом 3161 — отказ List meetings из документации Zoom.
    global.fetch = jest.fn((url: string, init?: RequestInit) =>
      url.startsWith(LIST)
        ? Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ code: 3161 }),
          })
        : fakeFetch(url, init),
    );
    const text = await makeCommand().report(true, NOW);
    expect(text).toContain(
      'не проверены — список встреч не получен (HTTP 400, код 3161)',
    );
    expect(text).toContain('Повтор безопасен: /scrub_foreign go');
  });
});
