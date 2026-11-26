// matchTotpStep — единственная точка, где код 2FA сверяется с секретом.
// Неверный формат — тихий промах; бросок otplib на коде верного формата —
// битый секрет: error в лог (уходит владельцу), но только класс ошибки.
import type { Logger } from '@nestjs/common';
import { generateSecret, generateSync } from 'otplib';
import { matchTotpStep, newTotpSecret, totpUri } from './totp-code';

const NOW = new Date('2026-07-16T12:00:00.000Z').getTime();
const STEP = Math.floor(NOW / 1000 / 30);

const quietLogger = () =>
  ({ error: jest.fn(), warn: jest.fn() }) as unknown as Logger & {
    error: jest.Mock;
  };

beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW));
afterEach(() => jest.restoreAllMocks());

describe('matchTotpStep', () => {
  it('верный код текущего шага → абсолютный номер шага (RFC 6238)', () => {
    const secret = generateSecret();
    const log = quietLogger();
    expect(matchTotpStep(secret, generateSync({ secret }), log)).toBe(STEP);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('неверный код верного формата → null без тревоги', () => {
    const secret = generateSecret();
    const code = generateSync({ secret }) === '000000' ? '111111' : '000000';
    const log = quietLogger();
    expect(matchTotpStep(secret, code, log)).toBeNull();
    expect(log.error).not.toHaveBeenCalled();
  });

  // Буквы и резервный код (DTO пускает 6–10 символов) доходят сюда первыми:
  // это обычный промах, а не «битый секрет» в DM владельцу.
  it.each(['abcdef', '12345', '1234567', 'ffffffffff', ''])(
    'код не из шести цифр (%p) → null, error в лог не уходит',
    (code) => {
      const log = quietLogger();
      expect(matchTotpStep(generateSecret(), code, log)).toBeNull();
      expect(log.error).not.toHaveBeenCalled();
    },
  );

  it('битый секрет при коде верного формата → null и error только с классом ошибки', () => {
    const log = quietLogger();
    expect(matchTotpStep('A', '123456', log)).toBeNull();
    expect(log.error).toHaveBeenCalledTimes(1);
    const [summary] = log.error.mock.calls[0] as [string];
    expect(summary).toMatch(/^TOTP secret rejected by otplib \(\w+\)$/);
  });
});

describe('выпуск секрета и otpauth-ссылки', () => {
  it('ссылка несёт секрет, имя аккаунта и издателя', () => {
    const secret = newTotpSecret();
    const url = new URL(totpUri('user@test', secret));
    expect(url.protocol).toBe('otpauth:');
    expect(url.searchParams.get('secret')).toBe(secret);
    expect(url.searchParams.get('issuer')).toBe('Schema Happens');
    expect(decodeURIComponent(url.pathname)).toContain('user@test');
  });

  it('секрет каждый раз новый', () => {
    expect(newTotpSecret()).not.toBe(newTotpSecret());
  });
});
