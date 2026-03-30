import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { MODE_GROUPS } from '../diaryData';

interface Props {
  onClose: () => void;
  onSave: (data: {
    modeId: string;
    trigger: string;
    intensity: number;
    healthyAdult?: string;
  }) => Promise<void>;
}

const label = (text: string) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, marginTop: 22 }}>
    {text}
  </div>
);

const textarea = (value: string, onChange: (v: string) => void, placeholder: string, rows = 3) => (
  <textarea
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    style={{
      width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12, padding: '12px 14px', color: '#fff', fontSize: 14, lineHeight: 1.5, outline: 'none',
    }}
  />
);

export function ModeEntrySheet({ onClose, onSave }: Props) {
  const [modeId, setModeId] = useState('');
  const [trigger, setTrigger] = useState('');
  const [intensity, setIntensity] = useState(5);
  const [healthyAdult, setHealthyAdult] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = modeId.length > 0 && trigger.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({ modeId, trigger, intensity, healthyAdult: healthyAdult || undefined });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4, paddingTop: 4 }}>Дневник режимов</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Новая запись</div>

      {label('Режим *')}
      {MODE_GROUPS.map(group => (
        <div key={group.id} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: group.color, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{group.group}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {group.items.map(m => {
              const sel = modeId === m.id;
              return (
                <button key={m.id} onClick={() => setModeId(sel ? '' : m.id)} style={{
                  background: sel ? `${group.color}33` : 'rgba(255,255,255,0.06)',
                  border: sel ? `1px solid ${group.color}` : '1px solid transparent',
                  borderRadius: 16, padding: '6px 12px', color: sel ? '#fff' : 'rgba(255,255,255,0.6)',
                  fontSize: 13, cursor: 'pointer',
                }}>
                  {m.emoji} {m.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {label('Интенсивность')}
      <div style={{ display: 'flex', gap: 6 }}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <button key={n} onClick={() => setIntensity(n)} style={{
            flex: 1, background: intensity === n ? '#60a5fa' : intensity >= n ? '#60a5fa44' : 'rgba(255,255,255,0.08)',
            border: 'none', borderRadius: 8, padding: '8px 0',
            color: intensity >= n ? '#fff' : 'rgba(255,255,255,0.4)',
            fontSize: 13, fontWeight: intensity === n ? 700 : 400, cursor: 'pointer',
          }}>
            {n}
          </button>
        ))}
      </div>

      {label('Что запустило режим? *')}
      {textarea(trigger, setTrigger, 'Ситуация, слова, мысль, ощущение — что именно?', 3)}

      {label('Ответ Здорового Взрослого (необязательно)')}
      {textarea(healthyAdult, setHealthyAdult, 'Что бы сказал Здоровый Взрослый?', 2)}

      <button onClick={handleSave} disabled={!canSave || saving} style={{
        marginTop: 24, width: '100%', padding: '14px', borderRadius: 14,
        background: canSave ? '#60a5fa' : 'rgba(255,255,255,0.1)',
        color: canSave ? '#fff' : 'rgba(255,255,255,0.3)',
        border: 'none', fontSize: 16, fontWeight: 600, cursor: canSave ? 'pointer' : 'default',
      }}>
        {saving ? 'Сохраняю...' : 'Сохранить'}
      </button>
    </BottomSheet>
  );
}
