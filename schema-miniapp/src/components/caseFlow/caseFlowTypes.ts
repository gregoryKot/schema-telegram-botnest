/**
 * Локальные типы потока «Разбор случая» — расширяют CaseAnswers (shared)
 * полями, которые ещё не финализированы в процессе прохождения: gateId
 * неизвестен до шага gate, а CaseAnswers.gateId — обязательный CaseGateId
 * (shared/src/case/caseTypes.ts не заводит для него пустого значения,
 * это не наш файл — трогать его вне ТЗ этой задачи нельзя). Полный
 * CaseAnswers собирается из этих полей только когда gateId/modeId уже
 * гарантированно заданы (caseFlowMappers.ts → buildAnswers).
 */
import type {
  CaseCriterionAnswers,
  CaseGateId,
} from '../../../../shared/src/case/caseTypes';
import type { ModeEntrySaveData } from '../../../../shared/src/mode/modeDiarySteps';

/** Тело onSaveCard — карточка режима (UserModeNote, частичный апсерт). */
export interface CaseCardBody {
  modeId: string;
  alias?: string;
  triggers?: string;
  feelings?: string;
  behavior?: string;
}

/** Пропсы оркестратора — вынесены сюда (не в useCaseFlow.ts), потому что их
 *  импортируют и useCaseFlowState.ts, и useCaseFlowSave.ts. */
export interface CaseFlowSheetProps {
  /** Сколько разборов уже было ДО этого — 0 показывает термин «режим». */
  caseCount: number;
  onSave: (data: ModeEntrySaveData) => Promise<void>;
  onSaveCard: (body: CaseCardBody) => Promise<void>;
  onSteadyDay: () => void;
  onOpenMap: () => void;
  onClose: () => void;
  onDoubt: () => void;
  onHardNow: () => void;
}

/** Экраны потока, в порядке прохождения. */
export type CaseFlowStep =
  | 'hook'
  | 'scene'
  | 'gate'
  | 'candidate'
  | 'body'
  | 'impulse'
  | 'criterion'
  | 'recognition'
  | 'name'
  | 'done';

export interface CaseFlowFields {
  scene: string;
  sceneFromFrame: boolean;
  /** Рамка, которую человек выбрал — '' если рамку не брали (hasOwnDetail). */
  chosenFrame: string;
  gateId: CaseGateId | null;
  modeId: string;
  bodyChipIds: string[];
  bodyOwn: string;
  impulseChipIds: string[];
  impulseOwn: string;
  criterion: CaseCriterionAnswers;
  alias: string;
}

export const INITIAL_CASE_FIELDS: CaseFlowFields = {
  scene: '',
  sceneFromFrame: false,
  chosenFrame: '',
  gateId: null,
  modeId: '',
  bodyChipIds: [],
  bodyOwn: '',
  impulseChipIds: [],
  impulseOwn: '',
  criterion: { biggerThanCause: null, talkedDown: null },
  alias: '',
};

/** Шаги, где нужен верхний прогресс «Шаг N из 5» — gate/candidate делят
 *  один номер (они вместе — «уточнение режима», как шаги 0/1 ModeEntrySheet). */
export const PROGRESS_META: Partial<
  Record<CaseFlowStep, { step: number; label: string }>
> = {
  scene: { step: 0, label: 'Шаг 1 из 5' },
  gate: { step: 1, label: 'Шаг 2 из 5' },
  candidate: { step: 1, label: 'Шаг 2 из 5' },
  body: { step: 2, label: 'Шаг 3 из 5' },
  impulse: { step: 3, label: 'Шаг 4 из 5' },
  criterion: { step: 4, label: 'Шаг 5 из 5' },
};

/** Шаги после сохранения — назад некуда: данные уже записаны, редактирование
 *  задним числом в эту версию потока не входит. */
export const NO_BACK_STEPS: ReadonlySet<CaseFlowStep> = new Set([
  'recognition',
  'name',
  'done',
]);
