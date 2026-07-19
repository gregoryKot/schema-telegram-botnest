import { useState, useEffect } from 'react';
import { BottomSheet } from '../BottomSheet';
import {
  EMOTIONS,
  INTENSITY_LABELS,
  SCHEMA_DOMAINS,
} from '../../schemaTherapyData';
import { EmotionEntry } from '../../types';
import { saveDraft, loadDraft, clearDraft } from '../../utils/drafts';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import { DiaryTextArea } from './DiaryTextArea';
import { DiaryStickyHeader } from './DiaryStickyHeader';

interface Props {
  activeSchemaIds?: string[];
  onClose: () => void;
  onSave: (data: {
    trigger: string;
    emotions: EmotionEntry[];
    thoughts?: string;
    bodyFeelings?: string;
    actualBehavior?: string;
    schemaIds: string[];
    schemaOrigin?: string;
    healthyView?: string;
    realProblems?: string;
    excessiveReactions?: string;
    healthyBehavior?: string;
  }) => Promise<void>;
}

const COLOR = 'var(--accent-red)';

function StepLabel({
  step,
  title,
  hint,
  required,
}: {
  step: number;
  title: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div
      style={{
        marginTop: 22,
        marginBottom: 9,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          flexShrink: 0,
          background: 'color-mix(in srgb, var(--accent-red) 15%, transparent)',
          border:
            '1px solid color-mix(in srgb, var(--accent-red) 30%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--accent-red)',
          marginTop: 1,
        }}
      >
        {step}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          {title}
          {required && (
            <span
              style={{
                color: 'var(--accent-red)',
                marginLeft: 4,
                fontSize: 12,
              }}
            >
              *
            </span>
          )}
        </div>
        {hint && (
          <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}

interface DraftData {
  trigger: string;
  emotions: EmotionEntry[];
  thoughts: string;
  bodyFeelings: string;
  actualBehavior: string;
  schemaIds: string[];
  schemaOrigin: string;
  healthyView: string;
  realProblems: string;
  excessiveReactions: string;
  healthyBehavior: string;
}

export function SchemaEntrySheet({ activeSchemaIds, onClose, onSave }: Props) {
  const tr = useTr();
  const existing = loadDraft<DraftData>('schema');
  const draft = existing?.data ?? null;

  const [trigger, setTrigger] = useState(draft?.trigger ?? '');
  const [emotions, setEmotions] = useState<EmotionEntry[]>(
    draft?.emotions ?? [],
  );
  const [thoughts, setThoughts] = useState(draft?.thoughts ?? '');
  const [bodyFeelings, setBodyFeelings] = useState(draft?.bodyFeelings ?? '');
  const [actualBehavior, setActualBehavior] = useState(
    draft?.actualBehavior ?? '',
  );
  const [schemaIds, setSchemaIds] = useState<string[]>(draft?.schemaIds ?? []);
  const [schemaOrigin, setSchemaOrigin] = useState(draft?.schemaOrigin ?? '');
  const [healthyView, setHealthyView] = useState(draft?.healthyView ?? '');
  const [realProblems, setRealProblems] = useState(draft?.realProblems ?? '');
  const [excessiveReactions, setExcessiveReactions] = useState(
    draft?.excessiveReactions ?? '',
  );
  const [healthyBehavior, setHealthyBehavior] = useState(
    draft?.healthyBehavior ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [showAllSchemas, setShowAllSchemas] = useState(false);

  const hasPersonalSchemas = activeSchemaIds && activeSchemaIds.length > 0;
  const useFiltered = hasPersonalSchemas && !showAllSchemas;

  useEffect(() => {
    const data: DraftData = {
      trigger,
      emotions,
      thoughts,
      bodyFeelings,
      actualBehavior,
      schemaIds,
      schemaOrigin,
      healthyView,
      realProblems,
      excessiveReactions,
      healthyBehavior,
    };
    saveDraft('schema', data);
  }, [
    trigger,
    emotions,
    thoughts,
    bodyFeelings,
    actualBehavior,
    schemaIds,
    schemaOrigin,
    healthyView,
    realProblems,
    excessiveReactions,
    healthyBehavior,
  ]);

  const toggleEmotion = (id: string) => {
    haptic.select();
    setEmotions((prev) =>
      prev.find((e) => e.id === id)
        ? prev.filter((e) => e.id !== id)
        : [...prev, { id, intensity: 3 }],
    );
  };

  const setIntensity = (id: string, intensity: number) => {
    haptic.select();
    setEmotions((prev) =>
      prev.map((e) => (e.id === id ? { ...e, intensity } : e)),
    );
  };

  const toggleSchema = (id: string) => {
    haptic.select();
    setSchemaIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const canSave = trigger.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    haptic.success();
    setSaving(true);
    try {
      await onSave({
        trigger,
        emotions,
        thoughts: thoughts || undefined,
        bodyFeelings: bodyFeelings || undefined,
        actualBehavior: actualBehavior || undefined,
        schemaIds,
        schemaOrigin: schemaOrigin || undefined,
        healthyView: healthyView || undefined,
        realProblems: realProblems || undefined,
        excessiveReactions: excessiveReactions || undefined,
        healthyBehavior: healthyBehavior || undefined,
      });
      clearDraft('schema');
    } catch {
      haptic.error();
    } finally {
      setSaving(false);
      onClose();
    }
  };

  const hasDraft = !!(
    draft &&
    Object.values(draft).some((v) =>
      Array.isArray(v)
        ? v.length > 0
        : typeof v === 'string' && v.trim().length > 0,
    )
  );

  return (
    <BottomSheet onClose={onClose}>
      <div>
        <DiaryStickyHeader
          title="Дневник схем"
          subtitle={hasDraft ? 'Продолжаем с того места' : 'С чего начнём?'}
          color={COLOR}
          canSave={canSave}
          saving={saving}
          onSave={handleSave}
        />

        <StepLabel
          step={1}
          title="Что случилось?"
          hint="опиши ситуацию — где, с кем, когда"
          required
        />
        <DiaryTextArea
          value={trigger}
          onChange={setTrigger}
          placeholder={tr(
            'Что произошло? Где ты был/а, с кем, в какой момент?',
            'Что произошло? Где вы были, с кем, в какой момент?',
          )}
          rows={3}
        />

        <StepLabel step={2} title="Чувства" hint="что поднялось внутри" />
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 7,
            marginBottom: 10,
          }}
        >
          {EMOTIONS.map((em) => {
            const sel = emotions.find((e) => e.id === em.id);
            return (
              <button
                key={em.id}
                onClick={() => toggleEmotion(em.id)}
                className="sel-btn"
                style={{
                  background: sel ? '#f8717133' : 'rgba(var(--fg-rgb),0.06)',
                  border: sel ? '1px solid #f87171' : '1px solid transparent',
                  borderRadius: 20,
                  padding: '6px 12px',
                  color: sel
                    ? 'var(--chip-sel-text)'
                    : 'rgba(var(--fg-rgb),0.6)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {em.emoji} {em.label}
              </button>
            );
          })}
        </div>
        {emotions.map((em) => {
          const meta = EMOTIONS.find((e) => e.id === em.id)!;
          return (
            <div
              key={em.id}
              style={{
                marginBottom: 8,
                background: 'rgba(var(--fg-rgb),0.04)',
                borderRadius: 12,
                padding: '10px 12px',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-sub)',
                  marginBottom: 7,
                }}
              >
                {meta.emoji} {meta.label}
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                {INTENSITY_LABELS.map((lbl, i) => (
                  <button
                    key={i}
                    onClick={() => setIntensity(em.id, i + 1)}
                    className="sel-btn"
                    style={{
                      flex: 1,
                      background:
                        em.intensity === i + 1
                          ? COLOR
                          : 'rgba(var(--fg-rgb),0.08)',
                      border: 'none',
                      borderRadius: 8,
                      padding: '5px 2px',
                      color:
                        em.intensity === i + 1
                          ? '#fff'
                          : 'rgba(var(--fg-rgb),0.4)',
                      fontSize: 10,
                      cursor: 'pointer',
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <StepLabel step={3} title="Мысли" hint="о чём думаешь" />
        <DiaryTextArea
          value={thoughts}
          onChange={setThoughts}
          placeholder={tr(
            'Какие мысли появились? Что ты говоришь себе?',
            'Какие мысли появились? Что вы говорите себе?',
          )}
        />

        <StepLabel step={4} title="Тело" hint="что ощущаешь физически" />
        <DiaryTextArea
          value={bodyFeelings}
          onChange={setBodyFeelings}
          placeholder="Где в теле это чувствуется? Сжатие, тяжесть, пульс, дыхание..."
          rows={2}
        />

        <StepLabel
          step={5}
          title="Моя реакция"
          hint={tr(
            'что ты делаешь или хочешь сделать',
            'что вы делаете или хотите сделать',
          )}
        />
        <DiaryTextArea
          value={actualBehavior}
          onChange={setActualBehavior}
          placeholder={tr(
            'Что ты сделал/а или хотел/а сделать? Убежать, замолчать, накричать...',
            'Что вы сделали или хотели сделать? Убежать, замолчать, накричать...',
          )}
          rows={2}
        />

        <StepLabel step={6} title="Схемы" hint="что сработало" />
        {SCHEMA_DOMAINS.map((domain) => {
          const schemas = useFiltered
            ? domain.schemas.filter(
                (s) => activeSchemaIds?.includes(s.id) ?? false,
              )
            : domain.schemas;
          if (schemas.length === 0) return null;
          return (
            <div key={domain.id} style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 11,
                  color: domain.color,
                  fontWeight: 600,
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {domain.domain}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {schemas.map((s) => {
                  const sel = schemaIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSchema(s.id)}
                      className="sel-btn"
                      style={{
                        background: sel
                          ? `${domain.color}33`
                          : 'rgba(var(--fg-rgb),0.06)',
                        border: sel
                          ? `1px solid ${domain.color}`
                          : '1px solid transparent',
                        borderRadius: 16,
                        padding: '5px 10px',
                        color: sel
                          ? 'var(--chip-sel-text)'
                          : 'rgba(var(--fg-rgb),0.6)',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {hasPersonalSchemas && (
          <button
            onClick={() => {
              haptic.tap();
              setShowAllSchemas((v) => !v);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-sub)',
              fontSize: 12,
              cursor: 'pointer',
              padding: '4px 0',
              marginBottom: 8,
            }}
          >
            {showAllSchemas ? '↑ Только мои' : '↓ Показать все'}
          </button>
        )}
        <DiaryTextArea
          value={schemaOrigin}
          onChange={setSchemaOrigin}
          placeholder="Это напоминает что-то из прошлого? Из детства?"
          rows={2}
        />

        <StepLabel
          step={7}
          title="Здоровый взгляд"
          hint="если смотреть трезво"
        />
        <DiaryTextArea
          value={healthyView}
          onChange={setHealthyView}
          placeholder="Если убрать схему в сторону — что на самом деле здесь происходит?"
        />

        <StepLabel
          step={8}
          title="Что реально трудно"
          hint="без преувеличения"
        />
        <DiaryTextArea
          value={realProblems}
          onChange={setRealProblems}
          placeholder="Что в этом моменте по-настоящему трудно — если не раздувать?"
          rows={2}
        />

        <StepLabel
          step={9}
          title="Где я раздул/а"
          hint="что оказалось крупнее, чем есть"
        />
        <DiaryTextArea
          value={excessiveReactions}
          onChange={setExcessiveReactions}
          placeholder="Где реакция оказалась больше, чем требовала ситуация?"
          rows={2}
        />

        <StepLabel
          step={10}
          title="Здоровое поведение"
          hint="как поступил бы Здоровый Взрослый"
        />
        <DiaryTextArea
          value={healthyBehavior}
          onChange={setHealthyBehavior}
          placeholder={tr(
            'Что сделал бы Здоровый Взрослый внутри тебя?',
            'Что сделал бы Здоровый Взрослый внутри вас?',
          )}
        />

        {detectCrisisAny(
          trigger,
          thoughts,
          bodyFeelings,
          actualBehavior,
          schemaOrigin,
          healthyView,
          realProblems,
          excessiveReactions,
          healthyBehavior,
        ) && <CrisisCard />}

        {!canSave && (
          <div
            style={{
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--text-sub)',
              marginTop: 16,
              paddingBottom: 8,
            }}
          >
            {tr(
              'Опиши ситуацию — и можно будет сохранить',
              'Опишите ситуацию — и можно будет сохранить',
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
