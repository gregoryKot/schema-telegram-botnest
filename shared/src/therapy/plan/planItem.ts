// План работы с клиентом (#1337): форма пункта в ответе API и рубрики. Списки значений — те же, что на
// сервере (src/therapy/therapy-plan.types.ts); равенство держит src/therapy/therapy-plan.types.sync.spec.ts.
// Подписи рубрик — единственное место: их берут и лист режима «Справочника» (ModeGuideSheet), и вкладка «План работы».

/** Четыре канала метода — «Как работать» листа режима, рубрики плана и первые группы «Техник» справочника:
 *  заголовок — книжный термин, подпись — простыми словами. */
export const GUIDE_CHANNELS = [
  {
    id: 'relationship',
    title: 'Терапевтические отношения',
    hint: 'в отношениях',
  },
  { id: 'cognitive', title: 'Когнитивные', hint: 'через понимание' },
  { id: 'experiential', title: 'Эмпирические', hint: 'через чувства и образы' },
  { id: 'behavioral', title: 'Поведенческие', hint: 'в жизни' },
] as const;
export type GuideChannel = (typeof GUIDE_CHANNELS)[number]['id'];

/** Подпись канала одной строкой: термин и простыми словами в скобках. */
export const channelLabel = (c: { title: string; hint: string }) =>
  `${c.title} (${c.hint})`;

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
  ...(Object.fromEntries(
    GUIDE_CHANNELS.map((c) => [c.id, channelLabel(c)]),
  ) as Record<GuideChannel, string>),
  session: 'На сессии',
  between: 'Между сессиями',
  custom: 'Своё',
};

export const PLAN_STATUSES = ['planned', 'active', 'done'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

/** Источник пункта до адресов (#1484): вид, id статьи и поле рубрики — переводит planAddress.ts. */
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
  /** Адрес раздела справочника; null — свой пункт или пункт до адресов (тогда `source`). */
  sourceAddress: string | null;
  source: PlanSource | null;
  /** Задание, которым пункт выдан клиенту; задание удалили — null. */
  taskId: number | null;
  createdAt: string;
  updatedAt: string;
}
