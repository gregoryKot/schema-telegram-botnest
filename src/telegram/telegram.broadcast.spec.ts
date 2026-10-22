// /broadcast и ответ Telegram 429 (аудит 2026-10): раньше 429 засчитывался
// в ошибки, и рассылка сразу слала следующему — под лимитом, продлевая его.
import { Logger } from '@nestjs/common';
import {
  BROADCAST_PAUSE_MS,
  describeBroadcastResult,
  runBroadcast,
} from './telegram.broadcast';

const limited = (retry_after: number) => ({
  response: { error_code: 429, parameters: { retry_after } },
});

function setup(callApi: jest.Mock) {
  const waits: number[] = [];
  const accountService = {
    markUserBlocked: jest.fn().mockResolvedValue(undefined),
  };
  const deps = {
    bot: { telegram: { callApi } } as never,
    accountService,
    logger: new Logger('test'),
    pace: { sleep: (ms: number) => (waits.push(ms), Promise.resolve()) },
  };
  const ids = [1n, 2n, 3n];
  const chats = new Map(ids.map((id) => [String(id), id]));
  return { deps, ids, chats, waits, accountService };
}

describe('runBroadcast', () => {
  it('429 и затем ok — доставлено после ожидания, не ошибка', async () => {
    const callApi = jest
      .fn()
      .mockRejectedValueOnce(limited(3))
      .mockResolvedValue(undefined);
    const { deps, ids, chats, waits, accountService } = setup(callApi);
    const r = await runBroadcast(deps, ids, chats, 'привет');
    expect(r).toEqual({ sent: 3, failed: 0, skipped: 0, limited: 0 });
    expect(waits).toEqual([3000, BROADCAST_PAUSE_MS, BROADCAST_PAUSE_MS]);
    expect(accountService.markUserBlocked).not.toHaveBeenCalled();
  });

  it('срок дольше бюджета рассылки — остановка, остальным не шлём', async () => {
    const callApi = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(limited(3600));
    const { deps, ids, chats, accountService } = setup(callApi);
    const r = await runBroadcast(deps, ids, chats, 'привет');
    expect(r).toEqual({ sent: 1, failed: 0, skipped: 0, limited: 2 });
    expect(callApi).toHaveBeenCalledTimes(2);
    expect(accountService.markUserBlocked).not.toHaveBeenCalled();
    expect(describeBroadcastResult(r)).toBe(
      '✅ Готово: 1 доставлено, 0 ошибок, 2 не отправлено: Telegram ' +
        'попросил подождать дольше, чем рассчитана рассылка',
    );
  });

  it('контроль: 403 по-прежнему метит человека, рассылка идёт дальше', async () => {
    const callApi = jest
      .fn()
      .mockRejectedValueOnce({ response: { error_code: 403 } })
      .mockResolvedValue(undefined);
    const { deps, ids, chats, accountService } = setup(callApi);
    const r = await runBroadcast(deps, ids, chats, 'привет');
    expect(r).toEqual({ sent: 2, failed: 1, skipped: 0, limited: 0 });
    expect(accountService.markUserBlocked).toHaveBeenCalledWith(1n);
  });

  it('без чата в Telegram — пропуск, в «не отправлено» лимитом не считается', async () => {
    const callApi = jest.fn().mockRejectedValue(limited(3600));
    const { deps, waits } = setup(callApi);
    const ids = [1n, 2n, 3n];
    const chats = new Map([['1', 1n]]);
    const r = await runBroadcast(deps, ids, chats, 'привет');
    expect(r).toEqual({ sent: 0, failed: 0, skipped: 0, limited: 1 });
    expect(waits).toEqual([]);
  });
});

describe('describeBroadcastResult', () => {
  it('без пропусков и лимита — только доставлено и ошибки', () => {
    expect(
      describeBroadcastResult({ sent: 5, failed: 1, skipped: 0, limited: 0 }),
    ).toBe('✅ Готово: 5 доставлено, 1 ошибок');
  });

  it('пропуски без чата — отдельной частью', () => {
    expect(
      describeBroadcastResult({ sent: 2, failed: 0, skipped: 3, limited: 0 }),
    ).toBe('✅ Готово: 2 доставлено, 0 ошибок, 3 без чата в Telegram');
  });
});
