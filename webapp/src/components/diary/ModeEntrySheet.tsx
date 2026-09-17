import { useState, useEffect } from 'react';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { MODE_GROUPS } from '../../schemaTherapyData';
import { saveDraft, loadDraft, clearDraft } from '../../utils/drafts';
import { haptic } from '../../haptic';
import { api } from '../../api';
import { ModeSelectScreen } from './ModeSelectScreen';
import { ModeEntryForm, type ModeFormFields } from './ModeEntryForm';
import { ModeEntryDone } from './ModeEntryDone';
import {
  MODE_ENTRY_SAVED_EVENT,
  MODE_CHAIN_FOLLOWUP_EVENT,
  modeEntrySavedMeta,
} from '../../../../shared/src/share/analytics';
import { type ModeEntrySaveData } from '../../../../shared/src/mode/modeDiarySteps';

interface Props {
  onClose: () => void;
  onSave: (data: ModeEntrySaveData) => Promise<void>;
}

type DraftData = Record<
  'modeId' | keyof ModeFormFields | 'healthyResponse',
  string
>;

export function ModeEntrySheet({ onClose, onSave }: Props) {
  const goBack = useHistorySheet(onClose);
  const existing = loadDraft<DraftData>('mode');
  const d = existing?.data;

  const [modeId, setModeId] = useState(d?.modeId ?? '');
  const [situation, setSituation] = useState(d?.situation ?? '');
  const [thoughts, setThoughts] = useState(d?.thoughts ?? '');
  const [feelings, setFeelings] = useState(d?.feelings ?? '');
  const [bodyFeelings, setBodyFeelings] = useState(d?.bodyFeelings ?? '');
  const [actions, setActions] = useState(d?.actions ?? '');
  const [actualNeed, setActualNeed] = useState(d?.actualNeed ?? '');
  const [childhoodMemories, setChildhoodMemories] = useState(
    d?.childhoodMemories ?? '',
  );
  const [healthyResponse, setHealthyResponse] = useState(
    d?.healthyResponse ?? '',
  );
  const [saving, setSaving] = useState(false);
  // Отказ раньше сообщался ТОЛЬКО вибрацией haptic.error() — на сайте в
  // браузере (в отличие от Telegram/установленного PWA) вибрации нет вовсе,
  // и человек считал, что запись сохранена, хотя черновик просто завис
  // (тот же баг, что был в GratitudeEntrySheet, см. её комментарий).
  const [saveError, setSaveError] = useState(false);
  const [done, setDone] = useState(false);
  const [showPicker, setShowPicker] = useState(!d?.modeId);

  const pickMode = (id: string) => {
    haptic.select();
    setModeId(id);
    setShowPicker(false);
  };

  useEffect(() => {
    saveDraft('mode', {
      modeId,
      situation,
      thoughts,
      feelings,
      bodyFeelings,
      actions,
      actualNeed,
      childhoodMemories,
      healthyResponse,
    });
  }, [
    modeId,
    situation,
    thoughts,
    feelings,
    bodyFeelings,
    actions,
    actualNeed,
    childhoodMemories,
    healthyResponse,
  ]);

  const selectedMode = modeId
    ? MODE_GROUPS.flatMap((g) =>
        g.items.map((m) => ({ ...m, color: g.color, groupName: g.group })),
      ).find((m) => m.id === modeId)
    : null;

  const canSave = modeId.length > 0 && situation.trim().length > 0;

  const values: ModeFormFields = {
    situation,
    thoughts,
    feelings,
    bodyFeelings,
    actions,
    actualNeed,
    childhoodMemories,
  };
  const setters: Record<keyof ModeFormFields, (v: string) => void> = {
    situation: setSituation,
    thoughts: setThoughts,
    feelings: setFeelings,
    bodyFeelings: setBodyFeelings,
    actions: setActions,
    actualNeed: setActualNeed,
    childhoodMemories: setChildhoodMemories,
  };
  const setField = (k: keyof ModeFormFields, v: string) => setters[k](v);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaveError(false);
    haptic.success();
    setSaving(true);
    try {
      await onSave({
        modeId,
        situation,
        thoughts: thoughts || undefined,
        feelings: feelings || undefined,
        bodyFeelings: bodyFeelings || undefined,
        actions: actions || undefined,
        actualNeed: actualNeed || undefined,
        childhoodMemories: childhoodMemories || undefined,
        healthyResponse: healthyResponse || undefined,
      });
      clearDraft('mode');
      const fields = [situation, thoughts, feelings, bodyFeelings, actions, actualNeed, childhoodMemories];
      api.trackEvent(MODE_ENTRY_SAVED_EVENT, modeEntrySavedMeta(fields, healthyResponse));
      setDone(true); // итог вместо молчаливого закрытия (не «всё исчезло»)
    } catch {
      haptic.error();
      setSaveError(true); // лист НЕ закрываем — иначе отказ неотличим от успеха
    } finally {
      setSaving(false);
    }
  };

  // Подсказка «разобрать связанный режим» (ModeChainSuggestion) на экране
  // «Запись сохранена»: ситуация — та же, поэтому ситуацию СОХРАНЯЕМ, а
  // остальные поля и ответ Здорового Взрослого очищаем и открываем форму
  // заново уже на новом режиме (modeId='' — обратно на ModeSelectScreen).
  // Событие шлём только при выборе конкретного кандидата — «Другой режим»
  // (to === null) не считается принятой подсказкой.
  const handleChainPick = (to: string | null) => {
    if (to != null) {
      api.trackEvent(MODE_CHAIN_FOLLOWUP_EVENT, { from: modeId, to });
    }
    setThoughts('');
    setFeelings('');
    setBodyFeelings('');
    setActions('');
    setActualNeed('');
    setChildhoodMemories('');
    setHealthyResponse('');
    setModeId(to ?? '');
    setDone(false);
  };

  // ── Итог: запись сохранена + карточка/шеринг ──
  if (done) {
    return (
      <ModeEntryDone
        modeId={modeId}
        healthyResponse={healthyResponse}
        entry={{ ...values, healthyResponse }}
        goBack={goBack}
        onPickChain={handleChainPick}
      />
    );
  }

  // ── Step 1: picker (вынесено в ModeSelectScreen, правило №10) ──
  if (!modeId || showPicker) {
    return (
      <ModeSelectScreen modeId={modeId} onPick={pickMode} onBack={goBack} />
    );
  }

  // ── Step 2: form ──
  return (
    <ModeEntryForm
      selectedMode={selectedMode ?? null}
      modeId={modeId}
      values={values}
      set={setField}
      healthyResponse={healthyResponse}
      setHealthyResponse={setHealthyResponse}
      saving={saving}
      saveError={saveError}
      canSave={canSave}
      onSave={handleSave}
      onBack={goBack}
      onChangeMode={() => setShowPicker(true)}
      onSwitchMode={setModeId}
    />
  );
}
