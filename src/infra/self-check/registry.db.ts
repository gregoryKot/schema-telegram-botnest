import type { PrismaService } from '../../prisma/prisma.service';
import { Probe } from './types';
import { throttleStorageProbe } from './probe-throttle-storage';
import { cronLeasesProbe } from './probe-cron-leases';
import { robokassaProbes } from './probe-robokassa';
import { encryptionReadableProbe } from './probe-encryption-readable';

/** Пробы, спрашивающие нашу БД (кроме соединения — его проверяет dbProbe). */
export function dbBackedProbes(prisma: PrismaService): Probe[] {
  return [
    throttleStorageProbe(prisma),
    cronLeasesProbe(prisma),
    encryptionReadableProbe(prisma),
    ...robokassaProbes(prisma),
  ];
}
