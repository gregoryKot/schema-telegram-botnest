// e2e SMOKE на ЖИВОМ Postgres — куда бот пишет уведомление и чей аккаунт
// заводит /start после слияния.
//
// Разбор 2026-08-29. Планировщик подставлял userId прямо в sendMessage как
// чат-адрес. Допущение «userId == telegramId» верно только для телеграм-входа:
// у Google/почты/MAX номер лежит в веб-диапазоне, а слияние аккаунтов ФИЗИЧЕСКИ
// удаляет строку User источника ($executeRaw в merge.service.ts) и переносит
// привязку на цель. С этого момента уведомления уходили в несуществующий чат,
// Telegram отвечал ошибкой, и человек молча получал botBlockedAt — напоминания
// выключались навсегда у того, кто ни о чём не просил.
//
// Почему только на живом Postgres: перенос в merge написан сырым SQL, которого
// fake-prisma не эмулирует, а вся правка держится на связке
// «AuthProvider переехал → адрес нашёлся». На фейке блок честно skipped, а не
// тихо отсутствует (тот же приём, что в login-ticket.e2e-spec.ts).
import { INestApplication } from '@nestjs/common';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';
import { TELEGRAF_BOT } from '../src/telegram/telegram.constants';
import { MergeService } from '../src/auth/merge.service';
import { AccountService } from '../src/bot/account.service';
import { TelegramScheduleService } from '../src/telegram/telegram.schedule.service';

const REAL_DB = process.env.E2E_REAL_DB === '1';
const describeOnRealDb = REAL_DB ? describe : describe.skip;

describeOnRealDb('e2e: адресация уведомлений после слияния', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  // Телеграмный номер (ниже веб-диапазона) и веб-номер — как в проде.
  const TG = 770_000_001n;
  const WEB = 1_000_000_000_000_101n;
  const WEB_ONLY = 1_000_000_000_000_102n;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    prisma = built.prisma;
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, [TG, WEB, WEB_ONLY]);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupOwnershipFixtures(prisma, [TG, WEB, WEB_ONLY]);
    (app.get(TELEGRAF_BOT).telegram.sendMessage as jest.Mock).mockClear();
  });

  async function seedTelegramUser(userId: bigint, telegramId: bigint) {
    await prisma.user.create({ data: { id: userId } });
    await prisma.authProvider.create({
      data: {
        userId,
        provider: 'telegram',
        providerId: String(telegramId),
      },
    });
  }

  it('после слияния уведомление уходит на telegramId, а не на userId', async () => {
    await seedTelegramUser(TG, TG);
    await prisma.user.create({ data: { id: WEB } });

    // Слияние: источник — телеграм-аккаунт, цель — веб. Именно так работает
    // документированный путь «Google на сайте → привязать Telegram».
    await app.get(MergeService).merge(TG, WEB);

    // Строки источника больше нет, привязка переехала на цель.
    expect(await prisma.user.findUnique({ where: { id: TG } })).toBeNull();
    const moved = await prisma.authProvider.findFirst({
      where: { userId: WEB, provider: 'telegram' },
    });
    expect(moved?.providerId).toBe(String(TG));

    await prisma.scheduledNotification.create({
      data: {
        userId: WEB,
        type: 'summary',
        payload: { text: 'итог дня' },
        sendAt: new Date(Date.now() - 60_000),
      },
    });

    await app.get(TelegramScheduleService).processQueue();

    const sendMessage = app.get(TELEGRAF_BOT).telegram.sendMessage as jest.Mock;
    expect(sendMessage).toHaveBeenCalledWith(
      Number(TG),
      'итог дня',
      expect.anything(),
    );
    expect(sendMessage).not.toHaveBeenCalledWith(
      Number(WEB),
      expect.anything(),
      expect.anything(),
    );
  });

  it('веб-аккаунту без Telegram уведомление снимается, а не метит его заблокировавшим', async () => {
    await prisma.user.create({ data: { id: WEB_ONLY } });
    const notif = await prisma.scheduledNotification.create({
      data: {
        userId: WEB_ONLY,
        type: 'summary',
        payload: { text: 'итог дня' },
        sendAt: new Date(Date.now() - 60_000),
      },
    });

    await app.get(TelegramScheduleService).processQueue();

    const row = await prisma.scheduledNotification.findUnique({
      where: { id: notif.id },
    });
    expect(row?.cancelledAt).not.toBeNull();
    expect(row?.sentAt).toBeNull();
    const user = await prisma.user.findUnique({ where: { id: WEB_ONLY } });
    expect(user?.botBlockedAt).toBeNull();
  });

  it('планировщик даже не рассматривает аккаунт без входа в Telegram', async () => {
    await prisma.user.create({ data: { id: WEB_ONLY } });
    await seedTelegramUser(TG, TG);

    const ids = (await app.get(AccountService).getAllUsersWithSettings()).map(
      (u: { id: bigint }) => String(u.id),
    );

    expect(ids).toContain(String(TG));
    expect(ids).not.toContain(String(WEB_ONLY));
  });

  it('после слияния /start не воссоздаёт аккаунт по сырому telegramId', async () => {
    await seedTelegramUser(TG, TG);
    await prisma.user.create({ data: { id: WEB } });
    await app.get(MergeService).merge(TG, WEB);

    const account = app.get(AccountService);
    const canonical = await account.canonicalUserId(TG);
    expect(canonical).toBe(WEB);

    // Именно этот номер /start передаёт в registerUser — по нему upsert
    // обновляет ЦЕЛЕВУЮ строку, а не заводит рядом пустую.
    await account.registerUser(canonical, 'Ася');

    expect(await prisma.user.findUnique({ where: { id: TG } })).toBeNull();
    const target = await prisma.user.findUnique({ where: { id: WEB } });
    expect(target?.firstName).toBe('Ася');
  });
});
