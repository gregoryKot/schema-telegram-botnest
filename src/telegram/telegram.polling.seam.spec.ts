// Шовный тест поллинга (аудит 2026-10, backend#12 и #16): НАСТОЯЩИЙ Telegraf
// ходит по `apiRoot` в поддельный Bot API (src/test-support/fake-telegram-api).
// Прежний спек мокал launch() целиком и пинил «409 — ровно одна попытка»;
// Telegraf в нём не участвовал, поэтому класс «поллинг умер молча» не виден.
//   * 409 один раз, потом 200 → поллинг поднимается (getUpdates > 1);
//   * 409 посреди жизни → поллинг возвращается, апдейты не теряются и не
//     обрабатываются дважды;
//   * апдейты, лежавшие в очереди до launch(), обработаны (не стёрты);
//   * не-409 сбой цикла: служебный getUpdates из `finally` Telegraf (sync
//     offset) не обнуляет счётчик подряд идущих неудач;
//   * stop() посреди попытки запуска: поллинг после остановки не поднимается
//     (иначе цикл ретраит мёртвый адрес вечно и держит процесс — ночной jest
//     не выходил после всех тестов, ci-alarm #672);
//   * хендлер бросает мимо своего try/catch → bot.catch пишет error, цикл
//     поллинга не рвётся (ни одной неудачи у BotLauncher), следующий апдейт
//     обработан.
import { Logger } from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import type { Update } from 'telegraf/types';
import { pollingStatus } from '../infra/self-check/polling-status';
import { BotLauncher } from './telegram.launch';
import { staleUpdateGuard } from './telegram.stale-updates';
import { installBotCatch } from './telegram.bot-catch';
import { TelegramService } from './telegram.service';
import {
  FakeTelegramApi,
  GetUpdatesStep,
  startFakeTelegramApi,
} from '../test-support/fake-telegram-api';

const nowSec = () => Math.floor(Date.now() / 1000);
const message = (update_id: number, ageSec = 0): Update =>
  ({
    update_id,
    message: {
      message_id: update_id,
      date: nowSec() - ageSec,
      chat: { id: 42, type: 'private' },
      from: { id: 42, is_bot: false, first_name: 'Т' },
      text: 'привет',
    },
  }) as Update;
const button = (update_id: number): Update =>
  ({
    update_id,
    callback_query: {
      id: String(update_id),
      chat_instance: 'x',
      from: { id: 42, is_bot: false, first_name: 'Т' },
      data: 'unknown:button',
      // Сообщение с кнопкой — вчерашнее: возраст кнопки по нему не определить.
      message: {
        message_id: 1,
        date: nowSec() - 86_400,
        chat: { id: 42, type: 'private' },
      },
    },
  }) as Update;

async function until(cond: () => boolean, ms = 3000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > deadline) throw new Error('until: условие не наступило');
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('поллинг на шве: настоящий Telegraf против поддельного Bot API', () => {
  let api: FakeTelegramApi;
  let bot: Telegraf<Context>;
  let handled: number[];
  let launcher: BotLauncher | undefined;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  async function boot(script: GetUpdatesStep[]) {
    api = await startFakeTelegramApi(script);
    bot = new Telegraf<Context>('1:TEST', {
      telegram: { apiRoot: api.apiRoot },
    });
    handled = [];
    // Как в telegram.providers.ts: guard первым, дальше хендлеры.
    bot.use(staleUpdateGuard());
    bot.use((ctx, next) => {
      handled.push(ctx.update.update_id);
      return next();
    });
  }

  beforeEach(() => {
    pollingStatus.reset();
    delete process.env.BOT_REDIRECT_USERNAME;
    delete process.env.ADMIN_ID;
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });
  afterEach(async () => {
    launcher?.stop();
    launcher = undefined;
    try {
      bot.stop();
    } catch {
      // поллинг мог уже стоять
    }
    await api.close();
    jest.restoreAllMocks();
  });

  it('409 один раз, потом 200: поллинг поднялся (getUpdates > 1), состояние running', async () => {
    await boot(['409', 'ok']);
    launcher = new BotLauncher(bot, new Logger('t'), [20]);
    launcher.start();

    await until(() => pollingStatus.get().state === 'running');
    expect(api.hits.getUpdates).toBeGreaterThan(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('409'));
    expect(error).not.toHaveBeenCalled();
  });

  it('409 посреди жизни: поллинг возвращается, апдейт из очереди обработан один раз', async () => {
    await boot(['ok', '409', 'ok']);
    api.enqueue(message(10));
    launcher = new BotLauncher(bot, new Logger('t'), [20]);
    launcher.start();

    await until(() => handled.includes(10));
    // 409 прилетает на getUpdates, который подтверждал пачку [10] (offset 11),
    // — Telegram её не засчитал и отдаст снова после перезапуска поллинга.
    await until(() => (api.hits.getUpdates ?? 0) >= 4);
    api.enqueue(message(11));
    await until(() => handled.includes(11));

    // 10 после 409 приходит повторно (Telegraf не подтвердил пачку), но
    // guard не даёт обработать его дважды.
    expect(handled).toEqual([10, 11]);
    expect(pollingStatus.get().state).toBe('running');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('409'));
  });

  it('вечный 409: поллинг не сдаётся, на 5-й подряд — error владельцу', async () => {
    await boot(['409']);
    launcher = new BotLauncher(bot, new Logger('t'), [5]);
    launcher.start();

    await until(() => error.mock.calls.length >= 1);
    expect(api.hits.getUpdates).toBeGreaterThanOrEqual(5);
    expect(pollingStatus.get().state).toBe('failed');
  });

  it('long-poll отклонён (400), а служебный sync в finally Telegraf проходит: счётчик не обнуляется, error на 5-й подряд', async () => {
    // Корень: после не-409 сбоя цикла Telegraf зовёт getUpdates {offset,
    // limit: 1} (syncUpdateOffset). Его успех раньше считался «поллинг ожил»
    // и сбрасывал счётчик — неудачи вечно были «первой подряд», error молчал.
    await boot(['400-long']);
    launcher = new BotLauncher(bot, new Logger('t'), [5]);
    launcher.start();

    await until(() => error.mock.calls.length >= 1);
    expect(String(error.mock.calls[0][0])).toContain('подряд неудач: 5');
    // Сверка условия: между неудачами реально проходил sync (limit: 1, без
    // timeout) — иначе тест проверял бы не тот шов.
    const syncs = api.getUpdatesBodies.filter(
      (b) => b.limit === 1 && b.timeout === undefined,
    );
    expect(syncs.length).toBeGreaterThanOrEqual(4);
    expect(pollingStatus.get().state).toBe('failed');
  });

  it('хендлер бросает: bot.catch пишет error, поллинг не рвётся, следующий апдейт обработан', async () => {
    await boot(['ok']);
    installBotCatch(bot, new Logger('t'));
    bot.use((ctx, next) => {
      if (ctx.update.update_id === 20) throw new Error('хендлер упал');
      return next();
    });
    api.enqueue(message(20));
    launcher = new BotLauncher(bot, new Logger('t'), [20]);
    launcher.start();

    await until(() => error.mock.calls.length === 1);
    expect(String(error.mock.calls[0][0])).toContain('message (update_id 20)');
    api.enqueue(message(21));
    await until(() => handled.includes(21));

    // Обработчик Telegraf по умолчанию рвал бы цикл: BotLauncher увидел бы
    // неудачу (warn «Bot polling не работает»), а launch() — новую попытку.
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Bot polling не работает'),
    );
    expect(api.deleteWebhookBodies).toHaveLength(1);
    expect(pollingStatus.get().state).toBe('running');
  });

  it('stop() посреди попытки запуска (deleteWebhook в полёте): long-poll после остановки не уходит', async () => {
    await boot(['409', 'ok']);
    const release = api.holdDeleteWebhook();
    launcher = new BotLauncher(bot, new Logger('t'), [20]);
    launcher.start();
    await until(() => api.deleteWebhookBodies.length === 1);
    release(); // первая попытка → 409 → ретрай, его deleteWebhook ждёт
    await until(() => api.deleteWebhookBodies.length === 2);
    const longPolls = () =>
      api.getUpdatesBodies.filter((b) => b.timeout !== undefined).length;
    expect(longPolls()).toBe(1);

    // Как TelegramService.onModuleDestroy. Прежний цикл (409) уже мёртв —
    // bot.stop() не бросает, но и рвать ему нечего.
    launcher.stop();
    bot.stop();
    release();

    // Служебный sync из finally Telegraf — знак, что цикл новой попытки
    // закончился; без обрыва его бы не было, а long-poll шли бы дальше.
    await until(() => api.getUpdatesBodies.some((b) => b.limit === 1));
    await new Promise((r) => setTimeout(r, 100));
    expect(longPolls()).toBe(1);
    expect(pollingStatus.get().state).toBe('stopped');
  });

  it('очередь до launch() через настоящий TelegramService.onModuleInit: ничего не стёрто', async () => {
    await boot(['ok']);
    api.enqueue(message(1));
    api.enqueue(button(2));
    api.enqueue(message(3, 3600)); // час назад — «хвост», отвечать поздно
    const stub = {} as never;
    const service = new TelegramService(
      bot,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
    );
    service.onModuleInit();

    await until(() => handled.length >= 2);
    // Сообщение 1 и кнопка 2 дошли; кнопку под вчерашним сообщением не режем.
    expect(handled).toEqual([1, 2]);
    expect(
      api.deleteWebhookBodies.map((b) => b.drop_pending_updates),
    ).not.toContain(true);
    service.onModuleDestroy();
  });

  it('контроль фейка: launch с dropPendingUpdates: true очередь стирает', async () => {
    await boot(['ok']);
    api.enqueue(message(1));
    api.enqueue(button(2));
    void bot.launch({ dropPendingUpdates: true });

    await until(() => (api.hits.getUpdates ?? 0) >= 2);
    expect(handled).toEqual([]);
  });
});
