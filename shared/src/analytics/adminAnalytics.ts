// Контракт «Аналитики» в админке сайта: один формат для бэкенда
// (src/analytics/admin) и экрана (webapp/src/pages/admin/analytics).

/** Окно отчёта в днях. */
export const ADMIN_ANALYTICS_DAYS = [7, 30, 90] as const;
export type AdminAnalyticsDays = (typeof ADMIN_ANALYTICS_DAYS)[number];

export function isAdminAnalyticsDays(n: number): n is AdminAnalyticsDays {
  return (ADMIN_ANALYTICS_DAYS as readonly number[]).includes(n);
}

/** Один календарный день окна (МСК), без пропусков: пустой день — нули. */
export interface AdminDailyPoint {
  /** YYYY-MM-DD */
  date: string;
  /** Сколько людей открывали приложение. */
  active: number;
  /** Сколько людей пришло впервые. */
  newUsers: number;
  /** Сколько действий записано. */
  events: number;
}

/** Фича продукта: сколько раз ей пользовались и сколько разных людей. */
export interface AdminFeatureRow {
  id: string;
  /** Название человеческим языком, без имён событий. */
  title: string;
  events: number;
  users: number;
}

export interface AdminOverview {
  days: AdminAnalyticsDays;
  totals: {
    users: number;
    therapists: number;
    /** Клиенты с действующей связью с терапевтом. */
    clientsInTherapy: number;
    activeToday: number;
    active7: number;
    active30: number;
    newInPeriod: number;
  };
  daily: AdminDailyPoint[];
  /** По убыванию events. */
  features: AdminFeatureRow[];
}

/** Что терапевт сделал за окно: счётчики по видам работы. */
export interface AdminTherapistActions {
  notes: number;
  tasks: number;
  planItems: number;
  guideMarks: number;
  conceptualizations: number;
  customModes: number;
  invites: number;
}

export interface AdminTherapistRow {
  /** userId строкой (BigInt). */
  id: string;
  name: string;
  /** ISO-дата последнего захода в приложение; null — не заходил. */
  lastActive: string | null;
  /** В скольких днях окна заходил. */
  activeDays: number;
  clients: { active: number; pending: number; ended: number; virtual: number };
  actions: AdminTherapistActions;
  /** Сумма actions. */
  total: number;
  /** Действия по дням окна, старые → новые; длина = days. */
  daily: number[];
}

export interface AdminPersonRow {
  id: string;
  name: string;
  role: 'CLIENT' | 'THERAPIST';
  activeDays: number;
  events: number;
  lastActive: string | null;
  /** До трёх самых частых фич человека. */
  top: Array<{ title: string; count: number }>;
}

/** Раздел подробного отчёта (те же блоки, что были в /stats бота). */
export interface AdminStatsSectionInfo {
  id: string;
  title: string;
}

export interface AdminStatsSectionText extends AdminStatsSectionInfo {
  /** Текст с разметкой Telegram: только <b>, <i>, <code>, переносы строк. */
  text: string;
}

/** Действия терапевта: подписи для экрана, порядок = порядок показа. */
export const THERAPIST_ACTION_LABELS: Record<
  keyof AdminTherapistActions,
  string
> = {
  notes: 'Записи о сессиях',
  tasks: 'Задания клиентам',
  planItems: 'Пункты плана',
  guideMarks: 'Пометки в справочнике',
  conceptualizations: 'Концептуализации',
  customModes: 'Свои режимы',
  invites: 'Приглашения клиентов',
};

export function sumTherapistActions(a: AdminTherapistActions): number {
  return (
    a.notes +
    a.tasks +
    a.planItems +
    a.guideMarks +
    a.conceptualizations +
    a.customModes +
    a.invites
  );
}
