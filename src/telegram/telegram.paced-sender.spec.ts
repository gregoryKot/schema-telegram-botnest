// Темп отправки (аудит 2026-10: очередь слала подряд без паузы и не слушала
// 429). Часы и ожидание подменены: проверяется решение «ждать/повторить/
// остановиться», а не скорость машины.
import { PacedSender, SEND_PAUSE_MS } from './telegram.paced-sender';

const limited = (retry_after?: number) => ({
  response: {
    error_code: 429,
    description: 'Too Many Requests',
    ...(retry_after === undefined ? {} : { parameters: { retry_after } }),
  },
});

function makeClock() {
  let t = 0;
  const waits: number[] = [];
  return {
    waits,
    now: () => t,
    sleep: (ms: number) => {
      waits.push(ms);
      t += ms;
      return Promise.resolve();
    },
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('PacedSender', () => {
  it('пауза 35 мс перед каждой отправкой, кроме первой', async () => {
    const c = makeClock();
    const p = new PacedSender({ sleep: c.sleep, now: c.now });
    const attempt = jest.fn().mockResolvedValue(undefined);
    for (let i = 0; i < 3; i++) expect(await p.send(attempt)).toBe('sent');
    expect(SEND_PAUSE_MS).toBe(35);
    expect(c.waits).toEqual([35, 35]);
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it('pauseMs: 0 — без ожидания вовсе', async () => {
    const c = makeClock();
    const p = new PacedSender({ pauseMs: 0, sleep: c.sleep, now: c.now });
    const attempt = jest.fn().mockResolvedValue(undefined);
    await p.send(attempt);
    await p.send(attempt);
    expect(c.waits).toEqual([]);
  });

  it('429 с retry_after: ждёт ровно срок и повторяет один раз', async () => {
    const c = makeClock();
    const p = new PacedSender({ sleep: c.sleep, now: c.now, budgetMs: 60_000 });
    const attempt = jest
      .fn()
      .mockRejectedValueOnce(limited(5))
      .mockResolvedValueOnce(undefined);
    expect(await p.send(attempt)).toBe('sent');
    expect(c.waits).toEqual([5000]);
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(p.waited).toBe(1);
  });

  it('повтор снова 429 — остановка, третьей попытки нет', async () => {
    const c = makeClock();
    const p = new PacedSender({ sleep: c.sleep, now: c.now, budgetMs: 60_000 });
    const attempt = jest.fn().mockRejectedValue(limited(1));
    expect(await p.send(attempt)).toBe('rate_limited');
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('срок не помещается в бюджет — не ждёт, сразу останавливается', async () => {
    const c = makeClock();
    const p = new PacedSender({ sleep: c.sleep, now: c.now, budgetMs: 10_000 });
    const attempt = jest.fn().mockRejectedValue(limited(30));
    expect(await p.send(attempt)).toBe('rate_limited');
    expect(c.waits).toEqual([]);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(p.waited).toBe(0);
  });

  it('429 без срока — остановка без ожидания наугад', async () => {
    const c = makeClock();
    const p = new PacedSender({ sleep: c.sleep, now: c.now });
    const attempt = jest.fn().mockRejectedValue(limited());
    expect(await p.send(attempt)).toBe('rate_limited');
    expect(c.waits).toEqual([]);
  });

  it('бюджет исчерпан до отправки — запрос не уходит', async () => {
    const c = makeClock();
    const p = new PacedSender({ sleep: c.sleep, now: c.now, budgetMs: 1_000 });
    const attempt = jest.fn().mockResolvedValue(undefined);
    expect(await p.send(attempt)).toBe('sent');
    c.advance(1_000);
    expect(await p.send(attempt)).toBe('out_of_time');
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('ошибка не 429 пробрасывается как есть и не повторяется', async () => {
    const c = makeClock();
    const p = new PacedSender({ sleep: c.sleep, now: c.now });
    const forbidden = { response: { error_code: 403 } };
    const attempt = jest.fn().mockRejectedValue(forbidden);
    await expect(p.send(attempt)).rejects.toBe(forbidden);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('после ожидания повтор упал не 429 — ошибка уходит вызывающему', async () => {
    const c = makeClock();
    const p = new PacedSender({ sleep: c.sleep, now: c.now, budgetMs: 60_000 });
    const boom = new Error('boom');
    const attempt = jest
      .fn()
      .mockRejectedValueOnce(limited(1))
      .mockRejectedValueOnce(boom);
    await expect(p.send(attempt)).rejects.toBe(boom);
  });

  it('без подмены ждёт настоящим setTimeout (фейковые таймеры его двигают)', async () => {
    jest.useFakeTimers();
    try {
      const p = new PacedSender();
      const attempt = jest.fn().mockResolvedValue(undefined);
      await p.send(attempt);
      const second = p.send(attempt);
      await jest.advanceTimersByTimeAsync(34);
      expect(attempt).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(await second).toBe('sent');
      expect(attempt).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
