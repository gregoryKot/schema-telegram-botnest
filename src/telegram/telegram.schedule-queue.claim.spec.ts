// Наложение прогонов очереди после kill-таймера (аудит 2026-10, backend#15).
//
// Kill-таймер через 4 минуты снимает isProcessing, но прогон не прерывает, а
// аренда `notificationQueue` к следующему тику уже истекла: зависший прогон
// дорабатывает свои строки, а тик T+5 читает те же неотправленные строки.
// Без захвата строки (notification-claim.ts) человек получал напоминание
// дважды. Сервис собирается конструктором, как в проде; захват — фейк с той же
// семантикой, что UPDATE с условием (на живой базе он доказан
// test/notification-claim.e2e-spec.ts).
import { Logger } from '@nestjs/common';
import { TelegramScheduleService } from './telegram.schedule.service';
import { QUEUE_KILL_SWITCH_MS } from './telegram.schedule-queue.budget';
import { CLAIM_WINDOW_MS } from '../notification/notification-claim';

const row = (id: number) => ({
  id,
  userId: BigInt(id),
  type: 'summary',
  payload: { text: `итог ${id}` },
  sendAt: new Date(),
});

/** Очередь в памяти: getDue видит неотправленные, claim — условный UPDATE. */
function memoryQueue(rows: ReturnType<typeof row>[]) {
  const sent = new Set<number>();
  const attemptedAt = new Map<number, number>();
  let hangMarkSent: number | null = null;
  let resumeHung: () => void = () => undefined;
  const service = {
    getDue: jest.fn(async () => rows.filter((r) => !sent.has(r.id))),
    claim: jest.fn(async (id: number) => {
      const at = attemptedAt.get(id);
      if (sent.has(id)) return false;
      if (at !== undefined && Date.now() - at < CLAIM_WINDOW_MS) return false;
      attemptedAt.set(id, Date.now());
      return true;
    }),
    releaseClaim: jest.fn(async (id: number) => {
      if (!sent.has(id)) attemptedAt.delete(id);
    }),
    markSent: jest.fn(async (id: number) => {
      if (id === hangMarkSent) {
        hangMarkSent = null;
        // База «зависла» на отметке: прогон стоит дольше kill-таймера.
        await new Promise<void>((resolve) => (resumeHung = resolve));
      }
      sent.add(id);
    }),
    defer: jest.fn(),
    cancelOne: jest.fn(),
  };
  return {
    service,
    hangOn: (id: number) => (hangMarkSent = id),
    resume: () => resumeHung(),
  };
}

function makeService(rows: ReturnType<typeof row>[], callApi: jest.Mock) {
  const queue = memoryQueue(rows);
  const accountService: any = {
    getSendSettingsFor: jest.fn(async (ids: bigint[]) => {
      const one = (id: bigint) => ({
        tz: 'UTC',
        start: 0,
        end: 0,
        form: 'ty',
        chatId: id,
      });
      return new Map(ids.map((id) => [String(id), one(id)]));
    }),
    markUserBlocked: jest.fn(),
  };
  const service = new TelegramScheduleService(
    { telegram: { callApi } } as never,
    {} as never,
    {} as never,
    accountService,
    {} as never,
    queue.service as never,
    {} as never,
    {} as never,
    // Аренда к следующему тику истекла — её забирает каждый тик.
    { claimRun: jest.fn().mockResolvedValue(true) } as never,
    { track: jest.fn().mockResolvedValue(undefined) } as never,
  );
  return { service, queue };
}

const sentIds = (callApi: jest.Mock) =>
  callApi.mock.calls.map((c) => Number(c[1].chat_id));

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation();
  jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  jest.spyOn(Logger.prototype, 'error').mockImplementation();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-08T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('захват строки очереди: прогоны после kill-таймера', () => {
  it('окно захвата переживает kill-таймер и следующий тик (5 мин)', () => {
    expect(CLAIM_WINDOW_MS).toBeGreaterThan(QUEUE_KILL_SWITCH_MS + 5 * 60_000);
  });

  it('зависший прогон и следующий тик — по каждой строке одна отправка', async () => {
    const callApi = jest.fn().mockResolvedValue(undefined);
    const { service, queue } = makeService([row(1), row(2)], callApi);
    queue.hangOn(1);

    const first = service.processQueue();
    await jest.advanceTimersByTimeAsync(QUEUE_KILL_SWITCH_MS);
    // Kill-таймер снял isProcessing; первый прогон висит на отметке строки 1.
    expect(sentIds(callApi)).toEqual([1]);

    await jest.advanceTimersByTimeAsync(5 * 60_000 - QUEUE_KILL_SWITCH_MS);
    await service.processQueue(); // тик T+5: строка 1 всё ещё «не отправлена»
    expect(sentIds(callApi)).toEqual([1, 2]);

    queue.resume();
    await jest.advanceTimersByTimeAsync(1_000);
    await first; // первый прогон дошёл до строки 2 — её уже отправил второй
    expect(sentIds(callApi)).toEqual([1, 2]);
  });

  it('захват старше окна — строку берут снова (процесс упал до отметки)', async () => {
    const callApi = jest.fn().mockResolvedValue(undefined);
    const { service, queue } = makeService([row(7)], callApi);
    await queue.service.claim(7); // «упавший» процесс взял и не отметил

    await service.processQueue();
    expect(callApi).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(CLAIM_WINDOW_MS);
    await service.processQueue();
    expect(sentIds(callApi)).toEqual([7]);
  });

  it('временный сбой отпускает захват — повтор на следующем тике, без окна', async () => {
    const parse = {
      response: { error_code: 400, description: "Bad Request: can't parse" },
    };
    const callApi = jest
      .fn()
      .mockRejectedValueOnce(parse)
      .mockResolvedValueOnce(undefined);
    const { service, queue } = makeService([row(3)], callApi);

    await service.processQueue();
    expect(queue.service.releaseClaim).toHaveBeenCalledWith(3);
    await jest.advanceTimersByTimeAsync(5 * 60_000);
    await service.processQueue();
    expect(sentIds(callApi)).toEqual([3, 3]);
    expect(queue.service.markSent).toHaveBeenCalledWith(3);
  });

  it('лимит Telegram больше бюджета — строку отпускают, хвост не захвачен', async () => {
    const limited = {
      response: {
        error_code: 429,
        description: 'Too Many Requests: retry after 600',
        parameters: { retry_after: 600 },
      },
    };
    const callApi = jest.fn().mockRejectedValue(limited);
    const { service, queue } = makeService([row(4), row(5)], callApi);

    await service.processQueue();
    expect(queue.service.claim.mock.calls).toEqual([[4]]);
    expect(queue.service.releaseClaim).toHaveBeenCalledWith(4);
  });

  it('ответа не дождались — строка отмечена отправленной, захват не отпускается', async () => {
    const reset = Object.assign(new Error('socket hang up'), {
      code: 'ECONNRESET',
    });
    const callApi = jest.fn().mockRejectedValue(reset);
    const { service, queue } = makeService([row(6)], callApi);

    await service.processQueue();
    expect(queue.service.markSent).toHaveBeenCalledWith(6);
    expect(queue.service.releaseClaim).not.toHaveBeenCalled();
  });
});
