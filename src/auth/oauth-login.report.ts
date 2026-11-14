// Единственное место, которое пишет событие login_oauth и знает форму его meta
// (реестр и причины — src/analytics/login-oauth.constants.ts). Чистые функции
// без Nest-обвязки, как exchange-failure.report.ts.
//
// userId всегда null — приём login_ticket_step: /stats считает только строки
// без userId, поэтому подделать отчёт через открытый /api/event нельзя.
// Троттлинга нет намеренно: строка пишется только после обмена кода, который
// площадка выдаёт на один раз, — поток ограничен числом настоящих входов.
import type { AnalyticsService } from '../analytics/analytics.service';
import type { PrismaService } from '../prisma/prisma.service';
import {
  isLoginOauthProvider,
  type LoginOauthOutcome,
} from '../analytics/login-oauth.constants';
import type { SignInOutcome } from './auth-flow.service';

/**
 * Был ли этот вход у нас до колбэка. Нет — signInOrLinkOrMerge заведёт новый
 * аккаунт: сам он возвращает только userId и «новый или прежний» не говорит.
 */
export async function isKnownLogin(
  prisma: PrismaService,
  provider: string,
  providerId: string,
): Promise<boolean> {
  const row = await prisma.authProvider.findUnique({
    where: { provider_providerId: { provider, providerId } },
    select: { id: true },
  });
  return row !== null;
}

/** Исход для отчёта: чем закончился signInOrLinkOrMerge. */
export function loginOauthOutcome(
  kind: SignInOutcome['kind'],
  linking: boolean,
  known: boolean,
): LoginOauthOutcome {
  if (kind === 'merge') return 'merge';
  if (linking) return 'linked';
  if (kind === 'totp_challenge') return 'twofa';
  return known ? 'signed_in' : 'signed_up';
}

/**
 * `void`: AnalyticsService.track глотает свои ошибки сам, а отчёт о входе не
 * имеет права задерживать вход. Провайдер вне списка не пишется.
 */
export function reportOauthLogin(
  analytics: AnalyticsService,
  provider: string,
  outcome: LoginOauthOutcome,
): void {
  if (!isLoginOauthProvider(provider)) return;
  void analytics.track(null, 'login_oauth', { provider, outcome });
}
