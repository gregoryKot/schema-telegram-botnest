// Сводка отчётов фронтенда владельцу (аудит 2026-11, S13): одним DM и не чаще
// раза в час — вместо DM на каждый отчёт через AlertLogger.
import { Logger } from '@nestjs/common';
import {
  ClientErrorDigest,
  DIGEST_PERIOD_MS,
  formatClientErrorDigest,
} from './client-errors-digest';
import type { ClientErrorSection } from './client-error-section';

describe('formatClientErrorDigest', () => {
  it('всего отчётов и три самых частых раздела по убыванию, подписи как в /stats', () => {
    const text = formatClientErrorDigest(
      37,
      new Map<ClientErrorSection, number>([
        ['today', 7],
        ['auth', 20],
        ['diary', 9],
        ['other', 1],
      ]),
    );
    expect(text).toContain('37 за час');
    expect(text).toContain(
      'Чаще всего: Вход в мессенджере — 20, Дневник — 9, Сегодня — 7.',
    );
    expect(text).not.toContain('другое');
  });

  it('отказ отмены подписки подписан словом, как в /stats', () => {
    const text = formatClientErrorDigest(
      2,
      new Map<ClientErrorSection, number>([['subscription', 2]]),
    );
    expect(text).toContain('Чаще всего: Подписка — 2.');
  });
});

describe('ClientErrorDigest', () => {
  let send: jest.Mock;
  let digest: ClientErrorDigest;

  beforeEach(() => {
    jest.useFakeTimers();
    send = jest.fn().mockResolvedValue(undefined);
    digest = new ClientErrorDigest(send);
  });

  afterEach(() => jest.useRealTimers());

  it('100 отчётов за час → ровно одна сводка в конце часа', () => {
    for (let i = 0; i < 100; i++) digest.note(i % 2 ? 'auth' : 'diary');
    expect(send.mock.calls).toEqual([]);
    jest.advanceTimersByTime(DIGEST_PERIOD_MS - 1);
    expect(send.mock.calls).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(send.mock.calls).toEqual([
      [expect.stringContaining('100 за час'), expect.stringContaining('Сбои')],
    ]);
  });

  it('не чаще раза в час: следующий отчёт открывает новое окно на час', () => {
    digest.note('auth');
    jest.advanceTimersByTime(DIGEST_PERIOD_MS);
    expect(send.mock.calls.map((c) => c[0])).toEqual([
      expect.stringContaining('1 за час'),
    ]);
    digest.note('booking');
    jest.advanceTimersByTime(DIGEST_PERIOD_MS / 2);
    digest.note('booking');
    expect(send.mock.calls).toHaveLength(1);
    jest.advanceTimersByTime(DIGEST_PERIOD_MS / 2);
    expect(send.mock.calls).toHaveLength(2);
    expect(send.mock.calls[1][0]).toContain('2 за час');
    expect(send.mock.calls[1][0]).toContain('Запись на консультацию — 2');
  });

  it('пустой час — без сообщения; окно открывает только отчёт', () => {
    jest.advanceTimersByTime(DIGEST_PERIOD_MS * 3);
    expect(send.mock.calls).toEqual([]);
    digest.note('help');
    jest.advanceTimersByTime(DIGEST_PERIOD_MS);
    expect(send.mock.calls).toEqual([
      [expect.stringContaining('Помощь — 1'), expect.any(String)],
    ]);
  });

  it('сбой доставки не роняет процесс, а пишется warn', async () => {
    send.mockRejectedValue(new Error('telegram down'));
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    digest.note('auth');
    jest.advanceTimersByTime(DIGEST_PERIOD_MS);
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('telegram down'));
    warn.mockRestore();
  });
});
