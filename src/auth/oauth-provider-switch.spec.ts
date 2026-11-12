// Рубильник VK и Яндекса: какой env выключает провайдера и что знает экран ошибки.
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  OAUTH_PROVIDER_ENV,
  disabledProviderRedirect,
  disabledReason,
  type EnvReader,
} from './oauth-provider-switch';
import { CROSS_CHECKS } from '../infra/env-check';

const FULL: Record<string, string> = {
  VK_APP_ID: 'vkid',
  VK_REDIRECT_URI: 'https://schemehappens.ru/api/auth/vk/callback',
  YANDEX_CLIENT_ID: '11c76b6012374a5c8ad05acaeca11895',
  YANDEX_CLIENT_SECRET: 'yandex-secret',
  YANDEX_REDIRECT_URI: 'https://schemehappens.ru/api/auth/yandex/callback',
  WEBAPP_URL: 'https://schemehappens.ru/',
};

const reader = (env: Record<string, string | undefined>): EnvReader => ({
  get: <T>(n: string) => env[n] as T | undefined,
  getOrThrow: <T>(n: string) => {
    if (!env[n]) throw new Error(`no ${n}`);
    return env[n] as T;
  },
});

describe('disabledProviderRedirect', () => {
  it.each(Object.keys(OAUTH_PROVIDER_ENV))(
    '%s: полная конфигурация — провайдер включён (null)',
    (provider) => {
      expect(disabledProviderRedirect(provider, reader(FULL))).toBeNull();
    },
  );

  // Запись в рубильнике обязательна: провайдер вне списка ушёл бы в
  // buildAuthUrl и упал на getOrThrow голым 500.
  it('рубильник знает оба OAuth-провайдера и полный набор env Яндекса', () => {
    expect(Object.keys(OAUTH_PROVIDER_ENV).sort()).toEqual(['vk', 'yandex']);
    expect(OAUTH_PROVIDER_ENV.yandex).toEqual([
      'YANDEX_CLIENT_ID',
      'YANDEX_CLIENT_SECRET',
      'YANDEX_REDIRECT_URI',
    ]);
  });

  it.each(
    Object.entries(OAUTH_PROVIDER_ENV).flatMap(([p, names]) =>
      names.map((n) => [p, n]),
    ),
  )('%s без %s — экран ошибки с причиной <id>_disabled', (provider, name) => {
    const env = { ...FULL, [name]: ' ' };
    expect(disabledProviderRedirect(provider, reader(env))).toBe(
      `https://schemehappens.ru/auth/error?reason=${provider}_disabled`,
    );
  });

  it('провайдер вне списка (telegram) решает сам — null', () => {
    expect(disabledProviderRedirect('telegram', reader({}))).toBeNull();
  });
});

// Правило №4: env рубильника ↔ сверка env на старте (`requiresToo`):
// задан первый — сверка требует остальные; без любой из них вход выключен.
describe('сверка с env-check', () => {
  it.each(Object.entries(OAUTH_PROVIDER_ENV))(
    '%s: сверка env на старте требует те же переменные',
    (_provider, [head, ...rest]) => {
      const said = CROSS_CHECKS.map((c) =>
        c.check({ [head]: 'x' }, 'production'),
      )
        .filter(Boolean)
        .join('\n');
      for (const name of rest) expect(said).toContain(name);
    },
  );
});

// Правило №4: причина, которую ставит сервер, известна экрану `/auth/error` —
// иначе человек увидит общий «Вход не удался», а отчёт получит `unknown`.
describe('сверка с экраном ошибки входа', () => {
  const dict = readFileSync(
    join(__dirname, '../../webapp/src/pages/service/authErrorReasons.ts'),
    'utf8',
  );
  it.each(Object.keys(OAUTH_PROVIDER_ENV))(
    'словарь authErrorReasons знает %s_disabled',
    (provider) => {
      expect(dict).toContain(`${disabledReason(provider)}:`);
    },
  );
});
