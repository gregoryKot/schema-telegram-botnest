// E16 (аудит 2026-11): две сводки при параллельном сохранении последних
// оценок. Оба запроса видели день заполненным, оба снимали и ставили сводку —
// вперемешку выходило «снять, снять, поставить, поставить». Теперь день
// забирает один условный UPDATE (claimFillDay). Здесь — настоящие очередь
// (NotificationService) и движок частоты (NotificationCadenceService) на
// фейковых таблицах; атомарность самого UPDATE в Postgres —
// test/midnight-planner-resume.e2e-spec.ts.
import { Logger } from '@nestjs/common';
import {
  runDiaryComplete,
  type DiaryCompleteDeps,
} from './telegram.diary-complete';
import { NotificationService } from '../notification/notification.service';
import { NotificationCadenceService } from '../notification/notification.cadence.service';
import { createFakeTable } from '../test-support/fake-prisma.spec-helper';

const NEED = {
  id: 'attachment',
  emoji: '🤝',
  title: 'Привязанность',
  fullTitle: 'Привязанность',
  chartLabel: 'Привязанность',
};
// 12:00 МСК: час сводки (21:00) ещё впереди.
const NOON = new Date('2026-07-16T09:00:00Z');
const NEXT_NOON = new Date('2026-07-17T09:00:00Z');

function make() {
  const queue = createFakeTable([]);
  const users = createFakeTable([
    {
      id: 1n,
      notifyTimezone: 'Europe/Moscow',
      notifyFrequency: 0,
      notifyAdaptiveLevel: 0,
      notifyIgnoredCount: 0,
      notifyNextRemindDate: null,
      notifySkipAckDate: null,
      notifyLastEvalDate: null,
      notifyLastFillDate: null,
      notifyPausedUntil: null,
    },
  ]);
  const notifications = new NotificationService({
    scheduledNotification: queue,
  } as never);
  const getRatings = jest.fn().mockResolvedValue({ attachment: 5 });
  const deps = {
    botService: {
      getUserSettings: jest.fn().mockResolvedValue({
        notifyTimezone: 'Europe/Moscow',
        notifyLocalHour: 21,
        notifySummaryEnabled: true,
        addressForm: 'ty',
      }),
      getNeeds: () => [NEED],
      getRatings,
    },
    analyticsService: {
      getTotalDaysFilled: jest.fn().mockResolvedValue(7),
      getGapBeforeLatestFill: jest.fn().mockResolvedValue(null),
      getConsecutiveDays: jest.fn().mockResolvedValue(7),
    },
    pairsService: { getUserPairs: jest.fn().mockResolvedValue([]) },
    notificationService: notifications,
    cadenceService: new NotificationCadenceService(
      { user: users } as never,
      notifications,
      {} as never,
    ),
    logger: new Logger('test'),
  } as unknown as DiaryCompleteDeps;
  const live = (type: string) =>
    queue._rows.filter(
      (r) => r.type === type && r.sentAt == null && r.cancelledAt == null,
    );
  return { deps, live, getRatings };
}

describe('заполнение трекера: захват дня (E16)', () => {
  it('два параллельных «последних» сохранения — одна сводка и одна веха', async () => {
    const { deps, live } = make();

    await Promise.all([
      runDiaryComplete(deps, 1n, NOON),
      runDiaryComplete(deps, 1n, NOON),
    ]);

    expect(live('summary')).toHaveLength(1);
    expect(live('streak_7')).toHaveLength(1);
  });

  it('правка оценки после заполнения — та же сводка, без оценок в payload', async () => {
    const { deps, live, getRatings } = make();
    await runDiaryComplete(deps, 1n, NOON);
    getRatings.mockResolvedValue({ attachment: 9 });

    await runDiaryComplete(deps, 1n, new Date(NOON.getTime() + 60_000));

    const [summary] = live('summary');
    expect(live('summary')).toHaveLength(1);
    // Оценки в очередь не попадают (РКН, #1135).
    expect(JSON.stringify(summary.payload ?? null)).not.toContain('9');
    // Время сводки не съехало: правка не перепланирует.
    expect((summary.sendAt as Date).toISOString()).toBe(
      '2026-07-16T18:00:00.000Z',
    );
  });

  it('следующий день — новый захват и новая сводка', async () => {
    const { deps, live } = make();
    await runDiaryComplete(deps, 1n, NOON);

    await runDiaryComplete(deps, 1n, NEXT_NOON);

    const days = live('summary').map((r) =>
      (r.sendAt as Date).toISOString().slice(0, 10),
    );
    // Вчерашнюю снимает заполнение нового дня — как и раньше.
    expect(days).toEqual(['2026-07-17']);
  });
});
