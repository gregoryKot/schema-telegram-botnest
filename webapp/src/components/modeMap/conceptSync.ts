// Связь холста с полями концептуализации (#963), чистая часть: что на холсте относится к концептуализации,
// что на нём появилось и чего нет. Режим — узел с data.modeId из справочника; схема — фигура «схема» с
// data.schemaId; «схема питает режим» — линия схема ⇄ режим или таблетка схемы на режиме; связи с
// потребностями (✗ схема, ✓ здоровый режим к колесу или таблетке) — conceptNeedSync.ts. Прочее — нет.
import { getModeById, getSchemaById } from '../../schemaTherapyData';
import { normalizeModeLinks } from '../../../../shared/src/therapy/conceptGraph/modeLinks';
import { conceptSchemaIds, normalizeSchemaLinks } from '../../../../shared/src/therapy/conceptGraph/schemaLinks';
import type { ConceptAppendBody } from '../../../../shared/src/therapy/conceptAppend';
import type { ClientConcept, ClientConceptState } from './clientConceptContext';
import { ownSchemaIds } from './nodeSchemaIds';
import { needAppend, needLinksOf } from './conceptNeedSync';

export type GraphNode = { id: string; type?: string; data?: Record<string, unknown> };
export type GraphEdge = { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null };
/** Ответ сервера с концептуализацией (getConceptualization, appendConceptualization). */
export type ConceptResponse = { schemaIds?: unknown; modeIds?: unknown; modeLinks?: unknown; schemaLinks?: unknown } | null | undefined;

/** Холст в терминах концептуализации; связь — ключ `modeId schemaId`, связь с потребностью — needLinksOf. */
export interface CanvasConcept { modes: ReadonlySet<string>; schemas: ReadonlySet<string>; links: ReadonlySet<string>; needs: ReadonlySet<string> }
/** Режимы и схемы концептуализации, которых нет на холсте. */
export interface ConceptMissing { modeIds: string[]; schemaIds: string[] }

export const EMPTY_CANVAS: CanvasConcept = { modes: new Set(), schemas: new Set(), links: new Set(), needs: new Set() };

const SEP = ' ';
const NOT_MODE = new Set(['schema', 'origin', 'need', 'needs']);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const idOf = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/** Ответ сервера → то, что нужно холсту: схемы, режимы, нормализованные связи. */
export function toClientConcept(c: ConceptResponse): ClientConcept {
  return { schemaIds: strs(c?.schemaIds), modeIds: strs(c?.modeIds), modeLinks: normalizeModeLinks(c?.modeLinks), schemaLinks: normalizeSchemaLinks(c?.schemaLinks) };
}

function entityOf(n: GraphNode): { mode?: string; schema?: string; own?: string[] } {
  if (n.type === 'schema') {
    const id = idOf(n.data?.schemaId);
    return id && getSchemaById(id) ? { schema: id } : {};
  }
  const id = NOT_MODE.has(n.type ?? '') ? undefined : idOf(n.data?.modeId);
  return id && getModeById(id) ? { mode: id, own: ownSchemaIds({ schemaId: idOf(n.data?.schemaId), schemaIds: strs(n.data?.schemaIds) }) } : {};
}

export function canvasConcept(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): CanvasConcept {
  const byId = new Map(nodes.map((n) => [n.id, entityOf(n)]));
  const [modes, schemas, links] = [new Set<string>(), new Set<string>(), new Set<string>()];
  for (const e of byId.values()) {
    if (e.mode) modes.add(e.mode);
    if (e.schema) schemas.add(e.schema);
    for (const schema of e.own ?? []) links.add(e.mode + SEP + schema);
  }
  for (const { source, target } of edges) {
    const [a, b] = [byId.get(source), byId.get(target)];
    const mode = a?.mode ?? b?.mode;
    const schema = a?.schema ?? b?.schema;
    if (mode && schema) links.add(mode + SEP + schema);
  }
  return { modes, schemas, links, needs: needLinksOf(nodes, edges) };
}

type SetOp = (a: ReadonlySet<string>, b: ReadonlySet<string>) => ReadonlySet<string>;
const each = (op: SetOp) => (a: CanvasConcept, b: CanvasConcept): CanvasConcept =>
  ({ modes: op(a.modes, b.modes), schemas: op(a.schemas, b.schemas), links: op(a.links, b.links), needs: op(a.needs, b.needs) });

/** Что появилось на холсте по сравнению с его прошлым состоянием; убранное не в счёт. */
export const addedOnCanvas = (prev: CanvasConcept, next: CanvasConcept) =>
  each((a, b) => new Set([...a].filter((x) => !b.has(x))))(next, prev);
export const unionCanvas = each((a, b) => new Set([...a, ...b]));
/** Только то, что и сейчас стоит на холсте: поставил и тут же убрал — писать нечего. */
export const keepOnCanvas = each((a, b) => new Set([...a].filter((x) => b.has(x))));
export const isEmptyCanvas = (c: CanvasConcept) => c.modes.size + c.schemas.size + c.links.size + c.needs.size === 0;

/** Схемы концептуализации — те же, что ставит на холст «Из концептуализации клиента»: актуальные и из связей режимов. */
const conceptSchemas = (c: ClientConcept) => conceptSchemaIds(c.schemaIds, c.modeIds, c.modeLinks);

/**
 * Появившееся на холсте, чего нет в концептуализации, → тело append; писать нечего — null.
 * Концептуализация не загрузилась — тело как есть: сервер объединяет, лишнего не запишет.
 */
export function appendBody(added: CanvasConcept, concept: ClientConceptState): ConceptAppendBody | null {
  const c = concept && concept !== 'failed' ? concept : null;
  const modesIn = new Set(c?.modeIds);
  const schemasIn = c ? conceptSchemas(c) : new Set<string>();
  const linksIn = new Set(c?.modeLinks.flatMap((l) => l.schemaIds.map((s) => l.modeId + SEP + s)));
  const modeIds = [...added.modes].filter((id) => !modesIn.has(id));
  const schemaIds = [...added.schemas].filter((id) => !schemasIn.has(id));
  const byMode = new Map<string, string[]>();
  for (const key of added.links) {
    if (linksIn.has(key)) continue;
    const [modeId, schemaId] = key.split(SEP);
    byMode.set(modeId, [...(byMode.get(modeId) ?? []), schemaId]);
  }
  const { schemaLinks, modeNeeds } = needAppend(added.needs, c);
  const modeLinks = [...new Set([...byMode.keys(), ...modeNeeds.keys()])]
    .map((modeId) => ({ modeId, schemaIds: byMode.get(modeId) ?? [], ...(modeNeeds.has(modeId) ? { needIds: modeNeeds.get(modeId) } : {}) }));
  if (modeIds.length + schemaIds.length + modeLinks.length + schemaLinks.length === 0) return null;
  return { ...(modeIds.length ? { modeIds } : {}), ...(schemaIds.length ? { schemaIds } : {}),
    ...(modeLinks.length ? { modeLinks } : {}), ...(schemaLinks.length ? { schemaLinks } : {}) };
}

/** В полях есть, на холсте нет — то, что допишет «Добавить на карту» (неизвестные id не в счёт). */
export function missingOnCanvas(concept: ClientConcept, canvas: CanvasConcept): ConceptMissing {
  return {
    modeIds: [...new Set(concept.modeIds)].filter((id) => getModeById(id) && !canvas.modes.has(id)),
    schemaIds: [...conceptSchemas(concept)].filter((id) => getSchemaById(id) && !canvas.schemas.has(id)),
  };
}
