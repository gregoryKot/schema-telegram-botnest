import { useState, useEffect } from 'react';
import { BottomSheet } from '../BottomSheet';
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
      onClose();
    }
  };

  return (
    <BottomSheet onClose={onClose}>
      <div>
        {/* Sticky header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 5,
          background: 'var(--sheet-bg)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingTop: 4, paddingBottom: 12,
          borderBottom: '1px solid rgba(var(--fg-rgb),0.06)',
          marginBottom: 8,
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Дневник режимов</div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>
              {existing ? 'Продолжаем с того места' : 'Кто сейчас внутри?'}
            </div>
          </div>
          <button onClick={handleSave} disabled={!canSave || saving} style={{
            padding: '9px 18px', borderRadius: 12, border: 'none',
            background: canSave ? COLOR : 'rgba(var(--fg-rgb),0.08)',
            color: canSave ? '#fff' : 'rgba(var(--fg-rgb),0.25)',
            fontSize: 13, fontWeight: 600, cursor: canSave ? 'pointer' : 'default', flexShrink: 0,
          }}>
            {saving ? 'Сохраняю...' : 'Сохранить'}
          </button>
        </div>

        <StepLabel step={1} title="Режим" hint="кто взял управление" />
        {MODE_GROUPS.map(group => (
          <div key={group.id} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: group.color, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{group.group}</div>
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
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-sub)', marginTop: 16, paddingBottom: 8 }}>
            Выбери режим и опиши ситуацию — и можно будет сохранить
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
