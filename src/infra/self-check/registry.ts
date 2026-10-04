import type { PrismaService } from '../../prisma/prisma.service';
import { Probe } from './types';
import { dbProbe } from './probe-db';
import {
  oauthRedirectsProbe,
  emailProbe,
  alertsProbe,
} from './probe-capabilities';
import { throttleStorageProbe } from './probe-throttle-storage';
import { cronLeasesProbe } from './probe-cron-leases';
import { liveIntegrationProbes } from './registry.live';

/** Полный набор проб самопроверки прода (правило №14 CLAUDE.md). */
export function buildProbes(prisma: PrismaService): Probe[] {
  return [
    dbProbe(prisma),
    oauthRedirectsProbe(),
    emailProbe(),
    alertsProbe(),
    throttleStorageProbe(prisma),
    cronLeasesProbe(prisma),
    ...liveIntegrationProbes(),
  ];
}
