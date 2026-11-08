import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { MaxProvider } from '../auth/providers/max.provider';
import { SecurityLogService } from '../auth/security-log.service';
import { applyTelegramInitData, applyMaxInitData } from './init-data-paths';
import { reportAuthFailure } from './auth-failure.report';
import { reportAuthSuccess } from './auth-success.report';
import { assertLiveAccess } from '../auth/live-access';
import { AnalyticsService } from '../analytics/analytics.service';
import type { Request } from 'express';

// Unified guard: accepts Telegram initData (mini-app / bot), MAX initData
// (MAX mini-app), OR JWT Bearer (web app). Sets req.webUser.userId (bigint) —
// контроллеры читают его через uid(req). Telegram/MAX path bodies live in
// ./init-data-paths.ts to keep this file under the file-size ratchet.
@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly logger = new Logger(TelegramAuthGuard.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly securityLog: SecurityLogService,
    private readonly maxProvider: MaxProvider,
    private readonly analytics: AnalyticsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    // ── Path 1: JWT Bearer (web app) ─────────────────────────────────────────
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { userId, sid } = this.authService.verifyAccessToken(token);
      // Строка веб-юзера создаётся при входе, ДО выдачи токена. Здесь только
      // сверяем, что аккаунт и сессия ещё живы (live-access.ts). Прежний upsert
      // ВОСКРЕШАЛ строку по устаревшему токену: у удалённого появлялась пустая
      // зомби-строка (обход права на удаление), а слитый юзер застревал на
      // исчезнувшем исходном id (разбор 2026-08-31). 401 → клиент рефрешит:
      // refresh-кука слитого уже переехала на целевой userId.
      await assertLiveAccess(this.prisma, userId, sid);
      req.webUser = { userId };
      reportAuthSuccess(userId, 'web', {
        track: (meta) => void this.analytics.track(null, 'auth_success', meta),
      });
      return true;
    }

    // ── Path 2: Telegram initData (mini-app) ─────────────────────────────────
    if (req.headers['x-telegram-init-data']) {
      await applyTelegramInitData(
        req,
        this.config,
        this.authService,
        this.securityLog,
        this.logger,
        this.analytics,
      );
      return true;
    }

    // ── Path 3: MAX initData (MAX mini-app) ──────────────────────────────────
    if (req.headers['x-max-init-data']) {
      await applyMaxInitData(
        req,
        this.maxProvider,
        this.authService,
        this.securityLog,
        this.logger,
        this.analytics,
      );
      return true;
    }

    // ── Отказ ────────────────────────────────────────────────────────────────
    // Пустой заголовок подписи проваливается сюда (falsy) — и до 2026-08-08
    // эта ветка молчала: вход был сломан у всех пользователей Telegram, а на
    // сервере это выглядело как обычный неавторизованный запрос. Теперь
    // «мессенджер открыт, а подписи нет» отделено от фонового шума и слышно.
    reportAuthFailure(req.headers, req.ip, {
      logger: this.logger,
      securityLog: this.securityLog,
      track: (meta) => {
        void this.analytics.track(null, 'auth_rejected', meta);
      },
    });
    throw new UnauthorizedException('Missing authentication');
  }
}
