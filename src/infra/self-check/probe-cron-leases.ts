import type { PrismaService } from '../../prisma/prisma.service';
import { CRON_LEASE_WINDOW_KEY, maxLeaseAgeMs } from './cron-lease-registry';
import { Probe } from './types';

const PROCESS_STARTED_AT = Date.now();

/**
 * Каждая leader-аренда из cron-lease-registry.ts обязана была тикнуть за
 * последние 2 периода своего крона (класс «крон молча не тикает», правило
 * №17 CLAUDE.md). Аренды, которых ещё вообще не может быть (например,
 * суточный крон в первый час жизни процесса), не считаются сбоем.
 */
export function cronLeasesProbe(
  prisma: PrismaService,
  startedAt: number = PROCESS_STARTED_AT,
): Probe {
  return {
    id: 'cronLeases',
    title: 'Крон-аренды',
    critical: false,
    async run() {
      const names = Object.keys(CRON_LEASE_WINDOW_KEY);
      const now = Date.now();
      const rows = await prisma.cronLease.findMany({
        where: { name: { in: names } },
        select: { name: true, runAt: true },
      });
      const byName = new Map(rows.map((r) => [r.name, r.runAt.getTime()]));
      const stale: string[] = [];
      for (const name of names) {
        const maxAge = maxLeaseAgeMs(name) ?? Infinity;
        const runAt = byName.get(name);
        if (runAt === undefined) {
          if (now - startedAt > maxAge)
            stale.push(`${name}: ни разу не отработал`);
          continue;
        }
        if (now - runAt > maxAge) {
          stale.push(
            `${name}: последний раз ${Math.round((now - runAt) / 60_000)} мин назад`,
          );
        }
      }
      return stale.length === 0
        ? { ok: true, detail: `все ${names.length} аренды свежие` }
        : { ok: false, detail: stale.join('; ') };
    },
  };
}
