// Регресс инцидента 2026-08-08: мини-апп в Telegram считал себя открытым в
// MAX и слал ПУСТУЮ подпись. Пустая строка в guard falsy — запрос уходил в
// ветку «Missing authentication», где не было ни лога, ни счётчика, ни
// алерта. Вход был сломан у всех пользователей Telegram пять суток, и сервер
// об этом молчал.
//
// Тест держит и обратное: обычный неавторизованный запрос (заголовков нет)
// не должен ни будить админа, ни писать строки в БД — иначе первый же
// сканер превратит защиту в шум, а шум отключают.
import { Logger } from '@nestjs/common';
import { emptySignatureHost, reportAuthFailure } from './auth-failure.report';
import { SecurityLogService } from '../auth/security-log.service';

describe('emptySignatureHost', () => {
  it('пустой телеграмный заголовок — это Telegram', () => {
    expect(emptySignatureHost({ 'x-telegram-init-data': '' })).toBe('telegram');
  });

  it('пустой максовский заголовок — это MAX', () => {
    expect(emptySignatureHost({ 'x-max-init-data': '   ' })).toBe('max');
  });

  it('непустая подпись — не наш случай (её разбирает обычный путь)', () => {
    expect(emptySignatureHost({ 'x-max-init-data': 'hash=abc' })).toBeNull();
  });

  it('заголовков нет вовсе — обычный неавторизованный запрос', () => {
    expect(emptySignatureHost({})).toBeNull();
    expect(emptySignatureHost({ authorization: 'Bearer x' })).toBeNull();
  });
});

describe('reportAuthFailure', () => {
  const build = () => {
    const securityLog = { log: jest.fn() } as unknown as SecurityLogService;
    const logger = { warn: jest.fn() } as unknown as Logger;
    const track = jest.fn();
    return { securityLog, logger, track };
  };

  it('пустая подпись — алерт админу и событие в аналитике', () => {
    const { securityLog, logger, track } = build();
    const reported = reportAuthFailure(
      { 'x-telegram-init-data': '' },
      '1.2.3.4',
      {
        securityLog,
        logger,
        track,
        now: 1_000_000,
      },
    );

    expect(reported).toBe(true);
    expect(track).toHaveBeenCalledWith({
      reason: 'empty_signature',
      host: 'telegram',
    });
    expect(securityLog.log).toHaveBeenCalledWith(
      'empty_signature',
      expect.objectContaining({ host: 'telegram' }),
    );
  });

  it('обычный неавторизованный запрос — ни алерта, ни записи', () => {
    const { securityLog, logger, track } = build();
    const reported = reportAuthFailure({}, '1.2.3.4', {
      securityLog,
      logger,
      track,
      now: 2_000_000,
    });

    expect(reported).toBe(false);
    expect(track).not.toHaveBeenCalled();
    expect(securityLog.log).not.toHaveBeenCalled();
  });

  // Авария — это поток: экран шлёт полтора десятка запросов, пользователей
  // много. Без троттлинга админский чат мьютят, и алерт перестаёт работать
  // ровно тогда, когда он нужен (инцидент 2026-07-29, тот же урок).
  it('шквал одинаковых отказов не превращается в шквал DM', () => {
    const { securityLog, logger, track } = build();
    const headers = { 'x-max-init-data': '' };
    for (let i = 0; i < 50; i += 1) {
      reportAuthFailure(headers, `10.0.0.${i % 3}`, {
        securityLog,
        logger,
        track,
        now: 3_000_000 + i * 1000,
      });
    }

    expect((securityLog.log as jest.Mock).mock.calls).toHaveLength(1);
    // Событий тоже не 50: пишем не чаще раза в 5 минут на IP, а IP тут три.
    expect(track.mock.calls.length).toBeLessThanOrEqual(3);
    expect(track).toHaveBeenCalled();
  });

  it('через 15 минут авария снова слышна, а не глохнет навсегда', () => {
    const { securityLog, logger, track } = build();
    const headers = { 'x-telegram-init-data': '' };
    const sinks = { securityLog, logger, track };
    reportAuthFailure(headers, '1.1.1.1', { ...sinks, now: 10_000_000 });
    reportAuthFailure(headers, '1.1.1.1', {
      ...sinks,
      now: 10_000_000 + 60_000,
    });
    reportAuthFailure(headers, '1.1.1.1', {
      ...sinks,
      now: 10_000_000 + 16 * 60_000,
    });

    const calls = (securityLog.log as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    // Во втором алерте видно, сколько случаев проглотил троттл.
    expect(calls[1][1]).toEqual(
      expect.objectContaining({ suppressedSinceLastAlert: 1 }),
    );
  });
});
