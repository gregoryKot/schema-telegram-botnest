import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { resolveTracker, type TrackerRequest } from './throttler-identity';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: TrackerRequest): Promise<string> {
    return Promise.resolve(
      resolveTracker(req, {
        jwtSecret: process.env.JWT_SECRET,
        botToken: process.env.BOT_TOKEN,
      }),
    );
  }
}
