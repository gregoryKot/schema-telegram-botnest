/**
 * Чистые функции потока «Разбор случая»: перевод локального CaseFlowFields
 * в CaseAnswers/onSave/onSaveCard. Вынесено из CaseFlowSheet.tsx, чтобы
 * оркестратор оставался тонким (CLAUDE.md — «держи оркестратор тонким»).
 */
import type {
  CaseAnswers,
  CaseGateId,
} from '../../../../shared/src/case/caseTypes';
import type { CaseChip } from '../../../../shared/src/case/caseBodyChips';
import type { ModeEntrySaveData } from '../../../../shared/src/mode/modeDiarySteps';
import type { RecognitionView } from '../../../../shared/src/case/caseRecognition';
import { findPickerGroupIdByModeId } from '../../../../shared/src/mode/modeFeelGates';
import type { CaseCardBody, CaseFlowFields } from './caseFlowTypes';

/** Кастует id ворот в CaseGateId — FEEL_GATES и CaseGateId читают из одного
 *  источника (caseTypes.ts), поэтому любой найденный id точно входит в union;
 *  null — только защитная страховка на случай режима вне реестра. */
export function asCaseGateId(id: string | null): CaseGateId {
  return (id ?? 'unknown') as CaseGateId;
}

/** Ворота по modeId, выбранному в обход шага gate («Все режимы по группам»
 *  внутри ModeStateStep) — тот же приём, что у pickMode в ModeEntrySheet. */
export function gateIdForMode(modeId: string): CaseGateId {
  return asCaseGateId(findPickerGroupIdByModeId(modeId));
}

/** Подписи выбранных чипов в порядке ids — сырые (с «Своё…»), joinTraitLabels
 *  внутри buildRecognition сама подставит bodyOwn/impulseOwn. */
export function chipLabels(chips: CaseChip[], ids: string[]): string[] {
  return ids
    .map((id) => chips.find((c) => c.id === id)?.label)
    .filter((label): label is string => Boolean(label));
}

/** Полный CaseAnswers из накопленных полей — вызывать только когда
 *  gateId/modeId уже гарантированно заданы (после шагов gate/candidate). */
export function buildAnswers(fields: CaseFlowFields): CaseAnswers {
  return {
    scene: fields.scene,
    sceneFromFrame: fields.sceneFromFrame,
    gateId: fields.gateId ?? 'unknown',
    modeId: fields.modeId,
    bodyChipIds: fields.bodyChipIds,
    bodyOwn: fields.bodyOwn,
    impulseChipIds: fields.impulseChipIds,
    impulseOwn: fields.impulseOwn,
    criterion: fields.criterion,
    alias: fields.alias,
  };
}

/** Маппинг в дневник режимов (onSave): situation ← сцена, bodyFeelings/
 *  actions ← те же подписи, что видит человек на экране узнавания
 *  (RecognitionView.traits) — не пересчитываем вторую формулировку. */
export function toSaveData(
  fields: CaseFlowFields,
  recognition: RecognitionView,
): ModeEntrySaveData {
  return {
    modeId: fields.modeId,
    situation: recognition.chain.scene,
    bodyFeelings: recognition.traits.body || undefined,
    actions: recognition.traits.impulse || undefined,
  };
}

/** Маппинг в карточку режима (onSaveCard) — вызывается только при вердикте
 *  'mode', после шага name (alias уже известен, может быть пустым). */
export function toCardBody(
  modeId: string,
  alias: string,
  traits: RecognitionView['traits'],
): CaseCardBody {
  return {
    modeId,
    alias: alias.trim() || undefined,
    triggers: traits.trigger || undefined,
    feelings: traits.body || undefined,
    behavior: traits.impulse || undefined,
  };
}
