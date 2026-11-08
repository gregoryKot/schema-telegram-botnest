import { api, type ClientConceptualization, type UserId } from '../../api';
import { chunkConceptPatch, conceptPatch, rebaseConcept } from '../../../../shared/src/therapy/conceptGraph/conceptPatch';

type Concept = ClientConceptualization;
type Local = Partial<Concept>;

/** Состояние карточки, которое трогает отправка (useConceptAutosave). */
export interface ConceptSaveHost {
  isOpen: (clientId: UserId) => boolean;
  /** Текущие правки открытой карточки — с набранным, пока шёл запрос. */
  currentLocal: () => Local;
  /** Свежая версия сервера и правки поверх неё (после 409). */
  rebased: (fresh: Concept | null, next: Local) => void;
  /** Ответ части патча: от него считается следующая часть и следующее сохранение. */
  acked: (saved: Concept) => void;
}

const REBASE_TRIES = 2;
// По статусу, а не instanceof ApiError: спеки мокают модуль api целиком.
const isStale = (e: unknown) => (e as { status?: unknown } | null)?.status === 409;

// Патч частями (≤ CONCEPT_PATCH_LINKS_MAX связей на запрос), каждая — от версии предыдущего ответа
// (shared/src/therapy/conceptGraph/conceptPatch.ts). Пустой патч — ни одного запроса, ответ — база.
async function post(host: ConceptSaveHost, clientId: UserId, base: Concept | null, local: Local, leaving: boolean) {
  let saved = base;
  for (const part of chunkConceptPatch(conceptPatch(base, local))) {
    const body = { ...part, baseVersion: saved?.updatedAt ?? null };
    saved = await (leaving ? api.saveConceptualization(clientId, body, { keepalive: true }) : api.saveConceptualization(clientId, body));
    if (host.isOpen(clientId)) host.acked(saved);
  }
  return saved;
}

/**
 * Сохраняет правки `local` клиента против `base` (последний ответ сервера). 409 — строку изменили
 * (холст в другом окне, вторая вкладка): перечитать, наложить правки на свежую версию и повторить.
 * Досылка при уходе (`leaving`) не перечитывает — страница уже закрывается.
 */
export async function saveConceptPatch(
  host: ConceptSaveHost, clientId: UserId, base: Concept | null, local: Local, leaving: boolean, tries = 0,
): Promise<Concept | null> {
  try {
    return await post(host, clientId, base, local, leaving);
  } catch (e) {
    if (leaving || tries >= REBASE_TRIES || !isStale(e)) throw e;
    const fresh = await api.getConceptualization(clientId);
    const open = host.isOpen(clientId);
    const next = rebaseConcept(base, open ? host.currentLocal() : local, fresh);
    if (open) host.rebased(fresh, next);
    return saveConceptPatch(host, clientId, fresh, next, leaving, tries + 1);
  }
}
