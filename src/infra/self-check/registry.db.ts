import type { PrismaService } from '../../prisma/prisma.service';
import { Probe } from './types';
import { throttleStorageProbe } from './probe-throttle-storage';
import { cronLeasesProbe } from './probe-cron-leases';
import { robokassaProbes } from './probe-robokassa';

/**
 * Пробы, которые спрашивают нашу собственную БД (кроме самого соединения —
 * его проверяет dbProbe). Вынесены из registry.ts: тот под храповиком размера.
 */
export function dbBackedProbes(prisma: PrismaService): Probe[] {
  return [
    throttleStorageProbe(prisma),
    cronLeasesProbe(prisma),
    ...robokassaProbes(prisma),
  ];
}
