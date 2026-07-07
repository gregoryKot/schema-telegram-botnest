import { TelegramScheduleService } from './telegram.schedule.service';

// Изолируем оркестрацию от рендеринга шаблонов (у них свой спек).
jest.mock('../notification/notification.templates', () => ({
  renderTemplate: jest.fn().mockReturnValue({ text: 'msg' }),
  buildSummaryText: jest.fn().mockReturnValue('summary'),
}));
// Тихие часы зависят от реального времени — контролируем isQuietHours явно.
jest.mock('../notification/notification.time', () => {
  const actual = jest.requireActual('../notification/notification.time');
  return { ...actual, isQuietHours: jest.fn().mockReturnValue(false) };
});
import { renderTemplate } from '../notification/notification.templates';
import { isQuietHours } from '../notification/notification.time';

function makeDeps() {
  const bot = { telegram: { sendMessage: jest.fn().mockResolvedValue({}) } };
  const botService = {
    getUserSettings: jest.fn().mockResolvedValue({
      notifyEnabled: true, notifyReminderEnabled: true, notifyLocalHour: 21,
      notifyTimezone: 'Europe/Moscow', notifyPausedUntil: null, notifyNextRemindDate: null,
    }),
    getRatings: jest.fn().mockResolvedValue({}),
    getNeeds: jest.fn().mockReturnValue([{ id: 'attachment', chartLabel: 'Привязанность' }]),
    getAllUsersWithSettings: jest.fn().mockResolvedValue([]),
    markUserBlocked: jest.fn().mockResolvedValue(undefined),
    getSendSettingsFor: jest.fn().mockResolvedValue(new Map([['5', { tz: 'UTC', start: 23, end: 8, form: null }]])),
  };
  const analytics = {
    getConsecutiveDays: jest.fn().mockResolvedValue(3),
    getTotalDaysFilled: jest.fn().mockResolvedValue(5),
    getGapBeforeLatestFill: jest.fn().mockResolvedValue(null),
    getProfileInsight: jest.fn().mockResolvedValue(null),
  };
  const notif = {
    getDue: jest.fn().mockResolvedValue([]),
    markSent: jest.fn().mockResolvedValue(undefined),
    cancel: jest.fn().mockResolvedValue(undefined),
    schedule: jest.fn().mockResolvedValue(undefined),
    hasPending: jest.fn().mockResolvedValue(false),
    hasEver: jest.fn().mockResolvedValue(false),
    lastSentAt: jest.fn().mockResolvedValue(null),
    defer: jest.fn().mockResolvedValue(undefined),
  };
  const cadence = { registerFill: jest.fn().mockResolvedValue(undefined) };
  const planner = {
    scheduleReminder: jest.fn().mockResolvedValue(undefined),
    planDay: jest.fn().mockResolvedValue(undefined),
  };
  const svc = new TelegramScheduleService(
    bot as any, botService as any, analytics as any, notif as any, cadence as any, planner as any,
  );
  return { svc, bot, botService, analytics, notif, cadence, planner };
}

beforeEach(() => {
  (isQuietHours as jest.Mock).mockReturnValue(false);
  (renderTemplate as jest.Mock).mockReturnValue({ text: 'msg' });
});

describe('rescheduleForUser', () => {
  it('уведомления выключены → отменяет reminder, планировщик не зовётся', async () => {
    const { svc, botService, notif, planner } = makeDeps();
    botService.getUserSettings.mockResolvedValue({ notifyEnabled: false });
    await svc.rescheduleForUser(5n);
    expect(notif.cancel).toHaveBeenCalledWith(5n, 'reminder');
    expect(planner.scheduleReminder).not.toHaveBeenCalled();
  });

  it('на паузе (notifyPausedUntil в будущем) → ничего не планируется', async () => {
    const { svc, botService, planner } = makeDeps();
    botService.getUserSettings.mockResolvedValue({
      notifyEnabled: true, notifyReminderEnabled: true,
      notifyPausedUntil: new Date(Date.now() + 86_400_000),
      notifyTimezone: 'UTC', notifyLocalHour: 21,
    });
    await svc.rescheduleForUser(5n);
    expect(planner.scheduleReminder).not.toHaveBeenCalled();
  });

  it('нет pending и nextRemindDate пуст (due) → планирует через planner', async () => {
    const { svc, planner } = makeDeps();
    await svc.rescheduleForUser(5n);
    expect(planner.scheduleReminder).toHaveBeenCalledWith(5n, 21, 'Europe/Moscow', expect.any(Date), false);
  });

  it('нет pending, nextRemindDate в будущем → не переуведомляет', async () => {
    const { svc, botService, planner } = makeDeps();
    botService.getUserSettings.mockResolvedValue({
      notifyEnabled: true, notifyReminderEnabled: true, notifyLocalHour: 21,
      notifyTimezone: 'UTC', notifyPausedUntil: null, notifyNextRemindDate: '2099-01-01',
    });
    await svc.rescheduleForUser(5n);
    expect(planner.scheduleReminder).not.toHaveBeenCalled();
  });

  it('есть pending → перепланирует (свежий payload после смены настроек)', async () => {
    const { svc, botService, notif, planner } = makeDeps();
    botService.getUserSettings.mockResolvedValue({
      notifyEnabled: true, notifyReminderEnabled: true, notifyLocalHour: 9,
      notifyTimezone: 'UTC', notifyPausedUntil: null, notifyNextRemindDate: '2099-01-01',
    });
    notif.hasPending.mockResolvedValue(true);
    await svc.rescheduleForUser(5n);
    expect(planner.scheduleReminder).toHaveBeenCalled();
  });
});

describe('processQueue / runProcessQueue', () => {
  it('без бота — ничего не делает', async () => {
    const deps = makeDeps();
    const svc = new TelegramScheduleService(
      null as any, deps.botService as any, deps.analytics as any,
      deps.notif as any, deps.cadence as any, deps.planner as any,
    );
    await svc.processQueue();
    expect(deps.notif.getDue).not.toHaveBeenCalled();
  });

  it('отправляет due-уведомление и помечает sentAt', async () => {
    const { svc, bot, notif } = makeDeps();
    notif.getDue.mockResolvedValue([{ id: 1, type: 'reminder', userId: 5, payload: null }]);
    await svc.processQueue();
    expect(bot.telegram.sendMessage).toHaveBeenCalledWith(5, 'msg', expect.any(Object));
    expect(notif.markSent).toHaveBeenCalledWith(1);
  });

  it('тихие часы: проактивное уведомление откладывается (defer), не отправляется', async () => {
    const { svc, bot, notif } = makeDeps();
    (isQuietHours as jest.Mock).mockReturnValue(true);
    notif.getDue.mockResolvedValue([{ id: 1, type: 'reminder', userId: 5, payload: null }]);
    await svc.processQueue();
    expect(notif.defer).toHaveBeenCalledWith(1, expect.any(Date));
    expect(bot.telegram.sendMessage).not.toHaveBeenCalled();
    expect(notif.markSent).not.toHaveBeenCalled();
  });

  it('перманентная ошибка (403 заблокирован) → markSent + помечает юзера blocked', async () => {
    const { svc, bot, notif, botService } = makeDeps();
    notif.getDue.mockResolvedValue([{ id: 1, type: 'reminder', userId: 5, payload: null }]);
    bot.telegram.sendMessage.mockRejectedValue({ response: { error_code: 403, description: 'bot was blocked by the user' } });
    await svc.processQueue();
    expect(notif.markSent).toHaveBeenCalledWith(1);
    expect(botService.markUserBlocked).toHaveBeenCalledWith(5n);
  });

  it('transient-ошибка (наш баг, 400 parse) → НЕ markSent (ретрай) и юзер не blocked', async () => {
    const { svc, bot, notif, botService } = makeDeps();
    notif.getDue.mockResolvedValue([{ id: 1, type: 'reminder', userId: 5, payload: null }]);
    bot.telegram.sendMessage.mockRejectedValue({ response: { error_code: 400, description: 'message text is too long' } });
    await svc.processQueue();
    expect(notif.markSent).not.toHaveBeenCalled();
    expect(botService.markUserBlocked).not.toHaveBeenCalled();
  });

  it('нет шаблона для типа → пропускает (markSent), не падает', async () => {
    const { svc, bot, notif } = makeDeps();
    (renderTemplate as jest.Mock).mockReturnValueOnce(null);
    notif.getDue.mockResolvedValue([{ id: 9, type: 'unknown', userId: 5, payload: null }]);
    await svc.processQueue();
    expect(notif.markSent).toHaveBeenCalledWith(9);
    expect(bot.telegram.sendMessage).not.toHaveBeenCalled();
  });
});

describe('scheduleDailyReminders (полночный планировщик)', () => {
  it('без бота — ничего', async () => {
    const deps = makeDeps();
    const svc = new TelegramScheduleService(
      null as any, deps.botService as any, deps.analytics as any,
      deps.notif as any, deps.cadence as any, deps.planner as any,
    );
    await svc.scheduleDailyReminders();
    expect(deps.botService.getAllUsersWithSettings).not.toHaveBeenCalled();
  });

  it('вызывает planner.planDay для каждого юзера; ошибка одного не роняет остальных', async () => {
    const { svc, botService, planner } = makeDeps();
    botService.getAllUsersWithSettings.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    planner.planDay.mockRejectedValueOnce(new Error('boom')); // первый падает
    await svc.scheduleDailyReminders();
    expect(planner.planDay).toHaveBeenCalledTimes(3); // остальные обработаны
  });
});

describe('onDiaryComplete', () => {
  it('отменяет reminder-семейство, регистрирует fill в cadence и планирует summary', async () => {
    const { svc, notif, cadence } = makeDeps();
    await svc.onDiaryComplete(5n);
    expect(notif.cancel).toHaveBeenCalledWith(5n, 'reminder');
    expect(notif.cancel).toHaveBeenCalledWith(5n, 'pre_reminder');
    expect(notif.cancel).toHaveBeenCalledWith(5n, 'summary');
    expect(cadence.registerFill).toHaveBeenCalledWith(5n);
    expect(notif.schedule.mock.calls.some((c) => c[1] === 'summary')).toBe(true);
  });

  it('возврат после перерыва ≥3 дней → comeback с зеркалом данных, вехи не шлются', async () => {
    const { svc, analytics, notif } = makeDeps();
    analytics.getGapBeforeLatestFill.mockResolvedValue(5);
    analytics.getConsecutiveDays.mockResolvedValue(7); // веха была бы, но comeback приоритетнее
    analytics.getProfileInsight.mockResolvedValue({ strongest: 'attachment', strongestAvg: 7.5 });
    await svc.onDiaryComplete(5n);
    const comeback = notif.schedule.mock.calls.find((c) => c[1] === 'comeback');
    expect(comeback).toBeDefined();
    expect(comeback![3]).toMatchObject({ strongestNeed: 'Привязанность', strongestAvg: 7.5 });
    expect(notif.schedule.mock.calls.some((c) => c[1] === 'streak_7')).toBe(false);
  });

  it('comeback уже отправлялся сегодня → не дублируется', async () => {
    const { svc, analytics, notif } = makeDeps();
    analytics.getGapBeforeLatestFill.mockResolvedValue(5);
    notif.lastSentAt.mockResolvedValue(new Date()); // сегодня
    await svc.onDiaryComplete(5n);
    expect(notif.schedule.mock.calls.some((c) => c[1] === 'comeback')).toBe(false);
  });

  it('стрик-веха (7 дней, ещё не отправляли) → streak_7', async () => {
    const { svc, analytics, notif } = makeDeps();
    analytics.getConsecutiveDays.mockResolvedValue(7);
    await svc.onDiaryComplete(5n);
    expect(notif.schedule.mock.calls.some((c) => c[1] === 'streak_7')).toBe(true);
  });

  it('стрик-веха уже отправлялась (hasEver) → не дублирует', async () => {
    const { svc, analytics, notif } = makeDeps();
    analytics.getConsecutiveDays.mockResolvedValue(7);
    notif.hasEver.mockResolvedValue(true);
    await svc.onDiaryComplete(5n);
    expect(notif.schedule.mock.calls.some((c) => c[1] === 'streak_7')).toBe(false);
  });
});
