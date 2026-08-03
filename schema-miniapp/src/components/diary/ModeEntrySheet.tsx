import { useState, useEffect } from 'react';
import { BottomSheet } from '../BottomSheet';
import { saveDraft, loadDraft, clearDraft } from '../../utils/drafts';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import { api } from '../../api';
import { DiaryStickyHeader } from './DiaryStickyHeader';
import { ModeSelectStep } from './ModeSelectStep';
import { ModeDiaryWizard } from './ModeDiaryWizard';
import { ModeEntryDone } from './ModeEntryDone';
import { getModeById } from '../../schemaTherapyData';
import {
  MODE_DIARY_FIELD_KEYS,
  type ModeDiaryFieldKey,
  type ModeEntrySaveData,
} from '../../../../shared/src/mode/modeDiarySteps';
import { healthyAdultHint } from '../../../../shared/src/mode/healthyAdultHints';
import { buildModeDiaryExplainer } from '../../../../shared/src/mode/modeFlowExplainers';
import {
  MODE_ENTRY_SAVED_EVENT,
  MODE_CHAIN_FOLLOWUP_EVENT,
  modeEntrySavedMeta,
} from '../../../../shared/src/share/analytics';

interface Props {
  onClose: () => void;
  onSave: (data: ModeEntrySaveData) => Promise<void>;
}

const FALLBACK_COLOR = 'var(--accent-blue)'; // до выбора режима — нейтральный акцент

export function ModeEntrySheet({ onClose, onSave }: Props) {
  const tr = useTr();
  const existing =
    loadDraft<Record<'modeId' | ModeDiaryFieldKey | 'healthyResponse', string>>(
      'mode',
    );
  const d = existing?.data;

  const [modeId, setModeId] = useState(d?.modeId ?? '');
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
  // Акцент — цвет группы выбранного режима (согласовано с «Знакомством
  // с режимом»); до выбора режима — нейтральный синий.
  const accent = getModeById(modeId)?.groupColor ?? FALLBACK_COLOR;

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
  // «Запись сохранена»: ситуация — та же, поэтому ситуацию СОХРАНЯЕМ, а
  // остальные поля и ответ Здорового Взрослого очищаем и открываем визард
  // заново уже на новом режиме. Событие шлём только при выборе конкретного
  // кандидата — «Другой режим» (to === null) не считается принятой подсказкой.
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
    setDone(false);
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
        <DiaryStickyHeader
          title="Дневник режимов"
          subtitle={existing ? 'Продолжаем с того места' : 'Кто сейчас внутри?'}
          color={accent}
          canSave={canSave}
          saving={saving}
          onSave={handleSave}
        />

        <div
          style={{
            fontSize: 13,
            color: 'var(--text-faint)',
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          {buildModeDiaryExplainer(tr)}
        </div>

        <ModeSelectStep modeId={modeId} onChange={setModeId} />

        {modeId && (
          <ModeDiaryWizard
            values={values}
            onChange={setField}
            healthyResponse={healthyResponse}
            onHealthyChange={setHealthyResponse}
            healthyHint={healthyAdultHint(modeId)}
            onSave={handleSave}
            canSave={canSave}
            saving={saving}
            accentColor={accent}
          />
        )}

        {detectCrisisAny(...Object.values(values), healthyResponse) && (
          <CrisisCard surface="mode" />
        )}
      </div>
    </BottomSheet>
  );
}
