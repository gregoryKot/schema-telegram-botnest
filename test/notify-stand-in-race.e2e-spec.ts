// Сообщение дня и вопрос о плане под локом перепланировки на РЕАЛЬНОМ Postgres
// (хвост волны 9; src/notification/replace-pending.ts, missed-plan.ts).
//
// «Такое уже стоит» и «план ещё не отмечен» проверяются внутри транзакции под
// pg_advisory_xact_lock на человека: второй обход ждёт коммита первого и видит
// его строку, отметка плана ждёт обхода и снимает его вопрос. Что лок держит,
// а проверка после него видит чужой коммит, — свойство Postgres, не нашего
// кода; фейк ответил бы что угодно (правила №4, №18). Тот же шов на базе в
// памяти — src/notification/missed-plan.spec.ts и replace-pending.spec.ts.
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationService } from '../src/notification/notification.service';
import { PracticesService } from '../src/bot/practices.service';
import { lockReschedule } from '../src/notification/replace-pending';

// Телеграмный диапазон (ниже WEB_USER_ID_MIN), пояс — Владивосток: вопрос о
// плане дня D уходит в 08:00 дня D+1 = 22:00 UTC дня D.
const WALK_USER = 774_000_001n;
const PLAN_USER = 774_000_002n;
const USERS = [WALK_USER, PLAN_USER];
const ONCE = { unlessPending: true };

describe('сообщение дня и отметка плана под локом на живом Postgres', () => {
  let prisma: PrismaService;
  let notifications: NotificationService;
  let practices: PracticesService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.user.deleteMany({ where: { id: { in: USERS } } });
    for (const id of USERS)
      await prisma.user.create({
        data: { id, notifyTimezone: 'Asia/Vladivostok' },
      });
    notifications = new NotificationService(prisma);
    practices = new PracticesService(prisma);
  });

  afterEach(async () => {
    const where = { userId: { in: USERS } };
    await prisma.scheduledNotification.deleteMany({ where });
    await prisma.practicePlan.deleteMany({ where });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: USERS } } });
    await prisma.$disconnect();
  });

  const pending = (userId: bigint, type: string) =>
    prisma.scheduledNotification.count({
      where: { userId, type, sentAt: null, cancelledAt: null },
    });

  /** «Соседняя транзакция»: взяла лок человека, работу сделает по сигналу. */
  function neighbour(
    userId: bigint,
    work: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ) {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    let locked!: () => void;
    const lockTaken = new Promise<void>((r) => (locked = r));
    const done = prisma.$transaction(
      async (tx) => {
        await lockReschedule(tx, userId);
        locked();
        await held;
        await work(tx);
      },
      { timeout: 15_000 },
    );
    return { lockTaken, release, done };
  }

  it.each(['lapsing_3', 'value_recap', 'weekly', 'donate_reminder'] as const)(
    '%s: четыре обхода разом — в очереди одно',
    async (type) => {
      const at = new Date('2030-01-05T22:00:00Z');
      await Promise.all(
        Array.from({ length: 4 }, () =>
          notifications.swapReminder(WALK_USER, type, at, undefined, ONCE),
        ),
      );
      expect(await pending(WALK_USER, type)).toBe(1);
    },
  );

  it('обход держит лок — отметка плана ждёт его коммита и снимает его вопрос', async () => {
    const day = '2030-01-11';
    const plan = await practices.createPlan(
      PLAN_USER,
      'safety',
      'дыхание',
      day,
    );
    const walk = neighbour(PLAN_USER, (tx) =>
      tx.scheduledNotification.create({
        data: {
          userId: PLAN_USER,
          type: 'practice_missed',
          sendAt: new Date(`${day}T22:00:00Z`),
        },
      }),
    );
    await walk.lockTaken;
    let checked = false;
    const checkin = practices
      .checkinPlan(PLAN_USER, plan.id, true)
      .then(() => (checked = true));
    await new Promise((r) => setTimeout(r, 300));
    expect(checked).toBe(false);

    walk.release();
    await walk.done;
    await checkin;
    expect(await pending(PLAN_USER, 'practice_missed')).toBe(0);
  });

  it('отметка держит лок — обход ждёт её коммита и вопроса не ставит', async () => {
    const day = '2030-01-12';
    const plan = await practices.createPlan(
      PLAN_USER,
      'safety',
      'дыхание',
      day,
    );
    const checkin = neighbour(PLAN_USER, (tx) =>
      tx.practicePlan.update({
        where: { id: plan.id },
        data: { done: true, checkedAt: new Date() },
      }),
    );
    await checkin.lockTaken;
    const walk = notifications.swapReminder(
      PLAN_USER,
      'practice_missed',
      new Date(`${day}T22:00:00Z`),
      undefined,
      { ...ONCE, openPlanDay: day },
    );
    await new Promise((r) => setTimeout(r, 300));

    checkin.release();
    await checkin.done;
    await walk;
    expect(await pending(PLAN_USER, 'practice_missed')).toBe(0);
  });

  it('контроль: план не отмечен — вопрос встаёт, а отметка другого дня его не снимает', async () => {
    const day = '2030-01-13';
    await practices.createPlan(PLAN_USER, 'safety', 'дыхание', day);
    const other = await practices.createPlan(
      PLAN_USER,
      'safety',
      'прогулка',
      '2030-01-12',
    );
    await notifications.swapReminder(
      PLAN_USER,
      'practice_missed',
      new Date(`${day}T22:00:00Z`),
      undefined,
      { ...ONCE, openPlanDay: day },
    );
    await practices.checkinPlan(PLAN_USER, other.id, true);
    expect(await pending(PLAN_USER, 'practice_missed')).toBe(1);
  });
});
