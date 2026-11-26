import type { ClientConceptualization, TherapyClientSummary, UserId } from '../../../api';
import type { ConceptSchemaLink } from '../../../../../shared/src/apiTypes';
import type { CopingStyleId } from '../../../../../shared/src/schemaTherapy/guide/copingStyles';
import { formatAddress } from '../../../../../shared/src/schemaTherapy/guide/address/addressFormat';
import type { ConceptPatchRequest } from '../../../../../shared/src/therapy/conceptGraph/conceptPatch';
import { isCopingMarked, markCoping, unmarkCoping } from '../../../../../shared/src/therapy/conceptGraph/schemaCoping';
import { findSchemaLink, normalizeSchemaLinks } from '../../../../../shared/src/therapy/conceptGraph/schemaLinks';
import { clientDisplayName } from '../../../../../shared/src/therapy/clientInitials';
import type { GuideGraph } from './guideJournal';

/** Что делает лист «Про клиента»: поставить (или поправить заметку) либо снять. */
export type CopingAction = { kind: 'mark'; note: string } | { kind: 'unmark' };

/** Стиль копинга схемы, который отмечают. */
export interface CopingCell { schemaId: string; style: CopingStyleId }

/** Отметка у одного клиента: что стоит сейчас и как её поменять. */
export interface CopingTarget {
  name: string;
  marked: boolean;
  note: string;
  apply: (action: CopingAction) => Promise<void>;
}

export const copingAddress = ({ schemaId, style }: CopingCell) =>
  formatAddress({ kind: 'schema', articleId: schemaId, path: `coping.${style}` });

/** Стоящая отметка в связях схемы случая. */
export function copingState(links: ConceptSchemaLink[], { schemaId, style }: CopingCell) {
  const link = findSchemaLink(links, schemaId);
  return { marked: isCopingMarked(link, style), note: link.copingNotes?.[style] ?? '' };
}

/** Патч схемы случая: связь схемы со стилем; схемы нет в схеме случая — добавляется вместе с отметкой. */
export function copingPatch(concept: ClientConceptualization | null, cell: CopingCell, action: CopingAction): ConceptPatchRequest {
  const src = { schemaIds: concept?.schemaIds ?? [], schemaLinks: normalizeSchemaLinks(concept?.schemaLinks) };
  const baseVersion = concept?.updatedAt ?? null;
  if (action.kind === 'unmark') {
    return { baseVersion, schemaLinksPatch: { upsert: [unmarkCoping(src.schemaLinks, cell.schemaId, cell.style)] } };
  }
  const change = markCoping(src, cell.schemaId, cell.style, action.note);
  return {
    baseVersion,
    ...(change.addedSchema ? { schemaIds: [...src.schemaIds, cell.schemaId] } : {}),
    schemaLinksPatch: { upsert: [change.link] },
  };
}

type ConceptApi = {
  getConceptualization: (id: UserId) => Promise<ClientConceptualization | null>;
  saveConceptualization: (id: UserId, body: ConceptPatchRequest) => Promise<ClientConceptualization>;
};

// По статусу, а не instanceof ApiError: спеки мокают модуль api целиком (как conceptSaveRequests.ts).
const isStale = (e: unknown) => (e as { status?: unknown } | null)?.status === 409;

/** Отметка в схеме случая клиента с сервера: строку изменили (409) — перечитать и повторить один раз. */
export async function applyCopingRemote(api: ConceptApi, clientId: UserId, cell: CopingCell, action: CopingAction, concept: ClientConceptualization | null) {
  try {
    return await api.saveConceptualization(clientId, copingPatch(concept, cell, action));
  } catch (e) {
    if (!isStale(e)) throw e;
    const fresh = await api.getConceptualization(clientId);
    return api.saveConceptualization(clientId, copingPatch(fresh, cell, action));
  }
}

/** Поиск клиента в листе выбора: по имени, без регистра. */
export function filterClients(list: TherapyClientSummary[], query: string): TherapyClientSummary[] {
  const q = query.trim().toLowerCase();
  return q ? list.filter((c) => clientDisplayName(c).toLowerCase().includes(q)) : list;
}

/** Отметка из карточки клиента: правка связей схемы случая (автосохранение карточки), без своего запроса. */
export function graphCopingTarget(graph: GuideGraph, name: string, cell: CopingCell): CopingTarget {
  const links = graph.source.schemaLinks;
  return {
    name,
    ...copingState(links, cell),
    apply: async (action) => {
      if (action.kind === 'unmark') {
        graph.onChangeSchemaLink(unmarkCoping(links, cell.schemaId, cell.style));
        return;
      }
      const change = markCoping({ schemaIds: graph.source.schemaIds ?? [], schemaLinks: links }, cell.schemaId, cell.style, action.note);
      if (change.addedSchema) graph.onAddSchema?.(cell.schemaId);
      graph.onChangeSchemaLink(change.link);
    },
  };
}
