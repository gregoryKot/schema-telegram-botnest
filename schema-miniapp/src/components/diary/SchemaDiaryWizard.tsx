import { useState } from 'react';
import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import { DiaryTextArea } from './DiaryTextArea';
import { EmotionsStep } from './EmotionsStep';
import { SchemaChipsStep } from './SchemaChipsStep';
import { WizardProgress } from '../WizardProgress';
import { WizardNav } from '../WizardNav';
import type { EmotionEntry } from '../../types';
import {
  buildSchemaDiarySteps,
  buildSchemaDiaryChipLabels,
  SCHEMA_DIARY_STEP_ORDER,
  type SchemaDiaryFieldKey,
  type SchemaDiaryStepKind,
} from '../../../../shared/src/schema/schemaDiarySteps';

/**
 * Визард дневника схем: один вопрос — один экран. Обязательна только
 * ситуация (шаг 1); остальное можно пропустить, сохранить можно с любого
 * шага (кнопка в шапке). Порядок и число шагов — из shared
 * SCHEMA_DIARY_STEP_ORDER (правило №3); текстовый контент — из
 * buildSchemaDiarySteps. «Чувства» и «Схемы» — chip-шаги (EmotionsStep /
 * SchemaChipsStep), не текстовые.
 */
export function SchemaDiaryWizard({
  values,
  onChange,
  emotions,
  onToggleEmotion,
  onSetIntensity,
  schemaIds,
  onToggleSchema,
  activeSchemaIds,
  showAllSchemas,
  onToggleShowAll,
  onSave,
  canSave,
  saving,
  accentColor,
}: {
  values: Record<SchemaDiaryFieldKey, string>;
  onChange: (key: SchemaDiaryFieldKey, value: string) => void;
  emotions: EmotionEntry[];
  onToggleEmotion: (id: string) => void;
  onSetIntensity: (id: string, intensity: number) => void;
  schemaIds: string[];
  onToggleSchema: (id: string) => void;
  activeSchemaIds?: string[];
  showAllSchemas: boolean;
  onToggleShowAll: () => void;
  onSave: () => void;
  canSave: boolean;
  saving: boolean;
  accentColor: string;
}) {
  const tr = useTr();
  const STEPS = buildSchemaDiarySteps(tr);
  const stepByKey = Object.fromEntries(STEPS.map((s) => [s.key, s])) as Record<
    SchemaDiaryFieldKey,
    (typeof STEPS)[number]
  >;
  const chipLabels = buildSchemaDiaryChipLabels(tr);
  const TOTAL = SCHEMA_DIARY_STEP_ORDER.length;
  const [step, setStep] = useState(0);

  const filledFor = (k: SchemaDiaryStepKind): boolean => {
    if (k === 'emotions') return emotions.length > 0;
    if (k === 'schemas')
      return schemaIds.length > 0 || values.schemaOrigin.trim().length > 0;
    return values[k].trim().length > 0;
  };

  const kind = SCHEMA_DIARY_STEP_ORDER[step];
  const isLast = step === TOTAL - 1;
  const textStep =
    kind === 'emotions' || kind === 'schemas' ? null : stepByKey[kind];
  const required = textStep?.required ?? false;
  const filled = filledFor(kind);
  const canNext = required ? filled : true;
  const optional = !required;
  const progressSegments = SCHEMA_DIARY_STEP_ORDER.map((k) => ({
    filled: filledFor(k),
  }));
  // Заголовок/подсказка шага — один общий рендер для текстовых и chip-шагов
  // (не дублируем разметку заголовка в каждом подкомпоненте).
  const stepTitle =
    kind === 'emotions'
      ? chipLabels.emotions.title
      : kind === 'schemas'
        ? chipLabels.schemas.title
        : textStep!.title;
  const stepHint =
    kind === 'emotions'
      ? chipLabels.emotions.hint
      : kind === 'schemas'
        ? chipLabels.schemas.hint
        : textStep!.hint;

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ marginBottom: 8 }}>
        <WizardProgress
          segments={progressSegments}
          active={step}
          accentColor={accentColor}
          onSelect={(i) => setStep(i)}
        />
      </div>
      <div
        style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 16 }}
      >
        Шаг {step + 1} из {TOTAL}
        {optional && ' · можно пропустить'}
      </div>

      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 4,
        }}
      >
        {stepTitle}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 12 }}>
        {stepHint}
      </div>

      {kind === 'emotions' && (
        <EmotionsStep
          emotions={emotions}
          onToggle={onToggleEmotion}
          onSetIntensity={onSetIntensity}
          accentColor={accentColor}
        />
      )}
      {kind === 'schemas' && (
        <>
          <SchemaChipsStep
            schemaIds={schemaIds}
            onToggle={onToggleSchema}
            activeSchemaIds={activeSchemaIds}
            showAllSchemas={showAllSchemas}
            onToggleShowAll={onToggleShowAll}
          />
          <DiaryTextArea
            value={values.schemaOrigin}
            onChange={(v) => onChange('schemaOrigin', v)}
            placeholder={stepByKey.schemaOrigin.example}
            rows={2}
          />
        </>
      )}
      {textStep && (
        <DiaryTextArea
          value={values[textStep.key]}
          onChange={(v) => onChange(textStep.key, v)}
          placeholder={textStep.example}
          rows={textStep.rows}
        />
      )}

      <div style={{ marginTop: 16 }}>
        <WizardNav
          accentColor={accentColor}
          onBack={() => {
            haptic.tap();
            setStep((s) => Math.max(0, s - 1));
          }}
          backDisabled={step === 0}
          primaryKind={isLast ? 'save' : 'next'}
          primaryLabel={
            isLast
              ? saving
                ? 'Сохраняю…'
                : 'Готово'
              : filled || !optional
                ? 'Далее →'
                : 'Пропустить'
          }
          onPrimary={
            isLast
              ? onSave
              : () => {
                  haptic.tap();
                  setStep((s) => s + 1);
                }
          }
          primaryDisabled={isLast ? !canSave || saving : !canNext}
        />
      </div>
    </div>
  );
}
