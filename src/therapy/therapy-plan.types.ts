// Рубрики плана работы: четыре направления «Как работать» из справочника,
// «На сессии», «Между сессиями» и свой пункт терапевта.
export const PLAN_RUBRICS = [
  'relationship',
  'cognitive',
  'experiential',
  'behavioral',
  'session',
  'between',
  'custom',
] as const;
export type PlanRubric = (typeof PLAN_RUBRICS)[number];

export const PLAN_STATUSES = ['planned', 'active', 'done'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

// Вид статьи справочника, из которой взят пункт.
export const PLAN_SOURCE_KINDS = ['schema', 'mode', 'technique'] as const;

export interface PlanSource {
  kind: string;
  id: string;
  field: string;
}

/** Пункт плана в ответе API: одна форма у списка, создания и правки. */
export interface PlanItemView {
  id: number;
  clientId: string;
  rubric: string;
  text: string;
  status: string;
  position: number;
  source: PlanSource | null;
  taskId: number | null;
  createdAt: Date;
  updatedAt: Date;
}
