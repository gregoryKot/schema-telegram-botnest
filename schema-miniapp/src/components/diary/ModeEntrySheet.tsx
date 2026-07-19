import { useState, useEffect } from 'react';
import { BottomSheet } from '../BottomSheet';
import { MODE_GROUPS } from '../../schemaTherapyData';
import { saveDraft, loadDraft, clearDraft } from '../../utils/drafts';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import { DiaryTextArea } from './DiaryTextArea';
import { DiaryStickyHeader } from './DiaryStickyHeader';

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

function StepLabel({
  step,
  title,
  hint,
}: {
  step: number;
  title: string;
  hint?: string;
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
          background: 'rgba(96,165,250,0.15)',
          border: '1px solid rgba(96,165,250,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--accent-blue)',
          marginTop: 1,
        }}
      >
        {step}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          {title}
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

export function ModeEntrySheet({ onClose, onSave }: Props) {
  const tr = useTr();
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

        <StepLabel step={1} title="Режим" hint="кто взял управление" />
        {MODE_GROUPS.map((group) => (
          <div key={group.id} style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 10,
                color: group.color,
                fontWeight: 600,
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {group.group}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {group.items.map((m) => {
                const sel = modeId === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      haptic.select();
                      setModeId(sel ? '' : m.id);
                    }}
                    className="sel-btn"
                    style={{
                      background: sel
                        ? `${group.color}33`
                        : 'rgba(var(--fg-rgb),0.06)',
                      border: sel
                        ? `1px solid ${group.color}`
                        : '1px solid transparent',
                      borderRadius: 16,
                      padding: '6px 11px',
                      color: sel
                        ? 'var(--chip-sel-text)'
                        : 'rgba(var(--fg-rgb),0.6)',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {m.emoji} {m.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <StepLabel step={2} title="Ситуация" hint="что случилось" />
        <DiaryTextArea
          value={situation}
          onChange={setSituation}
          placeholder={tr(
            'Что произошло? Где ты, с кем, в какой момент?',
            'Что произошло? Где вы, с кем, в какой момент?',
          )}
        />

        <StepLabel step={3} title="Мысли" hint="что говорит этот режим" />
        <DiaryTextArea
          value={thoughts}
          onChange={setThoughts}
          placeholder={tr(
            'Что этот режим говорит тебе? Во что он верит?',
            'Что этот режим говорит вам? Во что он верит?',
          )}
          rows={2}
        />

        <StepLabel step={4} title="Чувства" hint="что этот режим ощущает" />
        <DiaryTextArea
          value={feelings}
          onChange={setFeelings}
          placeholder="Что этот режим чувствует? Страх, злость, пустоту..."
          rows={2}
        />

        <StepLabel step={5} title="Тело" hint="что ощущаешь" />
        <DiaryTextArea
          value={bodyFeelings}
          onChange={setBodyFeelings}
          placeholder="Что происходит с телом? Напряжение, онемение, тяжесть..."
          rows={2}
        />

        <StepLabel
          step={6}
          title="Действия"
          hint={tr('что ты делаешь или делал/а', 'что вы делаете или делали')}
        />
        <DiaryTextArea
          value={actions}
          onChange={setActions}
          placeholder={tr(
            'Как этот режим тебя тянет поступить?',
            'Как этот режим вас тянет поступить?',
          )}
          rows={2}
        />

        <StepLabel
          step={7}
          title={tr(
            'Что тебе на самом деле нужно?',
            'Что вам на самом деле нужно?',
          )}
        />
        <DiaryTextArea
          value={actualNeed}
          onChange={setActualNeed}
          placeholder={tr(
            'Чего тебе на самом деле не хватает?',
            'Чего вам на самом деле не хватает?',
          )}
          rows={2}
        />

        <StepLabel
          step={8}
          title="Детские воспоминания"
          hint="связанные с ситуацией"
        />
        <DiaryTextArea
          value={childhoodMemories}
          onChange={setChildhoodMemories}
          placeholder="Напоминает что-то из детства? Похожее чувство, похожая ситуация?"
          rows={3}
        />

        {detectCrisisAny(
          situation,
          thoughts,
          feelings,
          bodyFeelings,
          actions,
          actualNeed,
          childhoodMemories,
        ) && <CrisisCard surface="mode" />}

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
              'Выбери режим и опиши ситуацию — и можно будет сохранить',
              'Выберите режим и опишите ситуацию — и можно будет сохранить',
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
