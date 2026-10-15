// Поведенческие тесты очереди отправки TelegramScheduleService
// (processQueue/runProcessQueue): тихие часы, отсутствие шаблона,
// перманентная/временная ошибка отправки, изоляция ошибок между
// уведомлениями, лок от параллельного тика. Дневной планировщик
// (scheduleDailyReminders/rescheduleForUser) — в telegram.schedule.service.spec.ts.
import { Logger } from '@nestjs/common';
import { TelegramScheduleService } from './telegram.schedule.service';
import * as templates from '../notification/notification.templates';
import { LEASE_WINDOW } from '../infra/cron-leader.service';

function makeService(opts: {
  bot?: any;
  due?: any[];
  sendSettings?: Map<string, any>;
  claimRun?: boolean;
}) {
  const botService: any = {
    getUserSettings: jest.fn().mockResolvedValue(null),
  };
  const analyticsService: any = {};
  // Адрес доставки приезжает теми же настройками (getSendSettingsFor). Если
  // спек его не задал — считаем, что у человека телеграмный номер и адрес
  // равен userId: так выглядит подавляющее большинство пользователей бота.
  const defaultSettings = () =>
    new Map(
      (opts.due ?? []).map((n: any) => [
        String(n.userId),
        {
          tz: 'Europe/Moscow',
          start: 22,
          end: 8,
          form: 'ty',
          chatId: BigInt(n.userId),
        },
      ]),
    );
  const accountService: any = {
    getSendSettingsFor: jest.fn(() =>
      Promise.resolve(opts.sendSettings ?? defaultSettings()),
    ),
    markUserBlocked: jest.fn().mockResolvedValue(undefined),
  };
  const pairsService: any = { getUserPairs: jest.fn().mockResolvedValue([]) };
  const notificationService: any = {
    getDue: jest.fn(() => Promise.resolve(opts.due ?? [])),
    markSent: jest.fn().mockResolvedValue(undefined),
    defer: jest.fn().mockResolvedValue(undefined),
    cancelOne: jest.fn().mockResolvedValue(undefined),
  };
  const cadenceService: any = {};
  const plannerService: any = {};
  const claimRun = jest.fn().mockResolvedValue(opts.claimRun ?? true);
  const cronLeader: any = { claimRun };
  const bot =
    opts.bot === undefined
      ? { telegram: { callApi: jest.fn().mockResolvedValue(undefined) } }
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
    cronLeader,
  );
  return { service, notificationService, accountService, bot, claimRun };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  // Фейковые таймеры на весь блок: отправка в очереди ограничена таймером
  // на 15 с (telegram.send-bounded.ts) — без фейковых таймеров этот реальный
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
    const { service, bot, notificationService } = makeService({ due: [] });
    await service.processQueue();
    expect(notificationService.getDue).toHaveBeenCalledWith();
    expect(bot.telegram.callApi).not.toHaveBeenCalled();
  });

  it('тихие часы у получателя — уведомление откладывается (defer), не отправляется', async () => {
    const due = [
      {
        id: 1,
        userId: 1n,
        type: 'reminder',
        payload: null,
        sendAt: new Date(),
      },
    ];
    const sendSettings = new Map([
      ['1', { tz: 'Europe/Moscow', start: 22, end: 8, form: 'ty', chatId: 1n }],
    ]);
    jest.setSystemTime(new Date('2026-07-16T23:00:00+03:00')); // 23:00 МСК — тихо
    const { service, bot, notificationService } = makeService({
      due,
      sendSettings,
    });
    await service.processQueue();
    expect(notificationService.defer).toHaveBeenCalledWith(1, expect.any(Date));
    expect(bot.telegram.callApi).not.toHaveBeenCalled();
    expect(notificationService.markSent).not.toHaveBeenCalled();
  });

  it('quiet-exempt тип (summary) отправляется даже в тихие часы', async () => {
    const due = [
      {
        id: 2,
        userId: 1n,
        type: 'summary',
        payload: { text: 'итог дня' },
        sendAt: new Date(),
      },
    ];
    const sendSettings = new Map([
      ['1', { tz: 'Europe/Moscow', start: 22, end: 8, form: 'ty', chatId: 1n }],
    ]);
    jest.setSystemTime(new Date('2026-07-16T23:00:00+03:00'));
    const { service, bot, notificationService } = makeService({
      due,
      sendSettings,
    });
    await service.processQueue();
    expect(bot.telegram.callApi).toHaveBeenCalledWith(
      'sendMessage',
      expect.objectContaining({
        chat_id: 1,
        text: 'итог дня',
        disable_notification: true,
      }),
      expect.anything(),
    );
    expect(notificationService.markSent).toHaveBeenCalledWith(2);
  });

  it('нет шаблона для типа (no text в payload) — помечает отправленным, не шлёт', async () => {
    const due = [
      { id: 3, userId: 1n, type: 'summary', payload: null, sendAt: new Date() },
    ];
    const { service, bot, notificationService } = makeService({ due });
    await service.processQueue();
    expect(bot.telegram.callApi).not.toHaveBeenCalled();
    expect(notificationService.markSent).toHaveBeenCalledWith(3);
  });

  it('renderTemplate бросает (баг шаблона) — уведомление помечено отправленным, цикл не падает', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const renderSpy = jest
      .spyOn(templates, 'renderTemplate')
      .mockImplementation(() => {
        throw new Error('template crashed');
      });
    const due = [
      {
        id: 99,
        userId: 1n,
        type: 'summary',
        payload: null,
        sendAt: new Date(),
      },
    ];
    const { service, bot, notificationService } = makeService({ due });
    await expect(service.processQueue()).resolves.toBeUndefined();
    expect(bot.telegram.callApi).not.toHaveBeenCalled();
    // Помечаем отправленным — иначе битый шаблон зацикливает очередь навечно
    // (повторная попытка на каждом тике до бесконечности).
    expect(notificationService.markSent).toHaveBeenCalledWith(99);
    renderSpy.mockRestore();
  });

  it('успешная отправка — markSent вызван с id', async () => {
    const due = [
      {
        id: 4,
        userId: 42n,
        type: 'summary',
        payload: { text: 'привет' },
        sendAt: new Date(),
      },
    ];
    const { service, bot, notificationService } = makeService({ due });
    await service.processQueue();
    expect(bot.telegram.callApi).toHaveBeenCalledWith(
      'sendMessage',
      expect.objectContaining({ chat_id: 42, text: 'привет' }),
      expect.anything(),
    );
    expect(notificationService.markSent).toHaveBeenCalledWith(4);
  });

  it('перманентная ошибка (403 — бот заблокирован) — markSent + markUserBlocked, не роняет цикл', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const due = [
      {
        id: 5,
        userId: 42n,
        type: 'summary',
        payload: { text: 'привет' },
        sendAt: new Date(),
      },
    ];
    const bot = {
      telegram: {
        callApi: jest.fn().mockRejectedValue({ response: { error_code: 403 } }),
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
        userId: 42n,
        type: 'summary',
        payload: { text: 'привет' },
        sendAt: new Date(),
      },
    ];
    const bot = {
      telegram: {
        callApi: jest.fn().mockRejectedValue(new Error('network blip')),
      },
    };
    const { service, notificationService, accountService } = makeService({
      due,
      bot,
    });
    await service.processQueue();
    // Отправка реально была попытана (иначе «не помечает» было бы тривиально
    // верно и в случае, когда до sendMessage дело вообще не дошло).
    expect(bot.telegram.callApi).toHaveBeenCalledWith(
      'sendMessage',
      expect.objectContaining({ chat_id: 42, text: 'привет' }),
      expect.anything(),
    );
    expect(notificationService.markSent).not.toHaveBeenCalled();
    expect(accountService.markUserBlocked).not.toHaveBeenCalled();
  });

  it('ошибка у одного due-уведомления не мешает обработать следующее', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const due = [
      {
        id: 7,
        userId: 1n,
        type: 'summary',
        payload: { text: 'первое' },
        sendAt: new Date(),
      },
      {
        id: 8,
        userId: 2n,
        type: 'summary',
        payload: { text: 'второе' },
        sendAt: new Date(),
      },
    ];
    const bot = {
      telegram: {
        callApi: jest
          .fn()
          .mockRejectedValueOnce(new Error('boom'))
          .mockResolvedValueOnce(undefined),
      },
    };
    const { service, notificationService } = makeService({ due, bot });
    await service.processQueue();
    expect(bot.telegram.callApi).toHaveBeenCalledTimes(2);
    // id 7 упало временно — не помечен; id 8 успешно — помечен.
    expect(notificationService.markSent).toHaveBeenCalledWith(8);
    expect(notificationService.markSent).not.toHaveBeenCalledWith(7);
  });

  it('повторный тик, пока предыдущий ещё идёт — пропускается (lock), не дублирует отправку', async () => {
    let resolveSend: () => void = () => {};
    const sendPromise = new Promise<void>((res) => (resolveSend = res));
    const bot = {
      telegram: {
        callApi: jest.fn(() => sendPromise),
      },
    };
    const due = [
      {
        id: 9,
        userId: 1n,
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
    expect(bot.telegram.callApi).toHaveBeenCalledTimes(1);
    expect(bot.telegram.callApi).toHaveBeenCalledWith(
      'sendMessage',
      expect.objectContaining({ chat_id: 1, text: 'x' }),
      expect.anything(),
    );
  });

  it('тик уже забрал другой инстанс — очередь не обрабатывается', async () => {
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    const due = [
      {
        id: 10,
        userId: 1n,
        type: 'summary',
        payload: { text: 'x' },
        sendAt: new Date(),
      },
    ];
    const { service, bot, notificationService, claimRun } = makeService({
      due,
      claimRun: false,
    });

    await service.processQueue();

    expect(claimRun).toHaveBeenCalledWith(
      'notificationQueue',
      LEASE_WINDOW.fiveMinutes,
    );
    expect(notificationService.getDue).not.toHaveBeenCalled();
    expect(bot.telegram.callApi).not.toHaveBeenCalled();
  });
});

// Разбор 2026-08-29. Планировщик подставлял userId прямо в sendMessage как
// чат-адрес. Для веб-входа (Google, почта, MAX) и для слитых аккаунтов такого
// чата нет, отправка падала с «chat not found», и человек молча получал
// botBlockedAt — напоминания выключались навсегда у того, кто ни о чём не
// просил.
describe('кому писать некуда', () => {
  const WEB = 1_000_000_000_000_002n;

  it('нет адреса → уведомление снимается, БЕЗ отметки «заблокировал бота»', async () => {
    const due = [
      {
        id: 9,
        userId: WEB,
        type: 'reminder',
        payload: null,
        sendAt: new Date(),
      },
    ];
    const sendSettings = new Map([
      [
        String(WEB),
        { tz: 'Europe/Moscow', start: 22, end: 8, form: 'ty', chatId: null },
      ],
    ]);
    const { service, bot, notificationService, accountService } = makeService({
      due,
      sendSettings,
    });

    await service.processQueue();

    expect(bot.telegram.callApi).not.toHaveBeenCalled();
    // cancelledAt, а не markSent: sentAt читает lastSentAt(), на нём каденс.
    expect(notificationService.cancelOne).toHaveBeenCalledWith(9);
    expect(notificationService.markSent).not.toHaveBeenCalled();
    // Главное утверждение всей правки.
    expect(accountService.markUserBlocked).not.toHaveBeenCalled();
  });

  it('после слияния письмо уходит на telegramId, а не на userId аккаунта', async () => {
    const due = [
      {
        id: 10,
        userId: WEB,
        type: 'summary',
        payload: { text: 'итог дня' },
        sendAt: new Date(),
      },
    ];
    const sendSettings = new Map([
      [
        String(WEB),
        { tz: 'Europe/Moscow', start: 22, end: 8, form: 'ty', chatId: 777n },
      ],
    ]);
    const { service, bot, notificationService } = makeService({
      due,
      sendSettings,
    });

    await service.processQueue();

    expect(bot.telegram.callApi).toHaveBeenCalledWith(
      'sendMessage',
      expect.objectContaining({ chat_id: 777, text: 'итог дня' }),
      expect.anything(),
    );
    expect(bot.telegram.callApi).not.toHaveBeenCalledWith(
      'sendMessage',
      expect.objectContaining({
        chat_id: Number(WEB),
        text: expect.anything(),
      }),
      expect.anything(),
    );
    expect(notificationService.markSent).toHaveBeenCalledWith(10);
  });

  it('адрес спрашивается ОДИН раз на тик, а не на каждое уведомление', async () => {
    const due = [1, 2, 3].map((id) => ({
      id,
      userId: 1n,
      type: 'summary',
      payload: { text: 'итог' },
      sendAt: new Date(),
    }));
    const { service, accountService } = makeService({ due });

    await service.processQueue();

    // Один запрос на тик и ровно с уникальными номерами: поштучный поиск
    // адреса превратил бы очередь в N+1.
    expect(accountService.getSendSettingsFor).toHaveBeenCalledTimes(1);
    expect(accountService.getSendSettingsFor).toHaveBeenCalledWith([1n]);
  });
});

describe('разные причины «писать больше нельзя»', () => {
  const due = (id: number) => [
    {
      id,
      userId: 1n,
      type: 'summary',
      payload: { text: 'итог' },
      sendAt: new Date(),
    },
  ];

  it('400 «chat not found» — тоже флаг, но причина в логе своя', async () => {
    // Оба исхода означают «по этому адресу писать нельзя», поэтому оба ставят
    // флаг. Разводим их в ЛОГЕ: раньше причина терялась, и «человек закрыл
    // бота» было не отличить от «мы пишем не туда».
    const warns = jest.spyOn(Logger.prototype, 'warn');
    const bot = {
      telegram: {
        callApi: jest.fn().mockRejectedValue({
          response: { error_code: 400, description: 'chat not found' },
        }),
      },
    };
    const { service, notificationService, accountService } = makeService({
      due: due(21),
      bot,
    });

    await service.processQueue();

    expect(notificationService.markSent).toHaveBeenCalledWith(21);
    expect(accountService.markUserBlocked).toHaveBeenCalledWith(1n);
    expect(warns.mock.calls.flat().join(' ')).toContain('chat_not_found');
  });

  it('когда некому доставить многим — в лог уходит одна строка с образцом', async () => {
    const warns = jest.spyOn(Logger.prototype, 'warn');
    const many = Array.from({ length: 7 }, (_, i) => ({
      id: 100 + i,
      userId: 1_000_000_000_000_000n + BigInt(i),
      type: 'summary',
      payload: { text: 'итог' },
      sendAt: new Date(),
    }));
    const sendSettings = new Map(
      many.map((n) => [
        String(n.userId),
        { tz: 'Europe/Moscow', start: 22, end: 8, form: 'ty', chatId: null },
      ]),
    );
    const { service, notificationService } = makeService({
      due: many,
      sendSettings,
    });

    await service.processQueue();

    expect(notificationService.cancelOne).toHaveBeenCalledTimes(7);
    // Авария — это поток: сотня строк в логе равна замьюченному логу.
    const line = warns.mock.calls
      .flat()
      .map(String)
      .find((s) => s.includes('некому доставить'));
    expect(line).toContain('7 уведомлений');
    expect(line).toContain('…');
  });
});

// Аудит 2026-10, r2-3#3. Telegram отвечает дольше 15 с: сообщение доставлено,
// а очередь считала его недоставленным и слала то же напоминание каждый тик
// (5 минут) плюс «Failed to send» админу. Настоящая отмена запроса и разбор
// исхода «неизвестно» (telegram.send-bounded.ts).
describe('медленный ответ Telegram', () => {
  const abortError = () =>
    Object.assign(new Error('The user aborted a request.'), {
      name: 'AbortError',
      type: 'aborted',
    });

  // Фейк Telegram: «доставляет» через 16 с, а если сигнал сработал раньше —
  // отклоняется AbortError, как node-fetch. delivered считает доставки.
  function slowBot() {
    const state = { delivered: 0 };
    const callApi = jest.fn(
      (_m: string, _p: unknown, opts?: { signal?: AbortSignal }) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            state.delivered++;
            resolve({ message_id: 1 });
          }, 16_000);
          opts?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            // Запрос уже у Telegram: доставка не откатывается отменой.
            state.delivered++;
            reject(abortError());
          });
        }),
    );
    return { bot: { telegram: { callApi } }, state, callApi };
  }

  // getDue, учитывающий markSent: помеченная строка больше не «due».
  function statefulDue(rows: any[]) {
    const sent = new Set<number>();
    return {
      sent,
      getDue: jest.fn(() =>
        Promise.resolve(rows.filter((r) => !sent.has(r.id))),
      ),
      markSent: jest.fn((id: number) => {
        sent.add(id);
        return Promise.resolve();
      }),
    };
  }

  const row = {
    id: 300,
    userId: 42n,
    type: 'summary',
    payload: { text: 'напоминание' },
    sendAt: new Date(),
  };

  async function tick(service: TelegramScheduleService) {
    const p = service.processQueue();
    await jest.advanceTimersByTimeAsync(15_000);
    await p;
  }

  it('таймаут: строка помечена отправленной, без error, один warn; второй тик не шлёт', async () => {
    const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const warns = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { bot, state, callApi } = slowBot();
    const { service, notificationService } = makeService({ due: [row], bot });
    const dueState = statefulDue([row]);
    notificationService.getDue = dueState.getDue;
    notificationService.markSent = dueState.markSent;

    await tick(service);
    expect(notificationService.markSent).toHaveBeenCalledWith(300);
    expect(errors).not.toHaveBeenCalled();
    expect(warns).toHaveBeenCalledTimes(1);
    expect(String(warns.mock.calls[0][0])).toContain(
      'исход отправки неизвестен',
    );

    await tick(service);
    expect(callApi).toHaveBeenCalledTimes(1);
    expect(state.delivered).toBe(1);
  });

  it.each([
    [
      'ECONNREFUSED',
      Object.assign(new Error('connect'), { code: 'ECONNREFUSED' }),
    ],
    ['ETIMEDOUT', Object.assign(new Error('connect'), { code: 'ETIMEDOUT' })],
    ['ENOTFOUND', Object.assign(new Error('dns'), { code: 'ENOTFOUND' })],
    [
      '429',
      { response: { error_code: 429, description: 'Too Many Requests' } },
    ],
    ['502', { response: { error_code: 502, description: 'Bad Gateway' } }],
  ])(
    '%s — до Telegram не доехали или он ответил ошибкой: повторяется на следующем тике',
    async (_n, failure) => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const callApi = jest.fn().mockRejectedValue(failure);
      const { service, notificationService } = makeService({
        due: [row],
        bot: { telegram: { callApi } },
      });
      const dueState = statefulDue([row]);
      notificationService.getDue = dueState.getDue;
      notificationService.markSent = dueState.markSent;

      await service.processQueue();
      await service.processQueue();

      expect(notificationService.markSent).not.toHaveBeenCalled();
      expect(callApi).toHaveBeenCalledTimes(2);
      expect(callApi).toHaveBeenLastCalledWith(
        'sendMessage',
        expect.objectContaining({ chat_id: 42, text: 'напоминание' }),
        expect.anything(),
      );
    },
  );

  it('403 по-прежнему ставит флаг блокировки, а не считается неизвестным исходом', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const callApi = jest
      .fn()
      .mockRejectedValue({ response: { error_code: 403 } });
    const { service, accountService, notificationService } = makeService({
      due: [row],
      bot: { telegram: { callApi } },
    });
    await service.processQueue();
    expect(accountService.markUserBlocked).toHaveBeenCalledWith(42n);
    expect(notificationService.markSent).toHaveBeenCalledWith(300);
  });

  it('успешная отправка не оставляет висящих таймеров', async () => {
    const { service } = makeService({ due: [row] });
    await service.processQueue();
    expect(jest.getTimerCount()).toBe(0);
  });
});
