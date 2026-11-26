import type { PrismaService } from '../../prisma/prisma.service';
import { Probe } from './types';
import { dbProbe } from './probe-db';
import { configProbes } from './registry.config';
import { dbBackedProbes } from './registry.db';
import { liveIntegrationProbes } from './registry.live';

/** Полный набор проб самопроверки прода (правило №14 CLAUDE.md). */
export function buildProbes(prisma: PrismaService): Probe[] {
  return [
    dbProbe(prisma),
    ...configProbes(),
    ...dbBackedProbes(prisma),
    ...liveIntegrationProbes(),
  ];
}
