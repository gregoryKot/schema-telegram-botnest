// Фабрики фигур диаграммы: из карточки режима, схемы, потребности или текстового
// поля концептуализации делают DiagramNode (координаты ставит раскладка).
import { MODE_GROUPS } from '../../../schemaTherapy/schemaTherapyData';
import { needColor } from '../../../needs/needColors';
import type {
  GraphModeCard,
  GraphNeedChip,
  GraphSchemaChip,
} from '../conceptGraphTypes';
import {
  COPING_KIND_LABEL,
  LANE_META,
  groupIdsOfLane,
  type ConceptLane,
  type CopingKind,
} from '../modeLanes';
import { SIZE, type DiagramNode, type DiagramShape } from './diagramTypes';

const COPING_SHAPE: Record<CopingKind, DiagramShape> = {
  overcompensation: 'pentagon',
  avoidance: 'shield',
  surrender: 'pill',
};

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

const PLACEHOLDER_TEXT: Record<ConceptLane, string> = {
  healthy: 'Здоровый Взрослый не отмечен',
  child: 'Детский режим не отмечен',
  critic: 'Критик не отмечен',
  coping: 'Копинг не отмечен',
};

const base = { x: 0, y: 0 } as const;

export function modeNode(
  card: GraphModeCard,
  lane: ConceptLane,
  w: number,
): DiagramNode {
  // Имя клиента — главная строка, название режима из метода — мелко. У копинга
  // без имени мелко стоит вид: форма и подпись говорят об одном.
  const kind = card.copingKind && COPING_KIND_LABEL[card.copingKind];
  return {
    ...base,
    id: `mode:${card.modeId}`,
    kind: 'mode',
    shape: shapeOf(lane, card.copingKind),
    w,
    h: SIZE.mode.h,
    label: card.alias || card.name,
    name: card.name,
    sublabel: card.alias ? card.name : kind,
    color: card.color,
    modeId: card.modeId,
    lane,
    empty: card.empty,
  };
}

export function placeholderNode(lane: ConceptLane, w: number): DiagramNode {
  return {
    ...base,
    id: `placeholder:${lane}`,
    kind: 'placeholder',
    shape: shapeOf(lane),
    w,
    h: SIZE.placeholder.h,
    label: PLACEHOLDER_TEXT[lane],
    title: LANE_META[lane].empty,
    color: laneColor(lane),
    lane,
  };
}

export function schemaNode(chip: GraphSchemaChip, w: number): DiagramNode {
  return {
    ...base,
    id: `schema:${chip.id}`,
    kind: 'schema',
    shape: 'pill',
    w,
    h: SIZE.schema.h,
    label: chip.name,
    color: chip.color,
    schemaId: chip.id,
  };
}

export function needNode(chip: GraphNeedChip): DiagramNode {
  return {
    ...base,
    id: `need:${chip.id}`,
    kind: 'need',
    shape: 'pill',
    w: SIZE.need.w,
    h: SIZE.need.h,
    label: chip.name,
    color: needColor(chip.id),
    needId: chip.id,
  };
}

/** Текстовое поле концептуализации: заголовок и обрезанный текст. */
export function textNode(
  id: string,
  kind: 'experience' | 'goals' | 'problems' | 'trigger',
  label: string,
  text: string,
  color: string,
  avail: number,
): DiagramNode {
  const trigger = kind === 'trigger';
  const size = trigger ? SIZE.trigger : SIZE.text;
  return {
    ...base,
    id,
    kind,
    shape: trigger ? 'cloud' : kind === 'problems' ? 'tag' : 'rounded',
    w: Math.min(size.w, avail),
    h: size.h,
    label,
    sublabel: text,
    title: text,
    color,
  };
}
