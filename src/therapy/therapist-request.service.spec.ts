// TEST_COVERAGE_PLAN.md, этап 3 п.11: TherapistRequestService — единственный
// путь выдачи роли THERAPIST (эскалация привилегий). Prisma — стейтфулый
// in-memory фейк, сервис инстанцируется напрямую (см. auth.service.spec.ts).
// AccountService — тоже фейк, но читает роль из той же users-таблицы, чтобы
// approve()/submit() видели согласованное состояние.
// (f) Сервис вызывает SecurityLogService: submit() → 'therapist_request_submitted',
// approve() → 'role_changed' (см. security-log.service.ts ALERT_EVENTS →
// DM админу). securityLog — фейк ({ log: jest.fn() }), как в auth.service.spec.ts.
//
// Регрессия на инцидент «заявка на психолога не доходит до бота»:
// после переезда бота (@SchemaLabBot → @SchemeHappensBot) DM админу мог
// молча падать (админ ещё не нажал Start у нового бота), а старый sendTg
// только писал warn в лог — заявка терялась. Фикс: при неудачной доставке
// в Telegram уходит e-mail-фолбэк (notifyAdminWithFallback), покрыто ниже
// в describe('TherapistRequestService.notifyAdmin — доставка заявки админу').
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TherapistRequestService } from './therapist-request.service';
import * as adminAlert from '../utils/admin-alert';

jest.mock('../utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn(() => Promise.resolve()),
}));

const fallback = adminAlert.notifyAdminWithFallback as jest.Mock;

const ADMIN_ID = 111;
const NOT_ADMIN_ID = 222; // не совпадает с process.env.ADMIN_ID

function makeFakePrisma() {
  const requests: any[] = [];
  const users: any[] = [];
  let nextId = 1;

  const findOne = (where: any) =>
    'userId' in where
      ? (requests.find((r) => r.userId === where.userId) ?? null)
      : (requests.find((r) => r.id === where.id) ?? null);

  const prisma: any = {
    therapistRequest: {
      findUnique: jest.fn(({ where, select }: any) => {
        const row = findOne(where);
        if (!row || !select) return row;
        const out: any = {};
        for (const k of Object.keys(select)) out[k] = row[k];
        return out;
      }),
      create: jest.fn(({ data }: any) => {
        const row = {
          id: nextId++,
          reviewedAt: null,
          reviewedBy: null,
          rejectReason: null,
          createdAt: new Date(),
          ...data,
        };
        requests.push(row);
        return row;
      }),
      update: jest.fn(({ where, data }: any) => {
        const row = findOne(where);
        Object.assign(row, data);
        return row;
      }),
    },
    user: {
      update: jest.fn(({ where: { id }, data }: any) => {
        const u = users.find((x: any) => x.id === id);
        Object.assign(u, data);
        return u;
      }),
    },
    $transaction: jest.fn((arg: any) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
    ),
  };
  return { prisma, requests, users };
}

function makeService() {
  const { prisma, requests, users } = makeFakePrisma();
  const accountService = {
    getUserRole: jest.fn((userId: bigint) => {
      const u = users.find((x) => x.id === userId);
      return Promise.resolve(u?.role ?? 'CLIENT');
    }),
  };
  const securityLog = { log: jest.fn() };
  const svc = new TherapistRequestService(
    prisma,
    accountService as any,
    securityLog as any,
  );
  return { svc, prisma, requests, users, accountService, securityLog };
}

const ORIGINAL_ENV = { ...process.env };
let fetchMock: jest.Mock;

beforeEach(() => {
  process.env.BOT_TOKEN = 'test-bot-token';
  process.env.ADMIN_ID = String(ADMIN_ID);
  fetchMock = jest
    .fn()
    .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  global.fetch = fetchMock;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

// notifyAdmin/notifyApplicant запускаются fire-and-forget — даём микротаскам
// долиться перед тем как проверять fetchMock.
const flush = () => new Promise((r) => setImmediate(r));

const INPUT = {
  fullName: 'Иван Иванов',
  qualification: 'Психолог, 5 лет опыта',
  contacts: '@ivanov, ivan@example.com',
  message: 'Хочу помогать клиентам',
};

describe('TherapistRequestService.submit', () => {
  it('happy path: сохраняет pending-заявку и шлёт админу карточку с approve/reject-кнопками', async () => {
    const { svc, requests, users, securityLog } = makeService();
    users.push({ id: 1n, role: 'CLIENT' });
    const result = await svc.submit(1n, INPUT);
    expect(result).toEqual({ id: requests[0].id, status: 'pending' });
    expect(requests[0]).toMatchObject({
      userId: 1n,
      fullName: INPUT.fullName,
      qualification: INPUT.qualification,
      contacts: INPUT.contacts,
      message: INPUT.message,
      status: 'pending',
    });

    // Аудит-событие для SecurityLogService (ALERT_EVENTS → DM админу).
    expect(securityLog.log).toHaveBeenCalledWith(
      'therapist_request_submitted',
      expect.objectContaining({ userId: 1n, requestId: requests[0].id }),
    );

    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.telegram.org/bottest-bot-token/sendMessage');
    const body = JSON.parse(opts.body);
    expect(body.chat_id).toBe(ADMIN_ID);
    expect(body.text).toContain(INPUT.fullName);
    expect(body.text).toContain(INPUT.contacts);
    expect(body.reply_markup.inline_keyboard[0]).toEqual([
      { text: '✅ Approve', callback_data: `treq:approve:${requests[0].id}` },
      { text: '❌ Reject', callback_data: `treq:reject:${requests[0].id}` },
    ]);
  });

  it('юзер уже THERAPIST → ConflictException, заявка не создаётся', async () => {
    const { svc, requests, users } = makeService();
    users.push({ id: 2n, role: 'THERAPIST' });
    await expect(svc.submit(2n, INPUT)).rejects.toThrow(ConflictException);
    expect(requests).toHaveLength(0);
  });

  it.each([
    ['fullName пустой', { ...INPUT, fullName: '  ' }],
    ['contacts пустой', { ...INPUT, contacts: '' }],
    ['message длиннее 1000', { ...INPUT, message: 'x'.repeat(1001) }],
  ])('невалидное поле (%s) → BadRequestException', async (_name, bad) => {
    const { svc, users, requests } = makeService();
    users.push({ id: 3n, role: 'CLIENT' });
    await expect(svc.submit(3n, bad)).rejects.toThrow(BadRequestException);
    expect(requests).toHaveLength(0);
  });

  it('повторная отправка при pending-заявке отклоняется, карточка не дублируется', async () => {
    const { svc, users, requests } = makeService();
    users.push({ id: 4n, role: 'CLIENT' });
    await svc.submit(4n, INPUT);
    await expect(svc.submit(4n, INPUT)).rejects.toThrow(ConflictException);
    expect(requests).toHaveLength(1);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1); // не задвоилось
  });

  it('повторная отправка ПОСЛЕ отклонения — разрешена, перезаписывает ту же строку в pending', async () => {
    const { svc, users, requests } = makeService();
    users.push({ id: 6n, role: 'CLIENT' });
    await svc.submit(6n, INPUT);
    const reqId = requests[0].id;
    await svc.reject(ADMIN_ID, reqId, 'Недостаточно квалификации');
    const second = await svc.submit(6n, { ...INPUT, fullName: 'Пётр Петров' });
    expect(second.id).toBe(reqId); // та же строка (unique по userId), не новая
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      status: 'pending',
      fullName: 'Пётр Петров',
      reviewedAt: null,
      rejectReason: null,
    });
  });
});

describe('TherapistRequestService.getMine — только публичные поля', () => {
  it('без fullName/qualification/contacts; нет заявки → null', async () => {
    const { svc, users } = makeService();
    users.push({ id: 7n, role: 'CLIENT' });
    const { id } = await svc.submit(7n, INPUT);
    const mine = await svc.getMine(7n);
    expect(mine).toEqual({
      id,
      status: 'pending',
      rejectReason: null,
      createdAt: expect.any(Date),
      reviewedAt: null,
    });
    expect(mine.fullName).toBeUndefined();
    expect(await svc.getMine(123n)).toBeNull();
  });
});

describe('TherapistRequestService.approve — выдача роли THERAPIST', () => {
  it('меняет User.role/therapistMode через фейковую Prisma, статус заявки → approved', async () => {
    const { svc, users, requests, securityLog } = makeService();
    users.push({ id: 8n, role: 'CLIENT', therapistMode: false });
    const { id: reqId } = await svc.submit(8n, INPUT);
    await svc.approve(ADMIN_ID, reqId);

    expect(users[0]).toMatchObject({ role: 'THERAPIST', therapistMode: true });
    expect(requests[0]).toMatchObject({
      status: 'approved',
      reviewedBy: BigInt(ADMIN_ID),
      rejectReason: null,
    });
    expect(requests[0].reviewedAt).toBeInstanceOf(Date);

    // Аудит-событие эскалации привилегий — кем и кому выдана роль.
    expect(securityLog.log).toHaveBeenCalledWith(
      'role_changed',
      expect.objectContaining({
        userId: 8n,
        role: 'THERAPIST',
        adminId: ADMIN_ID,
        requestId: reqId,
      }),
    );

    await flush();
    // Последний fetch-вызов — уведомление заявителю (первый был notifyAdmin в submit).
    const [, opts] = fetchMock.mock.calls.at(-1)!;
    const body = JSON.parse(opts.body);
    expect(body.chat_id).toBe(8);
    expect(body.text).toContain('одобрена');
  });

  it('несуществующая заявка → NotFoundException, роль не трогается', async () => {
    const { svc, users } = makeService();
    users.push({ id: 9n, role: 'CLIENT' });
    await expect(svc.approve(ADMIN_ID, 12345)).rejects.toThrow(
      NotFoundException,
    );
    expect(users[0].role).toBe('CLIENT');
  });

  it('уже решённая заявка (не pending) → ConflictException', async () => {
    const { svc, users } = makeService();
    users.push({ id: 10n, role: 'CLIENT' });
    const { id: reqId } = await svc.submit(10n, INPUT);
    await svc.approve(ADMIN_ID, reqId);
    await expect(svc.approve(ADMIN_ID, reqId)).rejects.toThrow(
      ConflictException,
    );
  });
});

// (d) Проверка живёт в самом СЕРВИСЕ (assertAdmin → ForbiddenException).
// telegram.service.ts (`bot.action(/^treq:(approve|reject):(\d+)$/…)`) тоже
// проверяет `ctx.from?.id !== adminId` ДО вызова — защита в двух местах.
// HTTP-контроллер approve/reject не экспонирует — вход только у бота.
describe('approve/reject — только для админа, плюс поведение reject()', () => {
  it('не-админ не может approve — роль не выдаётся', async () => {
    const { svc, users } = makeService();
    users.push({ id: 11n, role: 'CLIENT' });
    const { id: reqId } = await svc.submit(11n, INPUT);
    await expect(svc.approve(NOT_ADMIN_ID, reqId)).rejects.toThrow(
      ForbiddenException,
    );
    expect(users[0].role).toBe('CLIENT');
  });

  it('не-админ не может reject', async () => {
    const { svc, users, requests } = makeService();
    users.push({ id: 12n, role: 'CLIENT' });
    const { id: reqId } = await svc.submit(12n, INPUT);
    await expect(svc.reject(NOT_ADMIN_ID, reqId, 'reason')).rejects.toThrow(
      ForbiddenException,
    );
    expect(requests[0].status).toBe('pending');
  });

  it('ADMIN_ID не задан в env → любой adminId отклоняется', async () => {
    delete process.env.ADMIN_ID;
    const { svc, users } = makeService();
    users.push({ id: 13n, role: 'CLIENT' });
    const { id: reqId } = await svc.submit(13n, INPUT);
    await expect(svc.approve(ADMIN_ID, reqId)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('reject НЕ выдаёт роль, обрезает причину до 500 символов, НЕ шлёт role_changed', async () => {
    const { svc, users, requests, securityLog } = makeService();
    users.push({ id: 14n, role: 'CLIENT' });
    const { id: reqId } = await svc.submit(14n, INPUT);
    securityLog.log.mockClear(); // сбрасываем therapist_request_submitted от submit()
    await svc.reject(ADMIN_ID, reqId, 'x'.repeat(600));
    expect(users[0].role).toBe('CLIENT');
    expect(requests[0].status).toBe('rejected');
    expect(requests[0].rejectReason).toHaveLength(500);
    // reject — не эскалация привилегий, role_changed не должен звучать.
    expect(securityLog.log).not.toHaveBeenCalledWith(
      'role_changed',
      expect.anything(),
    );
    await flush();
    const [, opts] = fetchMock.mock.calls.at(-1)!;
    expect(JSON.parse(opts.body).text).toContain('отклонена');
  });

  it('reject несуществующей заявки → NotFoundException', async () => {
    const { svc } = makeService();
    await expect(svc.reject(ADMIN_ID, 999, 'x')).rejects.toThrow(
      NotFoundException,
    );
  });
});

// notifyAdmin — приватный; вызываем через типизированный доступ, без `any`.
const NOTIFY_REQ = {
  id: 42,
  userId: 123n,
  fullName: 'Мария Иванова',
  qualification: 'Схема-терапевт',
  contacts: '@maria',
  message: null,
};

type WithNotify = { notifyAdmin: (r: typeof NOTIFY_REQ) => Promise<void> };
function makeNotifyAdminService(): TherapistRequestService & WithNotify {
  const prisma = {} as never;
  const accountService = {} as never;
  const securityLog = { log: jest.fn() } as any;
  return new TherapistRequestService(
    prisma,
    accountService,
    securityLog,
  ) as TherapistRequestService & WithNotify;
}

function mockFetchForNotify(ok: boolean, status = ok ? 200 : 403): jest.Mock {
  const fn = jest.fn(() =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve({ description: ok ? '' : 'blocked' }),
    }),
  );
  global.fetch = fn;
  return fn;
}

describe('TherapistRequestService.notifyAdmin — доставка заявки админу', () => {
  const NOTIFY_OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...NOTIFY_OLD_ENV,
      BOT_TOKEN: 'test-token',
      ADMIN_ID: '999',
    };
  });
  afterAll(() => {
    process.env = NOTIFY_OLD_ENV;
  });

  it('DM админу не прошёл (Telegram 403) → e-mail-фолбэк вызван', async () => {
    mockFetchForNotify(false);
    await makeNotifyAdminService().notifyAdmin(NOTIFY_REQ);

    expect(fallback).toHaveBeenCalledTimes(1);
    expect(fallback.mock.calls[0][0]).toContain('#42');
  });

  it('ADMIN_ID не задан → пуш невозможен, e-mail-фолбэк вызван', async () => {
    delete process.env.ADMIN_ID;
    const fetchMockLocal = mockFetchForNotify(true);
    await makeNotifyAdminService().notifyAdmin(NOTIFY_REQ);

    expect(fetchMockLocal).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('DM админу прошёл (Telegram ok) → e-mail-фолбэк НЕ нужен', async () => {
    mockFetchForNotify(true);
    await makeNotifyAdminService().notifyAdmin(NOTIFY_REQ);

    expect(fallback).not.toHaveBeenCalled();
  });
});
