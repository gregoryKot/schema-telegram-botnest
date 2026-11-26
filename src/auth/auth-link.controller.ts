// Отвязка способа входа от уже вошедшего аккаунта (привязка по подписи виджета
// Telegram, `POST link/:provider`, удалена в 2026-11 вместе со входом через
// Telegram на сайте; VK привязывается OAuth-колбэком, почта — письмом). Вынесено из
// auth-account.controller.ts (правило №10: тот у потолка), когда сюда сел
// step-up (S12, аудит 2026-11): 15 минут украденного access-токена больше не
// превращаются в вечный доступ — нужен код 2FA или свежий вход (step-up.ts),
// а владелец получает письмо или сообщение бота о новом способе входа.
import {
  BadRequestException,
  Controller,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PersistentThrottleLimit } from '../api/persistent-throttle-limit';
import { CODE_THROTTLE } from './auth-throttles';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { AuthProviderRegistry } from './providers/registry';
import { SecurityLogService } from './security-log.service';
import { SecurityNoticeService } from './security-notice.service';
import { StepUpGuard } from './step-up';

@Controller('api/auth')
export class AuthLinkController {
  constructor(
    private readonly auth: AuthService,
    private readonly providers: AuthProviderRegistry,
    private readonly securityLog: SecurityLogService,
    private readonly notice: SecurityNoticeService,
  ) {}

  @Post('unlink/:provider')
  @UseGuards(JwtAuthGuard, StepUpGuard)
  @PersistentThrottleLimit(CODE_THROTTLE)
  @HttpCode(200)
  async unlink(
    @Param('provider') provider: string,
    @Req() req: Request,
  ): Promise<{ ok: boolean }> {
    // Почта (magic link) и прежний вход через Google (убран 2026-11, строки
    // остались) — без обработчика в реестре, но отвязываются этой же ручкой.
    const email = provider === 'email';
    const listed = this.providers.list().some((p) => p.id === provider);
    if (!email && provider !== 'google' && !listed)
      throw new BadRequestException('Unknown provider');
    const userId = req.webUser!.userId;
    // Снятый адрес — до отвязки: письмо уходит и на него (хвост S12).
    const removed = email ? await this.notice.emailAddresses(userId) : [];
    await this.auth.unlinkProvider(userId, provider);
    this.securityLog.log('provider_unlinked', { userId, provider, ip: req.ip });
    const notice = { kind: 'provider_unlinked', provider } as const;
    this.notice.notify(userId, notice, removed);
    return { ok: true };
  }
}
