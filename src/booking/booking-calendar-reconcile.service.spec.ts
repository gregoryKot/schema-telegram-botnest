// Шов крон-сверки: настоящий CalDavService ходит в поддельный iCloud (fetch),
// отмена — настоящий claimCancel; подделаны только строки брони в памяти и
// аренда. Главный сценарий — гонка, которую CAS не закрывает: PUT
// подтверждения, оборванный гибелью пода, дошёл до iCloud ПОСЛЕ DELETE отмены.
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Booking, BookingStatus, SessionType } from '@prisma/client';
import { BookingCalendarReconcileService } from './booking-calendar-reconcile.service';
import { CalDavService } from './caldav.service';
import { claimCancel } from './booking.transitions';
import { bookingEventUid, ownerEventFor } from './caldav-owner-event';
import { LEASE_WINDOW } from '../infra/cron-leader.service';

const CAL = 'https://p1.icloud.com/cal/';
const ICLOUD: Record<string, string | undefined> = {
  APPLE_ID: 'owner@icloud.com',
  APPLE_APP_PASSWORD: 'pw',
  APPLE_CALDAV_URL: CAL,
};
const HOUR = 3_600_000;

// Поддельный iCloud: события по адресу, PUT кладёт, DELETE снимает или отвечает
// `missingStatus` (404; 204 — если iCloud не отличает снятое событие от живого).
let events: Map<string, string>;
let calls: { method: string; url: string }[];
let outage: false | 503 | 'network';
let missingStatus: number;
function fakeICloud(url: string, init: RequestInit = {}) {
  const method = init.method ?? 'GET';
  calls.push({ method, url });
  const res = (status: number) =>
    Promise.resolve({
      ok: status < 300,
      status,
      text: () => Promise.resolve(''),
    });
  if (outage === 'network') throw new TypeError('fetch failed');
  if (outage) return res(outage);
  const key = url.slice(CAL.length);
  const body = typeof init.body === 'string' ? init.body : '';
  if (method === 'PUT') return (events.set(key, body), res(201));
  if (method === 'DELETE') return res(events.delete(key) ? 204 : missingStatus);
  return res(500);
}

const booking = (over: Partial<Booking> = {}): Booking =>
  ({
    id: 42,
    startsAt: new Date(Date.now() + 48 * HOUR),
    durationMin: 50,
    type: SessionType.SESSION_50,
    status: BookingStatus.CONFIRMED,
    cancelToken: `tok-${over.id ?? 42}`,
    calDavUid: null,
    paidAt: null,
    meetingUrl: null,
    updatedAt: new Date(),
    ...over,
  }) as Booking;

/** Строки брони в памяти: CAS отмены (updateMany), её перечитка и выборка крона. */
function fakePrisma(rows: Booking[]) {
  const pick = (b: Booking, select: Record<string, true>) =>
    Object.fromEntries(
      Object.keys(select).map((k) => [k, (b as Record<string, unknown>)[k]]),
    );
  const findMany = jest.fn(
    async (q: {
      where: { status: BookingStatus; updatedAt: { gte: Date } };
      select: Record<string, true>;
    }) =>
      rows
        .filter(
          (b) =>
            b.status === q.where.status && b.updatedAt >= q.where.updatedAt.gte,
        )
        .map((b) => pick(b, q.select)),
  );
  const prisma = {
    booking: {
      findMany,
      updateMany: jest.fn(
        async (q: {
          where: { cancelToken: string; status: { in: BookingStatus[] } };
          data: Partial<Booking>;
        }) => {
          const row = rows.find(
            (b) =>
              b.cancelToken === q.where.cancelToken &&
              q.where.status.in.includes(b.status),
          );
          if (!row) return { count: 0 };
          Object.assign(row, q.data, { updatedAt: new Date() });
          return { count: 1 };
        },
      ),
      findUnique: jest.fn(async (q: { where: { cancelToken: string } }) => {
        const row = rows.find((b) => b.cancelToken === q.where.cancelToken);
        return row ? { ...row } : null;
      }),
    },
  };
  return { prisma: prisma as never, findMany };
}

function make(rows: Booking[], { claim = true, env = ICLOUD } = {}) {
  const config = { get: (k: string) => env[k] } as unknown as ConfigService;
  const calDav = new CalDavService(config);
  const claimRun = jest.fn().mockResolvedValue(claim);
  const { prisma, findMany } = fakePrisma(rows);
  const service = new BookingCalendarReconcileService(prisma, calDav, {
    claimRun,
  } as never);
  return { service, calDav, prisma, findMany, claimRun };
}

const originalFetch = global.fetch;
let debug: jest.SpyInstance;
let warn: jest.SpyInstance;
let error: jest.SpyInstance;
beforeEach(() => {
  events = new Map();
  calls = [];
  outage = false;
  missingStatus = 404;
  global.fetch = jest.fn(fakeICloud);
  jest.spyOn(Logger.prototype, 'log').mockImplementation();
  debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

const EVENT = `${bookingEventUid(42)}.ics`;
const DELETE_42 = { method: 'DELETE', url: `${CAL}${EVENT}` };

describe('BookingCalendarReconcileService.reconcileCancelled', () => {
  /** Подтверждение руками записало ссылку, начало PUT и умерло до записи uid. */
  async function cancelThenLatePut() {
    const row = booking({ meetingUrl: 'enc:link' });
    const ctx = make([row]);
    const claimed = await claimCancel(ctx.prisma, row.cancelToken, {
      ...row,
    });
    const uid = claimed?.eventUid ?? '';
    expect(uid).toBe(bookingEventUid(42));
    // DELETE отмены приходит в iCloud раньше оборванного PUT — снимать нечего.
    expect(await ctx.calDav.removeEvent(uid)).toBe('missing');
    await ctx.calDav.pushEvent(ownerEventFor(row)); // PUT воскрешает событие
    expect([...events.keys()]).toEqual([EVENT]);
    calls = [];
    return ctx;
  }

  it('оборванный PUT дошёл после DELETE отмены — крон снимает событие тем же uid', async () => {
    const { service } = await cancelThenLatePut();

    await service.reconcileCancelled();

    expect(calls).toEqual([DELETE_42]);
    expect(events.size).toBe(0);
    expect(String(debug.mock.calls[0][0])).toContain('#42');
  });

  it('повторный запуск идемпотентен: события уже нет (404) — успех без строки в логе', async () => {
    const { service } = await cancelThenLatePut();
    await service.reconcileCancelled();
    calls = [];
    debug.mockClear();

    await service.reconcileCancelled();

    expect(calls).toEqual([DELETE_42]);
    expect(events.size).toBe(0);
    expect(debug).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled(); // error ушёл бы владельцу DM
  });

  it('iCloud отвечает 204 и на уже снятое событие — повторы за сутки не пишут warn каждый тик', async () => {
    const { service } = await cancelThenLatePut();
    missingStatus = 204;

    for (let tick = 0; tick < 3; tick++) await service.reconcileCancelled();

    expect(calls).toEqual([DELETE_42, DELETE_42, DELETE_42]);
    expect(debug).toHaveBeenCalledTimes(3); // неотличимо от снятия — только debug
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('сбой iCloud (503, обрыв сети) — событие ждёт следующего тика, DM владельцу не будит', async () => {
    const { service } = await cancelThenLatePut();
    for (const mode of [503, 'network'] as const) {
      outage = mode;
      await service.reconcileCancelled();
      expect([...events.keys()]).toEqual([EVENT]);
    }
    expect(error).not.toHaveBeenCalled(); // error() будил бы DM каждые 15 минут

    outage = false;
    await service.reconcileCancelled();

    expect(events.size).toBe(0);
  });

  it('нет отменённых броней — ни одного запроса в iCloud', async () => {
    const { service } = make([
      booking({ id: 1, calDavUid: 'booking-1@schemehappens.ru' }),
      booking({ id: 2, status: BookingStatus.HELD }),
    ]);

    await service.reconcileCancelled();

    expect(calls).toEqual([]);
  });

  it('отменённый холд без оплаты и ссылки — события не бывает, DELETE не шлём', async () => {
    const { service } = make([
      booking({ id: 3, status: BookingStatus.CANCELLED }),
    ]);

    await service.reconcileCancelled();

    expect(calls).toEqual([]);
  });

  it('глубина — сутки: отменённую 25 ч назад не трогаем, 23 ч назад — снимаем', async () => {
    const cancelled = (id: number, agoH: number) =>
      booking({
        id,
        status: BookingStatus.CANCELLED,
        calDavUid: bookingEventUid(id),
        updatedAt: new Date(Date.now() - agoH * HOUR),
      });
    const { service } = make([cancelled(5, 25), cancelled(6, 23)]);

    await service.reconcileCancelled();

    expect(calls).toEqual([
      { method: 'DELETE', url: `${CAL}${bookingEventUid(6)}.ics` },
    ]);
  });

  it('аренду забрал другой инстанс — ни базы, ни iCloud', async () => {
    const row = booking({ status: BookingStatus.CANCELLED, calDavUid: 'u' });
    const { service, findMany, claimRun } = make([row], { claim: false });

    await service.reconcileCancelled();

    expect(claimRun).toHaveBeenCalledWith(
      'bookingCalendarReconcile',
      LEASE_WINDOW.fifteenMinutes,
    );
    expect(findMany).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it('iCloud не настроен — аренду не берёт (правило №17)', async () => {
    const row = booking({ status: BookingStatus.CANCELLED, calDavUid: 'u' });
    const { service, claimRun } = make([row], { env: {} });

    await service.reconcileCancelled();

    expect(claimRun).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });
});
