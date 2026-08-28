import { useState } from 'react';
import { haptic } from '../../haptic';
import { api } from '../../api';
import { clearCaseDraft } from './caseDraft';
import { CASE_BODY_CHIPS } from '../../../../shared/src/case/caseBodyChips';
import { CASE_IMPULSES } from '../../../../shared/src/case/caseImpulses';
import {
  buildRecognition,
  type RecognitionView,
} from '../../../../shared/src/case/caseRecognition';
import {
  caseVerdict,
  type CaseVerdict,
} from '../../../../shared/src/case/caseCriterion';
import {
  buildAnswers,
  chipLabels,
  toCardBody,
  toSaveData,
} from './caseFlowMappers';
import type { CaseFlowState } from './useCaseFlowState';
import type { CaseFlowSheetProps } from './caseFlowTypes';

/**
 * Сохранение записи (onSave), карточки режима (onSaveCard) и переходы по
 * шагам ПОСЛЕ критерия (recognition → name → done). Отделено от
 * useCaseFlowState.ts, чтобы ни один файл не пробивал потолок 300 строк
 * (правило №10 CLAUDE.md) — здесь живёт вся асинхронность потока.
 */
export function useCaseFlowSave(
  state: CaseFlowState,
  props: Pick<
    CaseFlowSheetProps,
    'caseCount' | 'onSave' | 'onSaveCard' | 'onDoubt'
  >,
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
      api.trackEvent('case_criterion', { verdict: v });
      setStep('recognition');
    } catch {
      haptic.error();
    } finally {
      setSaving(false);
    }
  };

  const handleRecognitionNext = () => {
    haptic.tap();
    api.trackEvent('case_recognized', { modeId: fields.modeId, agreed: true });
    setStep('name');
  };
  const handleDoubt = () => {
    haptic.tap();
    api.trackEvent('case_recognized', {
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
    api.trackEvent('mode_renamed', { source });
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
    api.trackEvent('case_finished', { modeId: fields.modeId });
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
