// Общие заготовки тестов диаграммы: модель графа из куска источника, богатый
// случай с линиями всех видов и проверки геометрии.
import type { ConceptModeLink, ConceptSchemaLink } from '../../../apiTypes';
import { buildConceptGraph } from '../conceptGraphModel';
import type { ConceptGraphSource } from '../conceptGraphTypes';
import { emptyModeLink } from '../modeLinks';
import { emptySchemaLink } from '../schemaLinks';
import { bezierAt, type Rect } from './diagramCurves';
import { layoutConceptDiagram } from './diagramLayout';
import type { DiagramLayout, DiagramNode, Pt } from './diagramTypes';

export const mode = (
  modeId: string,
  patch: Partial<ConceptModeLink> = {},
): ConceptModeLink => ({ ...emptyModeLink(modeId), ...patch });

export const schema = (
  schemaId: string,
  patch: Partial<ConceptSchemaLink> = {},
): ConceptSchemaLink => ({ ...emptySchemaLink(schemaId), ...patch });

export const source = (
  patch: Partial<ConceptGraphSource> = {},
): ConceptGraphSource => ({
  modeIds: [],
  schemaIds: [],
  modeLinks: [],
  schemaLinks: [],
  ...patch,
});

export const layoutOf = (
  patch: Partial<ConceptGraphSource>,
  width: number,
): DiagramLayout =>
  layoutConceptDiagram(
    buildConceptGraph(source(patch), (ty) => ty),
    width,
  );

/** Случай как у владельца: две схемы с опытом, критики, копинг, ребёнок и Здоровый Взрослый. */
export const RICH: Partial<ConceptGraphSource> = {
  modeIds: [
    'guilt_critic',
    'punitive_critic',
    'vulnerable_child',
    'detached_protector',
    'healthy_adult',
  ],
  schemaIds: ['emotional_deprivation', 'emotional_inhibition'],
  modeLinks: [
    mode('guilt_critic', {
      manifest: 'Если я заявлю о своих потребностях, близким будет плохо',
      schemaIds: ['emotional_deprivation'],
    }),
    mode('punitive_critic', {
      manifest: 'Я слабый, если буду плакать',
      schemaIds: ['emotional_deprivation', 'emotional_inhibition'],
    }),
    mode('detached_protector', {
      alias: 'Глиняная оболочка',
      manifest: 'Перестаёт чувствовать, говорит на отстранённые темы',
      schemaIds: ['emotional_inhibition'],
    }),
    mode('healthy_adult', {
      manifest: 'Я имею право на поддержку и заботу',
      needIds: ['autonomy', 'play', 'attachment'],
    }),
  ],
  schemaLinks: [
    schema('emotional_deprivation', {
      belief: 'Я верю, что мои переживания не имеют смысла',
      origin: 'Был вынужден выполнять роль партнёра мамы после ухода папы',
      needIds: ['attachment', 'expression'],
    }),
    schema('emotional_inhibition', {
      belief: 'Кажется, что я просто ничего не чувствую',
      origin: 'Видел, как папа бьёт брата за то, что тот не молчал',
      needIds: ['expression', 'limits'],
    }),
  ],
};

export const rect = (n: DiagramNode): Rect => ({
  x: n.x,
  y: n.y,
  w: n.w,
  h: n.h,
});

export const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function curvePoints(points: Pt[], per = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 3 < points.length; i += 3) {
    for (let k = 0; k <= per; k++)
      out.push(bezierAt(points.slice(i, i + 4), k / per));
  }
  return out;
}

export const node = (l: DiagramLayout, id: string) =>
  l.nodes.find((n) => n.id === id)!;

export const bySection = (l: DiagramLayout, section: string) =>
  l.nodes.filter((n) => n.section === section);
