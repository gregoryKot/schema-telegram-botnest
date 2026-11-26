// Регрессия флака e2e-джобы `migrations` (щит, волна 6): «e2e ownership smoke
// на реальном Postgres» иногда падал на TelegramScheduleService.scheduleDailyReminders
// — pg-pool BoundPool.newClient на уже закрытом пуле. Причина: реальный
// AppModule (см. build-test-app.ts) бутит настоящий TelegramScheduleService
// (только PrismaService/TELEGRAF_BOT подменены — правило CLAUDE.md «Новая
// функциональность»), а его onModuleInit ставит 30с catch-up таймер на
// scheduleDailyReminders. `--runInBand` в CI гоняет несколько spec-файлов
// подряд В ОДНОМ процессе: если таймер прошлого boot'а не снят, он стреляет
// в уже закрытый Prisma-пул следующего.
//
// Фикс — не в харнессе, а в самом сервисе (src/telegram/telegram.schedule.service.ts):
// onModuleDestroy() снимает таймер. Nest вызывает onModuleDestroy на КАЖДЫЙ
// app.close() безусловно (nest-application-context.js: close() сам зовёт
// callDestroyHook(), enableShutdownHooks() тут ни при чём) — значит фикс
// действует на ВСЕ e2e-boot'ы (buildTestApp/buildRealDbTestApp), а не на один
// спек. @Cron-джобы (processQueue, scheduleDailyReminders-по-расписанию)
// отдельного фикса не требуют — @nestjs/schedule сам останавливает их в
// beforeApplicationShutdown (см. SchedulerOrchestrator.closeCronJobs).
//
// Этот тест бьёт по НАСТОЯЩЕМУ харнессу (buildTestApp), а не по сервису,
// созданному вручную (как telegram.schedule.errors.spec.ts) — доказывает,
// что таймер армируется и снимается именно через DI-путь, которым реально
// пользуется CI.
import { INestApplication } from '@nestjs/common';
import { buildTestApp } from './e2e-support/build-test-app';
import { TelegramScheduleService } from '../src/telegram/telegram.schedule.service';

describe('e2e harness: catch-up таймер планировщика неактивен после закрытия приложения', () => {
  let app: INestApplication;

  afterAll(async () => {
    await app?.close();
  });

  it('таймер армирован после init и снят после close() — scheduleDailyReminders не стреляет в закрытый Prisma-пул', async () => {
    ({ app } = await buildTestApp());
    const scheduleService = app.get(TelegramScheduleService);

    // onModuleInit уже отработал внутри app.init() (buildTestApp).
    expect((scheduleService as any).catchupTimer.isArmed()).toBe(true);

    await app.close();

    expect((scheduleService as any).catchupTimer.isArmed()).toBe(false);
  });
});
