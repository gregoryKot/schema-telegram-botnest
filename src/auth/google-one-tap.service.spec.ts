// Вход через Google One Tap. Главное, что держит файл: id_token из браузера
// проходит ТОТ ЖЕ верификатор, что и обмен кода (подделку/просрочку/чужой aud
// отвергаем), это всегда ВХОД (не привязка), а у аккаунта с 2FA сессия сразу
// не выдаётся. Разбор 2026-08-31.
//
// 'jose' — чистый ESM, ts-jest его не парсит; сервис тянет его транзитивно
// (AuthFlowService → registry → GoogleProvider). Верификатор здесь замокан
// целиком (мы мокаем GoogleProvider.verifyIdToken), поэтому глушим модуль.
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
  decodeJwt: jest.fn(),
}));

import { UnauthorizedException } from '@nestjs/common';
import { GoogleOneTapService } from './google-one-tap.service';

const IDENTITY = {
  providerId: 'g-1',
  email: 'a@example.com',
  displayName: 'Аня',
};

function make() {
  const verifyIdToken = jest.fn();
  const signInOrLinkOrMerge = jest.fn();
  const providers = { get: jest.fn(() => ({ verifyIdToken })) };
  const flow = { signInOrLinkOrMerge };
  const analytics = { track: jest.fn().mockResolvedValue(undefined) };
  const svc = new GoogleOneTapService(
    providers as never,
    flow as never,
    analytics as never,
  );
  return { svc, verifyIdToken, signInOrLinkOrMerge, analytics };
}

function makeRes() {
  return { cookie: jest.fn(), clearCookie: jest.fn() } as never;
}

describe('GoogleOneTapService.login', () => {
  it('верный credential без 2FA → сессия выдана, refresh-кука поставлена', async () => {
    const { svc, verifyIdToken, signInOrLinkOrMerge } = make();
    verifyIdToken.mockResolvedValue(IDENTITY);
    signInOrLinkOrMerge.mockResolvedValue({
      kind: 'tokens',
      userId: 7n,
      tokens: {
        accessToken: 'acc',
        refreshToken: 'ref',
        expiresIn: 900,
        rotated: true,
      },
    });
    const res = makeRes() as unknown as {
      cookie: jest.Mock;
      clearCookie: jest.Mock;
    };
    const out = await svc.login(
      'h.p.s',
      'cookie-1',
      res as never,
      '1.2.3.4',
      'UA',
    );

    // Кука nonce едет в верификатор (B-16), после проверки она гасится.
    expect(verifyIdToken).toHaveBeenCalledWith('h.p.s', {
      nonceCookie: 'cookie-1',
    });
    expect(
      (res as unknown as { clearCookie: jest.Mock }).clearCookie,
    ).toHaveBeenCalledWith('gsi_nonce', { path: '/api/auth' });
    // ВХОД, не привязка: linkUserId всегда null.
    expect(signInOrLinkOrMerge).toHaveBeenCalledWith('google', IDENTITY, {
      linkUserId: null,
      ip: '1.2.3.4',
      userAgent: 'UA',
    });
    // refresh уехал в куку, access — в теле.
    expect(res.cookie).toHaveBeenCalled();
    expect(res.cookie.mock.calls[0][1]).toBe('ref');
    expect(out).toEqual({ accessToken: 'acc', expiresIn: 900 });
  });

  // Аудит 2026-10 (правило №8): входы через окно One Tap не были видны в /stats.
  // Событие пишет только сервер и с userId = null — подделку через /api/event
  // (там userId всегда есть) отчёт не считает.
  it.each([
    ['tokens', 'signed_in'],
    ['totp_challenge', 'twofa'],
  ] as const)(
    'исход %s → событие login_one_tap {outcome: %s}',
    async (kind, outcome) => {
      const { svc, verifyIdToken, signInOrLinkOrMerge, analytics } = make();
      verifyIdToken.mockResolvedValue(IDENTITY);
      signInOrLinkOrMerge.mockResolvedValue(
        kind === 'tokens'
          ? {
              kind,
              userId: 7n,
              tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 900 },
            }
          : { kind, userId: 7n, challengeToken: 'ct' },
      );
      await svc.login('h.p.s', 'cookie-1', makeRes());
      expect(analytics.track).toHaveBeenCalledWith(null, 'login_one_tap', {
        outcome,
      });
    },
  );

  it('включён 2FA → сессию НЕ выдаём, возвращаем challenge', async () => {
    const { svc, verifyIdToken, signInOrLinkOrMerge } = make();
    verifyIdToken.mockResolvedValue(IDENTITY);
    signInOrLinkOrMerge.mockResolvedValue({
      kind: 'totp_challenge',
      userId: 7n,
      challengeToken: 'ct',
    });
    const res = makeRes() as unknown as { cookie: jest.Mock };
    const out = await svc.login('h.p.s', 'cookie-1', res as never);

    // Сессии ещё нет — куку не ставим, пока не введён код 2FA.
    expect(res.cookie).not.toHaveBeenCalled();
    expect(out).toEqual({ twofa: true, challengeToken: 'ct' });
  });

  it('подделанный/просроченный credential → ошибка верификатора пробрасывается, входа нет', async () => {
    const { svc, verifyIdToken, signInOrLinkOrMerge } = make();
    verifyIdToken.mockRejectedValue(
      new UnauthorizedException('Google ID token invalid'),
    );
    const res = makeRes() as unknown as { cookie: jest.Mock };

    await expect(svc.login('h.p.s', 'cookie-1', res as never)).rejects.toThrow(
      'Google ID token invalid',
    );
    // До выдачи сессии дело не дошло.
    expect(signInOrLinkOrMerge).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('отказ верификатора → событие {outcome: rejected}; прочие сбои — без события', async () => {
    const { svc, verifyIdToken, signInOrLinkOrMerge, analytics } = make();
    verifyIdToken.mockRejectedValue(new UnauthorizedException('bad'));
    await expect(svc.login('x', 'c', makeRes())).rejects.toThrow('bad');
    expect(analytics.track).toHaveBeenCalledWith(null, 'login_one_tap', {
      outcome: 'rejected',
    });

    // Контроль: упала база на входе — это не «Google не принял», событие не пишем.
    analytics.track.mockClear();
    verifyIdToken.mockResolvedValue(IDENTITY);
    signInOrLinkOrMerge.mockRejectedValue(new Error('db down'));
    await expect(svc.login('x', 'c', makeRes())).rejects.toThrow('db down');
    expect(analytics.track).not.toHaveBeenCalled();
  });
});
