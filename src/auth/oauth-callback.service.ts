import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthFlowService } from './auth-flow.service';
import { AuthProviderRegistry } from './providers/registry';
import type { AuthProviderHandler, ProviderIdentity } from './providers/types';
import {
  OAUTH_COOKIE_PATH,
  OAUTH_STATE_COOKIE,
  assertOAuthStateMatches,
} from './oauth-host';
import { oauthErrorCode } from './oauth-error-code';
import {
  isKnownLogin,
  loginOauthOutcome,
  reportOauthLogin,
} from './oauth-login.report';

/** Что площадка прислала в адресе возврата. */
export interface OAuthCallbackQuery {
  code?: string;
  /** Подписанный state (у VK — уже раскодированный из base64url, vk-state.ts). */
  state?: string;
  /** `?error=`: человек отказал или площадка не приняла запрос. */
  error?: unknown;
  /** Обязательные параметры сверх code и state (у VK — device_id). */
  extra?: Record<string, string | undefined>;
}

/** Обмен кода на личность; свой нужен площадке с доп. параметрами (VK). */
export type OAuthExchange = (
  handler: AuthProviderHandler,
  state: string,
  code: string,
) => Promise<ProviderIdentity>;

const exchangeByCode: OAuthExchange = (handler, _state, code) => {
  if (!handler.exchangeCode)
    throw new BadRequestException(`Provider ${handler.id} has no exchangeCode`);
  return handler.exchangeCode(code);
};

// Общий хвост OAuth-колбэков (VK, Яндекс) — одно место на все площадки
// (правила №3/№11): сверка state с кукой → обмен кода → вход, привязка или
// объединение → событие login_oauth → экран по исходу. Старт входа — парный
// AuthFlowService.oauthRedirect. Контекст логгера назван в ANON_ALERT_CONTEXTS
// (src/logger/alert-gate.ts): error() отсюда может вызвать аноним одним запросом.
@Injectable()
export class OAuthCallbackService {
  private readonly logger = new Logger(OAuthCallbackService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly providers: AuthProviderRegistry,
    private readonly flow: AuthFlowService,
    private readonly analytics: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Не бросает: любой отказ — строка в лог (DM владельцу) и экран `<id>_failed`. */
  async complete(
    provider: string,
    req: Request,
    res: Response,
    query: OAuthCallbackQuery,
    exchange: OAuthExchange = exchangeByCode,
  ): Promise<void> {
    const frontendBase = this.config.getOrThrow<string>('WEBAPP_URL');
    try {
      const handler = this.providers.get(provider);
      // `?error=` присылает браузер — в лог только код (oauth-error-code.ts).
      if (query.error)
        throw new UnauthorizedException(
          `${provider} auth denied: ${oauthErrorCode(query.error)}`,
        );
      const { code, state } = query;
      const missing = Object.entries({ code, state, ...query.extra })
        .filter(([, value]) => !value)
        .map(([name]) => name);
      if (!code || !state || missing.length > 0)
        throw new BadRequestException(`Missing ${missing.join(' / ')}`);
      const origin = handler.callbackOrigin?.() ?? new URL(frontendBase).origin;
      assertOAuthStateMatches(req, state, origin);
      res.clearCookie(OAUTH_STATE_COOKIE, { path: OAUTH_COOKIE_PATH });
      const identity = await exchange(handler, state, code);
      const linkUserId = this.flow.linkUserIdFromState(state);
      const known =
        linkUserId === null &&
        (await isKnownLogin(this.prisma, provider, identity.providerId));
      const outcome = await this.flow.signInOrLinkOrMerge(provider, identity, {
        linkUserId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      reportOauthLogin(
        this.analytics,
        provider,
        loginOauthOutcome(outcome.kind, linkUserId !== null, known),
      );
      this.flow.finishOAuthRedirect(
        outcome,
        provider,
        res,
        frontendBase,
        this.flow.ticketFromState(state),
      );
    } catch (err) {
      const reason = (err as Error).message;
      this.logger.error(`${provider} callback error: ${reason}`, err);
      res.redirect(`${frontendBase}/auth/error?reason=${provider}_failed`);
    }
  }
}
