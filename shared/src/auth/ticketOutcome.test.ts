// Развилка ответа опроса: сессия, вызов второго фактора, отказ, ожидание.
import { describe, it, expect, vi } from 'vitest';
import { settlePoll, totpChallengeUrl } from './ticketOutcome';

const handlers = () => ({ session: vi.fn(), totp: vi.fn() });

describe('settlePoll', () => {
  it('подтверждён с токеном — сессия уходит хозяину', () => {
    const on = handlers();
    expect(
      settlePoll({ status: 'linked', accessToken: 'a', expiresIn: 60 }, on),
    ).toBe('session');
    expect(on.session).toHaveBeenCalledWith('a', 60);
    expect(on.totp).not.toHaveBeenCalled();
  });

  it('срок токена не назван — 15 минут', () => {
    const on = handlers();
    settlePoll({ status: 'linked', accessToken: 'a' }, on);
    expect(on.session).toHaveBeenCalledWith('a', 900);
  });

  it('включена 2FA — вместо сессии вызов уходит на экран кода', () => {
    const on = handlers();
    expect(
      settlePoll({ status: 'totp_required', challengeToken: 'ch' }, on),
    ).toBe('totp');
    expect(on.totp).toHaveBeenCalledWith('ch');
    expect(on.session).not.toHaveBeenCalled();
  });

  it.each(['denied', 'expired'] as const)(
    '%s — отдельный исход без сессии',
    (status) => {
      const on = handlers();
      expect(settlePoll({ status }, on)).toBe(status);
      expect(on.session).not.toHaveBeenCalled();
    },
  );

  it.each([
    { status: 'pending' as const },
    { status: 'linked' as const },
    { status: 'totp_required' as const },
  ])('$status без токена — вход не состоялся, ждём дальше', (res) => {
    const on = handlers();
    expect(settlePoll(res, on)).toBe('pending');
    expect(on.session).not.toHaveBeenCalled();
    expect(on.totp).not.toHaveBeenCalled();
  });
});

describe('totpChallengeUrl', () => {
  it('ведёт на экран второго фактора, вызов экранирован', () => {
    expect(totpChallengeUrl('a.b+c/d')).toBe('/auth/2fa?token=a.b%2Bc%2Fd');
  });
});
