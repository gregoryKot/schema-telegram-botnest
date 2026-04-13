import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Track by authenticated userId; fall back to IP for unauthenticated requests
    return req.telegramUserId ? `uid:${req.telegramUserId}` : (req.ip ?? 'unknown');
  }
}
