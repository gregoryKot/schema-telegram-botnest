// Одиночная отправка с учётом 429 (telegram.send-once.ts). Ошибка — настоящий
// TelegramError из telegraf по записанному ответу (правило №23): срок берётся
// тем же разбором, что у очереди (telegram-rate-limit.ts).
import { TelegramError } from 'telegraf';
import { loadRecordedFixture } from '../test-support/recorded-fixture';
import { sendOnce } from './telegram.send-once';

const error429 = () =>
  new TelegramError(
    JSON.parse(loadRecordedFixture('telegram-429-too-many-requests.json')),
  );

/** Часы и сон под контролем теста: сон двигает часы, ничего не ждёт. */
function clock() {
  let t = 0;
  const slept: number[] = [];
  return {
    slept,
    sleep: async (ms: number) => {
      slept.push(ms);
      t += ms;
    },
    now: () => t,
  };
}

describe('sendOnce', () => {
  it('ответ ok — одна попытка, без ожидания', async () => {
    const c = clock();
    const attempt = jest.fn().mockResolvedValue({ message_id: 1 });
    await sendOnce(attempt, c);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(c.slept).toEqual([]);
  });

  it('429 со сроком в бюджете — ждёт retry_after и повторяет один раз', async () => {
    const c = clock();
    const attempt = jest
      .fn()
      .mockRejectedValueOnce(error429())
      .mockResolvedValueOnce({ message_id: 1 });
    await sendOnce(attempt, c);
    expect(c.slept).toEqual([5000]); // retry_after: 5 из записанного ответа
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('срок дольше бюджета — не ждёт, бросает сам ответ 429 (его разберёт фолбэк)', async () => {
    const c = clock();
    const err = error429();
    const attempt = jest.fn().mockRejectedValue(err);
    await expect(sendOnce(attempt, { ...c, budgetMs: 3000 })).rejects.toBe(err);
    expect(c.slept).toEqual([]);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('повтор снова 429 — третьей попытки нет', async () => {
    const c = clock();
    const attempt = jest.fn().mockRejectedValue(error429());
    await expect(sendOnce(attempt, c)).rejects.toBeInstanceOf(TelegramError);
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('контроль: ошибка не 429 не повторяется — повтор мог бы дать дубль', async () => {
    const c = clock();
    const err = new TelegramError({
      error_code: 400,
      description: 'Bad Request: chat not found',
    });
    const attempt = jest.fn().mockRejectedValue(err);
    await expect(sendOnce(attempt, c)).rejects.toBe(err);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(c.slept).toEqual([]);
  });
});
