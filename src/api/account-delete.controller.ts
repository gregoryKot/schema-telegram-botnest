import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { uid } from './request-utils';
import { PersistentThrottle } from './persistent-throttle.decorator';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { AccountService } from '../bot/account.service';
import { TotpService } from '../auth/totp.service';
import { SecurityLogService } from '../auth/security-log.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

/** Машиночитаемая причина 403 — по ней фронт показывает поле для кода. */
export const TOTP_REQUIRED = 'totp_required';

// Hard-delete аккаунта вынесен из api.controller.ts (правило №10: тот файл на
// baseline-потолке, а сюда сел второй фактор).
//
// B-13 аудита 2026-10: DELETE /api/user сносил всё под одним access-токеном —
// тем самым, что на 15 минут оказывается у любого, кто увёл сессию. Шаг
// «второй фактор» стоит именно у необратимого действия (экспорт остаётся
// однофакторным: держатель сессии и так видит эти же данные в интерфейсе).
// Код проверяем так же, как у merge (assertSourceTotp): и «кода нет», и «код не
// подошёл» — один и тот же отказ.
@Controller('api')
@UseGuards(TelegramAuthGuard)
export class AccountDeleteController {
  constructor(
    private readonly accountService: AccountService,
    private readonly totp: TotpService,
    private readonly securityLog: SecurityLogService,
  ) {}

  // Лимит как у остальных ручек, проверяющих код 2FA (H1 аудита 2026-10):
  // шестизначный код без собственного лимита подбирается за сутки, а счётчик в
  // памяти обходится сменой инстанса (правило №5).
  @Delete('user')
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 20, ttl: 3_600_000 },
  })
  @PersistentThrottle()
  async deleteUser(
    @Req() req: AuthRequest,
    @Body() dto: DeleteAccountDto,
  ): Promise<{ ok: true }> {
    const userId = uid(req);
    if (await this.totp.isEnabled(userId)) {
      const ok = dto?.code
        ? await this.totp.verifyCode(userId, dto.code)
        : false;
      if (!ok) {
        // Неверный код — след в логах (как у 2fa-ручек), не DM: опечатка — шум.
        if (dto?.code)
          this.securityLog.log('totp_failed', {
            userId,
            ip: req.ip,
            route: 'DELETE user',
          });
        throw new ForbiddenException({
          message: 'Нужен код двухфакторной защиты',
          reason: TOTP_REQUIRED,
        });
      }
    }
    await this.accountService.deleteAllUserData(userId);
    // Только лог, не DM: законное удаление — не повод будить владельца.
    this.securityLog.log('account_deleted', { userId, ip: req.ip });
    return { ok: true };
  }
}
