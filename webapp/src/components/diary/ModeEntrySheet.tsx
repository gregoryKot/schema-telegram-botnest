import { useState, useEffect } from 'react';
import { GlyphArrowLeft } from '../exercises/ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { MODE_GROUPS } from '../../schemaTherapyData';
import { saveDraft, loadDraft, clearDraft } from '../../utils/drafts';
import { haptic } from '../../haptic';

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

function StepLabel({ step, title, hint }: { step: number; title: string; hint?: string }) {
  return (
    <div style={{ marginTop: 22, marginBottom: 9, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', marginTop: 1,
      }}>
        {step}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        {hint && <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>{hint}</div>}
      </div>
    </div>
  );
}

function Area({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder: string; rows?: number }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="field-input" style={{
      width: '100%', background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.1)',
      borderRadius: 12, padding: '12px 14px', color: 'var(--text)', fontSize: 14, lineHeight: 1.5, outline: 'none',
    }} />
  );
}

export function ModeEntrySheet({ onClose, onSave }: Props) {
  const goBack = useHistorySheet(onClose);
  const existing = loadDraft<{ modeId: string; situation: string; thoughts: string; feelings: string; bodyFeelings: string; actions: string; actualNeed: string; childhoodMemories: string }>('mode');
  const d = existing?.data;

  const [modeId, setModeId] = useState(d?.modeId ?? '');
  const [situation, setSituation] = useState(d?.situation ?? '');
  const [thoughts, setThoughts] = useState(d?.thoughts ?? '');
  const [feelings, setFeelings] = useState(d?.feelings ?? '');
  const [bodyFeelings, setBodyFeelings] = useState(d?.bodyFeelings ?? '');
  const [actions, setActions] = useState(d?.actions ?? '');
  const [actualNeed, setActualNeed] = useState(d?.actualNeed ?? '');
  const [childhoodMemories, setChildhoodMemories] = useState(d?.childhoodMemories ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    saveDraft('mode', { modeId, situation, thoughts, feelings, bodyFeelings, actions, actualNeed, childhoodMemories });
  }, [modeId, situation, thoughts, feelings, bodyFeelings, actions, actualNeed, childhoodMemories]);

  const canSave = modeId.length > 0 && situation.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    haptic.success();
    setSaving(true);
    try {
      await onSave({
        modeId, situation,
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
      goBack();
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="ex-btn ex-btn-ghost" onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px' }}>
          <GlyphArrowLeft /> Назад
        </button>
        <button onClick={handleSave} disabled={!canSave || saving} style={{
          padding: '6px 18px', borderRadius: 10, border: 'none',
          background: canSave ? COLOR : 'rgba(var(--fg-rgb),0.08)',
          color: canSave ? '#fff' : 'rgba(var(--fg-rgb),0.25)',
          fontSize: 13, fontWeight: 600, cursor: canSave ? 'pointer' : 'default', flexShrink: 0,
        }}>
          {saving ? 'Сохраняю...' : 'Сохранить'}
        </button>
      </div>
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '36px 24px 80px' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', lineHeight: 1.15, marginBottom: 6 }}>
          Дневник режимов
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 24 }}>
          {existing ? 'Продолжаем с того места' : 'Кто сейчас внутри?'}
        </p>

        <StepLabel step={1} title="Режим" hint="кто взял управление" />
        {MODE_GROUPS.map(group => (
          <div key={group.id} style={{ marginBottom: 12 }}>
            <div className="eyebrow" style={{ color: group.color, marginBottom: 6 }}>{group.group}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {group.items.map(m => {
                const sel = modeId === m.id;
                return (
                  <button key={m.id} onClick={() => { haptic.select(); setModeId(sel ? '' : m.id); }} className="sel-btn" style={{
                    background: sel ? `${group.color}33` : 'rgba(var(--fg-rgb),0.06)',
                    border: sel ? `1px solid ${group.color}` : '1px solid transparent',
                    borderRadius: 16, padding: '6px 11px',
                    color: sel ? 'var(--chip-sel-text)' : 'rgba(var(--fg-rgb),0.6)',
                    fontSize: 13, cursor: 'pointer',
                  }}>
                    {m.emoji} {m.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <StepLabel step={2} title="Ситуация" hint="что случилось" />
        <Area value={situation} onChange={setSituation} placeholder="Что произошло? Где ты, с кем, в какой момент?" />

        <StepLabel step={3} title="Мысли" hint="что говорит этот режим" />
        <Area value={thoughts} onChange={setThoughts} placeholder="Что этот режим говорит тебе? Во что он верит?" rows={2} />

        <StepLabel step={4} title="Чувства" hint="что этот режим ощущает" />
        <Area value={feelings} onChange={setFeelings} placeholder="Что этот режим чувствует? Страх, злость, пустоту..." rows={2} />

        <StepLabel step={5} title="Тело" hint="что ощущаешь" />
        <Area value={bodyFeelings} onChange={setBodyFeelings} placeholder="Что происходит с телом? Напряжение, онемение, тяжесть..." rows={2} />

        <StepLabel step={6} title="Действия" hint="что ты делаешь или делал/а" />
        <Area value={actions} onChange={setActions} placeholder="Как этот режим тебя тянет поступить?" rows={2} />

        <StepLabel step={7} title="Что тебе на самом деле нужно?" />
        <Area value={actualNeed} onChange={setActualNeed} placeholder="Чего тебе на самом деле не хватает?" rows={2} />

        <StepLabel step={8} title="Детские воспоминания" hint="связанные с ситуацией" />
        <Area value={childhoodMemories} onChange={setChildhoodMemories} placeholder="Напоминает что-то из детства? Похожее чувство, похожая ситуация?" rows={3} />

        {!canSave && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-sub)', marginTop: 20 }}>
            Выбери режим и опиши ситуацию — и можно будет сохранить
          </div>
        )}
      </div>
    </div>
  );
}
