import { useEffect, useRef, useState } from 'react';
import { haptic } from '../../host/haptic';
import { useTr } from '../../utils/addressForm';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CASE_BODY_CHIPS } from '../caseBodyChips';
import { CASE_IMPULSES } from '../caseImpulses';
import {
  IMPULSE_OWN_ID,
  ownChipIdForGate,
  syncOwnChipId,
  toggleTappedChip,
} from '../useCaseOwnSync';
import { useHardNowSupport } from '../useCaseSupport';
import type { CaseGateId } from '../caseTypes';
import {
  BODY_LIMIT,
  IMPULSE_LIMIT,
  INITIAL_QUICK_FIELDS,
  STEADY_GATE_ID,
  STEADY_MODE_ID,
  buildQuickCardBody,
  buildQuickResult,
  buildQuickSaveData,
  buildSteadySaveData,
  pickCandidateMode,
  quickModeName,
  resolveModeId,
  type CaseQuickFields,
  type CaseQuickProps,
  type CaseQuickStep,
} from './caseQuick';
import {
  clearQuickDraft,
  loadQuickDraft,
  saveQuickDraft,
} from './caseQuickDraft';

export interface CaseQuickDeps {
  trackEvent(name: string, meta?: Record<string, unknown>): void;
}

/** Куда вернуться в черновике: «modes», «done» и «steady» — не состояния. */
function initialState(): { step: CaseQuickStep; fields: CaseQuickFields } {
  const draft = loadQuickDraft();
  if (!draft) return { step: 'scene', fields: INITIAL_QUICK_FIELDS };
  const { step, ...rest } = draft;
  const fields = { ...INITIAL_QUICK_FIELDS, ...rest };
  if (step === 'steady' || fields.gateId === STEADY_GATE_ID) {
    return { step: 'feel', fields: { ...fields, gateId: null } };
  }
  if ((step === 'result' || step === 'modes') && !fields.gateId) {
    return { step: 'feel', fields };
  }
  if (step === 'modes' || step === 'done') return { step: 'result', fields };
  return { step, fields };
}

/**
 * Состояние потока «Что случилось» в три шага (сайт): момент → что внутри →
 * что хотелось сделать → итог. Все переходы и сохранение здесь; экраны —
 * только разметка. Старый useCaseFlowState остался мини-аппу.
 *
 * Инвариант «Своё…»: непустой bodyOwn/impulseOwn = «своё выбрано», id `*_own`
 * в выборе поддерживает эффект ниже (как useCaseOwnSync старого потока), а не
 * экран — иначе набранное «своё» молча пропало бы из итога.
 */
export function useCaseQuickFlow(
  props: Pick<CaseQuickProps, 'onSave' | 'onSaveCard' | 'onClose'>,
  deps: CaseQuickDeps,
) {
  const tr = useTr();
  const support = useHardNowSupport();
  const init = useState(initialState)[0];
  const [step, setStep] = useState<CaseQuickStep>(init.step);
  const [fields, setFields] = useState<CaseQuickFields>(init.fields);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [savedModeId, setSavedModeId] = useState('');
  const startedRef = useRef(false);
  const savedRef = useRef(false);

  const patch = (p: Partial<CaseQuickFields>) =>
    setFields((f) => ({ ...f, ...p }));

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    deps.trackEvent('case_started', {});
  });

  // Черновик пишется на каждом шаге до сохранения; пустой поток — не черновик.
  useEffect(() => {
    if (savedRef.current || step === 'done') return;
    if (!fields.scene.trim() && step === 'scene') return;
    saveQuickDraft({ step, ...fields });
  }, [step, fields]);

  useEffect(() => {
    const body = syncOwnChipId(
      fields.bodyChipIds,
      ownChipIdForGate(fields.gateId),
      fields.bodyOwn,
    );
    if (body) patch({ bodyChipIds: body });
    const impulse = syncOwnChipId(
      fields.impulseChipIds,
      IMPULSE_OWN_ID,
      fields.impulseOwn,
    );
    if (impulse) patch({ impulseChipIds: impulse, modeId: '' });
  });

  const bodyChips = CASE_BODY_CHIPS[fields.gateId ?? 'unknown'];
  const crisis = detectCrisisAny(
    fields.scene,
    fields.bodyOwn,
    fields.impulseOwn,
  );

  const goStep = (next: CaseQuickStep) => {
    haptic.tap();
    setSaveFailed(false);
    setStep(next);
  };

  const sceneNext = () => {
    deps.trackEvent('case_scene', { source: 'own' });
    goStep('feel');
  };

  const pickGate = (id: CaseGateId) => {
    if (id === STEADY_GATE_ID) {
      patch({ gateId: id });
      goStep('steady');
      return;
    }
    haptic.select();
    if (id !== fields.gateId)
      patch({ gateId: id, bodyChipIds: [], modeId: '' });
  };

  const toggleBodyChip = (id: string) => {
    const next = toggleTappedChip(fields.bodyChipIds, id, BODY_LIMIT);
    if (next === null) return haptic.warning();
    haptic.tap();
    patch({ bodyChipIds: next });
  };

  const toggleImpulseChip = (id: string) => {
    const next = toggleTappedChip(fields.impulseChipIds, id, IMPULSE_LIMIT);
    if (next === null) return haptic.warning();
    haptic.tap();
    patch({ impulseChipIds: next, modeId: '' });
  };

  const pickMode = (modeId: string) => {
    haptic.select();
    patch({ modeId });
    setStep('result');
  };

  const back = () => {
    if (step === 'scene' || step === 'done') return props.onClose();
    if (step === 'steady') patch({ gateId: null });
    const prev: Record<string, CaseQuickStep> = {
      feel: 'scene',
      steady: 'feel',
      impulse: 'feel',
      result: 'impulse',
      modes: 'result',
    };
    goStep(prev[step]);
  };

  /** Общий хвост обоих сохранений: запись → (карточка) → «Записано». */
  const persist = async (
    modeId: string,
    write: () => Promise<void>,
    afterWrite?: () => Promise<void>,
  ) => {
    if (saving) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      await write();
    } catch {
      haptic.error();
      setSaveFailed(true);
      setSaving(false);
      return;
    }
    savedRef.current = true;
    clearQuickDraft();
    // Запись уже сохранена; карточка режима — довесок, её сбой не отменяет «Записано».
    if (afterWrite) await afterWrite().catch(() => haptic.error());
    deps.trackEvent('case_finished', { modeId });
    setSavedModeId(modeId);
    setSaving(false);
    setStep('done');
  };

  const save = () => {
    const modeId = resolveModeId(fields);
    const candidate = pickCandidateMode(fields.gateId, fields.impulseChipIds);
    return persist(
      modeId,
      () => props.onSave(buildQuickSaveData(fields, bodyChips, CASE_IMPULSES)),
      async () => {
        // Барнум-индикатор /stats: согласился с предложенным или выбрал другое.
        // Шлётся ПОСЛЕ успешной записи: сбой аналитики внутри write() показал бы
        // «Не удалось сохранить» при уже созданной записи, а повтор дал бы дубль.
        deps.trackEvent('case_recognized', {
          modeId,
          agreed: modeId === candidate,
        });
        await props.onSaveCard(
          buildQuickCardBody(fields, bodyChips, CASE_IMPULSES),
        );
      },
    );
  };

  const saveSteady = () =>
    persist(STEADY_MODE_ID, () =>
      props.onSave(buildSteadySaveData(fields.scene)),
    );

  return {
    tr,
    step,
    fields,
    patch,
    crisis,
    saving,
    saveFailed,
    bodyChips,
    impulseChips: CASE_IMPULSES,
    result:
      step === 'result'
        ? buildQuickResult(fields, bodyChips, CASE_IMPULSES)
        : null,
    doneName: quickModeName(savedModeId),
    ...support,
    sceneNext,
    pickGate,
    toggleBodyChip,
    toggleImpulseChip,
    feelNext: () => goStep('impulse'),
    impulseNext: () => goStep('result'),
    openModes: () => goStep('modes'),
    pickMode,
    back,
    save,
    saveSteady,
  };
}
