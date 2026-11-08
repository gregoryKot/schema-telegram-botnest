// Канал «уведомление в приложение» в очереди (telegram.schedule-queue.ts →
// ...queue.push.ts, выбор — src/bot/notify-channel.ts). Правило: есть
// подписка — пуш во все устройства, Telegram не зовётся; подписок не
// осталось (gone) — в этом же проходе Telegram, если привязан; ни того ни
// другого — «некому доставить». Пауза и тихие часы снимают и пуш.
// markUserBlocked из-за пуша — никогда.
import { Logger } from '@nestjs/common';
import { generateVAPIDKeys } from 'web-push';
import { runProcessQueue, type QueueDeps } from './telegram.schedule-queue';
import { RejectCounter, MAX_REJECTS } from './telegram.schedule-queue.rejects';
import type { SendSettings } from '../bot/send-settings';
import { AccountService } from '../bot/account.service';
import { PushService } from '../push/push.service';
import type { PushOutcome } from '../push/push.service';

const NOON = new Date('2026-07-16T12:00:00+03:00');
const row = (id: number, userId: bigint, type = 'reminder') => ({
  id,
  userId,
  type,
  payload: { variant: 0 },
  sendAt: NOON,
});
const settings = (over: Partial<SendSettings> = {}): SendSettings => ({
  tz: 'Europe/Moscow',
  start: 22,
  end: 8,
  form: 'ty',
  chatId: null,
  hasPush: true,
  pausedUntil: null,
  ...over,
});

function deps(opts: {
  due: ReturnType<typeof row>[];
  s: Map<string, SendSettings>;
  push?: (userId: bigint) => PushOutcome;
}) {
  const notificationService = {
    getDue: jest.fn().mockResolvedValue(opts.due),
    claim: jest.fn().mockResolvedValue(true),
    releaseClaim: jest.fn().mockResolvedValue(undefined),
    markSent: jest.fn().mockResolvedValue(undefined),
    cancelOne: jest.fn().mockResolvedValue(undefined),
    defer: jest.fn().mockResolvedValue(undefined),
    countProactiveInDay: jest.fn().mockResolvedValue(0),
  };
  const accountService = {
    getSendSettingsFor: jest.fn().mockResolvedValue(opts.s),
    markUserBlocked: jest.fn().mockResolvedValue(undefined),
  };
  const bot = {
    telegram: { callApi: jest.fn().mockResolvedValue({ message_id: 1 }) },
  };
  const push = {
    sendToUser: jest.fn((userId: bigint) =>
      Promise.resolve(opts.push?.(userId) ?? 'sent'),
    ),
  };
  const track = jest.fn().mockResolvedValue(undefined);
  const d = {
    bot,
    accountService,
    notificationService,
    logger: new Logger('queue-push-spec'),
    pace: { pauseMs: 0 },
    rejects: new RejectCounter(),
    push,
    track,
  } as unknown as QueueDeps;
  return { d, bot, push, notificationService, accountService, track };
}

beforeEach(() => {
  jest.useFakeTimers({
    doNotFake: ['setTimeout', 'clearTimeout', 'setImmediate'],
  });
  jest.setSystemTime(NOON);
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('очередь: канал «уведомление в приложение»', () => {
  it('подписка есть — пуш с payload шаблона, Telegram не зовётся, строка отправлена', async () => {
    const t = deps({
      due: [row(1, 5n)],
      s: new Map([['5', settings({ chatId: 777n })]]),
    });
    await runProcessQueue(t.d);
    expect(t.push.sendToUser).toHaveBeenCalledWith(
      5n,
      expect.objectContaining({
        title: 'Всё по схеме',
        url: '/today',
        tag: 'reminder',
      }),
    );
    expect(t.bot.telegram.callApi).not.toHaveBeenCalled();
    expect(t.notificationService.markSent).toHaveBeenCalledWith(1);
    expect(t.track).toHaveBeenCalledWith(
      expect.objectContaining({ sent: 1, pushed: 1 }),
    );
  });

  it('пуш gone + Telegram привязан — в этом же проходе ушло в Telegram', async () => {
    const t = deps({
      due: [row(1, 5n)],
      s: new Map([['5', settings({ chatId: 777n })]]),
      push: () => 'gone',
    });
    await runProcessQueue(t.d);
    expect(t.bot.telegram.callApi).toHaveBeenCalledWith(
      'sendMessage',
      expect.objectContaining({ chat_id: 777 }),
      expect.anything(),
    );
    expect(t.notificationService.markSent).toHaveBeenCalledWith(1);
    expect(t.notificationService.cancelOne).not.toHaveBeenCalled();
    expect(t.track).toHaveBeenCalledWith(
      expect.objectContaining({ sent: 1, pushed: 0 }),
    );
  });

  it('пуш gone и Telegram нет — снято «некому доставить», бот никого не метит', async () => {
    const t = deps({
      due: [row(1, 5n)],
      s: new Map([['5', settings()]]),
      push: () => 'gone',
    });
    await runProcessQueue(t.d);
    expect(t.notificationService.cancelOne).toHaveBeenCalledWith(1);
    expect(t.notificationService.markSent).not.toHaveBeenCalled();
    expect(t.accountService.markUserBlocked).not.toHaveBeenCalled();
  });

  it('ни подписки, ни Telegram — снято без попыток отправки', async () => {
    const t = deps({
      due: [row(1, 5n)],
      s: new Map([['5', settings({ hasPush: false })]]),
    });
    await runProcessQueue(t.d);
    expect(t.notificationService.cancelOne).toHaveBeenCalledWith(1);
    expect(t.push.sendToUser).not.toHaveBeenCalled();
    expect(t.bot.telegram.callApi).not.toHaveBeenCalled();
  });

  it('тихие часы откладывают и пуш; пауза снимает проактивное', async () => {
    jest.setSystemTime(new Date('2026-07-16T23:30:00+03:00'));
    const quiet = deps({ due: [row(1, 5n)], s: new Map([['5', settings()]]) });
    await runProcessQueue(quiet.d);
    expect(quiet.notificationService.defer).toHaveBeenCalled();
    expect(quiet.push.sendToUser).not.toHaveBeenCalled();

    jest.setSystemTime(NOON);
    const paused = deps({
      due: [row(2, 5n)],
      s: new Map([
        ['5', settings({ pausedUntil: new Date('2026-07-20T00:00:00Z') })],
      ]),
    });
    await runProcessQueue(paused.d);
    expect(paused.notificationService.cancelOne).toHaveBeenCalledWith(2);
    expect(paused.push.sendToUser).not.toHaveBeenCalled();
  });

  it('unknown — отправленным (без дубля), failed — остаётся, после MAX_REJECTS снимается', async () => {
    const unknown = deps({
      due: [row(1, 5n)],
      s: new Map([['5', settings()]]),
      push: () => 'unknown',
    });
    await runProcessQueue(unknown.d);
    expect(unknown.notificationService.markSent).toHaveBeenCalledWith(1);

    const failed = deps({
      due: [row(2, 5n)],
      s: new Map([['5', settings({ chatId: 777n })]]),
      push: () => 'failed',
    });
    for (let i = 1; i < MAX_REJECTS; i++) await runProcessQueue(failed.d);
    expect(failed.notificationService.cancelOne).not.toHaveBeenCalled();
    expect(failed.notificationService.markSent).not.toHaveBeenCalled();
    await runProcessQueue(failed.d);
    expect(failed.notificationService.cancelOne).toHaveBeenCalledWith(2);
    // Telegram при «failed» не зовётся: подписка жива, дубля в двух каналах нет.
    expect(failed.bot.telegram.callApi).not.toHaveBeenCalled();
    expect(failed.accountService.markUserBlocked).not.toHaveBeenCalled();
  });

  it('бюджет прогона вышел — пуш не шлётся, строка ждёт следующего тика', async () => {
    const t = deps({
      due: [row(1, 5n), row(2, 6n)],
      s: new Map([
        ['5', settings()],
        ['6', settings()],
      ]),
    });
    let now = 0;
    (t.d as { pace: object }).pace = {
      pauseMs: 0,
      budgetMs: 1_000,
      now: () => (now += 600),
    };
    await runProcessQueue(t.d);
    expect(t.push.sendToUser).toHaveBeenCalledTimes(1);
    expect(t.notificationService.markSent).toHaveBeenCalledTimes(1);
    expect(t.track).toHaveBeenCalledWith(
      expect.objectContaining({ deferred: 1 }),
    );
  });
});

// Сохранил → нашёл: подписка, сохранённая PushService, видна очереди через
// AccountService (тот же загрузчик, что у экрана настроек), payload доходит до
// транспорта web-push; после отписки уведомление в приложение не шлётся.
describe('read-after-write: подписался → очередь шлёт в приложение; отписался → нет', () => {
  const env = process.env;
  const vapid = generateVAPIDKeys();
  beforeAll(() => {
    process.env = {
      ...env,
      VAPID_PUBLIC_KEY: vapid.publicKey,
      VAPID_PRIVATE_KEY: vapid.privateKey,
    };
  });
  afterAll(() => {
    process.env = env;
  });

  it('связка PushService ↔ AccountService ↔ очередь', async () => {
    const subs: Array<{
      id: number;
      userId: bigint;
      endpointHash: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }> = [];
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1_000_000_000_000_501n,
            notifyTimezone: 'Europe/Moscow',
            notifyQuietStart: 22,
            notifyQuietEnd: 8,
            addressForm: 'vy',
            authProviders: [],
          },
        ]),
      },
      pushSubscription: {
        upsert: jest.fn(({ where, create }) => {
          if (!subs.some((s) => s.endpointHash === where.endpointHash))
            subs.push({ id: subs.length + 1, ...create });
          return Promise.resolve({ id: subs.length });
        }),
        findMany: jest.fn(({ where }) =>
          Promise.resolve(
            subs.filter((s) =>
              where.userId?.in
                ? where.userId.in.includes(s.userId)
                : s.userId === where.userId,
            ),
          ),
        ),
        deleteMany: jest.fn(({ where }) => {
          const i = subs.findIndex(
            (s) =>
              s.endpointHash === where.endpointHash &&
              s.userId === where.userId,
          );
          if (i >= 0) subs.splice(i, 1);
          return Promise.resolve({ count: i >= 0 ? 1 : 0 });
        }),
      },
    };
    const USER = 1_000_000_000_000_501n;
    const send = jest.fn().mockResolvedValue({ statusCode: 201 });
    const push = new PushService(prisma as never, undefined, send);
    const accountService = new AccountService(prisma as never);
    const endpoint = 'https://fcm.googleapis.com/fcm/send/raw-e2e';
    const keys = {
      endpoint,
      p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString(
        'base64url',
      ),
      auth: Buffer.alloc(16, 1).toString('base64url'),
    };
    await push.subscribe(USER, keys);
    send.mockClear();
    expect((await accountService.notifyRoute(USER)).channel).toBe('push');

    const t = deps({ due: [row(1, USER, 'pair_activity')], s: new Map() });
    const d = { ...t.d, accountService, push } as QueueDeps;
    await runProcessQueue(d);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].endpoint).toBe(endpoint);
    expect(JSON.parse(send.mock.calls[0][1])).toMatchObject({
      tag: 'pair_activity',
      url: '/today',
    });
    expect(t.notificationService.markSent).toHaveBeenCalledWith(1);

    await push.unsubscribe(USER, endpoint);
    send.mockClear();
    expect((await accountService.notifyRoute(USER)).channel).toBeNull();
    await runProcessQueue(d);
    expect(send).not.toHaveBeenCalled();
    expect(t.notificationService.cancelOne).toHaveBeenCalledWith(1);
  });
});
