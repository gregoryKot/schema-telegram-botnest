import type { PrismaService } from '../../prisma/prisma.service';
import { lastClaimDbFailureAt } from '../cron-claim-failures';
import { expectedLeases } from './cron-lease-expected';
import { leaseRowProblem } from './cron-lease-done';
import { Probe } from './types';

const PROCESS_STARTED_AT = Date.now();

/**
 * Каждая leader-аренда из cron-lease-registry.ts: не пропустил ли её крон два
 * тика подряд (cron-lease-verdict.ts; тики до старта процесса и во время
 * аварии базы не судятся — 2026-09-16 и 2026-10-17, docs/INCIDENTS.md) и дошёл
 * ли до конца захваченный прогон (cron-lease-done.ts). Зависимости — явные
 * параметры со значениями по умолчанию: спеку не нужно глобальное состояние.
 */
export function cronLeasesProbe(
  prisma: PrismaService,
  startedAt: number = PROCESS_STARTED_AT,
  lastDbFailureAt: (name: string) => number | undefined = lastClaimDbFailureAt,
): Probe {
  return {
    id: 'cronLeases',
    title: 'Крон-аренды',
    critical: false,
    async run() {
      const names = expectedLeases(); // крон за выключенной фичей не судим
      const now = Date.now();
      const rows = await prisma.cronLease.findMany({
        where: { name: { in: names } },
        select: { name: true, runAt: true, doneRunAt: true },
      });
      const byName = new Map(rows.map((r) => [r.name, r]));
      const problems: string[] = [];
      for (const name of names) {
        const problem = leaseRowProblem(name, byName.get(name), {
          now,
          startedAt,
          lastDbFailureAt: lastDbFailureAt(name),
        });
        if (problem) problems.push(`${name}: ${problem}`);
      }
      return problems.length === 0
        ? {
            ok: true,
            detail: `все ${names.length} кронов тикают по расписанию`,
          }
        : { ok: false, detail: problems.join('; ') };
    },
  };
}
