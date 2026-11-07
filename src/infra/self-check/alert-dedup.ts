// Решение «слать ли владельцу DM самопроверки» — в базе, а не в памяти
// процесса (инцидент 2026-11-07, docs/INCIDENTS.md). Трекер в памяти терялся на
// каждом деплое: новый процесс через минуту делал прогон post-deploy, видел то
// же красное и слал тот же DM заново — 07.11 три одинаковых DM за 15 минут
// (деплои 02:17, 02:24, 02:32). Во время деплоя живут два инстанса, и у
// каждого была своя память.
//
// Механика — аренда `CronLease` (CronLeaderService, атомарный захват на живом
// Postgres — test/cron-leader.e2e-spec.ts): имя `self-check-alert:<id упавших
// проб через запятую>`, окно — ритм напоминания. Захватил — DM; не захватил —
// об этом наборе уже сообщили за последние 6 ч (этот процесс, прошлый или
// соседний). Другой набор упавших — другое имя, то есть новый DM. Зелёный
// прогон удаляет все такие строки и сообщает «снова зелёная», если было о чём:
// следующий такой же сбой алертит сразу. Проба cronLeases судит только имена
// из CRON_LEASE_REGISTRY — эти строки ей не мешают.
//
// База недоступна — решение откатывается на трекер в памяти процесса
// (alert-tracker.ts): во время аварии базы алерт нужнее всего.
import { Logger } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CronLeaderService } from '../cron-leader.service';
import type { SelfCheckResultEntry } from './state';
import {
  formatSelfCheckAlert,
  REMIND_EVERY_MS,
  SELF_CHECK_RECOVERED,
  SelfCheckAlertTracker,
} from './alert-tracker';

export const ALERT_LEASE_PREFIX = 'self-check-alert:';

const logger = new Logger('SelfCheckAlertDedup');

/** Имя аренды набора упавших проб — не зависит от порядка проб в реестре. */
export function alertLeaseName(failed: SelfCheckResultEntry[]): string {
  return (
    ALERT_LEASE_PREFIX +
    failed
      .map((f) => f.id)
      .sort()
      .join(',')
  );
}

/** Где записано, о каком наборе уже сообщили. Оба метода бросают, если база
 * недоступна, — молча ответить «уже сообщили» значило бы потерять алерт. */
export interface AlertLeaseStore {
  /** true — этот прогон первым за окно сообщает о таком наборе. */
  claim(name: string, windowMs: number): Promise<boolean>;
  /** Удалить все строки алертов; сколько было. */
  clearAll(): Promise<number>;
}

export function alertLeaseStore(
  cronLeader: Pick<CronLeaderService, 'claimRunOrThrow'>,
  prisma: Pick<PrismaService, 'cronLease'>,
): AlertLeaseStore {
  return {
    claim: (name, windowMs) => cronLeader.claimRunOrThrow(name, windowMs),
    clearAll: async () => {
      const { count } = await prisma.cronLease.deleteMany({
        where: { name: { startsWith: ALERT_LEASE_PREFIX } },
      });
      return count;
    },
  };
}

/**
 * Текст DM по итогам прогона или null — молчать.
 *
 * `memory` — запасной трекер. Он ведёт только то, что этот процесс сказал
 * владельцу БЕЗ базы: «снова зелёная» после такого алерта нужна, даже если
 * строк в базе нет. Решение по базе его не трогает — иначе отказ базы
 * посреди красного проглотил бы алерт об отказе базы.
 */
export async function decideSelfCheckAlert(
  failed: SelfCheckResultEntry[],
  store: AlertLeaseStore,
  memory: SelfCheckAlertTracker,
): Promise<string | null> {
  try {
    if (failed.length === 0) {
      const toldFromMemory = memory.isOpen;
      const cleared = await store.clearAll();
      memory.reset();
      return cleared > 0 || toldFromMemory ? SELF_CHECK_RECOVERED : null;
    }
    const first = await store.claim(alertLeaseName(failed), REMIND_EVERY_MS);
    return first ? formatSelfCheckAlert(failed) : null;
  } catch (err) {
    // warn, не error: error ушёл бы в AlertLogger вторым DM поверх этого.
    logger.warn(
      `Дедуп алерта самопроверки через базу не удался — решаю по памяти процесса: ${(err as Error)?.message?.slice(0, 120)}`,
    );
    return memory.noteResult(failed);
  }
}
