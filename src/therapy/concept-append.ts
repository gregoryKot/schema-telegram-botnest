// «Дописать в концептуализацию с холста» (#963): холст «Графических карт»
// шлёт режимы, схемы и линии схема → режим, которые терапевт поставил на
// карту. Только добавление: сервер объединяет с тем, что уже лежит в полях,
// и ничего не удаляет (удаление с холста — про раскладку). Полного тела холст
// не шлёт, поэтому автосохранение вкладки «Концептуализация» и холст не
// перетирают друг другу то, чего каждый не видел.
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

// Потолки ConceptualizationDto: дописанное обязано проходить следующее полное
// сохранение полей (modeLinks ≤ 40, схем у связи ≤ 20) — сверка в спеке.
export const APPEND_MODE_LINKS_MAX = 40;
export const APPEND_LINK_SCHEMAS_MAX = 20;

export interface ConceptAppendInput {
  modeIds?: string[];
  schemaIds?: string[];
  modeLinks?: { modeId: string; schemaIds: string[] }[];
}

type Link = Record<string, unknown> & { modeId: string };

export interface ConceptAppendState {
  modeIds: string[];
  schemaIds: string[];
  modeLinks: Link[];
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** base + новые из extra (без дублей), порядок: сначала существующие. */
function union(base: string[], extra: string[], max = Infinity): string[] {
  const out = [...base];
  for (const id of extra) {
    if (out.length >= max) break;
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

// Новая связь — в форме normalizeModeLinks (shared/src/therapy/conceptGraph/
// modeLinks.ts, emptyModeLink): тексты пустые, их терапевт пишет в полях.
function newLink(modeId: string, schemaIds: string[]): Link {
  return {
    modeId,
    alias: '',
    schemaIds,
    needIds: [],
    origin: '',
    manifest: '',
    strategy: '',
  };
}

function mergeLinks(cur: Link[], add: ConceptAppendInput['modeLinks']): Link[] {
  let links = cur;
  for (const { modeId, schemaIds } of add ?? []) {
    const i = links.findIndex((l) => l.modeId === modeId);
    if (i >= 0) {
      const had = strings(links[i].schemaIds);
      const next = union(had, schemaIds, APPEND_LINK_SCHEMAS_MAX);
      if (next.length === had.length) continue;
      // Остальные поля связи (alias, needIds, тексты) не трогаем.
      links = links.map((l, j) => (j === i ? { ...l, schemaIds: next } : l));
    } else if (schemaIds.length > 0 && links.length < APPEND_MODE_LINKS_MAX) {
      const ids = union([], schemaIds, APPEND_LINK_SCHEMAS_MAX);
      links = [...links, newLink(modeId, ids)];
    }
  }
  return links;
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
  ]);
  const modeLinks = mergeLinks(cur.modeLinks, links);
  const patch: Partial<ConceptAppendState> = {};
  if (modeIds.length !== cur.modeIds.length) patch.modeIds = modeIds;
  if (schemaIds.length !== cur.schemaIds.length) patch.schemaIds = schemaIds;
  if (modeLinks !== cur.modeLinks) patch.modeLinks = modeLinks;
  return patch;
}

function currentState(row: Record<string, unknown> | null): ConceptAppendState {
  const dec = row ? decryptConceptFields(row) : {};
  const links = Array.isArray(dec.modeLinks)
    ? (dec.modeLinks as unknown[])
    : [];
  return {
    modeIds: strings(dec.modeIds),
    schemaIds: strings(dec.schemaIds),
    modeLinks: links.filter(
      (l): l is Link =>
        typeof l === 'object' &&
        l !== null &&
        typeof (l as Link).modeId === 'string',
    ),
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
