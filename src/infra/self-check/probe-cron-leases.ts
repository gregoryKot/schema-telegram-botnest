import type { PrismaService } from '../../prisma/prisma.service';
import { lastClaimDbFailureAt } from '../cron-claim-failures';
import { expectedLeases } from './cron-lease-expected';
import { leaseRowProblem } from './cron-lease-done';
import { syncProcessLives } from './process-lives';
import { Probe } from './types';

const PROCESS_STARTED_AT = Date.now();
/** Каждая leader-аренда (cron-lease-registry.ts): не пропустил ли крон два тика
 * подряд в зоне ответственности (cron-lease-verdict.ts, process-lives.ts) и
 * дошёл ли до конца захваченный прогон (cron-lease-done.ts). Зависимости —
 * параметры по умолчанию: спеку не нужно глобальное состояние. */
export function cronLeasesProbe(
  prisma: PrismaService,
  startedAt: number = PROCESS_STARTED_AT,
  lastDbFailureAt: (name: string) => number | undefined = lastClaimDbFailureAt,
): Probe {
  return {
    id: 'cronLeases',
    title: 'Крон-аренды',
    async run() {
      const names = expectedLeases(); // крон за выключенной фичей не судим
      const now = Date.now();
      const me = { startedAt, now, failures: names.map(lastDbFailureAt) };
      const earlier = await syncProcessLives(prisma, me); // прошлые процессы
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
          earlier,
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
