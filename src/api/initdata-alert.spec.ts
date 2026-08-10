// Регрессия инцидента 2026-07-29: свернутый на час мини-апп шлёт ту же (уже
// просроченную) initData в каждом запросе, и каждый 401 уходил админу отдельным
// DM «suspicious_initdata» — десяток сообщений на один вход, среди которых
// настоящая подделка подписи была бы незаметна.
import { Logger, UnauthorizedException } from '@nestjs/common';
import { ExpiredError, SignatureInvalidError } from '@tma.js/init-data-node';
import {
  classifyInitDataFailure,
  INITDATA_EXPIRED_CODE,
  rejectInitData,
} from './initdata-alert';
import { SecurityLogService } from '../auth/security-log.service';

// Тесты самого AlertThrottle (примитива) переехали в
// src/utils/alert-throttle.spec.ts вместе с извлечением класса — здесь
// остаётся только его применение к initData-гварду.

describe('classifyInitDataFailure', () => {
  it('ExpiredError библиотеки → expired', () => {
    const err = new ExpiredError(new Date(0), new Date(1), new Date(2));
    expect(classifyInitDataFailure(err)).toBe('expired');
  });

  it('текст «Init data expired…» → expired даже без instanceof (дубль пакета)', () => {
    const err = new Error(
      'Init data expired. Issued at 2026-07-29T02:11:04.000Z, expires at ' +
        '2026-07-29T03:11:04.000Z, now is 2026-07-29T03:15:29.684Z',
    );
    expect(classifyInitDataFailure(err)).toBe('expired');
  });

  it('битая подпись → suspicious', () => {
    expect(classifyInitDataFailure(new SignatureInvalidError())).toBe(
      'suspicious',
    );
  });

  it('неизвестная ошибка → suspicious (по умолчанию считаем подозрительным)', () => {
    expect(classifyInitDataFailure('what')).toBe('suspicious');
  });
});

describe('rejectInitData', () => {
  const logger = { warn: jest.fn() } as unknown as Logger;
  let securityLog: { log: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    securityLog = { log: jest.fn() };
  });

  const call = (err: unknown, ip = '1.2.3.4') =>
    rejectInitData(
      err,
      ip,
      logger,
      securityLog as unknown as SecurityLogService,
    );

  it('истёкшая initData → 401 с кодом и БЕЗ алерта админу', () => {
    const err = new ExpiredError(new Date(0), new Date(1), new Date(2));
    expect(() => call(err)).toThrow(UnauthorizedException);
    try {
      call(err);
    } catch (e) {
      expect((e as UnauthorizedException).getResponse()).toEqual({
        code: INITDATA_EXPIRED_CODE,
        message: 'Telegram init data expired',
      });
    }
    expect(securityLog.log).not.toHaveBeenCalled();
  });

  it('подделка подписи → 401 + алерт админу', () => {
    expect(() => call(new SignatureInvalidError())).toThrow('Invalid initData');
    expect(securityLog.log).toHaveBeenCalledWith(
      'suspicious_initdata',
      expect.objectContaining({ ip: '1.2.3.4' }),
    );
  });

  it('пачка подделок с одного IP → один алерт, а не сотня', () => {
    for (let i = 0; i < 20; i++) {
      expect(() => call(new SignatureInvalidError(), '5.5.5.5')).toThrow();
    }
    expect(securityLog.log).toHaveBeenCalledTimes(1);
  });
});
