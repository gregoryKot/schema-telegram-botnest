import { useState, useRef, useEffect } from 'react';
import { ExScreen, GlyphCheck } from './exercises/ExScreen';
import { SectionLabel } from './SectionLabel';
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

const TASK_OPTIONS: { type: TaskType; emoji: string; label: string; sub: string; hasStreak?: boolean; time?: string }[] = [
  { type: 'diary_streak',   emoji: '📔', label: 'Дневник',              sub: 'Заполнять N дней подряд',                  hasStreak: true, time: '5–10 мин/день' },
  { type: 'tracker_streak', emoji: '📊', label: 'Трекер потребностей',  sub: 'Отмечать потребности N дней подряд',       hasStreak: true, time: '2–3 мин/день' },
  { type: 'schema_intro',   emoji: '🧩', label: 'Карточка схемы',       sub: 'Познакомиться со своей схемой — 7 вопросов', time: '15 мин' },
  { type: 'mode_intro',     emoji: '🔄', label: 'Карточка режима',      sub: 'Познакомиться со своим режимом',            time: '10 мин' },
  { type: 'belief_check',   emoji: '🔍', label: 'Проверить убеждение',  sub: 'Собрать доказательства за и против',        time: '20 мин' },
  { type: 'letter_to_self', emoji: '✉️', label: 'Письмо себе',          sub: 'Написать Уязвимому Ребёнку',               time: '30 мин' },
  { type: 'safe_place',     emoji: '🏡', label: 'Безопасное место',     sub: 'Описать и перечитывать',                   time: '20 мин' },
  { type: 'flashcard',      emoji: '🆘', label: 'Мне сейчас плохо',     sub: 'Разобрать ситуацию — 5 шагов',             time: '10 мин' },
  { type: 'custom',         emoji: '✏️', label: 'Своё задание',         sub: 'Любой текст, который сформулируешь сам',   time: '—' },
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
  const goBack = useHistorySheet(onClose);
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
    <ExScreen
      onBack={goBack}
      backLabel="Назад к кабинету"
      eyebrow={clientName ? `Задание для ${clientName}` : 'Новое задание'}
      eyebrowColor="var(--accent)"
      title={<>Какое задание<br /><span className="it">назначить?</span></>}
      lede="Задание появится у клиента в мини-аппе. Можно выбрать готовый формат или написать своё."
      aside={
        <div className="aside-card" style={{ borderColor: 'var(--accent)40', background: 'var(--accent)08', position: 'sticky', top: 40 }}>
          <div className="aside-card-eyebrow" style={{ color: 'var(--accent)' }}>Выбрано</div>
          <h3>{selected.emoji} {selected.label}</h3>
          <p className="body">{selected.sub}</p>
          {selected.time && (
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {selected.time}
            </div>
          )}
        </div>
      }
    >
      {/* ── Task type picker ── */}
      {TASK_OPTIONS.map(opt => (
        <div
          key={opt.type}
          className={'mode-card ' + (type === opt.type ? 'is-selected' : '')}
          style={{ '--mode-color': 'var(--accent)' } as React.CSSProperties}
          onClick={() => { haptic.select(); setType(opt.type); }}
        >
          <span className="mode-card-stripe" />
          <div>
            <div className="mode-card-name">{opt.emoji} {opt.label}</div>
            <div className="mode-card-short">{opt.sub}</div>
          </div>
          <span className="mode-check"><GlyphCheck /></span>
        </div>
      ))}

      {/* ── Config section ── */}
      <div ref={configRef}>

        {/* Streak */}
        {selected.hasStreak && (
          <div className="prompt">
            <div className="prompt-num">·</div>
            <div>
              <div className="prompt-label">Цель в днях</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {STREAK_OPTIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => setTargetDays(d)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                      fontWeight: 700, fontSize: 16,
                      background: targetDays === d ? 'var(--accent)' : 'var(--surface-2)',
                      color: targetDays === d ? 'var(--on-accent)' : 'var(--text-sub)',
                      border: targetDays === d ? 'none' : '1px solid var(--line)',
                    }}
                  >{d}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Schema picker */}
        {type === 'schema_intro' && (
          <div className="prompt">
            <div className="prompt-num">·</div>
            <div style={{ width: '100%' }}>
              <div className="prompt-label">Какую схему изучить?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                {ALL_SCHEMAS_FLAT.map(s => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSchemaId(s.id)}
                    className={'mode-card ' + (selectedSchemaId === s.id ? 'is-selected' : '')}
                    style={{ '--mode-color': s.domainColor } as React.CSSProperties}
                  >
                    <span className="mode-card-stripe" />
                    <div style={{ flex: 1 }}>
                      <div className="mode-card-name">{s.emoji} {s.name}</div>
                    </div>
                    {selectedSchemaId === s.id && <span className="mode-check"><GlyphCheck /></span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mode picker */}
        {type === 'mode_intro' && (
          <div className="prompt">
            <div className="prompt-num">·</div>
            <div style={{ width: '100%' }}>
              <div className="prompt-label">Какой режим изучить?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                {ALL_MODES.map(m => (
                  <div
                    key={m.id}
                    onClick={() => setSelectedModeId(m.id)}
                    className={'mode-card ' + (selectedModeId === m.id ? 'is-selected' : '')}
                    style={{ '--mode-color': 'var(--c-slate)' } as React.CSSProperties}
                  >
                    <span className="mode-card-stripe" />
                    <div style={{ flex: 1 }}>
                      <div className="mode-card-name">{m.emoji} {m.name}</div>
                    </div>
                    {selectedModeId === m.id && <span className="mode-check"><GlyphCheck /></span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Custom text */}
        {type === 'custom' && (
          <div className="prompt">
            <div className="prompt-num">·</div>
            <div style={{ width: '100%' }}>
              <div className="prompt-label">Описание задания <span style={{ color: 'var(--c-rose)', marginLeft: 2 }}>*</span></div>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Например: позвонить другу раз в неделю"
                className={'paper-input ' + (text.trim() ? 'is-filled' : '')}
                rows={3}
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Due date */}
        {(type === 'custom' || clientId) && (
          <div className="prompt">
            <div className="prompt-num">·</div>
            <div style={{ width: '100%' }}>
              <SectionLabel mb={8}>Срок (необязательно)</SectionLabel>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="paper-input"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="ex-foot">
        {error && <span style={{ fontSize: 12, color: 'var(--c-rose)' }}>{error}</span>}
        <span className="spacer" />
        <button
          className="ex-btn ex-btn-primary"
          disabled={!canSave || saving}
          onClick={handleCreate}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {saving ? 'Сохраняю…' : 'Назначить задание'}
          {!saving && <GlyphCheck />}
        </button>
      </div>
    </ExScreen>
  );
}
