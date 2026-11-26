// Вопрос о невыполненном плане: обход ставит, отметка плана снимает
// (missed-plan.ts). Настоящие планировщик, NotificationService, PracticesService
// и replace-pending.ts над одной базой в памяти: шов «обход поставил → отметка
// нашла и сняла». Лок здесь — заглушка; что Postgres держит его между обходом
// и отметкой — test/notify-stand-in-race.e2e-spec.ts.
import { NotFoundException } from '@nestjs/common';
import {
  NotificationPlannerService,
  type PlannerUser,
} from './notification.planner.service';
import { NotificationService } from './notification.service';
import { PracticesService } from '../bot/practices.service';
import {
  createFakeTable,
  createFakeTransaction,
} from '../test-support/fake-prisma.spec-helper';

const VLADIVOSTOK = 'Asia/Vladivostok'; // +10
const MOSCOW = 'Europe/Moscow';
// Пятница: 10:05 во Владивостоке (день плана — суббота), 03:05 в Москве.
const FRIDAY_WALK = new Date('2026-11-06T00:05:00Z');
const FRIDAY = '2026-11-06';
const THURSDAY = '2026-11-05';

function world(tz: string, hour: number) {
  const db: Record<string, unknown> = {
    practicePlan: createFakeTable([], { defaults: { done: null } }),
    scheduledNotification: createFakeTable([]),
    user: createFakeTable([{ id: 1n, notifyTimezone: tz }]),
    $executeRaw: jest.fn(async () => 0),
  };
  db.$transaction = createFakeTransaction(db);
  const practices = new PracticesService(db as never);
  const planner = new NotificationPlannerService(
    new NotificationService(db as never),
    {
      claimPlanDay: async () => true,
      expirePauseIfDue: async () => 'none',
      evaluate: async () => ({ remindToday: false }),
    } as never,
    { getNeeds: () => [] } as never,
    {
      getDaysSinceLastFill: async () => 1,
      getLowStreakNeeds: async () => [],
    } as never,
    practices,
  );
  const user: PlannerUser = {
    id: 1n,
    notifyTimezone: tz,
    notifyLocalHour: hour,
    notifyReminderEnabled: true,
    notifyFrequency: 0,
    notifyAdaptiveLevel: 0,
    notifyIgnoredCount: 0,
    notifyNextRemindDate: null,
    notifySkipAckDate: null,
    notifyLastEvalDate: null,
    notifyPausedUntil: null,
  };
  const rows = (
    db.scheduledNotification as { _rows: Record<string, unknown>[] }
  )._rows;
  /** Ждущие вопросы о плане: когда уйдут. */
  const asked = () =>
    rows
      .filter((r) => r.type === 'practice_missed' && !r.cancelledAt)
      .map((r) => (r.sendAt as Date).toISOString());
  const plan = (day: string) =>
    practices.createPlan(1n, 'attachment', 'Позвонить другу', day);
  const walk = () => planner.planDay(user, FRIDAY_WALK);
  return { practices, asked, plan, walk };
}

describe('вопрос о невыполненном плане: обход ставит, отметка снимает', () => {
  it('Владивосток, 08:00: о пятничном плане спросят в субботу — отметка в пятницу вечером вопрос снимает', async () => {
    const w = world(VLADIVOSTOK, 8);
    const friday = await w.plan(FRIDAY);
    await w.walk();
    expect(w.asked()).toEqual(['2026-11-06T22:00:00.000Z']); // сб 08:00
    await w.practices.checkinPlan(1n, friday.id, true);
    expect(w.asked()).toEqual([]);
  });

  it('Москва, 21:00: вопрос о вчерашнем плане — как раньше; отметка «не получилось» его тоже снимает', async () => {
    const w = world(MOSCOW, 21);
    const thursday = await w.plan(THURSDAY);
    await w.walk();
    expect(w.asked()).toEqual(['2026-11-06T18:00:00.000Z']); // пт 21:00
    await w.practices.checkinPlan(1n, thursday.id, false);
    expect(w.asked()).toEqual([]);
  });

  it('второй неотмеченный план того же дня держит вопрос до своей отметки', async () => {
    const w = world(VLADIVOSTOK, 8);
    const first = await w.plan(FRIDAY);
    const second = await w.plan(FRIDAY);
    await w.walk();
    await w.practices.checkinPlan(1n, first.id, true);
    expect(w.asked()).toHaveLength(1);
    await w.practices.checkinPlan(1n, second.id, true);
    expect(w.asked()).toEqual([]);
  });

  it('отметка плана другого дня вопрос не снимает', async () => {
    const w = world(VLADIVOSTOK, 8);
    await w.plan(FRIDAY);
    const thursday = await w.plan(THURSDAY);
    await w.walk();
    await w.practices.checkinPlan(1n, thursday.id, true);
    expect(w.asked()).toEqual(['2026-11-06T22:00:00.000Z']);
  });

  it('план отмечен до обхода — вопроса нет', async () => {
    const w = world(VLADIVOSTOK, 8);
    const friday = await w.plan(FRIDAY);
    await w.practices.checkinPlan(1n, friday.id, true);
    await w.walk();
    expect(w.asked()).toEqual([]);
  });

  it('чужой план — 404, вопрос на месте', async () => {
    const w = world(VLADIVOSTOK, 8);
    const friday = await w.plan(FRIDAY);
    await w.walk();
    await expect(w.practices.checkinPlan(2n, friday.id, true)).rejects.toThrow(
      NotFoundException,
    );
    expect(w.asked()).toHaveLength(1);
  });
});
