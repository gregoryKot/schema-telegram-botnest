import type { PrismaService } from '../../prisma/prisma.service';
import { CRON_LEASE_REGISTRY, maxLeaseAgeMs } from './cron-lease-registry';
import { Probe } from './types';

const PROCESS_STARTED_AT = Date.now();

/**
 * Каждая leader-аренда из cron-lease-registry.ts обязана была тикнуть не
 * позже `maxLeaseAgeMs(name)` — порог считается из расписания крона
 * (cron-gap.ts), не из категории окна: иначе оконный `healthyAdultMorning`
 * (тикает только 09:00–10:55 МСК) сбоил бы почти круглосуточно (issue #501,
 * 2026-09-16, docs/INCIDENTS.md). Аренды, которых ещё вообще не может быть
 * (суточный крон в первый час жизни процесса), не считаются сбоем.
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
      const names = Object.keys(CRON_LEASE_REGISTRY);
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
