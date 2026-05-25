import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // req.telegramUserId is set by TelegramAuthGuard which runs AFTER this guard.
    // Extract userId eagerly from the raw headers so throttling is per-user, not per-IP.
    if (req.telegramUserId) return `uid:${req.telegramUserId}`;

    // JWT Bearer — decode payload without verification (bucketing only, not auth)
    const auth = req.headers?.['authorization'] as string | undefined;
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = JSON.parse(Buffer.from(auth.slice(7).split('.')[1], 'base64url').toString());
        if (payload?.sub) return `uid:${payload.sub}`;
      } catch { /* fall through */ }
    }

    // Telegram initData — extract user.id from the URL-encoded string
    const initData = req.headers?.['x-telegram-init-data'] as string | undefined;
    if (initData) {
      try {
        const user = JSON.parse(new URLSearchParams(initData).get('user') ?? '{}');
        if (user.id) return `uid:${user.id}`;
      } catch { /* fall through */ }
    }

    return req.ip ?? 'unknown';
  }
}
