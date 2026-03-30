import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { EMOTIONS, INTENSITY_LABELS, SCHEMA_DOMAINS, MODE_GROUPS } from '../diaryData';
import { EmotionEntry } from '../types';

interface Props {
  onClose: () => void;
  onSave: (data: {
    situation: string;
    emotions: EmotionEntry[];
    emotionNote?: string;
    bodyFeelings?: string;
    thoughts?: string;
    schemaIds: string[];
    copingModeId?: string;
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
      borderRadius: 12, padding: '12px 14px', color: '#fff', fontSize: 14, lineHeight: 1.5,
      outline: 'none',
    }}
  />
);

export function SchemaEntrySheet({ onClose, onSave }: Props) {
  const [situation, setSituation] = useState('');
  const [emotions, setEmotions] = useState<EmotionEntry[]>([]);
  const [emotionNote, setEmotionNote] = useState('');
  const [bodyFeelings, setBodyFeelings] = useState('');
  const [thoughts, setThoughts] = useState('');
  const [schemaIds, setSchemaIds] = useState<string[]>([]);
  const [copingModeId, setCopingModeId] = useState('');
  const [healthyAdult, setHealthyAdult] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleEmotion = (id: string) => {
    setEmotions(prev => {
      if (prev.find(e => e.id === id)) return prev.filter(e => e.id !== id);
      return [...prev, { id, intensity: 3 }];
    });
  };

  const setIntensity = (id: string, intensity: number) =>
    setEmotions(prev => prev.map(e => e.id === id ? { ...e, intensity } : e));

  const toggleSchema = (id: string) =>
    setSchemaIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const canSave = situation.trim().length > 0 && emotions.length > 0 && schemaIds.length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({ situation, emotions, emotionNote: emotionNote || undefined, bodyFeelings: bodyFeelings || undefined, thoughts: thoughts || undefined, schemaIds, copingModeId: copingModeId || undefined, healthyAdult: healthyAdult || undefined });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4, paddingTop: 4 }}>Дневник схем</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Новая запись</div>

      {label('Ситуация *')}
      {textarea(situation, setSituation, 'Что произошло? Где, когда, с кем?', 4)}

      {label('Эмоции *')}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {EMOTIONS.map(em => {
          const sel = emotions.find(e => e.id === em.id);
          return (
            <button key={em.id} onClick={() => toggleEmotion(em.id)} style={{
              background: sel ? '#f8717133' : 'rgba(255,255,255,0.06)',
              border: sel ? '1px solid #f87171' : '1px solid transparent',
              borderRadius: 20, padding: '6px 12px', color: '#fff', fontSize: 13, cursor: 'pointer',
            }}>
              {em.emoji} {em.label}
            </button>
          );
        })}
      </div>
      {emotions.map(em => {
        const meta = EMOTIONS.find(e => e.id === em.id)!;
        return (
          <div key={em.id} style={{ marginTop: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>{meta.emoji} {meta.label}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {INTENSITY_LABELS.map((lbl, i) => (
                <button key={i} onClick={() => setIntensity(em.id, i + 1)} style={{
                  flex: 1, background: em.intensity === i + 1 ? '#f87171' : 'rgba(255,255,255,0.08)',
                  border: 'none', borderRadius: 8, padding: '5px 2px', color: em.intensity === i + 1 ? '#fff' : 'rgba(255,255,255,0.5)',
                  fontSize: 10, cursor: 'pointer', textAlign: 'center',
                }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {emotions.length > 0 && (
        <>
          <div style={{ marginTop: 10 }} />
          {textarea(emotionNote, setEmotionNote, 'Подробности об эмоциях (необязательно)', 2)}
        </>
      )}

      {label('Ощущения в теле')}
      {textarea(bodyFeelings, setBodyFeelings, 'Что чувствовало тело? Сжатие, тяжесть, тепло...', 2)}

      {label('Автоматические мысли')}
      {textarea(thoughts, setThoughts, 'Какие мысли возникли автоматически?', 2)}

      {label('Схемы *')}
      {SCHEMA_DOMAINS.map(domain => (
        <div key={domain.id} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: domain.color, fontWeight: 600, marginBottom: 6 }}>{domain.domain}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {domain.schemas.map(s => {
              const sel = schemaIds.includes(s.id);
              return (
                <button key={s.id} onClick={() => toggleSchema(s.id)} style={{
                  background: sel ? `${domain.color}33` : 'rgba(255,255,255,0.06)',
                  border: sel ? `1px solid ${domain.color}` : '1px solid transparent',
                  borderRadius: 16, padding: '5px 10px', color: sel ? '#fff' : 'rgba(255,255,255,0.6)',
                  fontSize: 12, cursor: 'pointer',
                }}>
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {label('Режим копинга (необязательно)')}
      {MODE_GROUPS.filter(g => !g.id.includes('healthy')).map(group => (
        <div key={group.id} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: group.color, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{group.group}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {group.items.map(m => {
              const sel = copingModeId === m.id;
              return (
                <button key={m.id} onClick={() => setCopingModeId(sel ? '' : m.id)} style={{
                  background: sel ? `${group.color}33` : 'rgba(255,255,255,0.06)',
                  border: sel ? `1px solid ${group.color}` : '1px solid transparent',
                  borderRadius: 16, padding: '5px 10px', color: sel ? '#fff' : 'rgba(255,255,255,0.55)',
                  fontSize: 12, cursor: 'pointer',
                }}>
                  {m.emoji} {m.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {label('Ответ Здорового Взрослого (необязательно)')}
      {textarea(healthyAdult, setHealthyAdult, 'Что бы сказал Здоровый Взрослый в этой ситуации?', 3)}

      <button onClick={handleSave} disabled={!canSave || saving} style={{
        marginTop: 24, width: '100%', padding: '14px', borderRadius: 14,
        background: canSave ? '#f87171' : 'rgba(255,255,255,0.1)',
        color: canSave ? '#fff' : 'rgba(255,255,255,0.3)',
        border: 'none', fontSize: 16, fontWeight: 600, cursor: canSave ? 'pointer' : 'default',
      }}>
        {saving ? 'Сохраняю...' : 'Сохранить'}
      </button>
      {!canSave && (
        <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
          Заполни ситуацию, выбери эмоции и схемы
        </div>
      )}
    </BottomSheet>
  );
}
