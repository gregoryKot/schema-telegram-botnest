// A2/A4 (аудит 2026-10): проверки подтверждения объединения аккаунтов.
import {
  ForbiddenException,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import {
  SOURCE_TOTP_REQUIRED,
  assertMergeCaller,
  assertSourceTotp,
  mergeOrThrow,
} from './merge-confirm';

describe('assertMergeCaller', () => {
  it('аноним (null) → 401', () => {
    expect(() => assertMergeCaller(null, 1n)).toThrow(UnauthorizedException);
  });
  it('другой пользователь → 401', () => {
    expect(() => assertMergeCaller(2n, 1n)).toThrow(UnauthorizedException);
  });
  it('сам target → проходит (сравнение bigint по значению)', () => {
    expect(() => assertMergeCaller(1n, 1n)).not.toThrow();
  });
});

describe('assertSourceTotp', () => {
  const totp = (enabled: boolean, ok: boolean) => ({
    isEnabled: jest.fn().mockResolvedValue(enabled),
    verifyCode: jest.fn().mockResolvedValue(ok),
  });

  it('у source нет TOTP → код не нужен и не проверяется', async () => {
    const t = totp(false, false);
    await expect(assertSourceTotp(t, 2n, undefined)).resolves.toBeUndefined();
    expect(t.verifyCode).not.toHaveBeenCalled();
  });

  it('TOTP есть, кода нет → 403 с reason, verifyCode не зовётся', async () => {
    const t = totp(true, true);
    const err = await assertSourceTotp(t, 2n, undefined).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({
      reason: SOURCE_TOTP_REQUIRED,
    });
    expect(t.verifyCode).not.toHaveBeenCalled();
  });

  it('пустая строка вместо кода считается «кода нет»', async () => {
    const t = totp(true, true);
    await expect(assertSourceTotp(t, 2n, '')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('TOTP есть, код неверный → 403', async () => {
    const t = totp(true, false);
    await expect(assertSourceTotp(t, 2n, '111111')).rejects.toThrow(
      ForbiddenException,
    );
    expect(t.verifyCode).toHaveBeenCalledWith(2n, '111111');
  });

  it('TOTP есть, код верный → проходит', async () => {
    const t = totp(true, true);
    await expect(assertSourceTotp(t, 2n, '123456')).resolves.toBeUndefined();
  });
});

describe('mergeOrThrow', () => {
  it('сбой merge → дружелюбный 400, внутренности не утекают, ошибка в лог', async () => {
    const logger = { error: jest.fn() } as unknown as Logger;
    const merge = { merge: jest.fn().mockRejectedValue(new Error('P2002 x')) };
    const err = await mergeOrThrow(merge, logger, 2n, 1n).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as Error).message).not.toContain('P2002');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('merge 2 → 1 failed: P2002 x'),
      expect.anything(),
    );
  });
});
