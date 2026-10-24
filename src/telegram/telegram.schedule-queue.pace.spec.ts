// Очередь уведомлений и ответ Telegram 429 (аудит 2026-10). До починки
// очередь слала до 500 строк подряд без паузы, 429 уходил в logger.error
// на каждую строку, а цикл продолжал слать под лимитом. Сервис собирается
// конструктором, как в проде, — пауза и бюджет берутся по умолчанию.
import { Logger } from '@nestjs/common';
import { TelegramScheduleService } from './telegram.schedule.service';
import {
  QUEUE_KILL_SWITCH_MS,
  QUEUE_TICK_BUDGET_MS,
} from './telegram.schedule-queue.budget';
import { LEASE_WINDOW } from '../infra/cron-leader.service';
import { SEND_TIMEOUT_MS } from './telegram.send-bounded';

const limited = (retry_after: number) => ({
  response: {
    error_code: 429,
    description: `Too Many Requests: retry after ${retry_after}`,
    parameters: { retry_after },
  },
});

const row = (id: number) => ({
  id,
  userId: BigInt(id),
  type: 'summary',
  payload: { text: `итог ${id}` },
  sendAt: new Date(),
});

function makeService(due: ReturnType<typeof row>[], callApi: jest.Mock) {
  const notificationService: any = {
    getDue: jest.fn().mockResolvedValue(due),
    markSent: jest.fn().mockResolvedValue(undefined),
    defer: jest.fn(),
    cancelOne: jest.fn(),
  };
  const accountService: any = {
    getSendSettingsFor: jest
      .fn()
      .mockResolvedValue(
        new Map(
          due.map((n) => [
            String(n.userId),
            { tz: 'UTC', start: 0, end: 0, form: 'ty', chatId: n.userId },
          ]),
        ),
      ),
    markUserBlocked: jest.fn(),
  };
  const analytics: any = { track: jest.fn().mockResolvedValue(undefined) };
  const service = new TelegramScheduleService(
    { telegram: { callApi } } as never,
    {} as never,
    {} as never,
    accountService,
    {} as never,
    notificationService,
    {} as never,
    {} as never,
    { claimRun: jest.fn().mockResolvedValue(true) } as never,
    analytics,
  );
  return { service, notificationService, accountService, analytics };
}

let warn: jest.SpyInstance;
let error: jest.SpyInstance;

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation();
  warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-16T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('очередь и лимит Telegram', () => {
  it('429 → ждёт retry_after, повторяет, строка отправлена; error нет', async () => {
    const callApi = jest
      .fn()
      .mockRejectedValueOnce(limited(5))
      .mockResolvedValueOnce(undefined);
    const { service, notificationService, analytics } = makeService(
      [row(1)],
      callApi,
    );
    const tick = service.processQueue();
    await jest.advanceTimersByTimeAsync(4_999);
    expect(callApi).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    await tick;
    expect(callApi).toHaveBeenCalledTimes(2);
    expect(notificationService.markSent.mock.calls).toEqual([[1]]);
    expect(error).not.toHaveBeenCalled();
    // Итог прогона уходит в /stats событием без userId.
    expect(analytics.track).toHaveBeenCalledWith(null, 'notify_queue_tick', {
      sent: 1,
      transient: 0,
      waited: 1,
      deferred: 0,
    });
  });

  it('retry_after больше бюджета — прогон останавливается, хвост не трогается', async () => {
    const callApi = jest.fn().mockRejectedValue(limited(600));
    const { service, notificationService, analytics } = makeService(
      [row(1), row(2), row(3)],
      callApi,
    );
    await service.processQueue();
    expect(callApi).toHaveBeenCalledTimes(1);
    expect(notificationService.markSent).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    const lines = warn.mock.calls.map((c) => String(c[0]));
    expect(lines.filter((l) => l.includes('отложено лимитом'))).toEqual([
      expect.stringContaining('отложено лимитом 3'),
    ]);
    expect(analytics.track).toHaveBeenCalledWith(null, 'notify_queue_tick', {
      sent: 0,
      transient: 0,
      waited: 0,
      deferred: 3,
    });
  });

  it('между отправками пауза 35 мс', async () => {
    const callApi = jest.fn().mockResolvedValue(undefined);
    const { service } = makeService([row(1), row(2)], callApi);
    const tick = service.processQueue();
    await jest.advanceTimersByTimeAsync(34);
    expect(callApi).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    await tick;
    expect(callApi.mock.calls.map((c) => c[1].chat_id)).toEqual([1, 2]);
  });

  it('временные сбои считаются в итоге прогона, человек не метится', async () => {
    const parse = {
      response: { error_code: 400, description: "Bad Request: can't parse" },
    };
    const callApi = jest.fn().mockRejectedValue(parse);
    const { service, accountService, analytics } = makeService(
      [row(1), row(2)],
      callApi,
    );
    const tick = service.processQueue();
    await jest.advanceTimersByTimeAsync(1_000);
    await tick;
    expect(accountService.markUserBlocked).not.toHaveBeenCalled();
    expect(analytics.track).toHaveBeenCalledWith(null, 'notify_queue_tick', {
      sent: 0,
      transient: 2,
      waited: 0,
      deferred: 0,
    });
  });

  it('пустая очередь — события нет: отчёт не засоряется пустыми тиками', async () => {
    const callApi = jest.fn();
    const { service, analytics } = makeService([], callApi);
    await service.processQueue();
    expect(analytics.track.mock.calls).toEqual([]);
    expect(callApi.mock.calls).toEqual([]);
  });

  it('бюджет прогона кончился — оставшиеся строки ждут следующего тика', async () => {
    // Каждая отправка «висит» минуту: после трёх бюджет (3 мин) исчерпан.
    const callApi = jest.fn(
      () => new Promise<void>((r) => setTimeout(r, 60_000)),
    );
    const { service, notificationService, analytics } = makeService(
      [row(1), row(2), row(3), row(4), row(5)],
      callApi,
    );
    const tick = service.processQueue();
    await jest.advanceTimersByTimeAsync(4 * 60_000);
    await tick;
    expect(callApi).toHaveBeenCalledTimes(3);
    expect(notificationService.markSent.mock.calls).toEqual([[1], [2], [3]]);
    expect(analytics.track).toHaveBeenCalledWith(
      null,
      'notify_queue_tick',
      expect.objectContaining({ sent: 3, deferred: 2 }),
    );
  });
});

describe('бюджет прогона и kill-switch', () => {
  it('худший прогон (бюджет + одна отправка) короче kill-switch и окна аренды', () => {
    // Иначе лок снимется посреди прогона, и следующий тик пойдёт параллельно —
    // дубли напоминаний.
    const worst = QUEUE_TICK_BUDGET_MS + SEND_TIMEOUT_MS;
    expect(worst).toBeLessThan(QUEUE_KILL_SWITCH_MS);
    expect(worst).toBeLessThan(LEASE_WINDOW.fiveMinutes);
  });
});
