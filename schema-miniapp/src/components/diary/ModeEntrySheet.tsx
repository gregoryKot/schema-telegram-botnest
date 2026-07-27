import { useState, useEffect } from 'react';
import { BottomSheet } from '../BottomSheet';
import { saveDraft, loadDraft, clearDraft } from '../../utils/drafts';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { haptic } from '../../haptic';
import { DiaryStickyHeader } from './DiaryStickyHeader';
import { ModeSelectStep } from './ModeSelectStep';
import { ModeDiaryWizard } from './ModeDiaryWizard';
import { ModeEntryShare } from './ModeEntryShare';
import { getModeById } from '../../schemaTherapyData';
import {
  MODE_DIARY_FIELD_KEYS,
  type ModeDiaryFieldKey,
} from '../../../../shared/src/mode/modeDiarySteps';
import { healthyAdultHint } from '../../../../shared/src/mode/healthyAdultHints';

interface Props {
  onClose: () => void;
  onSave: (data: {
    modeId: string;
    situation: string;
    thoughts?: string;
    feelings?: string;
    bodyFeelings?: string;
    actions?: string;
    actualNeed?: string;
    childhoodMemories?: string;
    healthyResponse?: string;
  }) => Promise<void>;
}

const COLOR = 'var(--accent-blue)';

export function ModeEntrySheet({ onClose, onSave }: Props) {
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
      setDone(true); // итог вместо молчаливого закрытия (не «всё исчезло»)
    } catch {
      haptic.error();
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <BottomSheet onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '12px 6px 16px' }}>
          <div style={{ fontSize: 46, marginBottom: 8 }}>🌿</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: 6,
            }}
          >
            Запись сохранена
          </div>
          <div
            style={{
              fontSize: 13.5,
              color: 'var(--text-sub)',
              lineHeight: 1.6,
              marginBottom: 16,
            }}
          >
            Она в «Дневнике режимов» и в «Моём пути» — можно открыть и
            перечитать в любой момент.
          </div>
          <div style={{ textAlign: 'left' }}>
            <ModeEntryShare
              mode={getModeById(modeId)}
              healthyResponse={healthyResponse}
            />
          </div>
          <button
            onClick={onClose}
            style={{
              marginTop: 18,
              width: '100%',
              padding: '13px 0',
              borderRadius: 14,
              border: 'none',
              fontFamily: 'inherit',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              background: 'rgba(var(--fg-rgb),0.08)',
              color: 'var(--text)',
            }}
          >
            Готово
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet onClose={onClose}>
      <div>
        <DiaryStickyHeader
          title="Дневник режимов"
          subtitle={existing ? 'Продолжаем с того места' : 'Кто сейчас внутри?'}
          color={COLOR}
          canSave={canSave}
          saving={saving}
          onSave={handleSave}
        />

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
          />
        )}

        {detectCrisisAny(...Object.values(values), healthyResponse) && (
          <CrisisCard surface="mode" />
        )}
      </div>
    </BottomSheet>
  );
}
