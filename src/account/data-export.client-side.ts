// Часть выгрузки «данные обо мне на стороне терапевта» (A-10, аудит 2026-10):
// модели, ключ которых clientId. Решения — в export-policy.client.ts; `shown` —
// и строки (вид клиента), и строка в withheld о том, что осталось у терапевта.
import { Prisma, type ClientConceptualization } from '@prisma/client';
import { decryptExport } from './export-decrypt';
import {
  assertClientExportSynced,
  CLIENT_EXPORT_POLICY,
} from './export-policy.client';
import { clientConceptView } from '../therapy/client-concept-view';

type Row = Record<string, unknown>;
type ClientDelegate = {
  findMany(args: {
    where: { clientId: bigint };
    select: Record<string, true>;
  }): Prisma.PrismaPromise<Row[]>;
};
type ShownDelegate = {
  findMany(args: {
    where: { clientId: bigint; sharedWithClientAt: { not: null } };
  }): Prisma.PrismaPromise<ClientConceptualization[]>;
};

/** `shown`-модели: вид клиента — тот же, что отдаёт экран (что видит — то и выгружает). */
export const SHOWN_VIEWS: Record<
  string,
  (row: ClientConceptualization) => object | null
> = {
  ClientConceptualization: clientConceptView,
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
    // Индексируем через Record — как в data-export.service.ts (unbound-method).
    const key = model[0].toLowerCase() + model.slice(1);
    if (decision.status !== 'export') {
      withheldTables.push(model);
      reasons.push(decision.reason);
    }
    if (decision.status === 'withhold') continue;
    if (decision.status === 'shown') {
      const rows = await (prisma as Record<string, ShownDelegate>)[
        key
      ].findMany({
        where: { clientId: userId, sharedWithClientAt: { not: null } },
      });
      data[model] = rows
        .map((r) => SHOWN_VIEWS[model](r) as Row | null)
        .filter((v): v is Row => v !== null);
      continue;
    }
    const delegate = (prisma as Record<string, ClientDelegate>)[key];
    const rows = await delegate.findMany({
      where: { clientId: userId },
      select: decision.select,
    });
    const schema = decision.schema;
    data[model] = schema ? rows.map((r) => decryptExport(r, schema)) : rows;
  }
  return {
    data,
    // Одной строкой в `withheld`, как и раньше: человеку важно «что и почему».
    withheld: withheldTables.length
      ? [{ table: withheldTables.join(', '), reason: reasons.join('; ') }]
      : [],
  };
}
