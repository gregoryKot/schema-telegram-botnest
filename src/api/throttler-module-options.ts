import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { HybridThrottleStorage } from './hybrid-throttle-storage';
import { throttleErrorMessage } from './throttle-error-message';

// Вынесено из app.module.ts (правило №10). storage — HybridThrottleStorage:
// Postgres для `@PersistentThrottle()` (booking/donation/subscription —
// инцидент 2026-09-13), память процесса для остальных. errorMessage — текст
// 429 по-русски вместо «ThrottlerException…» (throttle-error-message.ts).
export function throttlerOptions(
  prisma: PrismaService,
): ThrottlerModuleOptions {
  return {
    throttlers: [
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'long', ttl: 60000, limit: 200 },
    ],
    storage: new HybridThrottleStorage(prisma),
    errorMessage: (_context, detail) => throttleErrorMessage(detail),
  };
}
