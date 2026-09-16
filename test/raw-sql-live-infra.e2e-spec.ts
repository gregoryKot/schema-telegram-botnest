// Сырой SQL вне отчёта /stats — на РЕАЛЬНОМ Postgres (см. raw-sql-live-stats:
// мок драйвера не видит, инцидент 2026-09-13). Здесь: /health, зонд аварии
// БД, VACUUM после удаления аккаунта и атомарный захват списания подписки.
jest.mock('../src/utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn(async () => undefined),
  adminIdNum: () => null,
  isAdminSender: () => false,
}));
import { Logger } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { HealthController } from '../src/api/health.controller';
import { DbOutageMonitorService } from '../src/infra/db-outage.service';
import { dbOutage } from '../src/logger/db-outage';
import { deleteAllUserData } from '../src/bot/account.delete';
import { chargeDue } from '../src/subscription/subscription.charges';
import { RobokassaService } from '../src/booking/robokassa.service';
import { BookingNotifyService } from '../src/booking/booking-notify.service';

const USER_ID = 999_000_000_011n;
const SUB_TOKEN = 'e2e-raw-sql-live-subscription';

describe('сырой SQL инфраструктуры на реальном Postgres', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.subscription.deleteMany({ where: { cancelToken: SUB_TOKEN } });
    await prisma.user.deleteMany({ where: { id: USER_ID } });
  });

  afterAll(async () => {
    await prisma.subscription.deleteMany({ where: { cancelToken: SUB_TOKEN } });
    await prisma.user.deleteMany({ where: { id: USER_ID } });
    await prisma.$disconnect();
  });

  it('GET /health: SELECT 1 через драйвер → { status: ok, db: up }', async () => {
    // builtAt: null — ни в CI, ни локально файла BUILD_INFO нет (его пишет
    // только Dockerfile при сборке образа, см. src/utils/build-info.ts).
    await expect(new HealthController(prisma).check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
      builtAt: null,
    });
  });

  it('зонд аварии БД: при открытой аварии SELECT 1 проходит и авария закрывается', async () => {
    dbOutage.reset();
    dbOutage.note("Can't reach database server at `db:5432`");
    expect(dbOutage.isOpen).toBe(true);
    await new DbOutageMonitorService(prisma).probe();
    expect(dbOutage.isOpen).toBe(false);
    dbOutage.reset();
  });

  it('удаление аккаунта: транзакция удаления + VACUUM ANALYZE ($executeRawUnsafe) не падает', async () => {
    await prisma.user.create({ data: { id: USER_ID } });
    await prisma.analyticsEvent.create({
      data: { userId: USER_ID, name: 'share_card', meta: { kind: 'need' } },
    });
    const logger = new Logger('e2e');
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);

    await deleteAllUserData(prisma, logger, USER_ID);
    // VACUUM уходит fire-and-forget с .catch → warn; даём ему завершиться.
    await new Promise((r) => setTimeout(r, 300));

    expect(await prisma.user.findUnique({ where: { id: USER_ID } })).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('списание подписки: UPDATE-захват ($executeRaw) сдвигает nextChargeAt ровно один раз', async () => {
    const past = new Date(Date.now() - 60_000);
    const sub = await prisma.subscription.create({
      data: {
        status: 'active',
        period: 'month',
        amount: 100,
        firstInvId: 1,
        nextChargeAt: past,
        cancelToken: SUB_TOKEN,
      },
    });
    const robokassa = {
      enabled: true,
      chargeRecurring: jest.fn(async () => ({ ok: true, body: '' })),
    } as unknown as RobokassaService;
    const notify = {
      alertAdmin: jest.fn(async () => undefined),
    } as unknown as BookingNotifyService;
    const logger = new Logger('e2e');
    jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    const deps = { prisma, robokassa, notify, logger, enabled: true };

    await chargeDue(deps);
    const after = await prisma.subscription.findUniqueOrThrow({
      where: { id: sub.id },
      include: { charges: true },
    });
    expect(after.nextChargeAt!.getTime()).toBeGreaterThan(Date.now());
    expect(after.charges).toHaveLength(1);
    expect(robokassa.chargeRecurring).toHaveBeenCalledTimes(1);

    // Второй прогон: срок уже сдвинут — списания нет (та самая атомарность).
    await chargeDue(deps);
    expect(robokassa.chargeRecurring).toHaveBeenCalledTimes(1);
  });
});
