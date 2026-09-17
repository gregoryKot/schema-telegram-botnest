// Общая оснастка тестов билета: поддельная Prisma и заглушки соседей.
//
// Живёт одним файлом, а не копией в каждом спеке: два одинаковых фейка на
// 120 строк — это ровно тот дубль, который ловит check-jscpd-ratchet, и ровно
// тот случай, когда правку вносят в одну копию, а вторая тихо остаётся старой.
// Свои тесты внизу — иначе jest ругается на файл без единого it().
import { LoginTicketService } from './login-ticket.service';
import { TicketLinkService } from './ticket-link.service';
import type { AuthService } from '../auth.service';
import type { MergeService } from '../merge.service';
import type { SecurityLogService } from '../security-log.service';
import type { LoginTicketReport } from './login-ticket.report';
import type { PrismaService } from '../../prisma/prisma.service';

export interface Row {
  id: string;
  deviceCodeHash: string;
  userCodeHash: string;
  userId: bigint | null;
  intent: string;
  provider: string;
  hostId: string;
  deviceLabel: string;
  expiresAt: Date;
  approvedUserId: bigint | null;
  approvedAt: Date | null;
  deniedAt: Date | null;
  consumedAt: Date | null;
}

export const MAX_USER = 900_000_000_000_001n;
export const WEB_USER = 555n;
export const TG_USER = 42n;

type Where = Record<string, unknown>;

export function makeDeps() {
  const rows: Row[] = [];
  let seq = 0;
  const providers = [
    {
      userId: MAX_USER,
      provider: 'max',
      providerId: '777',
      displayName: 'Гриша',
    },
  ];

  const match = (r: Row, where: Where): boolean =>
    Object.entries(where).every(([k, v]) => (r as never as Where)[k] === v);

  const loginTicket = {
    create: ({ data }: { data: Partial<Row> }) => {
      const row: Row = {
        id: `row-${++seq}`,
        approvedUserId: null,
        approvedAt: null,
        deniedAt: null,
        consumedAt: null,
        hostId: 'web',
        deviceLabel: '',
        intent: 'link',
        userId: null,
        ...(data as Row),
      };
      rows.push(row);
      return Promise.resolve({ ...row });
    },
    // Копия, а не ссылка: настоящая Prisma отдаёт снимок строки, и код не
    // имеет права полагаться на то, что он «доедет» вслед за update.
    findUnique: ({ where }: { where: Where }) => {
      const row = rows.find((r) => match(r, where));
      return Promise.resolve(row ? { ...row } : null);
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<Row>;
    }) => {
      const row = rows.find((r) => r.id === where.id)!;
      Object.assign(row, data);
      return Promise.resolve({ ...row });
    },
    updateMany: ({ where, data }: { where: Where; data: Partial<Row> }) => {
      const hit = rows.filter((r) => match(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return Promise.resolve({ count: hit.length });
    },
    delete: ({ where }: { where: { id: string } }) => {
      const i = rows.findIndex((r) => r.id === where.id);
      if (i >= 0) rows.splice(i, 1);
      return Promise.resolve({});
    },
    deleteMany: ({ where }: { where: Where }) => {
      const now = new Date();
      const clauses = (where.OR as Where[] | undefined) ?? [where];
      for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        const byUser = clauses.some(
          (c) => 'userId' in c && c.userId === r.userId,
        );
        const stale =
          clauses.some((c) => 'expiresAt' in c) && r.expiresAt < now;
        if (byUser || stale) rows.splice(i, 1);
      }
      return Promise.resolve({ count: 0 });
    },
  };

  const prisma = {
    loginTicket,
    authProvider: {
      findFirst: ({ where }: { where: { userId: bigint; provider: string } }) =>
        Promise.resolve(
          providers.find(
            (p) => p.userId === where.userId && p.provider === where.provider,
          ) ?? null,
        ),
    },
  } as unknown as PrismaService;

  const issueTokens = jest.fn().mockResolvedValue({
    accessToken: 'access-for-target',
    refreshToken: 'refresh-for-target',
    expiresIn: 900,
  });
  const linkProviderToUser = jest.fn().mockResolvedValue({ ok: true });
  const auth = { issueTokens, linkProviderToUser } as unknown as AuthService;

  const merge = {
    merge: jest.fn().mockResolvedValue(undefined),
    summarize: jest.fn().mockResolvedValue({ Rating: 12 }),
  } as unknown as MergeService;

  const securityLog = { log: jest.fn() } as unknown as SecurityLogService;
  // Отчёт о пути входа — заглушка со счётчиком: спекам нужно проверять, какие
  // шаги воронки эмитятся, а настоящий LoginTicketReport ходит в аналитику.
  const report = { step: jest.fn() } as unknown as LoginTicketReport;
  const tickets = new LoginTicketService(prisma, auth, report);
  const links = new TicketLinkService(
    prisma,
    auth,
    merge,
    securityLog,
    tickets,
  );

  return { rows, prisma, auth, merge, securityLog, report, tickets, links };
}

/** Билет входа «как из ярлыка»: хозяина нет, подтверждать будет бот. */
export function startLogin(tickets: LoginTicketService, provider = 'telegram') {
  return tickets.start({
    intent: 'login',
    provider,
    requesterUserId: null,
    hostId: 'web',
    deviceLabel: 'iPhone · Safari',
  });
}

/** Билет привязки «как из мини-аппа»: хозяин есть, подтверждать будет браузер. */
export function startLink(tickets: LoginTicketService, userId = MAX_USER) {
  return tickets.start({
    intent: 'link',
    provider: 'max',
    requesterUserId: userId,
    hostId: 'max',
    deviceLabel: '',
  });
}

describe('оснастка тестов билета', () => {
  it('makeDeps даёт независимые наборы строк — тесты не протекают друг в друга', async () => {
    const a = makeDeps();
    const b = makeDeps();
    await startLogin(a.tickets);
    expect(a.rows).toHaveLength(1);
    expect(b.rows).toHaveLength(0);
  });

  it('заглушка отчёта считает шаги — иначе спеки воронки проходили бы вакуумно', async () => {
    const { tickets, report } = makeDeps();
    await startLogin(tickets);
    expect(report.step).toHaveBeenCalledWith('issued', 'web');
  });

  it('findUnique отдаёт копию строки, а не ссылку на неё', async () => {
    const { tickets, rows } = makeDeps();
    await startLogin(tickets);
    const found = await (
      tickets as unknown as {
        prisma: { loginTicket: { findUnique: (a: unknown) => Promise<Row> } };
      }
    ).prisma.loginTicket.findUnique({ where: { id: rows[0].id } });
    found.provider = 'подменено';
    expect(rows[0].provider).toBe('telegram');
  });
});
