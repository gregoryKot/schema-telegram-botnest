// Запись клиента на сессию из приложения (#546): кто имеет право, откуда
// имя и контакт, и что бронь идёт ТОЙ ЖЕ цепочкой BookingService.book, что у
// публичной /book (оферта, окно расписания, цена, HELD + оплата). Сервис
// записи — настоящий, замоканы только БД и внешние площадки.
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SessionType } from '@prisma/client';
import { BookingService } from './booking.service';
import {
  CLIENT_BOOKING_SOURCE,
  ClientBookingService,
} from './client-booking.service';
import { encryptName } from '../therapy/client-name';

const OWNER = 424242n;
const TG_CLIENT = 555_000n; // телеграм-вход: userId = telegramId
const WEB_CLIENT = 1_000_000_000_000_555n; // вход через Google
const FIXED_NOW = new Date('2026-07-13T00:00:00Z'); // понедельник
const SLOT = new Date(FIXED_NOW.getTime() + 13 * 3_600_000); // Пн 16:00 МСК
const MONDAY_10_19_MSK = {
  dayOfWeek: 1,
  startHour: 10,
  startMinute: 0,
  endHour: 19,
  endMinute: 0,
  sessionDuration: 50, // сетка 10:00, 11:00, … — SLOT 16:00 на ней
  bufferMin: 10,
  timezone: 'Europe/Moscow',
  isActive: true,
};

interface Relation {
  therapistId: bigint;
  clientId: bigint;
  status: string;
  clientAlias: string | null;
}
interface Provider {
  userId: bigint;
  provider: string;
  providerId: string;
  email: string | null;
  displayName: string | null;
}
interface World {
  relations?: Relation[];
  users?: Record<string, { firstName: string | null }>;
  providers?: Provider[];
  rules?: unknown[];
  upcoming?: unknown[];
}

function make(w: World = {}) {
  const created: Record<string, unknown>[] = [];
  const tx = {
    $executeRaw: jest.fn(async () => undefined),
    booking: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: 100 + created.length, ...data };
        created.push(row);
        return row;
      }),
    },
  };
  const providers = w.providers ?? [];
  const prisma: any = {
    authProvider: {
      findUnique: jest.fn(async ({ where }: any) => {
        const k = where.provider_providerId;
        const p = providers.find(
          (x) => x.provider === k.provider && x.providerId === k.providerId,
        );
        return p ? { userId: p.userId } : null;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        providers.filter((p) => p.userId === where.userId),
      ),
    },
    user: {
      findUnique: jest.fn(
        async ({ where }: any) => w.users?.[String(where.id)] ?? null,
      ),
    },
    therapyRelation: {
      findFirst: jest.fn(
        async ({ where }: any) =>
          (w.relations ?? []).find(
            (r) =>
              r.clientId === where.clientId &&
              r.therapistId === where.therapistId &&
              r.status === where.status,
          ) ?? null,
      ),
    },
    availabilityRule: { findMany: jest.fn(async () => w.rules ?? []) },
    slotOverride: { findMany: jest.fn(async () => []) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    booking: { findMany: jest.fn(async () => w.upcoming ?? []) },
  };
  const notify = {
    onConfirmed: jest.fn(async () => undefined),
    onAwaitingPayment: jest.fn(async () => undefined),
    notifyAdminBoth: jest.fn(async () => undefined),
  };
  const robokassa = {
    enabled: true,
    buildPaymentUrl: jest.fn(() => 'https://auth.robokassa.ru/pay?x=1'),
  };
  const config = { get: () => undefined };
  const booking = new BookingService(
    prisma,
    notify as any,
    { hasMeetingForContact: jest.fn(async () => false) } as any,
    robokassa as any,
    { getPrice: jest.fn(async () => 4000) } as any,
    config as any,
    { claimRun: jest.fn().mockResolvedValue(true) } as any,
  );
  const analytics = { track: jest.fn(async () => undefined) };
  const svc = new ClientBookingService(
    prisma,
    booking,
    analytics as any,
    config as any,
  );
  return { svc, prisma, created, notify, analytics };
}

const active = (clientId: bigint, alias: string | null = null): Relation => ({
  therapistId: OWNER,
  clientId,
  status: 'active',
  clientAlias: encryptName(alias),
});
const INPUT = { startsAt: SLOT, durationMin: 50 };

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
  process.env.ADMIN_ID = String(OWNER);
});
afterEach(() => {
  jest.useRealTimers();
  delete process.env.ADMIN_ID;
});

describe('ClientBookingService — кто может записаться', () => {
  const refused: Array<[string, World, bigint]> = [
    ['связи нет', {}, TG_CLIENT],
    [
      'связь с другим терапевтом',
      { relations: [{ ...active(TG_CLIENT), therapistId: 999n }] },
      TG_CLIENT,
    ],
    [
      'связь не активна (ждёт подключения)',
      { relations: [{ ...active(TG_CLIENT), status: 'pending' }] },
      TG_CLIENT,
    ],
    ['владелец практики сам себе', { relations: [active(OWNER)] }, OWNER],
  ];

  it.each(refused)('%s → 403, брони нет', async (_, world, userId) => {
    const { svc, created } = make(world);
    await expect(svc.book(userId, INPUT)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(created).toHaveLength(0);
    expect((await svc.overview(userId)).eligible).toBe(false);
  });

  it('ADMIN_ID не задан → календаря нет, записаться нельзя', async () => {
    delete process.env.ADMIN_ID;
    const { svc } = make({ relations: [active(TG_CLIENT)] });
    await expect(svc.book(TG_CLIENT, INPUT)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('владелец слил телеграм с веб-аккаунтом → связь ищется по веб-id', async () => {
    const ownerWeb = 1_000_000_000_000_001n;
    const relation = { ...active(TG_CLIENT), therapistId: ownerWeb };
    const { svc } = make({
      relations: [relation],
      providers: [
        {
          userId: ownerWeb,
          provider: 'telegram',
          providerId: String(OWNER),
          email: null,
          displayName: null,
        },
      ],
    });
    expect((await svc.overview(TG_CLIENT)).eligible).toBe(true);
  });
});

describe('ClientBookingService.book — та же цепочка, что у /book', () => {
  it('телеграм-клиент: имя из алиаса связи, контакт — ссылка по id; HELD + оплата', async () => {
    const { svc, created, notify, analytics } = make({
      relations: [active(TG_CLIENT, 'Аня (вторник)')],
      users: { [String(TG_CLIENT)]: { firstName: 'Anna' } },
    });
    const res = await svc.book(TG_CLIENT, INPUT);

    expect(res.status).toBe('HELD');
    expect(res.paymentUrl).toContain('robokassa');
    expect(res.manageUrl).toBe(
      `https://kotlarewski.gr/booking/manage?token=${res.cancelToken}`,
    );
    const row = created[0];
    expect(row).toMatchObject({
      type: SessionType.SESSION_50,
      status: 'HELD',
      userId: TG_CLIENT,
      clientTelegramId: TG_CLIENT,
      clientChannel: 'telegram',
      source: CLIENT_BOOKING_SOURCE,
    });
    expect(row.acceptedOfferAt).toBeInstanceOf(Date);
    // Владелец видит клиента так же, как в кабинете: по алиасу.
    const [plain] = notify.onAwaitingPayment.mock.calls[0] as unknown as [
      { clientName: string; clientContact: string },
    ];
    expect(plain.clientName).toBe('Аня (вторник)');
    expect(plain.clientContact).toBe(`tg://user?id=${TG_CLIENT}`);
    expect(analytics.track).toHaveBeenCalledWith(
      TG_CLIENT,
      'client_booking_created',
      { status: 'held' },
    );
  });

  it('веб-клиент без алиаса: имя аккаунта, контакт — e-mail, Telegram-id нет', async () => {
    const { svc, created, notify } = make({
      relations: [active(WEB_CLIENT)],
      users: { [String(WEB_CLIENT)]: { firstName: 'Мария' } },
      providers: [
        {
          userId: WEB_CLIENT,
          provider: 'google',
          providerId: 'sub-1',
          email: 'maria@example.com',
          displayName: 'Maria G',
        },
      ],
    });
    await svc.book(WEB_CLIENT, INPUT);
    expect(created[0]).toMatchObject({
      userId: WEB_CLIENT,
      clientTelegramId: null,
      clientChannel: 'email',
    });
    const [plain] = notify.onAwaitingPayment.mock.calls[0] as unknown as [
      { clientName: string; clientContact: string },
    ];
    expect(plain).toMatchObject({
      clientName: 'Мария',
      clientContact: 'maria@example.com',
    });
  });

  it('окно расписания уважается: слот вне правила → 400, брони и события нет', async () => {
    const { svc, created, analytics } = make({
      relations: [active(TG_CLIENT)],
      rules: [{ ...MONDAY_10_19_MSK, dayOfWeek: 3 }],
    });
    await expect(svc.book(TG_CLIENT, INPUT)).rejects.toThrow(
      new BadRequestException('OUTSIDE_AVAILABILITY'),
    );
    expect(created).toHaveLength(0);
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it('слот внутри правила — бронь создаётся', async () => {
    const { svc, created } = make({
      relations: [active(TG_CLIENT)],
      rules: [MONDAY_10_19_MSK],
    });
    await svc.book(TG_CLIENT, INPUT);
    expect(created).toHaveLength(1);
  });

  it('пояс вне рублей → подтверждена сразу, без оплаты (как у /book)', async () => {
    const { svc, analytics } = make({ relations: [active(TG_CLIENT)] });
    const res = await svc.book(TG_CLIENT, {
      ...INPUT,
      clientTimeZone: 'Asia/Jerusalem',
    });
    expect(res).toMatchObject({ status: 'CONFIRMED', paymentUrl: null });
    expect(analytics.track).toHaveBeenCalledWith(
      TG_CLIENT,
      'client_booking_created',
      { status: 'confirmed' },
    );
  });
});

describe('ClientBookingService.overview — только свои ближайшие брони', () => {
  it('выборка по userId из гарда; ответ без PII, со ссылкой управления', async () => {
    const startsAt = new Date('2026-07-20T13:00:00Z');
    const { svc, prisma } = make({
      relations: [active(TG_CLIENT)],
      upcoming: [
        {
          startsAt,
          durationMin: 50,
          status: 'CONFIRMED',
          heldUntil: null,
          cancelToken: 'tok-1',
        },
      ],
    });
    const res = await svc.overview(TG_CLIENT);
    expect(res).toEqual({
      eligible: true,
      upcoming: [
        {
          startsAt: startsAt.toISOString(),
          durationMin: 50,
          status: 'CONFIRMED',
          heldUntil: null,
          manageUrl: 'https://kotlarewski.gr/booking/manage?token=tok-1',
        },
      ],
    });
    const where = prisma.booking.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe(TG_CLIENT);
    expect(where.startsAt).toEqual({ gt: FIXED_NOW });
  });
});
