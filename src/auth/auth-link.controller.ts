// Привязка и отвязка способа входа к уже вошедшему аккаунту. Вынесено из
// auth-account.controller.ts (правило №10: тот у потолка), когда сюда сел
// step-up (S12, аудит 2026-11): 15 минут украденного access-токена больше не
// превращаются в вечный доступ — нужен код 2FA или свежий вход (step-up.ts),
// а владелец получает письмо или сообщение бота о новом способе входа.
import {
  BadRequestException,
  Body,
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
import { MergeService } from './merge.service';
import type { LinkProviderResult } from './merge-summary.types';
import { AuthProviderRegistry } from './providers/registry';
import { SecurityLogService } from './security-log.service';
import { SecurityNoticeService } from './security-notice.service';
import { StepUpGuard } from './step-up';

@Controller('api/auth')
export class AuthLinkController {
  constructor(
    private readonly auth: AuthService,
    private readonly providers: AuthProviderRegistry,
    private readonly merge: MergeService,
    private readonly securityLog: SecurityLogService,
    private readonly notice: SecurityNoticeService,
  ) {}

  // Telegram-виджет → существующий аккаунт. Лимит кодовый: ручка проверяет
  // код 2FA (через StepUpGuard).
  @Post('link/:provider')
  @UseGuards(JwtAuthGuard, StepUpGuard)
  @PersistentThrottleLimit(CODE_THROTTLE)
  @HttpCode(200)
  async linkProvider(
    @Param('provider') provider: string,
    // Не DTO: подписанный Telegram-payload, whitelist срежет поля и сломает hash-верификацию.
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<LinkProviderResult> {
    const handler = this.providers.get(provider);
    if (!handler.verifyClientData) {
      throw new BadRequestException(
        `Provider ${provider} doesn't support direct linking — use OAuth flow`,
      );
    }
    const identity = handler.verifyClientData(body);
    const userId = req.webUser!.userId;

    const result = await this.auth.linkProviderToUser(
      userId,
      provider,
      identity.providerId,
      identity.displayName,
      identity.email,
    );
    if (result.ok) {
      this.securityLog.log('provider_linked', { userId, provider, ip: req.ip });
      this.notice.linked(userId, provider);
      return { ok: true };
    }

    // Conflict — give the UI a merge token.
    const sourceId = BigInt(result.conflictUserId);
    const mergeToken = this.auth.buildMergeToken(
      userId,
      sourceId,
      provider,
      identity.providerId,
    );
    const s = await this.merge.summarize(sourceId, userId);
    const { counts: summary, twoFactorLost } = s;
    return { merge: true, mergeToken, summary, twoFactorLost };
  }

  @Post('unlink/:provider')
  @UseGuards(JwtAuthGuard, StepUpGuard)
  @PersistentThrottleLimit(CODE_THROTTLE)
  @HttpCode(200)
  async unlink(
    @Param('provider') provider: string,
    @Req() req: Request,
  ): Promise<{ ok: boolean }> {
    if (!this.providers.list().some((p) => p.id === provider)) {
      throw new BadRequestException('Unknown provider');
    }
    const userId = req.webUser!.userId;
    await this.auth.unlinkProvider(userId, provider);
    this.securityLog.log('provider_unlinked', { userId, provider, ip: req.ip });
    this.notice.notify(userId, { kind: 'provider_unlinked', provider });
    return { ok: true };
  }
}
