import { useEffect, useRef, useState } from 'react';
import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import { api } from '../../api';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { saveCaseDraft, loadCaseDraft } from './caseDraft';
import {
  INITIAL_CASE_FIELDS,
  NO_BACK_STEPS,
  PROGRESS_META,
  type CaseFlowFields,
  type CaseFlowStep,
} from './caseFlowTypes';
import { asCaseGateId, gateIdForMode } from './caseFlowMappers';
import { suggestSecondDoor } from '../../../../shared/src/case/caseImpulses';
import type { CaseCriterionAnswers } from '../../../../shared/src/case/caseTypes';

function initialState(): { step: CaseFlowStep; fields: CaseFlowFields } {
  const draft = loadCaseDraft();
  if (!draft) return { step: 'hook', fields: INITIAL_CASE_FIELDS };
  const { step, ...rest } = draft;
  // recognition/name/done — уже сохранённая запись, черновика такого шага не
  // бывает (clearCaseDraft вызывается сразу после onSave); hook — начало.
  const resumable = NO_BACK_STEPS.has(step) || step === 'hook' ? 'hook' : step;
  return { step: resumable, fields: { ...INITIAL_CASE_FIELDS, ...rest } };
}

/**
 * Поля потока + навигация между шагами ДО сохранения (hook…criterion).
 * Сохранение/узнавание/имя — в useCaseFlowSave.ts (тот же файл распух бы
 * за 300 строк — правило №10 CLAUDE.md).
 */
export function useCaseFlowState(
  onClose: () => void,
  onSteadyDay: () => void,
  onHardNow: () => void,
) {
  const tr = useTr();
  const init = useState(initialState)[0];
  const [step, setStep] = useState<CaseFlowStep>(init.step);
  const [fields, setFields] = useState<CaseFlowFields>(init.fields);
  const [secondDoorModeId, setSecondDoorModeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(false);
  const startedRef = useRef(false);

  const patch = (p: Partial<CaseFlowFields>) =>
    setFields((f) => ({ ...f, ...p }));

  // Автосохранение черновика на каждом шаге, кроме hook (там ещё нечего
  // сохранять) — handleLater ниже досылает его же синхронно на выход.
  useEffect(() => {
    if (step === 'hook') return;
    saveCaseDraft({ step, ...fields });
  }, [step, fields]);

  const handleLater = () => {
    haptic.tap();
    if (!savedRef.current) saveCaseDraft({ step, ...fields });
    onClose();
  };
  const handleHardNow = () => {
    haptic.tap();
    onHardNow();
  };
  const goToScene = () => {
    if (!startedRef.current) {
      startedRef.current = true;
      api.trackEvent('case_started', {});
    }
    haptic.tap();
    setStep('scene');
  };
  const handleSteadyDay = () => {
    haptic.tap();
    onSteadyDay();
    onClose();
  };
  const handleSceneNext = () => {
    haptic.tap();
    api.trackEvent('case_scene', {
      source: fields.sceneFromFrame ? 'frame' : 'own',
    });
    setStep('gate');
  };
  const goBack = () => {
    haptic.tap();
    if (step === 'scene') setStep('hook');
    else if (step === 'gate') setStep('scene');
    else if (step === 'candidate') {
      patch({ gateId: null });
      setStep('gate');
    } else if (step === 'body') setStep('candidate');
    else if (step === 'impulse') setStep('body');
    else if (step === 'criterion') setStep('impulse');
  };

  const pickGroup = (id: string) => {
    patch({ gateId: asCaseGateId(id) });
    setStep('candidate');
  };
  const pickModeFromGate = (id: string) => {
    patch({ modeId: id, gateId: fields.gateId ?? gateIdForMode(id) });
    setStep('body');
  };
  const pickModeFromCandidate = (id: string) => {
    patch({ modeId: id });
    setStep('body');
  };
  const backToGate = () => {
    patch({ gateId: null });
    setStep('gate');
  };
  const pickGroupOnCandidate = (id: string) =>
    patch({ gateId: asCaseGateId(id) });
  const handleBodyNext = () => {
    haptic.tap();
    setStep('impulse');
  };
  const handleImpulseNext = () => {
    haptic.tap();
    setStep('criterion');
  };

  const toggleBodyChip = (id: string) => {
    const has = fields.bodyChipIds.includes(id);
    if (!has && fields.bodyChipIds.length >= 2) {
      haptic.warning();
      return;
    }
    haptic.tap();
    patch({
      bodyChipIds: has
        ? fields.bodyChipIds.filter((x) => x !== id)
        : [...fields.bodyChipIds, id],
    });
  };
  const toggleImpulseChip = (id: string) => {
    const has = fields.impulseChipIds.includes(id);
    if (!has && fields.impulseChipIds.length >= 3) {
      haptic.warning();
      return;
    }
    haptic.tap();
    const nextIds = has
      ? fields.impulseChipIds.filter((x) => x !== id)
      : [...fields.impulseChipIds, id];
    patch({ impulseChipIds: nextIds });
    setSecondDoorModeId(
      suggestSecondDoor(fields.gateId ?? 'unknown', nextIds, fields.modeId),
    );
  };

  const handleCriterionAnswer = (
    key: keyof CaseCriterionAnswers,
    value: boolean,
  ) => {
    haptic.tap();
    patch({ criterion: { ...fields.criterion, [key]: value } });
  };

  const crisis = detectCrisisAny(
    fields.scene,
    fields.bodyOwn,
    fields.impulseOwn,
    fields.alias,
  );

  return {
    tr,
    step,
    setStep,
    fields,
    patch,
    saving,
    setSaving,
    savedRef,
    secondDoorModeId,
    progress: PROGRESS_META[step],
    crisis,
    onBack: NO_BACK_STEPS.has(step) ? undefined : goBack,
    handleLater,
    handleHardNow,
    goToScene,
    handleSteadyDay,
    handleSceneNext,
    pickGroup,
    pickModeFromGate,
    pickModeFromCandidate,
    backToGate,
    pickGroupOnCandidate,
    handleBodyNext,
    handleImpulseNext,
    toggleBodyChip,
    toggleImpulseChip,
    handleCriterionAnswer,
  };
}

export type CaseFlowState = ReturnType<typeof useCaseFlowState>;
