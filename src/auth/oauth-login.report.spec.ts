// Событие login_oauth: исход входа через внешний сервис и кто его пишет.
import type { AnalyticsService } from '../analytics/analytics.service';
import type { PrismaService } from '../prisma/prisma.service';
import {
  LOGIN_OAUTH_OUTCOMES,
  LOGIN_OAUTH_PROVIDERS,
  sanitizeLoginOauthMeta,
} from '../analytics/login-oauth.constants';
import { OAUTH_PROVIDER_ENV } from './oauth-provider-switch';
import {
  isKnownLogin,
  loginOauthOutcome,
  reportOauthLogin,
} from './oauth-login.report';

describe('loginOauthOutcome — исход signInOrLinkOrMerge словами отчёта', () => {
  it.each([
    ['tokens', false, true, 'signed_in'],
    ['tokens', false, false, 'signed_up'],
    ['totp_challenge', false, true, 'twofa'],
    ['tokens', true, false, 'linked'],
    ['merge', true, false, 'merge'],
  ] as const)(
    'исход %s, привязка=%s, вход известен=%s → %s',
    (kind, linking, known, expected) => {
      expect(loginOauthOutcome(kind, linking, known)).toBe(expected);
    },
  );

  it('каждый исход из списка достижим — мёртвых значений в реестре нет', () => {
    const reached = new Set([
      loginOauthOutcome('tokens', false, true),
      loginOauthOutcome('tokens', false, false),
      loginOauthOutcome('totp_challenge', false, true),
      loginOauthOutcome('tokens', true, false),
      loginOauthOutcome('merge', true, false),
    ]);
    expect([...reached].sort()).toEqual([...LOGIN_OAUTH_OUTCOMES].sort());
  });
});

describe('reportOauthLogin', () => {
  const make = () => {
    const track = jest.fn().mockResolvedValue(undefined);
    return { analytics: { track } as unknown as AnalyticsService, track };
  };

  it('пишет серверную строку: userId = null, только провайдер и исход', () => {
    const { analytics, track } = make();
    reportOauthLogin(analytics, 'yandex', 'signed_up');
    expect(track).toHaveBeenCalledWith(null, 'login_oauth', {
      provider: 'yandex',
      outcome: 'signed_up',
    });
  });

  it('провайдер вне списка не пишется; контроль — провайдер из списка пишется', () => {
    const { analytics, track } = make();
    reportOauthLogin(analytics, 'telegram', 'signed_in');
    reportOauthLogin(analytics, 'google', 'signed_in');
    reportOauthLogin(analytics, 'vk', 'signed_in');
    expect(track.mock.calls).toEqual([
      [null, 'login_oauth', { provider: 'vk', outcome: 'signed_in' }],
    ]);
  });

  it('то, что пишет сервер, проходит санитайзер без потерь', () => {
    const { analytics, track } = make();
    for (const provider of LOGIN_OAUTH_PROVIDERS)
      for (const outcome of LOGIN_OAUTH_OUTCOMES)
        reportOauthLogin(analytics, provider, outcome);
    for (const [, , meta] of track.mock.calls as [
      null,
      string,
      Record<string, unknown>,
    ][])
      expect(sanitizeLoginOauthMeta(meta)).toEqual(meta);
    expect(track).toHaveBeenCalledTimes(
      LOGIN_OAUTH_PROVIDERS.length * LOGIN_OAUTH_OUTCOMES.length,
    );
  });
});

describe('sanitizeLoginOauthMeta — закрытые списки', () => {
  it('лишние поля срезаются', () => {
    expect(
      sanitizeLoginOauthMeta({
        provider: 'vk',
        outcome: 'linked',
        email: 'a@b.ru',
        providerId: '42',
      }),
    ).toEqual({ provider: 'vk', outcome: 'linked' });
  });

  it.each([
    [{ provider: 'google', outcome: 'signed_in' }],
    [{ provider: 'yandex', outcome: 'hacked' }],
    [{ provider: 'yandex' }],
    [{ outcome: 'signed_in' }],
    [{ provider: ['vk'], outcome: 'signed_in' }],
  ])('%p — не из списков, meta отбрасывается целиком', (meta) => {
    expect(sanitizeLoginOauthMeta(meta)).toBeUndefined();
  });
});

describe('isKnownLogin', () => {
  it('ищет строку входа только по паре (provider, providerId)', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 7 })
      .mockResolvedValueOnce(null);
    const prisma = { authProvider: { findUnique } } as unknown as PrismaService;

    await expect(isKnownLogin(prisma, 'yandex', '123')).resolves.toBe(true);
    await expect(isKnownLogin(prisma, 'yandex', '456')).resolves.toBe(false);
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        provider_providerId: { provider: 'yandex', providerId: '123' },
      },
      select: { id: true },
    });
  });
});

// Правило №4: провайдеры отчёта ↔ провайдеры с OAuth-колбэком (рубильник).
// Новый OAuth-провайдер без строки в LOGIN_OAUTH_PROVIDERS входил бы молча.
describe('сверка: LOGIN_OAUTH_PROVIDERS = провайдеры рубильника', () => {
  it('списки совпадают', () => {
    expect([...LOGIN_OAUTH_PROVIDERS].sort()).toEqual(
      Object.keys(OAUTH_PROVIDER_ENV).sort(),
    );
  });
});
