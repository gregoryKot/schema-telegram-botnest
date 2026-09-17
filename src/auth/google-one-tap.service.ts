// Вход через Google One Tap: нативная всплывашка Google отдаёт id_token прямо
// в браузер (без редиректа), фронт постит его сюда, а мы выдаём свою сессию.
//
// Зачем отдельным сервисом, а не в auth-flow.service: тот уже у потолка размера
// (правило №10 CLAUDE.md). Логика тонкая — проверить токен тем же
// верификатором, что и обмен кода, и переиспользовать общий signInOrLinkOrMerge,
// — но это ВХОД, не привязка (linkUserId всегда null), поэтому исход только
// «сессия» или «нужен второй фактор».
import { BadRequestException, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { AuthProviderRegistry } from './providers/registry';
import type { GoogleProvider } from './providers/google.provider';
import { AuthFlowService } from './auth-flow.service';
import { setRefreshCookie } from './auth-http.util';

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
  ) {}

  async login(
    credential: string,
    res: Response,
    ip?: string,
    userAgent?: string,
  ): Promise<OneTapLoginResult> {
    const google = this.providers.get('google') as GoogleProvider;
    // Тот же путь проверки, что и у обмена кода: издатель/получатель/срок и
    // подпись по JWKS. Подделка/чужой aud/просрочка — UnauthorizedException.
    const identity = await google.verifyIdToken(credential);

    // Всегда ВХОД (linkUserId=null): One Tap не привязывает второй аккаунт.
    const outcome = await this.flow.signInOrLinkOrMerge('google', identity, {
      linkUserId: null,
      ip,
      userAgent,
    });

    if (outcome.kind === 'totp_challenge') {
      return { twofa: true, challengeToken: outcome.challengeToken };
    }
    if (outcome.kind === 'tokens') {
      // crossSite:false — One Tap живёт в first-party JS на нашем origin, не в
      // iframe и не редиректом; кука обычная same-site (правило №5).
      setRefreshCookie(res, outcome.tokens.refreshToken, 30 * 24 * 3600, false);
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
