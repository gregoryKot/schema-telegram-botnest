import { useEffect, useRef, useState } from 'react';
import { haptic } from '../host/haptic';
import { useTr } from '../utils/addressForm';
import { detectCrisisAny } from '../utils/crisisMarkers';
import { saveCaseDraft, loadCaseDraft } from './caseDraft';
import {
  INITIAL_CASE_FIELDS,
  NO_BACK_STEPS,
  PROGRESS_META,
  type CaseFlowFields,
  type CaseFlowStep,
} from './caseFlowTypes';
import { suggestSecondDoor } from './caseImpulses';
import { toggleTappedChip, useCaseOwnSync } from './useCaseOwnSync';
import { useHardNowSupport } from './useCaseSupport';
import type { CaseCriterionAnswers } from './caseTypes';

/** Единственное, чем платформы платят за общий хук — событие аналитики.
 *  haptic/useTr/detectCrisisAny у webapp и schema-miniapp — буквально одна
 *  и та же реализация (реэкспорт), поэтому здесь импортированы напрямую, а
 *  не через DI. */
export interface CaseFlowStateDeps {
  trackEvent(name: string, meta?: Record<string, unknown>): void;
}

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
 * Поля потока + переходы ДО сохранения (hook…criterion), общие для webapp и
 * schema-miniapp (правило №3 CLAUDE.md — код поднят в shared 2026-08).
 *
 * Выбор режима (gate/candidate у миниаппа, один экран у webapp) и связанная
 * с ним навигация «назад» здесь СОЗНАТЕЛЬНО не живут: это единственное
 * место, где у площадок разный интерфейс (мини-апп заходит на 'candidate',
 * webapp — никогда), и втискивание обоих вариантов в общий хук раздуло бы
 * API вдвое ради шага, который каждая площадка проходит по-своему. Каждая
 * площадка добавляет свою функцию выбора режима и goBack поверх этого хука
 * (patch/setStep уже здесь) — см. schema-miniapp и webapp
 * components/caseFlow/useCaseFlowState.ts.
 */
export function useCaseFlowState(
  onClose: () => void,
  onSteadyDay: () => void,
  deps: CaseFlowStateDeps,
) {
  const tr = useTr();
  const support = useHardNowSupport();
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
  const goToScene = () => {
    if (!startedRef.current) {
      startedRef.current = true;
      deps.trackEvent('case_started', {});
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
    deps.trackEvent('case_scene', {
      source: fields.sceneFromFrame ? 'frame' : 'own',
    });
    setStep('gate');
  };
  const handleBodyNext = () => {
    haptic.tap();
    setStep('impulse');
  };
  const handleImpulseNext = () => {
    haptic.tap();
    setStep('criterion');
  };

  const toggleBodyChip = (id: string) => {
    const next = toggleTappedChip(fields.bodyChipIds, id, 2);
    if (next === null) {
      haptic.warning();
      return;
    }
    haptic.tap();
    patch({ bodyChipIds: next });
  };
  const applyImpulseIds = (ids: string[]) => {
    patch({ impulseChipIds: ids });
    setSecondDoorModeId(
      suggestSecondDoor(fields.gateId ?? 'unknown', ids, fields.modeId),
    );
  };
  const toggleImpulseChip = (id: string) => {
    const next = toggleTappedChip(fields.impulseChipIds, id, 3);
    if (next === null) {
      haptic.warning();
      return;
    }
    haptic.tap();
    applyImpulseIds(next);
  };

  // Непустой bodyOwn/impulseOwn = «своё выбрано» (см. useCaseOwnSync).
  useCaseOwnSync(fields, patch, applyImpulseIds);

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
    ...support,
    handleLater,
    goToScene,
    handleSteadyDay,
    handleSceneNext,
    handleBodyNext,
    handleImpulseNext,
    toggleBodyChip,
    toggleImpulseChip,
    handleCriterionAnswer,
  };
}

export type CaseFlowBaseState = ReturnType<typeof useCaseFlowState>;
