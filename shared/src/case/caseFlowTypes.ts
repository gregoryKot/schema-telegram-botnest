/**
 * Локальные типы потока «Разбор случая» — расширяют CaseAnswers (caseTypes.ts)
 * полями, которые ещё не финализированы в процессе прохождения: gateId
 * неизвестен до шага gate, а CaseAnswers.gateId — обязательный CaseGateId.
 * Полный CaseAnswers собирается из этих полей только когда gateId/modeId уже
 * гарантированно заданы (caseFlowMappers.ts → buildAnswers).
 *
 * Один источник для webapp/schema-miniapp (правило №3 CLAUDE.md) — вынесено
 * из schema-miniapp/src/components/caseFlow/caseFlowTypes.ts 2026-08:
 * ни хук состояния, ни эти типы не были завязаны ни на один платформенный
 * модуль (BottomSheet/haptic/api), только на shared. webapp подключает те же
 * типы, платформенные хуки (useCaseFlowState/useCaseFlowSave) у каждой
 * площадки свои — они завязаны на свой haptic/api/useTr.
 */
import type { CaseCriterionAnswers, CaseGateId } from './caseTypes';
import type { ModeEntrySaveData } from '../mode/modeDiarySteps';

/** Тело onSaveCard — карточка режима (UserModeNote, частичный апсерт). */
export interface CaseCardBody {
  modeId: string;
  alias?: string;
  triggers?: string;
  feelings?: string;
  behavior?: string;
}

/** Пропсы оркестратора потока — общая форма для CaseFlowSheet (miniapp) и
 *  CaseFlowScreen (webapp): каждая площадка сама решает, чем сохранять и
 *  куда вести дальше, форма контракта одна. */
export interface CaseFlowSheetProps {
  /** Сколько разборов уже было ДО этого — 0 показывает термин «режим». */
  caseCount: number;
  onSave: (data: ModeEntrySaveData) => Promise<void>;
  onSaveCard: (body: CaseCardBody) => Promise<void>;
  onSteadyDay: () => void;
  onOpenMap: () => void;
  onClose: () => void;
  onDoubt: () => void;
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
 *  один номер (миниапп: они вместе — «уточнение режима»). webapp объединяет
 *  их в один экран (ModeFeelingBrowse) и никогда не заходит в 'candidate' —
 *  запись здесь остаётся общей на случай, если площадка её использует. */
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
