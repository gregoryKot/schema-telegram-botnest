import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { MODE_GROUPS } from '../diaryData';
import { haptic } from '../haptic';

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

const COLOR = '#60a5fa';

function StepLabel({ step, title, hint, required }: { step: number; title: string; hint?: string; required?: boolean }) {
  return (
    <div style={{ marginTop: 22, marginBottom: 9, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: `${COLOR}22`, border: `1px solid ${COLOR}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: COLOR, marginTop: 1,
      }}>
        {step}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
          {title}
          {required && <span style={{ color: COLOR, marginLeft: 4, fontSize: 12 }}>*</span>}
        </div>
        {hint && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{hint}</div>}
      </div>
    </div>
  );
}

function Area({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="field-input"
      style={{
        width: '100%',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: '12px 14px',
        color: '#fff',
        fontSize: 14,
        lineHeight: 1.5,
        outline: 'none',
      }}
    />
  );
}

export function ModeEntrySheet({ onClose, onSave }: Props) {
  const [modeId, setModeId] = useState('');
  const [situation, setSituation] = useState('');
  const [thoughts, setThoughts] = useState('');
  const [feelings, setFeelings] = useState('');
  const [bodyFeelings, setBodyFeelings] = useState('');
  const [actions, setActions] = useState('');
  const [actualNeed, setActualNeed] = useState('');
  const [childhoodMemories, setChildhoodMemories] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = modeId.length > 0 && situation.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
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
      haptic.success();
      onClose();
    } catch {
      haptic.error();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Дневник режимов</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', marginBottom: 4 }}>Кто сейчас внутри?</div>

        <StepLabel step={1} title="Режим" hint="кто взял управление" required />
        {MODE_GROUPS.map(group => (
          <div key={group.id} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: group.color, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>{group.group}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {group.items.map(m => {
                const sel = modeId === m.id;
                return (
                  <button key={m.id} onClick={() => { haptic.select(); setModeId(sel ? '' : m.id); }} className="sel-btn" style={{
                    background: sel ? `${group.color}28` : 'rgba(255,255,255,0.06)',
                    border: sel ? `1px solid ${group.color}` : '1px solid transparent',
                    borderRadius: 16, padding: '6px 11px',
                    color: sel ? '#fff' : 'rgba(255,255,255,0.55)',
                    fontSize: 13, cursor: 'pointer',
                  }}>
                    {m.emoji} {m.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <StepLabel step={2} title="Ситуация" hint="что произошло" required />
        <Area value={situation} onChange={setSituation} placeholder="Что случилось? Где ты, с кем, в какой момент?" />

        <StepLabel step={3} title="Мысли" />
        <Area value={thoughts} onChange={setThoughts} placeholder="Что говорит этот режим? Какие у него мысли?" rows={2} />

        <StepLabel step={4} title="Чувства" />
        <Area value={feelings} onChange={setFeelings} placeholder="Что этот режим чувствует? Страх, злость, пустоту..." rows={2} />

        <StepLabel step={5} title="Тело" hint="что ощущаешь" />
        <Area value={bodyFeelings} onChange={setBodyFeelings} placeholder="Что происходит с телом? Напряжение, онемение, тяжесть..." rows={2} />

        <StepLabel step={6} title="Действия" hint="что ты делаешь или делал/а" />
        <Area value={actions} onChange={setActions} placeholder="Что этот режим заставляет тебя делать или хотеть сделать?" rows={2} />

        <StepLabel step={7} title="Что тебе на самом деле было нужно?" />
        <Area value={actualNeed} onChange={setActualNeed} placeholder="Какую потребность пытается закрыть этот режим?" rows={2} />

        <StepLabel step={8} title="Детские воспоминания" hint="связанные с ситуацией" />
        <Area value={childhoodMemories} onChange={setChildhoodMemories} placeholder="Напоминает что-то из детства? Похожее чувство, похожая ситуация?" rows={3} />

        <button onClick={handleSave} disabled={!canSave || saving} style={{
          marginTop: 24, width: '100%', padding: '15px', borderRadius: 14,
          background: canSave ? COLOR : 'rgba(255,255,255,0.09)',
          color: canSave ? '#fff' : 'rgba(255,255,255,0.28)',
          border: 'none', fontSize: 16, fontWeight: 600, cursor: canSave ? 'pointer' : 'default',
          transition: 'background 200ms, color 200ms',
        }}>
          {saving ? 'Сохраняю...' : 'Сохранить запись'}
        </button>
        {!canSave && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.28)', marginTop: 8 }}>
            Выбери режим и опиши ситуацию — и можно будет сохранить
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
