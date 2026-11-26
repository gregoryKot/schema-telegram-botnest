// Что снимает и что ставит заполнение трекера — на настоящей очереди
// (NotificationService на фейковой таблице), а не на замоканных cancel().
//
// E13 (аудит 2026-11): напоминание Владивостока на 08:00 и Нью-Йорка на 18:00
// планируется накануне вечером по местному времени. Заполнение снимало ВСЕ
// напоминания — и вечерняя запись съедала завтрашнее: в первый пропущенный
// день напоминания не было. Теперь снимается только то, что стоит раньше дня
// следующего контакта.
// R4: «Неделя без дневника» и прочие напоминания о перерыве снимаются все.
// R2: сводка, вехи и «с возвращением» — только при включённых «Итогах дня».
import { Logger } from '@nestjs/common';
import {
  runDiaryComplete,
  type DiaryCompleteDeps,
} from './telegram.diary-complete';
import {
  NotificationService,
  PROACTIVE_TYPES,
  type NotificationType,
} from '../notification/notification.service';
import {
  createFakeTable,
  type Row,
} from '../test-support/fake-prisma.spec-helper';

const at = (iso: string) => new Date(iso);

function make(opts: {
  tz: string;
  nextContact: string;
  rows?: Array<[NotificationType, string]>;
  summaryEnabled?: boolean;
  gap?: number | null;
  streak?: number;
}) {
  const rows: Row[] = (opts.rows ?? []).map(([type, sendAt]) => ({
    userId: 1n,
    type,
    sendAt: at(sendAt),
    sentAt: null,
    cancelledAt: null,
  }));
  const table = createFakeTable(rows);
  const deps = {
    botService: {
      getUserSettings: jest.fn().mockResolvedValue({
        notifyTimezone: opts.tz,
        notifyLocalHour: 21,
        notifyEnabled: true,
        notifySummaryEnabled: opts.summaryEnabled ?? true,
        addressForm: 'ty',
      }),
      getNeeds: jest.fn(() => []),
      getRatings: jest.fn().mockResolvedValue({}),
    },
    analyticsService: {
      getTotalDaysFilled: jest.fn().mockResolvedValue(10),
      getGapBeforeLatestFill: jest.fn().mockResolvedValue(opts.gap ?? null),
      getConsecutiveDays: jest.fn().mockResolvedValue(opts.streak ?? 0),
      getProfileInsight: jest.fn().mockResolvedValue(null),
    },
    pairsService: { getUserPairs: jest.fn().mockResolvedValue([]) },
    notificationService: new NotificationService({
      scheduledNotification: table,
    } as never),
    cadenceService: {
      claimFillDay: jest.fn().mockResolvedValue(true),
      registerFill: jest.fn().mockResolvedValue(opts.nextContact),
    },
    logger: new Logger('test'),
  } as unknown as DiaryCompleteDeps;
  const live = () =>
    table._rows
      .filter((r) => r.sentAt == null && r.cancelledAt == null)
      .map((r) => `${r.type as string}@${(r.sendAt as Date).toISOString()}`);
  return { deps, live, table };
}

describe('заполнение снимает только напоминание на сегодняшний местный день (E13)', () => {
  it('Владивосток: вечерняя запись не трогает завтрашнее 08:00', async () => {
    // Обход 2 июля в 10:00 местного поставил напоминание на 3 июля 08:00.
    const { deps, live } = make({
      tz: 'Asia/Vladivostok',
      nextContact: '2026-07-03',
      rows: [['reminder', '2026-07-02T22:00:00Z']],
    });
    await runDiaryComplete(deps, 1n, at('2026-07-02T10:00:00Z')); // 20:00 местного
    expect(live()).toContain('reminder@2026-07-02T22:00:00.000Z');
  });

  it('Нью-Йорк: запись в 21:00 не трогает напоминание на завтра 18:00', async () => {
    const { deps, live } = make({
      tz: 'America/New_York',
      nextContact: '2026-07-02',
      rows: [['reminder', '2026-07-02T22:00:00Z']],
    });
    await runDiaryComplete(deps, 1n, at('2026-07-02T01:00:00Z')); // 1 июля 21:00 EDT
    expect(live()).toContain('reminder@2026-07-02T22:00:00.000Z');
  });

  it('Москва: напоминание, «напомню через час» и подсказка напарника на сегодня снимаются', async () => {
    const { deps, live } = make({
      tz: 'Europe/Moscow',
      nextContact: '2026-07-03',
      rows: [
        ['reminder', '2026-07-02T18:00:00Z'],
        ['pre_reminder', '2026-07-02T13:00:00Z'],
        ['low_streak_insight', '2026-07-02T18:00:00Z'],
        ['low_streak_insight', '2026-07-03T18:00:00Z'],
        ['pair_activity', '2026-07-02T12:00:00Z'],
      ],
    });
    await runDiaryComplete(deps, 1n, at('2026-07-02T12:00:00Z'));
    expect(live().filter((r) => !r.startsWith('summary'))).toEqual([
      'low_streak_insight@2026-07-03T18:00:00.000Z',
    ]);
  });

  it('частота «через день»: следующий контакт послезавтра — завтрашнее снимается', async () => {
    const { deps, live } = make({
      tz: 'Asia/Vladivostok',
      nextContact: '2026-07-04',
      rows: [
        ['reminder', '2026-07-02T22:00:00Z'],
        ['reminder', '2026-07-03T22:00:00Z'],
      ],
    });
    await runDiaryComplete(deps, 1n, at('2026-07-02T10:00:00Z'));
    expect(live().filter((r) => r.startsWith('reminder'))).toEqual([
      'reminder@2026-07-03T22:00:00.000Z',
    ]);
  });
});

describe('вернулся после перерыва и заполнил — напоминания о перерыве снимаются (R4)', () => {
  it('7 дней без записей, запись днём — вечером ни одного проактивного', async () => {
    const { deps, table } = make({
      tz: 'Europe/Moscow',
      nextContact: '2026-07-03',
      gap: 7,
      rows: [
        ['dormant_7', '2026-07-02T18:00:00Z'], // «Неделя без дневника» в 21:00
        ['nudge', '2026-07-03T18:00:00Z'],
        ['value_recap', '2026-07-02T18:00:00Z'],
      ],
    });
    const now = at('2026-07-02T12:00:00Z');
    await runDiaryComplete(deps, 1n, now);
    const proactiveLeft = table._rows.filter(
      (r) =>
        r.sentAt == null &&
        r.cancelledAt == null &&
        PROACTIVE_TYPES.includes(r.type as NotificationType),
    );
    expect(proactiveLeft).toEqual([]);
    // «С возвращением» — реакция на запись, приходит сразу.
    expect(
      table._rows.some((r) => r.type === 'comeback' && r.cancelledAt == null),
    ).toBe(true);
  });
});

describe('«Итоги дня» (R2): сводка, вехи и «с возвращением» слушаются своего тумблера', () => {
  const types = (rows: string[]) => rows.map((r) => r.split('@')[0]).sort();

  it('итоги выключены — ни сводки, ни вехи, ни «с возвращением»', async () => {
    const milestone = make({
      tz: 'Europe/Moscow',
      nextContact: '2026-07-03',
      summaryEnabled: false,
      streak: 7,
    });
    await runDiaryComplete(milestone.deps, 1n, at('2026-07-02T12:00:00Z'));
    expect(milestone.live()).toEqual([]);

    const comeback = make({
      tz: 'Europe/Moscow',
      nextContact: '2026-07-03',
      summaryEnabled: false,
      gap: 5,
    });
    await runDiaryComplete(comeback.deps, 1n, at('2026-07-02T12:00:00Z'));
    expect(comeback.live()).toEqual([]);
  });

  it('итоги выключены — завтрашнее напоминание стоит дальше', async () => {
    const { deps, live } = make({
      tz: 'Europe/Moscow',
      nextContact: '2026-07-03',
      summaryEnabled: false,
      rows: [['reminder', '2026-07-03T18:00:00Z']],
    });
    await runDiaryComplete(deps, 1n, at('2026-07-02T12:00:00Z'));
    expect(live()).toEqual(['reminder@2026-07-03T18:00:00.000Z']);
  });

  it('итоги включены — сводка в час уведомлений и веха серии', async () => {
    const { deps, live } = make({
      tz: 'Europe/Moscow',
      nextContact: '2026-07-03',
      streak: 7,
    });
    await runDiaryComplete(deps, 1n, at('2026-07-02T12:00:00Z'));
    expect(types(live())).toEqual(['streak_7', 'summary']);
    expect(live()).toContain('summary@2026-07-02T18:00:00.000Z');
  });
});
