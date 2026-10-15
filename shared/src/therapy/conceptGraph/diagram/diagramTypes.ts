// Типы и размеры диаграммы концептуализации. Раскладка — чистая функция
// (diagramLayout.ts): на вход модель графа и ширина, на выход фигуры, секции и
// линии в пикселях. React здесь не нужен, поэтому всё проверяется тестами без DOM.

/** Секция диаграммы: у каждой свой заголовок и своя кнопка добавления. */
export type SectionId = 'modes' | 'schemas' | 'needs' | 'healthy';

/** Секции с кнопкой добавления: у круга потребностей её нет. */
export type AddSection = Exclude<SectionId, 'needs'>;

export type DiagramNodeKind =
  'mode' | 'schema' | 'origin' | 'need' | 'placeholder';

/** Язык карты режимов: ребёнок — эллипс, критик — восьмиугольник и так далее. */
export type DiagramShape =
  'ellipse' | 'octagon' | 'pentagon' | 'shield' | 'pill' | 'rounded';

export interface DiagramNode {
  id: string;
  kind: DiagramNodeKind;
  shape: DiagramShape;
  section: SectionId;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Главная строка: имя клиента, название режима или схемы, потребности. */
  label: string;
  /** Мелкая строка под названием: название режима из метода, вид копинга. */
  sublabel?: string;
  /** Мелкая подпись над текстом (у овала опыта). */
  caption?: string;
  /** Текст терапевта на фигуре: убеждение, опыт, что говорит / делает. */
  body?: string;
  /** Сколько строк текста фигура вмещает; больше — обрезка многоточием. */
  bodyLines?: number;
  /** Название режима из метода (aria-label), когда главная строка — имя клиента. */
  name?: string;
  /** Подсказка при наведении у заготовки. */
  title?: string;
  color: string;
  modeId?: string;
  schemaId?: string;
  needId?: string;
  /** Режим или схема без единой связи и текста: бледный контур. */
  empty?: boolean;
}

export type DiagramEdgeKind = 'link' | 'origin' | 'blocks' | 'meets';

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
  /** Стрелки на обоих концах: режим ⇄ схема. */
  both?: boolean;
  /** Значок посередине: ✗ — схема блокирует потребность, ✓ — о ней заботятся. */
  badge?: { at: Pt; kind: 'block' | 'meet' };
}

export interface DiagramSection {
  id: AddSection;
  title: string;
  hint: string;
  x: number;
  y: number;
  w: number;
  /** Подпись кнопки добавления; у секции потребностей кнопки нет. */
  add?: string;
}

export interface DiagramCircle {
  cx: number;
  cy: number;
  r: number;
  title: string;
}

export interface DiagramLayout {
  width: number;
  height: number;
  /** Четыре колонки (true) или секции друг под другом (false). */
  wide: boolean;
  sections: DiagramSection[];
  circle: DiagramCircle;
  /** Высота подписи круга. */
  titleY: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

/** Шире этого — четыре колонки, уже — секции друг под другом. */
export const WIDE_MIN = 960;
