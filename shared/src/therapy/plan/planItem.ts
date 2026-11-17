// План работы с клиентом (#1337): форма пункта в ответе API и рубрики. Списки значений — те же, что на
// сервере (src/therapy/therapy-plan.types.ts); равенство держит src/therapy/therapy-plan.types.sync.spec.ts.
// Подписи рубрик — единственное место: их берут и лист режима «Справочника» (ModeGuideSheet), и вкладка «План работы».

/** Четыре направления «Как работать» листа режима — в порядке справочника, простыми словами. */
export const GUIDE_CHANNELS = [
  ['relationship', 'В отношениях'],
  ['cognitive', 'Через понимание'],
  ['experiential', 'Через чувства и образы'],
  ['behavioral', 'В жизни'],
] as const;

/** Рубрики плана в порядке показа: направления справочника, «На сессии», «Между сессиями», своё. */
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

export const PLAN_RUBRIC_LABEL: Record<PlanRubric, string> = {
  ...(Object.fromEntries(GUIDE_CHANNELS) as Record<
    (typeof GUIDE_CHANNELS)[number][0],
    string
  >),
  session: 'На сессии',
  between: 'Между сессиями',
  custom: 'Своё',
};

export const PLAN_STATUSES = ['planned', 'active', 'done'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

/** Статья справочника, из которой взят пункт: вид, id статьи и поле рубрики. */
export interface PlanSource {
  kind: 'schema' | 'mode' | 'technique';
  id: string;
  field: string;
}

export interface PlanItem {
  id: number;
  clientId: string;
  rubric: PlanRubric;
  text: string;
  status: PlanStatus;
  position: number;
  source: PlanSource | null;
  /** Задание, которым пункт выдан клиенту; задание удалили — null. */
  taskId: number | null;
  createdAt: string;
  updatedAt: string;
}
