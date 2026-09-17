import type { PrismaService } from '../../prisma/prisma.service';
import { Probe } from './types';
import { dbProbe } from './probe-db';
import { telegramProbe } from './probe-telegram';
import { caldavProbe } from './probe-caldav';
import {
  oauthRedirectsProbe,
  emailProbe,
  alertsProbe,
} from './probe-capabilities';
import { throttleStorageProbe } from './probe-throttle-storage';
import { cronLeasesProbe } from './probe-cron-leases';

/** Полный набор проб самопроверки прода (правило №14 CLAUDE.md). */
export function buildProbes(prisma: PrismaService): Probe[] {
  return [
    dbProbe(prisma),
    telegramProbe(),
    caldavProbe(),
    oauthRedirectsProbe(),
    emailProbe(),
    alertsProbe(),
    throttleStorageProbe(prisma),
    cronLeasesProbe(prisma),
  ];
}
