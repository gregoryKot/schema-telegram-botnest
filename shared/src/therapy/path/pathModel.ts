// Путь клиента (#1522): фазы терапии со сроками поверх «Плана работы». Форма ответа ручек
// `/api/therapy/path` и потолки полей — те же, что на сервере (src/therapy/therapy-path.types.ts).

/** Потолки: фаз в пути, недель у фазы, длины названия, цели и заметки. */
export const PATH_PHASES_MAX = 20;
export const PATH_PHASE_WEEKS_MAX = 260;
export const PATH_PHASE_NAME_MAX = 120;
export const PATH_PHASE_GOAL_MAX = 1000;
export const PATH_PHASE_NOTE_MAX = 4000;

export interface PathPhase {
  id: number;
  position: number;
  name: string;
  goal: string | null;
  /** Срок фазы, недель: даты считаются от старта пути (pathPlan.ts). */
  weeks: number;
  /** id фазы шаблона (критерии перехода, ошибки, рекомендуемое); null — своя фаза. */
  templatePhaseId: string | null;
  /** Календарные дни `YYYY-MM-DD`: когда фазу начали и закончили на деле. */
  startedAt: string | null;
  endedAt: string | null;
  /** Отмеченные критерии перехода: номера пунктов `transition` фазы шаблона. */
  criteriaDone: number[];
  note: string | null;
}

export interface TherapyPath {
  id: number;
  clientId: string;
  /** Старт пути, календарный день `YYYY-MM-DD`. */
  startDate: string;
  /** id шаблона, из которого путь собран; null — собран с нуля. */
  templateId: string | null;
  phases: PathPhase[];
  createdAt: string;
  updatedAt: string;
}

/** Фаза к созданию: из шаблона или своя. */
export type PathPhaseDraft = Pick<
  PathPhase,
  'name' | 'goal' | 'weeks' | 'templatePhaseId'
>;
