// Сырой SQL вне отчёта /stats — на РЕАЛЬНОМ Postgres (см. raw-sql-live-stats:
// мок драйвера не видит, инцидент 2026-09-13). Здесь: /health, зонд аварии
// БД, VACUUM после удаления аккаунта, атомарный захват списания подписки и
// лок перепланировки напоминания.
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
import { NotificationService } from '../src/notification/notification.service';
import { lockReschedule } from '../src/notification/replace-pending';

const USER_ID = 999_000_000_011n;
const RESCHEDULE_USER = 999_000_000_012n;
const SUB_TOKEN = 'e2e-raw-sql-live-subscription';

describe('сырой SQL инфраструктуры на реальном Postgres', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.subscription.deleteMany({ where: { cancelToken: SUB_TOKEN } });
    await prisma.user.deleteMany({
      where: { id: { in: [USER_ID, RESCHEDULE_USER] } },
    });
  });

  afterAll(async () => {
    await prisma.subscription.deleteMany({ where: { cancelToken: SUB_TOKEN } });
    await prisma.user.deleteMany({
      where: { id: { in: [USER_ID, RESCHEDULE_USER] } },
    });
    await prisma.$disconnect();
  });

  it('GET /health: SELECT 1 через драйвер → { status: ok, db: up }', async () => {
    // builtAt: null — ни в CI, ни локально файла BUILD_INFO нет (его пишет
    // только Dockerfile при сборке образа, см. src/utils/build-info.ts).
    await expect(new HealthController(prisma).check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
      builtAt: null,
      // Самопроверка (src/infra/self-check) в этом спеке не запускалась —
      // снимок пустой, упавших проб нет.
      // stale не пинится: джоба `migrations` живёт дольше грейса старта, и
      // process.uptime() законно даст true (форму поля держит health.controller.spec).
      selfCheck: { ranAt: null, stale: expect.any(Boolean), failed: [] },
      // Поля запуска (src/api/health-report.ts): момент старта процесса и
      // счёт запусков/падений от супервизора; без супервизора (CI) — null.
      startedAt: expect.any(String),
      launch: null,
      crashesDay: null,
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

  // Хвост E16 (аудит 2026-11): «снять, затем поставить» напоминание шло двумя
  // запросами — обход на одном инстансе и правка настроек на другом давали
  // два напоминания. Лок pg_advisory_xact_lock возвращает void ($executeRaw).
  describe('перепланировка напоминания под локом на человека', () => {
    const live = () =>
      prisma.scheduledNotification.findMany({
        where: {
          userId: RESCHEDULE_USER,
          type: 'reminder',
          sentAt: null,
          cancelledAt: null,
        },
      });
    beforeAll(async () => {
      await prisma.user.create({ data: { id: RESCHEDULE_USER } });
    });

    it('пока сосед держит лок, замена ждёт его коммита и снимает его строку', async () => {
      const notifications = new NotificationService(prisma);
      const theirs = new Date('2030-01-01T06:00:00Z');
      const mine = new Date('2030-01-01T18:00:00Z');
      let release!: () => void;
      const held = new Promise<void>((r) => (release = r));
      let locked!: () => void;
      const lockTaken = new Promise<void>((r) => (locked = r));
      // «Другой инстанс»: взял лок, вставит строку чуть позже.
      const other = prisma.$transaction(
        async (tx) => {
          await lockReschedule(tx, RESCHEDULE_USER);
          locked();
          await held;
          await tx.scheduledNotification.create({
            data: { userId: RESCHEDULE_USER, type: 'reminder', sendAt: theirs },
          });
        },
        { timeout: 15_000 },
      );
      await lockTaken;
      let done = false;
      const replaced = notifications
        .replacePending(RESCHEDULE_USER, 'reminder', mine)
        .then(() => {
          done = true;
        });
      await new Promise((r) => setTimeout(r, 300));
      expect(done).toBe(false);

      release();
      await other;
      await replaced;
      expect((await live()).map((r) => r.sendAt)).toEqual([mine]);
    });

    it('две замены одновременно — в очереди одно напоминание', async () => {
      const notifications = new NotificationService(prisma);
      await Promise.all(
        [6, 9, 18, 21].map((h) =>
          notifications.replacePending(
            RESCHEDULE_USER,
            'reminder',
            new Date(Date.UTC(2030, 0, 2, h)),
          ),
        ),
      );
      expect(await live()).toHaveLength(1);
    });
  });
});
