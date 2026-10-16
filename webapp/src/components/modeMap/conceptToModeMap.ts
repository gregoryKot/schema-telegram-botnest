import type { ModeMapEdge, ModeMapNode } from '../../api';
import type { ConceptGraphModel } from '../../../../shared/src/therapy/conceptGraph/conceptGraphTypes';
import { layoutConceptDiagram } from '../../../../shared/src/therapy/conceptGraph/diagram/diagramLayout';
import type { DiagramEdge, DiagramNode } from '../../../../shared/src/therapy/conceptGraph/diagram/diagramTypes';
import { HUB_DIAMETER } from './hubGeometry';
import { modeNodeType } from './modeNodeMeta';

// Схема случая → карта режимов. Единственный конвертер: его берут и кнопка
// «Открыть на холсте» (новая карта), и пункт меню «Из концептуализации клиента»
// (дописать в открытую карту). Позиции — из той же раскладки, что рисует схема
// случая, поэтому холст сразу выглядит как автоматическая схема.

/** Ширина раскладки: четыре колонки в базовых размерах (от 960 раскладка широкая). */
const LAYOUT_WIDTH = 1400;
/** Просвет между уже стоящими на карте нодами и новыми. */
const GAP = 240;
const HUB_KEY = 'needs:circle';

/** Подпись и стиль ребра по виду линии раскладки; объект новый на каждое ребро. */
function arrowOf(kind: DiagramEdge['kind']): Pick<ModeMapEdge, 'label' | 'data'> {
  if (kind === 'link') return { data: { bidirectional: true } };
  if (kind === 'blocks') return { label: '✗', data: { color: 'var(--accent-red)', lineStyle: 'dashed' } };
  if (kind === 'meets') return { label: '✓', data: { color: 'var(--accent-green)' } };
  return {};
}

/** Ключ сущности на карте: тот же, что id фигуры в раскладке (mode:, schema:, origin:, need:). */
function entityKey(n: ModeMapNode): string | null {
  const { modeId, schemaId, needId } = n.data;
  if (n.type === 'needs') return HUB_KEY;
  if (n.type === 'schema' && schemaId) return `schema:${schemaId}`;
  if (n.type === 'origin' && schemaId) return `origin:${schemaId}`;
  if (n.type === 'need' && needId) return `need:${needId}`;
  return modeId ? `mode:${modeId}` : null;
}

const text = (note: string | undefined) => (note ? { note } : {});

function buildNode(d: DiagramNode, id: string): ModeMapNode {
  const position = { x: d.x, y: d.y };
  switch (d.kind) {
    case 'schema':
      return { id, type: 'schema', position, data: { label: d.label, ...text(d.body), schemaId: d.schemaId, customColor: d.color } };
    case 'origin':
      return { id, type: 'origin', position, data: { label: d.caption ?? d.label, ...text(d.body), schemaId: d.schemaId } };
    case 'need': // мелкий шрифт: таблетки стоят в круге по 112 px с просветом 20, крупный текст налезал бы на соседа
      return { id, type: 'need', position, data: { label: d.label, needId: d.needId, customColor: d.color, fontSize: 'sm' } };
    default: {
      const modeId = d.modeId ?? '';
      const { type, copingSubtype } = modeNodeType(modeId);
      return { id, type, position, data: { modeId, label: d.label, ...text(d.body), display: 'full', ...(copingSubtype ? { copingSubtype } : {}) } };
    }
  }
}

const slug = (s: string) => s.replace(/\W+/g, '_');

/**
 * Собирает ноды и рёбра карты из модели схемы случая.
 *
 * Слияние: сущность, которая уже есть в `existing` (режим по modeId, схема и опыт
 * по schemaId у своего типа, потребность по needId, круг по типу), заново не
 * создаётся — рёбра берут её id. Новые ноды целиком сдвигаются правее
 * существующих, а ребро между двумя старыми нодами добавляется, только если в
 * `existingEdges` такого ещё нет (связь «режим ⇄ схема» двусторонняя, поэтому
 * для неё порядок концов не важен).
 */
export function conceptToModeMap(
  graph: ConceptGraphModel,
  existing: ModeMapNode[] = [],
  stamp = Date.now(),
  existingEdges: ModeMapEdge[] = [],
): { nodes: ModeMapNode[]; edges: ModeMapEdge[] } {
  const layout = layoutConceptDiagram(graph, LAYOUT_WIDTH);
  const have = new Map<string, string>();
  for (const n of existing) {
    const key = entityKey(n);
    if (key && !have.has(key)) have.set(key, n.id);
  }

  const idOf = new Map<string, string>(); // id фигуры раскладки → id ноды карты
  const fresh: ModeMapNode[] = [];
  const add = (key: string, make: (id: string) => ModeMapNode) => {
    const old = have.get(key);
    if (old) { idOf.set(key, old); return; }
    const [kind, entity] = key.split(/:(.*)/);
    const node = make(`cc_${kind}_${slug(entity)}_${stamp}`);
    idOf.set(key, node.id);
    fresh.push(node);
  };

  const { cx, cy, r, title } = layout.circle;
  add(HUB_KEY, (id) => ({ id, type: 'needs', position: { x: cx - r, y: cy - r }, data: { label: title, diameter: 2 * r } }));
  for (const d of layout.nodes) {
    if (d.kind !== 'placeholder') add(d.id, (id) => buildNode(d, id));
  }

  // Новое целиком правее старого: левый край новых = правый край существующих + GAP.
  if (existing.length > 0 && fresh.length > 0) {
    const right = Math.max(...existing.map((n) => n.position.x + (n.type === 'needs' ? (n.data.diameter ?? HUB_DIAMETER) : 0)));
    const dx = right + GAP - Math.min(...fresh.map((n) => n.position.x));
    for (const n of fresh) n.position = { x: n.position.x + dx, y: n.position.y };
  }

  const freshIds = new Set(fresh.map((n) => n.id));
  const exists = (a: string, b: string, both: boolean) =>
    existingEdges.some((e) => (e.source === a && e.target === b) || (both && e.source === b && e.target === a));
  const edges: ModeMapEdge[] = [];
  for (const e of layout.edges) {
    const source = idOf.get(e.from);
    const target = idOf.get(e.to);
    if (!source || !target) continue;
    const bothOld = !freshIds.has(source) && !freshIds.has(target);
    if (bothOld && exists(source, target, e.kind === 'link')) continue;
    edges.push({ id: `cc_${e.kind}_${slug(e.from)}_${slug(e.to)}_${stamp}`, source, target, ...arrowOf(e.kind) });
  }
  return { nodes: fresh, edges };
}
