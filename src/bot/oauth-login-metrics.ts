// Блок «Вход через ВКонтакте и Яндекс» в /stats — продолжение блока «Вход по
// коду» (LoginTicketMetricsService.render). Правило №8: до 2026-11 входы через
// внешние сервисы не считал никто, и понять, пользуются ли ими, было не из чего.
// Событие login_oauth пишет только сервер (src/auth/oauth-login.report.ts),
// всегда с userId = null — фильтр ниже поэтому обязателен: /api/event открыт
// вошедшим клиентам, и без него отчёт накручивался бы с любого фронта.
//
// Один запрос с группировкой по meta (сырого SQL нет): у серверных строк meta —
// пара из закрытых списков, групп не больше десяти. Чистый форматтер, тест —
// включая пустую БД. Язык простой: «вошли», «новых аккаунтов», «привязали».
import type { PrismaService } from '../prisma/prisma.service';
import {
  LOGIN_OAUTH_OUTCOMES,
  LOGIN_OAUTH_PROVIDERS,
  sanitizeLoginOauthMeta,
  type LoginOauthOutcome,
  type LoginOauthProvider,
} from '../analytics/login-oauth.constants';
import { formatLoginOffer, loadLoginOffer } from './login-offer-metrics';
import { plural } from './plural';

export type OauthLoginCounts = Record<LoginOauthOutcome, number>;
export type OauthLoginMetrics = Record<LoginOauthProvider, OauthLoginCounts>;

const TITLE = '🚪 <b>Вход через ВКонтакте и Яндекс</b> (за неделю)';
const NAMES: Record<LoginOauthProvider, string> = {
  vk: 'ВКонтакте',
  yandex: 'Яндекс',
};

const emptyCounts = (): OauthLoginCounts =>
  Object.fromEntries(
    LOGIN_OAUTH_OUTCOMES.map((o) => [o, 0]),
  ) as OauthLoginCounts;

/** Группы запроса → счётчики; meta не из закрытых списков не считается. */
export function tallyOauthLogin(
  groups: ReadonlyArray<{ meta: unknown; count: number }>,
): OauthLoginMetrics {
  const metrics = Object.fromEntries(
    LOGIN_OAUTH_PROVIDERS.map((p) => [p, emptyCounts()]),
  ) as OauthLoginMetrics;
  for (const { meta, count } of groups) {
    const known =
      meta !== null && typeof meta === 'object'
        ? sanitizeLoginOauthMeta(meta as Record<string, unknown>)
        : undefined;
    if (!known) continue;
    const provider = known.provider as LoginOauthProvider;
    metrics[provider][known.outcome as LoginOauthOutcome] += count;
  }
  return metrics;
}

function providerLine(name: string, c: OauthLoginCounts): string {
  const entered = c.signed_in + c.signed_up;
  const parts: string[] = [];
  if (entered > 0) {
    const fresh = c.signed_up > 0 ? ` (новых аккаунтов: ${c.signed_up})` : '';
    parts.push(
      `вошли ${entered} ${plural(entered, 'раз', 'раза', 'раз')}${fresh}`,
    );
  }
  if (c.twofa > 0) parts.push(`дошли до кода второго шага: ${c.twofa}`);
  if (c.linked > 0) parts.push(`привязали к своему аккаунту: ${c.linked}`);
  if (c.merge > 0) parts.push(`предложено объединить два аккаунта: ${c.merge}`);
  return `Вход через ${name}: ${parts.length > 0 ? parts.join('; ') : 'за неделю входов не было'}`;
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatOauthLogin(m: OauthLoginMetrics): string {
  const total = LOGIN_OAUTH_PROVIDERS.reduce(
    (sum, p) => sum + LOGIN_OAUTH_OUTCOMES.reduce((s, o) => s + m[p][o], 0),
    0,
  );
  if (total === 0)
    return `${TITLE}\nЗа неделю через ВКонтакте и Яндекс входов не было.`;
  return [
    TITLE,
    ...LOGIN_OAUTH_PROVIDERS.map((p) => providerLine(NAMES[p], m[p])),
    'Это входы, а не люди: один человек мог войти несколько раз.',
  ].join('\n');
}

export async function loadOauthLogin(
  prisma: PrismaService,
): Promise<OauthLoginMetrics> {
  const since7 = new Date(Date.now() - 7 * 86_400_000);
  const groups = await prisma.analyticsEvent.groupBy({
    by: ['meta'],
    where: { name: 'login_oauth', userId: null, createdAt: { gte: since7 } },
    _count: { _all: true },
  });
  return tallyOauthLogin(
    groups.map((g) => ({ meta: g.meta, count: g._count._all })),
  );
}

/** Хвост блока «Вход по коду»: входы через внешние сервисы и приглашение. */
export async function renderLoginMethods(
  prisma: PrismaService,
): Promise<string> {
  const [oauth, offer] = await Promise.all([
    loadOauthLogin(prisma),
    loadLoginOffer(prisma),
  ]);
  return `${formatOauthLogin(oauth)}\n\n${formatLoginOffer(offer)}`;
}
