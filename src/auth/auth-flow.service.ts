import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthProviderRegistry } from './providers/registry';
import { MergeService } from './merge.service';
import { AuthProviderHandler, ProviderIdentity } from './providers/types';
import { TotpService } from './totp.service';
import { setRefreshCookie } from './auth-http.util';
import { linkCookieUserId } from './step-up';
import { SecurityNoticeService } from './security-notice.service';
import { signOAuthState, readOAuthState, readOAuthTicket } from './oauth-state';
import {
  OAUTH_STATE_COOKIE,
  setOAuthCookie,
  redirectToCallbackHost,
} from './oauth-host';
import { disabledProviderRedirect } from './oauth-provider-switch';

export type SignInOutcome =
  | {
      kind: 'tokens';
      userId: bigint;
      tokens: Awaited<ReturnType<AuthService['issueTokens']>>;
    }
  | { kind: 'totp_challenge'; userId: bigint; challengeToken: string }
  | {
      kind: 'merge';
      mergeToken: string;
      summary: Record<string, number>;
      // 2FA source-аккаунта не переезжает (merge-user-rules.ts, totpSecret:
      // skip) — экран подтверждения обязан об этом сказать, иначе человек
      // молча теряет второй фактор.
      twoFactorLost: boolean;
      otherDisplay: string | null;
    };

// Общий OAuth/вход для auth-контроллеров (вынесен из AuthController, №10).
@Injectable()
export class AuthFlowService {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly providers: AuthProviderRegistry,
    private readonly merge: MergeService,
    private readonly totp: TotpService,
    private readonly notice: SecurityNoticeService,
  ) {}

  // ─── Generic helper ───────────────────────────────────────────────────────
  // signInOrLinkOrMerge handles the three outcomes after we obtain a
  // ProviderIdentity from any provider:
  //   1. No linkUserId given → sign-in or sign-up (findOrCreate). Issue tokens.
  //   2. linkUserId given, no conflict → link provider to that user. Issue tokens
  //      (refresh token of the active user is already valid; we re-issue for
  //      consistency).
  //   3. linkUserId given, but providerId already belongs to another user →
  //      return a merge token; the UI asks the user to confirm before we
  //      destroy the other account.
  // Returns either { tokens } or { mergeToken, summary } so the caller can act.
  async signInOrLinkOrMerge(
    providerId_: string,
    identity: ProviderIdentity,
    opts: { linkUserId: bigint | null; ip?: string; userAgent?: string },
  ): Promise<SignInOutcome> {
    const { linkUserId, ip, userAgent } = opts;

    if (linkUserId === null) {
      const userId = await this.auth.findOrCreateUserByProvider(
        providerId_,
        identity.providerId,
        identity.displayName,
        identity.email,
      );
      // 2FA gate: if user has TOTP enabled, don't issue tokens yet — return
      // a challenge token that the client exchanges for tokens after typing
      // a valid 6-digit code on /api/auth/2fa/challenge.
      if (await this.totp.isEnabled(userId)) {
        const challengeToken = this.auth.buildTotpChallengeToken(
          userId,
          ip,
          userAgent,
        );
        return { kind: 'totp_challenge', userId, challengeToken };
      }
      const tokens = await this.auth.issueTokens(userId, ip, userAgent);
      return { kind: 'tokens', userId, tokens };
    }

    const result = await this.auth.linkProviderToUser(
      linkUserId,
      providerId_,
      identity.providerId,
      identity.displayName,
      identity.email,
    );

    if (result.ok) {
      // Step-up уже был при выдаче link_token (S12); владельцу — уведомление.
      this.notice.linked(linkUserId, providerId_);
      const tokens = await this.auth.issueTokens(linkUserId, ip, userAgent);
      return { kind: 'tokens', userId: linkUserId, tokens };
    }

    // Conflict — issue a signed merge token, return data summary for UI.
    const sourceId = BigInt(result.conflictUserId);
    const mergeToken = this.auth.buildMergeToken(
      linkUserId,
      sourceId,
      providerId_,
      identity.providerId,
    );
    const { counts, twoFactorLost } = await this.merge.summarize(
      sourceId,
      linkUserId,
    );
    return {
      kind: 'merge',
      mergeToken,
      summary: counts,
      twoFactorLost,
      otherDisplay: identity.displayName ?? identity.email ?? null,
    };
  }

  // Общий обработчик OAuth-редирект-колбэков (VK) — ведёт
  // на нужный экран по исходу. Синхронный: молчаливого одобрения билета здесь
  // больше нет (device-code phishing, разбор 2026-08-31) — одобрение уехало
  // на экран сверки /auth/confirm.
  finishOAuthRedirect(
    outcome: SignInOutcome,
    provider: string,
    res: Response,
    frontendBase: string,
    // Билет входа: вход начат в контейнере, который сессию из браузера не
    // увидит. Код подтверждаем на /auth/confirm, а браузеру говорим вернуться.
    ticketCode: string | null = null,
  ): void {
    if (outcome.kind === 'merge') {
      const params = new URLSearchParams({
        token: outcome.mergeToken,
        provider,
      });
      // Только когда правда теряется — параметр без значения true/false,
      // чтобы отсутствие читалось как «нечего терять», а не как «неизвестно».
      if (outcome.twoFactorLost) params.set('twofa', '1');
      res.redirect(`${frontendBase}/account/merge?${params.toString()}`);
      return;
    }
    if (outcome.kind === 'totp_challenge') {
      // Билет доживает до второго шага (после кода 2FA) — иначе человек с
      // включённой двухфакторкой упёрся бы в тупик до истечения билета.
      const tail = ticketCode
        ? `&ticket=${encodeURIComponent(ticketCode)}`
        : '';
      res.redirect(
        `${frontendBase}/auth/2fa?token=${encodeURIComponent(outcome.challengeToken)}${tail}`,
      );
      return;
    }
    // crossSite:false — OAuth-редирект (VK) приходит
    // top-level навигацией на наш домен, не iframe (setRefreshCookie заодно
    // чистит метку refresh_cross от возможной прежней MAX-сессии, правило №5).
    setRefreshCookie(res, outcome.tokens.refreshToken, 30 * 24 * 3600, false);
    // Билет НЕ одобряем молча (device-code phishing, 2026-08-31): код в
    // `?ticket=` мог подставить кто угодно. Уже вошедшего уводим на экран
    // сверки `/auth/confirm` для ЯВНОГО подтверждения. Без билета — обычный приём сессии.
    // Токена в адресе нет (login-CSRF, аудит 2026-11): сессию фронт берёт refresh-ом по куке.
    res.redirect(
      ticketCode
        ? `${frontendBase}/auth/confirm?code=${encodeURIComponent(ticketCode)}`
        : `${frontendBase}/auth/callback`,
    );
  }

  // linkUserId в link-флоу едет через ПОДПИСАННЫЙ носитель (OAuth-`state`) —
  // неподписанный давал захват аккаунта (крипта/разбор в oauth-state.ts, C1).
  private stateSecret(): string {
    return this.config.getOrThrow<string>('JWT_SECRET');
  }
  linkUserIdFromState(state: string): bigint | null {
    return readOAuthState(this.stateSecret(), state);
  }
  buildLinkState(
    linkUserId: bigint | null,
    ticketCode?: string | null,
  ): string {
    return signOAuthState(this.stateSecret(), linkUserId, ticketCode ?? null);
  }
  ticketFromState(state: string): string | null {
    return readOAuthTicket(this.stateSecret(), state);
  }
  readLinkState(raw: string | null | undefined): bigint | null {
    return readOAuthState(this.stateSecret(), raw);
  }

  // ─── OAuth helpers ────────────────────────────────────────────────────────
  // Новый провайдер: файл + регистрация + свои @Get(id), @Get(id + '/callback')
  // (не Get(':provider') — затенил бы /me, /refresh) + env в oauth-provider-switch.

  oauthRedirect(provider: string, req: Request, res: Response): void {
    const handler = this.providers.get(provider);
    if (!handler.buildAuthUrl)
      throw new BadRequestException(
        `Provider ${provider} doesn't support OAuth`,
      );
    const off = disabledProviderRedirect(provider, this.config); // env снят — не 500
    if (off) return res.redirect(off);
    // Алиас-домен (kotlarewski.gr) отдаёт /api/auth/*, но колбэк провайдера
    // всегда на канонический хост — кука здесь не увидится (2026-09-08).
    // Только АНОНИМНЫЙ вход: у привязки кука link_token/сессия на текущем
    // хосте, редирект превратил бы её во вход под другим аккаунтом (2026-08-21).
    const linkUserId = linkCookieUserId(req); // S12: только кука link_token
    if (
      linkUserId == null &&
      redirectToCallbackHost(req, res, this.callbackOrigin(handler))
    )
      return;
    // `?ticket=` ставит контейнер, начавший вход у себя (ярлык, вкладка).
    // Дальше код едет внутри подписи, а не в открытом query.
    const ticket =
      typeof req.query?.ticket === 'string' ? req.query.ticket : null;
    const state = this.buildLinkState(linkUserId, ticket);
    setOAuthCookie(res, OAUTH_STATE_COOKIE, state);
    // Привязка (есть webUser) — выбор аккаунта явно, вход — одним касанием (см.
    // buildAuthUrl). nonce — секрет шага 1 в куке (PKCE VK, аудит 2026-11 S21).
    const force = linkUserId != null;
    res.redirect(handler.buildAuthUrl(state, handler.issueNonce?.(res), force));
  }

  // Хост колбэка провайдера; фолбэк WEBAPP_URL — для verifyClientData-флоу без callbackOrigin.
  private callbackOrigin(handler: AuthProviderHandler): string {
    return (
      handler.callbackOrigin?.() ??
      new URL(this.config.getOrThrow<string>('WEBAPP_URL')).origin
    );
  }
}
