import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { resolveTracker, type TrackerRequest } from './throttler-identity';
import { trackerSecrets } from './throttler-tracker-secrets';
import { withPersistentPrefix } from './persistent-throttle.decorator';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: TrackerRequest): Promise<string> {
    return Promise.resolve(resolveTracker(req, trackerSecrets()));
  }

  // `db:`-префикс — денежные/заявочные ручки считает Postgres, не память.
  protected generateKey(c: ExecutionContext, s: string, n: string): string {
    return withPersistentPrefix(super.generateKey(c, s, n), this.reflector, c);
  }
}
