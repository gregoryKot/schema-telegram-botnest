// Связь холста с концептуализацией по потребностям (колесо потребностей, 2026-11).
// Линия от схемы к сектору колеса (или к таблетке потребности) — «схема блокирует
// потребность» → ClientConceptualization.schemaLinks[].needIds; линия от здорового
// режима — «о потребности заботится» → modeLinks[].needIds. Те же связи рисует схема
// случая (✗ и ✓), поэтому холст и поля говорят одно. Только добавление, как у
// остальных связей холста (conceptSync.ts): убранная линия поля не трогает.
import { getSchemaById } from '../../schemaTherapyData';
import type { ConceptAppendSchemaLink } from '../../../../shared/src/therapy/conceptAppend';
import type { ClientConcept } from './clientConceptContext';
import type { GraphEdge, GraphNode } from './conceptSync';
import { modeNodeType } from './modeNodeMeta';
import { needOfHandle } from './needWheel';
import { NEED_ORDER } from '../../../../shared/src/needs/needData';

type Edge = GraphEdge & { sourceHandle?: string | null; targetHandle?: string | null };
const SEP = ' ';
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

/** Потребность на конце линии: сектор колеса (ручка need:<id>) или таблетка с needId. */
function needAt(n: GraphNode | undefined, handle: string | null | undefined): string | undefined {
  if (n?.type === 'needs') return needOfHandle(handle);
  const id = n?.type === 'need' ? str(n.data?.needId) : undefined;
  return id && (NEED_ORDER as readonly string[]).includes(id) ? id : undefined;
}

/** Другой конец: «s:<schemaId>» у схемы, «m:<modeId>» у здорового режима из справочника. */
function ownerAt(n: GraphNode | undefined): string | undefined {
  const schemaId = n?.type === 'schema' ? str(n.data?.schemaId) : undefined;
  if (schemaId && getSchemaById(schemaId)) return `s:${schemaId}`;
  const modeId = n?.type === 'healthy' ? str(n.data?.modeId) : undefined;
  return modeId && modeNodeType(modeId).type === 'healthy' ? `m:${modeId}` : undefined;
}

/** Связи с потребностями на холсте: ключ `s:<schemaId> <needId>` или `m:<modeId> <needId>`, в любую сторону линии. */
export function needLinksOf(nodes: readonly GraphNode[], edges: readonly Edge[]): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Set<string>();
  for (const e of edges) {
    const [a, b] = [byId.get(e.source), byId.get(e.target)];
    const need = needAt(b, e.targetHandle) ?? needAt(a, e.sourceHandle);
    const owner = needAt(b, e.targetHandle) ? ownerAt(a) : ownerAt(b);
    if (need && owner) out.add(owner + SEP + need);
  }
  return out;
}

/** Новые связи, которых нет в концептуализации: schemaLinks для тела append и needIds режимов по modeId. */
export function needAppend(added: ReadonlySet<string>, c: ClientConcept | null) {
  const has = new Set([
    ...(c?.schemaLinks ?? []).flatMap((l) => l.needIds.map((n) => `s:${l.schemaId}${SEP}${n}`)),
    ...(c?.modeLinks ?? []).flatMap((l) => l.needIds.map((n) => `m:${l.modeId}${SEP}${n}`)),
  ]);
  const schemas = new Map<string, string[]>();
  const modes = new Map<string, string[]>();
  for (const key of added) {
    if (has.has(key)) continue;
    const [owner, need] = key.split(SEP);
    const [kind, id] = [owner.slice(0, 1), owner.slice(2)];
    const into = kind === 's' ? schemas : modes;
    into.set(id, [...(into.get(id) ?? []), need]);
  }
  const schemaLinks: ConceptAppendSchemaLink[] = [...schemas].map(([schemaId, needIds]) => ({ schemaId, needIds }));
  return { schemaLinks, modeNeeds: modes };
}
