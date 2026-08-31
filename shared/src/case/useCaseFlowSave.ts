import { useState } from 'react';
import { haptic } from '../host/haptic';
import { clearCaseDraft } from './caseDraft';
import { CASE_BODY_CHIPS } from './caseBodyChips';
import { CASE_IMPULSES } from './caseImpulses';
import { buildRecognition, type RecognitionView } from './caseRecognition';
import { caseVerdict, type CaseVerdict } from './caseCriterion';
import {
  buildAnswers,
  chipLabels,
  toCardBody,
  toSaveData,
} from './caseFlowMappers';
import type { CaseFlowBaseState } from './useCaseFlowState';
import type { CaseFlowSheetProps } from './caseFlowTypes';
import type { CaseFlowStateDeps } from './useCaseFlowState';

/**
 * Сохранение записи (onSave), карточки режима (onSaveCard) и переходы по
 * шагам ПОСЛЕ критерия (recognition → name → done) — общие для webapp и
 * schema-miniapp (правило №3 CLAUDE.md). В отличие от useCaseFlowState.ts,
 * этот файл ни одной строкой не завязан на выбор режима (gate/candidate) —
 * начинает работать уже когда modeId гарантированно известен, поэтому
 * поднят в shared целиком, без платформенных обёрток.
 */
export function useCaseFlowSave(
  state: CaseFlowBaseState,
  props: Pick<
    CaseFlowSheetProps,
    'caseCount' | 'onSave' | 'onSaveCard' | 'onDoubt'
  >,
  deps: CaseFlowStateDeps,
) {
  const { caseCount, onSave, onSaveCard, onDoubt } = props;
  const { fields, tr, setStep, saving, setSaving, savedRef } = state;
  const [verdict, setVerdict] = useState<CaseVerdict | null>(null);
  const [recognition, setRecognition] = useState<RecognitionView | null>(null);

  const handleCriterionNext = async () => {
    if (saving) return;
    const v = caseVerdict(fields.criterion);
    const gateId = fields.gateId ?? 'unknown';
    const rec = buildRecognition(buildAnswers(fields), {
      caseCount,
      tr,
      bodyLabels: chipLabels(CASE_BODY_CHIPS[gateId], fields.bodyChipIds),
      impulseLabels: chipLabels(CASE_IMPULSES, fields.impulseChipIds),
    });
    setSaving(true);
    try {
      await onSave(toSaveData(fields, rec));
      savedRef.current = true;
      clearCaseDraft();
      setVerdict(v);
      setRecognition(rec);
      deps.trackEvent('case_criterion', { verdict: v });
      setStep('recognition');
    } catch {
      haptic.error();
    } finally {
      setSaving(false);
    }
  };

  const handleRecognitionNext = () => {
    haptic.tap();
    deps.trackEvent('case_recognized', { modeId: fields.modeId, agreed: true });
    setStep('name');
  };
  const handleDoubt = () => {
    haptic.tap();
    deps.trackEvent('case_recognized', {
      modeId: fields.modeId,
      agreed: false,
    });
    onDoubt();
  };

  const confirmName = async (
    alias: string,
    source: 'chip' | 'own' | 'skipped',
  ) => {
    if (saving) return;
    state.patch({ alias });
    deps.trackEvent('mode_renamed', { source });
    if (verdict === 'mode' && recognition) {
      setSaving(true);
      try {
        await onSaveCard(toCardBody(fields.modeId, alias, recognition.traits));
      } catch {
        haptic.error();
      } finally {
        setSaving(false);
      }
    }
    deps.trackEvent('case_finished', { modeId: fields.modeId });
    setStep('done');
  };

  return {
    verdict,
    recognition,
    handleCriterionNext,
    handleRecognitionNext,
    handleDoubt,
    confirmName,
  };
}
