// Перевыпуск старых событий iCloud: UID `booking-<id>@…` нёс номер брони в
// зарубежную базу (запрос РКН №08-1063539). Шов: настоящие
// LegacyUidReissueCommand + CalDavService, подменён fetch; Prisma — строки в
// памяти с where-матчером Prisma. select фейк не соблюдает: данные клиента
// доходят до кода, и утечка в запрос была бы видна.
import { ConfigService } from '@nestjs/config';
import { BookingStatus, SessionType } from '@prisma/client';
import { CalDavService } from './caldav.service';
import { bookingEventUid } from './caldav-owner-event';
import { cancelEventUid } from './booking.transitions';
import { LegacyUidReissueCommand } from './legacy-uid-reissue.command';
import { legacyEventUid } from './legacy-uid-reissue';
import {
  matchesWhere,
  type Row,
  type Where,
} from '../test-support/fake-prisma.spec-helper';
import type { PrismaService } from '../prisma/prisma.service';

const SECRETS = ['Евлампия Маркерова', '+79991234567', 'тревога-маркер'];
const NOW = new Date('2026-11-15T10:00:00Z');
const CAL = 'https://p1.icloud.com/cal/';
const ENV: Record<string, string> = {
  APPLE_ID: 'x@icloud.com',
  APPLE_APP_PASSWORD: 'pw',
  APPLE_CALDAV_URL: CAL,
};
const config = { get: (k: string) => ENV[k] } as unknown as ConfigService;
const { CONFIRMED, COMPLETED, CANCELLED } = BookingStatus;
const ics = (uid: string) => `${uid}.ics`;
const [old, hmac] = [legacyEventUid, bookingEventUid];

const booking = (
  id: number,
  startsAt: string,
  status: BookingStatus,
  calDavUid: string | null,
  meetingUrl: string | null = null,
): Row => ({
  id,
  startsAt: new Date(startsAt),
  durationMin: 50,
  type: SessionType.SESSION_50,
  status,
  calDavUid,
  paidAt: null,
  meetingUrl,
  clientName: SECRETS[0],
  clientContact: SECRETS[1],
  message: SECRETS[2],
});

let rows: Row[];
let events: Map<string, string>;
let calls: { url: string; method: string; body: string }[];
/** Вмешательство в PUT: код ответа вместо успеха или отмена брони по ходу запроса. */
let onPut: (key: string) => number | undefined;
let prisma: { booking: Record<'findMany' | 'updateMany', jest.Mock> };

function fakeFetch(url: string, init: RequestInit = {}) {
  const method = init.method ?? 'GET';
  const body = typeof init.body === 'string' ? init.body : '';
  calls.push({ url, method, body });
  const key = url.slice(CAL.length);
  let status = 500;
  if (method === 'PUT') {
    status = onPut(key) ?? 201;
    if (status === 201) events.set(key, body);
  } else if (method === 'DELETE') status = events.delete(key) ? 204 : 404;
  return Promise.resolve({
    ok: status < 300,
    status,
    text: () => Promise.resolve(''),
  });
}

function makeCommand(bot: unknown = null) {
  const cmd = new LegacyUidReissueCommand(
    prisma as unknown as PrismaService,
    new CalDavService(config),
    bot as never,
  );
  cmd.pauseMs = 0;
  return cmd;
}
const state = () => JSON.stringify({ rows, events: [...events] });

const originalFetch = global.fetch;
beforeEach(() => {
  rows = [
    booking(1, '2026-12-01T17:00:00Z', CONFIRMED, old(1)), // будущая — перевыпуск
    booking(2, '2026-03-01T17:00:00Z', COMPLETED, old(2)), // в сроке — перевыпуск
    booking(3, '2025-06-01T17:00:00Z', COMPLETED, old(3)), // старше срока — /scrub_foreign
    booking(4, '2026-12-05T17:00:00Z', CANCELLED, old(4)), // отменена — только DELETE
    booking(5, '2026-12-10T17:00:00Z', CONFIRMED, hmac(5)), // старое событие с незаписанным uid
    booking(6, '2026-12-12T17:00:00Z', CANCELLED, null), // брошенная запись: события не было
    booking(7, '2026-12-15T17:00:00Z', CONFIRMED, null, 'enc:link'), // iCloud отказал при подтверждении
  ];
  const uids = [old(1), old(2), old(3), old(4), old(5), hmac(5)];
  events = new Map(uids.map((u) => [ics(u), `UID:${u}`]));
  calls = [];
  onPut = () => undefined;
  prisma = {
    booking: {
      findMany: jest.fn(({ where }: { where: Where }) =>
        Promise.resolve(rows.filter((r) => matchesWhere(r, where))),
      ),
      updateMany: jest.fn(({ where, data }: { where: Where; data: Row }) => {
        const hit = rows.filter((r) => matchesWhere(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return Promise.resolve({ count: hit.length });
      }),
    },
  };
  global.fetch = jest.fn(fakeFetch);
});
afterEach(() => {
  global.fetch = originalFetch;
});

describe('LegacyUidReissueCommand: перевыпуск событий iCloud со старым UID', () => {
  it('сухой прогон: только счётчики — ни запроса в iCloud, ни записи в базу', async () => {
    const before = state();
    const text = await makeCommand().report(false, NOW);
    expect(calls).toEqual([]);
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(state()).toBe(before);
    expect(text).toContain(
      'будет перевыпущено 2, будет проверено старых адресов 3',
    );
    expect(text).toContain('/reissue_icloud go');
  });

  it('боевой: событие живой брони — заново под HMAC-UID, старые адреса сняты', async () => {
    const text = await makeCommand().report(true, NOW);
    expect(text).toContain(
      'перевыпущено 2, снято старых без замены 2, по старому адресу пусто 1, ошибок 0',
    );
    expect(text).toContain('событий с номером брони в UID осталось 0');
    expect([...events.keys()].sort()).toEqual(
      [hmac(1), hmac(2), old(3), hmac(5)].map(ics).sort(),
    );
    expect(rows.map((r) => r.calDavUid)).toEqual([
      hmac(1),
      hmac(2),
      old(3),
      old(4),
      hmac(5),
      null,
      null,
    ]);
    // Отмена после перевыпуска снимает новое событие: uid она берёт из брони.
    const cancelled = rows[0] as Parameters<typeof cancelEventUid>[1];
    expect(cancelEventUid({ status: CONFIRMED }, cancelled)).toBe(hmac(1));
    const fresh = events.get(ics(hmac(1)));
    expect(fresh).toContain('DTSTART:20261201T170000Z');
    expect(fresh).toContain('SUMMARY:Сессия (50 мин)');
    // Новое событие не несёт номера брони; бронь старше срока и брошенную не трогали.
    const puts = calls.filter((c) => c.method === 'PUT');
    expect(puts.map((c) => c.url)).toEqual([
      CAL + ics(hmac(1)),
      CAL + ics(hmac(2)),
    ]);
    for (const c of puts) expect(c.url + c.body).not.toMatch(/booking-\d/);
    expect(calls.filter((c) => /booking-[36]@/.test(c.url))).toEqual([]);
    const sent = JSON.stringify(calls);
    for (const s of SECRETS) expect(sent).not.toContain(s);
  });

  it('повтор безопасен: ничего не создаёт и не воскрешает', async () => {
    await makeCommand().report(true, NOW);
    const after = state();
    calls = [];
    const text = await makeCommand().report(true, NOW);
    expect(text).toContain(
      'перевыпущено 0, снято старых без замены 0, по старому адресу пусто 5, ошибок 0',
    );
    expect(calls.filter((c) => c.method !== 'DELETE')).toEqual([]);
    expect(state()).toBe(after);
  });

  it('iCloud не принял PUT: старое событие и uid брони на месте, повтор доделывает', async () => {
    onPut = () => 503;
    const text = await makeCommand().report(true, NOW);
    expect(text).toContain('перевыпущено 0');
    expect(text).toContain('ошибок 2');
    expect(text).toContain('с номером брони в UID осталось не больше 2');
    expect(text).toContain('Повтор безопасен: /reissue_icloud go');
    expect(events.has(ics(old(1)))).toBe(true);
    expect(rows[0].calDavUid).toBe(old(1));
    onPut = () => undefined;
    const again = await makeCommand().report(true, NOW);
    expect(again).toContain('перевыпущено 2');
    expect(again).toContain('ошибок 0');
    expect(events.has(ics(old(1)))).toBe(false);
  });

  it('бронь отменили, пока шёл PUT: новое событие снято, uid брони прежний', async () => {
    onPut = (key) => {
      if (key === ics(hmac(1))) rows[0].status = CANCELLED;
      return undefined;
    };
    const text = await makeCommand().report(true, NOW);
    expect(text).toContain('перевыпущено 1');
    expect(text).toContain('ошибок 1');
    expect(events.has(ics(hmac(1)))).toBe(false);
    expect(rows[0].calDavUid).toBe(old(1));
  });

  it('команду запускает только ADMIN_ID: чужому — отказ и ни одного запроса', async () => {
    const prev = process.env.ADMIN_ID;
    process.env.ADMIN_ID = '1';
    let handler: (ctx: unknown) => Promise<void> = async () => undefined;
    const bot = { command: (_: string, h: typeof handler) => (handler = h) };
    makeCommand(bot).onModuleInit();
    const replies: string[] = [];
    const ctx = (id: number, text: string) => ({
      from: { id },
      message: { text },
      reply: async (t: string) => void replies.push(t),
    });
    await handler(ctx(2, '/reissue_icloud go'));
    expect(replies).toEqual(['⛔ Нет доступа']);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
    await handler(ctx(1, '/reissue_icloud')); // контроль: владелец, сухой прогон
    for (let i = 0; i < 20 && replies.length < 3; i++)
      await new Promise((r) => setTimeout(r, 0));
    expect(replies[1]).toContain('Запущено');
    expect(replies[2]).toContain('Сухой прогон перевыпуска');
    if (prev === undefined) delete process.env.ADMIN_ID;
    else process.env.ADMIN_ID = prev;
  });
});
