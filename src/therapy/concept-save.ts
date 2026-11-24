// Сохранение концептуализации с версией строки и частичными связями
// (контракт — shared/src/therapy/conceptGraph/conceptPatch.ts, DTO —
// dto/concept-save.dto.ts). Вынесено из therapy-notes.service.ts (правило №10).
//
// Порядок (docs/open/therapy.md, #963): вкладка «Концептуализация» в одном
// окне и холст в другом писали в одну строку вслепую — автосохранение полей
// стирало дописанное холстом. Теперь запрос несёт `baseVersion` (updatedAt,
// от которой считан патч); строку успели изменить — 409, вкладка перечитывает
// и повторяет свои правки. Проверка и запись — одна Serializable-транзакция
// с ретраем (как дописывание с холста, concept-append.ts): между проверкой
// версии и записью чужая запись не втиснется.
import {
  CONCEPT_MODE_LINKS_MAX,
  CONCEPT_SCHEMA_LINKS_MAX,
} from './dto/conceptualization.dto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ClientConceptualization } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { inSerializableTx } from '../prisma/serializable-retry';
import {
  conceptView,
  decryptConceptFields,
  encryptConceptFields,
  writeConceptWithHistory,
} from './concept-store';

// Текст идёт на экран, только если повтор вкладки не помог (сеть, третья
// гонка подряд); безличный — без формы обращения.
export const CONCEPT_STALE_MESSAGE =
  'Концептуализацию изменили в другом окне — правки наложатся на свежую версию';
export const conceptStale = () => new ConflictException(CONCEPT_STALE_MESSAGE);

type Link = Record<string, unknown>;
export interface LinksPatchInput {
  upsert?: object[];
  remove?: string[];
}

export interface ConceptSaveInput {
  baseVersion?: string | null;
  /** «Восстановить» версию: снимок «до» — мимо окна склейки (concept-history.ts). */
  restore?: boolean;
  modeLinks?: unknown[];
  schemaLinks?: unknown[];
  modeLinksPatch?: LinksPatchInput;
  schemaLinksPatch?: LinksPatchInput;
}

/** Связи после патча: замена по id на месте, новые — в конец, remove — прочь. */
export function patchLinks(
  stored: unknown,
  patch: LinksPatchInput,
  key: 'modeId' | 'schemaId',
  max: number,
): Link[] {
  const drop = new Set(patch.remove ?? []);
  const byId = new Map<unknown, Link>();
  for (const l of Array.isArray(stored) ? (stored as Link[]) : []) {
    if (!drop.has(l?.[key] as string)) byId.set(l?.[key], l);
  }
  for (const l of (patch.upsert ?? []) as Link[]) byId.set(l[key], { ...l });
  const out = [...byId.values()];
  if (out.length > max) {
    throw new BadRequestException(`${key} links: at most ${max}`);
  }
  return out;
}

function versionOf(row: ClientConceptualization | null): number | null {
  return row?.updatedAt ? new Date(row.updatedAt).getTime() : null;
}

function assertFresh(
  existing: ClientConceptualization | null,
  base: string | null | undefined,
) {
  if (base === undefined) return; // старый бандл: без проверки
  const expected = base === null ? null : Date.parse(base);
  if (versionOf(existing) !== expected) {
    throw conceptStale();
  }
}

/** Поля тела + связи после патча поверх сохранённых (или присланных целиком). */
function mergedFields(
  stored: Record<string, unknown>,
  body: ConceptSaveInput,
): Record<string, unknown> {
  const { modeLinksPatch, schemaLinksPatch } = body;
  const fields: Record<string, unknown> = { ...body };
  delete fields.baseVersion;
  delete fields.restore;
  delete fields.modeLinksPatch;
  delete fields.schemaLinksPatch;
  if (modeLinksPatch) {
    const from = fields.modeLinks ?? stored.modeLinks;
    fields.modeLinks = patchLinks(
      from,
      modeLinksPatch,
      'modeId',
      CONCEPT_MODE_LINKS_MAX,
    );
  }
  if (schemaLinksPatch) {
    const from = fields.schemaLinks ?? stored.schemaLinks;
    fields.schemaLinks = patchLinks(
      from,
      schemaLinksPatch,
      'schemaId',
      CONCEPT_SCHEMA_LINKS_MAX,
    );
  }
  return fields;
}

/** Сколько стилей копинга (#1484) появилось у схем: событие guide_mark_added на каждый. */
export function copingAdded(before: unknown, after: unknown): number {
  const styles = (links: unknown) =>
    new Set(
      (Array.isArray(links) ? (links as Link[]) : []).flatMap((l) =>
        Array.isArray(l?.coping)
          ? (l.coping as unknown[]).map(
              (c) => `${String(l.schemaId)}/${String(c)}`,
            )
          : [],
      ),
    );
  const was = styles(before);
  return [...styles(after)].filter((k) => !was.has(k)).length;
}

/**
 * Пишет концептуализацию пары (связь с клиентом проверяет вызывающий):
 * версия → слияние связей → шифрование → запись со снимком истории.
 * `copingAdded` — новые стили копинга (восстановление версии не считается).
 */
export async function saveConceptCounted(
  prisma: PrismaService,
  key: { therapistId: bigint; clientId: bigint },
  body: ConceptSaveInput,
  nowMs = Date.now(),
) {
  return inSerializableTx(
    prisma,
    async (tx) => {
      const existing = await tx.clientConceptualization.findUnique({
        where: { therapistId_clientId: key },
      });
      assertFresh(existing, body.baseVersion);
      const stored: Record<string, unknown> = existing
        ? decryptConceptFields(existing)
        : {};
      const fields = mergedFields(stored, body);
      const added =
        fields.schemaLinks === undefined || body.restore === true
          ? 0
          : copingAdded(stored.schemaLinks, fields.schemaLinks);
      const enc = encryptConceptFields(fields);
      const { row, history } = await writeConceptWithHistory(
        tx,
        key,
        existing,
        enc,
        nowMs,
        body.restore === true,
      );
      return { view: conceptView(row, history), copingAdded: added };
    },
    conceptStale,
  );
}

export async function saveConceptVersioned(
  prisma: PrismaService,
  key: { therapistId: bigint; clientId: bigint },
  body: ConceptSaveInput,
  nowMs = Date.now(),
) {
  return (await saveConceptCounted(prisma, key, body, nowMs)).view;
}
