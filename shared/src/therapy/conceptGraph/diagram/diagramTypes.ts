// Типы и размеры диаграммы концептуализации. Раскладка — чистая функция
// (diagramLayout.ts): на вход модель графа и ширина, на выход фигуры, зоны и
// линии в пикселях. React здесь не нужен, поэтому всё проверяется тестами без DOM.
import type { ConceptLane } from '../modeLanes';

export type DiagramBandId =
  'healthy' | 'roots' | 'schemas' | 'backstage' | 'coping' | 'cost';

export interface DiagramBand {
  id: DiagramBandId;
  title: string;
  subtitle: string;
  y: number;
  h: number;
  color: string;
}

export type DiagramNodeKind =
  | 'mode'
  | 'schema'
  | 'need'
  | 'experience'
  | 'goals'
  | 'trigger'
  | 'problems'
  | 'placeholder';

/** Язык карты режимов: ребёнок — эллипс, критик — восьмиугольник и так далее. */
export type DiagramShape =
  | 'ellipse'
  | 'octagon'
  | 'pentagon'
  | 'shield'
  | 'pill'
  | 'rounded'
  | 'cloud'
  | 'tag';

export interface DiagramNode {
  id: string;
  kind: DiagramNodeKind;
  shape: DiagramShape;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sublabel?: string;
  /** Полный текст для подсказки, если в фигуре он обрезан. */
  title?: string;
  /** Название режима из метода (aria-label), когда главная строка — имя клиента. */
  name?: string;
  color: string;
  modeId?: string;
  schemaId?: string;
  needId?: string;
  lane?: ConceptLane;
  /** Режим без единой связи: рисуется пунктиром и без линий. */
  empty?: boolean;
}

export type DiagramEdgeKind =
  'feeds' | 'need' | 'presses' | 'protects' | 'cost' | 'triggers';

export interface Pt {
  x: number;
  y: number;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  kind: DiagramEdgeKind;
  /** Цепочка кубических кривых Безье: p0, c1, c2, p1, c1, c2, p2, … */
  points: Pt[];
  color: string;
  /** Обычная непрозрачность линии; при фокусе её перекрывает diagramFocus. */
  opacity: number;
  dashed?: boolean;
  label?: string;
  labelAt?: Pt;
}

export interface DiagramLayout {
  width: number;
  height: number;
  bands: DiagramBand[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

/** Размеры фигур. Ширина режима и схемы сужается только на телефоне (см. fitWidth). */
export const SIZE = {
  mode: { w: 168, h: 80 },
  schema: { w: 184, h: 40 },
  need: { w: 140, h: 36 },
  text: { w: 280, h: 76 },
  trigger: { w: 196, h: 80 },
  placeholder: { w: 168, h: 80 },
} as const;

export const SPACE = {
  /** Между фигурами. */
  gap: 16,
  /** Между зонами. */
  zoneGap: 28,
  /** Заголовок зоны над фигурами. */
  header: 40,
  /** Поле слева и справа. */
  pad: 16,
  /** Воздух под последним рядом зоны. */
  bottom: 16,
  /** Между кластерами «за кулисами»: здесь стоит подпись стрелки «давит». */
  clusterGap: 64,
  /** Между триггером и детьми: здесь стоит подпись «запускает». */
  triggerGap: 72,
  /** Узкая раскладка: расстояние между верхним и нижним кластером. */
  clusterRowGap: 36,
} as const;
