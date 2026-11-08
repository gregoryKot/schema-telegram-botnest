// Повторная проверка перед привязкой и отвязкой способа входа (S12, аудит
// 2026-11): 15 минут украденного access-токена не должны превращаться в
// постоянный доступ через новый способ входа.
//
// Правило: включён TOTP — нужен код в заголовке `x-totp-code` (тело у этих
// ручек занято подписанным payload Telegram или пустое). TOTP не включён —
// пропускаем: «свежий вход» нечем доказать в iframe мессенджеров (MAX,
// Telegram Web) — refresh-кука туда не доходит; осознанно не сделано,
// docs/open/security.md. Таким аккаунтам остаётся уведомление о привязке.
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { REFRESH_COOKIE, getCookie } from './auth-http.util';
import { SecurityLogService } from './security-log.service';
import { TotpService } from './totp.service';

export const STEP_UP_HEADER = 'x-totp-code';
/** Та же строка, что у удаления аккаунта (api/account-delete.controller.ts). */
export const STEP_UP_TOTP_REASON = 'totp_required';

/**
 * К какому аккаунту привязывать на редиректе OAuth/Telegram: только кука
 * link_token, которую выдаёт `link-token` после step-up (S12). Bearer на
 * GET-навигацию браузер не ставит — его присылает лишь скрипт с украденным
 * токеном, и такой запрос идёт как обычный вход, а не привязка.
 */
export function linkCookieUserId(req: Request): bigint | null {
  return req.webUser?.viaLinkToken ? req.webUser.userId : null;
}

/** Сырой refresh-токен этого браузера (кука path=/api/auth). */
export function refreshCookieOf(req: Request): string | undefined {
  return getCookie(req, REFRESH_COOKIE);
}

/** Код из заголовка: 6 цифр TOTP или 10 hex резервного; иное — нет кода. */
export function stepUpCode(req: Request): string | null {
  const raw = req.headers?.[STEP_UP_HEADER];
  const v = typeof raw === 'string' ? raw.trim() : '';
  return /^[0-9A-Za-z]{6,10}$/.test(v) ? v : null;
}

@Injectable()
export class StepUpService {
  constructor(
    private readonly totp: TotpService,
    private readonly securityLog: SecurityLogService,
  ) {}

  async assert(req: Request, userId: bigint): Promise<void> {
    if (!(await this.totp.isEnabled(userId))) return;
    const code = stepUpCode(req);
    // verifyCode сам считает промах в счётчик аккаунта (S11) и бросает 429.
    if (code && (await this.totp.verifyCode(userId, code))) return;
    if (code)
      this.securityLog.log('totp_failed', {
        userId,
        ip: req.ip,
        route: req.path,
      });
    throw new ForbiddenException({
      message: 'Нужен код двухфакторной защиты',
      reason: STEP_UP_TOTP_REASON,
    });
  }

  /** Привязка по голому Bearer (не по куке link_token) — только со step-up. */
  async assertIfBearer(req: Request): Promise<void> {
    if (req.webUser && !req.webUser.viaLinkToken)
      await this.assert(req, req.webUser.userId);
  }
}

/** `@UseGuards(JwtAuthGuard, StepUpGuard)`: при включённом TOTP — его код. */
@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(private readonly stepUp: StepUpService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    // Ставится ПОСЛЕ JwtAuthGuard; без него — ошибка подключения, не доступ.
    if (!req.webUser) throw new UnauthorizedException('Missing session');
    await this.stepUp.assert(req, req.webUser.userId);
    return true;
  }
}
