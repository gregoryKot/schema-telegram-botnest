// Путь клиента: потолки и форма ответа API. Двойник на сайте —
// shared/src/therapy/path/pathModel.ts; равенство держит therapy-path.types.sync.spec.ts.
export const PATH_PHASES_MAX = 20;
export const PATH_PHASE_WEEKS_MAX = 260;
export const PATH_PHASE_NAME_MAX = 120;
export const PATH_PHASE_GOAL_MAX = 1000;
export const PATH_PHASE_NOTE_MAX = 4000;

// Только сервер: длина id шаблона и его фазы, число отмеченных критериев фазы.
export const PATH_TEMPLATE_ID_MAX = 64;
export const PATH_CRITERIA_MAX = 50;

export interface PathPhaseView {
  id: number;
  position: number;
  name: string;
  goal: string | null;
  weeks: number;
  templatePhaseId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  criteriaDone: number[];
  note: string | null;
}

/** Путь целиком: фазы по position. Одна форма у всех ручек `/api/therapy/path`. */
export interface TherapyPathView {
  id: number;
  clientId: string;
  startDate: string;
  templateId: string | null;
  phases: PathPhaseView[];
  createdAt: string;
  updatedAt: string;
}

/** Фаза к созданию: из шаблона или своя. */
export interface PathPhaseDraft {
  name: string;
  goal?: string | null;
  weeks: number;
  templatePhaseId?: string | null;
}

export interface PathPhasePatch {
  name?: string;
  goal?: string | null;
  weeks?: number;
  note?: string | null;
  criteriaDone?: number[];
  startedAt?: string | null;
  endedAt?: string | null;
}
