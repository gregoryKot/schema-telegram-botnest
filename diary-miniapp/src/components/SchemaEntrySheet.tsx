import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { EMOTIONS, INTENSITY_LABELS, SCHEMA_DOMAINS } from '../diaryData';
import { EmotionEntry } from '../types';

interface Props {
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

const COLOR = '#f87171';

function FieldLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ marginTop: 20, marginBottom: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{title}</div>
      {hint && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function Area({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder: string; rows?: number }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{
      width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12, padding: '12px 14px', color: '#fff', fontSize: 14, lineHeight: 1.5, outline: 'none',
    }} />
  );
}

export function SchemaEntrySheet({ onClose, onSave }: Props) {
  const [trigger, setTrigger] = useState('');
  const [emotions, setEmotions] = useState<EmotionEntry[]>([]);
  const [thoughts, setThoughts] = useState('');
  const [bodyFeelings, setBodyFeelings] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [schemaIds, setSchemaIds] = useState<string[]>([]);
  const [schemaOrigin, setSchemaOrigin] = useState('');
  const [healthyView, setHealthyView] = useState('');
  const [realProblems, setRealProblems] = useState('');
  const [excessiveReactions, setExcessiveReactions] = useState('');
  const [healthyBehavior, setHealthyBehavior] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleEmotion = (id: string) =>
    setEmotions(prev => prev.find(e => e.id === id) ? prev.filter(e => e.id !== id) : [...prev, { id, intensity: 3 }]);

  const setIntensity = (id: string, intensity: number) =>
    setEmotions(prev => prev.map(e => e.id === id ? { ...e, intensity } : e));

  const toggleSchema = (id: string) =>
    setSchemaIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const canSave = trigger.trim().length > 0 && emotions.length > 0 && schemaIds.length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
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
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Дневник проявления схем</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Новая запись</div>

        {/* 1. Спусковой механизм */}
        <FieldLabel title="1. Спусковой механизм" hint="что произошло" />
        <Area value={trigger} onChange={setTrigger} placeholder="Опиши ситуацию: что случилось, где, с кем, когда?" rows={3} />

        {/* 2. Чувства */}
        <FieldLabel title="2. Чувства" hint="что я чувствую и готов/а сделать" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
          {EMOTIONS.map(em => {
            const sel = emotions.find(e => e.id === em.id);
            return (
              <button key={em.id} onClick={() => toggleEmotion(em.id)} style={{
                background: sel ? '#f8717133' : 'rgba(255,255,255,0.06)',
                border: sel ? '1px solid #f87171' : '1px solid transparent',
                borderRadius: 20, padding: '6px 12px', color: sel ? '#fff' : 'rgba(255,255,255,0.6)',
                fontSize: 13, cursor: 'pointer',
              }}>
                {em.emoji} {em.label}
              </button>
            );
          })}
        </div>
        {emotions.map(em => {
          const meta = EMOTIONS.find(e => e.id === em.id)!;
          return (
            <div key={em.id} style={{ marginBottom: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 7 }}>{meta.emoji} {meta.label}</div>
              <div style={{ display: 'flex', gap: 5 }}>
                {INTENSITY_LABELS.map((lbl, i) => (
                  <button key={i} onClick={() => setIntensity(em.id, i + 1)} style={{
                    flex: 1, background: em.intensity === i + 1 ? COLOR : 'rgba(255,255,255,0.08)',
                    border: 'none', borderRadius: 8, padding: '5px 2px',
                    color: em.intensity === i + 1 ? '#fff' : 'rgba(255,255,255,0.4)',
                    fontSize: 10, cursor: 'pointer',
                  }}>{lbl}</button>
                ))}
              </div>
            </div>
          );
        })}

        {/* 3. Мысли */}
        <FieldLabel title="3. Мысли" hint="что я думаю и предполагаю, чего боюсь" />
        <Area value={thoughts} onChange={setThoughts} placeholder="Какие мысли возникли? Чего опасаешься?" />

        {/* 4. Тело */}
        <FieldLabel title="4. Тело" hint="что с моим телом" />
        <Area value={bodyFeelings} onChange={setBodyFeelings} placeholder="Сжатие в груди, тяжесть, учащённый пульс..." rows={2} />

        {/* 5. Фактическое поведение */}
        <FieldLabel title="5. Фактическое поведение" hint="что я сейчас делаю" />
        <Area value={actualBehavior} onChange={setActualBehavior} placeholder="Что ты делаешь или хочешь сделать в этой ситуации?" rows={2} />

        {/* 6. Схемы */}
        <FieldLabel title="6. Схемы" hint="какая проявилась, откуда она у меня" />
        {SCHEMA_DOMAINS.map(domain => (
          <div key={domain.id} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: domain.color, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{domain.domain}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {domain.schemas.map(s => {
                const sel = schemaIds.includes(s.id);
                return (
                  <button key={s.id} onClick={() => toggleSchema(s.id)} style={{
                    background: sel ? `${domain.color}33` : 'rgba(255,255,255,0.06)',
                    border: sel ? `1px solid ${domain.color}` : '1px solid transparent',
                    borderRadius: 16, padding: '5px 10px',
                    color: sel ? '#fff' : 'rgba(255,255,255,0.6)',
                    fontSize: 12, cursor: 'pointer',
                  }}>{s.name}</button>
                );
              })}
            </div>
          </div>
        ))}
        <Area value={schemaOrigin} onChange={setSchemaOrigin} placeholder="Откуда эта схема? Связанные воспоминания из прошлого..." rows={2} />

        {/* 7. Здоровый взгляд */}
        <FieldLabel title="7. Здоровый взгляд" hint="что на самом деле происходит" />
        <Area value={healthyView} onChange={setHealthyView} placeholder="Если смотреть на ситуацию без схемы — что ты видишь?" />

        {/* 8. Реальные проблемы */}
        <FieldLabel title="8. Реальные проблемы" hint="в чём реальные трудности" />
        <Area value={realProblems} onChange={setRealProblems} placeholder="Что в этой ситуации действительно сложно?" rows={2} />

        {/* 9. Чрезмерные реакции */}
        <FieldLabel title="9. Чрезмерные реакции" hint="в чём я переоценил/а ситуацию" />
        <Area value={excessiveReactions} onChange={setExcessiveReactions} placeholder="Где реакция была сильнее, чем требует ситуация?" rows={2} />

        {/* 10. Здоровое поведение */}
        <FieldLabel title="10. Здоровое поведение" hint="что я могу сделать, сохраняя независимость и безопасность" />
        <Area value={healthyBehavior} onChange={setHealthyBehavior} placeholder="Как Здоровый Взрослый поступил бы в этой ситуации?" />

        <button onClick={handleSave} disabled={!canSave || saving} style={{
          marginTop: 24, width: '100%', padding: '14px', borderRadius: 14,
          background: canSave ? COLOR : 'rgba(255,255,255,0.1)',
          color: canSave ? '#fff' : 'rgba(255,255,255,0.3)',
          border: 'none', fontSize: 16, fontWeight: 600, cursor: canSave ? 'pointer' : 'default',
        }}>
          {saving ? 'Сохраняю...' : 'Сохранить'}
        </button>
        {!canSave && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
            Обязательно: спусковой механизм, эмоции и схемы
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
