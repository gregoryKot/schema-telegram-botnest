// Часть выгрузки «данные обо мне на стороне терапевта» (A-10, аудит 2026-10):
// модели, ключ которых clientId. Решения — в export-policy.client.ts.
import { Prisma } from '@prisma/client';
import { decryptRecord } from '../utils/crypto';
import {
  assertClientExportSynced,
  CLIENT_EXPORT_POLICY,
} from './export-policy.client';

type Row = Record<string, unknown>;
type ClientDelegate = {
  findMany(args: {
    where: { clientId: bigint };
    select: Record<string, true>;
  }): Prisma.PrismaPromise<Row[]>;
};

export interface ClientSideExport {
  data: Record<string, Row[]>;
  withheld: { table: string; reason: string }[];
}

/** Строки, где человек — клиент, и список того, что осознанно не отдано. */
export async function exportClientSide(
  prisma: unknown,
  userId: bigint,
): Promise<ClientSideExport> {
  assertClientExportSynced();
  const data: Record<string, Row[]> = {};
  const withheldTables: string[] = [];
  const reasons: string[] = [];
  for (const [model, decision] of Object.entries(CLIENT_EXPORT_POLICY)) {
    if (decision.status === 'withhold') {
      withheldTables.push(model);
      reasons.push(decision.reason);
      continue;
    }
    // Индексируем через Record — как в data-export.service.ts (unbound-method).
    const delegate = (prisma as Record<string, ClientDelegate>)[
      model[0].toLowerCase() + model.slice(1)
    ];
    const rows = await delegate.findMany({
      where: { clientId: userId },
      select: decision.select,
    });
    const schema = decision.schema;
    data[model] = schema ? rows.map((r) => decryptRecord(r, schema)) : rows;
  }
  return {
    data,
    // Одной строкой в `withheld`, как и раньше: человеку важно «что и почему».
    withheld: withheldTables.length
      ? [{ table: withheldTables.join(', '), reason: reasons.join('; ') }]
      : [],
  };
}
