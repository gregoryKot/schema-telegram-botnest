import { useState, useRef, useEffect } from 'react';
import { GlyphArrowLeft } from './exercises/ExScreen';
import { api } from '../api';
import { SCHEMA_DOMAINS, ALL_MODES } from '../schemaTherapyData';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { haptic } from '../haptic';

type TaskType = 'diary_streak' | 'tracker_streak' | 'belief_check' | 'letter_to_self' | 'safe_place' | 'flashcard' | 'schema_intro' | 'mode_intro' | 'custom';

interface Props {
  clientId?: number;
  clientName?: string;
  defaultType?: TaskType;
  onCreated: () => void;
  onClose: () => void;
}

const STREAK_OPTIONS = [3, 7, 14, 30];

type TaskOption = { type: TaskType; label: string; sub: string; hasStreak?: boolean; time: string; color: string };

const TASK_OPTIONS: TaskOption[] = [
  { type: 'tracker_streak', label: 'Трекер потребностей',  sub: 'Отмечать потребности N дней подряд',        hasStreak: true, time: '2–3 мин/день',  color: 'var(--c-amber)'  },
  { type: 'schema_intro',   label: 'Карточка схемы',       sub: 'Познакомиться со схемой — 7 вопросов',      time: '15 мин',             color: 'var(--c-plum)'   },
  { type: 'mode_intro',     label: 'Карточка режима',      sub: 'Познакомиться со своим режимом',            time: '10 мин',             color: 'var(--c-slate)'  },
  { type: 'belief_check',   label: 'Проверить убеждение',  sub: 'Собрать доказательства за и против',        time: '20 мин',             color: 'var(--c-moss)'   },
  { type: 'letter_to_self', label: 'Письмо себе',          sub: 'Написать Уязвимому Ребёнку',               time: '30 мин',             color: 'var(--c-clay)'   },
  { type: 'safe_place',     label: 'Безопасное место',     sub: 'Описать и перечитывать',                   time: '20 мин',             color: 'var(--c-moss)'   },
  { type: 'diary_streak',   label: 'Дневник',              sub: 'Заполнять N дней подряд',                  hasStreak: true, time: '5–10 мин/день', color: 'var(--accent-indigo)' },
  { type: 'flashcard',      label: 'Мне сейчас плохо',     sub: 'Разобрать ситуацию — 5 шагов',             time: '10 мин',             color: 'var(--c-rose)'   },
  { type: 'custom',         label: 'Своё задание',         sub: 'Любой текст, который сформулируешь сам',   time: '—',                  color: 'var(--text-sub)' },
];

const ALL_SCHEMAS_FLAT = SCHEMA_DOMAINS.flatMap(d => d.schemas.map(s => ({ id: s.id, name: s.name, domainColor: d.color })));

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
  const goBack = useHistorySheet(onClose);
  const [type, setType] = useState<TaskType>(defaultType ?? 'tracker_streak');
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
      setTimeout(() => configRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
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
    haptic.success();
    setSaving(true); setError('');
    try {
      await api.createTask({ type, text: finalText, targetDays: selected.hasStreak ? targetDays : undefined, dueDate: dueDate || undefined, clientId });
      onCreated();
    } catch { haptic.error(); setError('Не удалось сохранить'); }
    finally { setSaving(false); }
  }

  const canSave = type !== 'custom' || text.trim().length > 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden' }}>

      {/* ── Topbar ── */}
      <div className="ex-topbar" style={{ justifyContent: 'space-between', flexShrink: 0 }}>
        <button className="ex-back" onClick={goBack}>
          <GlyphArrowLeft /> Назад к кабинету
        </button>
        <div />
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ overflowY: 'auto', overflowX: 'hidden' }}>
        <div className="page-inner" style={{ paddingTop: 32, paddingBottom: 40 }}>

          {/* Header */}
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            <span style={{ color: 'var(--accent)' }}>● </span>
            {clientName ? `Задание для ${clientName}` : 'Новое задание'}
          </div>
          <h1 className="hub-title" style={{ marginBottom: 8 }}>
            Выбери<br /><span className="it">задание</span>
          </h1>
          <p className="hub-sub" style={{ marginBottom: 32 }}>
            Появится у клиента в мини-аппе — он выполняет самостоятельно.
          </p>

          {/* ── Task list ── */}
          <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(var(--fg-rgb),0.07)' }}>
            {TASK_OPTIONS.map((opt, i) => {
              const isSelected = type === opt.type;
              return (
                <div
                  key={opt.type}
                  onClick={() => { haptic.select(); setType(opt.type); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '14px 0',
                    borderBottom: i < TASK_OPTIONS.length - 1 ? '1px solid rgba(var(--fg-rgb),0.07)' : 'none',
                    cursor: 'pointer',
                    transition: 'opacity 0.1s',
                  }}
                >
                  {/* Color stripe / indicator */}
                  <div style={{
                    width: 4, height: 36, borderRadius: 3, flexShrink: 0,
                    background: isSelected ? opt.color : 'rgba(var(--fg-rgb),0.1)',
                    transition: 'background 0.2s',
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 15, fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? 'var(--text)' : 'var(--text)',
                      lineHeight: 1.3, marginBottom: 2,
                    }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.4 }}>
                      {opt.sub}
                    </div>
                  </div>

                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 500 }}>{opt.time}</span>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: isSelected ? 'var(--text)' : 'transparent',
                      border: `2px solid ${isSelected ? 'var(--text)' : 'rgba(var(--fg-rgb),0.2)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                      flexShrink: 0,
                    }}>
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="var(--bg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Config section ── */}
          <div ref={configRef} style={{ marginTop: 28 }}>

            {/* Streak picker */}
            {selected.hasStreak && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>
                  Цель в днях
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {STREAK_OPTIONS.map(d => (
                    <button
                      key={d}
                      onClick={() => setTargetDays(d)}
                      style={{
                        flex: 1, padding: '11px 0', borderRadius: 10, cursor: 'pointer',
                        fontWeight: 600, fontSize: 16, fontFamily: 'inherit',
                        background: targetDays === d ? 'var(--text)' : 'rgba(var(--fg-rgb),0.05)',
                        color: targetDays === d ? 'var(--bg)' : 'var(--text-sub)',
                        border: 'none',
                        transition: 'all 0.15s',
                      }}
                    >{d}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Schema picker */}
            {type === 'schema_intro' && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>
                  Какую схему изучить?
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(var(--fg-rgb),0.07)' }}>
                  {ALL_SCHEMAS_FLAT.map((s, i) => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSchemaId(s.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '11px 0',
                        borderBottom: i < ALL_SCHEMAS_FLAT.length - 1 ? '1px solid rgba(var(--fg-rgb),0.07)' : 'none',
                        cursor: 'pointer',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 3, height: 20, borderRadius: 2, background: s.domainColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: selectedSchemaId === s.id ? 600 : 400 }}>{s.name}</span>
                      </div>
                      {selectedSchemaId === s.id && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <polyline points="2,7 5.5,10.5 12,3.5" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mode picker */}
            {type === 'mode_intro' && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>
                  Какой режим изучить?
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(var(--fg-rgb),0.07)' }}>
                  {ALL_MODES.map((m, i) => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedModeId(m.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '11px 0',
                        borderBottom: i < ALL_MODES.length - 1 ? '1px solid rgba(var(--fg-rgb),0.07)' : 'none',
                        cursor: 'pointer',
                        gap: 12,
                      }}
                    >
                      <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: selectedModeId === m.id ? 600 : 400 }}>
                        {m.emoji} {m.name}
                      </span>
                      {selectedModeId === m.id && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <polyline points="2,7 5.5,10.5 12,3.5" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom text */}
            {type === 'custom' && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>
                  Описание задания
                </div>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Например: позвонить другу раз в неделю"
                  className={'paper-input ' + (text.trim() ? 'is-filled' : '')}
                  rows={3}
                  autoFocus
                  style={{ width: '100%' }}
                />
              </div>
            )}

            {/* Due date */}
            {(type === 'custom' || clientId) && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>
                  Срок (необязательно)
                </div>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="paper-input"
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Sticky footer ── */}
      <div style={{
        padding: '16px 20px',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
        borderTop: '1px solid rgba(var(--fg-rgb),0.07)',
        background: 'var(--bg)',
        flexShrink: 0,
      }}>
        {error && <div style={{ fontSize: 12, color: 'var(--c-rose)', marginBottom: 8 }}>{error}</div>}
        <button
          className="btn-primary"
          disabled={!canSave || saving}
          onClick={handleCreate}
        >
          {saving ? 'Назначаю…' : `Назначить задание — ${selected.label}`}
        </button>
      </div>

    </div>
  );
}
