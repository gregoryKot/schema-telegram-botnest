import { TelegramScheduleService } from './telegram.schedule.service';

// Изолируем логику расписания от рендеринга шаблонов (у них свой спек).
jest.mock('../notification/notification.templates', () => ({
  renderTemplate: jest.fn().mockReturnValue({ text: 'msg' }),
  buildSummaryText: jest.fn().mockReturnValue('summary'),
  buildWeeklySummaryText: jest.fn().mockReturnValue('weekly'),
  renderLowStreakInsight: jest.fn().mockReturnValue('insight'),
}));
import { renderTemplate } from '../notification/notification.templates';

function makeDeps() {
  const bot = { telegram: { sendMessage: jest.fn().mockResolvedValue({}) } };
  const botService = {
    getUserSettings: jest.fn().mockResolvedValue({ notifyEnabled: true, notifyReminderEnabled: true, notifyLocalHour: 21, notifyTimezone: 'Europe/Moscow' }),
    getRatings: jest.fn().mockResolvedValue({}),
    getNeeds: jest.fn().mockReturnValue([]),
    getAllUsersWithSettings: jest.fn().mockResolvedValue([]),
    markUserBlocked: jest.fn().mockResolvedValue(undefined),
    getMissedPlans: jest.fn().mockResolvedValue([]),
  };
  const analytics = {
    getConsecutiveDays: jest.fn().mockResolvedValue(3),
    getWeeklyStats: jest.fn().mockResolvedValue([]),
    getHistoryRatings: jest.fn().mockResolvedValue([]),
    getDaysSinceLastFill: jest.fn().mockResolvedValue(0),
    getTotalDaysFilled: jest.fn().mockResolvedValue(5),
    getBestDayOfWeek: jest.fn().mockResolvedValue(null),
    getLowStreakNeeds: jest.fn().mockResolvedValue([]),
  };
  const notif = {
    getDue: jest.fn().mockResolvedValue([]),
    markSent: jest.fn().mockResolvedValue(undefined),
    cancel: jest.fn().mockResolvedValue(undefined),
    schedule: jest.fn().mockResolvedValue(undefined),
    hasPending: jest.fn().mockResolvedValue(false),
    hasEver: jest.fn().mockResolvedValue(false),
  };
  const svc = new TelegramScheduleService(bot as any, botService as any, analytics as any, notif as any);
  return { svc, bot, botService, analytics, notif };
}

describe('rescheduleForUser', () => {
  it('уведомления выключены → отменяет reminder, не планирует', async () => {
    const { svc, botService, notif } = makeDeps();
    botService.getUserSettings.mockResolvedValue({ notifyEnabled: false });
    await svc.rescheduleForUser(5n);
    expect(notif.cancel).toHaveBeenCalledWith(5n, 'reminder');
    expect(notif.schedule).not.toHaveBeenCalled();
  });

  it('включены → отменяет старый и планирует свежий reminder в будущем', async () => {
    const { svc, notif } = makeDeps();
    await svc.rescheduleForUser(5n);
    expect(notif.cancel).toHaveBeenCalledWith(5n, 'reminder');
    const [uid, type, sendAt, payload] = notif.schedule.mock.calls[0];
    expect(uid).toBe(5n);
    expect(type).toBe('reminder');
    expect(sendAt.getTime()).toBeGreaterThan(Date.now()); // никогда не в прошлом
    expect(payload).toHaveProperty('streak', 3);
  });

  it('reminder выключен (notifyReminderEnabled=false) → только отмена', async () => {
    const { svc, botService, notif } = makeDeps();
    botService.getUserSettings.mockResolvedValue({ notifyEnabled: true, notifyReminderEnabled: false, notifyLocalHour: 21, notifyTimezone: 'Europe/Moscow' });
    await svc.rescheduleForUser(5n);
    expect(notif.cancel).toHaveBeenCalledWith(5n, 'reminder');
    expect(notif.schedule).not.toHaveBeenCalled();
  });
});

describe('processQueue / runProcessQueue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('без бота — ничего не делает', async () => {
    const { botService, analytics, notif } = makeDeps();
    const svc = new TelegramScheduleService(null as any, botService as any, analytics as any, notif as any);
    await svc.processQueue();
    expect(notif.getDue).not.toHaveBeenCalled();
  });

  it('отправляет due-уведомление и помечает sentAt', async () => {
    const { svc, bot, notif } = makeDeps();
    notif.getDue.mockResolvedValue([{ id: 1, type: 'reminder', userId: 5, payload: null }]);
    await svc.processQueue();
    expect(bot.telegram.sendMessage).toHaveBeenCalledWith(5, 'msg', expect.any(Object));
    expect(notif.markSent).toHaveBeenCalledWith(1);
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

describe('onDiaryComplete', () => {
  it('отменяет reminder-семейство и планирует summary', async () => {
    const { svc, notif } = makeDeps();
    await svc.onDiaryComplete(5n);
    expect(notif.cancel).toHaveBeenCalledWith(5n, 'reminder');
    expect(notif.cancel).toHaveBeenCalledWith(5n, 'summary');
    const summaryCall = notif.schedule.mock.calls.find((c) => c[1] === 'summary');
    expect(summaryCall).toBeDefined();
  });

  it('стрик-веха (7 дней, ещё не отправляли) → планирует streak_7', async () => {
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

describe('scheduleDailyReminders (полночный крон)', () => {
  const USER = { id: 5, notifyLocalHour: 21, notifyTimezone: 'Europe/Moscow', notifyReminderEnabled: true };

  it('без бота — ничего', async () => {
    const { botService, analytics, notif } = makeDeps();
    const svc = new TelegramScheduleService(null as any, botService as any, analytics as any, notif as any);
    await svc.scheduleDailyReminders();
    expect(botService.getAllUsersWithSettings).not.toHaveBeenCalled();
  });

  it('активный юзер (daysSince=0) → планирует reminder, не lapsing', async () => {
    const { svc, botService, analytics, notif } = makeDeps();
    botService.getAllUsersWithSettings.mockResolvedValue([USER]);
    analytics.getDaysSinceLastFill.mockResolvedValue(0);
    await svc.scheduleDailyReminders();
    expect(notif.schedule.mock.calls.some((c) => c[1] === 'reminder')).toBe(true);
    expect(notif.schedule.mock.calls.some((c) => String(c[1]).startsWith('lapsing'))).toBe(false);
  });

  it('лапсящий юзер (daysSince=2) → планирует lapsing_2 (не переуведомляя)', async () => {
    const { svc, botService, analytics, notif } = makeDeps();
    botService.getAllUsersWithSettings.mockResolvedValue([USER]);
    analytics.getDaysSinceLastFill.mockResolvedValue(2);
    await svc.scheduleDailyReminders();
    expect(notif.schedule.mock.calls.some((c) => c[1] === 'lapsing_2')).toBe(true);
  });

  it('лапсящий, но lapsing_2 уже в очереди → не дублирует', async () => {
    const { svc, botService, analytics, notif } = makeDeps();
    botService.getAllUsersWithSettings.mockResolvedValue([USER]);
    analytics.getDaysSinceLastFill.mockResolvedValue(2);
    notif.hasPending.mockResolvedValue(true);
    await svc.scheduleDailyReminders();
    expect(notif.schedule.mock.calls.some((c) => c[1] === 'lapsing_2')).toBe(false);
  });
});

describe('scheduleWeeklySummaries', () => {
  it('пропускает дормантных юзеров (≥7 дней без заполнения)', async () => {
    const { svc, botService, analytics, notif } = makeDeps();
    botService.getAllUsersWithSettings.mockResolvedValue([{ id: 5, notifyLocalHour: 21, notifyTimezone: 'Europe/Moscow' }]);
    analytics.getDaysSinceLastFill.mockResolvedValue(10);
    await svc.scheduleWeeklySummaries();
    expect(notif.schedule).not.toHaveBeenCalled();
  });

  it('активному юзеру планирует weekly', async () => {
    const { svc, botService, analytics, notif } = makeDeps();
    botService.getAllUsersWithSettings.mockResolvedValue([{ id: 5, notifyLocalHour: 21, notifyTimezone: 'Europe/Moscow' }]);
    analytics.getDaysSinceLastFill.mockResolvedValue(1);
    await svc.scheduleWeeklySummaries();
    expect(notif.schedule.mock.calls.some((c) => c[1] === 'weekly')).toBe(true);
  });

  it('если weekly уже в очереди (hasPending) → пропускает', async () => {
    const { svc, botService, notif } = makeDeps();
    botService.getAllUsersWithSettings.mockResolvedValue([{ id: 5, notifyLocalHour: 21, notifyTimezone: 'Europe/Moscow' }]);
    notif.hasPending.mockResolvedValue(true);
    await svc.scheduleWeeklySummaries();
    expect(notif.schedule).not.toHaveBeenCalled();
  });
});
