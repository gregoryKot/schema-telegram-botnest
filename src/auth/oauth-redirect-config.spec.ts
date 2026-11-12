// Инцидент 2026-09-16: GOOGLE_REDIRECT_URI (вход через Google убран 2026-11) и VK_REDIRECT_URI указывали на
// старый домен (schemalab.ru) — редирект колбэка гонял запрос по кругу с
// хостовым мидлваром main.ts. Проверка конфигурации при старте ловит это до
// первой жалобы пользователя.
import {
  findMisconfiguredOauthRedirects,
  buildOauthRedirectCapability,
} from './oauth-redirect-config';

describe('findMisconfiguredOauthRedirects', () => {
  it('ничего не настроено — нет проблем (нечего проверять)', () => {
    expect(findMisconfiguredOauthRedirects({})).toEqual([]);
  });

  it('канонический адрес возврата — нет проблем (контроль)', () => {
    expect(
      findMisconfiguredOauthRedirects({
        VK_REDIRECT_URI: 'https://schemehappens.ru/api/auth/vk/callback',
        WEBAPP_URL: 'https://schemehappens.ru',
      }),
    ).toEqual([]);
  });

  it('VK_REDIRECT_URI на legacy-хосте — находит проблему', () => {
    const issues = findMisconfiguredOauthRedirects({
      VK_REDIRECT_URI: 'https://schemalab.ru/api/auth/vk/callback',
    });
    expect(issues).toEqual([
      { envVar: 'VK_REDIRECT_URI', host: 'schemalab.ru' },
    ]);
  });

  it('VK_REDIRECT_URI на www-хосте — находит проблему', () => {
    const issues = findMisconfiguredOauthRedirects({
      VK_REDIRECT_URI: 'https://www.schemehappens.ru/api/auth/vk/callback',
    });
    expect(issues).toEqual([
      { envVar: 'VK_REDIRECT_URI', host: 'www.schemehappens.ru' },
    ]);
  });

  it('WEBAPP_URL на legacy-хосте — находит проблему (от него строятся редиректы колбэка VK)', () => {
    const issues = findMisconfiguredOauthRedirects({
      WEBAPP_URL: 'https://www.schemalab.ru',
    });
    expect(issues).toEqual([
      { envVar: 'WEBAPP_URL', host: 'www.schemalab.ru' },
    ]);
  });

  it('алиас-домен (kotlarewski.gr) — не мисконфиг', () => {
    expect(
      findMisconfiguredOauthRedirects({
        VK_REDIRECT_URI: 'https://kotlarewski.gr/api/auth/vk/callback',
      }),
    ).toEqual([]);
  });

  it('битый URL — не роняет проверку, просто не считается проблемой хоста', () => {
    expect(
      findMisconfiguredOauthRedirects({ VK_REDIRECT_URI: 'не-url' }),
    ).toEqual([]);
  });
});

describe('buildOauthRedirectCapability', () => {
  it('нечего проверять — on: true', () => {
    expect(buildOauthRedirectCapability({}).on).toBe(true);
  });

  it('мисконфиг — on: false, offReason непустой', () => {
    const cap = buildOauthRedirectCapability({
      VK_REDIRECT_URI: 'https://schemalab.ru/api/auth/vk/callback',
    });
    expect(cap.on).toBe(false);
    expect(cap.id).toBe('oauthRedirectSane');
    expect(cap.offReason.length).toBeGreaterThan(10);
    expect(cap.critical).toBe(false);
  });
});
