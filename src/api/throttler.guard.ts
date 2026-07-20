import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: {
    telegramUserId?: number;
    ip?: string;
    headers?: Record<string, string | string[] | undefined>;
  }): Promise<string> {
    return Promise.resolve(this.resolveTracker(req));
  }

  private resolveTracker(req: {
    telegramUserId?: number;
    ip?: string;
    headers?: Record<string, string | string[] | undefined>;
  }): string {
    // req.telegramUserId is set by TelegramAuthGuard which runs AFTER this guard.
    // Extract userId eagerly from the raw headers so throttling is per-user, not per-IP.
    if (req.telegramUserId) return `uid:${req.telegramUserId}`;

    // ВАЖНО (аудит 2026-07, S-1): ниже идентификаторы извлекаются из ЕЩЁ НЕ
    // ВЕРИФИЦИРОВАННЫХ кредов (подпись проверит auth-гард позже). Бакет только
    // по uid обходился ротацией фейкового `sub`/`user.id` — свежий бакет на
    // каждый запрос, per-IP лимит не срабатывал. Поэтому неверифицированные
    // идентификаторы всегда скованы с IP: ротация sub больше не даёт новых
    // бакетов, а легитимные юзеры за NAT не делят один общий IP-бакет.
    const ip = req.ip ?? 'unknown';

    // JWT Bearer — decode payload without verification (bucketing only, not auth)
    const auth = req.headers?.['authorization'] as string | undefined;
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = JSON.parse(
          Buffer.from(auth.slice(7).split('.')[1], 'base64url').toString(),
        ) as { sub?: string | number };
        if (payload.sub) return `uid:${payload.sub}|ip:${ip}`;
      } catch {
        /* fall through */
      }
    }

    // Telegram initData — extract user.id from the URL-encoded string
    const initData = req.headers?.['x-telegram-init-data'] as
      | string
      | undefined;
    if (initData) {
      try {
        const user = JSON.parse(
          new URLSearchParams(initData).get('user') ?? '{}',
        ) as { id?: string | number };
        if (user.id) return `uid:${user.id}|ip:${ip}`;
      } catch {
        /* fall through */
      }
    }

    return ip;
  }
}
