// Итог миграции клинических меток как наблюдаемый факт (аудит 2026-10,
// «Долг с механизмом»): раньше строки под неизвестным ключом шли в
// console.warn, а итог с row-failures — в logger.warn, который AlertLogger не
// алертит. Миграция идемпотентна и повторяется на каждом старте, но об остатке
// незашифрованных меток никто не узнавал. Холдер — общий на процесс синглтон
// (приём polling-status.ts): миграцию пишет runClinicalLabelMigration из
// main.ts, проба читает, DI между ними не нужен.
import type { PrismaService } from '../../prisma/prisma.service';
import {
  migrateClinicalLabels,
  type ClinicalMigrationResult,
} from '../../utils/encrypt-migration';

export type ClinicalLabelsState = 'idle' | 'running' | 'done' | 'failed';

export interface ClinicalLabelsSnapshot {
  state: ClinicalLabelsState;
  /** Строки под нечитаемым ключом, по таблицам. Только счётчики. */
  unknownKey: Record<string, number>;
  /** Сколько строк не удалось записать. */
  failures: number;
  /** Сколько строк зашифровано за прогон. */
  encrypted: number;
  /** Сообщение исключения (без содержимого строк). */
  lastError: string | null;
  finishedAt: number | null;
}

const initial = (): ClinicalLabelsSnapshot => ({
  state: 'idle',
  unknownKey: {},
  failures: 0,
  encrypted: 0,
  lastError: null,
  finishedAt: null,
});

class ClinicalLabelsStatusHolder {
  private snapshot = initial();

  start(): void {
    this.snapshot = { ...initial(), state: 'running' };
  }

  finish(result: ClinicalMigrationResult, now: number = Date.now()): void {
    this.snapshot = {
      state: 'done',
      unknownKey: result.unknownKey,
      failures: result.failures,
      encrypted: Object.values(result.encrypted).reduce((a, b) => a + b, 0),
      lastError: null,
      finishedAt: now,
    };
  }

  fail(message: string, now: number = Date.now()): void {
    this.snapshot = {
      ...initial(),
      state: 'failed',
      lastError: message,
      finishedAt: now,
    };
  }

  get(): ClinicalLabelsSnapshot {
    return this.snapshot;
  }

  /** Сброс между тестами. */
  reset(): void {
    this.snapshot = initial();
  }
}

export const clinicalLabelsStatus = new ClinicalLabelsStatusHolder();

/**
 * Запуск миграции из main.ts: пишет итог в холдер, исключение превращает в
 * logger.error (уходит владельцу через AlertLogger) и наружу не пробрасывает —
 * миграция не блокирует старт.
 */
export async function runClinicalLabelMigration(
  prisma: PrismaService,
  logger: { error(message: string): void },
): Promise<void> {
  clinicalLabelsStatus.start();
  try {
    clinicalLabelsStatus.finish(await migrateClinicalLabels(prisma));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    clinicalLabelsStatus.fail(message);
    logger.error(`Clinical-label migration failed: ${message}`);
  }
}
