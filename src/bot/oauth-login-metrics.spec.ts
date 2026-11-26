// Блок «Вход через ВКонтакте и Яндекс» в /stats (правило №8): чистый форматтер,
// включая пустую БД, и счёт только серверных строк события login_oauth.
import type { PrismaService } from '../prisma/prisma.service';
import {
  LOGIN_OAUTH_OUTCOMES,
  LOGIN_OAUTH_PROVIDERS,
} from '../analytics/login-oauth.constants';
import {
  formatOauthLogin,
  loadOauthLogin,
  renderLoginMethods,
  tallyOauthLogin,
  type OauthLoginMetrics,
} from './oauth-login-metrics';

const zero = () => tallyOauthLogin([]);
const metrics = (
  patch: Partial<Record<'vk' | 'yandex', Partial<OauthLoginMetrics['vk']>>>,
): OauthLoginMetrics => {
  const m = zero();
  Object.assign(m.vk, patch.vk);
  Object.assign(m.yandex, patch.yandex);
  return m;
};

describe('formatOauthLogin', () => {
  it('пустая БД — одна честная строка, без нулей и NaN', () => {
    const text = formatOauthLogin(zero());
    expect(text).toBe(
      '🚪 <b>Вход через ВКонтакте и Яндекс</b> (за неделю)\n' +
        'За неделю через ВКонтакте и Яндекс входов не было.',
    );
    expect(text).not.toMatch(/\d|NaN|undefined/);
  });

  it('входы, новые аккаунты, привязки — простыми словами по каждому сервису', () => {
    const text = formatOauthLogin(
      metrics({
        vk: { signed_in: 20, signed_up: 1 },
        yandex: { signed_in: 9, signed_up: 3, twofa: 1, linked: 2, merge: 1 },
      }),
    );
    expect(text.split('\n')).toEqual([
      '🚪 <b>Вход через ВКонтакте и Яндекс</b> (за неделю)',
      'Вход через ВКонтакте: вошли 21 раз (новых аккаунтов: 1)',
      'Вход через Яндекс: вошли 12 раз (новых аккаунтов: 3); дошли до кода второго шага: 1; привязали к своему аккаунту: 2; предложено объединить два аккаунта: 1',
      'Это входы, а не люди: один человек мог войти несколько раз.',
    ]);
    expect(text).not.toMatch(/oauth|signed_|provider|merge|twofa/i);
  });

  it('у одного сервиса входов нет — так и сказано, без «0 раз»', () => {
    const text = formatOauthLogin(metrics({ vk: { signed_in: 3 } }));
    expect(text).toContain('Вход через ВКонтакте: вошли 3 раза');
    expect(text).toContain('Вход через Яндекс: за неделю входов не было');
    expect(text).not.toContain('новых аккаунтов');
    expect(text).not.toMatch(/\b0\b/);
  });

  it('только привязки — строка без «вошли»', () => {
    const text = formatOauthLogin(metrics({ yandex: { linked: 1 } }));
    expect(text).toContain('Вход через Яндекс: привязали к своему аккаунту: 1');
    expect(text).not.toContain('вошли');
  });

  it.each([
    [1, 'вошли 1 раз'],
    [2, 'вошли 2 раза'],
    [5, 'вошли 5 раз'],
    [22, 'вошли 22 раза'],
  ])('склонение: %d → «%s»', (n, phrase) => {
    expect(formatOauthLogin(metrics({ yandex: { signed_in: n } }))).toContain(
      phrase,
    );
  });
});

describe('tallyOauthLogin', () => {
  it('складывает группы по провайдеру и исходу; чужая meta не считается', () => {
    const m = tallyOauthLogin([
      { meta: { provider: 'yandex', outcome: 'signed_in' }, count: 4 },
      { meta: { outcome: 'signed_in', provider: 'yandex' }, count: 1 },
      { meta: { provider: 'vk', outcome: 'linked' }, count: 2 },
      { meta: { provider: 'google', outcome: 'signed_in' }, count: 50 },
      { meta: { provider: 'yandex', outcome: 'hacked' }, count: 50 },
      { meta: null, count: 50 },
      { meta: 'yandex', count: 50 },
    ]);
    expect(m.yandex.signed_in).toBe(5);
    expect(m.vk.linked).toBe(2);
    const total = LOGIN_OAUTH_PROVIDERS.flatMap((p) =>
      LOGIN_OAUTH_OUTCOMES.map((o) => m[p][o]),
    ).reduce((a, b) => a + b, 0);
    expect(total).toBe(7);
  });

  it('пустой результат — нули по всем провайдерам и исходам', () => {
    const m = zero();
    for (const p of LOGIN_OAUTH_PROVIDERS)
      for (const o of LOGIN_OAUTH_OUTCOMES) expect(m[p][o]).toBe(0);
  });
});

describe('loadOauthLogin', () => {
  it('считает только серверные строки login_oauth за неделю, одним запросом', async () => {
    const groupBy = jest.fn().mockResolvedValue([
      {
        meta: { provider: 'yandex', outcome: 'signed_up' },
        _count: { _all: 3 },
      },
    ]);
    const prisma = { analyticsEvent: { groupBy } } as unknown as PrismaService;

    const m = await loadOauthLogin(prisma);

    expect(m.yandex.signed_up).toBe(3);
    expect(groupBy).toHaveBeenCalledTimes(1);
    const args = groupBy.mock.calls[0][0] as {
      by: string[];
      where: { name: string; userId: null; createdAt: { gte: Date } };
    };
    expect(args.by).toEqual(['meta']);
    expect(args.where.name).toBe('login_oauth');
    // Подделка через /api/event несёт userId — в отчёт не попадает.
    expect(args.where.userId).toBeNull();
    const ageDays = (Date.now() - args.where.createdAt.gte.getTime()) / 864e5;
    expect(ageDays).toBeCloseTo(7, 1);
  });
});

describe('renderLoginMethods', () => {
  it('входы через сервисы идут перед приглашением добавить способ входа', async () => {
    const prisma = {
      analyticsEvent: {
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaService;
    const text = await renderLoginMethods(prisma);
    const oauth = text.indexOf('Вход через ВКонтакте и Яндекс');
    const offer = text.indexOf('для входа на сайт');
    expect(oauth).toBeGreaterThanOrEqual(0);
    expect(offer).toBeGreaterThan(oauth);
  });
});
