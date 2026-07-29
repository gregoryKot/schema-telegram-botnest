import { useState, useRef, useEffect } from 'react';
import { ExScreen } from '../exercises/ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { pressable } from '../../utils/a11y';
import { saveDraft, loadDraft, clearDraft } from '../../utils/drafts';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { haptic } from '../../haptic';
import { SchemaEmotionsStep } from './SchemaEmotionsStep';
import { SchemaChipsStep } from './SchemaChipsStep';
import { DiaryWizardFoot } from './DiaryWizardFoot';
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
  type SchemaDiaryDraftData,
} from '../../../../shared/src/schema/useSchemaDiaryDraftState';
import { buildSchemaDiaryExplainer } from '../../../../shared/src/schema/schemaFlowExplainers';
import { collectFilledFields } from '../../../../shared/src/utils/diaryFields';

// Визард дневника схем (правило онбординга «одно главное действие на экран»,
// низкий порог для СДВГ) — стиль ModeEntryForm: ExScreen, tick-strip,
// один вопрос на экран, ex-btn Назад/Дальше/Пропустить/Сохранить. Обязательна
// только ситуация (trigger); можно сохранить с любого шага. Порядок и текст
// шагов — из shared/schema/schemaDiarySteps (правило №3); чип-шаги (чувства,
// схемы) — своя разметка webapp, вынесена в подкомпоненты рядом.

interface Props {
  activeSchemaIds?: string[];
  onClose: () => void;
  onSave: (data: SchemaDiaryEntryInput) => Promise<void>;
}

const ACCENT = 'var(--c-rose)';

export function SchemaEntrySheet({ activeSchemaIds, onClose, onSave }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  // Ключ и форма черновика ('schema', DraftData) не меняются — старые
  // черновики обязаны подхватываться. Состояние и переключатели — общий
  // хук для обоих фронтов (правило №3/№11 CLAUDE.md).
  const existing = loadDraft<SchemaDiaryDraftData>('schema');
  const d = existing?.data ?? null;
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
    } catch {
      haptic.error();
    } finally {
      setSaving(false);
      goBack();
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
      eyebrow="Дневник схем · новая запись"
      eyebrowColor={ACCENT}
      title={<>Записать<br /><span className="it">момент</span></>}
      lede={tr(
        'Поймал триггер – приходи сюда. Обязательна только ситуация, остальное можно дополнить по шагам.',
        'Поймали триггер – приходите сюда. Обязательна только ситуация, остальное можно дополнить по шагам.',
      )}
      aside={
        <div className="aside-card" style={{ borderColor: ACCENT + '40', background: ACCENT + '08', position: 'sticky', top: 40 }}>
          <div className="aside-card-eyebrow" style={{ color: ACCENT }}>Совет</div>
          <h3>Не обязательно по порядку</h3>
          <p className="body">{tr('Если в моменте трудно – запиши только триггер и чувство. Остальное можно дополнить позже, или когда тебе кто-то поможет это разобрать.', 'Если в моменте трудно – запишите только триггер и чувство. Остальное можно дополнить позже, или когда вам кто-то поможет это разобрать.')}</p>
          <ul>
            <li>Автосохранение на каждом шаге</li>
            <li>Можно вернуться и продолжить</li>
            <li>{tr('Никто кроме тебя не увидит', 'Никто кроме вас не увидит')}</li>
          </ul>
        </div>
      }
    >
      <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.5, marginBottom: 20 }}>{buildSchemaDiaryExplainer(tr)}</p>

      <div className="tick-strip">
        {tickFilled.map((filled, i) => (
          <div
            key={i}
            className={'tick ' + (filled ? 'is-filled ' : '') + (i === stepIdx ? 'is-active' : '')}
            style={{ '--accent': ACCENT } as React.CSSProperties}
            {...pressable(() => setStepIdx(i))}
          />
        ))}
      </div>

      <div className="flash" style={{ borderColor: curFilled ? ACCENT + '55' : 'var(--line)' }}>
        <div className="flash-eyebrow" style={{ color: ACCENT }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: 'currentColor' }} />
          Шаг {stepIdx + 1} из {TOTAL}
          {curRequired
            ? <span style={{ marginLeft: 6, fontWeight: 600, color: ACCENT }}>· обязательно</span>
            : <span style={{ marginLeft: 6, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-faint)' }}>· можно пропустить</span>}
          <span className="flash-counter">{filledCount} / {TOTAL} заполнено</span>
        </div>

        {kind === 'emotions' && (
          <>
            <div className="flash-q">{chipLabels.emotions.title}</div>
            <div className="flash-hint">{chipLabels.emotions.hint}</div>
            <SchemaEmotionsStep emotions={emotions} onToggle={toggleEmotion} onSetIntensity={setIntensity} />
          </>
        )}
        {kind === 'schemas' && (
          <>
            <div className="flash-q">{chipLabels.schemas.title}</div>
            <div className="flash-hint">{chipLabels.schemas.hint}</div>
            <SchemaChipsStep
              schemaIds={schemaIds}
              onToggle={toggleSchema}
              activeSchemaIds={activeSchemaIds}
              showAllSchemas={showAllSchemas}
              onToggleShowAll={() => { haptic.tap(); setShowAllSchemas((v) => !v); }}
            />
            {/* Свободный текст — здесь, а не в чип-компоненте: detectCrisisAny
                ниже прогоняет его вместе с остальными полями (правило №7). */}
            <textarea
              className={'paper-area ' + (values.schemaOrigin.trim() ? 'is-filled' : '')}
              rows={2}
              value={values.schemaOrigin}
              onChange={(e) => setField('schemaOrigin', e.target.value)}
              placeholder={stepByKey.schemaOrigin.example}
              style={{ marginTop: 12 }}
            />
          </>
        )}
        {textStep && (
          <>
            <div className="flash-q">{textStep.title}</div>
            <div className="flash-hint">{textStep.hint}</div>
            <textarea
              ref={areaRef}
              className={'paper-area ' + (curFilled ? 'is-filled' : '')}
              rows={textStep.rows ?? 3}
              value={values[textStep.key]}
              onChange={(e) => setField(textStep.key, e.target.value)}
              placeholder={textStep.example}
            />
          </>
        )}
      </div>

      {detectCrisisAny(...Object.values(values)) && <CrisisCard surface="schema" />}

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
