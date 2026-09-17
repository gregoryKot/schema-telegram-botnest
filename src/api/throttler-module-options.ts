import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { HybridThrottleStorage } from './hybrid-throttle-storage';

// Вынесено из app.module.ts (правило №10: файл упёрся в потолок
// файл-храповика — раздутый файл дробится, а не растёт дальше).
//
// storage — HybridThrottleStorage: Postgres для маршрутов с
// `@PersistentThrottle()` (booking/donation/subscription — инцидент
// 2026-09-13), память процесса для остальных, как было раньше.
export function throttlerOptions(
  prisma: PrismaService,
): ThrottlerModuleOptions {
  return {
    throttlers: [
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'long', ttl: 60000, limit: 200 },
    ],
    storage: new HybridThrottleStorage(prisma),
  };
}
