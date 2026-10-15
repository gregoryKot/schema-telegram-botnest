// Регрессия инцидента 2026-07-29: свернутый на час мини-апп шлёт ту же (уже
// просроченную) initData в каждом запросе, и каждый 401 уходил админу отдельным
// DM «suspicious_initdata» — десяток сообщений на один вход, среди которых
// настоящая подделка подписи была бы незаметна.
import { Logger, UnauthorizedException } from '@nestjs/common';
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
  it('«init data expired» от верификатора (Telegram, MAX) → expired', () => {
    expect(classifyInitDataFailure(new Error('init data expired'))).toBe(
      'expired',
    );
  });

  it('текст «Init data expired…» с деталями → expired (регистр и хвост не важны)', () => {
    const err = new Error(
      'Init data expired. Issued at 2026-07-29T02:11:04.000Z, expires at ' +
        '2026-07-29T03:11:04.000Z, now is 2026-07-29T03:15:29.684Z',
    );
    expect(classifyInitDataFailure(err)).toBe('expired');
  });

  it('битая подпись → suspicious', () => {
    expect(
      classifyInitDataFailure(new Error('Invalid Telegram WebApp signature')),
    ).toBe('suspicious');
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
    const err = new Error('init data expired');
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
    expect(() => call(new Error('Invalid Telegram WebApp signature'))).toThrow(
      'Invalid initData',
    );
    expect(securityLog.log).toHaveBeenCalledWith(
      'suspicious_initdata',
      expect.objectContaining({ ip: '1.2.3.4' }),
    );
  });

  it('пачка подделок с одного IP → один алерт, а не сотня', () => {
    for (let i = 0; i < 20; i++) {
      expect(() =>
        call(new Error('Invalid Telegram WebApp signature'), '5.5.5.5'),
      ).toThrow();
    }
    expect(securityLog.log).toHaveBeenCalledTimes(1);
  });

  // E-5 (аудит 2026-10): ссылка-ловушка `…/app/#WebAppData=x` раньше слала
  // подделку на каждый клик. Клиент теперь отсеивает голый ключ, а сервер
  // держит окно 10 минут на IP — шквал с одного адреса не будит владельца.
  describe('окно дедупликации по IP (10 минут)', () => {
    afterEach(() => jest.useRealTimers());

    it('разные IP — каждый получает свой алерт', () => {
      for (const ip of ['7.0.0.1', '7.0.0.2', '7.0.0.3']) {
        expect(() =>
          call(new Error('Invalid Telegram WebApp signature'), ip),
        ).toThrow();
      }
      expect(securityLog.log).toHaveBeenCalledTimes(3);
    });

    it('тот же IP после окна — снова алерт, и в нём число проглоченных', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-04T10:00:00Z'));
      for (let i = 0; i < 5; i++) {
        expect(() =>
          call(new Error('Invalid Telegram WebApp signature'), '8.8.8.8'),
        ).toThrow();
      }
      expect(securityLog.log).toHaveBeenCalledTimes(1);

      // Внутри окна — тишина.
      jest.setSystemTime(new Date('2026-10-04T10:09:59Z'));
      expect(() =>
        call(new Error('Invalid Telegram WebApp signature'), '8.8.8.8'),
      ).toThrow();
      expect(securityLog.log).toHaveBeenCalledTimes(1);

      // Окно закрылось — алерт с suppressed (4 + 1 из окна).
      jest.setSystemTime(new Date('2026-10-04T10:10:01Z'));
      expect(() =>
        call(new Error('Invalid Telegram WebApp signature'), '8.8.8.8'),
      ).toThrow();
      expect(securityLog.log).toHaveBeenCalledTimes(2);
      expect(securityLog.log).toHaveBeenLastCalledWith(
        'suspicious_initdata',
        expect.objectContaining({ ip: '8.8.8.8', suppressed: 5 }),
      );
    });
  });
});
