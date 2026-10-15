// Фабрики фигур диаграммы: из карточки режима или схемы делают DiagramNode с
// высотой под текст (координаты ставит раскладка).
import { MODE_GROUPS } from '../../../schemaTherapy/schemaTherapyData';
import type { GraphModeCard, GraphSchemaCard } from '../conceptGraphTypes';
import {
  COPING_KIND_LABEL,
  groupIdsOfLane,
  type ConceptLane,
  type CopingKind,
} from '../modeLanes';
import { measureNode } from './diagramMeasure';
import type { AddSection, DiagramNode, DiagramShape } from './diagramTypes';

const COPING_SHAPE: Record<CopingKind, DiagramShape> = {
  overcompensation: 'pentagon',
  avoidance: 'shield',
  surrender: 'pill',
};

/** Сколько строк текста вмещает фигура: Здоровый Взрослый — крупнее. */
export const BODY_LINES = {
  mode: 6,
  healthy: 8,
  schema: 7,
  origin: 5,
} as const;
const MIN_H = { mode: 78, healthy: 104, schema: 72, origin: 84 } as const;

export function shapeOf(lane: ConceptLane, kind?: CopingKind): DiagramShape {
  if (lane === 'child') return 'ellipse';
  if (lane === 'critic') return 'octagon';
  if (lane === 'coping') return (kind && COPING_SHAPE[kind]) || 'rounded';
  return 'rounded';
}

/** Цвет группы режимов клетки; у копингов групп три, поэтому нейтральный. */
export function laneColor(lane: ConceptLane): string {
  if (lane === 'coping') return 'var(--text-sub)';
  const group = MODE_GROUPS.find((g) => g.id === groupIdsOfLane(lane)[0]);
  return group?.color ?? 'var(--text-sub)';
}

const base = { x: 0, y: 0 } as const;

export function modeNode(
  card: GraphModeCard,
  lane: ConceptLane,
  w: number,
): DiagramNode {
  const healthy = lane === 'healthy';
  // Имя клиента — главная строка, название режима из метода — мелко. У копинга
  // без имени мелко стоит вид: форма и подпись говорят об одном.
  const kind = card.copingKind && COPING_KIND_LABEL[card.copingKind];
  const node: DiagramNode = {
    ...base,
    id: `mode:${card.modeId}`,
    kind: 'mode',
    shape: shapeOf(lane, card.copingKind),
    section: healthy ? 'healthy' : 'modes',
    w,
    h: 0,
    label: card.alias || card.name,
    name: card.name,
    sublabel: card.alias ? card.name : kind,
    body: card.manifest || undefined,
    bodyLines: healthy ? BODY_LINES.healthy : BODY_LINES.mode,
    color: card.color,
    modeId: card.modeId,
    empty: card.empty,
  };
  const min = healthy ? MIN_H.healthy : MIN_H.mode;
  return { ...node, h: measureNode(node, w, node.bodyLines ?? 0, min).h };
}

export function schemaNode(card: GraphSchemaCard, w: number): DiagramNode {
  const node: DiagramNode = {
    ...base,
    id: `schema:${card.id}`,
    kind: 'schema',
    shape: 'rounded',
    section: 'schemas',
    w,
    h: 0,
    label: `Схема ${card.name}`,
    name: card.name,
    body: card.belief || undefined,
    bodyLines: BODY_LINES.schema,
    color: card.color,
    schemaId: card.id,
    empty: card.empty,
  };
  return {
    ...node,
    h: measureNode(node, w, BODY_LINES.schema, MIN_H.schema).h,
  };
}

/** Овал «Как нарушалась потребность» над схемой; рисуется, только если опыт записан. */
export function originNode(card: GraphSchemaCard, w: number): DiagramNode {
  const node: DiagramNode = {
    ...base,
    id: `origin:${card.id}`,
    kind: 'origin',
    shape: 'ellipse',
    section: 'schemas',
    w,
    h: 0,
    label: '',
    name: card.name,
    caption: 'Как нарушалась потребность',
    body: card.origin,
    bodyLines: BODY_LINES.origin,
    color: card.color,
    schemaId: card.id,
  };
  return {
    ...node,
    h: measureNode(node, w, BODY_LINES.origin, MIN_H.origin).h,
  };
}

const PLACEHOLDER: Record<AddSection, string> = {
  modes: 'Режим не отмечен',
  schemas: 'Схема не отмечена',
  healthy: 'Здоровый Взрослый не отмечен',
};

/** Пунктирная заготовка пустой секции: по тапу открывает тот же выбор, что и «+». */
export function placeholderNode(section: AddSection, w: number): DiagramNode {
  return {
    ...base,
    id: `placeholder:${section}`,
    kind: 'placeholder',
    shape:
      section === 'schemas'
        ? 'rounded'
        : section === 'modes'
          ? 'octagon'
          : 'rounded',
    section,
    w,
    h: 92,
    label: PLACEHOLDER[section],
    color: section === 'healthy' ? 'var(--accent-green)' : 'var(--text-sub)',
  };
}
