// Вход через Google One Tap: id_token из браузера (без редиректа) → наша сессия.
// Отдельным сервисом: auth-flow.service у потолка размера (правило №10). Это
// ВХОД, не привязка (linkUserId всегда null): исход «сессия» или «нужен второй
// фактор». Токен привязан к браузеру nonce-кукой (google-one-tap-nonce.ts).
import { BadRequestException, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { AuthProviderRegistry } from './providers/registry';
import type { GoogleProvider } from './providers/google.provider';
import { AuthFlowService } from './auth-flow.service';
import { setRefreshCookie } from './auth-http.util';
import { clearOneTapNonce } from './google-one-tap-nonce';
import { AnalyticsService } from '../analytics/analytics.service';
import type { OneTapOutcome } from '../analytics/login-one-tap.constants';

/**
 * Что вернуть браузеру. `tokens` — сессия выдана (refresh уехал в куку, access
 * в теле). `twofa` — у аккаунта включён второй фактор: сессию пока не выдаём,
 * фронт уводит на /auth/2fa с этим токеном (как и редирект-флоу).
 */
export type OneTapLoginResult =
  | { accessToken: string; expiresIn: number }
  | { twofa: true; challengeToken: string };

@Injectable()
export class GoogleOneTapService {
  constructor(
    private readonly providers: AuthProviderRegistry,
    private readonly flow: AuthFlowService,
    private readonly analytics: AnalyticsService,
  ) {}

  // Правило №8: входы через окно видны в /stats (one-tap-metrics.format.ts).
  // userId = null, как у login_ticket_step: /api/event пишет с userId, и
  // подделка с клиента в отчёт не попадёт. track глотает свои ошибки сам.
  private report(outcome: OneTapOutcome): void {
    void this.analytics.track(null, 'login_one_tap', { outcome });
  }

  async login(
    credential: string,
    nonceCookie: string | undefined,
    res: Response,
    ip?: string,
    userAgent?: string,
  ): Promise<OneTapLoginResult> {
    const google = this.providers.get('google') as GoogleProvider;
    // Тот же верификатор, что у обмена кода (издатель/получатель/срок/подпись) +
    // nonce из куки; подделка/чужой aud/просрочка/нет nonce — Unauthorized.
    const identity = await google
      .verifyIdToken(credential, { nonceCookie })
      .catch((err: unknown) => {
        this.report('rejected'); // токен окна не принят — сам сбой летит дальше
        throw err;
      });
    clearOneTapNonce(res); // одноразовая: повтор того же токена не пройдёт

    // Всегда ВХОД (linkUserId=null): One Tap не привязывает второй аккаунт.
    const outcome = await this.flow.signInOrLinkOrMerge('google', identity, {
      linkUserId: null,
      ip,
      userAgent,
    });

    if (outcome.kind === 'totp_challenge') {
      this.report('twofa');
      return { twofa: true, challengeToken: outcome.challengeToken };
    }
    if (outcome.kind === 'tokens') {
      // crossSite:false — One Tap живёт в first-party JS на нашем origin, не в
      // iframe и не редиректом; кука обычная same-site (правило №5).
      setRefreshCookie(res, outcome.tokens.refreshToken, 30 * 24 * 3600, false);
      this.report('signed_in');
      return {
        accessToken: outcome.tokens.accessToken,
        expiresIn: outcome.tokens.expiresIn,
      };
    }
    // merge при linkUserId=null не наступает (это вход, а не привязка) — типы
    // это не гарантируют, поэтому явный отказ, а не молчаливая выдача.
    throw new BadRequestException('Unexpected outcome for one-tap login');
  }
}
