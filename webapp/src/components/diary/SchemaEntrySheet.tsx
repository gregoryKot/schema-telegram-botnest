import { useState, useRef, useEffect } from 'react';
import { ExScreen } from '../exercises/ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { DIARY_HUE } from '../../lib/tone';
import { DiaryStepCard, DiaryStepQ, DiaryTicks } from './DiaryStepCard';
import { SchemaEntryAside } from './SchemaEntryAside';
import { saveDraft, loadDraft, clearDraft } from '../../utils/drafts';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { haptic } from '../../haptic';
import { SchemaEmotionsStep } from './SchemaEmotionsStep';
import { SchemaChipsStep } from './SchemaChipsStep';
import { DiaryWizardFoot } from './DiaryWizardFoot';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { DIARY_FIELD_MAX } from '../../../../shared/src/limits/textLimits';
import {
  buildSchemaDiarySteps,
  buildSchemaDiaryChipLabels,
  SCHEMA_DIARY_FIELD_KEYS,
  SCHEMA_DIARY_STEP_ORDER,
  type SchemaDiaryFieldKey,
  type SchemaDiaryStepKind,
  type SchemaDiaryEntryInput,
} from '../../../../shared/src/schema/schemaDiarySteps';
import {
  useSchemaDiaryDraftState,
  hasSchemaDiaryDraft,
  type SchemaDiaryDraftData,
} from '../../../../shared/src/schema/useSchemaDiaryDraftState';
import { buildSchemaDiaryExplainer } from '../../../../shared/src/schema/schemaFlowExplainers';
import { collectFilledFields } from '../../../../shared/src/utils/diaryFields';

// Визард дневника схем (одно главное действие на экран, низкий порог для СДВГ)
// — стиль ModeEntryForm: ExScreen, tick-strip, один вопрос на экран. Обязательна
// только ситуация (trigger); сохранить можно с любого шага. Порядок и текст
// шагов — shared/schema/schemaDiarySteps (правило №3); чип-шаги — рядом.

interface Props {
  activeSchemaIds?: string[];
  /** Текст из «Дневника одной страницей»: встаёт в поле ситуации. */
  initialTrigger?: string;
  onClose: () => void;
  onSave: (data: SchemaDiaryEntryInput) => Promise<void>;
}

const HUE = DIARY_HUE.schema;

export function SchemaEntrySheet({ activeSchemaIds, initialTrigger, onClose, onSave }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  // Ключ и форма черновика ('schema', DraftData) не меняются — старые
  // черновики обязаны подхватываться. Состояние и переключатели — общий
  // хук для обоих фронтов (правило №3/№11 CLAUDE.md).
  const saved = loadDraft<SchemaDiaryDraftData>('schema')?.data ?? null;
  const d = initialTrigger ? ({ ...saved, trigger: initialTrigger } as SchemaDiaryDraftData) : saved;
  const { values, setField, emotions, toggleEmotion, setIntensity, schemaIds, toggleSchema } =
    useSchemaDiaryDraftState(d, haptic);
  const [saving, setSaving] = useState(false);
  // Отказ не закрывает лист: иначе он неотличим от успеха (пара к Mode/Gratitude).
  const [saveError, setSaveError] = useState(false);
  const [showAllSchemas, setShowAllSchemas] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // Фокус на поле при смене шага — сразу видно, куда писать.
  useEffect(() => {
    areaRef.current?.focus();
  }, [stepIdx]);

  useEffect(() => {
    saveDraft('schema', { ...values, emotions, schemaIds });
  }, [values, emotions, schemaIds]);

  const canSave = values.trigger.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaveError(false);
    haptic.success();
    setSaving(true);
    try {
      const optional = collectFilledFields(
        values,
        SCHEMA_DIARY_FIELD_KEYS,
        'trigger',
      );
      await onSave({ trigger: values.trigger, emotions, schemaIds, ...optional });
      clearDraft('schema');
      goBack();
    } catch {
      haptic.error();
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const STEPS = buildSchemaDiarySteps(tr);
  const stepByKey = Object.fromEntries(
    STEPS.map((s) => [s.key, s]),
  ) as Record<SchemaDiaryFieldKey, (typeof STEPS)[number]>;
  const chipLabels = buildSchemaDiaryChipLabels(tr);
  const TOTAL = SCHEMA_DIARY_STEP_ORDER.length;
  const kind = SCHEMA_DIARY_STEP_ORDER[stepIdx];
  const textStep = kind === 'emotions' || kind === 'schemas' ? null : stepByKey[kind];

  const filledFor = (k: SchemaDiaryStepKind): boolean => {
    if (k === 'emotions') return emotions.length > 0;
    if (k === 'schemas')
      return schemaIds.length > 0 || values.schemaOrigin.trim().length > 0;
    return values[k].trim().length > 0;
  };
  const tickFilled = SCHEMA_DIARY_STEP_ORDER.map(filledFor);
  const filledCount = tickFilled.filter(Boolean).length;
  const curFilled = filledFor(kind);
  const curRequired = textStep?.required ?? false;
  const isLast = stepIdx === TOTAL - 1;
  const isFirst = stepIdx === 0;

  const goPrev = () => setStepIdx((s) => Math.max(0, s - 1));
  const goNext = () => setStepIdx((s) => Math.min(TOTAL - 1, s + 1));

  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад к дневнику"
      eyebrow={hasSchemaDiaryDraft(saved) ? 'Дневник схем · продолжаем с того места' : 'Дневник схем · с чего начнём?'}
      title={<>Записать<br /><span className="it">момент</span></>}
      lede={tr(
        'Что-то задело — приходи сюда. Обязательна только ситуация, остальное можно дополнить по шагам.',
        'Что-то задело — приходите сюда. Обязательна только ситуация, остальное можно дополнить по шагам.',
      )}
      aside={<SchemaEntryAside hue={HUE} />}
    >
      <p className="ds-sub sd-explainer">{buildSchemaDiaryExplainer(tr)}</p>

      <DiaryTicks filled={tickFilled} active={stepIdx} hue={HUE} onJump={setStepIdx} />

      <DiaryStepCard hue={HUE} stepIdx={stepIdx} total={TOTAL} required={curRequired} filled={curFilled} filledCount={filledCount}>
        {kind === 'emotions' && (
          <>
            <DiaryStepQ title={chipLabels.emotions.title} hint={chipLabels.emotions.hint} />
            <SchemaEmotionsStep emotions={emotions} onToggle={toggleEmotion} onSetIntensity={setIntensity} />
          </>
        )}
        {kind === 'schemas' && (
          <>
            <DiaryStepQ id="schema-entry-question" title={chipLabels.schemas.title} hint={chipLabels.schemas.hint} />
            <SchemaChipsStep
              schemaIds={schemaIds}
              onToggle={toggleSchema}
              activeSchemaIds={activeSchemaIds}
              showAllSchemas={showAllSchemas}
              onToggleShowAll={() => { haptic.tap(); setShowAllSchemas((v) => !v); }}
            />
            {/* Свободный текст — здесь, а не в SchemaChipsStep: detectCrisisAny ниже
                прогоняет его вместе с остальными полями (правило №7). */}
            <LimitedTextarea max={DIARY_FIELD_MAX} className="ds-textarea sd-area-gap" rows={2}
              value={values.schemaOrigin}
              onChange={(e) => setField('schemaOrigin', e.target.value)}
              placeholder={stepByKey.schemaOrigin.example}
              aria-label={stepByKey.schemaOrigin.title}
            />
          </>
        )}
        {textStep && (
          <>
            <DiaryStepQ id="schema-entry-question" title={textStep.title} hint={textStep.hint} />
            <LimitedTextarea max={DIARY_FIELD_MAX} ref={areaRef} className="ds-textarea" rows={textStep.rows ?? 3}
              value={values[textStep.key]}
              onChange={(e) => setField(textStep.key, e.target.value)}
              placeholder={textStep.example}
              aria-labelledby="schema-entry-question"
            />
          </>
        )}
      </DiaryStepCard>

      {detectCrisisAny(...Object.values(values)) && <CrisisCard surface="schema" />}
      {saveError && <div role="alert" className="sd-save-error">Не удалось сохранить. Текст остался черновиком — можно повторить</div>}

      <DiaryWizardFoot
        onBack={goPrev}
        backDisabled={isFirst}
        canSave={canSave}
        isLast={isLast}
        saving={saving}
        onSave={handleSave}
        curFilled={curFilled}
        curRequired={curRequired}
        onNext={goNext}
      />
    </ExScreen>
  );
}
