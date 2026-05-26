import { useState, useRef, useEffect } from 'react';
import { GlyphArrowLeft } from './exercises/ExScreen';
import { SectionLabel } from './SectionLabel';
import { api } from '../api';
import { SCHEMA_DOMAINS, ALL_MODES } from '../schemaTherapyData';

type TaskType = 'diary_streak' | 'tracker_streak' | 'belief_check' | 'letter_to_self' | 'safe_place' | 'flashcard' | 'schema_intro' | 'mode_intro' | 'custom';

interface Props {
  clientId?: number;
  clientName?: string;
  defaultType?: TaskType;
  onCreated: () => void;
  onClose: () => void;
}

const STREAK_OPTIONS = [3, 7, 14, 30];

const TASK_OPTIONS: { type: TaskType; emoji: string; label: string; sub: string; hasStreak?: boolean }[] = [
  { type: 'diary_streak',   emoji: '📔', label: 'Дневник',              sub: 'Заполнять N дней подряд',                  hasStreak: true },
  { type: 'tracker_streak', emoji: '📊', label: 'Трекер потребностей',  sub: 'Отмечать N дней подряд',                   hasStreak: true },
  { type: 'schema_intro',   emoji: '🧩', label: 'Карточка схемы',       sub: 'Познакомиться со своей схемой — 7 вопросов' },
  { type: 'mode_intro',     emoji: '🔄', label: 'Карточка режима',      sub: 'Познакомиться со своим режимом' },
  { type: 'belief_check',   emoji: '🔍', label: 'Проверить убеждение',  sub: 'Собрать доказательства за и против' },
  { type: 'letter_to_self', emoji: '✉️', label: 'Письмо себе',          sub: 'Написать Уязвимому Ребёнку' },
  { type: 'safe_place',     emoji: '🏡', label: 'Безопасное место',     sub: 'Описать и перечитывать' },
  { type: 'flashcard',      emoji: '🆘', label: 'Мне сейчас плохо',     sub: 'Разобрать ситуацию — 5 шагов' },
  { type: 'custom',         emoji: '✏️', label: 'Своё задание',         sub: 'Любой текст' },
];

const ALL_SCHEMAS_FLAT = SCHEMA_DOMAINS.flatMap(d => d.schemas.map(s => ({ id: s.id, name: s.name, emoji: (s as any).emoji ?? '●', domainColor: d.color })));

export function getTaskDisplayText(type: string, text: string): string {
  if (type === 'schema_intro') {
    const s = ALL_SCHEMAS_FLAT.find(x => x.id === text);
    return s ? `Карточка схемы: ${s.name}` : 'Карточка схемы';
  }
  if (type === 'mode_intro') {
    const m = ALL_MODES.find(x => x.id === text);
    return m ? `Карточка режима: ${m.name}` : 'Карточка режима';
  }
  return text;
}

export function TaskCreateSheet({ clientId, clientName, defaultType, onCreated, onClose }: Props) {
  const [type, setType] = useState<TaskType>(defaultType ?? 'diary_streak');
  const [targetDays, setTargetDays] = useState(7);
  const [text, setText] = useState('');
  const [selectedSchemaId, setSelectedSchemaId] = useState('');
  const [selectedModeId, setSelectedModeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const configRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((type === 'schema_intro' || type === 'mode_intro') && configRef.current) {
      setTimeout(() => configRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
  }, [type]);

  const selected = TASK_OPTIONS.find(o => o.type === type)!;

  function getPayloadText(): string {
    switch (type) {
      case 'diary_streak':    return `Заполнять дневник ${targetDays} дней подряд`;
      case 'tracker_streak':  return `Отмечать потребности ${targetDays} дней подряд`;
      case 'schema_intro':    return selectedSchemaId;
      case 'mode_intro':      return selectedModeId;
      case 'belief_check':    return 'Проверить убеждение';
      case 'letter_to_self':  return 'Написать письмо Уязвимому Ребёнку';
      case 'safe_place':      return 'Описать Безопасное место';
      case 'flashcard':       return 'Разобрать сложную ситуацию по шагам';
      default:                return text;
    }
  }

  async function handleCreate() {
    const finalText = getPayloadText().trim();
    if (type === 'custom' && !finalText) { setError('Введи описание задания'); return; }
    if (type === 'schema_intro' && !selectedSchemaId) { setError('Выбери схему'); return; }
    if (type === 'mode_intro' && !selectedModeId) { setError('Выбери режим'); return; }
    setSaving(true); setError('');
    try {
      await api.createTask({ type, text: finalText, targetDays: selected.hasStreak ? targetDays : undefined, dueDate: dueDate || undefined, clientId });
      onCreated();
    } catch { setError('Не удалось сохранить'); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '12px 24px' }}>
        <button className="ex-btn ex-btn-ghost" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px' }}>
          <GlyphArrowLeft /> Назад
        </button>
      </div>
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '36px 24px 80px' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', lineHeight: 1.15, marginBottom: 28 }}>
          {clientName ? `Задание для ${clientName}` : 'Новое задание'}
        </h1>

        {/* Type selector */}
        <SectionLabel mb={12}>Тип задания</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
          {TASK_OPTIONS.map(opt => (
            <div key={opt.type} onClick={() => setType(opt.type)} style={{
              padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
              background: type === opt.type ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'rgba(var(--fg-rgb),0.03)',
              border: `1px solid ${type === opt.type ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'rgba(var(--fg-rgb),0.07)'}`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{opt.emoji}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: type === opt.type ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.8)' }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 1 }}>{opt.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Streak day picker */}
        {selected.hasStreak && (
          <div style={{ marginBottom: 24 }}>
            <SectionLabel mb={10}>Цель в днях</SectionLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              {STREAK_OPTIONS.map(d => (
                <div key={d} onClick={() => setTargetDays(d)} style={{
                  flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 10, cursor: 'pointer',
                  background: targetDays === d ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'rgba(var(--fg-rgb),0.05)',
                  border: `1px solid ${targetDays === d ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.1)'}`,
                  fontSize: 15, fontWeight: 600, color: targetDays === d ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.5)',
                }}>{d}</div>
              ))}
            </div>
          </div>
        )}

        {/* Schema picker */}
        {type === 'schema_intro' && (
          <div ref={configRef} style={{ marginBottom: 24 }}>
            <SectionLabel mb={10}>Какую схему изучить?</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ALL_SCHEMAS_FLAT.map(s => (
                <div key={s.id} onClick={() => setSelectedSchemaId(s.id)} style={{
                  padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
                  background: selectedSchemaId === s.id ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'rgba(var(--fg-rgb),0.03)',
                  border: `1px solid ${selectedSchemaId === s.id ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'rgba(var(--fg-rgb),0.07)'}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{s.emoji}</span>
                  <div style={{ fontSize: 13, fontWeight: 500, color: selectedSchemaId === s.id ? 'var(--accent)' : 'var(--text)' }}>{s.name}</div>
                  {selectedSchemaId === s.id && <span style={{ marginLeft: 'auto', fontSize: 14, color: 'var(--accent)' }}>✓</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mode picker */}
        {type === 'mode_intro' && (
          <div ref={configRef} style={{ marginBottom: 24 }}>
            <SectionLabel mb={10}>Какой режим изучить?</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ALL_MODES.map(m => (
                <div key={m.id} onClick={() => setSelectedModeId(m.id)} style={{
                  padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
                  background: selectedModeId === m.id ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'rgba(var(--fg-rgb),0.03)',
                  border: `1px solid ${selectedModeId === m.id ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'rgba(var(--fg-rgb),0.07)'}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{m.emoji}</span>
                  <div style={{ fontSize: 13, fontWeight: 500, color: selectedModeId === m.id ? 'var(--accent)' : 'var(--text)' }}>{m.name}</div>
                  {selectedModeId === m.id && <span style={{ marginLeft: 'auto', fontSize: 14, color: 'var(--accent)' }}>✓</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom text */}
        {type === 'custom' && (
          <div style={{ marginBottom: 24 }}>
            <SectionLabel mb={10}>Описание задания</SectionLabel>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Например: позвонить другу раз в неделю"
              style={{ width: '100%', minHeight: 80, background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.12)', borderRadius: 12, padding: '12px 14px', color: 'var(--text)', fontSize: 14, resize: 'none', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>
        )}

        {/* Due date */}
        {(type === 'custom' || clientId) && (
          <div style={{ marginBottom: 28 }}>
            <SectionLabel mb={10}>Срок (необязательно)</SectionLabel>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              style={{ width: '100%', background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.12)', borderRadius: 12, padding: '12px 14px', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        )}

        {error && <div style={{ fontSize: 13, color: 'var(--accent-red)', marginBottom: 14 }}>{error}</div>}

        <button onClick={handleCreate} disabled={saving} className="ex-btn ex-btn-primary" style={{ width: '100%' }}>
          {saving ? 'Сохраняю...' : 'Создать задание'}
        </button>
      </div>
    </div>
  );
}
