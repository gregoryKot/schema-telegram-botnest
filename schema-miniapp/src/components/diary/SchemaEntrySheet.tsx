import { useState, useEffect } from 'react';
import { BottomSheet } from '../BottomSheet';
import { saveDraft, loadDraft, clearDraft } from '../../utils/drafts';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import { DiaryStickyHeader } from './DiaryStickyHeader';
import { SchemaDiaryWizard } from './SchemaDiaryWizard';
import {
  SCHEMA_DIARY_FIELD_KEYS,
  type SchemaDiaryEntryInput,
} from '../../../../shared/src/schema/schemaDiarySteps';
import {
  useSchemaDiaryDraftState,
  type SchemaDiaryDraftData,
} from '../../../../shared/src/schema/useSchemaDiaryDraftState';
import { buildSchemaDiaryExplainer } from '../../../../shared/src/schema/schemaFlowExplainers';
import { collectFilledFields } from '../../../../shared/src/utils/diaryFields';

interface Props {
  activeSchemaIds?: string[];
  onClose: () => void;
  onSave: (data: SchemaDiaryEntryInput) => Promise<void>;
}

const COLOR = 'var(--accent)';

export function SchemaEntrySheet({ activeSchemaIds, onClose, onSave }: Props) {
  const tr = useTr();
  // Черновик хранит и текстовые поля, и chip-состояние (эмоции/схемы) —
  // ключ и форма ('schema', DraftData) не меняются, старые черновики
  // подхватываются. Состояние и переключатели — общий хук для обоих
  // фронтов (правило №3/№11 CLAUDE.md).
  const existing = loadDraft<SchemaDiaryDraftData>('schema');
  const d = existing?.data;
  const {
    values,
    setField,
    emotions,
    toggleEmotion,
    setIntensity,
    schemaIds,
    toggleSchema,
  } = useSchemaDiaryDraftState(d, haptic);
  const [saving, setSaving] = useState(false);
  const [showAllSchemas, setShowAllSchemas] = useState(false);

  useEffect(() => {
    saveDraft('schema', { ...values, emotions, schemaIds });
  }, [values, emotions, schemaIds]);

  const canSave = values.trigger.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    haptic.success();
    setSaving(true);
    try {
      // Опциональные поля собираем программно — пустые не отправляем.
      const optional = collectFilledFields(
        values,
        SCHEMA_DIARY_FIELD_KEYS,
        'trigger',
      );
      await onSave({
        trigger: values.trigger,
        emotions,
        schemaIds,
        ...optional,
      });
      clearDraft('schema');
    } catch {
      haptic.error();
    } finally {
      setSaving(false);
      onClose();
    }
  };

  // Заполненность смотрим по СНАПШОТУ загруженного черновика (не по живому
  // стейту) — так же, как было раньше: пока не наберёшь первый символ,
  // подзаголовок «С чего начнём?», не «Продолжаем».
  const hasDraft = !!(
    d &&
    (SCHEMA_DIARY_FIELD_KEYS.some((k) => (d[k] ?? '').trim().length > 0) ||
      (d.emotions ?? []).length > 0 ||
      (d.schemaIds ?? []).length > 0)
  );

  return (
    <BottomSheet onClose={onClose} skin="diary">
      <div>
        <DiaryStickyHeader
          title="Дневник схем"
          subtitle={hasDraft ? 'Продолжаем с того места' : 'С чего начнём?'}
          color={COLOR}
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
          {buildSchemaDiaryExplainer(tr)}
        </div>

        <SchemaDiaryWizard
          values={values}
          onChange={setField}
          emotions={emotions}
          onToggleEmotion={toggleEmotion}
          onSetIntensity={setIntensity}
          schemaIds={schemaIds}
          onToggleSchema={toggleSchema}
          activeSchemaIds={activeSchemaIds}
          showAllSchemas={showAllSchemas}
          onToggleShowAll={() => setShowAllSchemas((v) => !v)}
          onSave={handleSave}
          canSave={canSave}
          saving={saving}
          accentColor={COLOR}
        />

        {detectCrisisAny(...Object.values(values)) && (
          <CrisisCard surface="schema" />
        )}
      </div>
    </BottomSheet>
  );
}
