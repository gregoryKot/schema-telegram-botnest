import type { ClientConceptualization } from '../../api';
import type { ConceptModeLink } from '../../../../shared/src/apiTypes';
import { normalizeModeLinks } from '../../../../shared/src/therapy/conceptGraph/modeLinks';

type Local = Partial<ClientConceptualization>;
type Lists = Partial<Pick<ClientConceptualization, 'modeIds' | 'schemaIds' | 'modeLinks'>>;

/**
 * Список id после записи с холста: серверный, плюс то, что терапевт добавил
 * или убрал во вкладке после последнего ответа сервера (`base`) и ещё не
 * отправил. Просто взять серверный — потерять неотправленную правку; просто
 * объединить — вернуть режим, который терапевт только что снял.
 */
export function mergeIds(base: readonly string[], local: readonly string[], server: readonly string[]): string[] {
  const removed = new Set(base.filter((x) => !local.includes(x)));
  const added = local.filter((x) => !base.includes(x));
  return [...new Set([...server.filter((x) => !removed.has(x)), ...added])];
}

const byMode = (links: readonly ConceptModeLink[], modeId: string) => links.find((l) => l.modeId === modeId);
const same = (a?: ConceptModeLink, b?: ConceptModeLink) => JSON.stringify(a) === JSON.stringify(b);

/** Связи режимов: правленная во вкладке связь остаётся локальной, её схемы сводятся так же, как списки. */
function mergeLinks(base: ConceptModeLink[], local: ConceptModeLink[], server: ConceptModeLink[]): ConceptModeLink[] {
  const merged = server.map((s) => {
    const l = byMode(local, s.modeId);
    const b = byMode(base, s.modeId);
    return l && !same(l, b) ? { ...l, schemaIds: mergeIds(b?.schemaIds ?? [], l.schemaIds, s.schemaIds) } : s;
  });
  return [...merged, ...local.filter((l) => !byMode(server, l.modeId))];
}

/**
 * Холст «Графических карт» дописал в концептуализацию (#963): режимы, схемы и
 * связи вкладки берутся из ответа сервера, неотправленные правки этих списков
 * ложатся поверх; текстовые поля и всё остальное — локальные, как были.
 */
export function mergeAppended(base: Lists | null, local: Local, server: Lists): Local {
  const b: Lists = base ?? {}; // концептуализации ещё не было: всё локальное — неотправленное
  return {
    ...local,
    modeIds: mergeIds(b.modeIds ?? [], local.modeIds ?? [], server.modeIds ?? []),
    schemaIds: mergeIds(b.schemaIds ?? [], local.schemaIds ?? [], server.schemaIds ?? []),
    modeLinks: mergeLinks(normalizeModeLinks(b.modeLinks), normalizeModeLinks(local.modeLinks), normalizeModeLinks(server.modeLinks)),
  };
}
