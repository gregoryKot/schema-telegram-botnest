// Полуночный обход напоминаний, оборванный рестартом, на РЕАЛЬНОМ Postgres
// (аудит 2026-10, «Полуночный planDay при рестарте посреди прогона теряется»).
//
// Было: аренда `midnightPlanner` берётся на 23 часа ДО цикла по людям; деплой
// посреди цикла обрывал хвост, catch-up нового процесса упирался в свежую
// аренду и молча выходил — хвост сутки без напоминаний. Просто пустить
// catch-up по всем нельзя: повторный planDay уже обойдённому человеку давал
// второе проактивное уведомление за день (practice_missed к уже стоящему
// reminder).
//
// Почему живая база: защита держится на двух свойствах Postgres — один UPDATE
// с условием забирает день человека ровно у одного из параллельных вызовов
// (claimPlanDay), и отметка завершения прогона читается той же строкой аренды.
// Мок ответил бы что угодно (правила №17, №18). Рестарт моделируется настоящим
// путём старта процесса — `catchUpAfterStart` нового экземпляра сервиса из DI
// AppModule (правило №14: тест проходит через код, который в проде создаёт
// предусловие), а не прямым вызовом цикла.
import { INestApplication } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { buildRealDbTestApp } from './e2e-support/build-real-db-test-app';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';
import { stopCronJobs } from './e2e-support/stop-cron-jobs';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountService } from '../src/bot/account.service';
import { TelegramScheduleService } from '../src/telegram/telegram.schedule.service';
import { TelegramModule } from '../src/telegram/telegram.module';
import { NotificationPlannerService } from '../src/notification/notification.planner.service';
import { NotificationCadenceService } from '../src/notification/notification.cadence.service';
import { PROACTIVE_TYPES } from '../src/notification/notification.service';
import {
  addDaysLocal,
  localDateString,
} from '../src/notification/notification.time';
import {
  CronLeaderService,
  LEASE_WINDOW,
} from '../src/infra/cron-leader.service';
import { catchUpClaimWindowMs } from '../src/telegram/telegram.midnight-lease';

const TZ = 'Europe/Moscow';
// Телеграмный диапазон (ниже WEB_USER_ID_MIN): getAllUsersWithSettings берёт их
// без строки AuthProvider.
const WALK = [
  772_000_001n,
  772_000_002n,
  772_000_003n,
  772_000_004n,
  772_000_005n,
];
const SOLO = 772_000_011n;
const RACE = 772_000_012n;
const ALL = [...WALK, SOLO, RACE];

describe('Полуночный обход: обрыв рестартом и доделка на живом Postgres', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planner: NotificationPlannerService;
  let cadence: NotificationCadenceService;
  let leader: CronLeaderService;
  let moduleRef: ModuleRef;

  beforeAll(async () => {
    ({ app, prisma } = await buildRealDbTestApp());
    await stopCronJobs(app);
    // Таймер старта собственного экземпляра приложения выстрелил бы через 30 с
    // посреди спека — процессы здесь моделируются отдельными экземплярами.
    app.get(TelegramScheduleService).onModuleDestroy();
    planner = app.get(NotificationPlannerService);
    cadence = app.get(NotificationCadenceService);
    leader = app.get(CronLeaderService);
    // Контекст модуля сервиса: из корня DI его зависимости не видны.
    moduleRef = app.select(TelegramModule).get(ModuleRef, { strict: true });
    // Обход видит только людей этого спека, а не всю общую базу джобы.
    const accounts = app.get(AccountService);
    const allUsers = accounts.getAllUsersWithSettings.bind(accounts);
    jest
      .spyOn(accounts, 'getAllUsersWithSettings')
      .mockImplementation(async () =>
        (await allUsers()).filter((u) => ALL.includes(u.id)),
      );
  });

  beforeEach(async () => {
    await cleanupOwnershipFixtures(prisma, ALL);
    for (const id of ALL) {
      await prisma.user.create({ data: { id, notifyTimezone: TZ } });
    }
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL);
    await app.close();
  });

  /** Невыполненный вчерашний план: повтор planDay без захвата дня дал бы
   * practice_missed вдобавок к reminder. Две даты — чтобы граница суток между
   * сидом и обходом не делала тест пустым. */
  async function seedMissedPlan(userId: bigint, now: Date) {
    const dates = new Set(
      [now, new Date(now.getTime() + 10 * 60_000)].map((d) =>
        addDaysLocal(localDateString(TZ, d), -1),
      ),
    );
    for (const scheduledDate of dates) {
      await prisma.practicePlan.create({
        data: {
          userId,
          needId: 'safety',
          practiceText: 'дыхание',
          scheduledDate,
        },
      });
    }
  }

  /** Сколько проактивных уведомлений ждёт отправки у каждого человека. */
  async function pendingProactive(ids: bigint[]) {
    const rows = await prisma.scheduledNotification.findMany({
      where: {
        userId: { in: ids },
        type: { in: PROACTIVE_TYPES },
        sentAt: null,
        cancelledAt: null,
      },
      select: { userId: true },
    });
    return ids.map((id) => rows.filter((r) => r.userId === id).length);
  }

  /** Человек так, как его видит обход нового процесса: заново из базы. */
  const loadUser = async (id: bigint) =>
    (await app.get(AccountService).getAllUsersWithSettings()).find(
      (u) => u.id === id,
    )!;

  /** «Процесс» — новый экземпляр сервиса с настоящими зависимостями из DI. */
  const newProcess = () => moduleRef.create(TelegramScheduleService);

  /** Полночь: обход доходит до второго человека, и приходит SIGTERM деплоя
   * (Nest зовёт onModuleDestroy) — обход обязан выйти сам. */
  async function cutWalkAfterTwo() {
    for (const id of WALK) await seedMissedPlan(id, new Date());
    const first = await newProcess();
    const realPlanDay = planner.planDay.bind(planner);
    let planned = 0;
    const spy = jest
      .spyOn(planner, 'planDay')
      .mockImplementation(async (user, now) => {
        await realPlanDay(user, now);
        if (++planned === 2) first.onModuleDestroy();
      });
    await first.scheduleDailyReminders();
    spy.mockRestore();
    const cut = await prisma.cronLease.findUnique({
      where: { name: 'midnightPlanner' },
    });
    expect(cut?.doneRunAt).toBeNull();
    return { planned, cut };
  }

  it('обход оборван после двух человек → старт нового процесса доделывает хвост, дублей нет', async () => {
    const { planned, cut } = await cutWalkAfterTwo();
    expect(planned).toBe(2);
    expect((await pendingProactive(WALK)).sort()).toEqual([0, 0, 0, 1, 1]);

    // Рестарт: новый процесс, тот же путь, что onModuleInit через 30 с.
    await (await newProcess()).catchUpAfterStart();

    expect(await pendingProactive(WALK)).toEqual([1, 1, 1, 1, 1]);
    const done = await prisma.cronLease.findUnique({
      where: { name: 'midnightPlanner' },
    });
    expect(done?.doneRunAt?.getTime()).toBe(cut?.runAt.getTime());
    expect(done?.runAt.getTime()).toBe(cut?.runAt.getTime());

    // Следующий старт в те же сутки — доделывать нечего, новой аренды нет.
    await (await newProcess()).catchUpAfterStart();
    expect(await pendingProactive(WALK)).toEqual([1, 1, 1, 1, 1]);
  });

  it('planDay дважды для одного человека в один день → одно проактивное уведомление', async () => {
    const now = new Date();
    await seedMissedPlan(SOLO, now);
    await planner.planDay(await loadUser(SOLO), now);
    // Второй проход видит человека заново из базы — так его видит доделка
    // нового процесса: notifyLastEvalDate уже сегодняшний. Без захвата дня
    // evaluate отвечает «сегодня не напоминать», и planDay уходит в ветку
    // practice_missed к уже стоящему reminder — два уведомления за день.
    await planner.planDay(await loadUser(SOLO), now);
    expect(await pendingProactive([SOLO])).toEqual([1]);
  });

  it('параллельные захваты дня: ровно один выигрывает; NULL и вчерашняя дата захватываются', async () => {
    const now = new Date();
    const user = { id: RACE, notifyTimezone: TZ };
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        cadence.claimPlanDay(user as never, now),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    const today = localDateString(TZ, now);
    const row = await prisma.user.findUnique({ where: { id: RACE } });
    expect(row?.notifyLastEvalDate).toBe(today);

    // Контроль ветки NULL: у новичка дня ещё не было — захват проходит.
    const fresh = await prisma.user.findUnique({ where: { id: SOLO } });
    expect(fresh?.notifyLastEvalDate).toBeNull();
    await expect(
      cadence.claimPlanDay({ id: SOLO, notifyTimezone: TZ } as never, now),
    ).resolves.toBe(true);

    // Вчерашний день не мешает сегодняшнему.
    await prisma.user.update({
      where: { id: RACE },
      data: { notifyLastEvalDate: addDaysLocal(today, -1) },
    });
    await expect(cadence.claimPlanDay(user as never, now)).resolves.toBe(true);
  });

  it('параллельные planDay одного человека после проведённого дня → одно проактивное уведомление', async () => {
    const now = new Date();
    await seedMissedPlan(RACE, now);
    await planner.planDay(await loadUser(RACE), now);
    // День уже проведён; два процесса (перекатывающийся деплой) приходят к
    // человеку одновременно со свежим снимком. Без захвата дня оба уходят в
    // practice_missed, и уведомлений больше одного при любом порядке.
    const fresh = await loadUser(RACE);
    await Promise.all([
      planner.planDay(fresh, now),
      planner.planDay(fresh, now),
    ]);
    expect(await pendingProactive([RACE])).toEqual([1]);
  });

  it('два процесса стартуют одновременно после оборванного обхода → доделка без дублей', async () => {
    const { cut } = await cutWalkAfterTwo();

    // Оба видят один и тот же незавершённый runAt и обходят параллельно.
    const [a, b] = await Promise.all([newProcess(), newProcess()]);
    await Promise.all([a.catchUpAfterStart(), b.catchUpAfterStart()]);

    expect(await pendingProactive(WALK)).toEqual([1, 1, 1, 1, 1]);
    const done = await prisma.cronLease.findUnique({
      where: { name: 'midnightPlanner' },
    });
    expect(done?.doneRunAt?.getTime()).toBe(cut?.runAt.getTime());
  });

  // Захват при старте и тик в 00:00 — тем же SQL, что в проде: окно старта
  // (catchUpClaimWindowMs) и окно тика (LEASE_WINDOW.hourly). Раньше оба
  // брали 23 ч, и захват в 23:30 давал тику в 00:00 «0 строк».
  it('старт в 23:30 не захватывает, тик в 00:00 следующих суток захватывает; пропущенная полночь — оба', async () => {
    const name = 'e2eMidnightNext';
    await prisma.cronLease.deleteMany({ where: { name } });
    const claimStart = (iso: string) => {
      const at = new Date(iso);
      const windowMs = catchUpClaimWindowMs(at);
      return windowMs === null
        ? Promise.resolve(false)
        : leader.claimRun(name, windowMs, at);
    };
    const claimTick = (iso: string) =>
      leader.claimRun(name, LEASE_WINDOW.hourly, new Date(iso));

    expect(await claimTick('2026-10-22T00:00:00.010Z')).toBe(true);
    expect(await claimStart('2026-10-22T10:00:00Z')).toBe(false);
    expect(await claimStart('2026-10-22T23:30:00Z')).toBe(false);
    expect(await claimTick('2026-10-22T00:00:00.500Z')).toBe(false);
    expect(await claimTick('2026-10-23T00:00:00.010Z')).toBe(true);

    // Полночь 24-го пропущена: старт в 05:00 забирает обход, тик 25-го — тоже.
    expect(await claimStart('2026-10-24T05:00:00Z')).toBe(true);
    expect(await claimTick('2026-10-25T00:00:00Z')).toBe(true);
    await prisma.cronLease.deleteMany({ where: { name } });
  });

  it('отметка завершения: захват → не завершён → finishRun → завершён; старый runAt не метит новый прогон', async () => {
    const name = 'e2eRunDone';
    await prisma.cronLease.deleteMany({ where: { name } });
    const t1 = new Date(Date.now() - 2 * LEASE_WINDOW.daily);
    expect(await leader.claimRun(name, LEASE_WINDOW.daily, t1)).toBe(true);
    const at1 = new Date(t1.getTime() + 60_000);
    await expect(
      leader.unfinishedRun(name, LEASE_WINDOW.daily, at1),
    ).resolves.toEqual(t1);

    await leader.finishRun(name, t1);
    await expect(
      leader.unfinishedRun(name, LEASE_WINDOW.daily, at1),
    ).resolves.toBeNull();

    const t2 = new Date(t1.getTime() + LEASE_WINDOW.daily + 60_000);
    expect(await leader.claimRun(name, LEASE_WINDOW.daily, t2)).toBe(true);
    const at2 = new Date(t2.getTime() + 60_000);
    await expect(
      leader.unfinishedRun(name, LEASE_WINDOW.daily, at2),
    ).resolves.toEqual(t2);

    // Запоздалый finishRun прошлого прогона новый прогон не закрывает.
    await leader.finishRun(name, t1);
    await expect(
      leader.unfinishedRun(name, LEASE_WINDOW.daily, at2),
    ).resolves.toEqual(t2);
    await prisma.cronLease.deleteMany({ where: { name } });
  });
});
