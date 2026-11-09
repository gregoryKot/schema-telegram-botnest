// Два тумблера уведомлений (R2, аудит 2026-11, решение владельца Р1):
// «Напоминания» — notifyEnabled (планировщик), «Итоги дня» —
// notifySummaryEnabled (сводка после заполнения, вехи, «с возвращением»).
// Раньше «Итоги дня» на сайте висели на notifyEnabled: выключил — пропали
// напоминания, а сводка приходила. Read-after-write (правило «сохранил →
// нашёл»): POST настроек → чтение тем же BotService.getUserSettings, что у
// реакции на заполнение и перепланировки, → что встало в очередь.
import { Logger } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { BotService } from '../bot/bot.service';
import { TelegramScheduleService } from '../telegram/telegram.schedule.service';
import { NotificationService } from '../notification/notification.service';
import { nextSendAt } from '../notification/notification.time';
import {
  createFakeTable,
  type Row,
} from '../test-support/fake-prisma.spec-helper';

const NOW = new Date('2026-07-16T12:00:00+03:00');

/** Таблица User, которая честно применяет select: забытое в select поле — undefined. */
function userTable(row: Row) {
  const table = createFakeTable([row]);
  const findUnique = table.findUnique.getMockImplementation()!;
  table.findUnique.mockImplementation(
    (args: { where?: Row; select?: Record<string, boolean> } = {}) => {
      const found = findUnique(args) as Row | null;
      if (!found || !args.select) return found;
      return Object.fromEntries(
        Object.keys(args.select).map((k) => [k, found[k]]),
      );
    },
  );
  return table;
}

function make() {
  const user = userTable({
    id: 1n,
    notifyEnabled: true,
    notifyReminderEnabled: true,
    notifySummaryEnabled: true,
    notifyLocalHour: 21,
    notifyTimezone: 'Europe/Moscow',
    notifyFrequency: 0,
    notifyQuietStart: 22,
    notifyQuietEnd: 8,
    notifyGamified: false,
    notifyPausedUntil: null,
    notifyNextRemindDate: null,
    addressForm: 'ty',
    mySchemaIds: [],
    myModeIds: [],
  });
  const queue = createFakeTable();
  const notifications = new NotificationService({
    scheduledNotification: queue,
  } as never);
  const botService = new BotService({ user } as never);
  jest.spyOn(botService, 'getRatings').mockResolvedValue({});
  const planner = {
    // Как настоящий scheduleReminder: снять стоящее и поставить на час.
    scheduleReminder: jest.fn(
      async (uid: bigint, hour: number, tz: string, now: Date) => {
        await notifications.cancel(uid, 'reminder');
        await notifications.schedule(
          uid,
          'reminder',
          nextSendAt(hour, tz, now),
        );
      },
    ),
  };
  const schedule = new TelegramScheduleService(
    null,
    botService,
    {
      getTotalDaysFilled: jest.fn().mockResolvedValue(10),
      getGapBeforeLatestFill: jest.fn().mockResolvedValue(null),
      getConsecutiveDays: jest.fn().mockResolvedValue(7),
      getProfileInsight: jest.fn().mockResolvedValue(null),
    } as never,
    {} as never,
    { getUserPairs: jest.fn().mockResolvedValue([]) } as never,
    notifications,
    {
      claimFillDay: jest.fn().mockResolvedValue(true),
      registerFill: jest.fn().mockResolvedValue('2026-07-17'),
    } as never,
    planner as never,
    { claimRun: jest.fn() } as never,
  );
  const controller = new SettingsController(
    botService,
    {
      setAdaptiveLevel: jest.fn(),
      notifyRoute: jest
        .fn()
        .mockResolvedValue({ channel: 'telegram', telegramLinked: true }),
    } as never,
    schedule,
  );
  const req = { webUser: { userId: 1n } } as never;
  const live = (type: string) =>
    queue._rows.filter(
      (r) => r.type === type && r.sentAt == null && r.cancelledAt == null,
    );
  return { controller, schedule, req, live };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('тумблеры «Напоминания» и «Итоги дня» (R2)', () => {
  it('выключил итоги → сводки и вехи нет, напоминание есть', async () => {
    const { controller, schedule, req, live } = make();
    await controller.updateSettings(req, { notifySummaryEnabled: false });
    expect((await controller.getSettings(req)).notifySummaryEnabled).toBe(
      false,
    );
    // Запись настроек перепланирует напоминание: «Напоминания» включены.
    expect(live('reminder')).toHaveLength(1);
    await schedule.onDiaryComplete(1n);
    expect(live('summary')).toEqual([]);
    expect(live('streak_7')).toEqual([]);
  });

  it('выключил напоминания → итоги есть, напоминания нет', async () => {
    const { controller, schedule, req, live } = make();
    await controller.updateSettings(req, { notifyLocalHour: 20 }); // напоминание встало
    expect(live('reminder')).toHaveLength(1);
    await controller.updateSettings(req, { notifyEnabled: false });
    expect(live('reminder')).toEqual([]);
    await schedule.onDiaryComplete(1n);
    expect(live('summary')).toHaveLength(1);
    expect(live('streak_7')).toHaveLength(1);
  });

  it('выключил итоги после записи — уже стоящая сводка дня тоже снимается', async () => {
    const { controller, schedule, req, live } = make();
    await schedule.onDiaryComplete(1n);
    expect(live('summary')).toHaveLength(1);
    await controller.updateSettings(req, { notifySummaryEnabled: false });
    expect(live('summary')).toEqual([]);
  });
});
