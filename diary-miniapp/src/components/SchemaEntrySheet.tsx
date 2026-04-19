import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { EMOTIONS, INTENSITY_LABELS, SCHEMA_DOMAINS } from '../diaryData';
import { EmotionEntry } from '../types';
import { haptic } from '../haptic';

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

const COLOR = '#f87171';

function RequiredProgress({ trigger, hasEmotions, hasSchemas }: { trigger: string; hasEmotions: boolean; hasSchemas: boolean }) {
  const steps = [
    { label: 'Ситуация', done: trigger.trim().length > 0 },
    { label: 'Эмоции', done: hasEmotions },
    { label: 'Схемы', done: hasSchemas },
  ];
  const filled = steps.filter(s => s.done).length;

  return (
    <div style={{ marginBottom: 18, marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 5, marginBottom: 7 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ flex: 1, position: 'relative' }}>
            <div style={{
              height: 3, borderRadius: 2,
              background: s.done ? COLOR : 'rgba(255,255,255,0.1)',
              transition: 'background 300ms ease',
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            flex: 1, fontSize: 10, fontWeight: 500, letterSpacing: '0.02em',
            color: s.done ? COLOR : 'rgba(255,255,255,0.25)',
            transition: 'color 300ms ease',
          }}>
            {s.done ? '✓ ' : ''}{s.label}
          </div>
        ))}
      </div>
      {filled === 3 && (
        <div style={{ fontSize: 11, color: COLOR, marginTop: 6, opacity: 0.8 }}>
          Все обязательные поля заполнены — можно сохранять
        </div>
      )}
    </div>
  );
}

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

export function SchemaEntrySheet({ activeSchemaIds, onClose, onSave }: Props) {
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
  const [showAllSchemas, setShowAllSchemas] = useState(false);

  const hasPersonalSchemas = activeSchemaIds && activeSchemaIds.length > 0;
  const useFiltered = hasPersonalSchemas && !showAllSchemas;

  const toggleEmotion = (id: string) => {
    haptic.select();
    setEmotions(prev => prev.find(e => e.id === id) ? prev.filter(e => e.id !== id) : [...prev, { id, intensity: 3 }]);
  };

  const setIntensity = (id: string, intensity: number) => {
    haptic.select();
    setEmotions(prev => prev.map(e => e.id === id ? { ...e, intensity } : e));
  };

  const toggleSchema = (id: string) => {
    haptic.select();
    setSchemaIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

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
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Дневник проявления схем</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', marginBottom: 12 }}>Новая запись</div>

        <RequiredProgress trigger={trigger} hasEmotions={emotions.length > 0} hasSchemas={schemaIds.length > 0} />

        <StepLabel step={1} title="Спусковой механизм" hint="что произошло" required />
        <Area value={trigger} onChange={setTrigger} placeholder="Опиши ситуацию: что случилось, где, с кем, когда?" rows={3} />

        <StepLabel step={2} title="Чувства" hint="что я чувствую и готов/а сделать" required />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {EMOTIONS.map(em => {
            const sel = emotions.find(e => e.id === em.id);
            return (
              <button key={em.id} onClick={() => toggleEmotion(em.id)} className="sel-btn" style={{
                background: sel ? '#f8717128' : 'rgba(255,255,255,0.06)',
                border: sel ? '1px solid #f87171' : '1px solid transparent',
                borderRadius: 20, padding: '6px 12px',
                color: sel ? '#fff' : 'rgba(255,255,255,0.55)',
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
            <div key={em.id} style={{ marginBottom: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.58)', marginBottom: 7 }}>{meta.emoji} {meta.label}</div>
              <div style={{ display: 'flex', gap: 5 }}>
                {INTENSITY_LABELS.map((lbl, i) => (
                  <button key={i} onClick={() => setIntensity(em.id, i + 1)} className="sel-btn" style={{
                    flex: 1, background: em.intensity === i + 1 ? COLOR : 'rgba(255,255,255,0.07)',
                    border: 'none', borderRadius: 8, padding: '5px 2px',
                    color: em.intensity === i + 1 ? '#fff' : 'rgba(255,255,255,0.38)',
                    fontSize: 10, cursor: 'pointer',
                  }}>{lbl}</button>
                ))}
              </div>
            </div>
          );
        })}

        <StepLabel step={3} title="Мысли" hint="что я думаю и предполагаю, чего боюсь" />
        <Area value={thoughts} onChange={setThoughts} placeholder="Какие мысли возникли? Чего опасаешься?" />

        <StepLabel step={4} title="Тело" hint="что с моим телом" />
        <Area value={bodyFeelings} onChange={setBodyFeelings} placeholder="Сжатие в груди, тяжесть, учащённый пульс..." rows={2} />

        <StepLabel step={5} title="Фактическое поведение" hint="что я сейчас делаю" />
        <Area value={actualBehavior} onChange={setActualBehavior} placeholder="Что ты делаешь или хочешь сделать в этой ситуации?" rows={2} />

        <StepLabel step={6} title="Схемы" hint="какая проявилась, откуда она у меня" required />
        {SCHEMA_DOMAINS.map(domain => {
          const schemas = useFiltered
            ? domain.schemas.filter(s => activeSchemaIds!.includes(s.id))
            : domain.schemas;
          if (schemas.length === 0) return null;
          return (
            <div key={domain.id} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: domain.color, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>{domain.domain}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {schemas.map(s => {
                  const sel = schemaIds.includes(s.id);
                  return (
                    <button key={s.id} onClick={() => toggleSchema(s.id)} className="sel-btn" style={{
                      background: sel ? `${domain.color}28` : 'rgba(255,255,255,0.06)',
                      border: sel ? `1px solid ${domain.color}` : '1px solid transparent',
                      borderRadius: 16, padding: '5px 10px',
                      color: sel ? '#fff' : 'rgba(255,255,255,0.55)',
                      fontSize: 12, cursor: 'pointer',
                    }}>{s.name}</button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {hasPersonalSchemas && (
          <button onClick={() => setShowAllSchemas(v => !v)} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.32)',
            fontSize: 12, cursor: 'pointer', padding: '4px 0', marginBottom: 8,
          }}>
            {showAllSchemas ? '↑ Показать только мои схемы' : '↓ Показать все схемы'}
          </button>
        )}
        <Area value={schemaOrigin} onChange={setSchemaOrigin} placeholder="Откуда эта схема? Связанные воспоминания из прошлого..." rows={2} />

        <StepLabel step={7} title="Здоровый взгляд" hint="что на самом деле происходит" />
        <Area value={healthyView} onChange={setHealthyView} placeholder="Если смотреть на ситуацию без схемы — что ты видишь?" />

        <StepLabel step={8} title="Реальные проблемы" hint="в чём реальные трудности" />
        <Area value={realProblems} onChange={setRealProblems} placeholder="Что в этой ситуации действительно сложно?" rows={2} />

        <StepLabel step={9} title="Чрезмерные реакции" hint="в чём я переоценил/а ситуацию" />
        <Area value={excessiveReactions} onChange={setExcessiveReactions} placeholder="Где реакция была сильнее, чем требует ситуация?" rows={2} />

        <StepLabel step={10} title="Здоровое поведение" hint="что я могу сделать, сохраняя независимость и безопасность" />
        <Area value={healthyBehavior} onChange={setHealthyBehavior} placeholder="Как Здоровый Взрослый поступил бы в этой ситуации?" />

        <button onClick={handleSave} disabled={!canSave || saving} style={{
          marginTop: 24, width: '100%', padding: '15px', borderRadius: 14,
          background: canSave ? COLOR : 'rgba(255,255,255,0.09)',
          color: canSave ? '#fff' : 'rgba(255,255,255,0.28)',
          border: 'none', fontSize: 16, fontWeight: 600, cursor: canSave ? 'pointer' : 'default',
          transition: 'background 200ms, color 200ms',
        }}>
          {saving ? 'Сохраняю...' : 'Сохранить'}
        </button>
        {!canSave && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.28)', marginTop: 8 }}>
            Обязательно: спусковой механизм, эмоции и схемы
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
