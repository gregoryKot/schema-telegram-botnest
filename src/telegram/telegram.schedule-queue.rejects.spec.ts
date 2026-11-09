// E16 (аудит 2026-11): постоянный 400 на сообщение повторялся каждый тик
// вечно — строка висела в начале getDue, каждый тик слал админу ошибку.
// Теперь после MAX_REJECTS отказов строка снимается. Счётчик обязан жить
// дольше тика — поэтому сценарий идёт через настоящий processQueue сервиса.
import { Logger } from '@nestjs/common';
import { TelegramScheduleService } from './telegram.schedule.service';
import {
  MAX_REJECTS,
  RejectCounter,
  isPermanentRejection,
} from './telegram.schedule-queue.rejects';

const ROW = {
  id: 77,
  userId: 5n,
  type: 'summary',
  payload: { text: 'итог дня' },
  sendAt: new Date('2026-07-16T09:00:00Z'),
};

const apiError = (code: number, description: string) => ({
  response: { error_code: code, description },
});

/** Сервис с очередью из одной строки; Telegram отвечает тем, что дали. */
function queueWith(callApi: jest.Mock) {
  const notifications = {
    getDue: jest.fn().mockResolvedValue([ROW]),
    claim: jest.fn().mockResolvedValue(true),
    releaseClaim: jest.fn().mockResolvedValue(undefined),
    markSent: jest.fn().mockResolvedValue(undefined),
    cancelOne: jest.fn().mockResolvedValue(undefined),
  };
  const accounts = {
    getSendSettingsFor: jest
      .fn()
      .mockResolvedValue(
        new Map([
          ['5', { tz: 'UTC', start: 0, end: 0, form: 'ty', chatId: 5n }],
        ]),
      ),
    markUserBlocked: jest.fn().mockResolvedValue(undefined),
  };
  const service = new TelegramScheduleService(
    { telegram: { callApi } } as never,
    {} as never,
    {} as never,
    accounts as never,
    {} as never,
    notifications as never,
    {} as never,
    {} as never,
    { claimRun: jest.fn().mockResolvedValue(true) } as never,
  );
  return { service, notifications, accounts };
}

describe('очередь: постоянный отказ Telegram (E16)', () => {
  beforeEach(() => {
    for (const level of ['log', 'warn', 'error'] as const)
      jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it(`400 на сообщение — после ${MAX_REJECTS} тиков строка снята, человек не помечен`, async () => {
    const callApi = jest
      .fn()
      .mockRejectedValue(
        apiError(400, "Bad Request: can't parse entities: unclosed tag"),
      );
    const { service, notifications, accounts } = queueWith(callApi);

    for (let tick = 1; tick < MAX_REJECTS; tick++) {
      await service.processQueue();
      expect(notifications.cancelOne).not.toHaveBeenCalled();
    }
    await service.processQueue();

    expect(notifications.cancelOne).toHaveBeenCalledWith(ROW.id);
    // Снята, а не «отправлена»: каденс считает только реально ушедшие.
    expect(notifications.markSent).not.toHaveBeenCalled();
    expect(accounts.markUserBlocked).not.toHaveBeenCalled();
  });

  it.each([
    [
      'сеть',
      Object.assign(new Error('connect ECONNREFUSED'), {
        code: 'ECONNREFUSED',
      }),
    ],
    [
      'битый токен бота (401) — это про всех, не про сообщение',
      apiError(401, 'Unauthorized'),
    ],
    ['сбой Telegram (502)', apiError(502, 'Bad Gateway')],
  ])('%s — повторяется дальше, строка не снимается', async (_name, err) => {
    const callApi = jest.fn().mockRejectedValue(err);
    const { service, notifications } = queueWith(callApi);
    for (let tick = 0; tick < MAX_REJECTS + 2; tick++)
      await service.processQueue();
    // Каждый тик пробует снова — строка в очереди, как и раньше.
    expect(callApi.mock.calls).toHaveLength(MAX_REJECTS + 2);
    expect(notifications.cancelOne).not.toHaveBeenCalled();
  });
});

describe('RejectCounter', () => {
  it('считает отказы по строке отдельно и сбрасывает счёт после снятия', () => {
    const c = new RejectCounter();
    const verdicts = [1, 2, 1, 1, 2, 2].map((id) => c.strike(id));
    expect(verdicts).toEqual([false, false, false, true, false, true]);
    // Снятая строка начинает счёт заново, если вдруг вернулась (рестарт соседа).
    expect(c.strike(1)).toBe(false);
  });

  it('400 — постоянный отказ; 429, 403 и сеть — нет', () => {
    expect(isPermanentRejection(apiError(400, 'Bad Request'))).toBe(true);
    expect(isPermanentRejection(apiError(429, 'Too Many Requests'))).toBe(
      false,
    );
    expect(isPermanentRejection(apiError(403, 'Forbidden'))).toBe(false);
    expect(isPermanentRejection(new Error('ETIMEDOUT'))).toBe(false);
  });
});
