import { useState, useEffect } from 'react';
import { BottomSheet } from '../BottomSheet';
import { saveDraft, loadDraft, clearDraft } from '../../utils/drafts';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { haptic } from '../../haptic';
import { DiaryStickyHeader } from './DiaryStickyHeader';
import { ModeSelectStep } from './ModeSelectStep';
import { ModeDiaryWizard } from './ModeDiaryWizard';
import type { ModeDiaryFieldKey } from '../../../../shared/src/mode/modeDiarySteps';

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
  }) => Promise<void>;
}

const COLOR = 'var(--accent-blue)';

export function ModeEntrySheet({ onClose, onSave }: Props) {
  const existing = loadDraft<{
    modeId: string;
    situation: string;
    thoughts: string;
    feelings: string;
    bodyFeelings: string;
    actions: string;
    actualNeed: string;
    childhoodMemories: string;
  }>('mode');
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
  const [saving, setSaving] = useState(false);

  const values: Record<ModeDiaryFieldKey, string> = {
    situation,
    thoughts,
    feelings,
    bodyFeelings,
    actions,
    actualNeed,
    childhoodMemories,
  };
  const setters: Record<ModeDiaryFieldKey, (v: string) => void> = {
    situation: setSituation,
    thoughts: setThoughts,
    feelings: setFeelings,
    bodyFeelings: setBodyFeelings,
    actions: setActions,
    actualNeed: setActualNeed,
    childhoodMemories: setChildhoodMemories,
  };
  const setField = (k: ModeDiaryFieldKey, v: string) => setters[k](v);

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
  ]);

  const canSave = modeId.length > 0 && situation.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
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
      });
      clearDraft('mode');
    } catch {
      haptic.error();
    } finally {
      setSaving(false);
      onClose();
    }
  };

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
            onSave={handleSave}
            canSave={canSave}
            saving={saving}
          />
        )}

        {detectCrisisAny(
          situation,
          thoughts,
          feelings,
          bodyFeelings,
          actions,
          actualNeed,
          childhoodMemories,
        ) && <CrisisCard surface="mode" />}
      </div>
    </BottomSheet>
  );
}
