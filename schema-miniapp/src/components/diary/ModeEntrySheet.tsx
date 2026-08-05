import { useState, useEffect } from 'react';
import { BottomSheet } from '../BottomSheet';
import { saveDraft, loadDraft, clearDraft } from '../../utils/drafts';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import { api } from '../../api';
import { ModeStateStep } from './ModeStateStep';
import { ModeCandidateStep } from './ModeCandidateStep';
import { ModeDiaryWizard } from './ModeDiaryWizard';
import { ModeDoubtButton } from './ModeDoubtButton';
import { ModeEntryDone } from './ModeEntryDone';
import { SheetHeader, StepProgress, SummaryBlock } from './diaryFlowUi';
import { getModeById } from '../../schemaTherapyData';
import {
  MODE_DIARY_FIELD_KEYS,
  type ModeDiaryFieldKey,
  type ModeEntrySaveData,
} from '../../../../shared/src/mode/modeDiarySteps';
import { healthyAdultHint } from '../../../../shared/src/mode/healthyAdultHints';
import { findPickerGroupIdByModeId } from '../../../../shared/src/mode/modeFeelGates';
import {
  MODE_ENTRY_SAVED_EVENT,
  MODE_CHAIN_FOLLOWUP_EVENT,
  modeEntrySavedMeta,
} from '../../../../shared/src/share/analytics';

interface Props {
  onClose: () => void;
  onSave: (data: ModeEntrySaveData) => Promise<void>;
}

const STEP_LABELS = [
  'Шаг 1 из 3 · чувство',
  'Шаг 2 из 3 · режим',
  'Шаг 3 из 3 · запись',
];

/**
 * Дневник режимов в три шага: чувство обычными словами → уточнение режима →
 * запись. Шаги 1–2 заменили свалку из 35 чипов, где первой попадалась
 * таксономия; шаг 3 — прежний визард «один вопрос — один экран»
 * (ModeDiaryWizard), он остаётся низким порогом входа: обязательна только
 * ситуация, сохранить можно с любого шага.
 */
export function ModeEntrySheet({ onClose, onSave }: Props) {
  const tr = useTr();
  const existing =
    loadDraft<Record<'modeId' | ModeDiaryFieldKey | 'healthyResponse', string>>(
      'mode',
    );
  const d = existing?.data;

  const [modeId, setModeId] = useState(d?.modeId ?? '');
  // Ворота чувства: шаг 2 показывает кандидатов именно из них. У черновика
  // с уже выбранным режимом ворота восстанавливаем по самому режиму — иначе
  // «Назад» с третьего шага уводило бы в пустоту.
  const [groupId, setGroupId] = useState<string | null>(
    d?.modeId ? findPickerGroupIdByModeId(d.modeId) : null,
  );
  // Все текстовые поля — одним объектом (порядок/имена из MODE_DIARY_FIELD_KEYS),
  // без россыпи useState (правило №11, jscpd).
  const [values, setValues] = useState<Record<ModeDiaryFieldKey, string>>(
    () =>
      Object.fromEntries(
        MODE_DIARY_FIELD_KEYS.map((k) => [k, d?.[k] ?? '']),
      ) as Record<ModeDiaryFieldKey, string>,
  );
  const [healthyResponse, setHealthyResponse] = useState(
    d?.healthyResponse ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const setField = (k: ModeDiaryFieldKey, v: string) =>
    setValues((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    saveDraft('mode', { modeId, ...values, healthyResponse });
  }, [modeId, values, healthyResponse]);

  const canSave = modeId.length > 0 && values.situation.trim().length > 0;
  const step = modeId ? 2 : groupId ? 1 : 0;
  const mode = getModeById(modeId);

  const handleSave = async () => {
    if (!canSave || saving) return;
    haptic.success();
    setSaving(true);
    try {
      // Опциональные поля собираем программно — пустые не отправляем (и без
      // повторного перечисления имён полей, jscpd-храповик).
      const optional = Object.fromEntries(
        (Object.keys(values) as ModeDiaryFieldKey[])
          .filter((k) => k !== 'situation' && values[k].trim().length > 0)
          .map((k) => [k, values[k]]),
      );
      await onSave({
        modeId,
        situation: values.situation,
        ...optional,
        healthyResponse: healthyResponse || undefined,
      });
      clearDraft('mode');
      api.trackEvent(
        MODE_ENTRY_SAVED_EVENT,
        modeEntrySavedMeta(Object.values(values), healthyResponse),
      );
      setDone(true); // итог вместо молчаливого закрытия (не «всё исчезло»)
    } catch {
      haptic.error();
    } finally {
      setSaving(false);
    }
  };

  // Подсказка «разобрать связанный режим» (ModeChainSuggestion) на экране
  // «Записано»: ситуация — та же, поэтому ситуацию СОХРАНЯЕМ, а остальные
  // поля и ответ Здорового Взрослого очищаем и открываем поток заново уже на
  // новом режиме. Событие шлём только при выборе конкретного кандидата —
  // «Другой режим» (to === null) не считается принятой подсказкой.
  const handleChainPick = (to: string | null) => {
    if (to != null) {
      api.trackEvent(MODE_CHAIN_FOLLOWUP_EVENT, { from: modeId, to });
    }
    const situation = values.situation;
    setValues(
      Object.fromEntries(
        MODE_DIARY_FIELD_KEYS.map((k) => [
          k,
          k === 'situation' ? situation : '',
        ]),
      ) as Record<ModeDiaryFieldKey, string>,
    );
    setHealthyResponse('');
    setModeId(to ?? '');
    setGroupId(to ? findPickerGroupIdByModeId(to) : null);
    setDone(false);
  };

  const goBack = () => {
    haptic.tap();
    if (modeId) setModeId('');
    else setGroupId(null);
  };

  const pickMode = (id: string) => {
    setModeId(id);
    setGroupId((g) => g ?? findPickerGroupIdByModeId(id));
  };

  if (done) {
    return (
      <ModeEntryDone
        modeId={modeId}
        healthyResponse={healthyResponse}
        entry={{ ...values, healthyResponse }}
        onClose={onClose}
        onPickChain={handleChainPick}
      />
    );
  }

  return (
    <BottomSheet onClose={onClose}>
      <div>
        <SheetHeader
          title="Дневник режимов"
          onBack={step > 0 ? goBack : undefined}
          onSave={step === 2 ? handleSave : undefined}
          canSave={canSave}
          saving={saving}
        />

        {/* На шаге записи прогресс ведёт сам визард (вопрос = экран), поэтому
            внешняя полоска шагов уступает ему место — две полосы подряд читались
            бы как сбой, а не как «где я». */}
        {step < 2 && (
          <StepProgress step={step} total={3} label={STEP_LABELS[step]} />
        )}

        {step === 0 && (
          <ModeStateStep onPickGroup={setGroupId} onPickMode={pickMode} />
        )}

        {step === 1 && groupId && (
          <ModeCandidateStep
            groupId={groupId}
            onPickMode={pickMode}
            onPickGroup={setGroupId}
            onBack={() => setGroupId(null)}
          />
        )}

        {step === 2 && (
          <>
            <SummaryBlock
              label={tr('Твой режим', 'Ваш режим')}
              text={mode?.name ?? ''}
              onEdit={goBack}
            />
            <ModeDoubtButton modeId={modeId} onSwitch={pickMode} />
            <ModeDiaryWizard
              values={values}
              onChange={setField}
              healthyResponse={healthyResponse}
              onHealthyChange={setHealthyResponse}
              healthyHint={healthyAdultHint(modeId)}
              onSave={handleSave}
              canSave={canSave}
              saving={saving}
              accentColor="var(--accent)"
            />
          </>
        )}

        {detectCrisisAny(...Object.values(values), healthyResponse) && (
          <CrisisCard surface="mode" />
        )}
      </div>
    </BottomSheet>
  );
}
