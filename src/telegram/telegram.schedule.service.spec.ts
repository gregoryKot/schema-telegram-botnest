// Поведенческие тесты дневного планировщика TelegramScheduleService:
// scheduleDailyReminders (изоляция ошибок по юзеру) и rescheduleForUser
// (гварды: выключено/пауза/due/pending). Очередь отправки (processQueue) —
// в telegram.schedule-queue.service.spec.ts (лимит ~300 строк на файл,
// CLAUDE.md). Дедуп «одно pair_activity в день» — telegram.pair-notify.spec.ts.
import { Logger } from '@nestjs/common';
import { TelegramScheduleService } from './telegram.schedule.service';

function makeService(
  opts: {
    bot?: any;
    users?: any[];
    planDay?: jest.Mock;
  } = {},
) {
  const botService: any = {
    getUserSettings: jest.fn().mockResolvedValue(null),
  };
  const analyticsService: any = {};
  const accountService: any = {
    getAllUsersWithSettings: jest.fn(() => Promise.resolve(opts.users ?? [])),
  };
  const pairsService: any = { getUserPairs: jest.fn().mockResolvedValue([]) };
  const notificationService: any = {
    cancel: jest.fn().mockResolvedValue(undefined),
    hasPending: jest.fn().mockResolvedValue(false),
  };
  const cadenceService: any = {};
  const plannerService: any = {
    planDay: opts.planDay ?? jest.fn().mockResolvedValue(undefined),
    scheduleReminder: jest.fn().mockResolvedValue(undefined),
  };
  const bot = opts.bot === undefined ? { telegram: {} } : opts.bot;
  const service = new TelegramScheduleService(
    bot,
    botService,
    analyticsService,
    accountService,
    pairsService,
    notificationService,
    cadenceService,
    plannerService,
  );
  return {
    service,
    botService,
    accountService,
    notificationService,
    plannerService,
  };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('scheduleDailyReminders', () => {
  it('бот не запущен (null) — цикл не стартует, planDay не вызывается', async () => {
    const { service, plannerService, accountService } = makeService({
      bot: null,
      users: [{ id: 1n }],
    });
    await service.scheduleDailyReminders();
    expect(accountService.getAllUsersWithSettings).not.toHaveBeenCalled();
    expect(plannerService.planDay).not.toHaveBeenCalled();
  });

  it('зовёт planDay для каждого юзера из getAllUsersWithSettings', async () => {
    const users = [{ id: 1n }, { id: 2n }, { id: 3n }];
    const planDay = jest.fn().mockResolvedValue(undefined);
    const { service } = makeService({ users, planDay });
    await service.scheduleDailyReminders();
    expect(planDay).toHaveBeenCalledTimes(3);
    expect(planDay).toHaveBeenNthCalledWith(1, users[0]);
    expect(planDay).toHaveBeenNthCalledWith(2, users[1]);
    expect(planDay).toHaveBeenNthCalledWith(3, users[2]);
  });

  it('изоляция ошибок: падение planDay для одного юзера не останавливает цикл для остальных', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const users = [{ id: 1n }, { id: 2n }, { id: 3n }];
    const planDay = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom for user 2'))
      .mockResolvedValueOnce(undefined);
    const { service } = makeService({ users, planDay });
    await expect(service.scheduleDailyReminders()).resolves.toBeUndefined();
    // Все три юзера обработаны, несмотря на ошибку у второго.
    expect(planDay).toHaveBeenCalledTimes(3);
    expect(planDay).toHaveBeenNthCalledWith(3, users[2]);
  });
});

describe('rescheduleForUser', () => {
  it('уведомления выключены — отменяет reminder, планировщик не зовёт', async () => {
    const { service, botService, plannerService, notificationService } =
      makeService();
    botService.getUserSettings.mockResolvedValue({
      notifyEnabled: false,
      notifyReminderEnabled: true,
    });
    await service.rescheduleForUser(1n);
    expect(notificationService.cancel).toHaveBeenCalledWith(1n, 'reminder');
    expect(plannerService.planDay).not.toHaveBeenCalled();
  });

  it('юзер на паузе — ничего не планирует и не отменяет', async () => {
    const { service, botService, notificationService, plannerService } =
      makeService();
    botService.getUserSettings.mockResolvedValue({
      notifyEnabled: true,
      notifyReminderEnabled: true,
      notifyPausedUntil: new Date(Date.now() + 86_400_000),
      notifyTimezone: 'Europe/Moscow',
    });
    await service.rescheduleForUser(1n);
    expect(notificationService.cancel).not.toHaveBeenCalled();
    expect(plannerService.scheduleReminder).not.toHaveBeenCalled();
  });

  it('due (nextRemindDate устарел) — планирует напоминание через plannerService', async () => {
    const { service, botService, plannerService } = makeService();
    botService.getUserSettings.mockResolvedValue({
      notifyEnabled: true,
      notifyReminderEnabled: true,
      notifyTimezone: 'Europe/Moscow',
      notifyNextRemindDate: '2020-01-01',
      notifyLocalHour: 21,
      notifyGamified: false,
    });
    await service.rescheduleForUser(1n);
    expect(plannerService.scheduleReminder).toHaveBeenCalledWith(
      1n,
      21,
      'Europe/Moscow',
      expect.any(Date),
      false,
    );
  });

  it('hadPending=true пере-планирует, даже если формально ещё не due', async () => {
    const { service, botService, notificationService, plannerService } =
      makeService();
    const farFuture = '2999-01-01';
    botService.getUserSettings.mockResolvedValue({
      notifyEnabled: true,
      notifyReminderEnabled: true,
      notifyTimezone: 'Europe/Moscow',
      notifyNextRemindDate: farFuture,
      notifyLocalHour: 21,
    });
    notificationService.hasPending.mockResolvedValue(true);
    await service.rescheduleForUser(1n);
    expect(plannerService.scheduleReminder).toHaveBeenCalled();
  });

  it('не due и нет висящего pending — тишина (не пере-планирует зря)', async () => {
    const { service, botService, notificationService, plannerService } =
      makeService();
    const farFuture = '2999-01-01';
    botService.getUserSettings.mockResolvedValue({
      notifyEnabled: true,
      notifyReminderEnabled: true,
      notifyTimezone: 'Europe/Moscow',
      notifyNextRemindDate: farFuture,
      notifyLocalHour: 21,
    });
    notificationService.hasPending.mockResolvedValue(false);
    await service.rescheduleForUser(1n);
    expect(plannerService.scheduleReminder).not.toHaveBeenCalled();
  });
});
