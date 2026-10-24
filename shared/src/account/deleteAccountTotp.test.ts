import { describe, it, expect, vi } from 'vitest';
import {
  TOTP_REQUIRED_REASON,
  attemptDeleteAccount,
  buildDeleteTotpText,
  isTotpRequiredError,
} from './deleteAccountTotp';

// Форма ошибок обоих клиентов: webapp ApiError{status,reason}, miniapp HttpStatusError{status,reason}.
const err = (status: number, reason?: string) =>
  Object.assign(new Error('x'), { status, reason });

describe('isTotpRequiredError', () => {
  it('403 + totp_required → да', () => {
    expect(isTotpRequiredError(err(403, TOTP_REQUIRED_REASON))).toBe(true);
  });
  it.each([
    ['403 без reason', err(403)],
    ['403 с чужим reason', err(403, 'source_totp_required')],
    ['401 с тем же reason', err(401, TOTP_REQUIRED_REASON)],
    ['обычная Error', new Error('network down')],
    ['null', null],
    ['строка', 'totp_required'],
  ])('%s → нет', (_n, e) => {
    expect(isTotpRequiredError(e)).toBe(false);
  });
});

describe('attemptDeleteAccount', () => {
  it('успех → deleted; без кода зовёт с undefined', async () => {
    const del = vi.fn().mockResolvedValue(undefined);
    await expect(attemptDeleteAccount(del)).resolves.toBe('deleted');
    expect(del).toHaveBeenCalledWith(undefined);
  });
  it('403 totp_required без кода → need_code', async () => {
    const del = vi.fn().mockRejectedValue(err(403, TOTP_REQUIRED_REASON));
    await expect(attemptDeleteAccount(del)).resolves.toBe('need_code');
  });
  it('пустой/пробельный код считается «кода нет»', async () => {
    const del = vi.fn().mockRejectedValue(err(403, TOTP_REQUIRED_REASON));
    await expect(attemptDeleteAccount(del, '   ')).resolves.toBe('need_code');
    expect(del).toHaveBeenCalledWith(undefined);
  });
  it('403 totp_required с кодом → wrong_code; код уходит без пробелов по краям', async () => {
    const del = vi.fn().mockRejectedValue(err(403, TOTP_REQUIRED_REASON));
    await expect(attemptDeleteAccount(del, ' 123456 ')).resolves.toBe(
      'wrong_code',
    );
    expect(del).toHaveBeenCalledWith('123456');
  });
  it('любая другая ошибка → failed (контрольный: не принимается за «нужен код»)', async () => {
    await expect(
      attemptDeleteAccount(
        vi.fn().mockRejectedValue(new Error('down')),
        '123456',
      ),
    ).resolves.toBe('failed');
    await expect(
      attemptDeleteAccount(vi.fn().mockRejectedValue(err(500))),
    ).resolves.toBe('failed');
  });
});

describe('buildDeleteTotpText', () => {
  const ty = (a: string) => a;
  const vy = (_a: string, b: string) => b;
  it('в форме «ты» нет «вы», в форме «вы» нет «ты»', () => {
    const t = Object.values(buildDeleteTotpText(ty)).join(' ');
    const v = Object.values(buildDeleteTotpText(vy)).join(' ');
    expect(t).toMatch(/У тебя|Введи/);
    expect(t).not.toMatch(/\bвы\b|Введите/i);
    expect(v).toMatch(/У вас|Введите/);
    expect(v).not.toMatch(/\bтеб[яе]\b|Введи /);
  });
});
