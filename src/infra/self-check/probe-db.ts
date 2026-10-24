import type { PrismaService } from '../../prisma/prisma.service';
import { Probe } from './types';

/**
 * БД отвечает на настоящий запрос через настоящий Prisma-драйвер.
 * `count()` вместо `$queryRaw` — не потому что раздражает гейт
 * check-raw-sql-live.mjs, а потому что обычный ORM-вызов — тот же живой
 * запрос к Postgres и не добавляет новый сырой SQL, который надо было бы
 * доказывать на живой базе (правило №18 CLAUDE.md) — health.controller.ts
 * уже это доказывает для `$queryRaw SELECT 1`.
 */
export function dbProbe(prisma: PrismaService): Probe {
  return {
    id: 'db',
    title: 'База данных',
    critical: true,
    async run() {
      try {
        await prisma.cronLease.count();
        return { ok: true, detail: 'отвечает' };
      } catch (e) {
        return {
          ok: false,
          detail: (e as Error)?.message?.slice(0, 200) ?? 'не отвечает',
        };
      }
    },
  };
}
