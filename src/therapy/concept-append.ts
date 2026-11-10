// «Дописать в концептуализацию с холста» (#963): холст «Графических карт»
// шлёт режимы, схемы, линии схема → режим и линии к потребностям, которые
// терапевт поставил на карту. Только добавление: сервер объединяет с тем, что
// уже лежит в полях, и ничего не удаляет (удаление с холста — про раскладку).
// Полного тела холст не шлёт, поэтому автосохранение вкладки «Концептуализация»
// и холст не перетирают друг другу то, чего каждый не видел. Связи — в
// concept-append-links.ts.
import type { PrismaService } from '../prisma/prisma.service';
import { inSerializableTx } from '../prisma/serializable-retry';
import type { TherapyRelationsService } from './therapy-relations.service';
import {
  conceptView,
  decryptConceptFields,
  encryptConceptFields,
  writeConceptWithHistory,
} from './concept-store';
import { conceptStale } from './concept-save';
import {
  linksOf,
  mergeModeLinks,
  mergeSchemaLinks,
  strings,
  union,
  type ModeLink,
  type ModeLinkAdd,
  type SchemaLink,
  type SchemaLinkAdd,
} from './concept-append-links';

export interface ConceptAppendInput {
  modeIds?: string[];
  schemaIds?: string[];
  modeLinks?: ModeLinkAdd[];
  schemaLinks?: SchemaLinkAdd[];
}

export interface ConceptAppendState {
  modeIds: string[];
  schemaIds: string[];
  modeLinks: ModeLink[];
  schemaLinks: SchemaLink[];
}

/**
 * Чистое объединение: режимы и схемы связей попадают и в общие списки.
 * Возвращает только изменившиеся поля — пустой объект значит «писать нечего».
 */
export function mergeConceptAppend(
  cur: ConceptAppendState,
  add: ConceptAppendInput,
): Partial<ConceptAppendState> {
  const links = add.modeLinks ?? [];
  const modeIds = union(cur.modeIds, [
    ...(add.modeIds ?? []),
    ...links.map((l) => l.modeId),
  ]);
  const schemaIds = union(cur.schemaIds, [
    ...(add.schemaIds ?? []),
    ...links.flatMap((l) => l.schemaIds),
    ...(add.schemaLinks ?? []).map((l) => l.schemaId),
  ]);
  const modeLinks = mergeModeLinks(cur.modeLinks, links);
  const schemaLinks = mergeSchemaLinks(cur.schemaLinks, add.schemaLinks);
  const patch: Partial<ConceptAppendState> = {};
  if (modeIds.length !== cur.modeIds.length) patch.modeIds = modeIds;
  if (schemaIds.length !== cur.schemaIds.length) patch.schemaIds = schemaIds;
  if (modeLinks !== cur.modeLinks) patch.modeLinks = modeLinks;
  if (schemaLinks !== cur.schemaLinks) patch.schemaLinks = schemaLinks;
  return patch;
}

function currentState(row: Record<string, unknown> | null): ConceptAppendState {
  const dec = row ? decryptConceptFields(row) : {};
  return {
    modeIds: strings(dec.modeIds),
    schemaIds: strings(dec.schemaIds),
    modeLinks: linksOf(dec.modeLinks, 'modeId'),
    schemaLinks: linksOf(dec.schemaLinks, 'schemaId'),
  };
}

/**
 * Проверяет связь с клиентом (чужому — 'No active relation'), затем читает
 * строку, объединяет и пишет в одной транзакции (правило №4: read-modify-
 * write). Писать нечего — ни записи, ни снимка истории: ответ — текущая
 * концептуализация (null, если её ещё нет).
 */
export async function appendToConcept(
  deps: { prisma: PrismaService; relations: TherapyRelationsService },
  key: { therapistId: bigint; clientId: bigint },
  add: ConceptAppendInput,
  nowMs = Date.now(),
) {
  await deps.relations.assertHasClient(key.therapistId, key.clientId);
  // Serializable: сохранение полей с версией (concept-save.ts) и дописывание
  // не перетирают друг друга — второй получает конфликт и перечитывает.
  return inSerializableTx(
    deps.prisma,
    async (tx) => {
      const existing = await tx.clientConceptualization.findUnique({
        where: { therapistId_clientId: key },
      });
      const patch = mergeConceptAppend(currentState(existing), add);
      if (Object.keys(patch).length === 0) {
        return existing ? conceptView(existing, existing.history) : null;
      }
      const enc = encryptConceptFields(patch);
      const { row, history } = await writeConceptWithHistory(
        tx,
        key,
        existing,
        enc,
        nowMs,
      );
      return conceptView(row, history);
    },
    conceptStale,
  );
}
