import type { PrismaService } from '../../prisma/prisma.service';
import { Probe } from './types';
import { dbProbe } from './probe-db';
import { oauthRedirectsProbe, alertsProbe } from './probe-capabilities';
import { emailProbe } from './probe-email';
import { dbBackedProbes } from './registry.db';
import { liveIntegrationProbes } from './registry.live';

/** Полный набор проб самопроверки прода (правило №14 CLAUDE.md). */
export function buildProbes(prisma: PrismaService): Probe[] {
  return [
    dbProbe(prisma),
    oauthRedirectsProbe(),
    emailProbe(),
    alertsProbe(),
    ...dbBackedProbes(prisma),
    ...liveIntegrationProbes(),
  ];
}
