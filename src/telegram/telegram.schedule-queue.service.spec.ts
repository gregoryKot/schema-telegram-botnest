// Поведенческие тесты очереди отправки TelegramScheduleService
// (processQueue/runProcessQueue): тихие часы, отсутствие шаблона,
// перманентная/временная ошибка отправки, изоляция ошибок между
// уведомлениями, лок от параллельного тика. Дневной планировщик
// (scheduleDailyReminders/rescheduleForUser) — в telegram.schedule.service.spec.ts.
import { Logger } from '@nestjs/common';
import { TelegramScheduleService } from './telegram.schedule.service';

function makeService(opts: {
  bot?: any;
  due?: any[];
  sendSettings?: Map<string, any>;
}) {
  const botService: any = {
    getUserSettings: jest.fn().mockResolvedValue(null),
  };
  const analyticsService: any = {};
  const accountService: any = {
    getSendSettingsFor: jest.fn(() =>
      Promise.resolve(opts.sendSettings ?? new Map()),
    ),
    markUserBlocked: jest.fn().mockResolvedValue(undefined),
  };
  const pairsService: any = { getUserPairs: jest.fn().mockResolvedValue([]) };
  const notificationService: any = {
    getDue: jest.fn(() => Promise.resolve(opts.due ?? [])),
    markSent: jest.fn().mockResolvedValue(undefined),
    defer: jest.fn().mockResolvedValue(undefined),
  };
  const cadenceService: any = {};
  const plannerService: any = {};
  const bot =
    opts.bot === undefined
      ? { telegram: { sendMessage: jest.fn().mockResolvedValue(undefined) } }
      : opts.bot;
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
  return { service, notificationService, accountService, bot };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  // Фейковые таймеры на весь блок: sendMessage внутри гонится с
  // Promise.race(..., setTimeout(15s)) — без фейковых таймеров этот реальный
  // 15-секундный таймер зависает и не даёт jest-процессу выйти после тестов.
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-16T12:00:00+03:00')); // не тихие часы по умолчанию
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('processQueue / runProcessQueue', () => {
  it('нет due-уведомлений — ничего не отправляет', async () => {
    const { service, bot } = makeService({ due: [] });
    await service.processQueue();
    expect(bot.telegram.sendMessage).not.toHaveBeenCalled();
  });

  it('тихие часы у получателя — уведомление откладывается (defer), не отправляется', async () => {
    const due = [
      { id: 1, userId: 1, type: 'reminder', payload: null, sendAt: new Date() },
    ];
    const sendSettings = new Map([
      ['1', { tz: 'Europe/Moscow', start: 22, end: 8, form: 'ty' }],
    ]);
    jest.setSystemTime(new Date('2026-07-16T23:00:00+03:00')); // 23:00 МСК — тихо
    const { service, bot, notificationService } = makeService({
      due,
      sendSettings,
    });
    await service.processQueue();
    expect(notificationService.defer).toHaveBeenCalledWith(1, expect.any(Date));
    expect(bot.telegram.sendMessage).not.toHaveBeenCalled();
    expect(notificationService.markSent).not.toHaveBeenCalled();
  });

  it('quiet-exempt тип (summary) отправляется даже в тихие часы', async () => {
    const due = [
      {
        id: 2,
        userId: 1,
        type: 'summary',
        payload: { text: 'итог дня' },
        sendAt: new Date(),
      },
    ];
    const sendSettings = new Map([
      ['1', { tz: 'Europe/Moscow', start: 22, end: 8, form: 'ty' }],
    ]);
    jest.setSystemTime(new Date('2026-07-16T23:00:00+03:00'));
    const { service, bot, notificationService } = makeService({
      due,
      sendSettings,
    });
    await service.processQueue();
    expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
      1,
      'итог дня',
      expect.objectContaining({ disable_notification: true }),
    );
    expect(notificationService.markSent).toHaveBeenCalledWith(2);
  });

  it('нет шаблона для типа (no text в payload) — помечает отправленным, не шлёт', async () => {
    const due = [
      { id: 3, userId: 1, type: 'summary', payload: null, sendAt: new Date() },
    ];
    const { service, bot, notificationService } = makeService({ due });
    await service.processQueue();
    expect(bot.telegram.sendMessage).not.toHaveBeenCalled();
    expect(notificationService.markSent).toHaveBeenCalledWith(3);
  });

  it('успешная отправка — markSent вызван с id', async () => {
    const due = [
      {
        id: 4,
        userId: 42,
        type: 'summary',
        payload: { text: 'привет' },
        sendAt: new Date(),
      },
    ];
    const { service, bot, notificationService } = makeService({ due });
    await service.processQueue();
    expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
      42,
      'привет',
      expect.anything(),
    );
    expect(notificationService.markSent).toHaveBeenCalledWith(4);
  });

  it('перманентная ошибка (403 — бот заблокирован) — markSent + markUserBlocked, не роняет цикл', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const due = [
      {
        id: 5,
        userId: 42,
        type: 'summary',
        payload: { text: 'привет' },
        sendAt: new Date(),
      },
    ];
    const bot = {
      telegram: {
        sendMessage: jest
          .fn()
          .mockRejectedValue({ response: { error_code: 403 } }),
      },
    };
    const { service, notificationService, accountService } = makeService({
      due,
      bot,
    });
    await service.processQueue();
    expect(notificationService.markSent).toHaveBeenCalledWith(5);
    expect(accountService.markUserBlocked).toHaveBeenCalledWith(42n);
  });

  it('временная ошибка (500-подобная) — НЕ помечает отправленным, чтобы повторить на следующем тике', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const due = [
      {
        id: 6,
        userId: 42,
        type: 'summary',
        payload: { text: 'привет' },
        sendAt: new Date(),
      },
    ];
    const bot = {
      telegram: {
        sendMessage: jest.fn().mockRejectedValue(new Error('network blip')),
      },
    };
    const { service, notificationService, accountService } = makeService({
      due,
      bot,
    });
    await service.processQueue();
    expect(notificationService.markSent).not.toHaveBeenCalled();
    expect(accountService.markUserBlocked).not.toHaveBeenCalled();
  });

  it('ошибка у одного due-уведомления не мешает обработать следующее', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const due = [
      {
        id: 7,
        userId: 1,
        type: 'summary',
        payload: { text: 'первое' },
        sendAt: new Date(),
      },
      {
        id: 8,
        userId: 2,
        type: 'summary',
        payload: { text: 'второе' },
        sendAt: new Date(),
      },
    ];
    const bot = {
      telegram: {
        sendMessage: jest
          .fn()
          .mockRejectedValueOnce(new Error('boom'))
          .mockResolvedValueOnce(undefined),
      },
    };
    const { service, notificationService } = makeService({ due, bot });
    await service.processQueue();
    expect(bot.telegram.sendMessage).toHaveBeenCalledTimes(2);
    // id 7 упало временно — не помечен; id 8 успешно — помечен.
    expect(notificationService.markSent).toHaveBeenCalledWith(8);
    expect(notificationService.markSent).not.toHaveBeenCalledWith(7);
  });

  it('повторный тик, пока предыдущий ещё идёт — пропускается (lock), не дублирует отправку', async () => {
    let resolveSend: () => void = () => {};
    const sendPromise = new Promise<void>((res) => (resolveSend = res));
    const bot = {
      telegram: {
        sendMessage: jest.fn(() => sendPromise),
      },
    };
    const due = [
      {
        id: 9,
        userId: 1,
        type: 'summary',
        payload: { text: 'x' },
        sendAt: new Date(),
      },
    ];
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service } = makeService({ due, bot });
    const first = service.processQueue();
    const second = service.processQueue(); // должен увидеть isProcessing=true и выйти
    resolveSend();
    await Promise.all([first, second]);
    expect(bot.telegram.sendMessage).toHaveBeenCalledTimes(1);
  });
});
