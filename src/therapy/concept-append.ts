// «Дописать в концептуализацию с холста» (#963): холст шлёт режимы, схемы и линии, которые
// терапевт поставил на карту. Только добавление: сервер объединяет с лежащим в полях и
// ничего не удаляет; полного тела холст не шлёт, поэтому автосохранение вкладки и холст
// не перетирают друг друга. Связи — в concept-append-links.ts.
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
import { CONCEPT_SCHEMA_IDS_MAX } from '../utils/text-limits';
import { CONCEPT_MODE_IDS_MAX } from './dto/conceptualization.dto';
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
 * Чистое объединение: режимы и схемы связей — и в общие списки (потолки ConceptualizationDto).
 * Возвращает только изменившиеся поля — пустой объект значит «писать нечего».
 */
export function mergeConceptAppend(
  cur: ConceptAppendState,
  add: ConceptAppendInput,
): Partial<ConceptAppendState> {
  const links = add.modeLinks ?? [];
  const modeIds = union(
    cur.modeIds,
    [...(add.modeIds ?? []), ...links.map((l) => l.modeId)],
    CONCEPT_MODE_IDS_MAX,
  );
  const addSchemas = [
    ...(add.schemaIds ?? []),
    ...links.flatMap((l) => l.schemaIds),
    ...(add.schemaLinks ?? []).map((l) => l.schemaId),
  ];
  const schemaIds = union(cur.schemaIds, addSchemas, CONCEPT_SCHEMA_IDS_MAX);
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
