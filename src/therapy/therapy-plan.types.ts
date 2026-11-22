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

export const PLAN_STATUSES = [
  'planned',
  'active',
  'done',
  'postponed',
  'dropped',
] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

// Вид статьи справочника в старом источнике пункта (до адресов, #1484).
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
  /** Адрес раздела справочника (#1484); null — свой пункт или пункт до адресов. */
  sourceAddress: string | null;
  /** Источник до адресов: сайт переводит его в адрес, если sourceAddress пуст. */
  source: PlanSource | null;
  taskId: number | null;
  /** Фаза пути клиента, к которой отнесён пункт; null — вне фаз. */
  phaseId: number | null;
  createdAt: Date;
  updatedAt: Date;
}
